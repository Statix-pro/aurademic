import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as expenditureModel from './expenditureModel.js';
import './expenditureWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPENDITURE_TEMPLATE_DIR = path.resolve(__dirname, '../../templates/expenditure');
const BULK_NEFT_TEMPLATE_PATH = path.join(EXPENDITURE_TEMPLATE_DIR, 'bulk-neft-template.xls');
const SAMPLE_BULK_NEFT_TEMPLATE_PATH = path.join(
  EXPENDITURE_TEMPLATE_DIR,
  'sample-bulk-neft-template.xls',
);
const BULK_NEFT_TEMPLATE_DOWNLOAD_NAME = 'bulk-neft-template.xls';

const normalizeText = (value) => String(value || '').trim();
const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'];

const toMoney = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const resolveUnplannedBudgetMeta = (source = {}) => {
  const enabled = parseBoolean(source.unplanned_budget_enabled);
  const amount = enabled ? toMoney(source.unplanned_budget_amount) : 0;
  return {
    unplannedBudgetEnabled: enabled,
    unplannedBudgetAmount: enabled ? amount : null,
    unplannedBudgetHead: normalizeText(source.unplanned_budget_head) || null,
    unplannedBudgetSubHead: normalizeText(source.unplanned_budget_sub_head) || null,
    unplannedBudgetDescription: normalizeText(source.unplanned_budget_description) || null,
  };
};

const sumRowsByKeys = (rows, keys = []) =>
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const value = keys.map((key) => row?.[key]).find((candidate) => normalizeText(candidate));
    return sum + toMoney(value);
  }, 0);

const calculateSubmittedExpenditureTotal = (payload = {}) => {
  const plannedTotal =
    sumRowsByKeys(payload.advance_rows || payload.advancerows, ['advance', 'advance_amount']) +
    sumRowsByKeys(payload.settlement_rows || payload.settlementrows, ['settlement', 'settlement_amount']) +
    sumRowsByKeys(payload.expenditure_rows || payload.expenditurerows, ['autoSum', 'auto_sum_amount', 'expenditure']);
  const unplanned = resolveUnplannedBudgetMeta(payload);
  return plannedTotal + (unplanned.unplannedBudgetEnabled ? toMoney(unplanned.unplannedBudgetAmount) : 0);
};

const resolveCanonicalPayeeName = (payeeName, accountName) => {
  const normalizedPayeeName = normalizeText(payeeName);
  const normalizedAccountName = normalizeText(accountName);

  if (normalizedPayeeName && !BENEFICIARY_ORG_OPTIONS.includes(normalizedPayeeName)) {
    return normalizedPayeeName;
  }

  return normalizedAccountName || normalizedPayeeName;
};

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseWorkflowState = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const parseDateMs = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

const resolveCurrentCycleStartMs = (record, entries = []) => {
  const workflowState = parseWorkflowState(record?.workflow_state) || {};
  const resubmittedAtMs = parseDateMs(workflowState.resubmittedAt);

  if (resubmittedAtMs) {
    let latestReturnMs = null;
    for (const entry of entries) {
      const decisionToken = normalizeText(entry?.decision || entry?.status).toLowerCase();
      if (decisionToken !== 'returned' && decisionToken !== 'return') continue;

      const actionMs =
        parseDateMs(entry?.decidedAt) ||
        parseDateMs(entry?.decided_at) ||
        parseDateMs(entry?.createdAt) ||
        parseDateMs(entry?.created_at);

      if (!actionMs) continue;
      if (actionMs <= resubmittedAtMs && (!latestReturnMs || actionMs > latestReturnMs)) {
        latestReturnMs = actionMs;
      }
    }

    return latestReturnMs || resubmittedAtMs;
  }

  return parseDateMs(workflowState.startedAt) || parseDateMs(record?.created_at) || null;
};

const filterEntriesForCurrentCycle = (entries, record) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const cycleStartMs = resolveCurrentCycleStartMs(record, entries);
  if (!cycleStartMs) return entries;

  return entries.filter((entry) => {
    const actionMs =
      parseDateMs(entry?.decidedAt) ||
      parseDateMs(entry?.decided_at) ||
      parseDateMs(entry?.createdAt) ||
      parseDateMs(entry?.created_at);
    if (!actionMs) return true;
    return actionMs >= cycleStartMs;
  });
};

const getNormalizedUserRoles = (req) => {
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : normalizeText(req.user?.roles)
      ? [normalizeText(req.user?.roles)]
      : [];
  const role = normalizeText(req.user?.role);
  return [...roles, role]
    .map((entry) => normalizeText(entry).toLowerCase())
    .filter(Boolean);
};

const getNormalizedUserPermissions = (req) => {
  const permissions = Array.isArray(req.user?.permissions)
    ? req.user.permissions
    : normalizeText(req.user?.permissions)
      ? [normalizeText(req.user?.permissions)]
      : [];
  return permissions
    .map((entry) => normalizeText(entry).toLowerCase())
    .filter(Boolean);
};

const resolveActor = (req) => {
  const roles = getNormalizedUserRoles(req);

  const role = normalizeText(req.user?.role) || roles[0] || null;

  const permissions = getNormalizedUserPermissions(req);

  return {
    id: req.user?.id,
    userId: req.user?.id,
    email: req.user?.email,
    role,
    roles,
    permissions,
    isSuperAdmin: Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)
      || roles.includes('super_admin'),
  };
};

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message, error: message });

const unwrapTransactionMessage = (message = '') =>
  normalizeText(message).replace(/^Transaction failed:\s*/i, '');

const handleError = (res, err, fallback) => {
  if (err instanceof WorkflowError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      error: err.message,
      code: err.code,
    });
  }
  console.error(fallback, err);
  return res.status(500).json({
    success: false,
    message: fallback,
    error: fallback,
  });
};

const parseRequestPayload = (req) => {
  const rawPayload = req.body?.payload;
  if (typeof rawPayload === 'string' && rawPayload.trim()) {
    return JSON.parse(rawPayload);
  }
  return req.body || {};
};

const getExpenditureUploads = (req) => ({
  billFiles: Array.isArray(req.files?.bill_files)
    ? req.files.bill_files
    : [],
  bulkNeftFile: Array.isArray(req.files?.bulk_neft_file)
    ? req.files.bulk_neft_file[0]
    : null,
  paymentProofFiles: Array.isArray(req.files?.payment_proof_files)
    ? req.files.payment_proof_files
    : [],
});

const VALID_REQUEST_TYPES = new Set(['Advance', 'Settlement', 'Expenditure']);

const normalizeRequestType = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const formatted = `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
  return VALID_REQUEST_TYPES.has(formatted) ? formatted : null;
};

const normalizeIncomingPayload = (payload = {}) => {
  const normalized = { ...payload };

  if (normalized.financerequestid && !normalized.finance_request_id) {
    normalized.finance_request_id = normalized.financerequestid;
  }
  if (normalized.employeeid && !normalized.employee_id) {
    normalized.employee_id = normalized.employeeid;
  }
  if (normalized.applicantname && !normalized.applicant_name) {
    normalized.applicant_name = normalized.applicantname;
  }
  if (normalized.beneficiarytype && !normalized.beneficiary_type) {
    normalized.beneficiary_type = normalized.beneficiarytype;
  }
  if (normalized.beneficiaryvalue && !normalized.beneficiary_value) {
    normalized.beneficiary_value = normalized.beneficiaryvalue;
  }
  if (normalized.beneficiaryentityid && !normalized.beneficiary_entity_id) {
    normalized.beneficiary_entity_id = normalized.beneficiaryentityid;
  }
  if (normalized.primaryhead && !normalized.primary_head) {
    normalized.primary_head = normalized.primaryhead;
  }
  if (normalized.eventsubhead && !normalized.event_sub_head) {
    normalized.event_sub_head = normalized.eventsubhead;
  }
  if (normalized.isbudgetproposed && !normalized.is_budget_proposed) {
    normalized.is_budget_proposed = normalized.isbudgetproposed;
  }
  if (normalized.proposedamount && !normalized.proposed_amount) {
    normalized.proposed_amount = normalized.proposedamount;
  }
  if (normalized.balanceamount && !normalized.balance_amount) {
    normalized.balance_amount = normalized.balanceamount;
  }
  if (normalized.unplannedbudgetenabled !== undefined && normalized.unplanned_budget_enabled === undefined) {
    normalized.unplanned_budget_enabled = normalized.unplannedbudgetenabled;
  }
  if (normalized.unplannedbudgetamount !== undefined && normalized.unplanned_budget_amount === undefined) {
    normalized.unplanned_budget_amount = normalized.unplannedbudgetamount;
  }
  if (normalized.unplannedbudgethead !== undefined && normalized.unplanned_budget_head === undefined) {
    normalized.unplanned_budget_head = normalized.unplannedbudgethead;
  }
  if (normalized.unplannedbudgetsubhead !== undefined && normalized.unplanned_budget_sub_head === undefined) {
    normalized.unplanned_budget_sub_head = normalized.unplannedbudgetsubhead;
  }
  if (normalized.unplannedbudgetdescription !== undefined && normalized.unplanned_budget_description === undefined) {
    normalized.unplanned_budget_description = normalized.unplannedbudgetdescription;
  }
  if (normalized.debitstatus && !normalized.debit_status) {
    normalized.debit_status = normalized.debitstatus;
  }
  if (normalized.partialamount && !normalized.partial_amount) {
    normalized.partial_amount = normalized.partialamount;
  }
  if (normalized.paymentdetails && !normalized.payment_details) {
    normalized.payment_details = normalized.paymentdetails;
  }
  if (normalized.paymentmode && !normalized.payment_mode) {
    normalized.payment_mode = normalized.paymentmode;
  }
  if (normalized.paymentrefno && !normalized.payment_ref_no) {
    normalized.payment_ref_no = normalized.paymentrefno;
  }
  if (normalized.paymentdate && !normalized.payment_date) {
    normalized.payment_date = normalized.paymentdate;
  }
  if (normalized.paymentstatus && !normalized.payment_status) {
    normalized.payment_status = normalized.paymentstatus;
  }
  if (normalized.paymentdebitaccount && !normalized.payment_debit_account) {
    normalized.payment_debit_account = normalized.paymentdebitaccount;
  }
  if (normalized.showbulkneft !== undefined && normalized.show_bulk_neft === undefined) {
    normalized.show_bulk_neft = normalized.showbulkneft;
  }
  if (normalized.bulknefttemplateversion && !normalized.bulk_neft_template_version) {
    normalized.bulk_neft_template_version = normalized.bulknefttemplateversion;
  }

  if (Array.isArray(normalized.advancerows) && !normalized.advance_rows) {
    normalized.advance_rows = normalized.advancerows;
  }
  if (Array.isArray(normalized.settlementrows) && !normalized.settlement_rows) {
    normalized.settlement_rows = normalized.settlementrows;
  }
  if (Array.isArray(normalized.expenditurerows) && !normalized.expenditure_rows) {
    normalized.expenditure_rows = normalized.expenditurerows;
  }
  if (Array.isArray(normalized.payeerows) && !normalized.payee_rows) {
    normalized.payee_rows = normalized.payeerows;
  }
  if (Array.isArray(normalized.incomerows) && !normalized.income_rows) {
    normalized.income_rows = normalized.incomerows;
  }

  normalized.request_type = normalizeRequestType(
    normalized.request_type ||
      normalized.requesttype ||
      normalized.requestType ||
      normalized.workflowrequesttype ||
      normalized.workflow_request_type ||
      normalized.activeTab,
  );

  return normalized;
};

const isDomainValidationError = (message = '') =>
  [
    'not found',
    'not yet approved',
    'not approved',
    'Payee must be selected from approved suggestions',
    'New payees require DoF approval',
    'exceeds',
    'required',
    'Invalid request type',
    'already exists',
    'requires an existing advance',
    'cannot be created',
    'outstanding advance',
    'Create a new row',
  ].some((fragment) => unwrapTransactionMessage(message).includes(fragment));

const sendDomainValidationError = (res, err) => {
  const message = unwrapTransactionMessage(err?.message);
  if (!isDomainValidationError(message)) return false;
  sendError(res, 400, message);
  return true;
};

const sendAccessDeniedError = (res, err) => {
  const message = unwrapTransactionMessage(err?.message);
  if (!message.toLowerCase().includes('access denied')) return false;
  sendError(res, 403, message);
  return true;
};

const resolveBulkNeftTemplatePath = () => {
  if (fs.existsSync(BULK_NEFT_TEMPLATE_PATH)) return BULK_NEFT_TEMPLATE_PATH;
  if (fs.existsSync(SAMPLE_BULK_NEFT_TEMPLATE_PATH)) return SAMPLE_BULK_NEFT_TEMPLATE_PATH;
  return null;
};

const isSuperAdminRequest = (req) =>
  Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)
  || getNormalizedUserRoles(req).includes('super_admin');

const hasAnyExpenditureWorkflowPermission = (req) => {
  const permissions = getNormalizedUserPermissions(req);
  return permissions.some((permission) =>
    permission.startsWith('expenditure.workflow.') ||
    permission.startsWith('finance.workflow.')
  );
};

const hasExpenditureStagePermission = (req, stage) => {
  const normalizedStage = normalizeText(stage).toLowerCase();
  if (!normalizedStage) return false;
  if (isSuperAdminRequest(req)) return true;

  const permissions = getNormalizedUserPermissions(req);
  return (
    permissions.includes(`expenditure.workflow.${normalizedStage}`) ||
    permissions.includes(`finance.workflow.${normalizedStage}`)
  );
};

const canAccessExpenditureByRole = (req) => {
  const normalizedRoles = getNormalizedUserRoles(req);

  if (!normalizedRoles.length) {
    return false;
  }

  if (normalizedRoles.includes('super_admin')) {
    return true;
  }

  if (normalizedRoles.includes('admin')) {
    return true;
  }

  return normalizedRoles.some((role) =>
    ['hod', 'coordinator', 'entity_approver', 'dof', 'principal'].includes(role)
  );
};

const resolveExpenditureLevel1QueueRole = (req) => {
  const normalizedRoles = getNormalizedUserRoles(req);

  const hasCoordinatorRole = normalizedRoles.includes('coordinator') || normalizedRoles.includes('entity_approver');
  const hasHodRole = normalizedRoles.includes('hod');

  if (hasCoordinatorRole && !hasHodRole) return 'coordinator';
  if (hasHodRole && !hasCoordinatorRole) return 'hod';
  return null;
};

const canAccessExpenditureRecord = (req, record) => {
  const userId = toPositiveInt(req.user?.id);
  if (!record) return false;
  if (isSuperAdminRequest(req)) return true;
  if (userId && userId === toPositiveInt(record.created_by)) return true;
  if (hasAnyExpenditureWorkflowPermission(req)) return true;
  return canAccessExpenditureByRole(req);
};

const expenditureController = {
  async downloadBulkNeftTemplate(req, res) {
    try {
      const templatePath = resolveBulkNeftTemplatePath();
      if (!templatePath) return sendError(res, 404, 'Bulk NEFT template not found');

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
      if (!financeRequestId) return sendError(res, 400, 'finance_request_id is required');

      let budgets = await expenditureModel.getApprovedBudgets({
        userId,
        userEmail,
        financeRequestId,
        allowAnyApprovedFinance:
          isSuperAdminRequest(req) ||
          hasAnyExpenditureWorkflowPermission(req) ||
          canAccessExpenditureByRole(req),
      });

      const head = normalizeText(req.query.head).toLowerCase();
      const subHead = normalizeText(req.query.sub_head).toLowerCase();
      if (head) budgets = budgets.filter((budget) => budget.head.toLowerCase().includes(head));
      if (subHead) budgets = budgets.filter((budget) => budget.subHead.toLowerCase().includes(subHead));

      return res.json({ success: true, data: budgets });
    } catch (err) {
      return handleError(res, err, 'Error fetching approved budgets');
    }
  },

  async getAdvanceSummary(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const budgetLineId = toPositiveInt(req.query.budget_line_id);
      const financeRequestId = toPositiveInt(req.query.finance_request_id);
      const rowIndex = toPositiveInt(req.query.row_index);
      const sourceRequestId = toPositiveInt(req.query.source_request_id);
      const head = normalizeText(req.query.head);
      const subHead = normalizeText(req.query.sub_head);
      const dashboardRowId = normalizeText(req.query.dashboard_row_id);
      const workflowRowRef = normalizeText(req.query.workflowrowref || req.query.workflow_row_ref);

      const summary = await expenditureModel.getAdvanceSummary({
        userId,
        budgetLineId,
        head,
        subHead,
        financeRequestId,
        rowIndex,
        sourceRequestId,
        dashboardRowId,
        workflowRowRef,
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
      const { search = '', limit = 20, offset = 0, status = 'all' } = req.query;
      const payees = await expenditureModel.listPayees({
        search,
        limit: Number(limit) || 20,
        offset: Number(offset) || 0,
        status,
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

  async updatePayee(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid payee ID');

      const updated = await expenditureModel.updatePayeeById(id, req.body || {});
      if (!updated) return sendError(res, 404, 'Payee not found');

      const payee = await expenditureModel.getPayeeById(id);
      return res.json({
        success: true,
        status: 'success',
        message: 'Payee updated successfully',
        data: payee,
      });
    } catch (err) {
      const message = normalizeText(err.message);
      if (message.includes('required') || message.includes('Invalid')) {
        return sendError(res, 400, message);
      }
      return handleError(res, err, 'Error updating payee');
    }
  },

  async updatePayeeApproval(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid payee ID');

      const decision = normalizeText(req.body?.decision).toLowerCase();
      const rejectionReason = normalizeText(req.body?.rejection_reason);
      const updated = await expenditureModel.updatePayeeApproval(id, {
        decision,
        rejectionReason,
        userId: toPositiveInt(req.user?.id),
      });

      if (!updated) return sendError(res, 404, 'Payee not found');

      return res.json({
        status: 'success',
        message: `Payee ${decision} successfully`,
      });
    } catch (err) {
      const message = normalizeText(err.message);
      if (message.includes('required') || message.includes('Invalid') || message.includes('Unsupported')) {
        return sendError(res, 400, message);
      }
      return handleError(res, err, 'Error updating payee approval');
    }
  },

  async deletePayee(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid payee ID');

      const deleted = await expenditureModel.deletePayeeById(id);
      if (!deleted) return sendError(res, 404, 'Payee not found');

      return res.json({ status: 'success', message: 'Payee deleted successfully' });
    } catch (err) {
      return handleError(res, err, 'Error deleting payee');
    }
  },

  async createPayee(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const { payee_name, account_name, account_no, ifsc, bank_name, branch_name } = req.body || {};
      const canonicalPayeeName = resolveCanonicalPayeeName(payee_name, account_name);

      if (!canonicalPayeeName || !account_no || !ifsc || !bank_name || !branch_name) {
        return sendError(
          res,
          400,
          'accountant name, account_no, ifsc, bank_name and branch_name are required',
        );
      }

      const payeeId = await expenditureModel.upsertPayee(
        {
          ...req.body,
          payee_name: canonicalPayeeName,
          account_name: canonicalPayeeName,
        },
        userId,
      );
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

      if (!data.budget_line_id) return sendError(res, 400, 'budget_line_id is required');
      if (!data.amount || Number(data.amount) <= 0) {
        return sendError(res, 400, 'amount must be a positive number');
      }
      if (!data.purpose) return sendError(res, 400, 'purpose is required');
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
      if (sendDomainValidationError(res, err)) return;
      return handleError(res, err, 'Error submitting advance request');
    }
  },

  async createExpenditureRequest(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) return sendError(res, 401, 'Invalid user context');

      let payload;
      try {
        payload = normalizeIncomingPayload(parseRequestPayload(req));
      } catch {
        return sendError(res, 400, 'Invalid payload JSON');
      }

      if (!payload.request_type) {
        return sendError(
          res,
          400,
          'Invalid request type. Expected Advance, Settlement, or Expenditure.',
        );
      }
      const uploads = getExpenditureUploads(req);

      const result = await expenditureModel.createExpenditureRequest(payload, userId, uploads);
      const submittedTotal = calculateSubmittedExpenditureTotal(payload);
      const expenditureMeta = resolveUnplannedBudgetMeta(payload);

      try {
        await workflowService.startWorkflow({
          moduleKey: 'expenditure',
          recordId: result.expenditureId,
          metadata: {
            origin: 'system',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              trigger: 'create_expenditure_request',
              beneficiaryType: normalizeText(payload.beneficiary_type) || null,
              amountBand: submittedTotal > 10000 ? 'gt_10k' : 'lte_10k',
              expenditureMeta,
            },
          },
        });
      } catch (workflowError) {
        try {
          await expenditureModel.revertBudgetUsage(result.expenditureId);
          await expenditureModel.hardDeleteExpenditureRequest(result.expenditureId);
        } catch (cleanupError) {
         console.error('Failed to fully clean up expenditure request after workflow failure',cleanupError);
        }
        throw workflowError;
      }

      return res.status(201).json({
        status: 'success',
        message: 'Expenditure request submitted successfully',
        data: result,
      });
    } catch (err) {
      if (sendDomainValidationError(res, err)) return;
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
      const mineFlag = !(mine === 'false' || mine === '0');
      const result = await expenditureModel.listExpenditures({
        userId,
        mine: mineFlag,
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
      if (!canAccessExpenditureRecord(req, record)) {
        return sendError(res, 403, 'Access denied');
      }

      const details = await expenditureModel.getExpenditureDetails(id);
      let statusUpdates = [];
      try {
        const rawStatusUpdates = await expenditureModel.getStatusUpdates(id);
        statusUpdates = filterEntriesForCurrentCycle(rawStatusUpdates, record);
      } catch (statusError) {
        console.error('Failed to fetch expenditure status updates:', statusError);
      }

      return res.json({ status: 'success', data: { ...record, ...details, status_updates: statusUpdates } });
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
      const isWorkflowEditor = hasAnyExpenditureWorkflowPermission(req) || isSuperAdminRequest(req);
      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(workflowState?.status || record.workflow_status || record.overall_status).toLowerCase();
      const currentStage = normalizeText(workflowState?.currentStage || record.workflow_stage).toLowerCase();
      const isTerminalWorkflow = ['approved', 'rejected', 'archived', 'completed'].includes(workflowStatus);
      const requestBody = req.body || {};
      const paymentUpdateKeys = new Set([
        'payment_status',
        'payment_date',
        'payment_ref_no',
        'payment_mode',
        'payment_debit_account',
        'paymentdetails',
        'payment_details',
      ]);
      const bodyKeys = Object.keys(requestBody).filter((key) => requestBody[key] !== undefined);
      const isPaymentOnlyUpdate =
        bodyKeys.length > 0 && bodyKeys.every((key) => paymentUpdateKeys.has(key));
      const isFinalApprovedWorkflow =
        ['approved', 'completed'].includes(workflowStatus) ||
        normalizeText(record.overall_status).toLowerCase() === 'approved';

      if (!isOwner && !isWorkflowEditor) return sendError(res, 403, 'Access denied');

      const isApplicantEditable =
        Boolean(workflowState?.isEditableByApplicant) ||
        workflowStatus === 'returned' ||
        workflowStatus === 'submitted' ||
        currentStage === 'level1';

      if (
        isOwner &&
        !isWorkflowEditor &&
        !isApplicantEditable &&
        !(isPaymentOnlyUpdate && isFinalApprovedWorkflow)
      ) {
        return sendError(res, 403, 'This request is not editable in current workflow state');
      }

      if (
        isWorkflowEditor &&
        isTerminalWorkflow &&
        !isSuperAdminRequest(req) &&
        !isPaymentOnlyUpdate
      ) {
        return sendError(res, 403, 'This request is not editable in current workflow state');
      }

      const hasProposalPayload = Boolean(
        req.body?.payload ||
        req.files?.bill_files ||
        req.files?.bulk_neft_file ||
        req.body?.workflowrequesttype ||
        req.body?.workflow_request_type ||
        req.body?.request_type ||
        req.body?.advance_rows ||
        req.body?.advancerows ||
        req.body?.settlement_rows ||
        req.body?.settlementrows ||
        req.body?.expenditure_rows ||
        req.body?.expenditurerows ||
        req.body?.payee_rows ||
        req.body?.payeerows
      );

      if (hasProposalPayload) {
        let payload;
        try {
          payload = normalizeIncomingPayload(parseRequestPayload(req));
        } catch {
          return sendError(res, 400, 'Invalid payload JSON');
        }

        if (!payload.request_type) {
          return sendError(
            res,
            400,
            'Invalid request type. Expected Advance, Settlement, or Expenditure.',
          );
        }

        const uploads = getExpenditureUploads(req);

        const result = await expenditureModel.updateExpenditureRequest(id, payload, userId, uploads, {
          actor: resolveActor(req),
          isSuperAdmin: isSuperAdminRequest(req),
          isWorkflowEditor,
        });

        return res.json({
          status: 'success',
          message: 'Expenditure request updated successfully',
          data: result,
        });
      }

      const result = await expenditureModel.updateExpenditure(
        id,
        req.body || {},
        resolveActor(req),
        getExpenditureUploads(req),
      );

      return res.json({
        status: 'success',
        message: 'Expenditure request updated',
        data: {
          affectedRows: result.affectedRows,
          payment_proof_files: result.payment_proof_files || [],
        },
      });
    } catch (err) {
      if (sendAccessDeniedError(res, err)) return;
      if (sendDomainValidationError(res, err)) return;
      return handleError(res, err, 'Error updating expenditure request');
    }
  },

  async deleteExpenditure(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);
      const isSuperAdmin = isSuperAdminRequest(req);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const record = await expenditureModel.getExpenditureById(id);
      if (!record) return sendError(res, 404, 'Expenditure request not found');

      if (!isSuperAdmin && (!userId || toPositiveInt(record.created_by) !== userId)) {
        return sendError(res, 403, 'Only applicant can delete this request');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(workflowState?.status || record.workflow_status || record.overall_status).toLowerCase();
      const currentStage = normalizeText(workflowState?.currentStage || record.workflow_stage).toLowerCase();
      const hasStartedApproval = Boolean(workflowState) && currentStage && currentStage !== 'level1';

      if (!isSuperAdmin && workflowStatus && ['approved', 'rejected', 'archived', 'completed', 'returned'].includes(workflowStatus)) {
        return sendError(res, 409, 'This request can no longer be deleted');
      }

      if (!isSuperAdmin && hasStartedApproval) {
        return sendError(res, 409, 'This request can only be deleted before Level-1 approval');
      }

      await expenditureModel.deleteExpenditure(id, { isSuperAdmin });
      return res.json({ status: 'success', message: 'Expenditure request deleted' });
    } catch (err) {
      if (normalizeText(err.message).toLowerCase().includes('only pending')) return sendError(res, 409, err.message);
      return handleError(res, err, 'Error deleting expenditure request');
    }
  },

  async getTimeline(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) return sendError(res, 400, 'Invalid expenditure ID');

      const record = await expenditureModel.getExpenditureById(id);
      if (!record) return sendError(res, 404, 'Expenditure request not found');
      if (!canAccessExpenditureRecord(req, record)) return sendError(res, 403, 'Access denied');

      const updates = await expenditureModel.getStatusUpdates(id);
      const cycleScopedUpdates = filterEntriesForCurrentCycle(updates, record);
      return res.json({ status: 'success', data: cycleScopedUpdates });
    } catch (err) {
      return handleError(res, err, 'Error fetching expenditure timeline');
    }
  },

  async getWorkflowMeta(req, res) {
    try {
      const [metadata, availableBeneficiaryTypes, availableFiscalYears] = await Promise.all([
        workflowService.getWorkflowMetadata({
          moduleKey: 'expenditure',
          actor: resolveActor(req),
        }),
        expenditureModel.listAvailableBeneficiaryTypes(),
        expenditureModel.listAvailableFiscalYears(),
      ]);

      return res.status(200).json({
        status: 'success',
        data: {
          ...metadata,
          availableBeneficiaryTypes,
          availableFiscalYears,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error in getWorkflowMeta');
    }
  },

  async getExpenditureQueue(req, res) {
    try {
      const stage = normalizeText(req.params.stage).toLowerCase();
      const { page, limit, workflowStatus, statusCategory, level1Role, q, allProposals, fiscalYear } = req.query;
      const normalizedLevel1Role = normalizeText(level1Role).toLowerCase();
      const effectiveLevel1Role = stage === 'level1'
        ? (['hod', 'coordinator'].includes(normalizedLevel1Role)
          ? normalizedLevel1Role
          : resolveExpenditureLevel1QueueRole(req))
        : null;

      const queue = await workflowService.listQueue({
        moduleKey: 'expenditure',
        stage,
        actor: resolveActor(req),
        filters: {
          page,
          limit,
          workflowStatus,
          statusCategory,
          fiscalYear,
          level1Role: effectiveLevel1Role,
          q,
          allProposals: String(allProposals || '').toLowerCase() === 'true' || allProposals === '1',
        },
      });

      return res.status(200).json({
        status: 'success',
        data: queue.items,
        pagination: {
          total: queue.total,
          page: queue.page,
          limit: queue.limit,
          statusCounts: queue.statusCounts,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error in getExpenditureQueue');
    }
  },

  async approveExpenditureWorkflow(req, res) {
    try {
      const expenditureId = toPositiveInt(req.params.id);
      const { decision, feedback } = req.body || {};
      const normalizedDecision = normalizeText(decision).toLowerCase();
      const actor = resolveActor(req);

      if (!expenditureId) {
        return sendError(res, 400, 'Invalid expenditure request ID');
      }

      const record = await expenditureModel.getExpenditureById(expenditureId);
      if (!record) {
        return sendError(res, 404, 'Expenditure request not found');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(
        workflowState?.status || record.workflow_status || record.overall_status
      ).toLowerCase();
      const isTerminalWorkflow = ['completed', 'rejected', 'archived'].includes(workflowStatus);

      let result;
      if (actor.isSuperAdmin && normalizedDecision === 'returned' && isTerminalWorkflow) {
        result = await expenditureModel.forceWorkflowTransition(expenditureId, {
          decision: 'returned',
          feedback,
          actor,
          stageHint: normalizeText(record.workflow_stage).toLowerCase() || 'principal',
        });
      } else {
        result = await workflowService.actOnWorkflow({
          moduleKey: 'expenditure',
          recordId: expenditureId,
          decision,
          feedback,
          actor,
          metadata: {
            origin: 'api',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              route: 'PATCH /api/expenditure-requests/:id/approval',
            },
          },
        });

        const reachedPrincipalAfterDofApproval =
          result?.stage === 'dof' &&
          result?.decision === 'approved' &&
          normalizeText(result?.currentState?.currentStage).toLowerCase() === 'principal';

        if (reachedPrincipalAfterDofApproval) {
          const autoPrincipalResult = await expenditureModel.autoApprovePrincipalWorkflowStage(
            expenditureId,
            { actor }
          );

          if (autoPrincipalResult?.autoApproved) {
            result = {
              ...result,
              currentState: autoPrincipalResult.currentState,
              autoApprovedStages: ['principal'],
            };
          }
        }
      }

      return res.status(200).json({
        status: 'success',
        message: result.autoApprovedStages?.includes('principal')
          ? 'Workflow approved at stage dof; principal auto-approved'
          : `Workflow ${result.decision} at stage ${result.stage}`,
        data: {
          previousState: result.previousState,
          currentState: result.currentState,
          autoApprovedStages: result.autoApprovedStages || [],
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error in approveExpenditureWorkflow');
    }
  },

  async toggleArchiveStatus(req, res) {
    try {
      const expenditureId = toPositiveInt(req.params.id);
      if (!expenditureId) {
        return sendError(res, 400, 'Invalid expenditure request ID');
      }

      const record = await expenditureModel.getExpenditureById(expenditureId);
      if (!record) {
        return sendError(res, 404, 'Expenditure request not found');
      }

      if (!canAccessExpenditureRecord(req, record)) {
        return sendError(res, 403, 'Access denied');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(
        workflowState?.status || record.workflow_status || record.overall_status
      ).toLowerCase();
      const isArchived = workflowStatus === 'archived' || workflowStatus === 'archive';
      const actor = resolveActor(req);

      if (isArchived) {
        const latestArchive = await expenditureModel.getLatestArchiveAction(expenditureId);
        const archivedStage = normalizeText(latestArchive?.stage).toLowerCase();

        if (!hasExpenditureStagePermission(req, archivedStage)) {
          return sendError(
            res,
            403,
            archivedStage
              ? `Only ${archivedStage.toUpperCase()} stage users (or super admin) can unarchive this request`
              : 'You are not allowed to unarchive this request'
          );
        }

        const restoreResult = await expenditureModel.restoreWorkflowSnapshotFromLatestArchive(expenditureId);
        if (!restoreResult.restored) {
          return sendError(res, 409, restoreResult.reason || 'Unable to unarchive this request');
        }

        return res.status(200).json({
          status: 'success',
          message: 'Expenditure request unarchived successfully',
          data: {
            workflow_state: restoreResult.restoredState,
          },
        });
      }

      const isTerminalWorkflow = ['completed', 'rejected'].includes(workflowStatus);
      if (actor.isSuperAdmin && isTerminalWorkflow) {
        const forcedArchiveResult = await expenditureModel.forceWorkflowTransition(expenditureId, {
          decision: 'archived',
          feedback: normalizeText(req.body?.feedback) || null,
          actor,
          stageHint: normalizeText(record.workflow_stage).toLowerCase() || 'principal',
        });

        return res.status(200).json({
          status: 'success',
          message: 'Expenditure request archived successfully',
          data: {
            previousState: forcedArchiveResult.previousState,
            currentState: forcedArchiveResult.currentState,
          },
        });
      }

      const archiveResult = await workflowService.actOnWorkflow({
        moduleKey: 'expenditure',
        recordId: expenditureId,
        decision: 'archived',
        feedback: normalizeText(req.body?.feedback) || undefined,
        actor,
        metadata: {
          origin: 'api',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: {
            route: 'PATCH /api/expenditure-requests/:id/archive-toggle',
          },
        },
      });

      return res.status(200).json({
        status: 'success',
        message: 'Expenditure request archived successfully',
        data: {
          previousState: archiveResult.previousState,
          currentState: archiveResult.currentState,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error in toggleArchiveStatus');
    }
  },

  async resubmitExpenditureRequest(req, res) {
    try {
      const expenditureId = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);

      if (!expenditureId) {
        return sendError(res, 400, 'Invalid expenditure request ID');
      }

      const record = await expenditureModel.getExpenditureById(expenditureId);
      if (!record) {
        return sendError(res, 404, 'Expenditure request not found');
      }

      if (!userId || toPositiveInt(record.created_by) !== userId) {
        return sendError(res, 403, 'Only applicant can resubmit this request');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      if (!workflowState || normalizeText(workflowState.status).toLowerCase() !== 'returned') {
        return sendError(res, 409, 'Only returned requests can be resubmitted');
      }

      const resubmissionComment = normalizeText(req.body?.feedback || req.body?.comment || req.body?.remarks);
      if (!resubmissionComment) {
        return sendError(res, 400, 'Resubmission comments are required');
      }

      const resubmitMetadata = {
        origin: 'resubmit',
        requestId: null,
        moduleMetaVersion: 1,
        moduleMeta: {
          trigger: 'applicant_resubmit',
          beneficiaryType: normalizeText(record.beneficiary_type) || null,
          amountBand: Number(record.total_amount || 0) > 10000 ? 'gt_10k' : 'lte_10k',
          expenditureMeta: resolveUnplannedBudgetMeta(record),
        },
      };

      const restartResult = await workflowService.startWorkflow({
        moduleKey: 'expenditure',
        recordId: expenditureId,
        metadata: resubmitMetadata,
      });

      const resubmittedAt = new Date().toISOString();
      await expenditureModel.updateExpenditureWorkflowSnapshot(expenditureId, {
        ...(restartResult.state || {}),
        status: 'in_progress',
        currentStage: restartResult.state?.currentStage || 'level1',
        isEditableByApplicant: false,
        lastDecision: 'resubmitted',
        lastFeedback: null,
        resubmittedAt,
        updatedAt: resubmittedAt,
        resolvedAt: null,
      });
      await workflowService.logWorkflowResubmission({
        moduleKey: 'expenditure',
        recordId: expenditureId,
        stage: restartResult.state?.currentStage || workflowState.currentStage || 'level1',
        feedback: resubmissionComment,
        actor: resolveActor(req),
        snapshotBefore: workflowState,
        metadata: {
          ...resubmitMetadata,
          moduleMeta: {
            ...resubmitMetadata.moduleMeta,
            route: 'POST /api/expenditure/:id/resubmit',
          },
        },
      });

      return res.status(200).json({
        status: 'success',
        message: 'Expenditure request resubmitted successfully',
      });
    } catch (err) {
      return handleError(res, err, 'Error in resubmitExpenditureRequest');
    }
  },

  async getExpenditureWorkflowTimeline(req, res) {
    try {
      const expenditureId = toPositiveInt(req.params.id);
      if (!expenditureId) {
        return sendError(res, 400, 'Invalid expenditure request ID');
      }

      const record = await expenditureModel.getExpenditureById(expenditureId);
      if (!record) {
        return sendError(res, 404, 'Expenditure request not found');
      }

      if (!canAccessExpenditureRecord(req, record)) {
        return sendError(res, 403, 'Access denied');
      }

      const rawTimeline = await expenditureModel.getStatusUpdates(expenditureId);
      const timeline = filterEntriesForCurrentCycle(rawTimeline, record);
      const timelineCompatible = timeline.map((row) => ({
        id: row.id,
        moduleKey: 'expenditure',
        recordId: row.expenditure_id,
        stage: row.stage || row.role || null,
        decision: row.decision || row.status || null,
        feedback: row.feedback ?? row.comment ?? null,
        actorUserId: row.user_id || null,
        actorEmail: row.actor_email || null,
        actorRole: row.actor_role || null,
        decidedAt: row.decided_at || row.created_at || null,
        snapshotBefore: row.snapshot_before || null,
        meta: row.meta || null,
        summary: row.summary ?? row.comment ?? row.feedback ?? null,
        details: row.details ?? null,
        isAdmin: row.is_admin ?? null,
        role: row.role || null,
        status: row.status || null,
        comment: row.comment ?? row.feedback ?? null,
        createdAt: row.created_at || null,
        userName: row.user_name || row.actor_name || null,
      }));

      return res.status(200).json({
        success: true,
        data: timelineCompatible,
      });
    } catch (err) {
      return handleError(res, err, 'Error in getExpenditureWorkflowTimeline');
    }
  },

  async getStatusUpdates(req, res) {
    try {
      const expenditureId = toPositiveInt(req.params.id);
      if (!expenditureId) return sendError(res, 400, 'Invalid expenditure request ID');

      const record = await expenditureModel.getExpenditureById(expenditureId);
      if (!record) return sendError(res, 404, 'Expenditure request not found');
      if (!canAccessExpenditureRecord(req, record)) return sendError(res, 403, 'Access denied');

      const updates = await expenditureModel.getStatusUpdates(expenditureId);
      const cycleScopedUpdates = filterEntriesForCurrentCycle(updates, record);
      const timelineCompatible = cycleScopedUpdates.map((row) => ({
        id: row.id,
        moduleKey: 'expenditure',
        recordId: row.expenditure_id,
        stage: row.stage || row.role || null,
        decision: row.decision || row.status || null,
        feedback: row.feedback ?? row.comment ?? null,
        actorUserId: row.user_id || null,
        actorEmail: row.actor_email || null,
        actorRole: row.actor_role || null,
        decidedAt: row.decided_at || row.created_at || null,
        snapshotBefore: row.snapshot_before || null,
        meta: row.meta || null,
        summary: row.summary ?? row.comment ?? row.feedback ?? null,
        details: row.details ?? null,
        isAdmin: row.is_admin ?? null,
        role: row.role || null,
        status: row.status || null,
        comment: row.comment ?? row.feedback ?? null,
        createdAt: row.created_at || null,
        userName: row.user_name || row.actor_name || null,
      }));

      return res.status(200).json({
        success: true,
        data: timelineCompatible,
      });
    } catch (err) {
      return handleError(res, err, 'Error in getStatusUpdates');
    }
  },
};

export default expenditureController;
