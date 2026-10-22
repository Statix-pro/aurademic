import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const {
  assertUnplannedWithinFinanceUnplannedBudget,
  getApprovedBudgets,
  getFinanceUnplannedBudgetState,
} = await import('../modules/expenditure/expenditureModel.js');

/**
 * Finance request #299: ₹16,000 planned (Faculty Empowerment / Accommodation) plus ₹36,000
 * approved as Unplanned Expenditure. The expenditure form capped unplanned spend at the planned
 * line's balance, so claiming ₹32,000 of the approved ₹36,000 was refused with
 * "cannot exceed Head of Accounts balance ₹5,000" — and the server summed planned and unplanned
 * against the same ₹16,000 line. Unplanned money is its own approved allowance.
 */
const makeConn = ({ enabled = 1, approved = 36000, used = 0, legacyUsed = 0 } = {}) => {
  const executed = [];
  return {
    executed,
    async query() {
      // INFORMATION_SCHEMA column probe: the unplanned columns exist.
      return [[{ count: 1 }]];
    },
    async execute(sql, params = []) {
      executed.push({ sql, params });
      if (sql.includes('FROM finance_requests')) {
        return [[{ unplanned_budget_enabled: enabled, unplanned_budget_amount: approved }]];
      }
      // LEGACY claims (a single amount on expenditure_requests) are summed separately.
      if (sql.includes('used_amount') && sql.includes('unplanned_budget_enabled = 1')) {
        return [[{ used_amount: legacyUsed }]];
      }
      if (sql.includes('used_amount')) {
        return [[{ used_amount: used }]];
      }
      return [[]];
    },
  };
};

const unplanned = (amount) => ({ enabled: true, amount, rows: [] });

describe('unplanned expenditure allowance', () => {
  it('lets a claim use the unplanned amount finance approved', async () => {
    const conn = makeConn();

    await expect(
      assertUnplannedWithinFinanceUnplannedBudget(conn, {
        financeRequestId: 299,
        normalizedUnplanned: unplanned(32000),
      }),
    ).resolves.toBeUndefined();
  });

  it('refuses a claim beyond what earlier requests left of the allowance', async () => {
    const conn = makeConn({ used: 10000 });

    await expect(
      assertUnplannedWithinFinanceUnplannedBudget(conn, {
        financeRequestId: 299,
        normalizedUnplanned: unplanned(32000),
      }),
    ).rejects.toThrow('exceeds the unplanned balance ₹ 26,000.00');
  });

  it('refuses unplanned spend when finance approved none', async () => {
    const conn = makeConn({ enabled: 0 });

    await expect(
      assertUnplannedWithinFinanceUnplannedBudget(conn, {
        financeRequestId: 299,
        normalizedUnplanned: unplanned(100),
      }),
    ).rejects.toThrow('Unplanned Expenditure was not approved on this finance request.');
  });

  it('leaves the request being edited out of the used amount and locks the finance row', async () => {
    const conn = makeConn({ used: 4000 });

    const state = await getFinanceUnplannedBudgetState(conn, {
      financeRequestId: 299,
      excludeExpenditureId: 812,
      forUpdate: true,
    });

    expect(state).toEqual({
      enabled: true,
      approvedAmount: 36000,
      usedAmount: 4000,
      remainingAmount: 32000,
    });
    const financeLookup = conn.executed.find(({ sql }) => sql.includes('FROM finance_requests'));
    expect(financeLookup.sql).toContain('FOR UPDATE');
    const usageLookups = conn.executed.filter(({ sql }) => sql.includes('used_amount'));
    expect(usageLookups).toHaveLength(2);
    for (const lookup of usageLookups) expect(lookup.params).toEqual([299, 812, 812]);
  });

  it('adds legacy single-amount claims to the rows-based ones', async () => {
    const conn = makeConn({ used: 4000, legacyUsed: 6000 });

    const state = await getFinanceUnplannedBudgetState(conn, { financeRequestId: 299 });

    expect(state.usedAmount).toBe(10000);
    expect(state.remainingAmount).toBe(26000);
  });

  /**
   * Greptile on PR #85: under REPEATABLE READ, createExpenditureRequest's earlier plain reads
   * fix its snapshot, so a claim another request committed while this one waited on the
   * finance row lock was invisible to a plain SUM — two ₹600 claims both passed against
   * ₹1,000 (reproduced on MySQL). Under the lock the usage must be locking reads, which see
   * the latest committed rows; the legacy query's NOT EXISTS needs its own lock clause, since
   * an outer one does not reach a subquery.
   */
  it('reads usage with locking reads when checking under the finance row lock', async () => {
    const conn = makeConn();

    await assertUnplannedWithinFinanceUnplannedBudget(conn, {
      financeRequestId: 299,
      normalizedUnplanned: unplanned(100),
    });

    const usageLookups = conn.executed.filter(({ sql }) => sql.includes('used_amount'));
    expect(usageLookups).toHaveLength(2);
    for (const { sql } of usageLookups) expect(sql.trimEnd()).toMatch(/FOR SHARE$/);
    const legacy = usageLookups.find(({ sql }) => sql.includes('NOT EXISTS'));
    expect(legacy.sql.match(/FOR SHARE/g)).toHaveLength(2);
  });

  it('keeps plain reads for a balance shown outside a transaction', async () => {
    const conn = makeConn();

    await getFinanceUnplannedBudgetState(conn, { financeRequestId: 299 });

    for (const { sql } of conn.executed) expect(sql).not.toMatch(/FOR (SHARE|UPDATE)/);
  });
});

describe('planned line balance', () => {
  beforeEach(() => {
    db.execute.mockReset();
  });

  it('is not reduced by unplanned spend booked to the same Head of Accounts line', async () => {
    db.execute.mockImplementation(async (sql) => {
      if (sql.includes('SELECT id, created_by')) return [[{ id: 299, created_by: 7 }]];
      if (sql.includes('FROM finance_budget_breakup fbb')) {
        return [
          [
            {
              finance_budget_breakup_id: 41,
              budget_line_id: 9001,
              budget_proposal_id: 55,
              finance_request_ref: '#F-2026-0299',
              fiscal_year: 2026,
              head: 'Faculty Empowerment',
              sub_head: 'Accommodation',
              total_amount: 16000,
              beneficiary_type: 'Faculty',
              beneficiary_value: 'Mr Balachandran A',
            },
          ],
        ];
      }
      if (sql.includes('consumed_amount')) {
        // Only an unplanned claim exists. Unplanned rows may reach this query solely through the
        // legacy branch gated on the finance request having approved no unplanned money; an
        // ungated read would surface this claim against the planned line.
        const unplannedIsGated = sql.includes('COALESCE(fr.unplanned_budget_enabled, 0) = 0');
        return sql.includes('expenditure_unplanned_rows') && !unplannedIsGated
          ? [
              [
                {
                  finance_budget_breakup_id: null,
                  budget_line_id: 9001,
                  budget_head: 'Faculty Empowerment',
                  sub_head: 'Food & Refreshment',
                  consumed_amount: 11000,
                },
              ],
            ]
          : [[]];
      }
      return [[]];
    });

    const [budget] = await getApprovedBudgets({
      userId: 7,
      financeRequestId: 299,
      allowAnyApprovedFinance: true,
    });

    expect(budget.remainingAmount).toBe(16000);
  });

  /**
   * Prod expenditure #70 claimed ₹870 as "unplanned" on finance #94, which approved no unplanned
   * money; the ₹870 was the whole Food & Refreshment line. That claim must keep consuming the line,
   * or the line would show ₹870 available and the same money could be spent twice.
   */
  it('still counts legacy unplanned claims on a finance request that approved none', async () => {
    let usageSql = '';
    db.execute.mockImplementation(async (sql) => {
      if (sql.includes('SELECT id, created_by')) return [[{ id: 94, created_by: 7 }]];
      if (sql.includes('FROM finance_budget_breakup fbb')) {
        return [
          [
            {
              finance_budget_breakup_id: 461,
              budget_line_id: 5362,
              head: 'Official Visits',
              sub_head: 'Food & Refreshment',
              total_amount: 870,
            },
          ],
        ];
      }
      if (sql.includes('consumed_amount')) {
        usageSql = sql;
        return [
          [
            {
              finance_budget_breakup_id: null,
              budget_line_id: 5362,
              budget_head: 'Official Visits',
              sub_head: 'Food & Refreshment',
              consumed_amount: 870,
            },
          ],
        ];
      }
      return [[]];
    });

    const [budget] = await getApprovedBudgets({
      userId: 7,
      financeRequestId: 94,
      allowAnyApprovedFinance: true,
    });

    expect(usageSql).toContain('expenditure_unplanned_rows');
    expect(usageSql).toContain('COALESCE(fr.unplanned_budget_enabled, 0) = 0');
    expect(budget.remainingAmount).toBe(0);
  });

  /**
   * A carried-forward finance request draws on the department's target-year line, whose balance
   * every request on that line shares. An approved unplanned claim must not shrink it, or one
   * applicant's unplanned spend would block everyone else's planned claims on the line.
   */
  it('is not reduced by approved unplanned spend on a carried-forward request', async () => {
    let usageSql = '';
    db.execute.mockImplementation(async (sql) => {
      if (sql.includes('FROM finance_carry_forward_allocations')) {
        return [[{ target_fiscal_year: 2026 }]];
      }
      if (sql.includes('SELECT id, created_by')) return [[{ id: 299, created_by: 7 }]];
      if (sql.includes('LEFT JOIN finance_request_refs frr')) {
        return [[{ id: 299, beneficiary_type: 'Faculty', department_id: 12 }]];
      }
      if (sql.includes('SELECT DISTINCT'))
        return [[{ h: 'faculty empowerment', s: 'accommodation' }]];
      if (sql.includes('FROM budget_proposal_lines bpl')) {
        return [
          [
            {
              budget_line_id: 4161,
              budget_proposal_id: 137,
              fiscal_year: 2026,
              head: 'Faculty Empowerment',
              sub_head: 'Accommodation',
              total_amount: 5000,
            },
          ],
        ];
      }
      if (sql.includes('consumed_amount')) {
        usageSql = sql;
        const unplannedIsGated = sql.includes(
          'COALESCE(fr_unplanned.unplanned_budget_enabled, 0) = 0',
        );
        return sql.includes('expenditure_unplanned_rows') && !unplannedIsGated
          ? [[{ budget_line_id: 4161, consumed_amount: 4000 }]]
          : [[]];
      }
      return [[]];
    });

    const [budget] = await getApprovedBudgets({
      userId: 7,
      financeRequestId: 299,
      fiscalYear: 2026,
      allowAnyApprovedFinance: true,
    });

    expect(usageSql).toContain('COALESCE(fr_unplanned.unplanned_budget_enabled, 0) = 0');
    expect(budget.remainingAmount).toBe(5000);
  });
});
