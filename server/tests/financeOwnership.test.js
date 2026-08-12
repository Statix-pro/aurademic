import { beforeEach, describe, expect, it, vi } from 'vitest';

import db from '../config/connection.js';
import {
  canReadApplicantAdvanceTotals,
  getAdvanceSummary,
  getExpenditureDashboard,
  listExpenditures,
} from '../modules/expenditure/expenditureModel.js';
import {
  buildFinanceOwnerCondition,
  buildFinanceOwnerParams,
  isFinanceRequestOwner,
} from '../modules/shared/financeOwnership.js';

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
 * The production shape that motivated this rule: finance request #F-2026-0225 was submitted from
 * the shared hodchemistry@ login (user 248) for Dr Sukantha (employee 29, login 138). It showed
 * on the applicant's Finance page and vanished from their Expenditure page, and claiming against
 * it failed as "Access denied". 61 approved requests were in that state.
 */
const DELEGATED_ROW = { created_by: 248, applicant_user_id: 138 };

describe('isFinanceRequestOwner', () => {
  it('accepts the login that submitted the request', () => {
    expect(isFinanceRequestOwner(DELEGATED_ROW, 248)).toBe(true);
  });

  it('accepts the applicant a shared login submitted it for', () => {
    expect(isFinanceRequestOwner(DELEGATED_ROW, 138)).toBe(true);
  });

  it('rejects an unrelated user', () => {
    expect(isFinanceRequestOwner(DELEGATED_ROW, 999)).toBe(false);
  });

  // The applicant has never logged in, so there is no second owner to admit.
  it('falls back to the creator alone when the applicant has no linked login', () => {
    expect(isFinanceRequestOwner({ created_by: 248, applicant_user_id: null }, 248)).toBe(true);
    expect(isFinanceRequestOwner({ created_by: 248, applicant_user_id: null }, 138)).toBe(false);
  });

  it('never treats a missing user or row as an owner', () => {
    expect(isFinanceRequestOwner(DELEGATED_ROW, 0)).toBe(false);
    expect(isFinanceRequestOwner(DELEGATED_ROW, undefined)).toBe(false);
    expect(isFinanceRequestOwner(null, 138)).toBe(false);
  });

  // created_by arrives as a string from some drivers; a string/number mismatch would silently
  // deny the creator their own request.
  it('compares ids by value, not by type', () => {
    expect(isFinanceRequestOwner({ created_by: '248', applicant_user_id: '138' }, 138)).toBe(true);
  });
});

describe('buildFinanceOwnerCondition', () => {
  it('matches on creator or on the applicant employee link', () => {
    const sql = buildFinanceOwnerCondition('fr');

    expect(sql).toContain('fr.created_by = ?');
    expect(sql).toContain('me_owner_fr.id = fr.employee_id');
    expect(sql).toContain('me_owner_fr.user_id = ?');
  });

  // Two placeholders, two bind values — the pairing the dashboard queries depend on.
  it('takes exactly as many placeholders as it binds', () => {
    const placeholders = buildFinanceOwnerCondition('er').match(/\?/g) || [];

    expect(placeholders).toHaveLength(buildFinanceOwnerParams(138).length);
  });

  // Both dashboard queries scope one statement by two aliases, so the inner alias has to be
  // unique per outer alias or MySQL rejects the statement.
  it('derives a distinct inner alias per table alias', () => {
    expect(buildFinanceOwnerCondition('fr')).toContain('me_owner_fr');
    expect(buildFinanceOwnerCondition('fr_req')).toContain('me_owner_fr_req');
  });

  it('binds the same user id to both branches', () => {
    expect(buildFinanceOwnerParams(138)).toEqual([138, 138]);
  });

  it('binds an unusable user id as zero rather than NULL or NaN', () => {
    expect(buildFinanceOwnerParams('abc')).toEqual([0, 0]);
  });
});

describe('getExpenditureDashboard ownership scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // hasFinanceRequestColumn('closed_at') probes INFORMATION_SCHEMA before the queries run.
    db.query.mockResolvedValue([[{ count: 1 }]]);
    db.execute.mockResolvedValue([[]]);
  });

  it('scopes cards and claims to creator or applicant, in bind order', async () => {
    await getExpenditureDashboard({ userId: 138, fiscalYear: 2026 });

    expect(db.execute).toHaveBeenCalledTimes(2);
    const [cardSql, cardParams] = db.execute.mock.calls[0];
    const [requestSql, requestParams] = db.execute.mock.calls[1];

    expect(cardSql).toContain('me_owner_fr.user_id = ?');
    expect(requestSql).toContain('me_owner_er.user_id = ?');

    // The owner pair precedes the fiscal-year pair in both statements. Getting this order wrong
    // is what would silently filter by the wrong column.
    expect(cardParams).toEqual([138, 138, 2026, 2026]);
    expect(requestParams).toEqual([138, 138, 2026, 2026]);
  });

  it('still binds the owner pair when no fiscal year is filtered', async () => {
    await getExpenditureDashboard({ userId: 138 });

    expect(db.execute.mock.calls[0][1]).toEqual([138, 138]);
    expect(db.execute.mock.calls[1][1]).toEqual([138, 138]);
  });

  it('queries nothing without a user context', async () => {
    const result = await getExpenditureDashboard({ userId: 0, fiscalYear: 2026 });

    expect(db.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ cards: [], requests: [] });
  });
});

/**
 * Routes every statement through one fake so the column probes, the SHOW COLUMNS cache and the
 * real query can be told apart by their SQL. Returns a `find` helper for locating the statement
 * a test cares about.
 */
const mockExecuteByStatement = () => {
  db.query.mockResolvedValue([[{ count: 1 }]]);
  db.execute.mockImplementation(async (sql) => {
    if (/SHOW COLUMNS/i.test(sql)) {
      return [
        ['employee_id', 'amount', 'budget_line_id', 'head', 'sub_head'].map((Field) => ({ Field })),
      ];
    }
    if (/COUNT\(\*\) AS total/i.test(sql)) return [[{ total: 0 }]];
    return [[{ total_advanced: 0, cnt: 0 }]];
  });

  return (pattern) => db.execute.mock.calls.find(([sql]) => pattern.test(sql));
};

describe('listExpenditures ownership scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Must agree with getExpenditureDashboard: a claim the dashboard shows has to be listed here
  // too, or "my requests" silently hides it again.
  it('scopes `mine` to creator or applicant', async () => {
    const find = mockExecuteByStatement();

    await listExpenditures({ userId: 138, mine: true });

    const [countSql, countParams] = find(/COUNT\(\*\) AS total/i);
    expect(countSql).toContain('er.created_by = ?');
    expect(countSql).toContain('me_owner_er.user_id = ?');
    expect(countParams).toEqual([138, 138]);
  });

  it('applies no owner filter when `mine` is not requested', async () => {
    const find = mockExecuteByStatement();

    await listExpenditures({ userId: 138 });

    expect(find(/COUNT\(\*\) AS total/i)[0]).not.toContain('me_owner_er');
  });
});

describe('getAdvanceSummary claimant scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The running total belongs to the applicant, not to whoever typed the form: a shared
  // department login and the applicant's own login can both raise claims on the same head, and
  // scoping by created_by alone would report 0 prior advances to the second of them.
  it('scopes by applicant employee when one is known', async () => {
    const find = mockExecuteByStatement();

    await getAdvanceSummary({
      userId: 138,
      employeeId: 29,
      head: 'Consumables',
      subHead: 'Chemicals',
    });

    const [sql, params] = find(/legacy_totals/i);
    expect(sql).toContain('er.employee_id = ?');
    // LEGACY rows carry no employee_id, so the creating login still admits those.
    expect(sql).toContain('er.employee_id IS NULL AND er.created_by = ?');
    expect(params.slice(0, 2)).toEqual([29, 138]);
  });

  it('falls back to the caller identity when no applicant is given', async () => {
    const find = mockExecuteByStatement();

    await getAdvanceSummary({ userId: 138, head: 'Consumables', subHead: 'Chemicals' });

    const [sql, params] = find(/legacy_totals/i);
    expect(sql).toContain('me_owner_er.user_id = ?');
    expect(params.slice(0, 2)).toEqual([138, 138]);
  });

  it('ignores an applicant it was not given', async () => {
    const find = mockExecuteByStatement();

    await getAdvanceSummary({
      userId: 138,
      employeeId: 0,
      head: 'Consumables',
      subHead: 'Chemicals',
    });

    expect(find(/legacy_totals/i)[0]).not.toContain('er.employee_id = ?');
  });

  // A finance request pins one card, which is narrower than any person filter — and it must not
  // cost an extra lookup of that card's creator.
  it('drops the person filter entirely when a finance request scopes the total', async () => {
    const find = mockExecuteByStatement();

    await getAdvanceSummary({
      userId: 138,
      employeeId: 29,
      financeRequestId: 225,
      head: 'Consumables',
      subHead: 'Chemicals',
    });

    const [sql] = find(/legacy_totals/i);
    expect(sql).toContain('1 = 1');
    expect(sql).not.toContain('er.employee_id = ?');
    expect(sql).not.toContain('me_owner_er');
    expect(find(/FROM finance_requests WHERE id/i)).toBeUndefined();
  });
});

/**
 * The applicant on the advance-summary endpoint comes from the query string, and the total it
 * scopes is a money figure — so an arbitrary employee_id must not be honoured.
 */
describe('canReadApplicantAdvanceTotals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admits a caller the applicant link or a prior request vouches for', async () => {
    db.execute.mockResolvedValue([[{ 1: 1 }]]);

    await expect(canReadApplicantAdvanceTotals({ userId: 248, employeeId: 29 })).resolves.toBe(
      true,
    );

    const [sql, params] = db.execute.mock.calls[0];
    // The applicant themselves, or a login that already raised a request FOR them.
    expect(sql).toContain('me.user_id = ?');
    expect(sql).toContain('FROM finance_requests fr');
    expect(sql).toContain('FROM expenditure_requests er');
    expect(params).toEqual([29, 248, 248, 248]);
  });

  it('refuses an applicant the caller has no relationship to', async () => {
    db.execute.mockResolvedValue([[]]);

    await expect(canReadApplicantAdvanceTotals({ userId: 999, employeeId: 29 })).resolves.toBe(
      false,
    );
  });

  it('refuses, without querying, when either id is missing', async () => {
    await expect(canReadApplicantAdvanceTotals({ userId: 0, employeeId: 29 })).resolves.toBe(false);
    await expect(canReadApplicantAdvanceTotals({ userId: 138, employeeId: 0 })).resolves.toBe(
      false,
    );
    await expect(canReadApplicantAdvanceTotals()).resolves.toBe(false);

    expect(db.execute).not.toHaveBeenCalled();
  });
});
