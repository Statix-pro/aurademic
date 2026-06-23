import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../server.js';

process.env.JWT_SECRET = 'test-secret-key';

import * as BudgetModel from '../modules/budget/budgetModel.js';
import accessControlModel from '../modules/accessControl/accessControlModel.js';

// Mock the models
vi.mock('../modules/budget/budgetModel.js', () => {
  return {
    normalizeEntityTypeCode: (val) => val,
    normalizeBudgetRole: (val) => val,
    getCurrentFinancialYear: () => 2026,
    normalizeBeneficiaryType: (val) => val,
    getBudgetById: vi.fn(),
    resolveLevel1Route: vi.fn(),
    resolveEntityLevel1Assignee: vi.fn(),
    validateUserAccess: vi.fn(),
    processApproval: vi.fn(),
    create: vi.fn(),
    getUserDepartmentByUserId: vi.fn(),
    getUserAssignments: vi.fn(),
    getDepartmentByName: vi.fn(),
    checkEmployeeUserMatch: vi.fn(),
    isFacultyBeneficiaryForUser: vi.fn(),
  };
});

vi.mock('../modules/accessControl/accessControlModel.js', () => {
  return {
    default: {
      getUserAuthorizationSnapshot: vi.fn(),
    },
  };
});

describe('Budget Workflow Integration Tests', () => {
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
      permissions: ['budget.create'],
    });
  });

  describe('POST /api/budget - Create Proposal', () => {
    it('creates a budget proposal successfully (Happy Path)', async () => {
      const payload = {
        fiscal_year: '2026',
        request_date: '2026-06-06',
        beneficiary_type: 'Department',
        beneficiary_value: 'CSE',
        lines: [
          {
            budget_head: 'Equipment',
            unit_amount: 5000,
            quantity: 1,
            line_description: 'New laptops',
            month_allocations: {
              April: 5000,
            },
          },
        ],
      };

      // Set up mocks
      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      BudgetModel.getUserDepartmentByUserId.mockResolvedValue({
        name: 'CSE',
      });

      BudgetModel.getDepartmentByName.mockResolvedValue({
        id: 1,
        name: 'CSE',
      });

      BudgetModel.create.mockResolvedValue({
        proposalId: 101,
        proposalRef: '#B-2026-0001',
        fyYear: 2026,
        approvalFlow: 'level1_dof_principal',
        initialStage: 'level1',
        currentStage: 'level1',
        requiresLevel1: true,
      });

      const response = await request(app)
        .post('/api/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Budget proposal created successfully',
        data: expect.objectContaining({
          proposalId: 101,
          proposalRef: '#B-2026-0001',
        }),
      });
      expect(BudgetModel.create).toHaveBeenCalled();
    });

    it('returns 400 if required fields are missing (Error Path)', async () => {
      const invalidPayload = {
        fiscal_year: '2026',
        // missing request_date and beneficiary_type
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
      });

      const response = await request(app)
        .post('/api/budget')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required fields');
    });
  });

  describe('PATCH /api/budget/:id/approval - Approve Proposal', () => {
    it('allows HOD to approve a level1 budget proposal (Happy Path)', async () => {
      const mockProposal = {
        id: 101,
        current_stage: 'level1',
        status: 'submitted',
        total_amount: 5000,
      };

      const hodToken = generateTestToken({
        userId: 10,
        email: 'hod@ksrct.ac.in',
        name: 'HOD User',
        roles: ['hod'],
        permissions: ['budget.workflow.level1'],
      });

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['hod'],
        permissions: ['budget.workflow.level1'],
        isAdmin: false,
        isSuperAdmin: false,
      });

      BudgetModel.getBudgetById.mockResolvedValue(mockProposal);
      BudgetModel.resolveLevel1Route.mockReturnValue({
        routeType: 'department',
        departmentId: 1,
      });
      BudgetModel.validateUserAccess.mockResolvedValue(true);
      BudgetModel.processApproval.mockResolvedValue(true);

      const response = await request(app)
        .patch('/api/budget/101/approval')
        .set('Authorization', `Bearer ${hodToken}`)
        .send({ decision: 'approved', feedback: 'Approved' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('approved successfully');
      expect(BudgetModel.processApproval).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          role: 'level1',
          decision: 'approved',
        }),
      );
    });

    it('denies approval if user lacks workflow role (Error Path)', async () => {
      const mockProposal = {
        id: 101,
        current_stage: 'level1',
        status: 'submitted',
      };

      const invalidToken = generateTestToken({
        userId: 1,
        email: 'faculty@ksrct.ac.in',
        roles: ['faculty'],
        permissions: [],
      });

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      BudgetModel.getBudgetById.mockResolvedValue(mockProposal);
      BudgetModel.resolveLevel1Route.mockReturnValue({
        routeType: 'department',
        departmentId: 1,
      });

      const response = await request(app)
        .patch('/api/budget/101/approval')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({ decision: 'approved', feedback: 'Approved' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Insufficient permission');
      expect(BudgetModel.processApproval).not.toHaveBeenCalled();
    });
  });
});
