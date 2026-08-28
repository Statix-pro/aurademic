import { ChevronDown } from 'lucide-react';
import React from 'react';

interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + inline error, the layout every labelled field on the form uses. */
export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  error,
  hint,
  className = '',
  children,
}) => (
  <div className={`pf-field ${className}`.trim()}>
    {label && (
      <label className="pf-field__label" htmlFor={htmlFor}>
        {label}
      </label>
    )}
    {children}
    {hint && !error && <span className="pf-field__hint">{hint}</span>}
    {error && <span className="pf-field__error">{error}</span>}
  </div>
);

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Native select with the design's chevron. Native is deliberate: these are
 * short single-choice lists, and it keeps keyboard and mobile behaviour free.
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select',
  disabled = false,
  invalid = false,
  className = '',
  ariaLabel,
}) => (
  <div className={`pf-select ${className}`.trim()}>
    <select
      id={id}
      className={`pf-select__control ${invalid ? 'is-invalid' : ''}`.trim()}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pf-select__chevron" size={14} aria-hidden="true" />
  </div>
);

interface ReadOnlyValueProps {
  value?: string | null;
  placeholder?: string;
  className?: string;
}

/** Derived, non-editable values (a scheme's domain, category and website). */
export const ReadOnlyValue: React.FC<ReadOnlyValueProps> = ({
  value,
  placeholder = '—',
  className = '',
}) => (
  <output className={`pf-readonly ${className}`.trim()}>
    {value && value.trim() ? value : <span className="pf-readonly__empty">{placeholder}</span>}
  </output>
);
