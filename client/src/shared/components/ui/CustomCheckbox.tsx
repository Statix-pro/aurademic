import React from 'react';
import { Form } from 'react-bootstrap';
import './common.css';

interface CustomCheckboxProps {
  label: string;
  name: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  value?: string | number;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  className = '',
  id,
  value,
  ...props
}) => {
  return (
    <Form.Check
      type="checkbox"
      id={id || name}
      name={name}
      label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className={`custom-check-container ${className}`}
      value={value}
      {...props}
    />
  );
};

export default CustomCheckbox;
