import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import readline from 'readline';

import logger from './logger.js';

// File-backed store for browser telemetry (errors, web vitals, session
// replays). JSONL on disk — no DB schema, no external service.
const DATA_DIR = path.join(process.cwd(), 'observability-data');
const CLIENT_ERRORS_FILE = path.join(DATA_DIR, 'client-errors.jsonl');
const SERVER_ERRORS_FILE = path.join(DATA_DIR, 'server-errors.jsonl');
const WEB_VITALS_FILE = path.join(DATA_DIR, 'web-vitals.jsonl');

const RETENTION_DAYS = Number(process.env.OBSERVABILITY_RETENTION_DAYS || 7);
const MAX_LOG_FILE_BYTES = 20 * 1024 * 1024; // rotate JSONL files past 20 MB

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const rotateIfNeeded = async (file) => {
  try {
    const stat = await fsp.stat(file);
    if (stat.size > MAX_LOG_FILE_BYTES) {
      await fsp.rename(file, `${file}.1`); // keep one previous generation
    }
  } catch {
    // file does not exist yet
  }
};

const appendJsonl = async (file, record) => {
  await rotateIfNeeded(file);
  await fsp.appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
};

const readJsonlTail = async (file, limit) => {
  try {
    await fsp.access(file);
  } catch {
    return [];
  }

  const records = [];
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
      if (records.length > limit * 2) records.splice(0, records.length - limit);
    } catch {
      // skip corrupt line
    }
  }

  return records.slice(-limit).reverse();
};

export const appendClientError = (record) => appendJsonl(CLIENT_ERRORS_FILE, record);
export const appendServerError = (record) => appendJsonl(SERVER_ERRORS_FILE, record);
export const appendWebVital = (record) => appendJsonl(WEB_VITALS_FILE, record);

export const readClientErrors = (limit = 200) => readJsonlTail(CLIENT_ERRORS_FILE, limit);
export const readServerErrors = (limit = 200) => readJsonlTail(SERVER_ERRORS_FILE, limit);
export const readWebVitals = (limit = 500) => readJsonlTail(WEB_VITALS_FILE, limit);

/* ================= RETENTION ================= */

export const cleanupOldData = async () => {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    // Drop rotated generations of the JSONL logs past retention too.
    for (const file of [CLIENT_ERRORS_FILE, SERVER_ERRORS_FILE, WEB_VITALS_FILE]) {
      const rotated = `${file}.1`;
      try {
        const stat = await fsp.stat(rotated);
        if (stat.mtime.getTime() < cutoff) await fsp.unlink(rotated);
      } catch {
        // no rotated file
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'observability retention cleanup failed');
  }
};

export const startRetentionSchedule = () => {
  cleanupOldData();
  const timer = setInterval(cleanupOldData, 6 * 60 * 60 * 1000);
  timer.unref();
  return timer;
};
