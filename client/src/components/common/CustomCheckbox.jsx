import React from 'react';
import PropTypes from 'prop-types';
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
    <div className={`custom-check-container ${className}`}>
      <input
        type="checkbox"
        id={name}
        name={name}
        className="custom-check-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      <label htmlFor={name} className="custom-check-label">
        {label}
      </label>
    </div>
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
