/**
 * Shared helpers for building and downloading multi-section CSV exports.
 *
 * A "multi-section" CSV is a single file that stacks several labelled blocks
 * (title row, header row, data rows) separated by blank lines. Excel and Google
 * Sheets both open this fine and it keeps a summary + totals in one download.
 */

export type CsvCell = string | number | null | undefined;

/**
 * Text cells that a spreadsheet would evaluate as a formula (`=`, `+`, `@`, or a
 * leading `-` that isn't a plain number, plus tab/CR starts) get a leading
 * apostrophe so Excel and Sheets treat them as literal text. Numbers are exempt
 * so amount columns still add up.
 */
const neutralizeCsvFormula = (value: CsvCell, stringValue: string): string => {
  if (typeof value === 'number') {
    return stringValue;
  }

  if (!/^[=+@\t\r]/.test(stringValue) && !/^-/.test(stringValue)) {
    return stringValue;
  }

  // A genuine negative number ("-1500", "-1500.50") is safe to leave alone.
  if (stringValue.startsWith('-') && Number.isFinite(Number(stringValue))) {
    return stringValue;
  }

  return `'${stringValue}`;
};

/**
 * Wraps a value in quotes when it contains a comma, quote, or newline, and
 * doubles any embedded quotes (RFC 4180). Formula-leading text is neutralized
 * first so an exported cell can never execute in a spreadsheet.
 */
export const escapeCsvValue = (value: CsvCell): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const rawValue = String(value);
  if (rawValue === '') {
    return '';
  }

  const stringValue = neutralizeCsvFormula(value, rawValue);

  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const buildCsvRow = (cells: CsvCell[]): string => cells.map(escapeCsvValue).join(',');

/**
 * Builds one labelled section: an optional title row, an optional header row,
 * and the data rows. Returns an empty string when there is nothing to render.
 */
export const buildCsvSection = (title: string, headers: string[], rows: CsvCell[][]): string => {
  const lines: string[] = [];

  if (title) {
    lines.push(buildCsvRow([title]));
  }
  if (headers.length) {
    lines.push(buildCsvRow(headers));
  }
  rows.forEach((row) => {
    lines.push(buildCsvRow(row));
  });

  return lines.join('\n');
};

/**
 * Joins section strings (and free-form header lines) with a blank line between
 * each, dropping empty pieces so callers can pass conditional sections.
 */
export const joinCsvSections = (sections: Array<string | null | undefined>): string =>
  sections.filter((section) => Boolean(section && section.trim() !== '')).join('\n\n');

/** DD.MM.YYYY, or an empty string when the value is missing/unparseable. */
export const formatDateForCsv = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // A date-only string ("2026-08-10", what `<input type="date">` and MySQL DATE columns
  // produce) is parsed by Date as UTC midnight but read back in local time, which lands a
  // day early for anyone behind UTC. Reformat the parts directly instead of round-tripping.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}.${month}.${year}`;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
};

/**
 * Amount columns stay as plain numbers so spreadsheets can sum them. Use
 * `formatCurrency` only for labels/notes that a human reads, never for a column
 * that needs to add up.
 */
export const formatAmountForCsv = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Indian-format currency with a ₹ prefix, for human-readable label cells. */
export const formatCurrency = (value: unknown): string =>
  `₹ ${formatAmountForCsv(value).toLocaleString('en-IN')}`;

/** Strips characters that are awkward in filenames and collapses whitespace. */
export const sanitizeCsvFilenamePart = (value: string): string =>
  String(value || '')
    .replace(/[^\w\-.]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');

export const buildCsvFilename = (parts: Array<string | number | null | undefined>): string => {
  const cleaned = parts
    .map((part) => sanitizeCsvFilenamePart(String(part ?? '')))
    .filter((part) => part !== '');
  return `${cleaned.join('_') || 'export'}.csv`;
};

/** Triggers a browser download of `content` as a UTF-8 `.csv` file. */
export const downloadCsv = (filename: string, content: string): void => {
  // The BOM keeps Excel from mangling ₹ and non-ASCII names.
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** "FY 2026-27" from the fiscal year's starting calendar year. */
export const formatFiscalYearLabel = (fiscalYear: number): string => {
  const year = Number(fiscalYear);
  if (!Number.isFinite(year) || year <= 0) {
    return '';
  }
  return `FY ${year}-${String(year + 1).slice(2)}`;
};
