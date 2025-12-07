import React from 'react';
import { Form } from 'react-bootstrap';
import './common.css';

interface CustomToggleProps {
  label?: string;
  name: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const CustomToggle: React.FC<CustomToggleProps> = ({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className={`custom-check-container ${className}`}>
      <Form.Check
        type="switch"
        id={id || name}
        name={name}
        label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="custom-toggle"
        {...props}
      />
    </div>
  );
};

export default CustomToggle;