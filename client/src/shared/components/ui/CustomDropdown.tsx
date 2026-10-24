import React from 'react';
import Select, {
  OptionsOrGroups,
  SingleValue,
  MultiValue,
  GroupBase,
  StylesConfig,
} from 'react-select';
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
  styles?: StylesConfig<OptionType, boolean>;
  menuPortalTarget?: HTMLElement | null;
  menuPosition?: 'absolute' | 'fixed';
  filterOption?: (candidate: any, input: string) => boolean;
  /** For server-side search: fires as the user types, before options are filtered. */
  onInputChange?: (value: string) => void;
  isLoading?: boolean;
  noOptionsMessage?: (obj: { inputValue: string }) => React.ReactNode;
  isClearable?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  error,
  isDisabled = false,
  isMulti = false,
  className = '',
  styles: customStyles,
  menuPortalTarget,
  menuPosition = 'fixed',
  ...props
}) => {
  // Sized on --control-height so a dropdown lines up with the inputs beside it.
  const defaultStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: 'var(--control-height)',
      height: 'var(--control-height)',
      fontSize: 'var(--font-size-body)',
      backgroundColor: 'var(--bg-input)',
      borderColor: error
        ? 'var(--error-color)'
        : state.isFocused
          ? 'var(--border-focus)'
          : 'var(--border-color)',
      borderRadius: 'var(--border-radius-md)',
      padding: '0 4px',
      boxShadow: state.isFocused ? 'var(--shadow-focus)' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? 'var(--border-focus)' : 'var(--border-focus)',
      },
    }),
    valueContainer: (provided: any) => ({
      ...provided,
      minHeight: 'calc(var(--control-height) - 2px)',
      height: 'calc(var(--control-height) - 2px)',
      padding: '0 8px',
      display: 'flex',
      alignItems: 'center',
    }),
    indicatorsContainer: (provided: any) => ({
      ...provided,
      minHeight: 'calc(var(--control-height) - 2px)',
      height: 'calc(var(--control-height) - 2px)',
    }),
    indicatorSeparator: (provided: any) => ({
      ...provided,
      marginTop: '8px',
      marginBottom: '8px',
    }),
    menu: (provided: any) => ({
      ...provided,
      fontSize: 'var(--font-size-body)',
      borderRadius: 'var(--border-radius-md)',
      overflow: 'hidden',
      zIndex: 4000,
    }),
    menuPortal: (provided: any) => ({
      ...provided,
      zIndex: 5000,
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
      },
    }),
    singleValue: (provided: any) => ({
      ...provided,
      color: 'var(--text-main)',
    }),
    // Light grey like every other hint, and hidden while the field is disabled
    // (see the placeholder rules in shared/styles/index.css).
    placeholder: (provided: any, state: any) => ({
      ...provided,
      color: state.isDisabled ? 'transparent' : 'var(--placeholder-color)',
    }),
  };

  // Merge custom styles with defaults (custom styles override)
  const mergedStyles = customStyles ? { ...defaultStyles, ...customStyles } : defaultStyles;

  return (
    <div className={`custom-input-group ${className}`}>
      {label && (
        <label className="custom-label" htmlFor={name}>
          {label}
        </label>
      )}
      <Select
        inputId={name}
        name={name}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isMulti={isMulti}
        styles={mergedStyles}
        classNamePrefix="react-select"
        menuPortalTarget={
          menuPortalTarget !== undefined
            ? menuPortalTarget
            : typeof document !== 'undefined'
              ? document.body
              : null
        }
        menuPosition={menuPosition}
        {...props}
      />
      {error && <div className="custom-error-text">{error}</div>}
    </div>
  );
};

export default CustomDropdown;
