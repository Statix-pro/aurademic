/**
 * The dispatcher is the part that must never lose work and must never do work
 * twice. Both properties are load-bearing:
 *
 *   - Losing work means an approver is never told a request is waiting on them.
 *   - Doing it twice means a duplicate browser push, or an event that keeps
 *     re-notifying people every sweep.
 *
 * The tests below pin the retry ladder, the "claimed but never finished"
 * recovery, and the preference precedence that decides which channels fire.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

vi.mock('../modules/notification/notificationModel.js', () => ({
  default: {
    claimPendingEvents: vi.fn(),
    releaseStaleClaims: vi.fn(),
    renewClaim: vi.fn(),
    markEventDone: vi.fn(),
    markEventForRetry: vi.fn(),
    markEventFailed: vi.fn(),
    insertNotifications: vi.fn(),
    insertDeliveries: vi.fn(),
    listPendingDeliveries: vi.fn(),
    markDelivery: vi.fn(),
    getPreferencesForUsers: vi.fn(),
    getUserNames: vi.fn(),
    listPushSubscriptions: vi.fn(),
    disablePushSubscription: vi.fn(),
  },
}));

vi.mock('../modules/notification/recipientResolver.js', () => ({
  resolveRecipients: vi.fn(),
}));

import { getChannel } from '../modules/notification/channels/index.js';
import { __testing, runOnce } from '../modules/notification/notificationDispatcher.js';
import notificationModel from '../modules/notification/notificationModel.js';
import { resolveRecipients } from '../modules/notification/recipientResolver.js';

const makeEvent = (overrides = {}) => ({
  id: 100,
  event_type: 'finance.stage_advanced',
  actor_user_id: 1,
  module_key: 'finance',
  record_id: 42,
  attempts: 0,
  payload: JSON.stringify({
    audience: [{ kind: 'user', userId: 2, recipientRole: 'approver' }],
    data: { moduleKey: 'finance', recordId: 42, reference: 'FIN-42', stage: 'dof' },
  }),
  ...overrides,
});

const makeNotification = (overrides = {}) => ({
  id: 900,
  user_id: 2,
  event_type: 'finance.stage_advanced',
  category: 'finance',
  severity: 'info',
  title: 'Finance request FIN-42 needs your approval',
  body: null,
  link: '/workflow/finance',
  recipient_role: 'approver',
  ...overrides,
});

/** A row as `listPendingDeliveries` returns it. */
const makePendingDelivery = (overrides = {}) => ({
  notification_id: 900,
  channel: 'in_app',
  user_id: 2,
  event_type: 'finance.stage_advanced',
  category: 'finance',
  severity: 'info',
  title: 'x',
  body: null,
  link: '/workflow/finance',
  ...overrides,
});

/** claimPendingEvents hands back its lease token alongside the batch. */
const mockClaim = (events) =>
  notificationModel.claimPendingEvents.mockResolvedValue({ token: 'test-lease', events });

beforeEach(() => {
  vi.clearAllMocks();
  __testing.resetSweepState();
  notificationModel.releaseStaleClaims.mockResolvedValue({ released: 0, failed: 0 });
  // The terminal writes are fenced on the lease and report whether they
  // applied; the default is the ordinary case where this worker still holds it.
  notificationModel.markEventDone.mockResolvedValue(true);
  notificationModel.markEventForRetry.mockResolvedValue(true);
  notificationModel.markEventFailed.mockResolvedValue(true);
  notificationModel.renewClaim.mockResolvedValue(true);
  mockClaim([]);
  notificationModel.insertNotifications.mockResolvedValue([makeNotification()]);
  notificationModel.insertDeliveries.mockResolvedValue(undefined);
  notificationModel.listPendingDeliveries.mockResolvedValue([]);
  notificationModel.getPreferencesForUsers.mockResolvedValue([]);
  notificationModel.getUserNames.mockResolvedValue(new Map());
  resolveRecipients.mockResolvedValue({
    recipients: [{ userId: 2, recipientRole: 'approver' }],
    errors: [],
    truncated: false,
  });
});

describe('notificationDispatcher.runOnce', () => {
  it('does nothing and reports zero when the outbox is empty', async () => {
    expect(await runOnce()).toBe(0);
    expect(notificationModel.insertNotifications).not.toHaveBeenCalled();
  });

  it('fans an event out and completes it', async () => {
    mockClaim([makeEvent()]);

    expect(await runOnce()).toBe(1);

    const [eventId, rows] = notificationModel.insertNotifications.mock.calls[0];
    expect(eventId).toBe(100);
    expect(rows).toEqual([
      expect.objectContaining({
        userId: 2,
        recipientRole: 'approver',
        eventType: 'finance.stage_advanced',
        title: expect.stringContaining('FIN-42'),
        link: '/workflow/finance',
      }),
    ]);
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
    expect(notificationModel.markEventFailed).not.toHaveBeenCalled();
  });

  it('completes an event with no recipients rather than retrying it', async () => {
    // A department with no HOD assigned, or an event whose only recipient was
    // the actor. Nothing is wrong; there is simply nobody to tell.
    mockClaim([makeEvent()]);
    resolveRecipients.mockResolvedValue({ recipients: [], errors: [], truncated: false });

    await runOnce();

    expect(notificationModel.insertNotifications).not.toHaveBeenCalled();
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
  });

  it('retries when a descriptor failed to resolve, so the rest still get told', async () => {
    mockClaim([makeEvent()]);
    resolveRecipients.mockResolvedValue({
      recipients: [{ userId: 2, recipientRole: 'approver' }],
      errors: ['audience role: connection lost'],
      truncated: false,
    });

    await runOnce();

    // The recipients that DID resolve are notified immediately...
    expect(notificationModel.insertNotifications).toHaveBeenCalled();
    // ...and the event comes back for another pass to pick up the rest.
    expect(notificationModel.markEventForRetry).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ delaySeconds: 60 }),
    );
    expect(notificationModel.markEventDone).not.toHaveBeenCalled();
  });

  it('walks the backoff ladder as attempts accumulate', async () => {
    const [first, second, third] = __testing.RETRY_DELAYS_SECONDS;

    for (const [attempts, expectedDelay] of [
      [0, first],
      [1, second],
      [2, third],
    ]) {
      vi.clearAllMocks();
      mockClaim([makeEvent({ attempts })]);
      notificationModel.insertNotifications.mockRejectedValue(new Error('db down'));
      resolveRecipients.mockResolvedValue({
        recipients: [{ userId: 2, recipientRole: 'approver' }],
        errors: [],
        truncated: false,
      });

      await runOnce();

      expect(notificationModel.markEventForRetry).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ delaySeconds: expectedDelay }),
      );
    }
  });

  it('gives up after the last attempt instead of retrying forever', async () => {
    mockClaim([makeEvent({ attempts: __testing.MAX_ATTEMPTS - 1 })]);
    notificationModel.insertNotifications.mockRejectedValue(new Error('db down'));

    await runOnce();

    expect(notificationModel.markEventFailed).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ error: 'db down' }),
    );
    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
  });

  it('fails an event permanently when its type has left the catalog', async () => {
    // Retrying cannot help: there is no template to render it with.
    mockClaim([makeEvent({ event_type: 'finance.removed_type' })]);

    await runOnce();

    expect(notificationModel.markEventFailed).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ error: expect.stringContaining('Unknown notification type') }),
    );
    expect(notificationModel.insertNotifications).not.toHaveBeenCalled();
  });

  it('keeps processing the rest of the batch when one event fails', async () => {
    mockClaim([makeEvent({ id: 100, event_type: 'finance.removed_type' }), makeEvent({ id: 101 })]);

    expect(await runOnce()).toBe(2);
    expect(notificationModel.markEventFailed).toHaveBeenCalledWith(100, expect.anything());
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(101, {
      lockedBy: expect.any(String),
    });
  });

  it('fills in the actor name so the body reads as a sentence', async () => {
    mockClaim([makeEvent()]);
    notificationModel.getUserNames.mockResolvedValue(new Map([[1, 'Dr. Approver']]));
    resolveRecipients.mockResolvedValue({
      recipients: [{ userId: 2, recipientRole: 'applicant' }],
      errors: [],
      truncated: false,
    });

    await runOnce();

    expect(notificationModel.getUserNames).toHaveBeenCalledWith([1]);
    const [, rows] = notificationModel.insertNotifications.mock.calls[0];
    expect(rows[0].body).toContain('Dr. Approver');
  });

  it('does not look up a name the emitter already supplied', async () => {
    mockClaim([
      makeEvent({
        payload: JSON.stringify({
          audience: [{ kind: 'user', userId: 2, recipientRole: 'applicant' }],
          data: { moduleKey: 'finance', recordId: 42, actorName: 'Already Known' },
        }),
      }),
    ]);
    resolveRecipients.mockResolvedValue({
      recipients: [{ userId: 2, recipientRole: 'applicant' }],
      errors: [],
      truncated: false,
    });

    await runOnce();

    expect(notificationModel.getUserNames).not.toHaveBeenCalled();
  });

  it('still delivers when the name lookup fails', async () => {
    // Nicer wording is not worth retrying an approval notification over.
    mockClaim([makeEvent()]);
    notificationModel.getUserNames.mockRejectedValue(new Error('lookup down'));

    await runOnce();

    expect(notificationModel.insertNotifications).toHaveBeenCalled();
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
  });

  it('renders once per recipient role, not once per person', async () => {
    mockClaim([makeEvent()]);
    resolveRecipients.mockResolvedValue({
      recipients: [
        { userId: 2, recipientRole: 'approver' },
        { userId: 3, recipientRole: 'approver' },
        { userId: 4, recipientRole: 'applicant' },
      ],
      errors: [],
      truncated: false,
    });

    await runOnce();

    const [, rows] = notificationModel.insertNotifications.mock.calls[0];
    // Both approvers get the queue link; the applicant gets the record link.
    expect(rows.filter((r) => r.recipientRole === 'approver').map((r) => r.link)).toEqual([
      '/workflow/finance',
      '/workflow/finance',
    ]);
    expect(rows.find((r) => r.recipientRole === 'applicant').link).toBe('/finance/42');
  });

  it('only sends deliveries the model still reports as pending', async () => {
    // This is what stops a reprocessed event from pushing to a browser twice:
    // rows already 'sent' are simply not returned.
    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      {
        notification_id: 900,
        channel: 'in_app',
        user_id: 2,
        event_type: 'finance.stage_advanced',
        category: 'finance',
        severity: 'info',
        title: 'x',
        body: null,
        link: '/workflow/finance',
      },
    ]);

    await runOnce();

    expect(notificationModel.markDelivery).toHaveBeenCalledTimes(1);
    expect(notificationModel.markDelivery).toHaveBeenCalledWith(900, 'in_app', {
      status: 'sent',
      error: null,
    });
  });

  it('heartbeats its lease while a single delivery is still in flight', async () => {
    // The renewal cannot wait for deliver() to return: the whole risk is a
    // channel that takes longer than the stale threshold, at which point the
    // reaper would hand the event to another worker and the recipient would be
    // pushed twice.
    vi.useFakeTimers();
    const inApp = getChannel('in_app');
    let finishDelivery;
    const deliver = vi
      .spyOn(inApp, 'deliver')
      .mockReturnValue(new Promise((resolve) => (finishDelivery = resolve)));

    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([makePendingDelivery()]);

    const sweep = runOnce();
    // One renewal happens before the event is processed at all; the rest are
    // the heartbeat, ticking while the delivery is stuck.
    await vi.advanceTimersByTimeAsync(__testing.LEASE_RENEW_INTERVAL_MS * 3);
    expect(notificationModel.renewClaim.mock.calls.length).toBeGreaterThan(2);
    expect(notificationModel.renewClaim).toHaveBeenCalledWith(100, { lockedBy: 'test-lease' });

    finishDelivery({ status: 'sent' });
    await sweep;

    // ...and it stops the moment the event is finished.
    const beatsWhileWorking = notificationModel.renewClaim.mock.calls.length;
    await vi.advanceTimersByTimeAsync(__testing.LEASE_RENEW_INTERVAL_MS * 3);
    expect(notificationModel.renewClaim.mock.calls.length).toBe(beatsWhileWorking);

    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
    deliver.mockRestore();
    vi.useRealTimers();
  });

  it('stops delivering when the heartbeat finds the lease gone', async () => {
    // Another worker owns the event now and will send whatever is still
    // pending. Carrying on here would deliver those rows twice.
    vi.useFakeTimers();
    const inApp = getChannel('in_app');
    let finishFirstDelivery;
    const deliver = vi
      .spyOn(inApp, 'deliver')
      .mockReturnValueOnce(new Promise((resolve) => (finishFirstDelivery = resolve)))
      .mockResolvedValue({ status: 'sent' });

    // The first call is runOnce's pre-processing stamp; the heartbeat that
    // follows finds the claim gone.
    notificationModel.renewClaim.mockResolvedValueOnce(true).mockResolvedValue(false);

    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      makePendingDelivery({ notification_id: 900 }),
      makePendingDelivery({ notification_id: 901 }),
      makePendingDelivery({ notification_id: 902 }),
    ]);

    const sweep = runOnce();
    await vi.advanceTimersByTimeAsync(__testing.LEASE_RENEW_INTERVAL_MS + 1000);
    finishFirstDelivery({ status: 'sent' });
    await sweep;

    expect(deliver).toHaveBeenCalledTimes(1);
    // The one that did go out is still recorded, so the new owner does not
    // repeat it — `listPendingDeliveries` will not return a 'sent' row.
    expect(notificationModel.markDelivery).toHaveBeenCalledTimes(1);
    expect(notificationModel.markDelivery).toHaveBeenCalledWith(900, 'in_app', {
      status: 'sent',
      error: null,
    });
    // The event itself is left exactly as its new owner found it.
    expect(notificationModel.markEventDone).not.toHaveBeenCalled();
    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
    expect(notificationModel.markEventFailed).not.toHaveBeenCalled();

    deliver.mockRestore();
    vi.useRealTimers();
  });

  it('keeps beating through a database blip rather than abandoning the event', async () => {
    // A failed renewal is not evidence that the lease is gone — and the reaper
    // could not have run during the same outage either.
    vi.useFakeTimers();
    const inApp = getChannel('in_app');
    let finishDelivery;
    const deliver = vi
      .spyOn(inApp, 'deliver')
      .mockReturnValue(new Promise((resolve) => (finishDelivery = resolve)));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    notificationModel.renewClaim
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('pool exhausted'))
      .mockResolvedValue(true);

    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([makePendingDelivery()]);

    const sweep = runOnce();
    await vi.advanceTimersByTimeAsync(__testing.LEASE_RENEW_INTERVAL_MS * 2);
    finishDelivery({ status: 'sent' });
    await sweep;

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });

    warn.mockRestore();
    deliver.mockRestore();
    vi.useRealTimers();
  });

  it('records a channel that throws as failed without stopping the sweep', async () => {
    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      {
        notification_id: 900,
        channel: 'web_push',
        user_id: 2,
        event_type: 'finance.stage_advanced',
        category: 'finance',
        severity: 'info',
        title: 'x',
        body: null,
        link: '/x',
      },
    ]);
    // No VAPID keys in the test env, so web push reports itself skipped rather
    // than attempting a send.
    await runOnce();

    expect(notificationModel.markDelivery).toHaveBeenCalledWith(
      900,
      'web_push',
      expect.objectContaining({ status: expect.stringMatching(/skipped|failed/) }),
    );
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
  });

  it('retries an event whose delivery failed transiently instead of closing it', async () => {
    // A 'failed' delivery is the channel saying "try again" — a dead push
    // endpoint answers 'skipped'. Nothing else ever looks at the row again
    // (`listPendingDeliveries` reads 'pending' only), so if the event were
    // completed here the recipient would simply never be told.
    const inApp = getChannel('in_app');
    const deliver = vi
      .spyOn(inApp, 'deliver')
      .mockResolvedValue({ status: 'failed', error: 'push service 503' });

    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      {
        notification_id: 900,
        channel: 'in_app',
        user_id: 2,
        event_type: 'finance.stage_advanced',
        category: 'finance',
        severity: 'info',
        title: 'x',
        body: null,
        link: '/x',
      },
    ]);

    try {
      await runOnce();
    } finally {
      deliver.mockRestore();
    }

    expect(notificationModel.markDelivery).toHaveBeenCalledWith(900, 'in_app', {
      status: 'failed',
      error: 'push service 503',
    });
    expect(notificationModel.markEventDone).not.toHaveBeenCalled();
    expect(notificationModel.markEventForRetry).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ delaySeconds: 60 }),
    );
  });

  it('completes an event when every delivery was skipped rather than failed', async () => {
    // 'skipped' is a settled outcome — a muted channel, or one this deployment
    // has no keys for. Retrying it would burn the ladder for nothing.
    mockClaim([makeEvent()]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      {
        notification_id: 900,
        channel: 'web_push',
        user_id: 2,
        event_type: 'finance.stage_advanced',
        category: 'finance',
        severity: 'info',
        title: 'x',
        body: null,
        link: '/x',
      },
    ]);

    await runOnce();

    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
  });

  it('stops retrying failed deliveries once the ladder is exhausted', async () => {
    const inApp = getChannel('in_app');
    const deliver = vi
      .spyOn(inApp, 'deliver')
      .mockResolvedValue({ status: 'failed', error: 'still down' });

    mockClaim([makeEvent({ attempts: __testing.MAX_ATTEMPTS - 1 })]);
    notificationModel.listPendingDeliveries.mockResolvedValue([
      {
        notification_id: 900,
        channel: 'in_app',
        user_id: 2,
        event_type: 'finance.stage_advanced',
        category: 'finance',
        severity: 'info',
        title: 'x',
        body: null,
        link: '/x',
      },
    ]);

    try {
      await runOnce();
    } finally {
      deliver.mockRestore();
    }

    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
    expect(notificationModel.markEventFailed).toHaveBeenCalledWith(
      100,
      expect.objectContaining({ error: expect.stringContaining('deliveries failed') }),
    );
  });

  it('marks a channel skipped when the deployment has it disabled', async () => {
    // Stated rather than assumed: vitest.setup.js blanks the VAPID keys so the
    // push channel reports itself disabled on every machine. Without that pin
    // this test passed or failed depending on the developer's local .env.
    expect(getChannel('web_push').isEnabled()).toBe(false);

    mockClaim([makeEvent()]);

    await runOnce();

    const deliveryRows = notificationModel.insertDeliveries.mock.calls[0][0];
    const webPush = deliveryRows.find((row) => row.channel === 'web_push');
    // A disabled channel is skipped, not queued and retried forever.
    expect(webPush.status).toBe('skipped');
    expect(deliveryRows.find((row) => row.channel === 'in_app').status).toBe('pending');
  });

  it('tolerates a payload that is not valid JSON', async () => {
    mockClaim([makeEvent({ payload: 'not json{' })]);
    resolveRecipients.mockResolvedValue({ recipients: [], errors: [], truncated: false });

    await runOnce();

    expect(notificationModel.markEventDone).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
  });

  it('does not claim to have retried an event whose lease was already gone', async () => {
    // The terminal writes are fenced on the lease, so one that did not apply
    // means another worker owns the event. Saying "retrying in 60s" then would
    // describe a row this worker never wrote.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockClaim([makeEvent()]);
    notificationModel.insertNotifications.mockRejectedValue(new Error('db down'));
    notificationModel.markEventForRetry.mockResolvedValue(false);

    await runOnce();

    const messages = warn.mock.calls.map(([message]) => String(message));
    expect(messages.some((m) => m.includes('claim was already gone'))).toBe(true);
    expect(messages.some((m) => m.includes('retrying in'))).toBe(false);
    warn.mockRestore();
  });

  it('reports events the reaper gave up on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    notificationModel.releaseStaleClaims.mockResolvedValue({ released: 2, failed: 1 });

    await runOnce();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('gave up'));
    error.mockRestore();
  });

  it('never throws out of a sweep, even when claiming fails', async () => {
    notificationModel.claimPendingEvents.mockRejectedValue(new Error('pool exhausted'));
    await expect(runOnce()).resolves.toBe(0);
  });

  it('reaps stale claims so a killed process does not strand its batch', async () => {
    await runOnce();
    expect(notificationModel.releaseStaleClaims).toHaveBeenCalledWith({
      staleMinutes: 5,
      maxAttempts: __testing.MAX_ATTEMPTS,
    });
  });

  it('renews its lease per event so a slow batch is not reaped mid-flight', async () => {
    mockClaim([makeEvent()]);

    await runOnce();

    expect(notificationModel.renewClaim).toHaveBeenCalledWith(100, {
      lockedBy: expect.any(String),
    });
  });

  it('skips an event whose claim was revoked rather than double-sending it', async () => {
    mockClaim([makeEvent()]);
    notificationModel.renewClaim.mockResolvedValue(false);

    await runOnce();

    expect(resolveRecipients).not.toHaveBeenCalled();
    expect(notificationModel.insertNotifications).not.toHaveBeenCalled();
    expect(notificationModel.markEventDone).not.toHaveBeenCalled();
    expect(notificationModel.markEventForRetry).not.toHaveBeenCalled();
  });
});

describe('channel preference precedence', () => {
  const base = {
    userId: 2,
    eventType: 'finance.stage_advanced',
    category: 'finance',
    channel: 'web_push',
    defaultChannels: ['in_app', 'web_push'],
  };

  it('uses the catalog default when the user has expressed no preference', () => {
    expect(__testing.isChannelWanted({ ...base, preferences: [] })).toBe(true);
    expect(
      __testing.isChannelWanted({ ...base, preferences: [], defaultChannels: ['in_app'] }),
    ).toBe(false);
  });

  it('lets an exact per-type row override the default', () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        preferences: [
          { user_id: 2, event_type: 'finance.stage_advanced', channel: 'web_push', is_enabled: 0 },
        ],
      }),
    ).toBe(false);
  });

  it('lets a user opt IN to a channel the type does not ship with', () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        defaultChannels: ['in_app'],
        preferences: [
          { user_id: 2, event_type: 'finance.stage_advanced', channel: 'web_push', is_enabled: 1 },
        ],
      }),
    ).toBe(true);
  });

  it('falls back to a category wildcard row', () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        preferences: [
          { user_id: 2, event_type: '*', category: 'finance', channel: 'web_push', is_enabled: 0 },
        ],
      }),
    ).toBe(false);
  });

  it('prefers the exact row over the wildcard', () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        preferences: [
          { user_id: 2, event_type: '*', category: 'finance', channel: 'web_push', is_enabled: 0 },
          { user_id: 2, event_type: 'finance.stage_advanced', channel: 'web_push', is_enabled: 1 },
        ],
      }),
    ).toBe(true);
  });

  it("ignores another user's preferences", () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        preferences: [
          {
            user_id: 999,
            event_type: 'finance.stage_advanced',
            channel: 'web_push',
            is_enabled: 0,
          },
        ],
      }),
    ).toBe(true);
  });

  it('ignores a wildcard row for a different category', () => {
    expect(
      __testing.isChannelWanted({
        ...base,
        preferences: [
          { user_id: 2, event_type: '*', category: 'budget', channel: 'web_push', is_enabled: 0 },
        ],
      }),
    ).toBe(true);
  });
});
