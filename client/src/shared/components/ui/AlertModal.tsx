import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import React from 'react';

import CustomModal from './CustomModal';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertModalProps {
  show: boolean;
  onHide: () => void;
  title?: string;
  message: React.ReactNode;
  type?: AlertType;
  onConfirm?: () => void;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
}

const AlertModal: React.FC<AlertModalProps> = ({
  show,
  onHide,
  title,
  message,
  type = 'info',
  onConfirm,
  showCancel = false,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={32} className="text-success" />;
      case 'error':
        return <AlertCircle size={32} className="text-danger" />;
      case 'warning':
        return <AlertTriangle size={32} className="text-warning" />;
      case 'info':
      default:
        return <Info size={32} className="text-info" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Information';
      default:
        return 'Alert';
    }
  };

  const isForceAction = !!onConfirm && !showCancel;

  return (
    <CustomModal
      show={show}
      onHide={onHide}
      title={title || getDefaultTitle()}
      size="sm"
      centered
      className="compact-alert-modal"
      backdrop={isForceAction ? 'static' : undefined}
      keyboard={isForceAction ? false : undefined}
      hideCloseButton={isForceAction}
      footer={
        <div className="d-flex justify-content-end gap-2 w-100">
          {showCancel && (
            <button className="btn btn-secondary btn-sm" onClick={onHide}>
              {cancelText}
            </button>
          )}
          <button
            className={`btn btn-${type === 'error' ? 'danger' : 'primary'} btn-sm`}
            onClick={() => {
              if (onConfirm) onConfirm();
              else onHide();
            }}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="d-flex align-items-start p-3">
        <div className="me-3 flex-shrink-0">{getIcon()}</div>
        {/* A div, not a p: messages carry lists (a form's validation errors, for one),
            and a ul inside a p is invalid markup the browser silently reshuffles. */}
        <div className="flex-grow-1 mb-0 fw-medium" style={{ fontSize: '0.95rem' }}>
          {message}
        </div>
      </div>
    </CustomModal>
  );
};

export default AlertModal;
