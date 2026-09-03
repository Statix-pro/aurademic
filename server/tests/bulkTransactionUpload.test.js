import fs from 'fs';
import path from 'path';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../server.js';

process.env.JWT_SECRET = 'test-secret-key';

import accessControlModel from '../modules/accessControl/accessControlModel.js';
import * as expenditureModel from '../modules/expenditure/expenditureModel.js';
import workflowService from '../modules/shared/workflow/workflowService.js';

vi.mock('../modules/expenditure/expenditureModel.js', () => ({
  createExpenditureRequest: vi.fn(),
  revertBudgetUsage: vi.fn(),
  hardDeleteExpenditureRequest: vi.fn(),
  getExpenditureOwner: vi.fn(),
}));

vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  default: { startWorkflow: vi.fn() },
}));

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

const BULK_TRANSACTION_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'expenditure', 'bulk-neft');

/** Files multer wrote to disk during a test, so each case can assert nothing is orphaned. */
const listStoredUploads = () =>
  fs.existsSync(BULK_TRANSACTION_UPLOAD_DIR) ? fs.readdirSync(BULK_TRANSACTION_UPLOAD_DIR) : [];

describe('Bulk transaction upload validation', () => {
  let token;
  let uploadsBefore;

  const basePayload = (overrides = {}) => ({
    request_type: 'Expenditure',
    showbulktransaction: true,
    bulktransactiontype: 'NEFT',
    bulktransactionbank: 'AXIS',
    ...overrides,
  });

  const postBulkTransaction = (payload, filename, contents = 'test-file') =>
    request(app)
      .post('/api/expenditure')
      .set('Authorization', `Bearer ${token}`)
      .field('payload', JSON.stringify(payload))
      .attach('bulk_transaction_file', Buffer.from(contents), filename);

  beforeEach(() => {
    vi.clearAllMocks();
    uploadsBefore = listStoredUploads();
    token = jwt.sign(
      {
        userId: 1,
        email: 'test-user@ksrct.ac.in',
        name: 'Test User',
        roles: ['faculty'],
        permissions: ['expenditure.create'],
      },
      process.env.JWT_SECRET,
    );
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
      roles: ['faculty'],
      permissions: [],
      isAdmin: false,
      isSuperAdmin: false,
    });
    expenditureModel.createExpenditureRequest.mockResolvedValue({
      expenditureId: 501,
      requestRef: '#EX-501',
    });
    workflowService.startWorkflow.mockResolvedValue({});
  });

  afterAll(() => {
    // Remove anything a passing (accepted-upload) case legitimately stored.
    listStoredUploads()
      .filter((name) => !uploadsBefore.includes(name))
      .forEach((name) => fs.rmSync(path.join(BULK_TRANSACTION_UPLOAD_DIR, name), { force: true }));
  });

  it('rejects an extension no mode allows with 400, not 500', async () => {
    const response = await postBulkTransaction(
      basePayload({ bulktransactiontype: 'DD' }),
      'dd.zip',
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/accepts only/i);
    expect(expenditureModel.createExpenditureRequest).not.toHaveBeenCalled();
    expect(listStoredUploads()).toEqual(uploadsBefore);
  });

  it('rejects a non-Excel file in an Excel-only mode with 400', async () => {
    const response = await postBulkTransaction(
      basePayload({ bulktransactiontype: 'NEFT' }),
      'draft-scan.pdf',
    );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/only accepts Excel files/i);
    expect(expenditureModel.createExpenditureRequest).not.toHaveBeenCalled();
    // The rejected upload must not be left behind on disk.
    expect(listStoredUploads()).toEqual(uploadsBefore);
  });

  it('accepts a PDF scan in DD mode', async () => {
    const response = await postBulkTransaction(
      basePayload({ bulktransactiontype: 'DD', bulktransactionbank: null }),
      'draft-scan.pdf',
    );

    expect(response.status).toBe(201);
    expect(expenditureModel.createExpenditureRequest).toHaveBeenCalledWith(
      expect.objectContaining({ bulk_transaction_type: 'DD', bulk_transaction_bank: null }),
      1,
      expect.objectContaining({
        bulkTransactionFile: expect.objectContaining({ path: expect.any(String) }),
      }),
    );
  });

  it('accepts an Excel file in NEFT mode and keeps the selected bank', async () => {
    const response = await postBulkTransaction(
      basePayload({ bulktransactiontype: 'NEFT', bulktransactionbank: 'DBS' }),
      'payouts.xlsx',
    );

    expect(response.status).toBe(201);
    expect(expenditureModel.createExpenditureRequest).toHaveBeenCalledWith(
      expect.objectContaining({ bulk_transaction_type: 'NEFT', bulk_transaction_bank: 'DBS' }),
      1,
      expect.anything(),
    );
  });

  it('defaults an unknown mode to NEFT rather than trusting the client', async () => {
    const response = await postBulkTransaction(
      basePayload({ bulktransactiontype: 'CRYPTO' }),
      'payouts.xls',
    );

    expect(response.status).toBe(201);
    expect(expenditureModel.createExpenditureRequest).toHaveBeenCalledWith(
      expect.objectContaining({ bulk_transaction_type: 'NEFT' }),
      1,
      expect.anything(),
    );
  });
});
