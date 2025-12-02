import React from 'react';
import { Modal } from 'react-bootstrap';
import PropTypes from 'prop-types';
import './common.css';

const CustomModal = ({
  show,
  onHide,
  title,
  children,
  footer,
  size = 'md',
  centered = true,
  className = ''
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size={size}
      centered={centered}
      className={`custom-modal ${className}`}
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

CustomModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  size: PropTypes.string,
  centered: PropTypes.bool,
  className: PropTypes.string,
};

export default CustomModal;
