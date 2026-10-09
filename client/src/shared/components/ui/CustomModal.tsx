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
  backdrop?: boolean | 'static';
  keyboard?: boolean;
  hideCloseButton?: boolean;
  fullscreen?: boolean | string;
  hideHeader?: boolean;
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
  hideCloseButton = false,
  fullscreen,
  hideHeader = false,
  ...props
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size={size}
      centered={centered}
      fullscreen={fullscreen || undefined}
      className={`custom-modal ${className}`}
      dialogClassName={fullscreen ? 'modal-fullscreen' : undefined}
      {...props}
    >
      {!hideHeader && (
        <Modal.Header closeButton={!hideCloseButton}>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
      )}
      <Modal.Body>{children}</Modal.Body>
      {footer && <Modal.Footer>{footer}</Modal.Footer>}
    </Modal>
  );
};

export default CustomModal;
