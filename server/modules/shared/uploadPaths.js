import fs from 'fs';
import path from 'path';

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

export function resolveUploadPath(candidate) {
  const raw = String(candidate ?? '').trim();
  if (!raw) return null;
  const resolved = path.resolve(raw);
  const rootWithSeparator = UPLOADS_ROOT.endsWith(path.sep)
    ? UPLOADS_ROOT
    : `${UPLOADS_ROOT}${path.sep}`;
  return resolved === UPLOADS_ROOT || resolved.startsWith(rootWithSeparator) ? resolved : null;
}

export function deleteUploadedFile(candidate) {
  const resolved = resolveUploadPath(candidate);
  if (!resolved) return false;
  try {
    fs.unlinkSync(resolved);
    return true;
  } catch (error) {
    return error?.code === 'ENOENT';
  }
}

export function sanitizeUploadFilename(filename = '') {
  const raw = String(filename ?? '').replace(/\\/g, '/');
  const extension = path.extname(raw).replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 16);
  const basename = path.basename(raw, path.extname(raw)).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  const safeBasename = /^\.+$/.test(basename) ? '' : basename;
  return `${safeBasename || 'file'}${extension}`;
}
