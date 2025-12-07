import React from 'react';
import { Form } from 'react-bootstrap';
import './common.css';

interface CustomRadioProps {
  label: string;
  name: string;
  value: string | number;
  checked?: boolean;
  onChange: (value: string | number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const CustomRadio: React.FC<CustomRadioProps> = ({
  label,
  name,
  value,
  checked,
  onChange,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  return (
    <Form.Check
      type="radio"
      id={id || `${name}-${value}`}
      name={name}
      label={label}
      value={value}
      checked={checked}
      onChange={(e) => onChange(value)}
      disabled={disabled}
      className={`custom-check-container ${className}`}
      {...props}
    />
  );
};

export default CustomRadio;