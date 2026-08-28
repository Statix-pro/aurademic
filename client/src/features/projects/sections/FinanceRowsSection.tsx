import React, { useMemo } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import TagSelectField from '../components/TagSelectField';
import { MAX_FINANCE_ROWS } from '../constants';
import { createFinanceRow, removeAt, replaceAt, sumAmounts } from '../projectFormState';
import { withSelectedOption } from '../selectOptions';

import type { BudgetHead } from '../../../shared/hooks/useBudgetCatalog';
import type { BudgetHeadRef, FinanceRow, ProjectOrganization } from '../types';

interface FinanceRowsSectionProps {
  title: string;
  /** Prefix of the field paths the API reports errors under. */
  errorPrefix: 'contribution_rows' | 'sharing_rows';
  rows: FinanceRow[];
  onChange: (rows: FinanceRow[]) => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  organizations: ProjectOrganization[];
  budgetHeads: BudgetHead[];
  errors: Record<string, string>;
  disabled: boolean;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/** A stored head is addressed by its catalog id, a free-text one by its name. */
const headValue = (head: BudgetHeadRef) => (head.id ? String(head.id) : head.name);

/**
 * Keeps a stored head selectable when the catalog does not offer it — it was
 * deactivated, or the catalog has not loaded yet. Without this its chip would
 * render as a bare id and an edit to the row would save it as a nameless head.
 */
const withStoredHeads = (
  options: { value: string; label: string }[],
  heads: BudgetHeadRef[],
): { value: string; label: string }[] => {
  const offered = new Set(options.map((option) => option.value));
  const missing = heads
    .filter((head) => !offered.has(headValue(head)))
    .map((head) => ({
      value: headValue(head),
      label: head.name?.trim() || 'Currently selected (no longer listed)',
    }));

  return missing.length > 0 ? [...missing, ...options] : options;
};

/**
 * The Financial Contribution and Finance Sharing tables. They carry the same
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
  budgetHeads,
  errors,
  disabled,
}) => {
  const organizationOptions = useMemo(
    () =>
      organizations.map((organization) => ({
        value: String(organization.id),
        label: organization.name,
      })),
    [organizations],
  );

  const headOptions = useMemo(
    () => budgetHeads.map((head) => ({ value: String(head.id), label: head.name })),
    [budgetHeads],
  );

  const update = (index: number, changes: Partial<FinanceRow>) =>
    onChange(replaceAt(rows, index, changes));

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
        <table className="pf-table">
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
                    value={row.organizationId ? String(row.organizationId) : ''}
                    onChange={(value) => {
                      const organization = organizations.find((item) => String(item.id) === value);
                      update(index, {
                        organizationId: organization?.id ?? null,
                        organizationName: organization?.name ?? '',
                      });
                    }}
                    options={withSelectedOption(
                      organizationOptions,
                      row.organizationId ? String(row.organizationId) : '',
                      row.organizationName,
                    )}
                    placeholder="Select"
                    disabled={disabled}
                    invalid={Boolean(errors[`${errorPrefix}[${index}].organization`])}
                    ariaLabel="Organization"
                  />
                </td>

                <td>
                  <TagSelectField
                    compact
                    options={withStoredHeads(headOptions, row.heads)}
                    value={row.heads.map(headValue)}
                    onChange={(values) =>
                      update(index, {
                        heads: values.map((value) => {
                          const head = budgetHeads.find((item) => String(item.id) === value);
                          if (head) return { id: head.id, name: head.name };

                          // Not in the catalog: keep what the row already holds
                          // for that chip so its id and name survive the edit.
                          const stored = row.heads.find((item) => headValue(item) === value);
                          return stored ? { ...stored } : { id: null, name: value };
                        }),
                      })
                    }
                    placeholder="Select budget head(s)"
                    disabled={disabled}
                    emptyMessage={
                      headOptions.length === 0 ? 'Budget heads are still loading' : 'No matches'
                    }
                  />
                </td>

                <td className="pf-table__amount">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`pf-input pf-input--amount ${errors[`${errorPrefix}[${index}].amount`] ? 'is-invalid' : ''}`.trim()}
                    value={row.amount}
                    onChange={(event) => update(index, { amount: event.target.value })}
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
