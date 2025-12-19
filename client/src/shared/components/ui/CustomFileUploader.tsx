import React, { useRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import { Upload, Trash2, FileText } from 'lucide-react';
import './common.css';

interface CustomFileUploaderProps {
  label?: string;
  name: string;
  onChange: (file: File) => void;
  onDelete?: () => void;
  fileName?: string;
  accept?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  buttonText?: string;
}

const CustomFileUploader: React.FC<CustomFileUploaderProps> = ({
  label,
  name,
  onChange,
  onDelete,
  fileName,
  accept,
  disabled = false,
  error,
  className = '',
  buttonText = "Upload File"
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Form.Group className={`custom-input-group ${className}`} controlId={name}>
      {label && <Form.Label className="custom-label">{label}</Form.Label>}

      <div className="d-flex align-items-center gap-3">
        <input
          type="file"
          ref={fileInputRef}
          name={name}
          onChange={handleFileChange}
          accept={accept}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <Button
          variant="secondary"
          onClick={handleButtonClick}
          disabled={disabled}
          className="d-flex align-items-center gap-2"
        >
          <Upload size={16} />
          {buttonText}
        </Button>

        {fileName ? (
          <div className="d-flex align-items-center gap-2 p-2 border rounded bg-light flex-grow-1">
            <FileText size={16} className="text-muted" />
            <span className="text-truncate" style={{ maxWidth: '200px' }} title={fileName}>
              {fileName}
            </span>
            {onDelete && !disabled && (
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0 ms-auto"
                onClick={onDelete}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ) : (
          <span className="text-muted small">No file selected</span>
        )}
      </div>

      <Form.Control.Feedback type="invalid" className="custom-error-text d-block">
        {error}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

export default CustomFileUploader;