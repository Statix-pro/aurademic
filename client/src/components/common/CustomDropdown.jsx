import React from 'react';
import Select from 'react-select';
import PropTypes from 'prop-types';
import './common.css';

const CustomDropdown = ({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = "Select...",
  error,
  isDisabled = false,
  isMulti = false,
  className = '',
  ...props
}) => {

  // Custom styles for react-select to match our theme
  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: 'var(--bg-input)',
      borderColor: error ? 'var(--error-color)' : (state.isFocused ? 'var(--border-focus)' : 'var(--border-color)'),
      borderRadius: 'var(--border-radius-md)',
      padding: '0.1rem',
      boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-focus)',
      }
    }),
    menu: (provided) => ({
      ...provided,
      borderRadius: 'var(--border-radius-md)',
      overflow: 'hidden',
      zIndex: 5,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? 'var(--primary-color)'
        : state.isFocused
          ? 'var(--bg-light)'
          : 'white',
      color: state.isSelected ? 'white' : 'var(--text-main)',
      cursor: 'pointer',
      ':active': {
        backgroundColor: 'var(--primary-color)',
      }
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-main)',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
    }),
  };

  return (
    <div className={`custom-input-group ${className}`}>
      {label && <label className="custom-label" htmlFor={name}>{label}</label>}
      <Select
        inputId={name}
        name={name}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isMulti={isMulti}
        styles={customStyles}
        classNamePrefix="react-select"
        {...props}
      />
      {error && <div className="custom-error-text">{error}</div>}
    </div>
  );
};

CustomDropdown.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.object).isRequired,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.arrayOf(PropTypes.object)]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  isDisabled: PropTypes.bool,
  isMulti: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomDropdown;
