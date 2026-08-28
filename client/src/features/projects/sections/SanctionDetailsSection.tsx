import React from 'react';

import DocumentSlotField from '../components/DocumentSlotField';
import SectionCard from '../components/SectionCard';
import { PROJECT_DOCUMENT_LABELS, SANCTION_MODE_OPTIONS } from '../constants';

import type { ProjectDocumentType, ProjectFormState, SanctionMode } from '../types';

interface SanctionDetailsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (type: ProjectDocumentType, file: File) => void;
  onClearDocument: (type: ProjectDocumentType) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const SanctionDetailsSection: React.FC<SanctionDetailsSectionProps> = ({
  form,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => (
  <SectionCard title="Sanction Details">
    <div className="pf-sanction">
      <div className="pf-sanction__fields">
        <div className="pf-inline-grid">
          <div className="pf-inline-field">
            <label className="pf-inline-field__label" htmlFor="pf-sanction-date">
              Date
            </label>
            <input
              id="pf-sanction-date"
              type="date"
              className={`pf-input ${errors.sanction_date ? 'is-invalid' : ''}`.trim()}
              value={form.sanctionDate}
              onChange={(event) => patch({ sanctionDate: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div className="pf-inline-field pf-inline-field--grow">
            <label className="pf-inline-field__label" htmlFor="pf-sanction-ref">
              Ref. No.
            </label>
            <input
              id="pf-sanction-ref"
              type="text"
              className="pf-input"
              value={form.sanctionReferenceNo}
              onChange={(event) => patch({ sanctionReferenceNo: event.target.value })}
              disabled={disabled}
            />
          </div>
        </div>

        {/* A div rather than a fieldset: a <legend> is laid out outside its
            fieldset's box, so it cannot sit on the same line as the radios. */}
        <div className="pf-inline-field" role="radiogroup" aria-labelledby="pf-sanction-mode">
          <span className="pf-inline-field__label" id="pf-sanction-mode">
            Mode
          </span>
          <div className="pf-radio-group">
            {SANCTION_MODE_OPTIONS.map((option) => (
              <label className="pf-radio" key={option.value}>
                <input
                  type="radio"
                  name="sanctionMode"
                  value={option.value}
                  checked={form.sanctionMode === option.value}
                  onChange={() => patch({ sanctionMode: option.value as SanctionMode })}
                  disabled={disabled}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <DocumentSlotField
        label={PROJECT_DOCUMENT_LABELS.sanction_order}
        slot={form.documents.sanction_order}
        onSelect={(file) => onSelectDocument('sanction_order', file)}
        onClear={() => onClearDocument('sanction_order')}
        disabled={disabled}
        error={errors['document__sanction_order']}
      />
    </div>
  </SectionCard>
);

export default SanctionDetailsSection;
