import React, { useMemo } from 'react';

import { AmountInput, SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import TagSelectField from '../components/TagSelectField';
import { MAX_FINANCE_ROWS } from '../constants';
import { createFinanceRow, removeAt, replaceAt, sumAmounts } from '../projectFormState';
import {
  financePartyOptions,
  financePartyValue,
  flatBudgetHeadOptions,
  pickFinanceParty,
  withSelectedOption,
} from '../selectOptions';

import type { DirectoryParty } from '../selectOptions';
import type { BudgetHeadOption, FinanceRow, ProjectOrganization } from '../types';

interface FinanceRowsSectionProps {
  title: string;
  /** Prefix of the field paths the API reports errors under. */
  errorPrefix: 'contribution_rows' | 'sharing_rows';
  rows: FinanceRow[];
  onChange: (rows: FinanceRow[]) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** The project's own parties, not the whole master list — see `financeOrganizations`. */
  organizations: ProjectOrganization[];
  /** Collaborators from the Organization directory with no master entry. */
  directoryParties: DirectoryParty[];
  budgetHeads: BudgetHeadOption[];
  errors: Record<string, string>;
  disabled: boolean;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/**
 * Keeps a stored head selectable when the vocabulary no longer offers it —
 * without this its chip would disappear and an edit to any other cell in the
 * row would save the row without it.
 */
const withStoredHeads = (
  options: { value: string; label: string }[],
  heads: string[],
): { value: string; label: string }[] => {
  const offered = new Set(options.map((option) => option.value));
  const missing = heads
    .filter((name) => !offered.has(name))
    .map((name) => ({ value: name, label: name }));

  return missing.length > 0 ? [...missing, ...options] : options;
};

/**
 * The picker's stand-in for "every head". Only ever a value inside the
 * multi-select — a row stores it as `coversAllHeads`, never as a head name, so
 * it cannot collide with a head an administrator adds to the vocabulary.
 */
const ALL_BUDGET_HEADS = '__all_budget_heads__';

const allHeadsOption = { value: ALL_BUDGET_HEADS, label: 'All Budget Heads' };

/**
 * The Financial Contribution and Budget Sharing tables. They carry the same
 * columns — organization, budget heads, amount — and differ only in whether the
 * money comes in or is shared out, so one component renders both.
 */
const FinanceRowsSection: React.FC<FinanceRowsSectionProps> = ({
  title,
  errorPrefix,
  rows,
  onChange,
  enabled,
  onToggle,
  organizations,
  directoryParties,
  budgetHeads,
  errors,
  disabled,
}) => {
  const organizationOptions = useMemo(
    () => financePartyOptions(organizations, directoryParties),
    [organizations, directoryParties],
  );

  // The flat head list rather than the grouped one `budgetHeadOptions()`
  // builds: this is a multi-select with no group headings, so a head that
  // belongs to both vocabularies — `Consumables` — would be offered twice over,
  // indistinguishably, and twice under the same React key.
  const headOptions = useMemo(() => flatBudgetHeadOptions(budgetHeads), [budgetHeads]);

  const update = (index: number, changes: Partial<FinanceRow>) =>
    onChange(replaceAt(rows, index, changes));

  /**
   * Reads a change from the picker back into the row. "All Budget Heads" is
   * exclusive: choosing it replaces whatever specific heads were picked, and
   * while it holds, nothing else is offered — removing its chip is what opens
   * the list again. Anything else is an ordinary change to the head list.
   */
  const updateHeads = (index: number, values: string[]) =>
    update(
      index,
      values.includes(ALL_BUDGET_HEADS)
        ? { coversAllHeads: true, heads: [] }
        : { coversAllHeads: false, heads: values },
    );

  const total = sumAmounts(rows);

  return (
    <SectionCard
      title={title}
      toggle={{
        checked: enabled,
        onChange: onToggle,
        label: `Enable ${title.toLowerCase()}`,
        disabled,
      }}
    >
      <div className="pf-table-wrap">
        <table className="pf-table pf-table--fixed">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col">Organization</th>
              <th scope="col">Budget Head(s)</th>
              <th scope="col" className="pf-table__amount">
                Amount
              </th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="pf-table__sno">{index + 1}</td>

                <td>
                  <SelectField
                    value={financePartyValue(row.organizationId, row.directoryOrganizationId)}
                    onChange={(value) => {
                      const party = pickFinanceParty(value, organizations, directoryParties);
                      update(index, {
                        organizationId: party.organizationId,
                        organizationName: party.name,
                        directoryOrganizationId: party.directoryOrganizationId,
                      });
                    }}
                    options={withSelectedOption(
                      organizationOptions,
                      financePartyValue(row.organizationId, row.directoryOrganizationId),
                      row.organizationName,
                    )}
                    disabled={disabled}
                    invalid={Boolean(errors[`${errorPrefix}[${index}].organization`])}
                    ariaLabel="Organization"
                  />
                </td>

                <td>
                  <TagSelectField
                    compact
                    // "All" heads the list so it is the first thing seen; once
                    // it is chosen it is the only option, which is what stops a
                    // specific head being picked alongside it.
                    options={
                      row.coversAllHeads
                        ? [allHeadsOption]
                        : [allHeadsOption, ...withStoredHeads(headOptions, row.heads)]
                    }
                    value={row.coversAllHeads ? [ALL_BUDGET_HEADS] : row.heads}
                    onChange={(values) => updateHeads(index, values)}
                    placeholder="Select budget head(s)"
                    disabled={disabled}
                    emptyMessage={
                      row.coversAllHeads
                        ? 'Covers every head. Remove it to pick specific ones.'
                        : 'No matches'
                    }
                  />
                </td>

                <td className="pf-table__amount">
                  <AmountInput
                    className={`pf-input pf-input--amount ${errors[`${errorPrefix}[${index}].amount`] ? 'is-invalid' : ''}`.trim()}
                    value={row.amount}
                    onChange={(amount) => update(index, { amount })}
                    disabled={disabled}
                    aria-label="Amount"
                  />
                </td>

                <td className="pf-table__actions">
                  <RowActions
                    itemLabel="row"
                    onAdd={() => onChange([...rows, createFinanceRow()])}
                    showAdd={index === rows.length - 1}
                    addDisabled={rows.length >= MAX_FINANCE_ROWS}
                    onRemove={() => onChange(removeAt(rows, index))}
                    canRemove={rows.length > 1}
                    disabled={disabled}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pf-table__total-label">
                Total Amount
              </td>
              <td className="pf-table__amount pf-table__total-value">
                {total > 0 ? currency.format(total) : '—'}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  );
};

export default FinanceRowsSection;
