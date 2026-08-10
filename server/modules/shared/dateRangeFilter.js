/**
 * Shared date-range filtering for the admin CSV exports.
 *
 * The exports cap at a fixed number of rows, so every filter the user picks has to be
 * applied in SQL — narrowing the set after the cap would drop matching records that sit
 * beyond it. Each caller passes the column expression its own "Date" column displays, so
 * a filtered file can never contain a row whose visible date falls outside the range.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Accepts `YYYY-MM-DD` (what `<input type="date">` submits) and returns it unchanged, or
 * null for anything unparseable — an invalid bound is ignored rather than rejected, so a
 * stray query param can never turn into a SQL error or silently match nothing.
 */
export function normalizeDateOnly(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return null;
  }

  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Rejects real-looking but invalid dates such as 2026-02-31, which Date would roll
  // forward into March rather than fail on.
  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

/**
 * Normalizes a from/to pair, swapping the bounds when they arrive reversed so a
 * back-to-front range still returns the window the user meant.
 */
export function normalizeDateRange({ dateFrom, dateTo } = {}) {
  let from = normalizeDateOnly(dateFrom);
  let to = normalizeDateOnly(dateTo);

  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return { dateFrom: from, dateTo: to };
}

/**
 * Builds the WHERE fragment for a date window over `columnExpr`, which must evaluate to
 * a DATE (callers wrap timestamps in DATE()/COALESCE themselves so the comparison stays
 * inclusive of the whole end day).
 *
 * @param {string} columnExpr - SQL expression for the row's display date.
 * @param {{dateFrom?: string, dateTo?: string}} range - raw from/to values.
 * @returns {{sql: string, params: string[]}} empty sql when neither bound is usable.
 */
export function buildDateRangeCondition(columnExpr, range = {}) {
  const { dateFrom, dateTo } = normalizeDateRange(range);

  if (!dateFrom && !dateTo) {
    return { sql: '', params: [] };
  }

  if (dateFrom && dateTo) {
    return { sql: `${columnExpr} BETWEEN ? AND ?`, params: [dateFrom, dateTo] };
  }

  return dateFrom
    ? { sql: `${columnExpr} >= ?`, params: [dateFrom] }
    : { sql: `${columnExpr} <= ?`, params: [dateTo] };
}
