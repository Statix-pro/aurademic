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
    getPayeeById: vi.fn(),
    updatePayeeById: vi.fn(),
    updatePayeeApproval: vi.fn(),
    deletePayeeById: vi.fn(),
    upsertPayee: vi.fn(),
    createExpenditure: vi.fn(),
    createExpenditureRequest: vi.fn(),
    listExpenditures: vi.fn(),
    getExpenditureById: vi.fn(),
    getExpenditureDetails: vi.fn(),
    getStatusUpdates: vi.fn(),
    updateExpenditureRequest: vi.fn(),
    updateExpenditure: vi.fn(),
    deleteExpenditure: vi.fn(),
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

describe('Expenditure Workflow Integration Tests', () => {
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
      permissions: ['expenditure.create'],
    });
  });

  describe('POST /api/expenditure/advance - Create Advance Request', () => {
    it('creates an advance request successfully (Happy Path)', async () => {
      const payload = {
        budget_line_id: 1,
        amount: 3000,
        purpose: 'Travel reimbursement for conference',
        payee_id: 5,
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      expenditureModel.createExpenditure.mockResolvedValue({
        id: 301,
        status: 'pending',
      });

      const response = await request(app)
        .post('/api/expenditure/advance')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        status: 'success',
        message: 'Advance request submitted successfully',
        data: expect.objectContaining({
          id: 301,
        }),
      });
      expect(expenditureModel.createExpenditure).toHaveBeenCalledWith(
        expect.objectContaining({ budget_line_id: 1, amount: 3000 }),
        1,
      );
    });

    it('returns 400 if amount is not positive (Error Path)', async () => {
      const invalidPayload = {
        budget_line_id: 1,
        amount: -500,
        purpose: 'Travel reimbursement',
        payee_id: 5,
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
      });

      const response = await request(app)
        .post('/api/expenditure/advance')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('amount must be a positive number');
      expect(expenditureModel.createExpenditure).not.toHaveBeenCalled();
    });
  });
});
