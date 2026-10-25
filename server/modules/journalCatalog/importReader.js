import { ImportFormatError, readTable } from './tableReader.js';

const isPlausibleYear = (year) =>
  Number.isInteger(year) && year >= 2000 && year <= new Date().getFullYear() + 1;

/**
 * Runs a source profile over an uploaded file.
 *
 * `keep` lets a reference file (Scopus Source List, SCImago) drop the ~49,000 rows that are
 * not KSRCT journals as they are read, so only the few hundred that matter are held.
 *
 * Returns the kept records (each tagged with its line), the count of rows left out by reason,
 * the metrics year — asked of the admin for the faculty sheet, read from the header for
 * SCImago — and the SHA-256 of the file's text, which identifies it however it was uploaded.
 */
export const readSourceFile = async (source, buffer, { metricYear: requestedYear, keep } = {}) => {
  let metricYear = null;
  if (source.metricYear === 'required') {
    const year = Number(requestedYear);
    if (!isPlausibleYear(year)) {
      throw new ImportFormatError(
        'Choose the year the Impact Factor and CiteScore values in this file belong to.',
      );
    }
    metricYear = year;
  }

  const records = [];
  const excluded = {};
  let rowsRead = 0;
  let sha256 = null;

  for await (const { line, values, headers } of readTable(buffer, source, (digest) => {
    sha256 = digest;
  })) {
    if (source.metricYear === 'detect' && metricYear === null) {
      metricYear = source.detectMetricYear(headers);
      if (!isPlausibleYear(metricYear)) {
        throw new ImportFormatError(
          'Could not tell which year this file is for: no "Total Docs. (<year>)" column.',
        );
      }
    }

    rowsRead += 1;
    const record = source.toRecord(values, { metricYear });
    if (record.excluded) {
      excluded[record.excluded] = (excluded[record.excluded] ?? 0) + 1;
      continue;
    }
    if (keep && !keep(record)) {
      excluded.not_in_list = (excluded.not_in_list ?? 0) + 1;
      continue;
    }
    records.push({ ...record, line });
  }

  if (rowsRead === 0) {
    throw new ImportFormatError('The file has a header row but no data rows.');
  }

  return { records, excluded, rowsRead, metricYear, sha256 };
};
