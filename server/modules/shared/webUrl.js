/**
 * Website values stored as master data are only ever rendered as links, so a
 * `javascript:` or `data:` value saved here would run in a reader's browser
 * when they click through. Everything that is not an http(s) address is
 * rejected at the point it is stored.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Returns the URL when it is a usable web address, or null for an empty value.
 * Throws for a value that is neither, so callers answer 400 rather than storing
 * something that cannot safely be linked.
 */
export function toStoredWebsite(value, label = 'website') {
  const text = String(value ?? '').trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(text);
  } catch {
    const error = new Error(`Enter a valid ${label} starting with http:// or https://`);
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    const error = new Error(`A ${label} must start with http:// or https://`);
    error.statusCode = 400;
    throw error;
  }

  return url.href.slice(0, 500);
}

/** Non-throwing variant for data that is already stored: bad values become null. */
export function safeStoredWebsite(value) {
  try {
    return toStoredWebsite(value);
  } catch {
    return null;
  }
}
