import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { Toast as ToastModel } from './types';

/** Same icon per type as AlertModal, so a success reads the same either way. */
const ICONS: Record<ToastModel['type'], React.ReactNode> = {
  success: <CheckCircle size={18} className="text-success" />,
  error: <AlertCircle size={18} className="text-danger" />,
  warning: <AlertTriangle size={18} className="text-warning" />,
  info: <Info size={18} className="text-info" />,
};

interface ToastProps {
  toast: ToastModel;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    // duration 0 means "stay until dismissed" — used for anything the user
    // must acknowledge rather than merely notice.
    if (toast.duration <= 0 || paused) return undefined;

    startedAtRef.current = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remainingRef.current);

    return () => {
      clearTimeout(timer);
      // Preserve what was left so hovering pauses rather than restarts. Without
      // this, moving the mouse across one would keep resetting its life and it
      // would never go away.
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      );
    };
  }, [toast.duration, toast.id, paused, onDismiss]);

  return (
    // Class names are `app-toast*`, not `toast*`: Bootstrap 5 ships its own
    // `.toast` component whose `.toast:not(.show){display:none}` rule would
    // otherwise hide every one of these outright.
    <div
      className={`app-toast app-toast--${toast.type}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="app-toast-icon">{ICONS[toast.type]}</span>

      <div className="app-toast-content">
        <div className="app-toast-title">{toast.title}</div>
        {toast.body ? <div className="app-toast-body">{toast.body}</div> : null}
        {toast.actionLabel && toast.onAction ? (
          <button
            type="button"
            className="app-toast-action"
            onClick={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
          >
            {toast.actionLabel}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className="app-toast-close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={15} />
      </button>
    </div>
  );
};

export default Toast;
