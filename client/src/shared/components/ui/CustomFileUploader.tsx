import React, { useRef, useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import { Upload, Trash2, FileText } from 'lucide-react';
import './common.css';

interface CustomFileUploaderProps {
  label?: string;
  name: string;
  onChange: (file: File) => void;
  onDelete?: () => void;
  fileName?: string;
  file?: File | null;
  fileUrl?: string;
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
  file,
  fileUrl,
  accept,
  disabled = false,
  error,
  className = '',
  buttonText = "Upload File"
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Create object URL for file preview
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onChange(selectedFile);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileClick = () => {
    const url = previewUrl || fileUrl;
    if (url) {
      try {
        const urlObj = new URL(url, window.location.origin);
        if (!['http:', 'https:', 'blob:'].includes(urlObj.protocol)) {
          console.error('Unsafe URL protocol:', urlObj.protocol);
          return;
        }
      } catch (e) {
        console.error('Invalid URL:', url);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
          onClick={handleButtonClick}
          disabled={disabled}
          className="d-flex align-items-center gap-2"
          style={{
            backgroundColor: disabled ? '#b3d9ff' : '#0069ab',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            fontSize: '1rem',
            borderRadius: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.target as HTMLButtonElement).style.backgroundColor = '#005492';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              (e.target as HTMLButtonElement).style.backgroundColor = '#0069ab';
            }
          }}
        >
          <Upload size={16} />
          {buttonText}
        </Button>

        {fileName ? (
          <div
            className="d-flex align-items-center gap-2 p-2 border rounded bg-light"
            style={{ maxWidth: '180px', overflow: 'hidden' }}
          >
            <FileText size={16} className="text-muted flex-shrink-0" />
            <span
              className="text-truncate"
              style={{
                cursor: (previewUrl || fileUrl) ? 'pointer' : 'default',
                color: (previewUrl || fileUrl) ? '#0069ab' : 'inherit',
              }}
              title={fileName}
              onClick={handleFileClick}
            >
              {fileName}
            </span>
            {onDelete && !disabled && (
              <Button
                variant="link"
                size="sm"
                className="text-danger p-0 flex-shrink-0"
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