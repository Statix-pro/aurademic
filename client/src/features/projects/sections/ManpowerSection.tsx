import React from 'react';

import DocumentSlotButton from '../components/DocumentSlotButton';
import { AmountInput, SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import RowExpandToggle from '../components/RowExpandToggle';
import SectionCard from '../components/SectionCard';
import { useSingleExpandedRow } from '../components/useSingleExpandedRow';
import { MANPOWER_ROLE_OPTIONS, MAX_MANPOWER } from '../constants';
import { createManpowerRow, replaceAt, withoutRow } from '../projectFormState';

import type { ManpowerRow, ManpowerSlot, ProjectFormState } from '../types';

interface ManpowerSectionProps {
  rows: ManpowerRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (rowIndex: number, slot: ManpowerSlot, file: File) => void;
  onClearDocument: (rowIndex: number, slot: ManpowerSlot) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/** The fields a manpower row keeps in its expanded detail strip. */
const DETAIL_ERROR_KEYS = ['joining_date', 'mobile', 'email', 'relieving_date'];

/**
 * The Manpower tab: the people the project employs.
 *
 * Laid out like the Facility tab and the ledger: the role, name, qualification,
 * profile and salary stay in the table, and the dates and contact details drop
 * into a strip beneath the row, one row open at a time.
 */
const ManpowerSection: React.FC<ManpowerSectionProps> = ({
  rows,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => {
  const { openRow, openOnly, toggleRow } = useSingleExpandedRow(rows.map((row) => row.key));

  // Editing a row is what says which person is being worked on, so its strip
  // is the one showing.
  const updateRow = (index: number, changes: Partial<ManpowerRow>) => {
    openOnly(rows[index].key);
    patch({ manpower: replaceAt(rows, index, changes) });
  };

  const addRow = () => {
    const row = createManpowerRow();
    openOnly(row.key);
    patch({ manpower: [...rows, row] });
  };

  return (
    <SectionCard title="Manpower">
      <div className="pf-table-wrap">
        <table className="pf-table pf-manpower">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-manpower__role">
                Role
              </th>
              <th scope="col" className="pf-manpower__name">
                Name
              </th>
              <th scope="col" className="pf-manpower__qualification">
                Qualification
              </th>
              <th scope="col" className="pf-manpower__profile">
                Profile
              </th>
              <th scope="col" className="pf-table__amount">
                Salary
              </th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const field = `manpower[${index}]`;
              // A row whose hidden fields failed validation opens itself: an
              // error the user cannot see is one they cannot fix.
              const hasDetailError = DETAIL_ERROR_KEYS.some((key) => errors[`${field}.${key}`]);
              const isExpanded = openRow === row.key || hasDetailError;
              const detailId = `${row.key}-detail`;
              const profileError = errors[`${field}.profile`];

              return (
                <React.Fragment key={row.key}>
                  <tr>
                    <td className="pf-table__sno">{index + 1}</td>

                    <td className="pf-manpower__role">
                      <SelectField
                        value={row.role}
                        onChange={(value) => updateRow(index, { role: value })}
                        options={MANPOWER_ROLE_OPTIONS}
                        disabled={disabled}
                        invalid={Boolean(errors[`${field}.role`])}
                        ariaLabel="Role"
                      />
                    </td>

                    <td className="pf-manpower__name">
                      <input
                        type="text"
                        className={`pf-input ${errors[`${field}.name`] ? 'is-invalid' : ''}`.trim()}
                        value={row.name}
                        onChange={(event) => updateRow(index, { name: event.target.value })}
                        disabled={disabled}
                        aria-label="Name"
                      />
                    </td>

                    <td className="pf-manpower__qualification">
                      <input
                        type="text"
                        className="pf-input"
                        value={row.qualification}
                        onChange={(event) =>
                          updateRow(index, { qualification: event.target.value })
                        }
                        disabled={disabled}
                        aria-label="Qualification"
                      />
                    </td>

                    {/* A rejected pick is reported here, under the control that
                        refused it, rather than only in the state. */}
                    <td className="pf-manpower__profile">
                      <DocumentSlotButton
                        label="Profile"
                        slot={row.documents.profile}
                        onSelect={(file) => {
                          openOnly(row.key);
                          onSelectDocument(index, 'profile', file);
                        }}
                        onClear={() => onClearDocument(index, 'profile')}
                        disabled={disabled}
                      />
                      {profileError && <p className="pf-field__error">{profileError}</p>}
                    </td>

                    <td className="pf-table__amount">
                      <AmountInput
                        className={`pf-input pf-input--amount ${errors[`${field}.salary`] ? 'is-invalid' : ''}`.trim()}
                        value={row.salary}
                        onChange={(salary) => updateRow(index, { salary })}
                        disabled={disabled}
                        aria-label="Salary"
                      />
                    </td>

                    <td className="pf-table__actions">
                      <RowActions
                        itemLabel="manpower"
                        leading={
                          <RowExpandToggle
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(row.key)}
                            controls={detailId}
                            detailLabel="joining, contact and relieving details"
                            lockedLabel={
                              hasDetailError
                                ? 'Fix the highlighted details to collapse this row'
                                : undefined
                            }
                          />
                        }
                        onAdd={addRow}
                        showAdd={index === rows.length - 1}
                        addDisabled={rows.length >= MAX_MANPOWER}
                        onRemove={() =>
                          patch({ manpower: withoutRow(rows, index, createManpowerRow) })
                        }
                        disabled={disabled}
                      />
                    </td>
                  </tr>

                  <tr id={detailId} className="pf-ledger__detail-row" hidden={!isExpanded}>
                    <td className="pf-ledger__detail-cell" colSpan={7}>
                      <div className="pf-ledger__detail">
                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label" title="Date of Joining">
                            DoJ
                          </span>
                          <input
                            type="date"
                            className={`pf-input ${errors[`${field}.joining_date`] ? 'is-invalid' : ''}`.trim()}
                            value={row.joiningDate}
                            onChange={(event) =>
                              updateRow(index, { joiningDate: event.target.value })
                            }
                            disabled={disabled}
                            aria-label="Date of joining"
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label">Mobile</span>
                          <input
                            type="tel"
                            className={`pf-input ${errors[`${field}.mobile`] ? 'is-invalid' : ''}`.trim()}
                            value={row.mobile}
                            onChange={(event) => updateRow(index, { mobile: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-manpower__email">
                          <span className="pf-ledger__detail-label">Email</span>
                          <input
                            type="email"
                            className={`pf-input ${errors[`${field}.email`] ? 'is-invalid' : ''}`.trim()}
                            value={row.email}
                            onChange={(event) => updateRow(index, { email: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-manpower__remarks">
                          <input
                            type="text"
                            className="pf-input"
                            value={row.remarks}
                            onChange={(event) => updateRow(index, { remarks: event.target.value })}
                            placeholder="Remarks"
                            disabled={disabled}
                            aria-label="Remarks"
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label" title="Date of Relieving">
                            DOR
                          </span>
                          <input
                            type="date"
                            className={`pf-input ${errors[`${field}.relieving_date`] ? 'is-invalid' : ''}`.trim()}
                            value={row.relievingDate}
                            min={row.joiningDate || undefined}
                            onChange={(event) =>
                              updateRow(index, { relievingDate: event.target.value })
                            }
                            disabled={disabled}
                            aria-label="Date of relieving"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default ManpowerSection;
