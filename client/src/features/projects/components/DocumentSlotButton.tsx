import { FileCheck2, FileUp, X } from 'lucide-react';
import React, { useRef } from 'react';

import { DOCUMENT_ACCEPT } from '../constants';
import projectsApi from '../projectsApi';

import type { DocumentSlotState } from '../types';

interface DocumentSlotButtonProps {
  label: string;
  slot: DocumentSlotState;
  onSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

/**
 * Compact upload control for the grant-disbursement table, where each tranche
 * has three document cells. An empty cell shows an upload icon; a filled one
 * turns green, links to the file, and offers a clear button.
 */
const DocumentSlotButton: React.FC<DocumentSlotButtonProps> = ({
  label,
  slot,
  onSelect,
  onClear,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onSelect(file);
  };

  const isStored = Boolean(slot.filePath) && !slot.removed;
  const hasFile = Boolean(slot.file) || isStored;
  const title = slot.file
    ? `${label}: ${slot.file.name}`
    : isStored
      ? `${label} uploaded`
      : `Upload ${label}`;

  return (
    <div className="pf-slot-button">
      {isStored && !slot.file ? (
        <a
          className="pf-icon-btn pf-icon-btn--success"
          href={projectsApi.fileUrl(slot.filePath)}
          target="_blank"
          rel="noopener noreferrer"
          title={title}
          aria-label={title}
        >
          <FileCheck2 size={18} aria-hidden="true" />
        </a>
      ) : (
        <button
          type="button"
          className={`pf-icon-btn ${hasFile ? 'pf-icon-btn--success' : ''}`.trim()}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          title={title}
          aria-label={title}
        >
          {hasFile ? (
            <FileCheck2 size={18} aria-hidden="true" />
          ) : (
            <FileUp size={18} aria-hidden="true" />
          )}
        </button>
      )}

      {hasFile && !disabled && (
        <button
          type="button"
          className="pf-slot-button__clear"
          onClick={onClear}
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}

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

export default DocumentSlotButton;
