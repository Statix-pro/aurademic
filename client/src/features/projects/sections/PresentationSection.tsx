import React from 'react';

import DocumentSlotField from '../components/DocumentSlotField';
import SectionCard from '../components/SectionCard';
import { PROJECT_DOCUMENT_LABELS } from '../constants';

import type { ProjectDocumentType, ProjectFormState } from '../types';

interface PresentationSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  onSelectDocument: (type: ProjectDocumentType, file: File) => void;
  onClearDocument: (type: ProjectDocumentType) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const PresentationSection: React.FC<PresentationSectionProps> = ({
  form,
  patch,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => (
  <SectionCard
    title="Presentation"
    toggle={{
      checked: form.presentationEnabled,
      onChange: (checked) => patch({ presentationEnabled: checked }),
      label: 'Enable presentation details',
      disabled,
    }}
  >
    <div className="pf-presentation">
      <div className="pf-presentation__fields">
        <div className="pf-inline-grid">
          <div className="pf-inline-field">
            <label className="pf-inline-field__label" htmlFor="pf-presentation-date">
              Date
            </label>
            <input
              id="pf-presentation-date"
              type="date"
              className={`pf-input ${errors.presentation_date ? 'is-invalid' : ''}`.trim()}
              value={form.presentationDate}
              onChange={(event) => patch({ presentationDate: event.target.value })}
              disabled={disabled}
            />
          </div>

          <div className="pf-inline-field pf-inline-field--grow">
            <label className="pf-inline-field__label" htmlFor="pf-presentation-venue">
              Venue
            </label>
            <input
              id="pf-presentation-venue"
              type="text"
              className="pf-input"
              value={form.presentationVenue}
              onChange={(event) => patch({ presentationVenue: event.target.value })}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="pf-inline-field pf-inline-field--grow">
          <label className="pf-inline-field__label" htmlFor="pf-panelists">
            Panelists
          </label>
          <input
            id="pf-panelists"
            type="text"
            className="pf-input"
            placeholder="Separate names with commas"
            value={form.presentationPanelists}
            onChange={(event) => patch({ presentationPanelists: event.target.value })}
            disabled={disabled}
          />
        </div>
      </div>

      <DocumentSlotField
        label={PROJECT_DOCUMENT_LABELS.presentation}
        slot={form.documents.presentation}
        onSelect={(file) => onSelectDocument('presentation', file)}
        onClear={() => onClearDocument('presentation')}
        disabled={disabled}
        error={errors['document__presentation']}
      />
    </div>
  </SectionCard>
);

export default PresentationSection;
