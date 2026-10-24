import { AlertTriangle } from 'lucide-react';
import React from 'react';

import CustomModal from './CustomModal';

interface DeleteConfirmationModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  isDeleting?: boolean;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  show,
  onHide,
  onConfirm,
  title = 'Confirm Delete',
  itemName,
  isDeleting = false,
}) => {
  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title={title}
      size="sm"
      centered
      className="compact-delete-modal"
      footer={
        <div className="d-flex justify-content-end gap-2 w-100">
          <button className="btn btn-secondary btn-sm" onClick={onHide} disabled={isDeleting}>
            Cancel
          </button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      }
    >
      <div className="d-flex align-items-center p-3">
        <div className="text-warning me-3">
          <AlertTriangle size={32} />
        </div>
        <div className="flex-grow-1">
          <p className="mb-0 fw-semibold" style={{ fontSize: 'var(--font-size-body)' }}>
            Delete {itemName ? itemName : 'this item'}?
          </p>
          <small className="text-muted d-block" style={{ fontSize: 'var(--font-size-secondary)' }}>
            This action cannot be undone.
          </small>
        </div>
      </div>
    </CustomModal>
  );
};

export default DeleteConfirmationModal;
