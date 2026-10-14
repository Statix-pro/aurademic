/**
 * Date normalization for project rows.
 *
 * mysql2 returns a DATE column as a JS Date at local midnight. `JSON.stringify`
 * then emits it in UTC, which moves the day backwards for every timezone ahead
 * of UTC — a project submitted on the 15th reaches the client as the 14th. The
 * aggregate loader formats its dates in SQL; the list queries select `rp.*`, so
 * they normalize here instead.
 *
 * The local getters are the right ones: the driver built the Date from the
 * stored calendar date using the local timezone, so reading it back the same
 * way returns the day that is actually in the database.
 */

/** DATE columns on `research_projects`. */
export const PROJECT_DATE_COLUMNS = [
  'submitted_on',
  'cfrd_copy_submitted_on',
  'presentation_date',
  'result_date',
  'sanction_date',
  'project_start_date',
  'project_closing_date',
];

/** Formats one value as `YYYY-MM-DD`, leaving nulls and plain strings alone. */
export function toDateString(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;

  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

/**
 * Returns a copy of `row` with its project date columns as `YYYY-MM-DD`
 * strings. Pass extra column names for date columns joined in from elsewhere.
 */
export function formatProjectDates(row, extraColumns = []) {
  if (!row) return row;

  const formatted = { ...row };
  [...PROJECT_DATE_COLUMNS, ...extraColumns].forEach((column) => {
    if (column in formatted) {
      formatted[column] = toDateString(formatted[column]);
    }
  });
  return formatted;
}

export const formatProjectDateRows = (rows = [], extraColumns = []) =>
  rows.map((row) => formatProjectDates(row, extraColumns));
