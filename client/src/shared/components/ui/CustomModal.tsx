import React, { useId } from 'react';
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
  scrollable?: boolean;
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
  scrollable = false,
  ...props
}) => {
  const titleId = useId();

  return (
    <Modal
      show={show}
      onHide={onHide}
      size={size}
      centered={centered}
      className={`custom-modal ${className}`}
      aria-labelledby={titleId}
      scrollable={scrollable}
      {...props}
    >
      <Modal.Header closeButton={!hideCloseButton}>
        <Modal.Title id={titleId}>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      {footer && <Modal.Footer>{footer}</Modal.Footer>}
    </Modal>
  );
};

export default CustomModal;
