import React from 'react';
import { Modal } from 'react-bootstrap';
import './common.css';

interface CustomModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'lg' | 'xl';
  centered?: boolean;
  className?: string;
}

const CustomModal: React.FC<CustomModalProps> = ({
  show,
  onHide,
  title,
  children,
  footer,
  size = 'lg',
  centered = true,
  className = '',
  ...props
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size={size}
      centered={centered}
      className={`custom-modal ${className}`}
      {...props}
    >
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {children}
      </Modal.Body>
      {footer && (
        <Modal.Footer>
          {footer}
        </Modal.Footer>
      )}
    </Modal>
  );
};

export default CustomModal;