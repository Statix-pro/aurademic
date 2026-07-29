import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../server.js';

process.env.JWT_SECRET = 'test-secret-key';

import financeModel from '../modules/finance/financeModel.js';
import workflowService from '../modules/shared/workflow/workflowService.js';
import accessControlModel from '../modules/accessControl/accessControlModel.js';
import db from '../config/connection.js';

// Mock the model
vi.mock('../modules/finance/financeModel.js', () => {
  return {
    default: {
      getFinanceRequestById: vi.fn(),
      getFinanceOwner: vi.fn(),
      getFinanceRecordContext: vi.fn(),
      getBudgetBreakup: vi.fn(),
      updateFinanceWorkflowSnapshot: vi.fn(),
      doesFinanceExist: vi.fn(),
      getBudgetAvailabilityForUser: vi.fn(),
      createFinanceRequest: vi.fn(),
      updateFinanceRequest: vi.fn(),
      deleteFinanceRequest: vi.fn(),
      addBudgetBreakup: vi.fn(),
      hardDeleteFinanceRequest: vi.fn(),
    },
  };
});

// Mock the workflow service
vi.mock('../modules/shared/workflow/workflowService.js', () => {
  return {
    default: {
      startWorkflow: vi.fn(),
      actOnWorkflow: vi.fn(),
      logWorkflowResubmission: vi.fn(),
    },
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

vi.mock('../config/connection.js', () => {
  return {
    default: {
      getConnection: vi.fn(),
      query: vi.fn(),
    },
  };
});

describe('Finance Workflow Integration Tests', () => {
  let token;

  const generateTestToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.getConnection.mockResolvedValue({
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
      query: vi.fn(),
    });
    token = generateTestToken({
      userId: 1,
      email: 'test-user@ksrct.ac.in',
      name: 'Test User',
      roles: ['faculty'],
      permissions: ['finance.create'],
    });
  });

  describe('POST /api/finance-requests - Create Request', () => {
    it('creates a finance request successfully (Happy Path)', async () => {
      const payload = {
        employee_id: 1,
        applicant_name: 'Test User',
        request_date: '2026-06-06',
        beneficiary_type: 'Department',
        beneficiary_value: 'CSE',
        primary_head: 'Research',
        total_budget: 12000,
        budget_rows: [
          {
            budget_head_id: 1,
            budget_head: 'Research',
            sub_head: 'Lab Equipment',
            amount: 12000,
          },
        ],
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      financeModel.createFinanceRequest.mockResolvedValue(201);
      workflowService.startWorkflow.mockResolvedValue({
        state: { currentStage: 'level1', status: 'in_progress' },
      });
      financeModel.getFinanceRequestById.mockResolvedValue({
        id: 201,
        proposal_ref: '#F-2026-0001',
      });

      const response = await request(app)
        .post('/api/finance-requests')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        message: 'Finance request created successfully',
        data: expect.objectContaining({
          id: 201,
          requestRef: '#F-2026-0001',
        }),
      });
      expect(financeModel.createFinanceRequest).toHaveBeenCalled();
      expect(workflowService.startWorkflow).toHaveBeenCalled();
    });

    it('returns 400 if required fields are missing (Error Path)', async () => {
      const invalidPayload = {
        employee_id: 1,
        // missing request_date and primary_head
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
      });

      const response = await request(app)
        .post('/api/finance-requests')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Missing required fields');
    });
  });

  describe('PATCH /api/finance-requests/:id/approval - Approve Workflow', () => {
    it('successfully processes approval from the workflow stage (Happy Path)', async () => {
      const mockFinanceRequest = {
        id: 201,
        proposal_ref: '#F-2026-0001',
        created_by: 1,
        workflow_state: {
          status: 'in_progress',
          currentStage: 'level1',
        },
      };

      const approverToken = generateTestToken({
        userId: 10,
        email: 'approver@ksrct.ac.in',
        name: 'Approver User',
        roles: ['coordinator'],
        permissions: ['finance.workflow.level1'],
      });

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['coordinator'],
        permissions: ['finance.workflow.level1'],
        isAdmin: false,
        isSuperAdmin: false,
      });

      financeModel.getFinanceRequestById.mockResolvedValue(mockFinanceRequest);
      workflowService.actOnWorkflow.mockResolvedValue({
        decision: 'approved',
        stage: 'level1',
        previousState: { currentStage: 'level1' },
        currentState: { currentStage: 'dof' },
      });

      const response = await request(app)
        .patch('/api/finance-requests/201/approval')
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ decision: 'approved', feedback: 'Approved' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Workflow approved at stage level1');
      expect(workflowService.actOnWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 201,
          decision: 'approved',
        }),
      );
    });
  });

  describe('PUT /api/finance-requests/:id - Topup Update', () => {
    it('restarts workflow when a topup is submitted for an approved request', async () => {
      const approvedFinanceRequest = {
        id: 201,
        proposal_ref: '#F-2026-0001',
        created_by: 1,
        total_budget: 12000,
        unplanned_budget_enabled: 0,
        unplanned_budget_amount: null,
        unplanned_budget_description: null,
        beneficiary_type: 'Department',
        workflow_state: {
          status: 'approved',
          currentStage: null,
        },
      };

      financeModel.getFinanceRequestById.mockResolvedValue(approvedFinanceRequest);
      financeModel.getBudgetBreakup.mockResolvedValue([
        {
          budget_head: 'Research',
          sub_head: 'Lab Equipment',
          amount: 12000,
          approved_amount: 12000,
          budget_line_id: 10,
          budget_proposal_id: 20,
          available_amount_snapshot: 12000,
          remaining_amount_snapshot: 0,
        },
      ]);
      financeModel.updateFinanceRequest.mockResolvedValue({ affectedRows: 1 });
      financeModel.getFinanceRecordContext.mockResolvedValue({
        totalBudget: 17000,
        workflowStatus: 'approved',
      });
      workflowService.startWorkflow.mockResolvedValue({
        state: { currentStage: 'level1', status: 'in_progress' },
      });
      financeModel.updateFinanceWorkflowSnapshot.mockResolvedValue(true);

      const response = await request(app)
        .put('/api/finance-requests/201')
        .set('Authorization', `Bearer ${token}`)
        .send({
          topup_mode: true,
          budget_rows: [
            {
              budget_head: 'Tampered Existing Head',
              sub_head: 'Tampered Existing Subhead',
              amount: 1,
              approved_amount: 1,
              remaining_amount_snapshot: 999,
            },
            {
              budget_head: 'Research',
              sub_head: 'Lab Equipment',
              amount: 5000,
              approved_amount: 5000,
              remaining_amount_snapshot: 5000,
            },
          ],
          income_rows: [
            {
              incomeSource: 'Grant',
              contribution: 'Sponsor',
              amount: '2500',
              status: 'credited',
              remarks: 'Topup income',
              creditAccount: 'General Account',
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('topup submitted');
      expect(workflowService.startWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 201,
          moduleKey: 'finance',
          tx: expect.any(Object),
          metadata: expect.objectContaining({
            moduleMeta: expect.objectContaining({
              amountBand: 'gt_10k',
            }),
          }),
        }),
      );
      // The top-up submission must be logged so the submission log stays a full
      // audit trail across cycles.
      expect(workflowService.logWorkflowResubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleKey: 'finance',
          recordId: 201,
          feedback: 'Top-up request submitted',
          tx: expect.any(Object),
          metadata: expect.objectContaining({
            origin: 'topup',
            moduleMeta: expect.objectContaining({ trigger: 'finance_topup' }),
          }),
        }),
      );
      expect(financeModel.updateFinanceRequest).toHaveBeenCalledWith(
        201,
        expect.objectContaining({
          budget_rows: [
            expect.objectContaining({
              budget_head: 'Research',
              amount: 12000,
              approved_amount: 12000,
            }),
            expect.not.objectContaining({
              approved_amount: expect.anything(),
              remaining_amount_snapshot: expect.anything(),
            }),
          ],
          topup_mode: true,
        }),
        expect.any(Object),
        expect.objectContaining({
          tx: expect.any(Object),
        }),
      );
      expect(financeModel.updateFinanceRequest.mock.calls[0][1]).not.toHaveProperty('income_rows');
      expect(financeModel.updateFinanceWorkflowSnapshot).toHaveBeenCalled();
    });

    it('rejects topup if the locked workflow status is no longer terminal', async () => {
      const approvedFinanceRequest = {
        id: 201,
        proposal_ref: '#F-2026-0001',
        created_by: 1,
        total_budget: 12000,
        beneficiary_type: 'Department',
        workflow_state: {
          status: 'approved',
          currentStage: null,
        },
      };

      financeModel.getFinanceRequestById.mockResolvedValue(approvedFinanceRequest);
      financeModel.getFinanceRecordContext.mockResolvedValue({
        totalBudget: 12000,
        workflowStatus: 'in_progress',
      });

      const response = await request(app)
        .put('/api/finance-requests/201')
        .set('Authorization', `Bearer ${token}`)
        .send({
          topup_mode: true,
          budget_rows: [
            {
              budget_head: 'Research',
              sub_head: 'Lab Equipment',
              amount: 5000,
            },
          ],
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no longer eligible');
      expect(financeModel.getBudgetBreakup).not.toHaveBeenCalled();
      expect(financeModel.updateFinanceRequest).not.toHaveBeenCalled();
      expect(workflowService.startWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/finance-requests/:id - Topup Protection', () => {
    it('rejects deleting a topup while it is awaiting Level-1 approval', async () => {
      const topupFinanceRequest = {
        id: 201,
        created_by: 1,
        workflow_state: {
          status: 'in_progress',
          currentStage: 'level1',
          topupAt: '2026-06-06T10:00:00.000Z',
        },
      };

      financeModel.getFinanceRequestById.mockResolvedValue(topupFinanceRequest);
      financeModel.getFinanceOwner.mockResolvedValue({ applicant_user_id: 1, created_by: 1 });

      const response = await request(app)
        .delete('/api/finance-requests/201')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Top-up requests cannot be deleted');
      expect(financeModel.deleteFinanceRequest).not.toHaveBeenCalled();
    });
  });
});
