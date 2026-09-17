/**
 * `mergeAuthorizationSnapshot` stopped trusting the token for `isAdmin` /
 * `isSuperAdmin`, but `roles` and `permissions` still fell back to the token
 * whenever the database snapshot came back empty.
 *
 * Every user row gets a `base_user` role assignment, so a resolved user always
 * carries at least one role. An empty snapshot therefore means the user is
 * gone — and the fallback handed a deleted account its old roles and
 * permissions back out of a token that stays valid for 24h.
 * `permissionMiddleware` matched on those token permissions, and the workflow
 * layer reads `roles` directly (`isSuperAdminActor`), so the account kept its
 * authority until the token expired.
 *
 * These tests pin the authority source: once the snapshot resolves, the token
 * contributes nothing.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  default: { listQueue: vi.fn() },
}));

vi.mock('../modules/finance/financeModel.js', () => ({
  default: { getFinanceOwner: vi.fn() },
}));

vi.mock('../modules/masterData/masterDataModel.js', () => ({
  default: { getDepartments: vi.fn() },
}));

vi.mock('../modules/formOptions/formOptionsModel.js', () => ({
  default: { getJournalOptions: vi.fn() },
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';
import formOptionsModel from '../modules/formOptions/formOptionsModel.js';
import masterDataModel from '../modules/masterData/masterDataModel.js';
import workflowService from '../modules/shared/workflow/workflowService.js';
import app from '../server.js';

const RESOLVED_SNAPSHOT = {
  roles: ['base_user'],
  permissions: [],
  isAdmin: false,
  isSuperAdmin: false,
};

let staleToken;

beforeEach(() => {
  vi.clearAllMocks();
  workflowService.listQueue.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    statusCounts: {},
  });
  staleToken = jwt.sign(
    {
      userId: 99,
      email: 'removed@ksrct.ac.in',
      name: 'Removed User',
      roles: ['super_admin'],
      permissions: ['finance.workflow.dof'],
      isSuperAdmin: true,
      isAdmin: true,
    },
    process.env.JWT_SECRET,
  );
});

describe('token authority after the database snapshot resolves', () => {
  it('refuses a user the database no longer knows, whatever the token claims', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
      roles: [],
      permissions: [],
      isAdmin: false,
      isSuperAdmin: false,
    });

    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(403);

    expect(workflowService.listQueue).not.toHaveBeenCalled();
  });

  it('does not let a stale token permission satisfy permissionMiddleware', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(RESOLVED_SNAPSHOT);

    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(403);

    expect(workflowService.listQueue).not.toHaveBeenCalled();
  });

  it('does not let a stale token role reach the workflow layer as super admin', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
      ...RESOLVED_SNAPSHOT,
      permissions: ['finance.workflow.dof'],
    });

    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(200);

    const [{ actor }] = workflowService.listQueue.mock.calls[0];
    expect(actor.roles).toEqual(['base_user']);
    expect(actor.isSuperAdmin).toBe(false);
  });
});

/**
 * The degraded branch -- the RBAC tables cannot be read at all -- deliberately
 * falls back to the token, because a stale copy beats locking the estate out of
 * an install that is merely half-migrated.
 *
 * `super_admin` is the one claim that cannot come along. `isSuperAdminActor`
 * reads `actor.roles` directly and never consults `isSuperAdmin`, so leaving
 * the role in would let a forged token hold full workflow authority on the one
 * path where the database cannot contradict it -- super admin has no `users`
 * column behind it, only a role assignment.
 */
describe('the degraded snapshot does not restore super admin from the token', () => {
  const degradedSnapshot = {
    roles: [],
    permissions: [],
    isSuperAdmin: false,
    isAdmin: true,
    degraded: true,
  };

  it('keeps the token permissions that let a half-migrated install work', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(degradedSnapshot);

    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(200);

    const [{ actor }] = workflowService.listQueue.mock.calls[0];
    expect(actor.permissions).toEqual(['finance.workflow.dof']);
  });

  it('strips super_admin from the roles the workflow layer sees', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(degradedSnapshot);

    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(200);

    const [{ actor }] = workflowService.listQueue.mock.calls[0];
    expect(actor.roles).not.toContain('super_admin');
    expect(actor.isSuperAdmin).toBe(false);
  });

  it('refuses a super-admin-only route in that state', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(degradedSnapshot);

    await request(app)
      .get('/api/master-data/departments')
      .set('Authorization', `Bearer ${staleToken}`)
      .expect(403);
  });
});

/**
 * The other half of the same guarantee: a real super admin loses nothing. The
 * `super_admin` role is the only source of that authority -- there is no
 * `users.is_super_admin` column -- so the snapshot resolves it from the role
 * assignment and every gate reads it from there. These pin that a super admin
 * still clears each gate even with zero permission rows behind the role.
 */
describe('a genuine super admin keeps full authority', () => {
  const superAdminSnapshot = {
    roles: ['super_admin'],
    permissions: [],
    isAdmin: true,
    isSuperAdmin: true,
    degraded: false,
  };

  let superAdminToken;

  beforeEach(() => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(superAdminSnapshot);
    masterDataModel.getDepartments.mockResolvedValue([]);
    formOptionsModel.getJournalOptions.mockResolvedValue([]);
    superAdminToken = jwt.sign(
      { userId: 1, email: 'super@ksrct.ac.in', name: 'Super Admin' },
      process.env.JWT_SECRET,
    );
  });

  it('clears permissionMiddleware with no permissions of its own', async () => {
    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(workflowService.listQueue).toHaveBeenCalled();
  });

  it('reaches the workflow layer as super admin, so scope resolution is unrestricted', async () => {
    await request(app)
      .get('/api/finance-requests/queue/dof')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    const [{ actor }] = workflowService.listQueue.mock.calls[0];
    expect(actor.isSuperAdmin).toBe(true);
    expect(actor.roles).toContain('super_admin');
  });

  it('clears superAdminMiddleware even when the token says nothing', async () => {
    await request(app)
      .get('/api/master-data/departments')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });

  it('clears adminAuthMiddleware on a route that also checks permissions', async () => {
    await request(app)
      .get('/api/form-options/journals')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
  });
});
