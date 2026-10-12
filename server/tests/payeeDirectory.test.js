import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { listPayeeDirectory } = await import('../modules/expenditure/expenditureModel.js');

/**
 * The payee management screen used to pull the entire payee master in one call
 * and count it in the browser, which silently capped at the API's row limit —
 * the tiles froze at 100 and newly requested payees never appeared. These cases
 * pin the paged contract that replaced it: the page window is bounded, but the
 * totals it reports are not.
 */
const countRow = {
  all_count: 137,
  pending_count: 4,
  approved_count: 130,
  rejected_count: 3,
};

// Unfiltered reads take two queries (counts, then the page). A filtered read
// takes three: the extra one re-counts pending across the whole master, because
// the filtered pending count is the tile's figure, not the nav badge's.
const mockQueries = (rows = [], { pendingTotal = null } = {}) => {
  db.execute.mockReset();
  db.execute.mockResolvedValueOnce([[countRow]]);
  if (pendingTotal !== null) {
    db.execute.mockResolvedValueOnce([[{ pending_count: pendingTotal }]]);
  }
  db.execute.mockResolvedValueOnce([rows]);
};

const lastCall = (index) => db.execute.mock.calls[index];
const rowsCall = () => db.execute.mock.calls[db.execute.mock.calls.length - 1];

describe('listPayeeDirectory', () => {
  beforeEach(() => {
    db.execute.mockReset();
  });

  it('reports totals for the whole filtered set, not just the returned page', async () => {
    mockQueries([{ id: 7, payee_name: 'Aarthi R', approval_status: 'pending' }]);

    const result = await listPayeeDirectory({ limit: 20, offset: 0 });

    expect(result.total).toBe(137);
    expect(result.counts).toEqual({ all: 137, pending: 4, approved: 130, rejected: 3 });
    expect(result.rows).toHaveLength(1);
  });

  it('translates the page window into LIMIT/OFFSET', async () => {
    mockQueries([]);

    await listPayeeDirectory({ limit: 20, offset: 60 });

    const [rowsSql] = rowsCall();
    expect(rowsSql).toContain('LIMIT 20 OFFSET 60');
  });

  it('clamps a hostile page size instead of letting a client ask for everything', async () => {
    mockQueries([]);

    const result = await listPayeeDirectory({ limit: 100000, offset: -5 });

    expect(result.limit).toBe(100);
    expect(result.offset).toBe(0);
    expect(rowsCall()[0]).toContain('LIMIT 100 OFFSET 0');
  });

  it('narrows rows by status while leaving every tile at its full count', async () => {
    mockQueries([{ id: 7, payee_name: 'Aarthi R', approval_status: 'pending' }]);

    const result = await listPayeeDirectory({ status: 'pending' });

    // Rows are filtered...
    expect(rowsCall()[1]).toContain('pending');
    // ...the count query is not, so "All 137 / Approved 130" stay readable.
    expect(lastCall(0)[1]).not.toContain('pending');
    expect(result.counts.all).toBe(137);
    // Paging follows the filtered status, not the table.
    expect(result.total).toBe(4);
  });

  it('ignores an unknown status rather than filtering on it', async () => {
    mockQueries([]);

    await listPayeeDirectory({ status: 'archived' });

    expect(rowsCall()[1]).not.toContain('archived');
  });

  it('applies search terms and the beneficiary filter as bound parameters', async () => {
    mockQueries([], { pendingTotal: 4 });

    await listPayeeDirectory({ search: 'sharvi icici', beneficiaryType: 'organization' });

    const [, countParams] = lastCall(0);
    expect(countParams).toEqual(['organization', '%sharvi%', '%icici%']);
  });

  it('matches LIKE metacharacters literally instead of as wildcards', async () => {
    mockQueries([], { pendingTotal: 4 });

    await listPayeeDirectory({ search: '50%_a\\b' });

    const [countSql, countParams] = lastCall(0);
    expect(countSql).toContain("ESCAPE '\\\\'");
    expect(countParams).toEqual(['%50\\%\\_a\\\\b%']);
  });

  it('reports the unfiltered pending total so the nav badge ignores the search', async () => {
    mockQueries([{ id: 7 }], { pendingTotal: 9 });

    const result = await listPayeeDirectory({ search: 'sharvi' });

    // The tile still reflects the search...
    expect(result.counts.pending).toBe(4);
    // ...while the badge keeps counting every payee awaiting approval.
    expect(result.pendingTotal).toBe(9);
  });

  it('reuses the pending tile as the badge total when nothing is filtered', async () => {
    mockQueries([{ id: 7 }]);

    const result = await listPayeeDirectory({});

    expect(result.pendingTotal).toBe(4);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it('skips the row query entirely when nothing matches', async () => {
    db.execute
      .mockResolvedValueOnce([
        [{ all_count: 0, pending_count: 0, approved_count: 0, rejected_count: 0 }],
      ])
      .mockResolvedValueOnce([[{ pending_count: 4 }]]);

    const result = await listPayeeDirectory({ search: 'nobody' });

    // Counts plus the badge total — never a row query for a page that is empty.
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ rows: [], total: 0, pendingTotal: 4 });
  });

  it('orders pending payees first so a fresh request is never buried', async () => {
    mockQueries([]);

    await listPayeeDirectory({});

    const [rowsSql] = rowsCall();
    const orderBy = rowsSql.slice(rowsSql.indexOf('ORDER BY'));
    expect(orderBy).toContain("'pending' THEN 0 ELSE 1 END");
    // A stable tiebreak keeps rows from shifting between pages.
    expect(orderBy).toContain('ep.id ASC');
  });

  it('sorts by the rendered name, not the raw payee_name column', async () => {
    mockQueries([]);

    await listPayeeDirectory({});

    const [rowsSql] = rowsCall();
    const orderBy = rowsSql.slice(rowsSql.indexOf('ORDER BY'));
    // Legacy rows keep the beneficiary org in payee_name and render
    // account_name, so both columns must take part in the sort.
    expect(orderBy).toContain('ep.account_name');
    expect(orderBy).toContain("IN ('KSRCT', 'KSREI', 'External')");
  });
});
