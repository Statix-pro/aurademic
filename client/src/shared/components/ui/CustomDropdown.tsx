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
  centerSelect?: boolean;
  filterOption?: ((option: { label: string; value: string; data: OptionType }, inputValue: string) => boolean) | null;
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
  centerSelect = false,
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
    <div className={`custom-input-group ${className}`} style={{ 
      display: 'flex', 
      flexDirection: 'column',
      width: '100%'
    }}>
      {label && (
        <label className="custom-label" htmlFor={name} style={{ 
          alignSelf: 'flex-start',
          width: '100%',
          textAlign: 'left',
         
        }}>
          {label}
        </label>
      )}
      <div style={{ 
        width: '100%',
        display: 'flex',
        justifyContent: centerSelect ? 'center' : 'flex-start',
      
        
      }}>
        <div style={{ 
          width: centerSelect ? 'auto' : '100%',
          minWidth: centerSelect ? '250px' : 'auto',
          flex: centerSelect ? '0 1 auto' : '1',
          
          height:'15px',
          marginBottom:'10px'

        }}>
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
        </div>
      </div>
      {error && (
        <div className="custom-error-text" style={{ 
          alignSelf: 'flex-start',
          width: '100%',
          textAlign: 'left'
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
