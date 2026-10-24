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
        {
          'Bearer directory-user': ['directory.read', 'directory.create', 'directory.edit'],
          'Bearer org-reviewer': ['organization_directory.workflow.directory_admin'],
          'Bearer rp-reviewer': ['resource_person_directory.workflow.directory_admin'],
        }[req.headers.authorization] || [],
    };
    return next();
  };
  const superAdminMiddleware = (req, res, next) => {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    return next();
  };
  // Like the real one, refuses non-admins. adminRoutes runs it on all of /api/admin, so
  // a review route under that prefix would never reach a Directory Admin.
  const adminAuthMiddleware = (req, res, next) =>
    authMiddleware(req, res, () =>
      req.user.isSuperAdmin ? next() : res.status(403).json({ message: 'Admin access required' }),
    );
  return {
    adminAuthMiddleware,
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

  it.each(['/api/organization-submissions/1/review', '/api/resource-person-submissions/1/review'])(
    'rejects unauthenticated review on %s',
    async (path) => {
      const response = await request(app).patch(path).send({ decision: 'approve' });
      expect(response.status).toBe(401);
      expect(response.body.message || response.body.error).toBeTruthy();
    },
  );

  it.each(['/api/organization-submissions/1/review', '/api/resource-person-submissions/1/review'])(
    'rejects a plain authenticated user from %s',
    async (path) => {
      const response = await request(app)
        .patch(path)
        .set('Authorization', 'Bearer ordinary-user')
        .send({ decision: 'approve' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Permission denied' });
    },
  );

  // Directory Admin is a non-admin role: it must reach the review routes through its
  // stage permission alone, and only for the directory that permission names.
  it.each([
    ['org-reviewer', '/api/organization-submissions/1/review'],
    ['rp-reviewer', '/api/resource-person-submissions/1/review'],
  ])('lets a %s holder review at %s', async (token, path) => {
    workflowService.actOnWorkflow.mockResolvedValueOnce({});

    const response = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approve' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(workflowService.actOnWorkflow).toHaveBeenCalledOnce();
  });

  it.each([
    ['rp-reviewer', '/api/organization-submissions/1/review'],
    ['org-reviewer', '/api/resource-person-submissions/1/review'],
  ])('refuses a %s holder at the other directory %s', async (token, path) => {
    const response = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approve' });

    expect(response.status).toBe(403);
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
  });

  it.each(['/api/organization-submissions/1/review', '/api/resource-person-submissions/1/review'])(
    'returns 404 when review targets a missing record at %s',
    async (path) => {
      const error = new Error('Record not found');
      error.status = 404;
      workflowService.actOnWorkflow.mockRejectedValueOnce(error);

      const response = await request(app)
        .patch(path)
        .set('Authorization', 'Bearer super-admin')
        .send({ decision: 'approve' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    },
  );
});
