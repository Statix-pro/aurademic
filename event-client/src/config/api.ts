// Dev: /api is proxied to :5000 by vite.config.ts.
// Prod: IIS rewrites /api on the event subdomain to the shared backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const TOKEN_STORAGE_KEY = 'ep_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);
export const setStoredToken = (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearStoredToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

export class ApiError extends Error {
  status: number;
  shouldLogout: boolean;

  constructor(message: string, status: number, shouldLogout = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.shouldLogout = shouldLogout;
  }
}

/** Fetch wrapper that attaches the participant token and unwraps { success, data }. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const body = (payload ?? {}) as {
    success?: boolean;
    message?: string;
    /** Express's app-wide errorHandler answers `{ error }`, not `{ message }`. */
    error?: string;
    shouldLogout?: boolean;
    data?: T;
  };

  if (!response.ok || body.success === false) {
    if (body.shouldLogout) {
      clearStoredToken();
    }

    throw new ApiError(
      body.message || body.error || `Request failed (${response.status})`,
      response.status,
      Boolean(body.shouldLogout),
    );
  }

  return (body.data ?? (payload as T)) as T;
}
