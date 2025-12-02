import React from 'react';
import PropTypes from 'prop-types';
import './common.css';

const CustomInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`custom-input-group ${className}`}>
      {label && <label className="custom-label" htmlFor={name}>{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        className={`custom-input ${error ? 'is-invalid' : ''}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        {...props}
      />
      {error && <div className="custom-error-text">{error}</div>}
    </div>
  );
};

CustomInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomInput;
