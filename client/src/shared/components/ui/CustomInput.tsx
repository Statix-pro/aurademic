import { X } from 'lucide-react';
import React from 'react';
import { Form } from 'react-bootstrap';

import CustomButton from './CustomButton';
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
  /** Shows a × inside the field that calls this; hidden while the field is disabled. */
  onClear?: () => void;
  /** What the × does, for its tooltip and screen readers. Defaults to "Clear". */
  clearLabel?: string;
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
  onClear,
  clearLabel = 'Clear',
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };
  const showClear = Boolean(onClear) && !disabled;

  const control = (
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
  );
  const feedback = (
    <Form.Control.Feedback type="invalid" className="custom-error-text">
      {error}
    </Form.Control.Feedback>
  );

  return (
    <Form.Group className={`custom-input-group ${className}`} controlId={name}>
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      {showClear ? (
        // Wrapped only when clearable, so other screens' markup is unchanged. The feedback
        // stays a sibling of the control: Bootstrap shows it through `~`.
        <div className="custom-input-clearable">
          {control}
          <CustomButton
            variant="link"
            className="custom-input-clear"
            onClick={onClear}
            aria-label={clearLabel}
            title={clearLabel}
          >
            <X size={14} aria-hidden="true" />
          </CustomButton>
          {feedback}
        </div>
      ) : (
        <>
          {control}
          {feedback}
        </>
      )}
    </Form.Group>
  );
};

export default CustomInput;
