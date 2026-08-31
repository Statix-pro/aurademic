/**
 * Derivations behind the Budget tab.
 *
 * Nothing here is stored. The Transaction Summary is Budget (from the
 * allotment matrix) against Actuals (from the ledger on the Transaction tab),
 * and the ledger's Balance column is a running total of its own rows — so both
 * are computed from form state and stay correct while the user is still typing,
 * with no way to drift out of step with the numbers they are built from.
 */

import { PROJECT_INCOME_HEADS } from './constants';
import { allotmentKey } from './projectFormState';

import type {
  BudgetAllotmentMap,
  BudgetAllotmentRow,
  BudgetYearColumn,
  TransactionAccount,
  TransactionHeadKind,
  TransactionRow,
} from './types';

/** Reads an amount field. Anything unparseable counts as nothing. */
export function toAmount(value: string): number {
  const parsed = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim(),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

const amountFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a derived cell; `null` means "there is no such number", not zero. */
export function formatAmount(value: number | null): string {
  return value === null ? '—' : amountFormat.format(value);
}

/**
 * The identity a ledger row and an allotment row are matched on. The catalog id
 * is used where there is one, so a head an administrator later renames keeps
 * its ledger rows attached to its budget; heads with no id fall back to the
 * name they were saved under.
 */
export function headIdentity(
  kind: TransactionHeadKind,
  budgetHeadId: number | null,
  name: string,
): string {
  if (kind === 'income') return `income:${name.trim().toLowerCase()}`;
  return budgetHeadId
    ? `expenditure:id:${budgetHeadId}`
    : `expenditure:name:${name.trim().toLowerCase()}`;
}

/**
 * Reads back what `headIdentity` encoded. The ledger's head dropdown is valued
 * by identity so one choice settles both the head and the side of the summary
 * it counts on; the display name comes from the chosen option, since the
 * identity lower-cases it.
 */
export function parseHeadIdentity(identity: string): {
  headKind: TransactionHeadKind;
  budgetHeadId: number | null;
} {
  if (identity.startsWith('income:')) return { headKind: 'income', budgetHeadId: null };

  const catalogId = /^expenditure:id:(\d+)$/.exec(identity);
  return {
    headKind: 'expenditure',
    budgetHeadId: catalogId ? Number(catalogId[1]) : null,
  };
}

/**
 * The ledger's Balance column: a running total down the rows, credit adding and
 * debit subtracting.
 */
export function runningBalances(transactions: TransactionRow[]): number[] {
  let balance = 0;

  return transactions.map((row) => {
    balance += toAmount(row.credit) - toAmount(row.debit);
    return balance;
  });
}

export interface SummaryFigures {
  /** `null` where no budget was allotted, which is not the same as zero. */
  budget: number | null;
  actuals: number;
  balance: number | null;
}

export interface SummaryRow extends SummaryFigures {
  key: string;
  label: string;
}

export interface TransactionSummary {
  expenditure: SummaryRow[];
  expenditureTotal: SummaryFigures;
  income: SummaryRow[];
  incomeTotal: SummaryFigures;
  /**
   * Cash carried into the selected year from earlier ones, and `null` when
   * every year is shown at once — there is no earlier period to carry from.
   */
  openingBalance: number | null;
  /**
   * The closing balance: what is left after this period, counting what it
   * opened with. Over every year that is simply income less expenditure.
   */
  netBalance: SummaryFigures;
}

interface SummaryInput {
  budgetRows: BudgetAllotmentRow[];
  budgetYears: BudgetYearColumn[];
  budgetAllotments: BudgetAllotmentMap;
  accounts: TransactionAccount[];
  /** A single financial year, or `''` for every year at once. */
  financialYear: string;
}

/** Sums a list of figures, keeping `null` only when nothing contributed a number. */
function totalOf(rows: SummaryFigures[]): SummaryFigures {
  const budgeted = rows.filter((row) => row.budget !== null);

  const budget = budgeted.length > 0 ? budgeted.reduce((sum, row) => sum + row.budget!, 0) : null;
  const actuals = rows.reduce((sum, row) => sum + row.actuals, 0);

  return { budget, actuals, balance: budget === null ? null : budget - actuals };
}

export function buildTransactionSummary({
  budgetRows,
  budgetYears,
  budgetAllotments,
  accounts,
  financialYear,
}: SummaryInput): TransactionSummary {
  const columns = financialYear
    ? budgetYears.filter((column) => column.financialYear === financialYear)
    : budgetYears;

  // Actuals, netted per head. Both directions are allowed against either kind
  // of head — a returned advance is a credit against an expenditure head — so
  // spend is debit less credit, and income credit less debit.
  const actualsByHead = new Map<string, number>();
  const labelsByHead = new Map<string, string>();
  let openingBalance = 0;

  accounts.forEach((account) => {
    account.transactions.forEach((row) => {
      if (!row.budgetHeadId && !row.headName.trim()) return;

      // Money that moved in an earlier year is no part of this year's figures,
      // but it is exactly what the year opens with. Financial years are fixed
      // width (`2025-26`), so they order correctly as plain strings.
      if (financialYear && row.financialYear && row.financialYear < financialYear) {
        openingBalance += toAmount(row.credit) - toAmount(row.debit);
        return;
      }
      if (financialYear && row.financialYear !== financialYear) return;

      const identity = headIdentity(row.headKind, row.budgetHeadId, row.headName);
      const net =
        row.headKind === 'income'
          ? toAmount(row.credit) - toAmount(row.debit)
          : toAmount(row.debit) - toAmount(row.credit);

      actualsByHead.set(identity, (actualsByHead.get(identity) ?? 0) + net);
      if (!labelsByHead.has(identity)) labelsByHead.set(identity, row.headName.trim() || '—');
    });
  });

  const listed = new Set<string>();

  const budgetedExpenditure: SummaryRow[] = budgetRows
    .filter((row) => row.budgetHeadId || row.budgetHeadName.trim())
    .map((row) => {
      const identity = headIdentity('expenditure', row.budgetHeadId, row.budgetHeadName);
      listed.add(identity);

      const budget = columns.reduce(
        (total, column) => total + toAmount(budgetAllotments[allotmentKey(row.key, column.key)]),
        0,
      );
      const actuals = actualsByHead.get(identity) ?? 0;

      return {
        key: row.key,
        label: row.budgetHeadName.trim() || '—',
        budget,
        actuals,
        balance: budget - actuals,
      };
    });

  const unlisted = (prefix: string): SummaryRow[] =>
    [...actualsByHead.entries()]
      .filter(([identity]) => identity.startsWith(prefix) && !listed.has(identity))
      .map(([identity, actuals]) => ({
        key: identity,
        label: labelsByHead.get(identity) ?? '—',
        budget: null,
        actuals,
        balance: null,
      }));

  // A head that was spent against but never allotted still has to be listed, or
  // Total Expenditure would not add up to what the ledger says was spent.
  const expenditure = [...budgetedExpenditure, ...unlisted('expenditure:')];

  // The standard income heads are always listed, so the section reads as a
  // fixed schedule rather than appearing a row at a time. Income is received
  // rather than budgeted, so these carry actuals only.
  const standardIncome: SummaryRow[] = PROJECT_INCOME_HEADS.map((name) => {
    const identity = headIdentity('income', null, name);
    listed.add(identity);

    return {
      key: identity,
      label: name,
      budget: null,
      actuals: actualsByHead.get(identity) ?? 0,
      balance: null,
    };
  });

  const income = [...standardIncome, ...unlisted('income:')];

  const expenditureTotal = totalOf(expenditure);
  const incomeTotal = totalOf(income);

  return {
    expenditure,
    expenditureTotal,
    income,
    incomeTotal,
    // Over every year at once there is no earlier period, so the row is not
    // shown and `openingBalance` is necessarily zero below.
    openingBalance: financialYear ? openingBalance : null,
    netBalance: {
      // Income carries no budget, so there is no budgeted position to compare —
      // only the actuals column of this row says anything.
      budget:
        incomeTotal.budget === null || expenditureTotal.budget === null
          ? null
          : incomeTotal.budget - expenditureTotal.budget,
      // The closing balance carries the earlier years forward, which is what
      // stops a year that only spends from reading as a negative fund. Over
      // every year at once the opening is zero and this is plain income less
      // expenditure — the same figure the ledger's last running balance shows.
      actuals: openingBalance + incomeTotal.actuals - expenditureTotal.actuals,
      balance:
        incomeTotal.balance === null || expenditureTotal.balance === null
          ? null
          : incomeTotal.balance - expenditureTotal.balance,
    },
  };
}
