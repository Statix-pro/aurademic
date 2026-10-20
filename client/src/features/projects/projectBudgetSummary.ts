/**
 * Derivations behind the Budget tab.
 *
 * Nothing here is stored. The Transaction Summary is Budget (from the
 * allotment matrix) against Actuals (the ledger rows on the Transaction tab
 * that are ticked as Actuals),
 * and the ledger's Balance column is a running total of its own rows — so both
 * are computed from form state and stay correct while the user is still typing,
 * with no way to drift out of step with the numbers they are built from.
 */

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

const totalFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * The same, for the Budget Allotment matrix's totals. A sanctioned allotment is
 * a whole-rupee figure, so a trailing `.00` on every total was only taking
 * width from a table that grows a column per financial year.
 *
 * The decimals are dropped, not rounded away: `maximumFractionDigits` stays at
 * 2, so a project that really did budget a paise figure still reads as what it
 * budgeted rather than as a total that does not add up.
 */
export function formatBudgetTotal(value: number | null): string {
  return value === null ? '—' : totalFormat.format(value);
}

/**
 * The identity a ledger row and an allotment row are matched on. Project heads
 * are stored by name, so the name is the identity — lower-cased, so a head
 * saved in a different case still counts against its own budget.
 */
export function headIdentity(kind: TransactionHeadKind, name: string): string {
  const key = name.trim().toLowerCase();
  return kind === 'income' ? `income:${key}` : `expenditure:name:${key}`;
}

/**
 * Reads back what `headIdentity` encoded. The ledger's head dropdown is valued
 * by identity so one choice settles both the head and the side of the summary
 * it counts on; the display name comes from the chosen option, since the
 * identity lower-cases it.
 */
export function parseHeadIdentity(identity: string): { headKind: TransactionHeadKind } {
  return { headKind: identity.startsWith('income:') ? 'income' : 'expenditure' };
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
  /**
   * The organization contributing this head, carried over from the allotment
   * matrix. Empty for a head that has no budget row behind it — an unlisted
   * head the ledger spent against, or an income head, neither of which is
   * allotted and so neither of which has a contributor to name.
   */
  contribution: string;
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
  /** The heads ticked on the Income Heads card — this project's income schedule. */
  incomeHeads: string[];
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
  incomeHeads,
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
  // Heads that actually had money move under them. Kept apart from the netted
  // figure above because the two answer different questions: a receipt that was
  // refunded in full nets to nothing and still belongs in the report, while a
  // head picked on a row whose amount has not been typed yet does not.
  const movedHeads = new Set<string>();
  let openingBalance = 0;

  accounts.forEach((account) => {
    account.transactions.forEach((row) => {
      if (!row.headName.trim()) return;
      // A row the user has unticked is out of this report altogether — not just
      // out of its head's Actuals, but out of the opening and closing balances
      // too. Counting it in one and not the other would leave the section
      // totals and the net balance describing two different ledgers. The
      // Balance column on the Transaction tab still includes it: that is the
      // account's cash position, which is true whatever the row is reported as.
      if (!row.countsAsActual) return;

      // Money that moved in an earlier year is no part of this year's figures,
      // but it is exactly what the year opens with. Financial years are fixed
      // width (`2025-26`), so they order correctly as plain strings.
      if (financialYear && row.financialYear && row.financialYear < financialYear) {
        openingBalance += toAmount(row.credit) - toAmount(row.debit);
        return;
      }
      if (financialYear && row.financialYear !== financialYear) return;

      const identity = headIdentity(row.headKind, row.headName);
      const net =
        row.headKind === 'income'
          ? toAmount(row.credit) - toAmount(row.debit)
          : toAmount(row.debit) - toAmount(row.credit);

      actualsByHead.set(identity, (actualsByHead.get(identity) ?? 0) + net);
      if (toAmount(row.credit) !== 0 || toAmount(row.debit) !== 0) movedHeads.add(identity);
      if (!labelsByHead.has(identity)) labelsByHead.set(identity, row.headName.trim() || '—');
    });
  });

  const listed = new Set<string>();

  const budgetedExpenditure: SummaryRow[] = budgetRows
    .filter((row) => row.budgetHeadName.trim())
    .map((row) => {
      const identity = headIdentity('expenditure', row.budgetHeadName);
      listed.add(identity);

      const budget = columns.reduce(
        (total, column) => total + toAmount(budgetAllotments[allotmentKey(row.key, column.key)]),
        0,
      );
      const actuals = actualsByHead.get(identity) ?? 0;

      return {
        key: row.key,
        label: row.budgetHeadName.trim() || '—',
        contribution: row.contributionOrganizationName.trim(),
        budget,
        actuals,
        balance: budget - actuals,
      };
    });

  /**
   * The heads the ledger recorded against that the section above has not
   * already listed. Held to the heads money actually moved under, so a row
   * still being filled in — head picked, amount not yet typed — does not put a
   * 0.00 line into the report and take it out again a keystroke later.
   */
  const unlisted = (prefix: string): SummaryRow[] =>
    [...actualsByHead.entries()]
      .filter(
        ([identity]) =>
          identity.startsWith(prefix) && !listed.has(identity) && movedHeads.has(identity),
      )
      .map(([identity, actuals]) => ({
        key: identity,
        label: labelsByHead.get(identity) ?? '—',
        contribution: '',
        budget: null,
        actuals,
        balance: null,
      }));

  // A head that was spent against but never allotted still has to be listed, or
  // Total Expenditure would not add up to what the ledger says was spent.
  const expenditure = [...budgetedExpenditure, ...unlisted('expenditure:')];

  // The income heads this project ticked, listed whether or not anything has
  // arrived under them yet — the same way an allotted expenditure head is listed
  // before it has been spent against. This is the project's own schedule rather
  // than the fixed four every project used to carry, which is what made those
  // 0.00 rows noise: here each one is a head someone said to expect.
  //
  // Income is received rather than budgeted, so these carry actuals only.
  const declaredIncome: SummaryRow[] = incomeHeads.map((name) => {
    const identity = headIdentity('income', name);
    listed.add(identity);

    return {
      key: identity,
      label: name,
      contribution: '',
      budget: null,
      actuals: actualsByHead.get(identity) ?? 0,
      balance: null,
    };
  });

  // A head received under but never ticked — or un-ticked afterwards — still has
  // to be listed, or Total Income would not add up to what the ledger says came
  // in. Same reason the expenditure side keeps its unbudgeted heads.
  const income = [...declaredIncome, ...unlisted('income:')];

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
