/**
 * The claim machinery, at the SQL level.
 *
 * Two things here are load-bearing and invisible from the dispatcher's side:
 * a reap counts as an attempt (so an event that strands every worker that
 * touches it cannot circle forever), and a delivery already marked 'sent' is
 * never overwritten (so "pushed once" survives a worker whose lease lapsed).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

import db from '../config/connection.js';
import notificationModel from '../modules/notification/notificationModel.js';

/** The SQL of every statement the call issued, whitespace collapsed. */
const statements = () =>
  db.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

beforeEach(() => {
  vi.clearAllMocks();
  db.query.mockResolvedValue([{ affectedRows: 0 }]);
});

describe('notificationModel.releaseStaleClaims', () => {
  it('counts a reap as an attempt so a poison event cannot circle forever', async () => {
    await notificationModel.releaseStaleClaims({ staleMinutes: 5, maxAttempts: 5 });

    // Every statement it issues advances the ladder; an event that kills its
    // worker before any clean failure path runs would otherwise never age.
    for (const sql of statements()) {
      expect(sql).toContain('attempts = attempts + 1');
    }
  });

  it('fails the events that have run out of attempts and releases the rest', async () => {
    db.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 2 }]);

    const result = await notificationModel.releaseStaleClaims({ staleMinutes: 5, maxAttempts: 5 });

    const [failing, releasing] = statements();
    expect(failing).toContain("SET status = 'failed'");
    expect(failing).toContain('attempts + 1 >= ?');
    expect(releasing).toContain("SET status = 'pending'");
    expect(result).toEqual({ failed: 1, released: 2 });
  });

  it('only ever touches rows whose lease has actually lapsed', async () => {
    await notificationModel.releaseStaleClaims({ staleMinutes: 5, maxAttempts: 5 });

    for (const sql of statements()) {
      expect(sql).toContain("status = 'processing'");
      expect(sql).toContain('locked_at < (NOW() - INTERVAL ? MINUTE)');
    }
  });

  it('never reaps with a threshold of zero, whatever it is handed', async () => {
    await notificationModel.releaseStaleClaims({ staleMinutes: 0, maxAttempts: 0 });

    // A zero would reap live claims the instant they were taken.
    for (const [, params] of db.query.mock.calls) {
      expect(params[0]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('notificationModel.markDelivery', () => {
  it('refuses to overwrite a delivery that already went out', async () => {
    await notificationModel.markDelivery(900, 'web_push', {
      status: 'failed',
      error: 'push service 503',
    });

    // Without this a worker whose lease lapsed could put a successful push
    // back into the pending set, and the recipient would be pushed again.
    expect(statements()[0]).toContain("status <> 'sent'");
  });

  it('stamps sent_at only on a send', async () => {
    await notificationModel.markDelivery(900, 'in_app', { status: 'sent' });

    const [sql, params] = db.query.mock.calls[0];
    expect(String(sql).replace(/\s+/g, ' ')).toContain("sent_at = IF(? = 'sent', NOW(), sent_at)");
    expect(params).toContain('sent');
  });
});

describe('notificationModel.renewClaim', () => {
  it('renews only the lease it still holds', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(notificationModel.renewClaim(100, { lockedBy: 'worker:abc' })).resolves.toBe(true);

    const [sql, params] = db.query.mock.calls[0];
    const flat = String(sql).replace(/\s+/g, ' ');
    expect(flat).toContain("status = 'processing'");
    expect(flat).toContain('locked_by = ?');
    expect(params).toEqual([100, 'worker:abc']);
  });

  it('reports the lease gone when the fenced update matches nothing', async () => {
    db.query.mockResolvedValue([{ affectedRows: 0 }]);

    await expect(notificationModel.renewClaim(100, { lockedBy: 'worker:abc' })).resolves.toBe(
      false,
    );
  });

  it('does not issue a renewal without an event and a token', async () => {
    await expect(notificationModel.renewClaim(0, { lockedBy: 'worker:abc' })).resolves.toBe(false);
    await expect(notificationModel.renewClaim(100, {})).resolves.toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });
});
