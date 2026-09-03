/**
 * Payees run on their own approval path, separate from the expenditure request
 * workflow: a requester submits bank details, the DoF vets them, and only a
 * verified payee can be paid. That path predates the notification engine and
 * arrived on a later branch, so nothing about it was covered by the workflow
 * chokepoint.
 *
 * These tests pin the three transitions that matter, and in particular that the
 * audience stays narrow: the route admits six roles, but notifying all of them
 * for every bank-detail edit would be noise nobody reads.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/expenditure/expenditureModel.js', () => ({
  getPayeeById: vi.fn(),
  upsertPayee: vi.fn(),
  updatePayeeApproval: vi.fn(),
}));

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
  emit: vi.fn(),
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';
import * as expenditureModel from '../modules/expenditure/expenditureModel.js';
import notificationService from '../modules/notification/notificationService.js';
import app from '../server.js';

const REQUESTER_ID = 11;
const DOF_ID = 3;

const VALID_PAYEE_BODY = {
  payee_name: 'Acme Instruments',
  account_no: '1234567890',
  ifsc: 'HDFC0001234',
  bank_name: 'HDFC Bank',
  branch_name: 'Tiruchengode',
};

let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

const asUser = (userId, roles, permissions = []) => {
  token = jwt.sign(
    { userId, email: `u${userId}@ksrct.ac.in`, name: `User ${userId}`, roles, permissions },
    process.env.JWT_SECRET,
  );
  accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
    roles,
    permissions,
    isAdmin: false,
    isSuperAdmin: false,
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  asUser(REQUESTER_ID, ['faculty']);
});

describe('POST /api/expenditure/payees', () => {
  beforeEach(() => {
    expenditureModel.upsertPayee.mockResolvedValue(77);
    expenditureModel.getPayeeById.mockResolvedValue({
      id: 77,
      payee_name: 'Acme Instruments',
      created_by: REQUESTER_ID,
      approval_status: 'pending',
    });
  });

  it('tells the DoF a payee is awaiting verification', async () => {
    const response = await auth(request(app).post('/api/expenditure/payees')).send(
      VALID_PAYEE_BODY,
    );

    expect(response.status).toBe(201);
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payee.submitted',
        actorUserId: REQUESTER_ID,
        subject: expect.objectContaining({ recordId: 77, name: 'Acme Instruments' }),
      }),
    );
  });

  it('addresses only the DoF, not every role the route admits', async () => {
    // The route lets admin/hod/coordinator/dof/principal/entity_approver
    // through. Widening the audience to match would put every bank-detail edit
    // in front of every approver in the institution.
    await auth(request(app).post('/api/expenditure/payees')).send(VALID_PAYEE_BODY);

    const { audience } = notificationService.emit.mock.calls[0][0];
    expect(audience).toEqual([
      { kind: 'role', roleCodes: ['dof'], recipientRole: 'approver' },
      {
        kind: 'permission',
        permissions: ['expenditure.workflow.dof'],
        recipientRole: 'approver',
      },
    ]);
  });

  it('does not notify when the submission is rejected as invalid', async () => {
    const response = await auth(request(app).post('/api/expenditure/payees')).send({
      payee_name: 'Missing bank details',
    });

    expect(response.status).toBe(400);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/expenditure/payees/:id/approval', () => {
  beforeEach(() => {
    // Only a workflow role may decide; the requester above cannot.
    asUser(DOF_ID, ['dof']);
    expenditureModel.updatePayeeApproval.mockResolvedValue(true);
    expenditureModel.getPayeeById.mockResolvedValue({
      id: 77,
      payee_name: 'Acme Instruments',
      created_by: REQUESTER_ID,
    });
  });

  it('tells the submitter their payee was verified', async () => {
    const response = await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'approved',
    });

    expect(response.status).toBe(200);
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payee.approved',
        actorUserId: DOF_ID,
        audience: [{ kind: 'user', userId: REQUESTER_ID, recipientRole: 'applicant' }],
      }),
    );
  });

  it('carries the rejection reason, which is the actionable part', async () => {
    const response = await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'rejected',
      rejection_reason: 'IFSC does not match the branch.',
    });

    expect(response.status).toBe(200);
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'payee.rejected',
        data: expect.objectContaining({ feedback: 'IFSC does not match the branch.' }),
      }),
    );
  });

  it('stays silent when the payee does not exist', async () => {
    expenditureModel.updatePayeeApproval.mockResolvedValue(false);

    const response = await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'approved',
    });

    expect(response.status).toBe(404);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });

  it('stays silent when a rejection has no reason, since the update is refused', async () => {
    expenditureModel.updatePayeeApproval.mockRejectedValue(
      new Error('Rejection reason is required'),
    );

    const response = await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'rejected',
    });

    expect(response.status).toBe(400);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });

  it('emits no audience rather than a broken one when created_by is missing', async () => {
    // Legacy payee rows predate created_by. There is nobody to tell, and the
    // resolver must not be handed a null user id.
    expenditureModel.getPayeeById.mockResolvedValue({
      id: 77,
      payee_name: 'Legacy Payee',
      created_by: null,
    });

    await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'approved',
    });

    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ audience: [] }),
    );
  });

  it('refuses a requester with no workflow role', async () => {
    asUser(REQUESTER_ID, ['faculty']);

    const response = await auth(request(app).patch('/api/expenditure/payees/77/approval')).send({
      decision: 'approved',
    });

    expect(response.status).toBe(403);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });
});
