import { ChevronDown } from 'lucide-react';
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFloatingMenu } from './useFloatingMenu';

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

/**
 * Groups a typed amount the Indian way — `2500000` reads `25,00,000` — leaving
 * the fraction as typed so a half-entered `1234.` survives. Anything that is not
 * a plain number is shown untouched, so the field's validation still sees what
 * the user actually typed.
 */
export function groupAmount(raw: string): string {
  if (!/^\d*(\.\d*)?$/.test(raw)) return raw;
  const [whole, fraction] = raw.split('.');
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${lastThree}` : lastThree;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

interface AmountInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  /** The plain figure, without commas — what the form state and the API hold. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * A money field that shows its figure with Indian digit grouping while the form
 * keeps the bare number. The commas exist only on screen: what is stored,
 * validated and sent is exactly what it was before, so nothing downstream has
 * to learn to strip them.
 */
export const AmountInput: React.FC<AmountInputProps> = ({ value, onChange, ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // How many non-comma characters sat before the caret when the user typed.
  // Regrouping rewrites the whole value, which would otherwise throw the caret
  // to the end — typing into the middle of a figure would scatter the digits.
  const caretRef = useRef<number | null>(null);
  const shown = groupAmount(value ?? '');

  useLayoutEffect(() => {
    const input = inputRef.current;
    const wanted = caretRef.current;
    if (!input || wanted === null || document.activeElement !== input) return;
    caretRef.current = null;

    let seen = 0;
    let position = 0;
    while (position < shown.length && seen < wanted) {
      if (shown[position] !== ',') seen += 1;
      position += 1;
    }
    input.setSelectionRange(position, position);
  }, [shown]);

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={shown}
      onChange={(event) => {
        const typed = event.target.value;
        const caret = event.target.selectionStart ?? typed.length;
        caretRef.current = typed.slice(0, caret).replace(/,/g, '').length;
        onChange(typed.replace(/,/g, ''));
      }}
    />
  );
};

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
  emptyMessage?: string;
  /**
   * The option the menu opens scrolled to while nothing is picked — the current
   * financial year in a long year list — and marks in the list, whatever is
   * picked. Only scrolled to and marked, not highlighted, so Enter on an
   * untouched field still picks nothing.
   */
  scrollToValue?: string;
}

/** An option paired with its position in the flat, filtered list. */
interface IndexedOption {
  option: SelectOption;
  index: number;
}

/**
 * Files options under their `group` heading, keeping the order each heading
 * first appears in, and carrying each one's position in the flat list so the
 * keyboard can walk the menu as it reads. Options with no group stay together
 * under `''`.
 */
function groupOptions(options: SelectOption[]): Array<[string, IndexedOption[]]> {
  const groups = new Map<string, IndexedOption[]>();

  options.forEach((option, index) => {
    const heading = option.group ?? '';
    const existing = groups.get(heading);
    if (existing) existing.push({ option, index });
    else groups.set(heading, [{ option, index }]);
  });

  return [...groups.entries()];
}

/**
 * Type-to-filter single select, matching the pickers in the Budget module.
 *
 * A text input rather than a `<select>`: several of these lists — budget heads,
 * organizations, schemes — are long enough that scrolling to a name you already
 * know is the slow way to pick it, and a native select cannot be typed into.
 *
 * Options carrying a `group` render under that heading, the catalog's own
 * headings being what make the long lists findable. There is no empty first row
 * for the placeholder; a selection is cleared by emptying the field.
 */
export const SelectField: React.FC<SelectFieldProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select or type',
  disabled = false,
  invalid = false,
  className = '',
  ariaLabel,
  emptyMessage = 'No matches',
  scrollToValue,
}) => {
  // `null` while the field is showing its selection rather than a search: the
  // input then reads as the picked label and the whole list is on offer. A
  // string — including `''` — means the user has typed.
  const [query, setQuery] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  // `-1` for "no row armed". A picker with nothing chosen must not arm its
  // first option just by being opened — see the Enter handling below.
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  // The menu is portalled out of the control's subtree, so the two are tied
  // together by id — which most of these fields, sitting in table cells with
  // only an `ariaLabel`, do not otherwise have.
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    // A value the list no longer offers still reads as itself rather than as a
    // blank field. `withSelectedOption` re-offers most of them; this covers the
    // rest.
    return options.find((option) => option.value === value)?.label ?? value;
  }, [options, value]);

  const matches = useMemo(() => {
    const needle = query?.trim().toLowerCase() ?? '';
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  const groups = useMemo(() => groupOptions(matches), [matches]);

  /** Emptied the field on purpose — which is how a selection is cleared. */
  const erased = query !== null && query.trim() === '';

  const dismiss = () => {
    setIsOpen(false);
    setQuery(null);
  };

  // Leaving the field empty leaves the value empty. The old native select had a
  // blank first row for this; the list no longer carries one.
  const close = () => {
    if (erased && value) onChange('');
    dismiss();
  };

  const { wrapperRef, menuNode, setMenuNode, menuBox } = useFloatingMenu<HTMLUListElement>({
    isOpen,
    onClose: close,
    // Headings take up room too, so they are part of how tall the menu wants to
    // be — and so of which way it opens.
    contentKey: `${matches.length}:${groups.length}`,
  });

  // Opening lands on what is already picked — and on nothing at all when
  // nothing is, so Enter on an untouched field keeps the current value rather
  // than reaching for the first option.
  useEffect(() => {
    if (!isOpen) return;
    setHighlight(options.findIndex((option) => option.value === value));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // A field that goes disabled with its menu open — the scheme picker, when the
  // agency above it is cleared — must not keep answering outside clicks, nor
  // come back still open once it is enabled again.
  useEffect(() => {
    if (!disabled) return;
    setIsOpen(false);
    setQuery(null);
  }, [disabled]);

  // Typing narrows the list under the cursor, so the highlight comes back to a
  // row that still exists — the first match, typing being a choice. Emptying
  // the field is not one, so it arms nothing.
  useEffect(() => {
    if (query !== null) setHighlight(query.trim() === '' ? -1 : 0);
  }, [query]);

  // Keeps the keyboard highlight inside the scrolled menu.
  useEffect(() => {
    if (!isOpen) return;
    menuNode?.querySelector("[data-highlighted='true']")?.scrollIntoView({ block: 'nearest' });
  }, [highlight, isOpen, menuNode]);

  const listboxId = `${fieldId}-listbox`;
  const optionId = (index: number) => `${fieldId}-option-${index}`;
  const armed = highlight >= 0 ? matches[highlight] : undefined;

  // An empty, untouched field opens on `scrollToValue` rather than at the top
  // of the list. Typing hands the scroll back to the highlight, which follows
  // the matches.
  const scrollTargetIndex =
    !value && query === null && scrollToValue
      ? options.findIndex((option) => option.value === scrollToValue)
      : -1;
  const scrollTargetId = scrollTargetIndex >= 0 ? optionId(scrollTargetIndex) : null;

  // The menu's own `scrollTop` rather than `scrollIntoView`, which would also
  // scroll the page under a menu that is fixed in place.
  useEffect(() => {
    if (!isOpen || !menuNode || !scrollTargetId) return;
    const row = document.getElementById(scrollTargetId);
    if (row && menuNode.contains(row)) {
      menuNode.scrollTop = row.offsetTop - (menuNode.clientHeight - row.offsetHeight) / 2;
    }
  }, [isOpen, menuNode, scrollTargetId]);

  const pick = (option: SelectOption) => {
    // Re-picking what is already selected stays silent. `onChange` is not
    // always a plain setter — choosing a funding agency clears the scheme
    // underneath it — so firing it for an unchanged value throws away a
    // sibling field the user never touched.
    if (option.value !== value) onChange(option.value);
    dismiss();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => {
        const last = matches.length - 1;
        if (last < 0) return -1;
        // From nothing armed, down opens on the first row and up on the last.
        if (current < 0) return step === 1 ? 0 : last;
        return Math.max(0, Math.min(current + step, last));
      });
      return;
    }

    if (event.key === 'Enter') {
      // Only while the menu is open: a bare Enter on a closed picker belongs to
      // the form, not to this field.
      if (!isOpen) return;

      // Nothing typed and nothing armed — an untouched picker someone has only
      // tabbed through. That Enter is the form's as well; taking it would write
      // whichever option happened to be first.
      if (query === null && !armed) {
        dismiss();
        return;
      }

      event.preventDefault();
      if (erased) close();
      else if (armed) pick(armed);
      return;
    }

    // Abandons the search, selection untouched — including an erase.
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      dismiss();
      return;
    }

    if (event.key === 'Tab') close();
  };

  return (
    <div className={`pf-select pf-combo ${className}`.trim()} ref={wrapperRef}>
      <input
        id={fieldId}
        ref={inputRef}
        type="text"
        role="combobox"
        className={`pf-select__control pf-combo__input ${invalid ? 'is-invalid' : ''}`.trim()}
        value={query ?? selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        title={selectedLabel || undefined}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && armed ? optionId(highlight) : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        // Selecting the text means the first keystroke replaces the picked
        // label instead of appending to it, while the label stays readable
        // until the user actually types.
        onFocus={(event) => {
          setIsOpen(true);
          event.target.select();
        }}
        // A second click on an already-focused field shuts the menu again;
        // without this the chevron would only ever open it.
        onMouseDown={() => {
          if (disabled || document.activeElement !== inputRef.current) return;
          if (isOpen) close();
          else setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      <ChevronDown className="pf-select__chevron" size={14} aria-hidden="true" />

      {isOpen &&
        !disabled &&
        createPortal(
          <ul
            id={listboxId}
            className="pf-tags__menu pf-tags__menu--floating"
            role="listbox"
            ref={setMenuNode}
            style={{
              top: menuBox.top,
              left: menuBox.left,
              minWidth: menuBox.minWidth,
              maxWidth: menuBox.maxWidth,
              maxHeight: menuBox.maxHeight,
              overflowY: menuBox.overflowY,
            }}
          >
            {matches.length === 0 ? (
              <li className="pf-tags__empty">{emptyMessage}</li>
            ) : (
              groups.map(([heading, groupedOptions]) => (
                <React.Fragment key={heading || 'ungrouped'}>
                  {heading && (
                    <li className="pf-combo__group" role="presentation">
                      {heading}
                    </li>
                  )}
                  {groupedOptions.map(({ option, index }) => (
                    // The row carries the role itself rather than wrapping a
                    // button in it: focus never leaves the input, so the menu is
                    // driven by `aria-activedescendant`, which has to name the
                    // element the role is on.
                    <li
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={option.value === value}
                      className="pf-tags__option pf-combo__option"
                      data-highlighted={index === highlight}
                      data-selected={option.value === value}
                      data-current={Boolean(scrollToValue) && option.value === scrollToValue}
                      // The input keeps the focus, so the menu is not dismissed
                      // out from under the click that picks.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => pick(option)}
                    >
                      {option.label}
                    </li>
                  ))}
                </React.Fragment>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
};

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
