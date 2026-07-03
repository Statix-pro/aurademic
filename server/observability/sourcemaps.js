import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

import { SourceMapConsumer } from 'source-map-js';

import logger from './logger.js';

// Directory where Vite places the production build. On a Windows IIS deploy the
// structure is typically:
//   project-root/
//     client/dist/assets/   ← JS bundles + .map files
//     server/               ← this code
const DIST_ASSETS_DIR = path.resolve(process.cwd(), '..', 'client', 'dist', 'assets');

// In-memory cache: filename → { consumer, loadedAt }.
// Consumers are lightweight (~20 KB each for typical bundles). We keep them for
// 10 minutes then reload so a fresh deploy's maps are picked up automatically.
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Load and cache the SourceMapConsumer for a given JS filename.
 * Returns null when no map file exists (dev mode, missing build, etc.).
 */
const getConsumer = async (jsFilename) => {
  const cached = cache.get(jsFilename);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.consumer;
  }

  const mapPath = path.join(DIST_ASSETS_DIR, `${jsFilename}.map`);
  try {
    await fsp.access(mapPath);
  } catch {
    return null; // map file doesn't exist
  }

  try {
    const raw = await fsp.readFile(mapPath, 'utf8');
    const consumer = new SourceMapConsumer(JSON.parse(raw));
    cache.set(jsFilename, { consumer, loadedAt: Date.now() });
    return consumer;
  } catch (err) {
    logger.warn({ err, mapPath }, 'failed to parse source map');
    return null;
  }
};

// Match stack frames like:
//   at Foo (https://host/assets/index-abc123.js:1:2345)
//   at https://host/assets/index-abc123.js:1:2345
// Also handles bare filenames without a full URL (e.g. index-abc123.js:1:2345).
const STACK_FRAME_RE =
  /(?:at\s+(?:\S+\s+)?\(?)(?:https?:\/\/[^/]+)?\/(?:assets\/)?([^\s:)]+):(\d+):(\d+)/g;

/**
 * Resolve a minified stack trace string into original source positions.
 * Returns the enhanced stack string. Non-matching frames are left as-is.
 * If no maps are available at all, returns the original stack unchanged.
 */
export const resolveStack = async (stack) => {
  if (!stack || typeof stack !== 'string') return stack;

  // Quick exit: if the dist/assets dir doesn't exist, there are no maps to use.
  if (!fs.existsSync(DIST_ASSETS_DIR)) return stack;

  let enhanced = stack;
  const seen = new Set();

  // Collect all matches first (we can't async-replace in a regex loop).
  const matches = [];
  let m;
  while ((m = STACK_FRAME_RE.exec(stack)) !== null) {
    const [fullMatch, file, line, col] = m;
    const key = `${file}:${line}:${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ fullMatch, file, line: Number(line), col: Number(col) });
  }

  for (const { fullMatch, file, line, col } of matches) {
    const consumer = await getConsumer(file);
    if (!consumer) continue;

    const pos = consumer.originalPositionFor({ line, column: col });
    if (pos.source) {
      const original = `${pos.source}:${pos.line}:${pos.column}${pos.name ? ` (${pos.name})` : ''}`;
      enhanced = enhanced.replace(fullMatch, `${fullMatch}\n    → ${original}`);
    }
  }

  return enhanced;
};
