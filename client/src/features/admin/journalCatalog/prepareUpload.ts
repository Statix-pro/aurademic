import type { ImportSource } from './types';

/**
 * Turns the file an admin picked into what the import endpoint reads: delimited text, gzipped.
 *
 * - A workbook (`.xlsx`, the Scopus Source List) is read here, in the browser, and only the
 *   sheet the source needs is sent as CSV. Reading it on the server took ~750 MB for a few
 *   seconds, and the production server's memory is not known; the admin's own machine does it
 *   once a year instead. The reader runs its unzipping and parsing in background workers, so
 *   the page stays responsive.
 * - Everything is gzipped before upload. A Scopus export with abstracts is ~29 MB of text —
 *   right at IIS's 30 MB request limit — and ~10 MB compressed. The server unzips it.
 */

export class UploadPreparationError extends Error {}

/** Field text for one CSV cell: quoted when it carries a comma, quote or line break. */
const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: unknown[][]): string =>
  rows.map((row) => row.map(csvCell).join(',')).join('\n');

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Whether the first rows of a sheet carry every column the source requires. */
const hasRequiredHeader = (rows: unknown[][], requiredColumns: string[]) =>
  rows.slice(0, 15).some((row) => {
    const headers = new Set(row.map(normalizeHeader));
    return requiredColumns.every((column) => headers.has(normalizeHeader(column)));
  });

/**
 * The sheet the source describes. The Scopus Source List keeps its titles on the first sheet,
 * but that sheet is renamed every month ("Scopus Sources Sep. 2026"), so it is found by
 * position first and, failing that, by the name pattern the server gives for the source —
 * the reader's "sheet not found" error lists every sheet in the workbook.
 */
const readWorkbookSheet = async (file: File, source: ImportSource): Promise<unknown[][]> => {
  const { readSheet } = await import('read-excel-file/web-worker');

  const first = (await readSheet(file, 1)) as unknown[][];
  if (hasRequiredHeader(first, source.requiredColumns)) return first;

  if (source.workbookSheet) {
    const pattern = new RegExp(source.workbookSheet, 'i');
    let sheetNames: string[] = [];
    try {
      await readSheet(file, '\u0000 list sheets \u0000');
    } catch (error) {
      sheetNames = (error as { sheets?: string[] }).sheets ?? [];
    }
    const match = sheetNames.find((name) => pattern.test(name));
    if (match) return (await readSheet(file, match)) as unknown[][];
  }

  throw new UploadPreparationError(
    `This workbook has no sheet with the columns ${source.requiredColumns.join(', ')}.`,
  );
};

const gzip = async (blob: Blob): Promise<Blob> => {
  // Supported by every current browser; without it the file goes as it is, which still works
  // up to the server's limit.
  if (typeof CompressionStream === 'undefined') return blob;
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
};

const isWorkbook = (file: File) => /\.xlsx$/i.test(file.name);

/** gzip's magic number, so an already-compressed upload is sent as it is, not zipped twice. */
const isGzipped = async (file: File) => {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  return head[0] === 0x1f && head[1] === 0x8b;
};

export interface PreparedUpload {
  blob: Blob;
  fileName: string;
}

export const prepareUpload = async (file: File, source: ImportSource): Promise<PreparedUpload> => {
  if (!isWorkbook(file) && (await isGzipped(file))) {
    return { blob: file, fileName: /\.gz$/i.test(file.name) ? file.name : `${file.name}.gz` };
  }

  const text = isWorkbook(file)
    ? new Blob([toCsv(await readWorkbookSheet(file, source))], { type: 'text/csv' })
    : file;
  const compressed = await gzip(text);
  const baseName = isWorkbook(file) ? file.name.replace(/\.xlsx$/i, '.csv') : file.name;

  return {
    blob: compressed,
    fileName: compressed === text ? baseName : `${baseName}.gz`,
  };
};
