import React from 'react';

import DocumentSlotField from '../components/DocumentSlotField';
import SectionCard from '../components/SectionCard';
import { FINAL_DOCUMENT_TYPES, PROJECT_DOCUMENT_LABELS } from '../constants';

import type { ProjectDocumentType, ProjectFormState } from '../types';

interface FinalDocumentsSectionProps {
  form: ProjectFormState;
  onSelectDocument: (type: ProjectDocumentType, file: File) => void;
  onClearDocument: (type: ProjectDocumentType) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

const FinalDocumentsSection: React.FC<FinalDocumentsSectionProps> = ({
  form,
  onSelectDocument,
  onClearDocument,
  errors,
  disabled,
}) => (
  <SectionCard title="Final Documents">
    <div className="pf-document-grid">
      {FINAL_DOCUMENT_TYPES.map((documentType) => (
        <DocumentSlotField
          key={documentType}
          label={PROJECT_DOCUMENT_LABELS[documentType]}
          slot={form.documents[documentType]}
          onSelect={(file) => onSelectDocument(documentType, file)}
          onClear={() => onClearDocument(documentType)}
          disabled={disabled}
          error={errors[`document__${documentType}`]}
        />
      ))}
    </div>
  </SectionCard>
);

export default FinalDocumentsSection;
