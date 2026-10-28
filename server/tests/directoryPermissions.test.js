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
        if (/directory_options|SELECT name FROM/.test(sql)) return [[]];
        if (/^SELECT o\.\*/.test(sql.trim())) return [[{ id: 1, name: 'Edited', created_by: 4 }]];
        return [{}];
      }),
    };
    db.getConnection.mockResolvedValueOnce(connection);

    const response = await request(app)
      .put('/api/organization-submissions/1')
      .set('Authorization', 'Bearer org-reviewer')
      .send({
        name: 'Edited',
        funding: 'Public',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { id: 1, name: 'Edited', approvalStatus: 'Pending' },
    });
    expect(connection.release).toHaveBeenCalledOnce();
  });

  // Every directory user reads the shared Tag and Specialization lists for the forms;
  // either directory's Directory Admin, or a super admin, changes them.
  it('lets a directory user read the shared lists', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, list_key: 'tag', name: 'General', is_active: 1 }]]);

    const response = await request(app)
      .get('/api/directory-options')
      .set('Authorization', 'Bearer directory-user');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { id: 1, list_key: 'tag', name: 'General', is_active: true, approval_status: 'Approved' },
    ]);
  });

  it.each([
    [undefined, 'get', '/api/directory-options', 401],
    ['nobody', 'get', '/api/directory-options', 403],
    ['directory-user', 'post', '/api/directory-options/tag', 403],
    ['directory-user', 'put', '/api/directory-options/1', 403],
    ['directory-user', 'delete', '/api/directory-options/1', 403],
    ['directory-user', 'get', '/api/directory-options/all', 403],
    // Suggesting is adding to the directory, so it takes directory.create; reviewing a
    // suggestion is the Directory Admin's, like the rest of the list.
    [undefined, 'post', '/api/directory-options/suggestions', 401],
    ['nobody', 'post', '/api/directory-options/suggestions', 403],
    ['directory-user', 'patch', '/api/directory-options/1/review', 403],
  ])('refuses %s at %s %s', async (token, method, path, status) => {
    const call = request(app)[method](path);
    if (token) call.set('Authorization', `Bearer ${token}`);
    const response = await call.send({ name: 'New' });

    expect(response.status).toBe(status);
    expect(db.execute).not.toHaveBeenCalled();
  });

  // The per-directory list routes are gone; nothing answers there any more.
  it.each(['/api/organization-options', '/api/resource-person-options'])(
    'no longer serves %s',
    async (path) => {
      const response = await request(app).get(path).set('Authorization', 'Bearer super-admin');

      expect(response.status).toBe(404);
    },
  );

  it.each(['org-reviewer', 'rp-reviewer', 'super-admin'])(
    'lets %s add an entry to the shared list',
    async (token) => {
      db.execute
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ insertId: 5 }])
        .mockResolvedValueOnce([[{ id: 5, list_key: 'tag', name: 'Research', is_active: 1 }]]);

      const response = await request(app)
        .post('/api/directory-options/tag')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Research' });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({
        added: [
          {
            id: 5,
            list_key: 'tag',
            name: 'Research',
            is_active: true,
            approval_status: 'Approved',
          },
        ],
        skipped: [],
      });
      expect(db.execute.mock.calls[1][0]).toMatch(/^INSERT INTO directory_options /);
    },
  );

  it.each(['org-reviewer', 'rp-reviewer', 'super-admin'])(
    'lets %s approve a suggested specialization',
    async (token) => {
      db.execute.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([
        [
          {
            id: 9,
            list_key: 'specialization',
            name: 'Robotics',
            is_active: 1,
            approval_status: 'Approved',
          },
        ],
      ]);

      const response = await request(app)
        .patch('/api/directory-options/9/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'approve' });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ id: 9, approval_status: 'Approved' });
      expect(db.execute.mock.calls[0][1]).toEqual(['Approved', 1, '9']);
    },
  );

  it.each(['org-reviewer', 'rp-reviewer'])(
    'lets %s see retired entries, rename and delete',
    async (token) => {
      db.query.mockResolvedValueOnce([[]]);
      const all = await request(app)
        .get('/api/directory-options/all')
        .set('Authorization', `Bearer ${token}`);
      expect(all.status).toBe(200);

      db.execute
        .mockResolvedValueOnce([[{ list_key: 'specialization', name: 'Old' }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([
          [{ id: 4, list_key: 'specialization', name: 'New', is_active: 1 }],
        ]);
      const renamed = await request(app)
        .put('/api/directory-options/4')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New' });
      expect(renamed.status).toBe(200);

      db.execute
        .mockResolvedValueOnce([[{ list_key: 'specialization', name: 'New' }]])
        .mockResolvedValueOnce([[{ used: 0 }]])
        .mockResolvedValueOnce([{}]);
      const deleted = await request(app)
        .delete('/api/directory-options/4')
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body).toMatchObject({ success: true, message: 'Entry deleted.' });
    },
  );

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
