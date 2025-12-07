import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Form, Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTrashAlt, faFile } from '@fortawesome/free-solid-svg-icons';
import './common.css';

const CustomFileUploader = ({
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
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onChange(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
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
          <FontAwesomeIcon icon={faUpload} />
          {buttonText}
        </Button>

        {fileName ? (
          <div className="d-flex align-items-center gap-2 p-2 border rounded bg-light flex-grow-1">
             <FontAwesomeIcon icon={faFile} className="text-muted" />
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
                 <FontAwesomeIcon icon={faTrashAlt} />
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

CustomFileUploader.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  fileName: PropTypes.string,
  accept: PropTypes.string,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  className: PropTypes.string,
  buttonText: PropTypes.string,
};

export default CustomFileUploader;
