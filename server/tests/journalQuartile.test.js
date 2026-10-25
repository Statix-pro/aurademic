import { beforeEach, describe, expect, it, vi } from 'vitest';

import db from '../config/connection.js';
import journalModel from '../modules/journal/journalModel.js';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

/**
 * A journal article's quartile is the journal's official SCImago one for the publication's
 * year whenever the Journal Import has loaded it — the form shows it locked, and the server
 * does not take the form's word for it, the same way the level comes from the registry. Only
 * a journal with no official quartile for that year keeps what the faculty member chose.
 */

const createFakeConnection = (responder) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => responder(String(sql).replace(/\s+/g, ' '), params)),
});

const OFFICIAL_QUARTILE_SQL = "metric = 'quartile' AND source = 'scimago'";

const insertedJournal = (connection) =>
  connection.query.mock.calls.find(([sql]) =>
    String(sql).startsWith('INSERT INTO journals SET'),
  )[1][0];

const baseJournal = {
  title: 'A paper',
  type: 'Article',
  journal_name: '3 Biotech',
  journal_options_id: 7,
  category: 'International',
  acknowledgement: {},
  author_affiliation: [],
};

/** Answers the create() queries; `official` is the quartile the metrics table holds, if any. */
const createResponder =
  (official, seen = []) =>
  (sql, params) => {
    seen.push({ sql, params });
    if (sql.includes('SELECT id, journal_name, is_placeholder FROM journal_options'))
      return [[{ id: 7, journal_name: '3 Biotech', is_placeholder: 0 }]];
    if (sql.includes('SELECT category FROM journal_options'))
      return [[{ category: 'International' }]];
    if (sql.includes(OFFICIAL_QUARTILE_SQL)) return [official ? [{ value_text: official }] : []];
    if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 42 }];
    if (sql.includes('FROM journals j')) return [[{ id: 42 }]];
    return [[]];
  };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quartile on create', () => {
  it('stores the official quartile, not the one the form sent', async () => {
    const connection = createFakeConnection(createResponder('Q1'));
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, quartile: 'Q3', year: '2026' });

    expect(insertedJournal(connection).quartile).toBe('Q1');
  });

  it("looks up the ranking for the paper's own year or the latest before it", async () => {
    const seen = [];
    const connection = createFakeConnection(createResponder('Q2', seen));
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, quartile: 'Q2', year: '2026' });

    const lookup = seen.find((call) => call.sql.includes(OFFICIAL_QUARTILE_SQL));
    expect(lookup.sql).toContain('metric_year <= ?');
    expect(lookup.sql).toContain('ORDER BY metric_year DESC LIMIT 1');
    expect(lookup.params).toEqual([7, 2026]);
  });

  it('keeps the submitted quartile when the journal has none for that year', async () => {
    const connection = createFakeConnection(createResponder(null));
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, quartile: 'Q3', year: '2019' });

    expect(insertedJournal(connection).quartile).toBe('Q3');
  });

  it('never looks one up for a conference paper or book, which have no journal', async () => {
    const seen = [];
    const connection = createFakeConnection((sql, params) => {
      seen.push({ sql, params });
      if (sql.includes('FROM journal_options WHERE journal_name = ? AND is_placeholder = 1'))
        return [[{ id: 12 }]];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 43 }];
      if (sql.includes('FROM journals j')) return [[{ id: 43 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({
      ...baseJournal,
      type: 'Conference paper',
      journal_options_id: null,
      journal_name: 'ICEAI 2026',
      quartile: 'NA',
    });

    expect(seen.some((call) => call.sql.includes(OFFICIAL_QUARTILE_SQL))).toBe(false);
    expect(insertedJournal(connection).quartile).toBe('NA');
  });
});

describe('quartile on edit', () => {
  const updateResponder = (official) => (sql) => {
    if (sql.includes('FROM journals j LEFT JOIN journal_options'))
      return [
        [{ journal_options_id: 7, type: 'Article', year: '2025', journal_name: '3 Biotech' }],
      ];
    if (sql.includes('SELECT category FROM journal_options'))
      return [[{ category: 'International' }]];
    if (sql.includes(OFFICIAL_QUARTILE_SQL)) return [official ? [{ value_text: official }] : []];
    return [{ affectedRows: 1 }];
  };

  const savedUpdate = (connection) =>
    connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE journals SET'),
    )[1][0];

  it('replaces an edited quartile with the official one', async () => {
    const connection = createFakeConnection(updateResponder('Q1'));
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(
      42,
      { quartile: 'Q4' },
      { journal_name: '3 Biotech' },
    );

    expect(savedUpdate(connection).quartile).toBe('Q1');
  });

  it('leaves the quartile alone when there is no official one', async () => {
    const connection = createFakeConnection(updateResponder(null));
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(
      42,
      { quartile: 'Q4' },
      { journal_name: '3 Biotech' },
    );

    expect(savedUpdate(connection).quartile).toBe('Q4');
  });
});

describe('journal search', () => {
  const lastQuery = () => {
    const [sql, params] = db.query.mock.calls.at(-1);
    return { sql: String(sql).replace(/\s+/g, ' '), params };
  };

  it('finds a journal by its ISSN however it is typed', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('2190-572x');

    const { sql, params } = lastQuery();
    expect(sql).toContain("REPLACE(jo.print_issn, '-', '') = ?");
    expect(params).toEqual(['%2190-572x%', '2190572X', '2190572X']);
  });

  it('searches names only when the text is not an ISSN', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('Biotech');

    expect(lastQuery().params).toEqual(['%Biotech%']);
  });

  it('returns the official quartiles and Scopus status for the form', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('');

    const { sql } = lastQuery();
    expect(sql).toContain('AS official_quartiles');
    expect(sql).toContain('jo.scopus_discontinued');
  });
});
