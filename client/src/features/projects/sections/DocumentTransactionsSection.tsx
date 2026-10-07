import React from 'react';

import DocumentSlotButton from '../components/DocumentSlotButton';
import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import {
  DOCUMENT_TRANSACTION_DIRECTION_OPTIONS,
  DOCUMENT_TRANSACTION_KIND_OPTIONS,
  MAX_OUTCOME_ROWS,
} from '../constants';
import { createDocumentTransactionRow, replaceAt, withoutRow } from '../projectFormState';

import type { DocumentTransactionRow, OutcomeDocumentSlot, ProjectFormState } from '../types';

interface DocumentTransactionsSectionProps {
  rows: DocumentTransactionRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (rowIndex: number, slot: OutcomeDocumentSlot, file: File) => void;
  onClearDocument: (rowIndex: number, slot: OutcomeDocumentSlot) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const directionOfKind = (kind: string) =>
  DOCUMENT_TRANSACTION_KIND_OPTIONS.find((option) => option.value === kind)?.direction ?? '';

/**
 * The Documents tab's correspondence log: what came in from the agency and
 * what went out to it, when, how it was sent, and a scanned copy.
 *
 * Each document kind travels one way only, so the two dropdowns keep each
 * other honest: picking a direction narrows the documents to that group, and
 * picking a document fills in its direction.
 */
const DocumentTransactionsSection: React.FC<DocumentTransactionsSectionProps> = ({
  rows,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => {
  const updateRow = (index: number, changes: Partial<DocumentTransactionRow>) =>
    patch({ documentTransactions: replaceAt(rows, index, changes) });

  return (
    <SectionCard title="Document Transaction">
      <div className="pf-table-wrap">
        <table className="pf-table pf-outcome-table pf-doc-transactions">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-doc-transactions__date">
                Date
              </th>
              <th scope="col" className="pf-doc-transactions__direction">
                Transaction
              </th>
              <th scope="col" className="pf-outcome-table__type">
                Document
              </th>
              <th scope="col">Description</th>
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
              const field = `document_transactions[${index}]`;
              const documentError = errors[`${field}.document`];
              const kindOptions = row.direction
                ? DOCUMENT_TRANSACTION_KIND_OPTIONS.filter(
                    (option) => option.direction === row.direction,
                  )
                : DOCUMENT_TRANSACTION_KIND_OPTIONS;

              return (
                <tr key={row.key}>
                  <td className="pf-table__sno">{index + 1}</td>

                  <td className="pf-doc-transactions__date">
                    <input
                      type="date"
                      className={`pf-input ${errors[`${field}.transaction_date`] ? 'is-invalid' : ''}`.trim()}
                      value={row.transactionDate}
                      onChange={(event) =>
                        updateRow(index, { transactionDate: event.target.value })
                      }
                      disabled={disabled}
                      aria-label="Date"
                    />
                  </td>

                  <td className="pf-doc-transactions__direction">
                    <SelectField
                      value={row.direction}
                      onChange={(direction) =>
                        updateRow(index, {
                          direction,
                          // A document that does not travel this way is no
                          // longer a valid pick, so it is cleared rather than
                          // left to fail the save.
                          ...(row.documentKind && directionOfKind(row.documentKind) !== direction
                            ? { documentKind: '' }
                            : {}),
                        })
                      }
                      options={DOCUMENT_TRANSACTION_DIRECTION_OPTIONS}
                      disabled={disabled}
                      invalid={Boolean(errors[`${field}.direction`])}
                      ariaLabel="Transaction"
                    />
                  </td>

                  <td className="pf-outcome-table__type">
                    <SelectField
                      value={row.documentKind}
                      onChange={(documentKind) =>
                        updateRow(index, {
                          documentKind,
                          direction: directionOfKind(documentKind) || row.direction,
                        })
                      }
                      options={kindOptions}
                      disabled={disabled}
                      invalid={Boolean(errors[`${field}.document_kind`])}
                      ariaLabel="Document"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="pf-input"
                      value={row.description}
                      onChange={(event) => updateRow(index, { description: event.target.value })}
                      placeholder="Mail / Courier | Ref. No."
                      disabled={disabled}
                      aria-label="Description"
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
                      itemLabel="document transaction"
                      onAdd={() =>
                        patch({
                          documentTransactions: [...rows, createDocumentTransactionRow()],
                        })
                      }
                      showAdd={index === rows.length - 1}
                      addDisabled={rows.length >= MAX_OUTCOME_ROWS}
                      onRemove={() =>
                        patch({
                          documentTransactions: withoutRow(
                            rows,
                            index,
                            createDocumentTransactionRow,
                          ),
                        })
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
};

export default DocumentTransactionsSection;
