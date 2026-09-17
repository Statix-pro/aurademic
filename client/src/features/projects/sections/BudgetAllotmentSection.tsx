import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import { MAX_BUDGET_HEAD_ROWS, MAX_BUDGET_YEARS, financialYearOptions } from '../constants';
import { formatAmount, toAmount } from '../projectBudgetSummary';
import {
  allotmentKey,
  createBudgetAllotmentRow,
  createBudgetYearColumn,
  pruneAllotments,
  removeAt,
  replaceAt,
} from '../projectFormState';
import { budgetHeadOptions, withSelectedOption } from '../selectOptions';

import type { BudgetAllotmentRow, BudgetHeadOption, ProjectFormState } from '../types';

interface BudgetAllotmentSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  budgetHeads: BudgetHeadOption[];
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * The Budget Allotment matrix: budget heads down the side, financial years
 * across the top, and the amount allotted at each intersection.
 *
 * Rows and columns are both user-built and both persist even while empty, so a
 * head added before its years — or a year column opened before anything is
 * budgeted under it — survives a save.
 */
const BudgetAllotmentSection: React.FC<BudgetAllotmentSectionProps> = ({
  form,
  patch,
  budgetHeads,
  errors,
  disabled,
}) => {
  const { budgetRows, budgetYears, budgetAllotments } = form;

  const headOptions = useMemo(() => budgetHeadOptions(budgetHeads), [budgetHeads]);

  const yearOptions = useMemo(
    () => financialYearOptions().map((year) => ({ value: year, label: year })),
    [],
  );

  /** A row is only saved, and so only fillable, once it names a head. */
  const hasHead = (row: BudgetAllotmentRow) => Boolean(row.budgetHeadName.trim());

  const amountAt = (rowKey: string, columnKey: string) =>
    budgetAllotments[allotmentKey(rowKey, columnKey)] ?? '';

  const setAmount = (rowKey: string, columnKey: string, amount: string) => {
    const next = { ...budgetAllotments };
    // A cleared cell is dropped rather than stored as an empty string, so the
    // map only ever holds amounts someone actually entered.
    if (amount.trim()) next[allotmentKey(rowKey, columnKey)] = amount;
    else delete next[allotmentKey(rowKey, columnKey)];

    patch({ budgetAllotments: next });
  };

  /**
   * Rewrites the matrix and drops the amounts that no longer have anywhere to
   * live — a removed row or column, and equally one whose head or year was
   * cleared. Those cells are not typeable and the save discards them, so
   * keeping them would only inflate the totals below with money that is about
   * to disappear.
   */
  const replaceStructure = (
    rows = budgetRows,
    columns = budgetYears,
  ): Partial<ProjectFormState> => ({
    budgetRows: rows,
    budgetYears: columns,
    budgetAllotments: pruneAllotments(
      budgetAllotments,
      rows.filter(hasHead),
      columns.filter((column) => Boolean(column.financialYear)),
    ),
  });

  const addColumn = () =>
    patch(replaceStructure(budgetRows, [...budgetYears, createBudgetYearColumn()]));

  const removeColumn = (index: number) =>
    patch(replaceStructure(budgetRows, removeAt(budgetYears, index)));

  const rowTotal = (rowKey: string) =>
    budgetYears.reduce((total, column) => total + toAmount(amountAt(rowKey, column.key)), 0);

  const columnTotal = (columnKey: string) =>
    budgetRows.reduce((total, row) => total + toAmount(amountAt(row.key, columnKey)), 0);

  const grandTotal = budgetRows.reduce((total, row) => total + rowTotal(row.key), 0);

  // The heads already spoken for, so the same head cannot be given two rows —
  // which the server rejects and which would split one budget in two. Matched
  // on the name, since that is what a row stores: `Consumables` is offered
  // under both groups, and taking it from one takes it from the other.
  const takenHeadNames = new Set(
    budgetRows.map((row) => row.budgetHeadName.trim().toLowerCase()).filter(Boolean),
  );
  const takenYears = new Set(budgetYears.map((column) => column.financialYear).filter(Boolean));

  return (
    <SectionCard title="Budget Allotment" error={errors['budget.heads'] || errors['budget.years']}>
      <div className="pf-table-wrap">
        <table className="pf-table pf-matrix">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-matrix__head">
                Budget Head
              </th>

              {budgetYears.map((column, index) => (
                <th scope="col" className="pf-matrix__year" key={column.key}>
                  <div className="pf-matrix__year-header">
                    <SelectField
                      value={column.financialYear}
                      onChange={(value) =>
                        patch(
                          replaceStructure(
                            budgetRows,
                            replaceAt(budgetYears, index, { financialYear: value }),
                          ),
                        )
                      }
                      options={yearOptions.filter(
                        (option) =>
                          option.value === column.financialYear || !takenYears.has(option.value),
                      )}
                      placeholder="Select"
                      disabled={disabled}
                      invalid={Boolean(errors[`budget.years[${index}]`])}
                      ariaLabel={`Financial year for column ${index + 1}`}
                    />

                    <div className="pf-row-actions">
                      {index === budgetYears.length - 1 && (
                        <button
                          type="button"
                          className="pf-icon-btn pf-icon-btn--add"
                          onClick={addColumn}
                          disabled={disabled || budgetYears.length >= MAX_BUDGET_YEARS}
                          aria-label="Add financial year column"
                          title={
                            budgetYears.length >= MAX_BUDGET_YEARS
                              ? 'Maximum number of financial year columns reached'
                              : 'Add financial year column'
                          }
                        >
                          <Plus size={16} aria-hidden="true" />
                        </button>
                      )}

                      <button
                        type="button"
                        className="pf-icon-btn pf-icon-btn--remove"
                        onClick={() => removeColumn(index)}
                        disabled={disabled || budgetYears.length <= 1}
                        aria-label="Remove financial year column"
                        title={
                          budgetYears.length > 1
                            ? 'Remove financial year column'
                            : 'At least one financial year column is required'
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </th>
              ))}

              <th scope="col" className="pf-table__amount">
                Total
              </th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {budgetRows.map((row, index) => (
              <tr key={row.key}>
                <td className="pf-table__sno">{index + 1}</td>

                <td className="pf-matrix__head">
                  <SelectField
                    value={row.budgetHeadName}
                    onChange={(value) => {
                      patch(
                        replaceStructure(replaceAt(budgetRows, index, { budgetHeadName: value })),
                      );
                    }}
                    options={withSelectedOption(
                      headOptions.filter(
                        (option) =>
                          option.value === row.budgetHeadName ||
                          !takenHeadNames.has(option.value.toLowerCase()),
                      ),
                      row.budgetHeadName,
                      // The value is the name, so a head dropped from the
                      // vocabulary reads as itself rather than as the generic
                      // "no longer listed" placeholder.
                      row.budgetHeadName,
                    )}
                    placeholder="Select"
                    disabled={disabled}
                    invalid={Boolean(errors[`budget.heads[${index}]`])}
                    ariaLabel="Budget head"
                  />
                </td>

                {budgetYears.map((column) => (
                  <td className="pf-table__amount" key={column.key}>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="pf-input pf-input--amount"
                      value={amountAt(row.key, column.key)}
                      onChange={(event) => setAmount(row.key, column.key, event.target.value)}
                      // A cell is only storable once both its head and its year
                      // are chosen: a row or column that is still blank is not
                      // saved, and an amount under it would be dropped on save
                      // without ever telling the user.
                      disabled={disabled || !column.financialYear || !hasHead(row)}
                      aria-label={`${row.budgetHeadName || 'Budget head'} allotment for ${
                        column.financialYear || 'the unselected year'
                      }`}
                    />
                  </td>
                ))}

                <td className="pf-table__amount pf-table__total-value">
                  {formatAmount(rowTotal(row.key) || null)}
                </td>

                <td className="pf-table__actions">
                  <RowActions
                    itemLabel="budget head"
                    onAdd={() =>
                      patch(replaceStructure([...budgetRows, createBudgetAllotmentRow()]))
                    }
                    showAdd={index === budgetRows.length - 1}
                    addDisabled={budgetRows.length >= MAX_BUDGET_HEAD_ROWS}
                    onRemove={() => patch(replaceStructure(removeAt(budgetRows, index)))}
                    canRemove={budgetRows.length > 1}
                    disabled={disabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={2} className="pf-table__total-label">
                Total Budget
              </td>
              {budgetYears.map((column) => (
                <td className="pf-table__amount pf-table__total-value" key={column.key}>
                  {formatAmount(columnTotal(column.key) || null)}
                </td>
              ))}
              <td className="pf-table__amount pf-table__total-value">
                {formatAmount(grandTotal || null)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  );
};

export default BudgetAllotmentSection;
