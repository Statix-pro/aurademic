import React from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import RowExpandToggle from '../components/RowExpandToggle';
import SectionCard from '../components/SectionCard';
import { useSingleExpandedRow } from '../components/useSingleExpandedRow';
import { IPR_STATUS_OPTIONS, IPR_TYPE_OPTIONS, MAX_OUTCOME_ROWS } from '../constants';
import { createIprRow, replaceAt, withoutRow } from '../projectFormState';

import type { IprRow, ProjectFormState } from '../types';

interface IprsSectionProps {
  rows: IprRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/** The fields an IPR row keeps in its expanded detail strip. */
const DETAIL_ERROR_KEYS = ['filing_date', 'grant_date'];

/**
 * The Outcomes tab's IPRs. There is no registry to fetch an IPR's details
 * from, so the status is picked and the title and dates are typed into the
 * row's strip.
 */
const IprsSection: React.FC<IprsSectionProps> = ({ rows, patch, errors, disabled }) => {
  const { openRow, openOnly, toggleRow } = useSingleExpandedRow(rows.map((row) => row.key));

  const updateRow = (index: number, changes: Partial<IprRow>) => {
    openOnly(rows[index].key);
    patch({ iprs: replaceAt(rows, index, changes) });
  };

  const addRow = () => {
    const row = createIprRow();
    openOnly(row.key);
    patch({ iprs: [...rows, row] });
  };

  return (
    <SectionCard title="IPR">
      <div className="pf-table-wrap">
        <table className="pf-table pf-outcome-table">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-outcome-table__type">
                Type
              </th>
              <th scope="col">IPR Number</th>
              <th scope="col" className="pf-outcome-table__status">
                Status
              </th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const field = `iprs[${index}]`;
              const hasDetailError = DETAIL_ERROR_KEYS.some((key) => errors[`${field}.${key}`]);
              const isExpanded = openRow === row.key || hasDetailError;
              const detailId = `${row.key}-detail`;

              return (
                <React.Fragment key={row.key}>
                  <tr>
                    <td className="pf-table__sno">{index + 1}</td>

                    <td className="pf-outcome-table__type">
                      <SelectField
                        value={row.iprType}
                        onChange={(value) => updateRow(index, { iprType: value })}
                        options={IPR_TYPE_OPTIONS}
                        disabled={disabled}
                        invalid={Boolean(errors[`${field}.ipr_type`])}
                        ariaLabel="IPR type"
                      />
                    </td>

                    <td>
                      <input
                        type="text"
                        className={`pf-input ${errors[`${field}.ipr_number`] ? 'is-invalid' : ''}`.trim()}
                        value={row.iprNumber}
                        onChange={(event) => updateRow(index, { iprNumber: event.target.value })}
                        disabled={disabled}
                        aria-label="IPR number"
                      />
                    </td>

                    <td className="pf-outcome-table__status">
                      <SelectField
                        value={row.status}
                        onChange={(value) => updateRow(index, { status: value })}
                        options={IPR_STATUS_OPTIONS}
                        disabled={disabled}
                        invalid={Boolean(errors[`${field}.status`])}
                        ariaLabel="IPR status"
                      />
                    </td>

                    <td className="pf-table__actions">
                      <RowActions
                        itemLabel="IPR"
                        leading={
                          <RowExpandToggle
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(row.key)}
                            controls={detailId}
                            detailLabel="title and dates"
                            lockedLabel={
                              hasDetailError ? 'Fix the dates to collapse this row' : undefined
                            }
                          />
                        }
                        onAdd={addRow}
                        showAdd={index === rows.length - 1}
                        addDisabled={rows.length >= MAX_OUTCOME_ROWS}
                        onRemove={() => patch({ iprs: withoutRow(rows, index, createIprRow) })}
                        disabled={disabled}
                      />
                    </td>
                  </tr>

                  <tr id={detailId} className="pf-ledger__detail-row" hidden={!isExpanded}>
                    <td className="pf-ledger__detail-cell" colSpan={5}>
                      <div className="pf-ledger__detail">
                        <label className="pf-ledger__detail-field pf-ledger__detail-field--wide">
                          <span className="pf-ledger__detail-label">Title</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.title}
                            onChange={(event) => updateRow(index, { title: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label">Filing Date</span>
                          <input
                            type="date"
                            className={`pf-input ${errors[`${field}.filing_date`] ? 'is-invalid' : ''}`.trim()}
                            value={row.filingDate}
                            onChange={(event) =>
                              updateRow(index, { filingDate: event.target.value })
                            }
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact">
                          <span className="pf-ledger__detail-label">Grant Date</span>
                          <input
                            type="date"
                            className={`pf-input ${errors[`${field}.grant_date`] ? 'is-invalid' : ''}`.trim()}
                            value={row.grantDate}
                            min={row.filingDate || undefined}
                            onChange={(event) =>
                              updateRow(index, { grantDate: event.target.value })
                            }
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

export default IprsSection;
