/**
 * `/api/master-data/*` used to answer with a `{ status: 'success' | 'error' }`
 * envelope of its own while every other module returned `{ success, data?,
 * message? }`. Its single caller — the admin Master Data page — had to special-
 * case that shape, which is exactly how the raw-`fetch` client code there
 * survived as long as it did.
 *
 * These tests pin the shared envelope on a read, a write, a not-found and a
 * validation failure, so the two sides cannot drift apart again. The
 * super-admin gate is pinned alongside it: every route on this router sits
 * behind `superAdminMiddleware`, and nothing else covers that.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/masterData/masterDataModel.js', () => ({
  default: {
    getDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    getEmployees: vi.fn(),
  },
}));

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';
import masterDataModel from '../modules/masterData/masterDataModel.js';
import app from '../server.js';

let token;

const snapshot = (overrides = {}) => ({
  roles: ['admin'],
  permissions: [],
  isAdmin: true,
  isSuperAdmin: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  token = jwt.sign(
    { userId: 1, email: 'super@ksrct.ac.in', name: 'Super Admin', roles: ['admin'] },
    process.env.JWT_SECRET,
  );
  accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot());
});

describe('GET /api/master-data/departments', () => {
  it('returns the shared success envelope', async () => {
    masterDataModel.getDepartments.mockResolvedValue([{ id: 3, name: 'Civil' }]);

    const response = await request(app)
      .get('/api/master-data/departments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ success: true, data: [{ id: 3, name: 'Civil' }] });
    expect(response.body.status).toBeUndefined();
  });

  it('passes the query filters through to the model', async () => {
    masterDataModel.getDepartments.mockResolvedValue([]);

    await request(app)
      .get('/api/master-data/departments?search=civ&type=Academic&is_active=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(masterDataModel.getDepartments).toHaveBeenCalledWith({
      search: 'civ',
      type: 'Academic',
      is_active: 1,
    });
  });

  it('refuses a logged-in user who is not a super admin', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot({ isAdmin: false, isSuperAdmin: false }),
    );

    await request(app)
      .get('/api/master-data/departments')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(masterDataModel.getDepartments).not.toHaveBeenCalled();
  });
});

describe('master data writes', () => {
  it('reports a created department with success: true', async () => {
    masterDataModel.createDepartment.mockResolvedValue({ id: 9, name: 'Mechanical' });

    const response = await request(app)
      .post('/api/master-data/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mechanical' })
      .expect(201);

    expect(response.body).toEqual({ success: true, data: { id: 9, name: 'Mechanical' } });
  });

  it('rejects a department with no name using the failure envelope', async () => {
    const response = await request(app)
      .post('/api/master-data/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      message: 'Department name is required',
    });
    expect(masterDataModel.createDepartment).not.toHaveBeenCalled();
  });

  it('reports an update the model did not apply as a 404 failure', async () => {
    masterDataModel.updateDepartment.mockResolvedValue(false);

    const response = await request(app)
      .put('/api/master-data/departments/42')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ghost' })
      .expect(404);

    expect(response.body).toEqual({ success: false, message: 'Department not found' });
  });

  it('reports a deactivation with the success envelope', async () => {
    masterDataModel.deleteDepartment.mockResolvedValue(true);

    const response = await request(app)
      .delete('/api/master-data/departments/42')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Department deactivated successfully',
    });
  });

  it('turns a thrown model error into the failure envelope, not a bare 500', async () => {
    masterDataModel.getEmployees.mockRejectedValue(new Error('ER_NO_SUCH_TABLE'));

    const response = await request(app)
      .get('/api/master-data/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);

    expect(response.body).toEqual({ success: false, message: 'ER_NO_SUCH_TABLE' });
  });
});
