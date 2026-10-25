/**
 * Approving a journal request writes the journal's National/International level. A level the
 * request names is an admin's decision that no journal-list import may override; the
 * 'National' it falls back to when the request names none is nobody's choice, and locking it
 * kept an International journal National through every later import.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { query: vi.fn(), execute: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: adminModel } = await import('../modules/admindashboard/adminModel.js');

const collapse = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const approve = async (request, { existingOptionId = null } = {}) => {
  db.query.mockImplementation(async (sql) => {
    const text = collapse(sql);
    if (text.startsWith('SELECT * FROM journal_requests')) {
      return [[{ id: 3, journal_name: 'Journal of Natural Fibers', ...request }]];
    }
    if (text.startsWith('SELECT id FROM journal_options')) {
      return [existingOptionId ? [{ id: existingOptionId }] : []];
    }
    if (text.startsWith('INSERT INTO journal_options')) return [{ insertId: 40 }];
    return [{ affectedRows: 1 }];
  });
  await adminModel.approveJournalRequest(3, '');
  return db.query.mock.calls.map(([sql, params]) => ({ sql: collapse(sql), params }));
};

beforeEach(() => {
  db.query.mockReset();
});

describe('journal request approval and the journal level', () => {
  it("marks a level the request names as the admin's", async () => {
    const calls = await approve({ category: 'International' }, { existingOptionId: 40 });
    const update = calls.find((call) => call.sql.startsWith('UPDATE journal_options'));
    expect(update.params[0]).toMatchObject({ category: 'International', level_source: 'admin' });
  });

  it('leaves the fallback level open to imports on an existing journal', async () => {
    const calls = await approve({ category: '' }, { existingOptionId: 40 });
    const update = calls.find((call) => call.sql.startsWith('UPDATE journal_options'));
    expect(update.params[0]).toMatchObject({ category: 'National' });
    expect(update.params[0]).not.toHaveProperty('level_source');
  });

  it('records no level owner on a new journal whose request named no level', async () => {
    const calls = await approve({ category: null });
    const insert = calls.find((call) => call.sql.startsWith('INSERT INTO journal_options'));
    expect(insert.params.slice(-2)).toEqual(['National', null]);
  });
});
