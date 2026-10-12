import React from 'react';

import DocumentSlotButton from '../components/DocumentSlotButton';
import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import { MAX_OUTCOME_ROWS, TECH_TRANSFER_CATEGORY_OPTIONS, TRL_OPTIONS } from '../constants';
import { createTechTransferRow, replaceAt, withoutRow } from '../projectFormState';

import type { OutcomeDocumentSlot, ProjectFormState, TechTransferRow } from '../types';

interface TechTransfersSectionProps {
  rows: TechTransferRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (rowIndex: number, slot: OutcomeDocumentSlot, file: File) => void;
  onClearDocument: (rowIndex: number, slot: OutcomeDocumentSlot) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * The Outcomes tab's technology transfers: what came out of the project, how
 * ready it is, and a supporting document. Every field fits the row, so there
 * is no detail strip.
 */
const TechTransfersSection: React.FC<TechTransfersSectionProps> = ({
  rows,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => (
  <SectionCard title="Technology Transfer">
    <div className="pf-table-wrap">
      <table className="pf-table pf-outcome-table">
        <thead>
          <tr>
            <th scope="col" className="pf-table__sno">
              S.No.
            </th>
            <th scope="col" className="pf-outcome-table__type">
              Category
            </th>
            <th scope="col">Description</th>
            <th scope="col" className="pf-outcome-table__trl">
              TRL
            </th>
            <th scope="col" className="pf-outcome-table__document">
              Document
            </th>
            <th scope="col" className="pf-outcome-table__actions">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => {
            const field = `tech_transfers[${index}]`;
            const documentError = errors[`${field}.document`];

            return (
              <tr key={row.key}>
                <td className="pf-table__sno">{index + 1}</td>

                <td className="pf-outcome-table__type">
                  <SelectField
                    value={row.category}
                    onChange={(value) =>
                      patch({ techTransfers: replaceAt(rows, index, { category: value }) })
                    }
                    options={TECH_TRANSFER_CATEGORY_OPTIONS}
                    disabled={disabled}
                    invalid={Boolean(errors[`${field}.category`])}
                    ariaLabel="Category"
                  />
                </td>

                <td>
                  <input
                    type="text"
                    className="pf-input"
                    value={row.description}
                    onChange={(event) =>
                      patch({
                        techTransfers: replaceAt(rows, index, { description: event.target.value }),
                      })
                    }
                    disabled={disabled}
                    aria-label="Description"
                  />
                </td>

                <td className="pf-outcome-table__trl">
                  <SelectField
                    value={row.trl}
                    onChange={(value) =>
                      patch({ techTransfers: replaceAt(rows, index, { trl: value }) })
                    }
                    options={TRL_OPTIONS}
                    disabled={disabled}
                    invalid={Boolean(errors[`${field}.trl`])}
                    ariaLabel="Technology readiness level"
                  />
                </td>

                <td className="pf-outcome-table__document">
                  <DocumentSlotButton
                    label="Document"
                    slot={row.documents.document}
                    onSelect={(file) => onSelectDocument(index, 'document', file)}
                    onClear={() => onClearDocument(index, 'document')}
                    disabled={disabled}
                  />
                  {documentError && <p className="pf-field__error">{documentError}</p>}
                </td>

                <td className="pf-outcome-table__actions">
                  <RowActions
                    itemLabel="technology transfer"
                    onAdd={() => patch({ techTransfers: [...rows, createTechTransferRow()] })}
                    showAdd={index === rows.length - 1}
                    addDisabled={rows.length >= MAX_OUTCOME_ROWS}
                    onRemove={() =>
                      patch({ techTransfers: withoutRow(rows, index, createTechTransferRow) })
                    }
                    disabled={disabled}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </SectionCard>
);

export default TechTransfersSection;
