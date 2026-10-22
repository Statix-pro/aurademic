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
});
