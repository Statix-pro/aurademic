import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import './common.css';

const CustomButton = ({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) => {
  return (
    <Button
      variant={variant}
      type={type}
      className={`custom-btn ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
};

CustomButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.string,
  className: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.string,
};

export default CustomButton;
