/**
 * `emit` is called from inside the transaction that made the business change —
 * an approval that also consumes budget, a proposal being submitted. Its single
 * most important property is therefore negative: it must never, under any
 * failure, propagate an error to that caller.
 *
 * If it did, a broken notification table or a typo in an event type would roll
 * back legitimate approvals. Every test here exists to pin that down.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

vi.mock('../modules/notification/notificationModel.js', () => ({
  default: { insertEvent: vi.fn() },
}));

vi.mock('../modules/notification/notificationDispatcher.js', () => ({
  scheduleDispatch: vi.fn(),
}));

import { scheduleDispatch } from '../modules/notification/notificationDispatcher.js';
import notificationModel from '../modules/notification/notificationModel.js';
import { emit } from '../modules/notification/notificationService.js';

const validEmit = {
  type: 'finance.approved',
  actorUserId: 3,
  subject: { moduleKey: 'finance', recordId: 42 },
  audience: [{ kind: 'user', userId: 9, recipientRole: 'applicant' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  notificationModel.insertEvent.mockResolvedValue(555);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('notificationService.emit', () => {
  it('writes one outbox row and returns its id', async () => {
    await expect(emit(validEmit)).resolves.toBe(555);
    expect(notificationModel.insertEvent).toHaveBeenCalledTimes(1);

    const [payload] = notificationModel.insertEvent.mock.calls[0];
    expect(payload).toEqual(
      expect.objectContaining({
        eventType: 'finance.approved',
        actorUserId: 3,
        moduleKey: 'finance',
        recordId: 42,
      }),
    );
  });

  it("joins the caller's transaction when given one", async () => {
    const tx = { query: vi.fn() };
    await emit({ ...validEmit, tx });

    // The row must commit atomically with the business change, so a rolled-back
    // approval takes its notification down with it.
    expect(notificationModel.insertEvent.mock.calls[0][1]).toEqual({ tx });
  });

  it('falls back to the pool when no transaction is given', async () => {
    await emit(validEmit);
    // `{}` rather than `{ tx: null }` — passing null explicitly would defeat
    // the model's `tx = db` default.
    expect(notificationModel.insertEvent.mock.calls[0][1]).toEqual({});
  });

  it('folds the subject into the template data', async () => {
    await emit({
      ...validEmit,
      subject: { moduleKey: 'finance', recordId: 42, amount: 500 },
      data: { stage: 'dof' },
    });

    const [{ payload }] = notificationModel.insertEvent.mock.calls[0];
    expect(payload.data).toEqual(
      expect.objectContaining({ moduleKey: 'finance', recordId: 42, amount: 500, stage: 'dof' }),
    );
  });

  it('nudges the dispatcher after a successful write', async () => {
    await emit(validEmit);
    expect(scheduleDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not nudge when nothing was written', async () => {
    notificationModel.insertEvent.mockResolvedValue(null);
    await emit(validEmit);
    expect(scheduleDispatch).not.toHaveBeenCalled();
  });

  /* ---- the properties that protect the caller ---- */

  it('swallows a database failure instead of breaking the caller', async () => {
    // The scenario this guards: the migration has not been applied in an
    // environment, so every insert fails. Approvals must keep working.
    notificationModel.insertEvent.mockRejectedValue(
      new Error("Table 'notification_events' doesn't exist"),
    );

    await expect(emit(validEmit)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('rejects an unknown event type loudly but without throwing', async () => {
    await expect(emit({ ...validEmit, type: 'finance.typo' })).resolves.toBeNull();
    expect(notificationModel.insertEvent).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unknown type'));
  });

  it('skips an emit with no audience rather than writing a dead row', async () => {
    await expect(emit({ ...validEmit, audience: [] })).resolves.toBeNull();
    expect(notificationModel.insertEvent).not.toHaveBeenCalled();
  });

  it('survives being called with no arguments at all', async () => {
    await expect(emit()).resolves.toBeNull();
  });

  it('survives a malformed subject', async () => {
    await expect(emit({ ...validEmit, subject: null })).resolves.toBe(555);
  });

  it('returns null rather than throwing when a duplicate dedupe key is rejected', async () => {
    // The model turns ER_DUP_ENTRY into null: the thing was already recorded,
    // so doing nothing is the correct outcome, not an error.
    notificationModel.insertEvent.mockResolvedValue(null);

    await expect(emit({ ...validEmit, dedupeKey: 'finance:42:approved' })).resolves.toBeNull();
  });
});
