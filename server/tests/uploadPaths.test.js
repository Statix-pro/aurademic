import path from 'path';

import { describe, expect, it } from 'vitest';

import { resolveUploadPath, sanitizeUploadFilename } from '../modules/shared/uploadPaths.js';

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

describe('resolveUploadPath', () => {
  it('accepts paths inside the uploads tree', () => {
    expect(resolveUploadPath(path.join(uploadsRoot, 'temp', 'a.pdf'))).toBe(
      path.join(uploadsRoot, 'temp', 'a.pdf'),
    );
    expect(resolveUploadPath(uploadsRoot)).toBe(uploadsRoot);
  });

  it('rejects traversal out of the uploads tree', () => {
    expect(resolveUploadPath(path.join(uploadsRoot, '..', '..', 'etc', 'passwd'))).toBeNull();
    expect(resolveUploadPath('/etc/passwd')).toBeNull();
    expect(resolveUploadPath(`${uploadsRoot}/temp/../../server.js`)).toBeNull();
  });

  it('rejects a sibling directory that merely shares the prefix', () => {
    expect(resolveUploadPath(`${uploadsRoot}-backup/a.pdf`)).toBeNull();
  });

  it('rejects empty input', () => {
    expect(resolveUploadPath('')).toBeNull();
    expect(resolveUploadPath(null)).toBeNull();
    expect(resolveUploadPath(undefined)).toBeNull();
  });
});

describe('sanitizeUploadFilename', () => {
  it('keeps an ordinary name and extension intact', () => {
    expect(sanitizeUploadFilename('Budget Report.pdf')).toBe('Budget_Report.pdf');
    expect(sanitizeUploadFilename('bulk-neft.xlsx')).toBe('bulk-neft.xlsx');
  });

  it('strips directory syntax so a name cannot escape its folder', () => {
    expect(sanitizeUploadFilename('../../../etc/passwd')).toBe('passwd');
    // Backslash-separated too, so the result is the same on IIS and on POSIX.
    expect(sanitizeUploadFilename('..\\..\\windows\\system32\\evil.exe')).toBe('evil.exe');
    expect(sanitizeUploadFilename('/absolute/path/file.pdf')).toBe('file.pdf');
    expect(sanitizeUploadFilename('..')).toBe('file');
  });

  it('falls back to a placeholder when nothing usable is left', () => {
    expect(sanitizeUploadFilename('')).toBe('file');
    expect(sanitizeUploadFilename('///')).toBe('file');
  });

  it('caps a very long base name', () => {
    const result = sanitizeUploadFilename(`${'a'.repeat(300)}.pdf`);
    expect(result).toBe(`${'a'.repeat(80)}.pdf`);
  });
});
