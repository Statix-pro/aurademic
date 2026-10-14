import React, { useMemo, useState } from 'react';

import { SelectField } from '../components/FormFields';
import SectionCard from '../components/SectionCard';
import { buildTransactionSummary, formatAmount } from '../projectBudgetSummary';

import type { SummaryFigures, SummaryRow } from '../projectBudgetSummary';
import type { ProjectFormState } from '../types';

interface TransactionSummarySectionProps {
  form: ProjectFormState;
}

/** Budget / Actuals / Balance, rendered the same way for a head or a total. */
const FigureCells: React.FC<{ figures: SummaryFigures }> = ({ figures }) => (
  <>
    <td className="pf-table__amount">{formatAmount(figures.budget)}</td>
    <td className="pf-table__amount">{formatAmount(figures.actuals)}</td>
    <td className="pf-table__amount">{formatAmount(figures.balance)}</td>
  </>
);

const HeadRows: React.FC<{ rows: SummaryRow[]; emptyLabel: string }> = ({ rows, emptyLabel }) => {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={5} className="pf-summary__empty">
          {emptyLabel}
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row, index) => (
        <tr key={row.key}>
          <td className="pf-table__sno">{index + 1}</td>
          <td>{row.label}</td>
          <FigureCells figures={row} />
        </tr>
      ))}
    </>
  );
};

/**
 * Budget against Actuals, per budget head.
 *
 * Every figure here is derived — Budget from the allotment matrix above,
 * Actuals from the ledger on the Transaction tab — so the table cannot fall out
 * of step with what it summarizes, and it moves as the user types rather than
 * waiting for a save.
 */
const TransactionSummarySection: React.FC<TransactionSummarySectionProps> = ({ form }) => {
  const [financialYear, setFinancialYear] = useState('');

  // The years the project actually budgets across, plus any year only the
  // ledger knows about, so no transaction can hide from every filter setting.
  const yearOptions = useMemo(() => {
    const years = new Set(form.budgetYears.map((column) => column.financialYear).filter(Boolean));
    form.transactionAccounts.forEach((account) =>
      account.transactions.forEach((row) => {
        if (row.financialYear) years.add(row.financialYear);
      }),
    );

    return [...years].sort().map((year) => ({ value: year, label: year }));
  }, [form.budgetYears, form.transactionAccounts]);

  // Removing the year column that was being filtered to leaves the selection
  // pointing at a year that no longer exists, which the dropdown renders as
  // blank. Falling back to every year keeps the dropdown and the table saying
  // the same thing.
  const selectedYear = yearOptions.some((option) => option.value === financialYear)
    ? financialYear
    : '';

  const summary = useMemo(
    () =>
      buildTransactionSummary({
        budgetRows: form.budgetRows,
        budgetYears: form.budgetYears,
        budgetAllotments: form.budgetAllotments,
        accounts: form.transactionAccounts,
        financialYear: selectedYear,
      }),
    [
      form.budgetRows,
      form.budgetYears,
      form.budgetAllotments,
      form.transactionAccounts,
      selectedYear,
    ],
  );

  return (
    <SectionCard title="Transaction Summary">
      <div className="pf-summary__filter">
        <span className="pf-summary__filter-label">Select Financial Year</span>
        <SelectField
          value={selectedYear}
          onChange={setFinancialYear}
          options={yearOptions}
          placeholder="All years"
          ariaLabel="Financial year to summarize"
        />
      </div>

      <div className="pf-table-wrap">
        <table className="pf-table pf-summary">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col">Budget Head</th>
              <th scope="col" className="pf-table__amount">
                Budget
              </th>
              <th scope="col" className="pf-table__amount">
                Actuals
              </th>
              <th scope="col" className="pf-table__amount">
                Balance
              </th>
            </tr>
          </thead>

          <tbody>
            <HeadRows
              rows={summary.expenditure}
              emptyLabel="Add a budget head above to see it here."
            />
            <tr className="pf-summary__total">
              <td colSpan={2} className="pf-table__total-label">
                Total Expenditure
              </td>
              <FigureCells figures={summary.expenditureTotal} />
            </tr>

            <HeadRows rows={summary.income} emptyLabel="No income recorded yet." />
            <tr className="pf-summary__total">
              <td colSpan={2} className="pf-table__total-label">
                Total Income
              </td>
              <FigureCells figures={summary.incomeTotal} />
            </tr>

            {/* Shown only for a single year, where the balance a project starts
                the year with is what makes the closing figure add up. */}
            {summary.openingBalance !== null && (
              <tr className="pf-summary__total">
                <td colSpan={2} className="pf-table__total-label">
                  Opening Balance
                </td>
                <td className="pf-table__amount">—</td>
                <td className="pf-table__amount">{formatAmount(summary.openingBalance)}</td>
                <td className="pf-table__amount">—</td>
              </tr>
            )}

            <tr className="pf-summary__total pf-summary__balance">
              <td colSpan={2} className="pf-table__total-label">
                {summary.openingBalance === null ? 'Balance' : 'Closing Balance'}
              </td>
              <FigureCells figures={summary.netBalance} />
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default TransactionSummarySection;
