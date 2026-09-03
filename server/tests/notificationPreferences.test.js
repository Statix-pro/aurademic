/**
 * `notification_preferences` is uniquely keyed on
 * (user_id, event_type, category, channel), but every reader looks an exact row
 * up by (user_id, event_type, channel) alone — `category` is there to scope a
 * wildcard '*' row to one category and does nothing else.
 *
 * That mismatch is a trap. Writing the catalog's current category onto an exact
 * row makes the unique key drift the moment a type is recategorised: the upsert
 * misses the row the user already has, a second row appears for the same
 * switch, and which of the two the resolver honours is whichever the query
 * happens to return first. A saved mute quietly stops working.
 *
 * These tests pin the rule that keeps the unique key and the lookup key the
 * same thing: exact rows carry no category, wildcard rows carry theirs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

import db from '../config/connection.js';
import notificationModel from '../modules/notification/notificationModel.js';

/** The VALUES tuples handed to the INSERT, in column order. */
const insertedRows = () => db.query.mock.calls[0][1][0];

beforeEach(() => {
  vi.clearAllMocks();
  db.query.mockResolvedValue([{ affectedRows: 1 }]);
});

describe('notificationModel.upsertPreferences', () => {
  it('stores an exact row with no category, whatever the caller passed', async () => {
    await notificationModel.upsertPreferences(7, [
      { eventType: 'finance.approved', category: 'finance', channel: 'in_app', isEnabled: false },
    ]);

    expect(insertedRows()).toEqual([[7, 'finance.approved', '', 'in_app', 0]]);
  });

  it('writes the same row for the same switch after the type is recategorised', async () => {
    // The regression this exists for: two saves of one switch, the catalog
    // having moved the type from 'finance' to 'approvals' in between. The rows
    // must be identical, so the second save updates the first rather than
    // becoming a rival row the resolver may or may not read.
    await notificationModel.upsertPreferences(7, [
      { eventType: 'finance.approved', category: 'finance', channel: 'in_app', isEnabled: false },
    ]);
    const before = insertedRows();

    vi.clearAllMocks();
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await notificationModel.upsertPreferences(7, [
      { eventType: 'finance.approved', category: 'approvals', channel: 'in_app', isEnabled: false },
    ]);

    expect(insertedRows()).toEqual(before);
  });

  it('keeps the category on a wildcard row, which is what scopes it', async () => {
    await notificationModel.upsertPreferences(7, [
      { eventType: '*', category: 'finance', channel: 'web_push', isEnabled: true },
    ]);

    expect(insertedRows()).toEqual([[7, '*', 'finance', 'web_push', 1]]);
  });

  it('defaults a wildcard row with no category to general', async () => {
    await notificationModel.upsertPreferences(7, [
      { eventType: '*', channel: 'web_push', isEnabled: true },
    ]);

    expect(insertedRows()).toEqual([[7, '*', 'general', 'web_push', 1]]);
  });

  it('writes nothing for an unusable user id or an empty list', async () => {
    await expect(notificationModel.upsertPreferences(0, [{ eventType: 'x' }])).resolves.toBe(0);
    await expect(notificationModel.upsertPreferences(7, [])).resolves.toBe(0);

    expect(db.query).not.toHaveBeenCalled();
  });
});
