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

// Approving an organization first runs a duplicate-name query on the pool. Unmocked, it
// reached a real MySQL: green on a dev machine, 500 in CI where there is no database.
vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

import db from '../config/connection.js';
import workflowService from '../modules/shared/workflow/workflowService.js';
import app from '../server.js';

// Reviewing a resource person and adding list entries run in a transaction on a pooled
// connection; its statements are answered by the pool mocks, so tests queue them there.
const pooledConnection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  execute: (...args) => db.execute(...args),
  query: (...args) => db.query(...args),
};

describe('directory route authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getConnection.mockResolvedValue(pooledConnection);
    db.execute.mockResolvedValue([[]]);
    // Approving a resource person first checks its organizations.
    db.query.mockResolvedValue([[]]);
  });

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

  // Editing someone else's submission is a reviewer power: the owner's directory.edit
  // must not reach it, and neither may the other directory's reviewer.
  it.each([
    ['', 401],
    ['Bearer directory-user', 403],
    ['Bearer rp-reviewer', 403],
  ])('refuses a reviewer edit of an organization with %j', async (authorization, status) => {
    const call = request(app).put('/api/organization-submissions/1');
    if (authorization) call.set('Authorization', authorization);

    const response = await call.send({ name: 'Edited' });

    expect(response.status).toBe(status);
    expect(db.getConnection).not.toHaveBeenCalled();
  });

  it('lets an organization reviewer edit a Pending submission', async () => {
    const connection = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
      execute: vi.fn(async (sql) => {
        if (/FOR UPDATE/.test(sql)) return [[{ id: 1, is_active: 0, updated_by: null }]];
        if (/directory_organization_options|SELECT name FROM/.test(sql)) return [[]];
        if (/^SELECT o\.\*/.test(sql.trim())) return [[{ id: 1, name: 'Edited', created_by: 4 }]];
        return [{}];
      }),
    };
    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .put('/api/organization-submissions/1')
      .set('Authorization', 'Bearer org-reviewer')
      .send({ name: 'Edited' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { id: 1, name: 'Edited', approvalStatus: 'Pending' },
    });
    expect(connection.release).toHaveBeenCalledOnce();
  });

  // Every directory user reads the Tag and Specialization lists for the form; only the
  // resource-person Directory Admin changes them.
  it('lets a directory user read the resource-person lists', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, list_key: 'tag', name: 'General', is_active: 1 }]]);

    const response = await request(app)
      .get('/api/resource-person-options')
      .set('Authorization', 'Bearer directory-user');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { id: 1, list_key: 'tag', name: 'General', is_active: true },
    ]);
  });

  it.each([
    ['directory-user', 'post', '/api/resource-person-options/tag'],
    ['directory-user', 'put', '/api/resource-person-options/1'],
    ['directory-user', 'delete', '/api/resource-person-options/1'],
    ['directory-user', 'get', '/api/resource-person-options/all'],
    ['org-reviewer', 'post', '/api/resource-person-options/tag'],
  ])('refuses %s a list change at %s %s', async (token, method, path) => {
    const response = await request(app)
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New' });

    expect(response.status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
  });

  // Each directory's lists belong to that directory's admin alone.
  it.each([
    ['directory-user', 'post', '/api/organization-options/tag'],
    ['directory-user', 'delete', '/api/organization-options/1'],
    ['directory-user', 'get', '/api/organization-options/all'],
    ['rp-reviewer', 'post', '/api/organization-options/tag'],
  ])('refuses %s an organization list change at %s %s', async (token, method, path) => {
    const response = await request(app)
      [method](path)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New' });

    expect(response.status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('lets the organization Directory Admin add a list entry', async () => {
    db.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 5 }])
      .mockResolvedValueOnce([[{ id: 5, list_key: 'tag', name: 'Research', is_active: 1 }]]);

    const response = await request(app)
      .post('/api/organization-options/tag')
      .set('Authorization', 'Bearer org-reviewer')
      .send({ name: 'Research' });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      added: [{ id: 5, list_key: 'tag', name: 'Research', is_active: true }],
      skipped: [],
    });
  });

  it('lets the resource-person Directory Admin add a list entry', async () => {
    db.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 12 }])
      .mockResolvedValueOnce([
        [{ id: 12, list_key: 'specialization', name: 'Microbiology', is_active: 1 }],
      ]);

    const response = await request(app)
      .post('/api/resource-person-options/specialization')
      .set('Authorization', 'Bearer rp-reviewer')
      .send({ names: [' Microbiology '] });

    expect(response.status).toBe(201);
    expect(response.body.data.added).toEqual([
      { id: 12, list_key: 'specialization', name: 'Microbiology', is_active: true },
    ]);
    expect(db.execute.mock.calls[1][1]).toEqual(['specialization', 'Microbiology', 1]);
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
