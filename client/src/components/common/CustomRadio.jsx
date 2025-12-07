import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import './common.css';

const CustomRadio = ({
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
      onChange={onChange}
      disabled={disabled}
      className={`custom-check-container ${className}`}
      {...props}
    />
  );
};

CustomRadio.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default CustomRadio;
