import React from 'react';
import PropTypes from 'prop-types';
import './common.css';

const CustomRadio = ({
  label,
  name,
  value,
  checked,
  onChange,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`custom-check-container ${className}`}>
      <input
        type="radio"
        id={`${name}-${value}`}
        name={name}
        value={value}
        className="custom-check-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <label htmlFor={`${name}-${value}`} className="custom-check-label">
        {label}
      </label>
    </div>
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
};

export default CustomRadio;
