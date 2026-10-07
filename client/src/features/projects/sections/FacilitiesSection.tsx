import React from 'react';

import { AmountInput, SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import RowExpandToggle from '../components/RowExpandToggle';
import SectionCard from '../components/SectionCard';
import { useSingleExpandedRow } from '../components/useSingleExpandedRow';
import { FACILITY_TYPE_OPTIONS, MAX_FACILITIES } from '../constants';
import { createFacilityRow, replaceAt, withoutRow } from '../projectFormState';

import type { FacilityRow, ProjectFormState } from '../types';

interface FacilitiesSectionProps {
  rows: FacilityRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/** The fields a facility row keeps in its expanded detail strip. */
const DETAIL_ERROR_KEYS = ['istem_id'];

/**
 * The Facility tab: the equipment and software the project set up.
 *
 * Each row is laid out like a ledger row: what a reader scans down the list —
 * the name, type, date and cost — stays in the table, and the make, model,
 * stock-register entry, I-STEM listing and supplier drop into a strip beneath
 * it. The strip reuses the ledger's `pf-ledger__detail*` styles so the two tabs
 * read as one form.
 */
const FacilitiesSection: React.FC<FacilitiesSectionProps> = ({ rows, patch, errors, disabled }) => {
  const { openRow, openOnly, toggleRow } = useSingleExpandedRow(rows.map((row) => row.key));

  // Editing a row is what says which facility is being worked on, so its strip
  // is the one showing.
  const updateRow = (index: number, changes: Partial<FacilityRow>) => {
    openOnly(rows[index].key);
    patch({ facilities: replaceAt(rows, index, changes) });
  };

  const addRow = () => {
    const row = createFacilityRow();
    openOnly(row.key);
    patch({ facilities: [...rows, row] });
  };

  return (
    <SectionCard title="Facility Details">
      <div className="pf-table-wrap">
        <table className="pf-table pf-facility">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-facility__name">
                Facility Name
              </th>
              <th scope="col" className="pf-facility__type">
                Type
              </th>
              <th scope="col" className="pf-facility__date">
                Installation Date
              </th>
              <th scope="col" className="pf-table__amount">
                Cost
              </th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const field = `facilities[${index}]`;
              // A row whose hidden fields failed validation opens itself: an
              // error the user cannot see is one they cannot fix.
              const hasDetailError = DETAIL_ERROR_KEYS.some((key) => errors[`${field}.${key}`]);
              const isExpanded = openRow === row.key || hasDetailError;
              const detailId = `${row.key}-detail`;

              return (
                <React.Fragment key={row.key}>
                  <tr>
                    <td className="pf-table__sno">{index + 1}</td>

                    <td className="pf-facility__name">
                      <input
                        type="text"
                        className={`pf-input ${errors[`${field}.facility_name`] ? 'is-invalid' : ''}`.trim()}
                        value={row.facilityName}
                        onChange={(event) => updateRow(index, { facilityName: event.target.value })}
                        disabled={disabled}
                        aria-label="Facility name"
                      />
                    </td>

                    <td className="pf-facility__type">
                      <SelectField
                        value={row.facilityType}
                        onChange={(value) => updateRow(index, { facilityType: value })}
                        options={FACILITY_TYPE_OPTIONS}
                        disabled={disabled}
                        invalid={Boolean(errors[`${field}.facility_type`])}
                        ariaLabel="Facility type"
                      />
                    </td>

                    <td className="pf-facility__date">
                      <input
                        type="date"
                        className={`pf-input ${errors[`${field}.installation_date`] ? 'is-invalid' : ''}`.trim()}
                        value={row.installationDate}
                        onChange={(event) =>
                          updateRow(index, { installationDate: event.target.value })
                        }
                        disabled={disabled}
                        aria-label="Installation date"
                      />
                    </td>

                    <td className="pf-table__amount">
                      <AmountInput
                        className={`pf-input pf-input--amount ${errors[`${field}.cost`] ? 'is-invalid' : ''}`.trim()}
                        value={row.cost}
                        onChange={(cost) => updateRow(index, { cost })}
                        disabled={disabled}
                        aria-label="Cost"
                      />
                    </td>

                    <td className="pf-table__actions">
                      <RowActions
                        itemLabel="facility"
                        leading={
                          <RowExpandToggle
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(row.key)}
                            controls={detailId}
                            detailLabel="facility details"
                            lockedLabel={
                              hasDetailError ? 'Fix the I-STEM ID to collapse this row' : undefined
                            }
                          />
                        }
                        onAdd={addRow}
                        showAdd={index === rows.length - 1}
                        addDisabled={rows.length >= MAX_FACILITIES}
                        onRemove={() =>
                          patch({ facilities: withoutRow(rows, index, createFacilityRow) })
                        }
                        disabled={disabled}
                      />
                    </td>
                  </tr>

                  <tr id={detailId} className="pf-ledger__detail-row" hidden={!isExpanded}>
                    <td className="pf-ledger__detail-cell" colSpan={6}>
                      <div className="pf-ledger__detail pf-facility__detail">
                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label">Make</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.make}
                            onChange={(event) => updateRow(index, { make: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label">Model</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.model}
                            onChange={(event) => updateRow(index, { model: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact pf-facility__serial">
                          <span className="pf-ledger__detail-label">S.No.</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.serialNo}
                            onChange={(event) => updateRow(index, { serialNo: event.target.value })}
                            disabled={disabled}
                            aria-label="Serial number"
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact pf-facility__stock">
                          <span className="pf-ledger__detail-label">Stock Register</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.stockRegisterRef}
                            onChange={(event) =>
                              updateRow(index, { stockRegisterRef: event.target.value })
                            }
                            placeholder="S.No. & Page No."
                            disabled={disabled}
                          />
                        </label>

                        {/* The switch says whether the facility is on I-STEM;
                            the ID box beside it opens only while it is, and
                            switching off clears the ID — the server drops it
                            anyway, so leaving it in a disabled box would show
                            a value that is never saved. */}
                        <div className="pf-ledger__detail-field pf-ledger__detail-field--compact pf-facility__istem">
                          <span className="pf-ledger__detail-label">I-STEM ID</span>
                          <div className="form-check form-switch pf-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={row.istemListed}
                              onChange={(event) =>
                                updateRow(index, {
                                  istemListed: event.target.checked,
                                  ...(event.target.checked ? {} : { istemId: '' }),
                                })
                              }
                              disabled={disabled}
                              aria-label="Listed on I-STEM"
                            />
                          </div>
                          <input
                            type="text"
                            className={`pf-input ${errors[`${field}.istem_id`] ? 'is-invalid' : ''}`.trim()}
                            value={row.istemId}
                            onChange={(event) => updateRow(index, { istemId: event.target.value })}
                            disabled={disabled || !row.istemListed}
                            aria-label="I-STEM ID"
                          />
                        </div>
                      </div>

                      <div className="pf-ledger__detail pf-facility__supplier-line">
                        <label className="pf-ledger__detail-field pf-ledger__detail-field--wide">
                          <span className="pf-ledger__detail-label">Supplier Details</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.supplierDetails}
                            onChange={(event) =>
                              updateRow(index, { supplierDetails: event.target.value })
                            }
                            placeholder="Supplier Name, Address, Email & Mobile"
                            disabled={disabled}
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

export default FacilitiesSection;
