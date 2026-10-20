/**
 * Deleting a request is only worth announcing when someone deletes another
 * person's record — a super admin clearing up. An applicant deleting their own
 * draft is the actor and is filtered out downstream, so these emits are
 * deliberately fire-and-forget.
 *
 * Budget already notified on deletion; these cover finance and expenditure,
 * which the generic workflow chokepoint does not (deletion is not a stage
 * decision, so it is not part of the six shared transitions).
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/finance/financeModel.js', () => ({
  default: {
    getFinanceRequestById: vi.fn(),
    deleteFinanceRequest: vi.fn(),
    getFinanceOwner: vi.fn(),
  },
}));

vi.mock('../modules/expenditure/expenditureModel.js', () => ({
  getExpenditureById: vi.fn(),
  deleteExpenditure: vi.fn(),
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
import financeModel from '../modules/finance/financeModel.js';
import notificationService from '../modules/notification/notificationService.js';
import app from '../server.js';

const SUPER_ADMIN_ID = 1;
const OWNER_ID = 42;

let token;
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  vi.clearAllMocks();
  token = jwt.sign(
    {
      userId: SUPER_ADMIN_ID,
      email: 'admin@ksrct.ac.in',
      name: 'Super Admin',
      roles: ['super_admin'],
      isSuperAdmin: true,
    },
    process.env.JWT_SECRET,
  );
  accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
    roles: ['super_admin'],
    permissions: [],
    isAdmin: true,
    isSuperAdmin: true,
  });
});

describe('DELETE /api/finance-requests/:id', () => {
  beforeEach(() => {
    financeModel.getFinanceRequestById.mockResolvedValue({
      id: 20,
      applicant_user_id: OWNER_ID,
      created_by: OWNER_ID,
      workflow_state: { status: 'in_progress', currentStage: 'level1' },
    });
    financeModel.deleteFinanceRequest.mockResolvedValue(true);
  });

  it('tells the applicant their request was deleted', async () => {
    const response = await auth(request(app).delete('/api/finance-requests/20'));

    expect(response.status).toBe(200);
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'finance.deleted',
        actorUserId: SUPER_ADMIN_ID,
        audience: [{ kind: 'user', userId: OWNER_ID, recipientRole: 'applicant' }],
      }),
    );
  });

  it('does not notify when the record does not exist', async () => {
    financeModel.getFinanceRequestById.mockResolvedValue(null);

    const response = await auth(request(app).delete('/api/finance-requests/20'));

    expect(response.status).toBe(404);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });

  it('emits an empty audience rather than a broken one when there is no owner', async () => {
    financeModel.getFinanceRequestById.mockResolvedValue({
      id: 20,
      applicant_user_id: null,
      created_by: null,
      workflow_state: { status: 'in_progress', currentStage: 'level1' },
    });

    await auth(request(app).delete('/api/finance-requests/20'));

    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ audience: [] }),
    );
  });
});

describe('DELETE /api/expenditure/:id', () => {
  beforeEach(() => {
    expenditureModel.getExpenditureById.mockResolvedValue({
      id: 7,
      created_by: OWNER_ID,
      workflow_state: JSON.stringify({ status: 'in_progress', currentStage: 'level1' }),
    });
    expenditureModel.deleteExpenditure.mockResolvedValue(true);
  });

  it('tells the applicant their request was deleted', async () => {
    const response = await auth(request(app).delete('/api/expenditure/7'));

    expect(response.status).toBe(200);
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'expenditure.deleted',
        actorUserId: SUPER_ADMIN_ID,
        audience: [{ kind: 'user', userId: OWNER_ID, recipientRole: 'applicant' }],
      }),
    );
  });

  it('does not notify when the record does not exist', async () => {
    expenditureModel.getExpenditureById.mockResolvedValue(null);

    const response = await auth(request(app).delete('/api/expenditure/7'));

    expect(response.status).toBe(404);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });
});
