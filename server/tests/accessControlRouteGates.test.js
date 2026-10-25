/**
 * Which caller reaches which access-control write. Every write used to sit behind
 * `access_control.manage` alone, which the Admin role held — so it could add any approval stage
 * to its own role, or define a new role with every permission and assign it.
 *
 * What a role or permission is now belongs to Super Admin; assigning existing roles to people
 * stays with `access_control.manage`, and the route tells the model who is asking so it can apply
 * the Super Admin grant rule (accessControlSuperAdminGrant.test.js).
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: {
    getUserAuthorizationSnapshot: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    updateRolePermissions: vi.fn(),
    createPermission: vi.fn(),
    updateUserRoles: vi.fn(),
  },
}));

vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

const accessControlModel = (await import('../modules/accessControl/accessControlModel.js')).default;
const app = (await import('../server.js')).default;

// Someone below Super Admin who has been given access_control.manage.
const MANAGER_SNAPSHOT = {
  roles: ['role_manager', 'user'],
  permissions: ['access_control.manage', 'access_control.read'],
  isAdmin: true,
  isSuperAdmin: false,
};

const SUPER_MANAGER_SNAPSHOT = {
  roles: ['super_admin', 'user'],
  permissions: [],
  isAdmin: true,
  isSuperAdmin: true,
};

const tokenFor = (userId) =>
  jwt.sign({ userId, email: `user${userId}@ksrct.ac.in`, name: 'Test' }, process.env.JWT_SECRET);

const as = (snapshot, userId) => {
  accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot);
  return `Bearer ${tokenFor(userId)}`;
};

beforeEach(() => {
  vi.clearAllMocks();
  accessControlModel.createRole.mockResolvedValue({ id: 99 });
  accessControlModel.updateRolePermissions.mockResolvedValue({ id: 2 });
  accessControlModel.updateUserRoles.mockResolvedValue({ id: 50, roles: [] });
});

describe('access-control route gates', () => {
  it('refuses a role manager who creates a role', async () => {
    const response = await request(app)
      .post('/api/access-control/roles')
      .set('Authorization', as(MANAGER_SNAPSHOT, 42))
      .send({ role_name: 'Everything', permission_keys: ['finance.workflow.chairman'] });

    expect(response.status).toBe(403);
    expect(accessControlModel.createRole).not.toHaveBeenCalled();
  });

  it("refuses a role manager who changes a role's permissions", async () => {
    const response = await request(app)
      .put('/api/access-control/roles/2/permissions')
      .set('Authorization', as(MANAGER_SNAPSHOT, 42))
      .send({ permission_keys: ['finance.workflow.chairman'] });

    expect(response.status).toBe(403);
    expect(accessControlModel.updateRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses a role manager who defines a permission', async () => {
    const response = await request(app)
      .post('/api/access-control/permissions')
      .set('Authorization', as(MANAGER_SNAPSHOT, 42))
      .send({ module_key: 'x', action_key: 'y' });

    expect(response.status).toBe(403);
    expect(accessControlModel.createPermission).not.toHaveBeenCalled();
  });

  it('lets a Super Admin create a role', async () => {
    const response = await request(app)
      .post('/api/access-control/roles')
      .set('Authorization', as(SUPER_MANAGER_SNAPSHOT, 7))
      .send({ role_name: 'Reviewer', permission_keys: [] });

    expect(accessControlModel.createRole).toHaveBeenCalled();
    expect(response.status).toBeLessThan(400);
  });

  it('lets a role manager assign roles, telling the model they are not a Super Admin', async () => {
    const response = await request(app)
      .put('/api/access-control/users/50/roles')
      .set('Authorization', as(MANAGER_SNAPSHOT, 42))
      .send({ role_codes: ['finance_admin'], entity_roles: [] });

    expect(response.status).toBe(200);
    expect(accessControlModel.updateUserRoles).toHaveBeenCalledWith(
      '50',
      ['finance_admin'],
      [],
      42,
      {
        actorIsSuperAdmin: false,
      },
    );
  });

  it('tells the model when the caller is a Super Admin', async () => {
    await request(app)
      .put('/api/access-control/users/50/roles')
      .set('Authorization', as(SUPER_MANAGER_SNAPSHOT, 7))
      .send({ role_codes: ['super_admin'], entity_roles: [] });

    expect(accessControlModel.updateUserRoles).toHaveBeenCalledWith('50', ['super_admin'], [], 7, {
      actorIsSuperAdmin: true,
    });
  });

  it('passes on the 403 the model raises for a Super Admin grant', async () => {
    accessControlModel.updateUserRoles.mockRejectedValue(
      Object.assign(new Error('Only a Super Admin can grant or remove Super Admin.'), {
        statusCode: 403,
      }),
    );

    const response = await request(app)
      .put('/api/access-control/users/50/roles')
      .set('Authorization', as(MANAGER_SNAPSHOT, 42))
      .send({ role_codes: ['super_admin'], entity_roles: [] });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Only a Super Admin can grant or remove Super Admin.');
  });
});
