import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../middleware/authMiddleware.js', () => {
  const authMiddleware = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    req.user = {
      id: 1,
      authorizationResolved: true,
      isSuperAdmin: req.headers.authorization === 'Bearer super-admin',
      permissions:
        req.headers.authorization === 'Bearer directory-user'
          ? ['directory.read', 'directory.create', 'directory.edit']
          : [],
    };
    return next();
  };
  const superAdminMiddleware = (req, res, next) => {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    return next();
  };
  return {
    adminAuthMiddleware: authMiddleware,
    authMiddleware,
    authorizationSnapshotMiddleware: authMiddleware,
    permissionMiddleware: (requiredPermissions) => (req, res, next) => {
      if (
        req.user?.isSuperAdmin ||
        requiredPermissions.some((key) => req.user?.permissions?.includes(key))
      ) {
        return next();
      }
      return res.status(403).json({ message: 'Permission denied' });
    },
    superAdminMiddleware,
  };
});

vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  default: { actOnWorkflow: vi.fn(), startWorkflow: vi.fn() },
}));

import workflowService from '../modules/shared/workflow/workflowService.js';
import app from '../server.js';

describe('directory route authentication', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['/api/organizations', '/api/resource-persons'])(
    'rejects unauthenticated create on %s',
    async (path) => {
      const response = await request(app).post(path).send({ name: 'unauthenticated' });
      expect(response.status).toBe(401);
      expect(response.body.message || response.body.error).toBeTruthy();
    },
  );

  it.each(['/api/organizations', '/api/resource-persons'])(
    'rejects a logged-in user lacking directory.read from %s',
    async (path) => {
      const response = await request(app).get(path).set('Authorization', 'Bearer no-directory');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Permission denied' });
    },
  );

  it.each([
    '/api/admin/organization-submissions/1/review',
    '/api/admin/resource-person-submissions/1/review',
  ])('rejects unauthenticated review on %s', async (path) => {
    const response = await request(app).patch(path).send({ decision: 'approve' });
    expect(response.status).toBe(401);
    expect(response.body.message || response.body.error).toBeTruthy();
  });

  it.each([
    '/api/admin/organization-submissions/1/review',
    '/api/admin/resource-person-submissions/1/review',
  ])('rejects a plain authenticated user from %s', async (path) => {
    const response = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer ordinary-user')
      .send({ decision: 'approve' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Super Admin access required' });
  });

  it.each([
    '/api/admin/organization-submissions/1/review',
    '/api/admin/resource-person-submissions/1/review',
  ])('returns 404 when review targets a missing record at %s', async (path) => {
    const error = new Error('Record not found');
    error.status = 404;
    workflowService.actOnWorkflow.mockRejectedValueOnce(error);

    const response = await request(app)
      .patch(path)
      .set('Authorization', 'Bearer super-admin')
      .send({ decision: 'approve' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
