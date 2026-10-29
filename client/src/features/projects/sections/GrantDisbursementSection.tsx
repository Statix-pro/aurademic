import React, { useMemo } from 'react';

import DocumentSlotButton from '../components/DocumentSlotButton';
import { AmountInput, SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import {
  DISBURSEMENT_SLOTS,
  DISBURSEMENT_SLOT_LABELS,
  MAX_DISBURSEMENTS,
  financialYearOptions,
  currentFinancialYear,
} from '../constants';
import { createDisbursementRow, removeAt, replaceAt, sumAmounts } from '../projectFormState';
import {
  financePartyOptions,
  financePartyValue,
  pickFinanceParty,
  withSelectedOption,
} from '../selectOptions';

import type { DirectoryParty } from '../selectOptions';
import type {
  DisbursementRow,
  DisbursementSlot,
  ProjectFormState,
  ProjectOrganization,
} from '../types';

interface GrantDisbursementSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  organizations: ProjectOrganization[];
  /** Collaborators from the Organization directory with no master entry. */
  directoryParties: DirectoryParty[];
  onSelectDocument: (rowIndex: number, slot: DisbursementSlot, file: File) => void;
  onClearDocument: (rowIndex: number, slot: DisbursementSlot) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const GrantDisbursementSection: React.FC<GrantDisbursementSectionProps> = ({
  form,
  patch,
  organizations,
  directoryParties,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => {
  const rows = form.disbursements;

  const yearOptions = useMemo(
    () => financialYearOptions().map((year) => ({ value: year, label: year })),
    [],
  );

  const organizationOptions = useMemo(
    () => financePartyOptions(organizations, directoryParties),
    [organizations, directoryParties],
  );

  const update = (index: number, changes: Partial<DisbursementRow>) =>
    patch({ disbursements: replaceAt(rows, index, changes) });

  const total = sumAmounts(rows);

  return (
    <SectionCard title="Grant Disbursement">
      <div className="pf-table-wrap">
        <table className="pf-table">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-disbursement__year">
                Financial Year
              </th>
              <th scope="col">Organization</th>
              <th scope="col" className="pf-table__amount">
                Amount
              </th>
              <th scope="col" className="pf-disbursement__date">
                Date
              </th>
              {DISBURSEMENT_SLOTS.map((slot) => (
                <th scope="col" className="pf-table__slot" key={slot}>
                  {DISBURSEMENT_SLOT_LABELS[slot]}
                </th>
              ))}
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="pf-table__sno">{index + 1}</td>

                <td className="pf-disbursement__year">
                  <SelectField
                    value={row.financialYear}
                    onChange={(value) => update(index, { financialYear: value })}
                    options={yearOptions}
                    disabled={disabled}
                    invalid={Boolean(errors[`disbursements[${index}].financial_year`])}
                    ariaLabel="Financial year"
                    scrollToValue={currentFinancialYear()}
                  />
                </td>

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
                    invalid={Boolean(errors[`disbursements[${index}].organization`])}
                    ariaLabel="Releasing organization"
                  />
                </td>

                <td className="pf-table__amount">
                  <AmountInput
                    className={`pf-input pf-input--amount ${errors[`disbursements[${index}].amount`] ? 'is-invalid' : ''}`.trim()}
                    value={row.amount}
                    onChange={(amount) => update(index, { amount })}
                    disabled={disabled}
                    aria-label="Amount"
                  />
                </td>

                <td className="pf-disbursement__date">
                  <input
                    type="date"
                    className={`pf-input ${errors[`disbursements[${index}].disbursement_date`] ? 'is-invalid' : ''}`.trim()}
                    value={row.disbursementDate}
                    onChange={(event) => update(index, { disbursementDate: event.target.value })}
                    disabled={disabled}
                    aria-label="Disbursement date"
                  />
                </td>

                {DISBURSEMENT_SLOTS.map((slot) => (
                  <td className="pf-table__slot" key={slot}>
                    <DocumentSlotButton
                      label={DISBURSEMENT_SLOT_LABELS[slot]}
                      slot={row.documents[slot]}
                      onSelect={(file) => onSelectDocument(index, slot, file)}
                      onClear={() => onClearDocument(index, slot)}
                      disabled={disabled}
                    />
                  </td>
                ))}

                <td className="pf-table__actions">
                  <RowActions
                    itemLabel="disbursement"
                    onAdd={() => patch({ disbursements: [...rows, createDisbursementRow()] })}
                    showAdd={index === rows.length - 1}
                    addDisabled={rows.length >= MAX_DISBURSEMENTS}
                    onRemove={() => patch({ disbursements: removeAt(rows, index) })}
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
                Total Disbursed
              </td>
              <td className="pf-table__amount pf-table__total-value">
                {total > 0 ? currency.format(total) : '—'}
              </td>
              <td colSpan={5} />
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  );
};

export default GrantDisbursementSection;
