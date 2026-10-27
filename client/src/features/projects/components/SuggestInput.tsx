import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFloatingMenu } from './useFloatingMenu';

import type { SelectOption } from './FormFields';

interface SuggestInputProps {
  /** The text in the field — what is saved, typed or picked. */
  value: string;
  /** Every keystroke. */
  onChange: (text: string) => void;
  /** A suggestion was chosen (click or Enter). */
  onPick: (option: SelectOption) => void;
  /** Leaving the field — where a caller can tidy what was typed. */
  onBlur?: () => void;
  suggestions: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  maxLength?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * A free-text field that suggests as you type — `SelectField`'s look and keyboard, without
 * restricting the value to the list. For values that should usually come from a list but
 * may not be in it yet (a collaborating organization or contact, picked from the
 * directories or typed). Nothing is armed until the user moves through the menu, so Enter or Tab on typed
 * text keeps that text rather than swapping in the first suggestion.
 */
const SuggestInput: React.FC<SuggestInputProps> = ({
  value,
  onChange,
  onPick,
  onBlur,
  suggestions,
  placeholder = 'Type to search or enter',
  disabled = false,
  invalid = false,
  maxLength,
  ariaLabel,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const filtered = needle
      ? suggestions.filter((option) => option.label.toLowerCase().includes(needle))
      : suggestions;
    // Once the text is exactly one suggestion there is nothing left to suggest.
    return filtered.length === 1 && filtered[0].label.toLowerCase() === needle ? [] : filtered;
  }, [suggestions, value]);

  const close = () => {
    setIsOpen(false);
    setHighlight(-1);
  };

  const { wrapperRef, menuNode, setMenuNode, menuBox } = useFloatingMenu<HTMLUListElement>({
    isOpen: isOpen && matches.length > 0,
    onClose: close,
    contentKey: matches.length,
  });

  useEffect(() => {
    if (disabled) close();
  }, [disabled]);

  // Keeps the keyboard highlight inside the scrolled menu.
  useEffect(() => {
    menuNode?.querySelector("[data-highlighted='true']")?.scrollIntoView({ block: 'nearest' });
  }, [highlight, menuNode]);

  const choose = (option: SelectOption) => {
    onPick(option);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => {
        const last = matches.length - 1;
        if (last < 0) return -1;
        if (current < 0) return step === 1 ? 0 : last;
        return Math.max(0, Math.min(current + step, last));
      });
      return;
    }
    // Enter picks only a row the user moved to; otherwise it is the form's.
    if (event.key === 'Enter' && isOpen && highlight >= 0 && matches[highlight]) {
      event.preventDefault();
      choose(matches[highlight]);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }
  };

  const listboxId = `${fieldId}-listbox`;
  const showMenu = isOpen && !disabled && matches.length > 0;

  return (
    <div className={`pf-select pf-combo ${className}`.trim()} ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        className={`pf-input pf-combo__input ${invalid ? 'is-invalid' : ''}`.trim()}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-expanded={showMenu}
        aria-controls={showMenu ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          showMenu && highlight >= 0 ? `${fieldId}-option-${highlight}` : undefined
        }
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        onKeyDown={handleKeyDown}
      />

      {showMenu &&
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
            {matches.map((option, index) => (
              <li
                key={option.value}
                id={`${fieldId}-option-${index}`}
                role="option"
                aria-selected={index === highlight}
                className="pf-tags__option pf-combo__option"
                data-highlighted={index === highlight}
                // The input keeps the focus, so its blur does not close the menu out
                // from under the click that picks.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => choose(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default SuggestInput;
