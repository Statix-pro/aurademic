import React from 'react';
import { Form } from 'react-bootstrap';
import './common.css';

interface CustomInputProps {
  label?: string;
  name: string;
  type?: string;
  value?: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  as?: React.ElementType;
  rows?: number;
  autoFocus?: boolean;
  /** Blocks submission when left blank, and marks the field so in the a11y tree. */
  required?: boolean;
  /** Id of a <datalist> whose options the browser suggests while typing. */
  list?: string;
  onClick?: (e: any) => void;
  onFocus?: (e: any) => void;
  onBlur?: (e: any) => void;
}

const CustomInput: React.FC<CustomInputProps> = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  className = '',
  as,
  rows,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <Form.Group className={`custom-input-group ${className}`} controlId={name}>
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      <Form.Control
        {...props}
        as={as}
        rows={rows}
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        isInvalid={!!error}
        className="custom-input"
      />
      <Form.Control.Feedback type="invalid" className="custom-error-text">
        {error}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

export default CustomInput;
