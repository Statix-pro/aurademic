import crypto from 'crypto';
import { pipeline, Readable, Transform } from 'stream';
import zlib from 'zlib';

import { parse } from 'csv-parse';

/**
 * Raised when a file is not the one its source profile describes — a missing or renamed
 * column, an empty file. The message names what was expected and what was found, because
 * it is shown to the admin as-is.
 */
export class ImportFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportFormatError';
    this.statusCode = 400;
  }
}

/** How far down a file the header row may sit (the Scopus workbook sheets start on row 1 or 3). */
const HEADER_SCAN_LIMIT = 15;

/**
 * The admin screen gzips a file before upload: a Scopus export with abstracts and reference
 * lists is ~29 MB as text, against IIS's 30 MB request limit, and ~5× smaller compressed.
 * Unpacked text is capped so a small upload cannot expand without bound.
 */
const MAX_TEXT_BYTES = 200 * 1024 * 1024;

const isGzip = (buffer) => buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

/**
 * The stages that turn the upload into text — unzipping it if it arrived gzipped — with a
 * SHA-256 of that text taken on the way through, so the same data is recognised as the same
 * file however it was compressed.
 */
const textStages = (buffer) => {
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_TEXT_BYTES) {
        callback(new ImportFormatError('The file is too large once unzipped.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  const source = Readable.from([buffer]);
  const stages = isGzip(buffer) ? [source, zlib.createGunzip(), meter] : [source, meter];
  return { stages, digest: () => hash.digest('hex') };
};

const gzipError = (error) =>
  error?.code?.startsWith?.('Z_')
    ? new ImportFormatError('The compressed file is damaged.')
    : error;

/** The parser's records, with zlib's own error codes turned into a message for the admin. */
async function* rowsOf(parser) {
  try {
    yield* parser;
  } catch (error) {
    throw gzipError(error);
  }
}

const normalizeHeader = (value) =>
  String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const headerMatches = (header, alias) =>
  alias instanceof RegExp ? alias.test(header) : header === normalizeHeader(alias);

/**
 * Maps each profile column to its index in a candidate header row. The first matching
 * column wins, which is what SCImago's duplicated `Publisher` header needs.
 */
const locateColumns = (row, columns) => {
  const headers = row.map(normalizeHeader);
  const located = {};
  for (const [key, spec] of Object.entries(columns)) {
    const index = headers.findIndex((header) =>
      spec.headers.some((alias) => headerMatches(header, alias)),
    );
    if (index !== -1) located[key] = index;
  }
  return located;
};

const missingRequired = (located, columns) =>
  Object.entries(columns)
    .filter(([key, spec]) => spec.required && located[key] === undefined)
    .map(([, spec]) => spec.label ?? String(spec.headers[0]));

/**
 * Reads a delimited file (plain or gzipped) row by row and yields `{ line, values, headers }`,
 * where `values` is keyed by the profile's column names. The header row is found by looking
 * for one that carries every required column, so title rows above it (as in the Scopus
 * workbook) are skipped; a file without such a row is refused with the columns it lacks.
 *
 * Records are streamed rather than parsed into one array: the Scopus Source List is ~50,000
 * rows by 52 columns, and only the handful of KSRCT journals in it are kept. `onDigest`
 * receives the SHA-256 of the file's text once it has been read to the end.
 */
export async function* readTable(buffer, { delimiter, quote = '"', columns }, onDigest) {
  const text = textStages(buffer);
  const parser = parse({
    delimiter,
    quote,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    // Each record carries its own line number; the parser runs ahead of this loop, so
    // the parser-wide counter would name a later line.
    info: true,
  });
  // pipeline() destroys every stage when one fails, so a damaged gzip or an oversized file
  // ends the loop below with that error instead of leaving it waiting for more rows.
  pipeline(...text.stages, parser, () => {});

  let located = null;
  let headers = null;
  let firstRowMissing = null;
  let scanned = 0;

  for await (const { record, info } of rowsOf(parser)) {
    const line = info.lines;

    if (!located) {
      scanned += 1;
      const candidate = locateColumns(record, columns);
      const missing = missingRequired(candidate, columns);
      if (missing.length === 0) {
        located = candidate;
        headers = record.map((header) => String(header ?? '').trim());
        continue;
      }
      firstRowMissing ??= missing;
      if (scanned >= HEADER_SCAN_LIMIT) break;
      continue;
    }

    const values = {};
    for (const [key, index] of Object.entries(located)) {
      values[key] = record[index] ?? '';
    }
    yield { line, values, headers };
  }

  if (!located) {
    throw new ImportFormatError(
      firstRowMissing
        ? `This file does not look like the expected format. Missing column(s): ${firstRowMissing.join(', ')}.`
        : 'The file is empty.',
    );
  }
  onDigest?.(text.digest());
}
