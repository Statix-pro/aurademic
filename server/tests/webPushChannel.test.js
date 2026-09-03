/**
 * The web push channel.
 *
 * A push request is a network call to a service we do not control, and the
 * dispatcher renews its event lease between deliveries rather than during one.
 * So the tests below pin the two bounds that keep a single deliver() call from
 * outliving the stale-claim threshold — a socket timeout per request, and a
 * budget across one recipient's subscriptions — alongside the retirement of
 * subscriptions the push service says are gone for good.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-push', () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

vi.mock('../modules/notification/notificationModel.js', () => ({
  default: {
    listPushSubscriptions: vi.fn(),
    disablePushSubscription: vi.fn(),
  },
}));

import webpush from 'web-push';

import webPushChannel, {
  resetWebPushConfig,
} from '../modules/notification/channels/webPushChannel.js';
import notificationModel from '../modules/notification/notificationModel.js';

const makeSubscription = (n) => ({
  endpoint: `https://push.example/${n}`,
  p256dh: `p256dh-${n}`,
  auth: `auth-${n}`,
});

const notification = {
  id: 900,
  eventType: 'finance.stage_advanced',
  severity: 'info',
  title: 'FIN-42 needs your approval',
  body: null,
  link: '/workflow/finance',
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_PUBLIC_KEY = 'public';
  process.env.VAPID_PRIVATE_KEY = 'private';
  process.env.VAPID_SUBJECT = 'mailto:noreply@ksrct.ac.in';
  resetWebPushConfig();
  webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
  notificationModel.listPushSubscriptions.mockResolvedValue([makeSubscription(1)]);
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  resetWebPushConfig();
  vi.restoreAllMocks();
});

describe('webPushChannel.deliver', () => {
  it('bounds every push request with a socket timeout', async () => {
    // Without it a push service that accepts the connection and then goes
    // quiet holds the delivery — and the dispatcher's lease — open forever.
    await expect(webPushChannel.deliver(notification, { userId: 2 })).resolves.toEqual({
      status: 'sent',
    });

    const [, , options] = webpush.sendNotification.mock.calls[0];
    expect(options).toEqual(expect.objectContaining({ timeout: expect.any(Number) }));
    expect(options.timeout).toBeGreaterThan(0);
  });

  it('stops fanning out once the delivery budget is spent', async () => {
    // A person with many registered devices must not be able to stretch one
    // delivery past the stale-claim threshold.
    notificationModel.listPushSubscriptions.mockResolvedValue([
      makeSubscription(1),
      makeSubscription(2),
      makeSubscription(3),
      makeSubscription(4),
    ]);

    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    webpush.sendNotification.mockImplementation(async () => {
      clock += 40000;
      return { statusCode: 201 };
    });

    const result = await webPushChannel.deliver(notification, { userId: 2 });

    // Two sends spend the 60s budget; the rest are left for the retry ladder.
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    // Something got through, so the delivery counts as sent — the same partial
    // outcome as a couple of endpoints having gone stale.
    expect(result).toEqual({ status: 'sent' });
  });

  it('reports a failure when the budget runs out before anything is sent', async () => {
    notificationModel.listPushSubscriptions.mockResolvedValue([
      makeSubscription(1),
      makeSubscription(2),
    ]);

    let clock = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => clock);
    webpush.sendNotification.mockImplementation(async () => {
      clock += 90000;
      throw new Error('Socket timeout');
    });

    const result = await webPushChannel.deliver(notification, { userId: 2 });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    // 'failed', not 'skipped': the dispatcher retries this rather than dropping it.
    expect(result.status).toBe('failed');
    expect(result.error).toContain('not attempted');
  });

  it('retires a subscription the push service says is gone', async () => {
    notificationModel.listPushSubscriptions.mockResolvedValue([makeSubscription(1)]);
    const gone = Object.assign(new Error('Gone'), { statusCode: 410 });
    webpush.sendNotification.mockRejectedValue(gone);

    const result = await webPushChannel.deliver(notification, { userId: 2 });

    expect(notificationModel.disablePushSubscription).toHaveBeenCalledWith(
      'https://push.example/1',
    );
    expect(result.status).toBe('skipped');
  });

  it('skips a recipient with no subscriptions instead of failing the delivery', async () => {
    notificationModel.listPushSubscriptions.mockResolvedValue([]);

    const result = await webPushChannel.deliver(notification, { userId: 2 });

    expect(result.status).toBe('skipped');
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
