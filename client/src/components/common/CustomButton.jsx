import React from 'react';
import PropTypes from 'prop-types';
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
    <button
      type={type}
      className={`custom-btn custom-btn-${variant} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};

CustomButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'outline', 'danger']),
  className: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.string,
};

export default CustomButton;
