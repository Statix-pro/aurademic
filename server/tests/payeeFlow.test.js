import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../server.js';

process.env.JWT_SECRET = 'test-secret-key';

import * as expenditureModel from '../modules/expenditure/expenditureModel.js';
import accessControlModel from '../modules/accessControl/accessControlModel.js';

// Mock the model
vi.mock('../modules/expenditure/expenditureModel.js', () => {
  return {
    getCurrentEmployee: vi.fn(),
    getApprovedBudgets: vi.fn(),
    getAdvanceSummary: vi.fn(),
    getExpenditureDashboard: vi.fn(),
    getFinanceRequestContext: vi.fn(),
    listPayees: vi.fn(),
    listPayeeDirectory: vi.fn(),
    getPayeeById: vi.fn(),
    updatePayeeById: vi.fn(),
    updatePayeeApproval: vi.fn(),
    deletePayeeById: vi.fn(),
    upsertPayee: vi.fn(),
    createExpenditure: vi.fn(),
    createExpenditureRequest: vi.fn(),
  };
});

// Mock access control
vi.mock('../modules/accessControl/accessControlModel.js', () => {
  return {
    default: {
      getUserAuthorizationSnapshot: vi.fn(),
    },
  };
});

describe('Payee Management Flow Integration Tests', () => {
  let token;

  const generateTestToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    token = generateTestToken({
      userId: 1,
      email: 'test-user@ksrct.ac.in',
      name: 'Test User',
      roles: ['faculty'],
      permissions: [],
    });
  });

  describe('POST /api/expenditure/payees - Create Payee', () => {
    it('creates a payee successfully (Happy Path)', async () => {
      const payload = {
        payee_name: 'John Doe',
        account_no: '1234567890',
        ifsc: 'SBIN0001234',
        bank_name: 'State Bank of India',
        branch_name: 'Tiruchengode',
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      expenditureModel.upsertPayee.mockResolvedValue(501);
      expenditureModel.getPayeeById.mockResolvedValue({
        id: 501,
        payee_name: 'John Doe',
        account_no: '1234567890',
      });

      const response = await request(app)
        .post('/api/expenditure/payees')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        status: 'success',
        message: 'Payee saved successfully',
        data: expect.objectContaining({
          id: 501,
          payee_name: 'John Doe',
        }),
      });
      expect(expenditureModel.upsertPayee).toHaveBeenCalled();
    });

    it('returns 400 if required fields are missing (Error Path)', async () => {
      const invalidPayload = {
        payee_name: 'John Doe',
        // missing account_no, ifsc, etc.
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
      });

      const response = await request(app)
        .post('/api/expenditure/payees')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
      expect(expenditureModel.upsertPayee).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/expenditure/payees/directory - Paged Directory', () => {
    // The directory is the DoF management reader: it returns full bank details
    // for every payee, rejected rows included, so it is gated like the payee
    // mutations rather than like the '/payees' typeahead.
    let dofToken;

    beforeEach(() => {
      dofToken = generateTestToken({
        userId: 2,
        email: 'dof@ksrct.ac.in',
        name: 'DoF User',
        roles: ['dof'],
        permissions: [],
      });
      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['dof'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });
    });

    it('returns one page of rows with server-side totals', async () => {
      expenditureModel.listPayeeDirectory.mockResolvedValue({
        rows: [{ id: 501, payee_name: 'John Doe' }],
        total: 137,
        counts: { all: 137, pending: 4, approved: 130, rejected: 3 },
        limit: 20,
        offset: 40,
      });

      const response = await request(app)
        .get('/api/expenditure/payees/directory')
        .query({ status: 'all', limit: 20, offset: 40 })
        .set('Authorization', `Bearer ${dofToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      // Totals must survive paging: the page holds 1 row but reports all 137.
      expect(response.body.meta).toEqual({
        total: 137,
        counts: { all: 137, pending: 4, approved: 130, rejected: 3 },
        limit: 20,
        offset: 40,
      });
      expect(expenditureModel.listPayeeDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'all', limit: '20', offset: '40' }),
      );
    });

    it('passes the status and beneficiary filters through to the model', async () => {
      expenditureModel.listPayeeDirectory.mockResolvedValue({
        rows: [],
        total: 0,
        counts: { all: 0, pending: 0, approved: 0, rejected: 0 },
        limit: 20,
        offset: 0,
      });

      const response = await request(app)
        .get('/api/expenditure/payees/directory')
        .query({ status: 'pending', beneficiary_type: 'organization', search: 'sharvi' })
        .set('Authorization', `Bearer ${dofToken}`);

      expect(response.status).toBe(200);
      expect(expenditureModel.listPayeeDirectory).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          beneficiaryType: 'organization',
          search: 'sharvi',
        }),
      );
    });

    it('is not shadowed by the /payees/:id route', async () => {
      expenditureModel.listPayeeDirectory.mockResolvedValue({
        rows: [],
        total: 0,
        counts: { all: 0, pending: 0, approved: 0, rejected: 0 },
        limit: 20,
        offset: 0,
      });

      await request(app)
        .get('/api/expenditure/payees/directory')
        .set('Authorization', `Bearer ${dofToken}`);

      expect(expenditureModel.getPayeeById).not.toHaveBeenCalled();
    });

    it('refuses a requester without expenditure workflow access', async () => {
      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const response = await request(app)
        .get('/api/expenditure/payees/directory')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(expenditureModel.listPayeeDirectory).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/expenditure/payees/:id - Update Payee', () => {
    it('allows an HOD/Admin to update payee details (Happy Path)', async () => {
      const adminToken = generateTestToken({
        userId: 10,
        email: 'hod@ksrct.ac.in',
        roles: ['hod'],
        permissions: [],
      });

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['hod'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      expenditureModel.updatePayeeById.mockResolvedValue(true);
      expenditureModel.getPayeeById.mockResolvedValue({
        id: 501,
        payee_name: 'John Updated',
      });

      const response = await request(app)
        .patch('/api/expenditure/payees/501')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payee_name: 'John Updated' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      expect(expenditureModel.updatePayeeById).toHaveBeenCalledWith(
        501,
        expect.objectContaining({ payee_name: 'John Updated' }),
      );
    });

    it('denies update if user lacks admin/workflow roles (Error Path)', async () => {
      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const response = await request(app)
        .patch('/api/expenditure/payees/501')
        .set('Authorization', `Bearer ${token}`)
        .send({ payee_name: 'John Hack' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient permission');
      expect(expenditureModel.updatePayeeById).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/expenditure/payees/:id - Delete Payee', () => {
    it('allows a Super Admin to delete a payee (Happy Path)', async () => {
      const superAdminToken = generateTestToken({
        userId: 4,
        email: 'super@ksrct.ac.in',
        isSuperAdmin: true,
        roles: ['super_admin'],
        permissions: [],
      });

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['super_admin'],
        permissions: [],
        isAdmin: true,
        isSuperAdmin: true,
      });

      expenditureModel.deletePayeeById.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/expenditure/payees/501')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('deleted successfully');
      expect(expenditureModel.deletePayeeById).toHaveBeenCalledWith(501);
    });

    it('denies deletion if user lacks proper role (Error Path)', async () => {
      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const response = await request(app)
        .delete('/api/expenditure/payees/501')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient permission');
      expect(expenditureModel.deletePayeeById).not.toHaveBeenCalled();
    });
  });
});
