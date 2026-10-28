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
  /** A hint under the field (13px help text); the error replaces it while there is one. */
  helpText?: string;
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
  helpText,
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
      // Locked like a disabled input (bootstrap-theme.css .form-control:disabled).
      backgroundColor: state.isDisabled ? 'var(--surface-muted)' : 'var(--bg-input)',
      borderColor: error
        ? 'var(--error-color)'
        : state.isDisabled
          ? 'var(--border-subtle)'
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
    singleValue: (provided: any, state: any) => ({
      ...provided,
      color: state.isDisabled ? 'var(--text-soft)' : 'var(--text-main)',
    }),
    // Multi-select values look like CustomTagInput's chips (common.css .custom-tag-badge),
    // so a picked list reads the same on every form. They never shrink: a row that runs
    // out of room scrolls or wraps, per the host's valueContainer.
    multiValue: (provided: any) => ({
      ...provided,
      flexShrink: 0,
      backgroundColor: 'var(--tag-chip-bg)',
      border: '1px solid var(--tag-chip-border)',
      borderRadius: 'var(--border-radius-sm)',
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      // 28px tall with its border, the same as CustomTagInput's chips.
      padding: '0.1875rem 0 0.1875rem 0.625rem',
      fontSize: 'var(--font-size-secondary)',
      fontWeight: 600,
      color: 'var(--tag-chip-text)',
    }),
    // A disabled field shows the picks without the remove button they could not use.
    multiValueRemove: (provided: any, state: any) =>
      state.selectProps.isDisabled
        ? { display: 'none' }
        : {
            ...provided,
            margin: '0.125rem 0.25rem 0.125rem 0.125rem',
            padding: '0 0.25rem',
            borderRadius: '6px',
            color: 'var(--tag-chip-text)',
            cursor: 'pointer',
            ':hover': { backgroundColor: 'var(--tag-chip-remove-hover-bg)' },
          },
    // Light grey like every other hint, and hidden while the field is disabled
    // (see the placeholder rules in shared/styles/base.css). One line, cut with an
    // ellipsis, so a narrow field on a phone never grows taller than its neighbours.
    placeholder: (provided: any, state: any) => ({
      ...provided,
      color: state.isDisabled ? 'transparent' : 'var(--placeholder-color)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
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
        // Also lets a host's own control style show the error border (selectProps).
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <div className="custom-error-text">{error}</div>}
      {!error && helpText && <div className="custom-help-text">{helpText}</div>}
    </div>
  );
};

export default CustomDropdown;
