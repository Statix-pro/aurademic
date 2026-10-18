import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { safeResolvePath } from '../utils/pathSecurity.js';

describe('safeResolvePath', () => {
  it('resolves a file inside the trusted directory', () => {
    const base = path.resolve('uploads', 'guesthouse');
    expect(safeResolvePath(base, 'document.pdf')).toBe(path.join(base, 'document.pdf'));
  });

  it('rejects parent traversal and sibling-prefix paths', () => {
    const base = path.resolve('uploads');
    expect(safeResolvePath(base, '../uploads-evil/document.pdf')).toBeNull();
    expect(safeResolvePath(base, '..')).toBeNull();
  });

  it('rejects an empty path', () => {
    expect(safeResolvePath(path.resolve('uploads'), '')).toBeNull();
  });
});
