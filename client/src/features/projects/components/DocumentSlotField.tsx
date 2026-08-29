import { FileText, Trash2, Upload } from 'lucide-react';
import React, { useRef } from 'react';

import { DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from '../constants';
import projectsApi from '../projectsApi';

import type { DocumentSlotState } from '../types';

interface DocumentSlotFieldProps {
  label: string;
  slot: DocumentSlotState;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  error?: string;
}

/** KB below a megabyte, so a small file does not read as "0.0 MB". */
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/**
 * The upload card used for the presentation, sanction order and final
 * documents: a label, the PDF/size hint, and either a "Choose File" button or
 * the stored file with links to open or clear it.
 */
const DocumentSlotField: React.FC<DocumentSlotFieldProps> = ({
  label,
  slot,
  onSelect,
  onClear,
  disabled = false,
  error,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so re-picking the same file still fires a change event.
    event.target.value = '';
    if (file) onSelect(file);
  };

  const storedName = slot.originalName || slot.filePath.split('/').pop() || '';
  const hasFile = Boolean(slot.file) || (Boolean(slot.filePath) && !slot.removed);

  return (
    <div className={`pf-document ${error ? 'pf-document--invalid' : ''}`.trim()}>
      <FileText className="pf-document__icon" size={30} aria-hidden="true" />

      <div className="pf-document__text">
        <span className="pf-document__label">{label}</span>

        {slot.file ? (
          <span className="pf-document__meta" title={slot.file.name}>
            {slot.file.name} · {formatSize(slot.file.size)}
          </span>
        ) : hasFile ? (
          <a
            className="pf-document__meta pf-document__link"
            href={projectsApi.fileUrl(slot.filePath)}
            target="_blank"
            rel="noopener noreferrer"
            title={storedName}
          >
            {storedName || 'View uploaded file'}
          </a>
        ) : (
          <span className="pf-document__meta">PDF (Maximum {formatSize(MAX_DOCUMENT_BYTES)})</span>
        )}

        {error && <span className="pf-document__error">{error}</span>}
      </div>

      <div className="pf-document__actions">
        <button
          type="button"
          className="pf-btn pf-btn--primary"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Upload size={16} aria-hidden="true" />
          {hasFile ? 'Replace' : 'Choose File'}
        </button>

        {hasFile && (
          <button
            type="button"
            className="pf-icon-btn pf-icon-btn--danger"
            onClick={onClear}
            disabled={disabled}
            aria-label={`Remove ${label}`}
            title={`Remove ${label}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="pf-visually-hidden"
        accept={DOCUMENT_ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        tabIndex={-1}
      />
    </div>
  );
};

export default DocumentSlotField;
