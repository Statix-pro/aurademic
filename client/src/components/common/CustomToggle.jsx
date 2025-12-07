import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import './common.css';

const CustomToggle = ({
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
        onChange={onChange}
        disabled={disabled}
        className="custom-toggle"
        {...props}
      />
    </div>
  );
};

CustomToggle.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  checked: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  id: PropTypes.string,
};

export default CustomToggle;
