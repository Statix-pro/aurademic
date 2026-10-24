import React, { useState, useRef, useEffect } from 'react';
import { Form, Badge, ListGroup } from 'react-bootstrap';
import './common.css';

interface CustomTagInputProps {
  label?: string;
  name: string;
  value?: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  onSearch?: (query: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  renderTag?: (tag: string) => React.ReactNode;
}

const CustomTagInput: React.FC<CustomTagInputProps> = ({
  label,
  name,
  value = [],
  onChange,
  suggestions = [],
  onSearch,
  placeholder,
  error,
  disabled = false,
  className = '',
  renderTag,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setInputValue(query);
    if (onSearch) {
      onSearch(query);
    }
    setShowSuggestions(query.length > 0);
  };

  const handleSelect = (item: string) => {
    if (!value.includes(item)) {
      onChange([...value, item]);
    }
    setInputValue('');
    setShowSuggestions(false);
    if (onSearch) onSearch(''); // Reset search
  };

  const handleRemove = (itemToRemove: string) => {
    onChange(value.filter((item) => item !== itemToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      // Allow adding custom tag if not in suggestions?
      // For now, let's assume if it's not in suggestions, we add it as custom
      // unless strictly restricted.
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag on backspace
      handleRemove(value[value.length - 1]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setInputValue('');
    if (onSearch) onSearch('');
  };

  return (
    <Form.Group
      className={`custom-input-group ${className} position-relative`}
      controlId={name}
      ref={wrapperRef}
    >
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      <div
        className={`form-control custom-input d-flex flex-wrap align-items-center gap-2 position-relative ${error ? 'is-invalid' : ''}`}
        style={{
          minHeight: 'var(--control-height)',
          height: 'auto',
          paddingRight: value.length > 0 && !disabled ? '2.5rem' : '0.75rem',
        }}
      >
        {value.map((item, index) => (
          <Badge key={index} className="custom-tag-badge">
            {renderTag ? renderTag(item) : item}
            {!disabled && (
              <span
                className="ms-2"
                onClick={() => handleRemove(item)}
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#495057',
                  borderRadius: '50%',
                  fontSize: '18px',
                  lineHeight: '1',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#343a40';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg
                  height="14"
                  width="14"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  focusable="false"
                  style={{ fill: 'currentColor' }}
                >
                  <path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z" />
                </svg>
              </span>
            )}
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="border-0 flex-grow-1"
          style={{ outline: 'none', minWidth: '120px', background: 'transparent' }}
          autoComplete="off"
        />

        {/* Clear All Button */}
        {value.length > 0 && !disabled && (
          <div
            className="position-absolute end-0 top-50 translate-middle-y pe-2"
            style={{ cursor: 'pointer', color: '#ccc', display: 'flex', alignItems: 'center' }}
            onClick={handleClear}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#999')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
            title="Clear all"
          >
            <svg
              height="20"
              width="20"
              viewBox="0 0 20 20"
              aria-hidden="true"
              focusable="false"
              style={{ fill: 'currentColor' }}
            >
              <path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z" />
            </svg>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ListGroup
          className="position-absolute w-100 mt-1 shadow-sm"
          style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}
        >
          {suggestions
            .filter((s) => !value.includes(s))
            .map((item, index) => (
              <ListGroup.Item key={index} action onClick={() => handleSelect(item)}>
                {item}
              </ListGroup.Item>
            ))}
        </ListGroup>
      )}

      <Form.Control.Feedback type="invalid" className="custom-error-text d-block">
        {error}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

export default CustomTagInput;
