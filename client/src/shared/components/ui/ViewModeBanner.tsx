import { Eye, Lock } from 'lucide-react';
import React from 'react';
import './ViewModeBanner.css';

interface ViewModeBannerAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ViewModeBannerProps {
  message: React.ReactNode;
  title?: string;
  /** A lock instead of an eye: the record cannot be edited directly from here. */
  locked?: boolean;
  action?: ViewModeBannerAction;
}

const ViewModeBanner: React.FC<ViewModeBannerProps> = ({
  message,
  title = 'View mode',
  locked = false,
  action,
}) => (
  <div className="view-mode-banner">
    <span className="view-mode-banner__icon" aria-hidden="true">
      {locked ? <Lock size={18} /> : <Eye size={18} />}
    </span>
    <div className="view-mode-banner__text">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
    {action && (
      <button
        type="button"
        className="btn view-mode-banner__action"
        onClick={action.onClick}
        disabled={action.disabled}
      >
        {action.icon}
        {action.label}
      </button>
    )}
  </div>
);

export default ViewModeBanner;
