import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Form, Badge, ListGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './common.css';

const CustomTagInput = ({
  label,
  name,
  value = [],
  onChange,
  suggestions = [],
  onSearch,
  placeholder,
  error,
  disabled = false,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const query = e.target.value;
    setInputValue(query);
    if (onSearch) {
      onSearch(query);
    }
    setShowSuggestions(query.length > 0);
  };

  const handleSelect = (item) => {
    if (!value.includes(item)) {
      onChange([...value, item]);
    }
    setInputValue('');
    setShowSuggestions(false);
    if (onSearch) onSearch(''); // Reset search
  };

  const handleRemove = (itemToRemove) => {
    onChange(value.filter(item => item !== itemToRemove));
  };

  const handleKeyDown = (e) => {
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

  return (
    <Form.Group className={`custom-input-group ${className}`} controlId={name} ref={wrapperRef}>
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      <div className={`form-control custom-input d-flex flex-wrap align-items-center gap-2 ${error ? 'is-invalid' : ''}`} style={{ minHeight: '38px', height: 'auto' }}>
        {value.map((item, index) => (
          <Badge key={index} bg="primary" className="d-flex align-items-center py-2 px-3">
            {item}
            {!disabled && (
              <span
                className="ms-2 cursor-pointer"
                onClick={() => handleRemove(item)}
                style={{ cursor: 'pointer' }}
              >
                <FontAwesomeIcon icon={faTimes} size="sm" />
              </span>
            )}
          </Badge>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="border-0 flex-grow-1"
          style={{ outline: 'none', minWidth: '120px', background: 'transparent' }}
          autoComplete="off"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ListGroup className="position-absolute w-100 mt-1 shadow-sm" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
           {suggestions.filter(s => !value.includes(s)).map((item, index) => (
            <ListGroup.Item
              key={index}
              action
              onClick={() => handleSelect(item)}
            >
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

CustomTagInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  suggestions: PropTypes.arrayOf(PropTypes.string),
  onSearch: PropTypes.func,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomTagInput;
