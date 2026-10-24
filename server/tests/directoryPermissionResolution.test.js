import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../config/connection.js', () => ({
  default: { query },
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';

describe('directory permission resolution', () => {
  beforeEach(() => query.mockReset());

  it('does not restore revoked directory permissions while resolving user authorization', async () => {
    query
      .mockResolvedValueOnce([[{ id: 9, is_admin: 0 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ role_code: 'user', is_admin_role: 0 }]])
      .mockResolvedValueOnce([[{ permission_key: 'events.read' }]]);

    const snapshot = await accessControlModel.getUserAuthorizationSnapshot(9);

    expect(query.mock.calls.some(([sql]) => /INSERT IGNORE INTO role_permissions/.test(sql))).toBe(
      false,
    );
    expect(snapshot.permissions).toEqual(['events.read']);
  });

  // A database built from scratch has no `user` role until the first sign-in creates
  // it, after the directory migration has already granted its keys to existing roles.
  it('grants directory keys to the base role only on the call that creates it', async () => {
    query
      .mockResolvedValueOnce([{ affectedRows: 1, insertId: 15 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([{}]);

    await accessControlModel.ensureUserHasBaseRole(9);

    const grant = query.mock.calls.find(([sql]) => /INTO role_permissions/.test(sql));
    expect(grant[1]).toEqual([15, ['directory.read', 'directory.create', 'directory.edit']]);
  });

  it.each([0, 2])(
    'does not re-grant directory keys when the base role already exists (affectedRows %i)',
    async (affectedRows) => {
      query
        .mockResolvedValueOnce([{ affectedRows, insertId: 0 }])
        .mockResolvedValueOnce([[{ id: 15 }]])
        .mockResolvedValueOnce([{}]);

      await accessControlModel.ensureUserHasBaseRole(9);

      expect(query.mock.calls.some(([sql]) => /INTO role_permissions/.test(sql))).toBe(false);
    },
  );
});
