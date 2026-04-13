import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as expenditureModel from './expenditureModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPENDITURE_TEMPLATE_DIR = path.resolve(__dirname, '../../templates/expenditure');
const BULK_NEFT_TEMPLATE_PATH = path.join(
  EXPENDITURE_TEMPLATE_DIR,
  'bulk-neft-template.xls',
);
const SAMPLE_BULK_NEFT_TEMPLATE_PATH = path.join(
  EXPENDITURE_TEMPLATE_DIR,
  'sample-bulk-neft-template.xls',
);
const BULK_NEFT_TEMPLATE_DOWNLOAD_NAME = 'bulk-neft-template.xls';

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveActor = (req) => ({
  id: req.user?.id,
  email: req.user?.email,
  role: Array.isArray(req.user?.roles) ? req.user.roles[0] : null,
  isSuperAdmin: Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin),
});

const sendError = (res, status, message) =>
  res.status(status).json({ status: 'error', message });

const handleError = (res, err, fallback) => {
  console.error(fallback, err);
  return res.status(500).json({ status: 'error', message: err.message || fallback });
};

const parseRequestPayload = (req) => {
  const rawPayload = req.body?.payload;
  if (typeof rawPayload === 'string' && rawPayload.trim()) {
    return JSON.parse(rawPayload);
  }
  return req.body || {};
};

const isDomainValidationError = (message = '') => [
  'not found',
  'not yet approved',
  'exceeds',
  'required',
  'Invalid request type',
].some((fragment) => message.includes(fragment));

const resolveBulkNeftTemplatePath = () => {
  if (fs.existsSync(BULK_NEFT_TEMPLATE_PATH)) {
    return BULK_NEFT_TEMPLATE_PATH;
  }

  if (fs.existsSync(SAMPLE_BULK_NEFT_TEMPLATE_PATH)) {
    return SAMPLE_BULK_NEFT_TEMPLATE_PATH;
  }

  return null;
};

const expenditureController = {
  async downloadBulkNeftTemplate(req, res) {
    try {
      const templatePath = resolveBulkNeftTemplatePath();
      if (!templatePath) {
        return sendError(res, 404, 'Bulk NEFT template not found');
      }

      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      return res.download(templatePath, BULK_NEFT_TEMPLATE_DOWNLOAD_NAME);
    } catch (err) {
      return handleError(res, err, 'Error downloading Bulk NEFT template');
    }
  },

  async getCurrentEmployeeInfo(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) return sendError(res, 401, 'Invalid user context');

      const employee = await expenditureModel.getCurrentEmployee(userId);
      if (!employee) return sendError(res, 404, 'Employee record not found for this user');

      return res.json({ status: 'success', data: employee });
    } catch (err) {
      return handleError(res, err, 'Error fetching current employee info');
    }
  },

  async getApprovedBudgets(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const userEmail = normalizeText(req.user?.email);
      const financeRequestId = toPositiveInt(req.query.finance_request_id);
      if (!financeRequestId) {
        return sendError(res, 400, 'finance_request_id is required');
      }

      let budgets = await expenditureModel.getApprovedBudgets({ userId, userEmail, financeRequestId });

      const head = normalizeText(req.query.head).toLowerCase();
      const subHead = normalizeText(req.query.sub_head).toLowerCase();
      if (head) budgets = budgets.filter((budget) => budget.head.toLowerCase().includes(head));
      if (subHead) budgets = budgets.filter((budget) => budget.subHead.toLowerCase().includes(subHead));

      return res.json({ status: 'success', data: budgets });
    } catch (err) {
      return handleError(res, err, 'Error fetching approved budgets');
    }
  },

  async getAdvanceSummary(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const budgetLineId = toPositiveInt(req.query.budget_line_id);
      const head = normalizeText(req.query.head);
      const subHead = normalizeText(req.query.sub_head);

      const summary = await expenditureModel.getAdvanceSummary({
        userId,
        budgetLineId,
        head,
        subHead,
      });
      return res.json({ status: 'success', data: summary });
    } catch (err) {
      return handleError(res, err, 'Error fetching advance summary');
    }
  },

  async getExpenditureDashboard(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) return sendError(res, 401, 'Invalid user context');

      const fiscalYear = toPositiveInt(req.query.fiscalYear);
      const dashboard = await expenditureModel.getExpenditureDashboard({ userId, fiscalYear });

      return res.json({
        status: 'success',
        data: dashboard.requests,
        cards: dashboard.cards,
      });
    } catch (err) {
      return handleError(res, err, 'Error fetching expenditure dashboard');
    }
  },

  async getFinanceRequestContext(req, res) {
    try {
      const financeId = toPositiveInt(req.params.financeId);
      const userId = toPositiveInt(req.user?.id);
      const isSuperAdmin = Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin);

      if (!financeId) return sendError(res, 400, 'Invalid finance request ID');
      if (!userId && !isSuperAdmin) return sendError(res, 401, 'Invalid user context');

      const context = await expenditureModel.getFinanceRequestContext(financeId);
      if (!context) return sendError(res, 404, 'Finance request not found');

      if (!isSuperAdmin && toPositiveInt(context.created_by) !== userId) {
        return sendError(res, 403, 'Access denied');
      }

      return res.json({ status: 'success', data: context });
    } catch (err) {
      return handleError(res, err, 'Error fetching finance request context');
    }
  },

  async listPayees(req, res) {
    try {
      const { search = '', limit = 20, offset = 0 } = req.query;
      const payees = await expenditureModel.listPayees({
        search,
        limit: Number(limit) || 20,
        offset: Number(offset) || 0,
      });

      return res.json({ status: 'success', data: payees });
    } catch (err) {
      return handleError(res, err, 'Error listing payees');
    }
  },

  async getPayee(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid payee ID');

      const payee = await expenditureModel.getPayeeById(id);
      if (!payee) return sendError(res, 404, 'Payee not found');

      return res.json({ status: 'success', data: payee });
    } catch (err) {
      return handleError(res, err, 'Error fetching payee');
    }
  },

  async createPayee(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const { payee_name, account_no, ifsc, bank_name, branch_name } = req.body || {};

      if (!payee_name || !account_no || !ifsc || !bank_name || !branch_name) {
        return sendError(
          res,
          400,
          'payee_name, account_no, ifsc, bank_name and branch_name are required',
        );
      }

      const payeeId = await expenditureModel.upsertPayee(req.body, userId);
      const payee = await expenditureModel.getPayeeById(payeeId);

      return res.status(201).json({
        status: 'success',
        message: 'Payee saved successfully',
        data: payee,
      });
    } catch (err) {
      return handleError(res, err, 'Error creating payee');
    }
  },

  async createAdvance(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) return sendError(res, 401, 'Invalid user context');

      const data = req.body || {};

      if (!data.budget_line_id) {
        return sendError(res, 400, 'budget_line_id is required');
      }
      if (!data.amount || Number(data.amount) <= 0) {
        return sendError(res, 400, 'amount must be a positive number');
      }
      if (!data.purpose) {
        return sendError(res, 400, 'purpose is required');
      }
      if (!data.payee_id && !data.payment_details) {
        return sendError(
          res,
          400,
          'Either payee_id (existing payee) or payment_details (new payee) is required',
        );
      }
      if (data.payment_details) {
        const paymentDetails = data.payment_details;
        if (!paymentDetails.account_no || !paymentDetails.ifsc || !paymentDetails.bank_name) {
          return sendError(
            res,
            400,
            'payment_details must include account_no, ifsc and bank_name',
          );
        }
      }

      const result = await expenditureModel.createExpenditure(data, userId);

      return res.status(201).json({
        status: 'success',
        message: 'Advance request submitted successfully',
        data: result,
      });
    } catch (err) {
      if (isDomainValidationError(err.message)) {
        return sendError(res, 400, err.message);
      }
      return handleError(res, err, 'Error submitting advance request');
    }
  },

  async createExpenditureRequest(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) return sendError(res, 401, 'Invalid user context');

      let payload;
      try {
        payload = parseRequestPayload(req);
      } catch {
        return sendError(res, 400, 'Invalid payload JSON');
      }

      const uploads = {
        billFiles: Array.isArray(req.files?.bill_files) ? req.files.bill_files : [],
        bulkNeftFile: Array.isArray(req.files?.bulk_neft_file) ? req.files.bulk_neft_file[0] : null,
      };

      const result = await expenditureModel.createExpenditureRequest(payload, userId, uploads);

      return res.status(201).json({
        status: 'success',
        message: 'Expenditure request submitted successfully',
        data: result,
      });
    } catch (err) {
      if (isDomainValidationError(err.message)) {
        return sendError(res, 400, err.message);
      }
      return handleError(res, err, 'Error submitting expenditure request');
    }
  },

  async searchApplicant(req, res) {
    try {
      const query = normalizeText(req.query?.q);
      const type = normalizeText(req.query?.type);
      const results = await expenditureModel.searchApplicant(query, type || null);
      return res.json({ status: 'success', data: results });
    } catch (err) {
      return handleError(res, err, 'Error searching applicant');
    }
  },

  async listExpenditures(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const {
        mine,
        status,
        budget_line_id,
        request_type,
        finance_request_id,
        page,
        limit,
      } = req.query;

      const result = await expenditureModel.listExpenditures({
        userId,
        mine: mine === 'true' || mine === '1',
        status: normalizeText(status) || null,
        budgetLineId: toPositiveInt(budget_line_id),
        requestType: normalizeText(request_type) || null,
        financeRequestId: toPositiveInt(finance_request_id),
        page,
        limit,
      });

      return res.json({ status: 'success', ...result });
    } catch (err) {
      return handleError(res, err, 'Error listing expenditure requests');
    }
  },

  async getExpenditure(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const record = await expenditureModel.getExpenditureById(id);
      if (!record) return sendError(res, 404, 'Expenditure request not found');

      const userId = toPositiveInt(req.user?.id);
      const isOwner = userId && userId === toPositiveInt(record.created_by);
      const isSuperAdmin = Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin);

      if (!isOwner && !isSuperAdmin) {
        return sendError(res, 403, 'Access denied');
      }

      const details = await expenditureModel.getExpenditureDetails(id);
      return res.json({ status: 'success', data: { ...record, ...details } });
    } catch (err) {
      return handleError(res, err, 'Error fetching expenditure request');
    }
  },

  async updateExpenditure(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const record = await expenditureModel.getExpenditureById(id);
      if (!record) return sendError(res, 404, 'Expenditure request not found');

      const isOwner = userId && userId === toPositiveInt(record.created_by);
      const isSuperAdmin = Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin);
      if (!isOwner && !isSuperAdmin) return sendError(res, 403, 'Access denied');

      const result = await expenditureModel.updateExpenditure(id, req.body || {}, resolveActor(req));

      return res.json({
        status: 'success',
        message: 'Expenditure request updated',
        data: { affectedRows: result.affectedRows },
      });
    } catch (err) {
      return handleError(res, err, 'Error updating expenditure request');
    }
  },

  async deleteExpenditure(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const record = await expenditureModel.getExpenditureById(id);
      if (!record) return sendError(res, 404, 'Expenditure request not found');

      await expenditureModel.deleteExpenditure(id);
      return res.json({ status: 'success', message: 'Expenditure request deleted' });
    } catch (err) {
      if (err.message.includes('Only pending')) return sendError(res, 400, err.message);
      return handleError(res, err, 'Error deleting expenditure request');
    }
  },

  async getTimeline(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const exists = await expenditureModel.getExpenditureOwner(id);
      if (!exists) return sendError(res, 404, 'Expenditure request not found');

      const updates = await expenditureModel.getStatusUpdates(id);
      return res.json({ status: 'success', data: updates });
    } catch (err) {
      return handleError(res, err, 'Error fetching expenditure timeline');
    }
  },
};

export default expenditureController;
