import React from 'react';
import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';
import './common.css';

const CustomInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  className = '',
  as,
  rows,
  ...props
}) => {
  return (
    <Form.Group className={`custom-input-group ${className}`} controlId={name}>
      {label && <Form.Label className="custom-label">{label}</Form.Label>}
      <Form.Control
        as={as}
        rows={rows}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        isInvalid={!!error}
        className="custom-input"
        {...props}
      />
      <Form.Control.Feedback type="invalid" className="custom-error-text">
        {error}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

CustomInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  error: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  as: PropTypes.elementType,
  rows: PropTypes.number,
};

export default CustomInput;
