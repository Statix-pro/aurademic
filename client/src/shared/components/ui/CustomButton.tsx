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
  // Icon-only content (icon components, no text) is a 32×32 icon action, not a 120px-wide form
  // action; the class lets common.css drop the form-action minimums for it.
  const content = React.Children.toArray(children);
  const iconOnly =
    content.length > 0 &&
    content.every((child) => React.isValidElement(child) && typeof child.type !== 'string');

  return (
    <Button
      variant={variant}
      type={type}
      className={`custom-btn ${iconOnly ? 'custom-btn--icon ' : ''}${className}`}
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
