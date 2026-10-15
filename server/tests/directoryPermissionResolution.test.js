import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../config/connection.js', () => ({
  default: { query },
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';

describe('directory permission resolution', () => {
  beforeEach(() => query.mockReset());

  it('grants directory permissions when the base user role is created after migration', async () => {
    query
      .mockResolvedValueOnce([[{ id: 9, is_admin: 0 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 15 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ role_code: 'user', is_admin_role: 0 }]])
      .mockResolvedValueOnce([
        [
          { permission_key: 'directory.create' },
          { permission_key: 'directory.edit' },
          { permission_key: 'directory.read' },
        ],
      ]);

    const snapshot = await accessControlModel.getUserAuthorizationSnapshot(9);
    const grantQuery = query.mock.calls.find(([sql]) =>
      /INSERT IGNORE INTO role_permissions/.test(sql),
    );

    expect(grantQuery[0]).toMatch(
      /SELECT \?, id\s+FROM permissions\s+WHERE module_key = 'directory'/,
    );
    expect(grantQuery[1]).toEqual([15]);
    expect(snapshot.permissions).toEqual(['directory.create', 'directory.edit', 'directory.read']);
  });
});
