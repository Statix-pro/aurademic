/**
 * URL-safety helpers.
 *
 * Stored user-supplied URLs (event social/feedback/YouTube links, uploaded file
 * references) must never be opened or rendered without validating the scheme.
 * A value like `javascript:...` passed to `window.open`/`href` executes in the
 * app origin and can exfiltrate the JWT from localStorage. These helpers accept
 * only http(s) (and same-origin blob/relative) URLs and reject everything else.
 */

const SAFE_PROTOCOLS = ['http:', 'https:'];

/**
 * Returns a safe URL string, or null if the value is missing or uses an unsafe
 * scheme (e.g. `javascript:`, `data:`, `vbscript:`).
 */
export const sanitizeUrl = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Allow site-relative paths and blob URLs generated in-app (locally selected files).
  if (trimmed.startsWith('/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (SAFE_PROTOCOLS.includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
};

/** Opens a URL in a new tab only if it passes scheme validation. */
export const safeOpen = (value: string | null | undefined): void => {
  const url = sanitizeUrl(value);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
