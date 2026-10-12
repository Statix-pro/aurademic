/** Shared toast vocabulary. Kept in its own module so the provider, the hook
 *  and the component can import it without a cycle. */

/** Matches `AlertType` in AlertModal so the two surfaces read as one system. */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title: string;
  body?: string;
  type?: ToastType;
  /** Label for the optional action button, e.g. "View". */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before auto-dismiss. `0` keeps it up until dismissed. */
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: string;
  type: ToastType;
  duration: number;
}

export interface ToastApi {
  show: (options: ToastOptions) => string;
  success: (title: string, body?: string) => string;
  error: (title: string, body?: string) => string;
  warning: (title: string, body?: string) => string;
  info: (title: string, body?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}
