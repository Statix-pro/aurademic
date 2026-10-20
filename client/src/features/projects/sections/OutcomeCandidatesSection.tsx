import React from 'react';

import DocumentSlotButton from '../components/DocumentSlotButton';
import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import { CANDIDATE_DEGREE_OPTIONS, MAX_OUTCOME_ROWS } from '../constants';
import { createOutcomeCandidateRow, replaceAt, withoutRow } from '../projectFormState';

import type { OutcomeCandidateRow, OutcomeDocumentSlot, ProjectFormState } from '../types';

interface OutcomeCandidatesSectionProps {
  rows: OutcomeCandidateRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (rowIndex: number, slot: OutcomeDocumentSlot, file: File) => void;
  onClearDocument: (rowIndex: number, slot: OutcomeDocumentSlot) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * The Outcomes tab's Manpower table: people who earned a degree or completed a
 * fellowship through the project. A separate list from the staff on the
 * Manpower tab — being paid by a project and graduating from it are different
 * outcomes, and one person can appear in both.
 */
const OutcomeCandidatesSection: React.FC<OutcomeCandidatesSectionProps> = ({
  rows,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => (
  <SectionCard title="Manpower">
    <div className="pf-table-wrap">
      <table className="pf-table pf-outcome-table">
        <thead>
          <tr>
            <th scope="col" className="pf-table__sno">
              S.No.
            </th>
            <th scope="col" className="pf-outcome-table__candidate">
              Candidate Name
            </th>
            <th scope="col" className="pf-outcome-table__degree">
              Degree
            </th>
            <th scope="col">University</th>
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
            const field = `outcome_candidates[${index}]`;
            const documentError = errors[`${field}.document`];

            return (
              <tr key={row.key}>
                <td className="pf-table__sno">{index + 1}</td>

                <td className="pf-outcome-table__candidate">
                  <input
                    type="text"
                    className={`pf-input ${errors[`${field}.candidate_name`] ? 'is-invalid' : ''}`.trim()}
                    value={row.candidateName}
                    onChange={(event) =>
                      patch({
                        outcomeCandidates: replaceAt(rows, index, {
                          candidateName: event.target.value,
                        }),
                      })
                    }
                    disabled={disabled}
                    aria-label="Candidate name"
                  />
                </td>

                <td className="pf-outcome-table__degree">
                  <SelectField
                    value={row.degree}
                    onChange={(value) =>
                      patch({ outcomeCandidates: replaceAt(rows, index, { degree: value }) })
                    }
                    options={CANDIDATE_DEGREE_OPTIONS}
                    disabled={disabled}
                    invalid={Boolean(errors[`${field}.degree`])}
                    ariaLabel="Degree"
                  />
                </td>

                <td>
                  <input
                    type="text"
                    className="pf-input"
                    value={row.university}
                    onChange={(event) =>
                      patch({
                        outcomeCandidates: replaceAt(rows, index, {
                          university: event.target.value,
                        }),
                      })
                    }
                    disabled={disabled}
                    aria-label="University"
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
                    itemLabel="candidate"
                    onAdd={() =>
                      patch({ outcomeCandidates: [...rows, createOutcomeCandidateRow()] })
                    }
                    showAdd={index === rows.length - 1}
                    addDisabled={rows.length >= MAX_OUTCOME_ROWS}
                    onRemove={() =>
                      patch({
                        outcomeCandidates: withoutRow(rows, index, createOutcomeCandidateRow),
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

export default OutcomeCandidatesSection;
