// Dev: /api is proxied to :5000 by vite.config.ts.
// Prod: IIS rewrites /api on the event subdomain to the shared backend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
