import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const { getSettlementAdvanceTotal, allocateSettlementAdvancesForTest } =
  await import('../modules/expenditure/expenditureModel.js');

/**
 * These cases are production request #147 on finance card 170: an advance of ₹4,75,011 booked
 * across FOUR budget lines of Equipment / Lab Equipment (₹2,00,000 + ₹1,25,000 + ₹1,00,000 +
 * ₹50,011). Settling it from a single form row carrying line 2859 made the server see only
 * ₹50,011 and reject the settlement — "adjustment amount is ₹4,25,000, payee total is ₹0".
 * The form had shown the group's full ₹4,75,011, because it looks the advance up per head/sub.
 */
const ADVANCE_BY_LINE = { 2858: 125000, 2859: 50011, 2860: 200000, 2861: 100000 };
const GROUP_ADVANCE = 475011;

const settlementRow = (budgetLineId, settlement) => ({
  budgetHead: 'Equipment',
  subHead: 'Lab Equipment',
  budgetLineId,
  settlement,
});

const makeConn = ({ groupAdvance = GROUP_ADVANCE, advanceByLine = ADVANCE_BY_LINE } = {}) => {
  const lookups = [];
  return {
    lookups,
    async execute(sql, params = []) {
      if (sql.includes('SHOW COLUMNS')) {
        return [[{ Field: 'id' }, { Field: 'advance_total_amount' }, { Field: 'total_amount' }]];
      }
      if (!sql.includes('expenditure_advance_rows')) return [[]];

      const lineScoped = sql.includes('ar.budget_line_id = ?');
      const budgetLineId = lineScoped
        ? params.find((param) => Object.hasOwn(advanceByLine, param))
        : null;
      lookups.push({ lineScoped, budgetLineId });
      return [
        [
          {
            total_advanced: lineScoped ? (advanceByLine[budgetLineId] ?? 0) : groupAdvance,
            cnt: 1,
          },
        ],
      ];
    },
    async query() {
      // Catalog lookups: no match, so head/sub matching falls back to snapshot text.
      return [[]];
    },
  };
};

const context = { userId: 7, financeRequestId: 170, dashboardRowId: '170-blank-1' };

describe('settlement advance matching', () => {
  it('counts the whole head/sub advance when one row settles a multi-line advance', async () => {
    const conn = makeConn();

    const total = await getSettlementAdvanceTotal(conn, [settlementRow(2859, 475011)], context);

    expect(total).toBe(GROUP_ADVANCE);
    expect(conn.lookups.some((lookup) => !lookup.lineScoped)).toBe(true);
  });

  it('counts the head/sub advance once however many rows carry it', async () => {
    const conn = makeConn();

    const total = await getSettlementAdvanceTotal(
      conn,
      [2858, 2859, 2860, 2861].map((lineId) => settlementRow(lineId, 100000)),
      context,
    );

    expect(total).toBe(GROUP_ADVANCE);
    expect(conn.lookups.filter((lookup) => !lookup.lineScoped)).toHaveLength(1);
  });

  it('keeps the per-budget-line split when a row exists for every line', async () => {
    const conn = makeConn();

    const allocations = await allocateSettlementAdvancesForTest(
      conn,
      [2858, 2859, 2860, 2861].map((lineId) => settlementRow(lineId, 100000)),
      context,
    );

    expect(allocations).toEqual([125000, 50011, 200000, 100000]);
  });

  it('parks the advance of unrepresented lines on the settling row', async () => {
    const conn = makeConn();

    const allocations = await allocateSettlementAdvancesForTest(
      conn,
      [settlementRow(2859, 475011)],
      context,
    );

    expect(allocations).toEqual([GROUP_ADVANCE]);
  });

  // The claim accounting reads advance_amount only from rows with settlement_amount > 0
  // (buildSettledAdvanceExpr), so a zero-spend row must not be handed the remainder.
  it('never parks the remainder on a row that records no spend', async () => {
    const conn = makeConn();

    const allocations = await allocateSettlementAdvancesForTest(
      conn,
      [settlementRow(2859, 0), settlementRow(2858, 475011)],
      context,
    );

    expect(allocations[0]).toBe(50011);
    expect(allocations[1]).toBe(GROUP_ADVANCE - 50011);
    expect(allocations[0] + allocations[1]).toBe(GROUP_ADVANCE);
  });

  it('allocates a budget line once when two rows share it', async () => {
    const conn = makeConn();

    const allocations = await allocateSettlementAdvancesForTest(
      conn,
      [settlementRow(2859, 25000), settlementRow(2859, 25011)],
      context,
    );

    expect(allocations[1]).toBe(0);
    expect(allocations[0]).toBe(GROUP_ADVANCE);
  });

  it('never allocates more than the group holds', async () => {
    // A legacy advance with no budget_line_id matches every line's lookup by head/sub text.
    const conn = makeConn({ groupAdvance: 200000, advanceByLine: { 2858: 200000, 2859: 200000 } });

    const allocations = await allocateSettlementAdvancesForTest(
      conn,
      [settlementRow(2858, 100000), settlementRow(2859, 100000)],
      context,
    );

    expect(allocations).toEqual([200000, 0]);
  });

  it('looks up each distinct head/sub separately', async () => {
    const conn = makeConn({ groupAdvance: 100000, advanceByLine: {} });

    const total = await getSettlementAdvanceTotal(
      conn,
      [
        { budgetHead: 'Equipment', subHead: 'Lab Equipment', settlement: 60000 },
        { budgetHead: 'Consumables', subHead: 'Chemicals', settlement: 40000 },
      ],
      context,
    );

    expect(total).toBe(200000);
    expect(conn.lookups.filter((lookup) => !lookup.lineScoped)).toHaveLength(2);
  });
});
