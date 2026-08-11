import { beforeEach, describe, expect, it, vi } from 'vitest';

import db from '../config/connection.js';
import {
  carryForwardApprovedBudgetRowFacts,
  getFinanceClaimTotalsByFinanceIds,
} from '../modules/finance/financeModel.js';

vi.mock('../config/connection.js', () => {
  return {
    default: {
      getConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    },
  };
});

/**
 * A budget row as the edit form resubmits it: the approval fields are absent because the
 * form never receives them, which is exactly what used to wipe them.
 */
const formRow = (overrides = {}) => ({
  budget_head: 'Events',
  sub_head: 'Refreshments',
  amount: 948,
  approved_amount: null,
  remaining_amount_snapshot: null,
  is_topup: 0,
  ...overrides,
});

/** The same row as stored after Principal approval committed it. */
const approvedRow = (overrides = {}) => ({
  budget_head: 'Events',
  sub_head: 'Refreshments',
  amount: 948,
  approved_amount: '948.00',
  remaining_amount_snapshot: '265474.00',
  is_topup: 0,
  ...overrides,
});

describe('carryForwardApprovedBudgetRowFacts', () => {
  it('preserves the approval snapshot when an edit resubmits unchanged rows', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts([formRow()], [approvedRow()]);

    expect(merged.approved_amount).toBe(948);
    expect(merged.remaining_amount_snapshot).toBe(265474);
  });

  it('keeps every other field from the incoming row', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts(
      [formRow({ budget_line_id: 2833, sort_order: 0 })],
      [approvedRow({ budget_line_id: null })],
    );

    expect(merged.budget_line_id).toBe(2833);
    expect(merged.sort_order).toBe(0);
  });

  it('leaves a row whose amount changed unmatched, so a stale snapshot is not reused', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts(
      [formRow({ amount: 1200 })],
      [approvedRow()],
    );

    expect(merged.approved_amount).toBeNull();
    expect(merged.remaining_amount_snapshot).toBeNull();
  });

  it('consumes each previous row once so repeated heads keep their own snapshot', () => {
    const previousRows = [
      approvedRow({ amount: 300, approved_amount: '300.00', remaining_amount_snapshot: '710.00' }),
      approvedRow({ amount: 300, approved_amount: '300.00', remaining_amount_snapshot: '410.00' }),
    ];

    const merged = carryForwardApprovedBudgetRowFacts(
      [formRow({ amount: 300 }), formRow({ amount: 300 }), formRow({ amount: 300 })],
      previousRows,
    );

    expect(merged.map((row) => row.remaining_amount_snapshot)).toEqual([710, 410, null]);
  });

  it('lets incoming values win, so the top-up path passes DB rows through untouched', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts(
      [formRow({ approved_amount: 948, remaining_amount_snapshot: 500 })],
      [approvedRow()],
    );

    expect(merged.remaining_amount_snapshot).toBe(500);
  });

  it('restores the top-up flag the edit form drops', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts(
      [formRow()],
      [approvedRow({ is_topup: 1 })],
    );

    expect(merged.is_topup).toBe(1);
  });

  it('does not invent an approval snapshot for a brand new row', () => {
    const merged = carryForwardApprovedBudgetRowFacts([formRow({ amount: 5000 })], []);

    expect(merged[0].approved_amount).toBeNull();
    expect(merged[0].remaining_amount_snapshot).toBeNull();
    expect(merged[0].is_topup).toBe(0);
  });

  // Two budget lines can legitimately share head, sub-head AND amount. Pairing on text alone
  // handed a row whichever snapshot came first, so the two could swap on reorder.
  it('pairs rows by budget line id, so identical-looking rows keep their own snapshot', () => {
    const previousRows = [
      approvedRow({ budget_line_id: 11, remaining_amount_snapshot: '710.00' }),
      approvedRow({ budget_line_id: 22, remaining_amount_snapshot: '410.00' }),
    ];

    const merged = carryForwardApprovedBudgetRowFacts(
      [formRow({ budget_line_id: 22 }), formRow({ budget_line_id: 11 })],
      previousRows,
    );

    expect(merged.map((row) => row.remaining_amount_snapshot)).toEqual([410, 710]);
  });

  it('does not hand a row the snapshot of a different budget line', () => {
    const [merged] = carryForwardApprovedBudgetRowFacts(
      [formRow({ budget_line_id: 99 })],
      [approvedRow({ budget_line_id: 11 })],
    );

    expect(merged.approved_amount).toBeNull();
    expect(merged.remaining_amount_snapshot).toBeNull();
  });

  it('still text-matches when either side carries no budget line id', () => {
    const [withoutIncomingId] = carryForwardApprovedBudgetRowFacts(
      [formRow()],
      [approvedRow({ budget_line_id: 11 })],
    );
    const [withoutPreviousId] = carryForwardApprovedBudgetRowFacts(
      [formRow({ budget_line_id: 11 })],
      [approvedRow({ budget_line_id: null })],
    );

    expect(withoutIncomingId.remaining_amount_snapshot).toBe(265474);
    expect(withoutPreviousId.remaining_amount_snapshot).toBe(265474);
  });
});

describe('getFinanceClaimTotalsByFinanceIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds expenditure to the advance while no settlement exists', async () => {
    db.query.mockResolvedValue([
      [
        {
          finance_id: 170,
          advance_amount: '475011.00',
          expenditure_amount: '1748.00',
          settlement_amount: '0.00',
          request_count: 2,
        },
      ],
    ]);

    const totals = await getFinanceClaimTotalsByFinanceIds([170]);

    expect(totals.get(170)).toMatchObject({
      claimed_amount: 476759,
      expenditure_request_count: 2,
    });
  });

  it('lets a settlement supersede the advance it settles instead of double counting', async () => {
    db.query.mockResolvedValue([
      [
        {
          finance_id: 262,
          advance_amount: '398055.00',
          expenditure_amount: '0.00',
          settlement_amount: '398055.00',
          request_count: 2,
        },
      ],
    ]);

    const totals = await getFinanceClaimTotalsByFinanceIds([262]);

    expect(totals.get(262).claimed_amount).toBe(398055);
  });

  // Two ₹1,00,000 advances, the first settled at ₹1,20,000. The overspend and the advance still
  // outstanding both count, so the card reports ₹2,20,000 rather than losing one of them.
  it('counts an over-settlement and a still-outstanding advance on the same card', async () => {
    db.query.mockResolvedValue([
      [
        {
          finance_id: 301,
          advance_amount: '200000.00',
          expenditure_amount: '0.00',
          settlement_amount: '120000.00',
          settled_advance_amount: '100000.00',
          request_count: 3,
        },
      ],
    ]);

    const totals = await getFinanceClaimTotalsByFinanceIds([301]);

    expect(totals.get(301).claimed_amount).toBe(220000);
  });

  it('reports only what was spent when an advance is settled for less', async () => {
    db.query.mockResolvedValue([
      [
        {
          finance_id: 302,
          advance_amount: '100000.00',
          expenditure_amount: '0.00',
          settlement_amount: '80000.00',
          settled_advance_amount: '100000.00',
          request_count: 2,
        },
      ],
    ]);

    const totals = await getFinanceClaimTotalsByFinanceIds([302]);

    expect(totals.get(302).claimed_amount).toBe(80000);
  });

  // Real shape from the production dump: a settlement row naming its target advance before any
  // spend is recorded. The advance is still out, so the card must still report it as claimed.
  it('keeps an advance claimed while its settlement records no spend', async () => {
    db.query.mockResolvedValue([
      [
        {
          finance_id: 303,
          advance_amount: '17700.00',
          expenditure_amount: '0.00',
          settlement_amount: '0.00',
          settled_advance_amount: '0.00',
          request_count: 2,
        },
      ],
    ]);

    const totals = await getFinanceClaimTotalsByFinanceIds([303]);

    expect(totals.get(303).claimed_amount).toBe(17700);
  });

  it('asks the database how much advance the settlements discharged', async () => {
    db.query.mockResolvedValue([[]]);

    await getFinanceClaimTotalsByFinanceIds([170]);

    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('AS settled_advance_amount');
    expect(sql.replace(/\s+/g, ' ')).toContain('SUM(settled_sr.advance_amount)');
  });

  it('skips the query and returns an empty map when there are no finance ids', async () => {
    const totals = await getFinanceClaimTotalsByFinanceIds([]);

    expect(totals.size).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('excludes deleted requests and groups per finance request', async () => {
    db.query.mockResolvedValue([[]]);

    await getFinanceClaimTotalsByFinanceIds([170, 262, 170, null]);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain("'deleted'");
    expect(sql).toContain('GROUP BY er.finance_request_id');
    // Deduplicated and filtered, one placeholder per id.
    expect(params).toEqual([170, 262]);
    expect((sql.match(/\?/g) || []).length).toBe(2);
  });

  // A rejected request is not a claim. Counting it inflated claimed_amount permanently and
  // could flip an approved card's label to "Claimed" for money that was never released.
  it('excludes rejected and archived requests, but keeps pending ones as live claims', async () => {
    db.query.mockResolvedValue([[]]);

    await getFinanceClaimTotalsByFinanceIds([170]);

    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain("NOT IN ('rejected', 'deleted', 'archived')");
    expect(sql).not.toContain("'pending')) IN");
  });

  it('degrades to an empty map when the expenditure table is absent', async () => {
    const missingTable = new Error('no such table');
    missingTable.code = 'ER_NO_SUCH_TABLE';
    db.query.mockRejectedValue(missingTable);

    const totals = await getFinanceClaimTotalsByFinanceIds([170]);

    expect(totals.size).toBe(0);
  });
});
