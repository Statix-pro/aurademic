import React from 'react';
import Select, { OptionsOrGroups, SingleValue, MultiValue, GroupBase } from 'react-select';
import './common.css';

export interface OptionType {
  value: string | number;
  label: string;
  [key: string]: any;
}

interface CustomDropdownProps {
  label?: string;
  name?: string;
  options: OptionsOrGroups<OptionType, GroupBase<OptionType>>;
  value?: SingleValue<OptionType> | MultiValue<OptionType>;
  onChange: (value: SingleValue<OptionType> | MultiValue<OptionType>) => void;
  placeholder?: string;
  error?: string;
  isDisabled?: boolean;
  isMulti?: boolean;
  className?: string;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
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
    control: (provided: any, state: any) => ({
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
    menu: (provided: any) => ({
      ...provided,
      borderRadius: 'var(--border-radius-md)',
      overflow: 'hidden',
      zIndex: 5,
    }),
    option: (provided: any, state: any) => ({
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
    singleValue: (provided: any) => ({
      ...provided,
      color: 'var(--text-main)',
    }),
    placeholder: (provided: any) => ({
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

export default CustomDropdown;