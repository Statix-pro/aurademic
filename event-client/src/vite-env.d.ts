/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path or URL of the shared backend API, e.g. `/api`. */
  readonly VITE_API_URL: string;
  /** Google OAuth client ID for public participant sign-in. */
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
