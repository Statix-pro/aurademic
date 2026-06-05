import React, { useState, useEffect, useRef } from 'react';
import { Form, ListGroup, Spinner } from 'react-bootstrap';
import './common.css';

interface SearchResult {
  id?: string | number;
  label?: string;
  name?: string;
  [key: string]: any;
}

interface CustomSearchInputProps {
  label?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  results?: SearchResult[];
  renderResult?: (item: SearchResult) => React.ReactNode;
  onSelect: (item: SearchResult) => void;
  loading?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

const CustomSearchInput: React.FC<CustomSearchInputProps> = ({
  label,
  name,
  value,
  onChange,
  results = [],
  renderResult,
  onSelect,
  loading = false,
  placeholder,
  error,
  disabled = false,
  className = '',
  ...props
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show suggestions when results update and are not empty
  useEffect(() => {
    if (results && results.length > 0 && document.activeElement === document.getElementById(name)) {
      setShowSuggestions(true);
    } else if (!results || results.length === 0) {
      setShowSuggestions(false);
    }
  }, [results, name]);

  const handleSelect = (item: SearchResult) => {
    onSelect(item);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    if (results && results.length > 0) {
      setShowSuggestions(true);
    }
  };

  const renderItem = (item: SearchResult): React.ReactNode => {
    if (renderResult) {
      return renderResult(item);
    }
    return item.label || item.name || String(item);
  };

  return (
    <Form.Group
      className={`custom-input-group position-relative ${className}`}
      controlId={name}
      ref={wrapperRef}
    >
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      <div className="position-relative">
        <Form.Control
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          isInvalid={!!error}
          className="custom-input"
          autoComplete="off"
          {...props}
        />
        {loading && (
          <div className="position-absolute top-50 end-0 translate-middle-y me-3">
            <Spinner animation="border" size="sm" variant="primary" />
          </div>
        )}
      </div>

      {showSuggestions && results.length > 0 && (
        <ListGroup
          className="position-absolute w-100 mt-1 shadow-sm"
          style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}
        >
          {results.map((item, index) => (
            <ListGroup.Item
              key={item.id || index}
              action
              onClick={() => handleSelect(item)}
              className="border-start-0 border-end-0"
            >
              {renderItem(item)}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}

      <Form.Control.Feedback type="invalid" className="custom-error-text">
        {error}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

export default CustomSearchInput;
