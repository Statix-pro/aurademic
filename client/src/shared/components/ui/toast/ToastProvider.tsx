/**
 * Global transient feedback.
 *
 * The portal had no toast before this: every page hand-rolled the same
 * `alertConfig` / `showAlert` pair around `AlertModal`. Modals remain the right
 * surface for a blocking confirmation, but a notification arriving while
 * someone is mid-task must not interrupt them with a dialog — and a bell badge
 * alone is easy to miss. This is the missing middle.
 *
 * Existing `AlertModal` call sites are deliberately untouched.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import Toast from './Toast';
import './toast.css';

import type { ToastApi, ToastOptions, Toast as ToastModel, ToastType } from './types';

/** Long enough to read a title and a line of body without being a nuisance. */
const DEFAULT_DURATION_MS = 6000;

/**
 * More than a few stacked toasts is unreadable, and an approver clearing a
 * queue can trigger a burst. The oldest are dropped rather than queued: stale
 * feedback shown late is worse than not shown.
 */
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastApi | null>(null);

export const useToast = (): ToastApi => {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return api;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastModel[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const show = useCallback((options: ToastOptions): string => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}`;

    const toast: ToastModel = {
      ...options,
      id,
      type: options.type ?? 'info',
      duration: options.duration ?? DEFAULT_DURATION_MS,
    };

    setToasts((current) => [...current, toast].slice(-MAX_VISIBLE));
    return id;
  }, []);

  // Escape dismisses the newest toast. Bound once here rather than on each
  // toast because a toast is not focused — it appears beside whatever the user
  // is actually doing, so a key handler on the element itself would never fire.
  useEffect(() => {
    if (toasts.length === 0) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setToasts((current) => current.slice(0, -1));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toasts.length]);

  const api = useMemo<ToastApi>(() => {
    const shorthand = (type: ToastType) => (title: string, body?: string) =>
      show({ title, body, type });

    return {
      show,
      success: shorthand('success'),
      error: shorthand('error'),
      warning: shorthand('warning'),
      info: shorthand('info'),
      dismiss,
      dismissAll,
    };
  }, [show, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Rendered to <body> so no page's overflow or transform can clip it. */}
      {createPortal(
        <div className="app-toast-viewport">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;
