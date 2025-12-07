import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import './common.css';

const CustomCheckbox = ({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <Form.Check
      type="checkbox"
      id={name}
      name={name}
      label={label}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className={`custom-check-container ${className}`}
      {...props}
    />
  );
};

CustomCheckbox.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomCheckbox;
