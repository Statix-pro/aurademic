import { isBlank } from './values.js';

/**
 * ISSNs arrive in at least three shapes across the files this module reads: hyphenated
 * (`2190-572X`, Web of Science and the faculty sheet), bare (`2190572X`, Scopus), and two to
 * a cell (`"15424863, 00079235"`, SCImago). Spreadsheet tools also drop a leading zero
 * (`1418130` for `0141-8130`). Everything is reduced to the 8-character bare form for
 * matching and shown hyphenated.
 */

const checkDigitFor = (firstSeven) => {
  const sum = [...firstSeven].reduce(
    (total, digit, index) => total + Number(digit) * (8 - index),
    0,
  );
  const remainder = (11 - (sum % 11)) % 11;
  return remainder === 10 ? 'X' : String(remainder);
};

export const hasValidCheckDigit = (bare) =>
  /^\d{7}[\dX]$/.test(bare) && checkDigitFor(bare.slice(0, 7)) === bare[7];

/**
 * Reads one ISSN cell.
 *
 * Returns `null` for an empty cell, otherwise `{ issn, raw, valid, corrected }`:
 *  - `issn` is the bare 8-character value when valid, else null;
 *  - `corrected` is true when a dropped leading zero was restored. That fix is only made
 *    when the padded value passes the check digit, so it never invents an ISSN.
 */
export const parseIssn = (rawValue) => {
  const raw = String(rawValue ?? '').trim();
  // The same "empty" markers every other cell uses — dashes, N/A, None.
  if (isBlank(raw)) {
    return null;
  }

  const bare = raw.toUpperCase().replace(/[^0-9X]/g, '');

  if (hasValidCheckDigit(bare)) {
    return { issn: bare, raw, valid: true, corrected: false };
  }

  if (/^\d{7}$/.test(bare) && hasValidCheckDigit(`0${bare}`)) {
    return { issn: `0${bare}`, raw, valid: true, corrected: true };
  }

  return { issn: null, raw, valid: false, corrected: false };
};

/** Splits a cell that may hold several ISSNs (SCImago: `"15424863, 00079235"`). */
export const parseIssnList = (rawValue) =>
  String(rawValue ?? '')
    .split(/[,;\s]+/)
    .map(parseIssn)
    .filter(Boolean);

export const formatIssn = (bare) => (bare ? `${bare.slice(0, 4)}-${bare.slice(4)}` : '');

/** The bare form of whatever is stored in `journal_options.print_issn` / `online_issn`. */
export const storedIssn = (value) => parseIssn(value)?.issn ?? null;
