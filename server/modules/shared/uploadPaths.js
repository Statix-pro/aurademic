/**
 * Shared helpers for keeping uploaded-file handling inside `uploads/`.
 *
 * Multer writes multipart parts to disk before a handler can reject them, so controllers
 * delete files by the path multer reports. That path derives from `file.originalname`,
 * which is attacker-controlled, so every delete is confined to the uploads tree and every
 * generated filename is stripped of path syntax.
 */

import fs from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

/**
 * Resolves `candidate` and returns it only when it stays inside `uploads/`; null
 * otherwise. Compares against the root plus a separator so a sibling directory such as
 * `uploads-backup/` cannot pass as a prefix match.
 */
export function resolveUploadPath(candidate) {
  const raw = String(candidate ?? '').trim();
  if (!raw) {
    return null;
  }

  const resolved = path.resolve(raw);
  const rootWithSeparator = UPLOADS_ROOT.endsWith(path.sep)
    ? UPLOADS_ROOT
    : `${UPLOADS_ROOT}${path.sep}`;

  return resolved === UPLOADS_ROOT || resolved.startsWith(rootWithSeparator) ? resolved : null;
}

/**
 * Deletes an uploaded file, refusing anything that resolves outside `uploads/`. Returns
 * whether the file was removed; a missing file counts as removed, since the caller only
 * wants it gone.
 */
export function deleteUploadedFile(candidate) {
  const resolved = resolveUploadPath(candidate);

  if (!resolved) {
    console.error('Refused to delete an upload outside the uploads directory:', candidate);
    return false;
  }

  try {
    fs.unlinkSync(resolved);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return true;
    }
    console.error('Failed to remove rejected upload:', error);
    return false;
  }
}

/**
 * Builds a storage-safe filename from a client-supplied one: the extension is kept, the
 * base name is reduced to `[A-Za-z0-9._-]` and capped, and any directory syntax is
 * dropped. `path.basename` runs before the character filter so `../` can never survive.
 */
export function sanitizeUploadFilename(filename = '') {
  // Backslashes are separators on Windows (this app deploys to IIS) but ordinary
  // characters on POSIX, so path.basename would strip a `..\..\` prefix in production and
  // keep it in development. Normalizing first makes the result identical on both.
  const raw = String(filename ?? '').replace(/\\/g, '/');
  const extension = path
    .extname(raw)
    .replace(/[^a-zA-Z0-9.]+/g, '')
    .slice(0, 16);
  const basename = path
    .basename(raw, path.extname(raw))
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);

  // "." and ".." survive the character filter but are directory references, not names:
  // path.join(dir, '..') resolves to dir's parent. Anything that is only dots is replaced.
  const safeBasename = /^\.+$/.test(basename) ? '' : basename;

  return `${safeBasename || 'file'}${extension}`;
}
