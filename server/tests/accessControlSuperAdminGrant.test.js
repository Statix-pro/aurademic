/**
 * `PUT /access-control/users/:id/roles` is gated on `access_control.manage`, and `updateUserRoles`
 * accepted any role code. The Admin role held that permission, so a role manager could put
 * `super_admin` in their own role list — or anyone's — and walk past every check that
 * short-circuits on isSuperAdmin. Only the separate `/super-admin` toggle was Super-Admin-only.
 *
 * Admin no longer holds it (20261025_admin_role_to_approvals_admin), but any role can be given it.
 * These pin the rule in the model, where every caller passes through it: below Super Admin you
 * may not grant or remove `super_admin`, and you may not change your own roles at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

const db = (await import('../config/connection.js')).default;
const accessControlModel = (await import('../modules/accessControl/accessControlModel.js')).default;

const ROLE_IDS = { super_admin: 1, admin: 2, finance_admin: 4, user: 8 };

// Holds access_control.manage, is not a Super Admin.
const MANAGER_ID = 42;
const TARGET_ID = 50;

// A connection that answers the queries updateUserRoles runs, by what each one selects.
// `currentEntityRoles` are the target's user_entity_roles codes.
const makeConnection = (currentTargetRoles, currentEntityRoles = []) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => {
    if (sql.includes('SELECT id FROM users')) return [[{ id: params[0] }]];
    if (sql.includes('COUNT(*) AS total')) return [[{ total: 1 }]];
    if (sql.includes('r.is_admin_role')) return [[]];
    if (sql.includes('SELECT r.role_code')) {
      return [
        [
          ...currentTargetRoles.map((role_code) => ({ role_code, scope: 'global' })),
          ...currentEntityRoles.map((role_code) => ({ role_code, scope: 'entity' })),
        ],
      ];
    }
    if (sql.includes('SELECT id, role_code FROM roles')) {
      return [params[0].map((code) => ({ id: ROLE_IDS[code], role_code: code }))];
    }
    if (sql.includes('INSERT INTO roles')) return [{ affectedRows: 2 }];
    return [{ affectedRows: 1 }];
  }),
});

const wroteRoles = (connection) =>
  connection.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM user_roles'));

let connection;

const arrange = (currentTargetRoles, currentEntityRoles = []) => {
  connection = makeConnection(currentTargetRoles, currentEntityRoles);
  db.getConnection.mockResolvedValue(connection);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(accessControlModel, 'getUserByIdWithRoles').mockResolvedValue({ id: TARGET_ID });
});

describe('updateUserRoles — Super Admin grants', () => {
  it('refuses a role manager who grants super_admin', async () => {
    arrange(['user']);

    await expect(
      accessControlModel.updateUserRoles(TARGET_ID, ['super_admin'], [], MANAGER_ID, {
        actorIsSuperAdmin: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(wroteRoles(connection)).toBe(false);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  it('refuses a role manager who removes super_admin from a Super Admin', async () => {
    arrange(['super_admin', 'user']);

    await expect(
      accessControlModel.updateUserRoles(TARGET_ID, ['finance_admin'], [], MANAGER_ID, {
        actorIsSuperAdmin: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(wroteRoles(connection)).toBe(false);
  });

  it('refuses a role manager who changes their own roles', async () => {
    arrange(['admin', 'user']);

    await expect(
      accessControlModel.updateUserRoles(MANAGER_ID, ['admin', 'finance_admin'], [], MANAGER_ID, {
        actorIsSuperAdmin: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(wroteRoles(connection)).toBe(false);
  });

  // The authorization snapshot unions user_entity_roles into a user's roles, so super_admin
  // against a department makes a full Super Admin — the role_codes check alone missed it.
  it('refuses a role manager who grants super_admin as a department role', async () => {
    arrange(['user']);

    await expect(
      accessControlModel.updateUserRoles(
        TARGET_ID,
        ['finance_admin'],
        [{ role_code: 'super_admin', entity_id: 3, entity_type: 'DEPARTMENT' }],
        MANAGER_ID,
        { actorIsSuperAdmin: false },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(wroteRoles(connection)).toBe(false);
  });

  it('refuses a role manager who drops a department-held super_admin', async () => {
    arrange(['user'], ['super_admin']);

    await expect(
      accessControlModel.updateUserRoles(TARGET_ID, ['finance_admin'], [], MANAGER_ID, {
        actorIsSuperAdmin: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(wroteRoles(connection)).toBe(false);
  });

  it('treats a caller that does not say otherwise as below Super Admin', async () => {
    arrange(['user']);

    await expect(
      accessControlModel.updateUserRoles(TARGET_ID, ['super_admin'], [], MANAGER_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets a role manager assign other roles to someone else', async () => {
    arrange(['user']);

    await accessControlModel.updateUserRoles(TARGET_ID, ['finance_admin'], [], MANAGER_ID, {
      actorIsSuperAdmin: false,
    });

    expect(wroteRoles(connection)).toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });

  it("lets a role manager edit a Super Admin's other roles while leaving super_admin in place", async () => {
    arrange(['super_admin', 'user']);

    await accessControlModel.updateUserRoles(
      TARGET_ID,
      ['super_admin', 'finance_admin'],
      [],
      MANAGER_ID,
      {
        actorIsSuperAdmin: false,
      },
    );

    expect(connection.commit).toHaveBeenCalled();
  });

  it('lets a Super Admin grant super_admin', async () => {
    arrange(['user']);

    await accessControlModel.updateUserRoles(TARGET_ID, ['super_admin'], [], 7, {
      actorIsSuperAdmin: true,
    });

    expect(wroteRoles(connection)).toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });
});
