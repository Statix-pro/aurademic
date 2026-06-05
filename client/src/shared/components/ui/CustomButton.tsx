import React from 'react';
import { Button, ButtonProps } from 'react-bootstrap';
import './common.css';

interface CustomButtonProps extends Omit<ButtonProps, 'variant'> {
  children: React.ReactNode;
  variant?: string;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const CustomButton: React.FC<CustomButtonProps> = ({
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
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
};

export default CustomButton;
