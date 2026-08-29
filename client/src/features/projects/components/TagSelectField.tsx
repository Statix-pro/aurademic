import { ChevronDown, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface TagOption {
  value: string;
  label: string;
}

interface TagSelectFieldProps {
  id?: string;
  options: TagOption[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  /** Hides the chevron and chips border for use inside a table cell. */
  compact?: boolean;
  emptyMessage?: string;
}

/**
 * Type-to-filter multi-select rendering the picks as removable chips. Used for
 * the national-initiative, SDG and budget-head fields, all of which choose
 * several values from a fixed list.
 */
const TagSelectField: React.FC<TagSelectFieldProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  compact = false,
  emptyMessage = 'No matches',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const selectedOptions = useMemo(
    () =>
      value.map(
        (selected) =>
          options.find((option) => option.value === selected) ?? {
            value: selected,
            // A value no longer in the list (a retired budget head, say) is
            // still shown so an edit does not silently drop it.
            label: selected,
          },
      ),
    [options, value],
  );

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        !value.includes(option.value) && (!needle || option.label.toLowerCase().includes(needle)),
    );
  }, [options, query, value]);

  const add = (option: TagOption) => {
    onChange([...value, option.value]);
    setQuery('');
  };

  const remove = (selected: string) => onChange(value.filter((item) => item !== selected));

  return (
    <div
      className={`pf-tags ${compact ? 'pf-tags--compact' : ''} ${error ? 'pf-tags--invalid' : ''}`.trim()}
      ref={wrapperRef}
    >
      <div className="pf-tags__control" onClick={() => !disabled && setIsOpen(true)}>
        {selectedOptions.map((option) => (
          <span className="pf-chip" key={option.value}>
            {option.label}
            {!disabled && (
              <button
                type="button"
                className="pf-chip__remove"
                onClick={(event) => {
                  event.stopPropagation();
                  remove(option.value);
                }}
                aria-label={`Remove ${option.label}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}

        <input
          id={id}
          type="text"
          className="pf-tags__input"
          value={query}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && suggestions.length > 0) {
              event.preventDefault();
              add(suggestions[0]);
            }
            if (event.key === 'Backspace' && !query && selectedOptions.length > 0) {
              remove(selectedOptions[selectedOptions.length - 1].value);
            }
            if (event.key === 'Escape') setIsOpen(false);
          }}
          disabled={disabled}
        />

        {!compact && <ChevronDown className="pf-tags__chevron" size={16} aria-hidden="true" />}
      </div>

      {isOpen && !disabled && (
        <ul className="pf-tags__menu" role="listbox">
          {suggestions.length === 0 ? (
            <li className="pf-tags__empty">{emptyMessage}</li>
          ) : (
            suggestions.slice(0, 50).map((option) => (
              <li key={option.value}>
                <button type="button" className="pf-tags__option" onClick={() => add(option)}>
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {error && <span className="pf-field__error">{error}</span>}
    </div>
  );
};

export default TagSelectField;
