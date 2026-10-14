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
  /** Optional heading to file the option under; see `SelectField` below. */
  group?: string;
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
 * Files options under their `group` heading, keeping the order each heading
 * first appears in. Options with no group stay together under `''`.
 */
function groupOptions(options: SelectOption[]): Array<[string, SelectOption[]]> {
  const groups = new Map<string, SelectOption[]>();

  options.forEach((option) => {
    const heading = option.group ?? '';
    const existing = groups.get(heading);
    if (existing) existing.push(option);
    else groups.set(heading, [option]);
  });

  return [...groups.entries()];
}

/**
 * Native select with the design's chevron. Native is deliberate: these are
 * short single-choice lists, and it keeps keyboard and mobile behaviour free.
 *
 * Options carrying a `group` render as `<optgroup>`s: the budget-head lists are
 * long enough that the catalog's own headings are what make them findable.
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
      {groupOptions(options).map(([heading, groupedOptions]) => {
        const renderedOptions = groupedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ));

        return heading ? (
          <optgroup key={heading} label={heading}>
            {renderedOptions}
          </optgroup>
        ) : (
          <React.Fragment key="ungrouped">{renderedOptions}</React.Fragment>
        );
      })}
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
