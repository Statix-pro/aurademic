import { ChevronDown, X } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  /**
   * Keeps the control one line tall however many chips are in it, scrolling
   * them sideways instead of wrapping. For a field sitting on a row of other
   * fields, where a box that grows with each pick shifts everything beside it.
   */
  singleLine?: boolean;
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
  singleLine = false,
  emptyMessage = 'No matches',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  // Where the menu sits on screen. It is rendered into `document.body` rather
  // than beside the control, because inside a table the control's own scroll
  // container (`.pf-table-wrap`, which needs `overflow-x` for narrow windows)
  // clipped the list to the row — the options below the first were unreachable.
  // Portalled out, nothing above it can crop it, so it is positioned by hand
  // against the control's box.
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 0 });

  const positionMenu = useCallback(() => {
    const control = wrapperRef.current;
    if (!control) return;

    const rect = control.getBoundingClientRect();
    setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Before paint, so the menu never shows at the previous row's coordinates.
  useLayoutEffect(() => {
    if (isOpen) positionMenu();
  }, [isOpen, positionMenu, value.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // The menu is outside the wrapper in the DOM now, so a click on an option
      // has to be recognised as inside.
      if (!wrapperRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    // Anything that moves the control moves the menu with it; `true` catches
    // scrolling in the table wrapper and the page alike.
    const reposition = () => positionMenu();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, positionMenu]);

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
      className={`pf-tags ${compact ? 'pf-tags--compact' : ''} ${
        singleLine ? 'pf-tags--single-line' : ''
      } ${error ? 'pf-tags--invalid' : ''}`.trim()}
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

      {isOpen &&
        !disabled &&
        createPortal(
          <ul
            className="pf-tags__menu pf-tags__menu--floating"
            role="listbox"
            ref={menuRef}
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
          >
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
          </ul>,
          document.body,
        )}

      {error && <span className="pf-field__error">{error}</span>}
    </div>
  );
};

export default TagSelectField;
