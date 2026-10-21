import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as expenditureModel from './expenditureModel.js';
import './expenditureWorkflowAdapter.js';
import notificationService from '../notification/notificationService.js';
import { isFinanceRequestOwner } from '../shared/financeOwnership.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
import workflowService from '../shared/workflow/workflowService.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPENDITURE_TEMPLATE_DIR = path.resolve(__dirname, '../../templates/expenditure');

// Bulk transaction modes. NEFT/RTGS/UPI are uploaded on the bank's Excel template;
// DD is a physical instrument, so a document or image scan of it is accepted too.
const BULK_TRANSACTION_TYPES = ['NEFT', 'RTGS', 'UPI', 'DD'];
const DEFAULT_BULK_TRANSACTION_TYPE = 'NEFT';
const EXCEL_ONLY_BULK_TRANSACTION_TYPES = new Set(['NEFT', 'RTGS', 'UPI']);
const EXCEL_FILE_EXTENSIONS = new Set(['.xlsx', '.xls']);
// DD scans. Kept in sync with BULK_TRANSACTION_ALLOWED_EXTENSIONS in expenditureRoutes.js,
// which is the outer multer guard. Browser-renderable active formats (.html, .svg, .xml)
// are excluded on purpose: /uploads is served by express.static, so a stored one would be
// a same-origin XSS URL for whoever opens the request.
const DD_FILE_EXTENSIONS = new Set([
  ...EXCEL_FILE_EXTENSIONS,
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tif',
  '.tiff',
  '.doc',
  '.docx',
]);

// Each bank publishes its own Excel layout. The files themselves are dropped into
// server/templates/expenditure/ — until then the shared template below is served.
const BULK_TRANSACTION_BANKS = ['AXIS', 'DBS'];
const DEFAULT_BULK_TRANSACTION_BANK = 'AXIS';
const BULK_TRANSACTION_BANK_LABELS = { AXIS: 'Axis Bank', DBS: 'DBS' };
const BULK_TRANSACTION_BANK_TEMPLATE_FILES = {
  AXIS: ['bulk-transaction-axis-template.xlsx', 'bulk-transaction-axis-template.xls'],
  DBS: ['bulk-transaction-dbs-template.xlsx', 'bulk-transaction-dbs-template.xls'],
};
// FALLBACK: single shared template used before the per-bank Axis/DBS files exist.
// Remove the fallbacks once both bank templates are in place.
const FALLBACK_BULK_TRANSACTION_TEMPLATE_FILES = [
  'bulk-transaction-template.xls',
  'bulk-neft-template.xls',
  'sample-bulk-neft-template.xls',
];

const normalizeBulkTransactionType = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return BULK_TRANSACTION_TYPES.includes(normalized) ? normalized : null;
};

const normalizeBulkTransactionBank = (value) => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  return BULK_TRANSACTION_BANKS.includes(normalized) ? normalized : null;
};

const isExcelOnlyBulkTransactionType = (type) => EXCEL_ONLY_BULK_TRANSACTION_TYPES.has(type);

// Only the bank-routed transfers are filed on a bank's own layout. UPI payouts use a
// single sheet whatever the debit bank, so they carry no bank code. Mirrors
// BANK_TEMPLATE_BULK_TRANSACTION_TYPES in expenditureapproval.tsx.
const BANK_TEMPLATE_BULK_TRANSACTION_TYPES = new Set(['NEFT', 'RTGS']);
const bulkTransactionTypeNeedsBank = (type) => BANK_TEMPLATE_BULK_TRANSACTION_TYPES.has(type);

const normalizeText = (value) => String(value || '').trim();
const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'];
const BENEFICIARY_CATEGORY_OPTIONS = ['Student', 'Faculty', 'Staff'];
const INTERNAL_BENEFICIARY_ORGS = ['KSRCT', 'KSREI'];
/**
 * Mirrors the model's `resolveCanonicalBeneficiaryOrg`: a payload that names no
 * beneficiary can still carry one in `payee_name`, which is where the older
 * clients put it. Reading it the same way here keeps the check below from
 * waving through the very rows the model then files as internal.
 */
const resolveBeneficiaryOrg = (beneficiaryOrg, payeeName) => {
  const submitted = normalizeText(beneficiaryOrg);
  if (submitted) return submitted;

  const fromPayeeName = normalizeText(payeeName);
  return BENEFICIARY_ORG_OPTIONS.includes(fromPayeeName) ? fromPayeeName : '';
};
// A KSRCT / KSREI individual is someone inside the institution, and which
// population they belong to is part of identifying them — so the category is
// as mandatory as the beneficiary itself. External payees and organizations
// carry none; the model stores NULL for them either way.
const beneficiaryCategoryRequired = (beneficiaryType, beneficiaryOrg, payeeName) =>
  normalizeText(beneficiaryType).toLowerCase() !== 'organization' &&
  INTERNAL_BENEFICIARY_ORGS.includes(resolveBeneficiaryOrg(beneficiaryOrg, payeeName));

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

const normalizeUnplannedRowsForMeta = (source = {}) => {
  const rawRows = Array.isArray(source.unplanned_rows)
    ? source.unplanned_rows
    : Array.isArray(source.unplannedRows)
      ? source.unplannedRows
      : [];

  if (rawRows.length) {
    return rawRows
      .map((row) => ({
        head_of_account: normalizeText(row.head_of_account || row.headOfAccount) || null,
        head_of_account_budget_line_id: toPositiveInt(
          row.head_of_account_budget_line_id || row.headOfAccountBudgetLineId,
        ),
        head_of_account_budget_proposal_id: toPositiveInt(
          row.head_of_account_budget_proposal_id || row.headOfAccountBudgetProposalId,
        ),
        budget_head: normalizeText(row.budget_head || row.budgetHead) || null,
        sub_head: normalizeText(row.sub_head || row.subHead) || null,
        amount: toMoney(row.amount),
        description: normalizeText(row.description) || null,
      }))
      .filter(
        (row) =>
          row.head_of_account ||
          row.head_of_account_budget_line_id ||
          row.budget_head ||
          row.sub_head ||
          row.amount > 0,
      );
  }

  if (!parseBoolean(source.unplanned_budget_enabled)) return [];

  return [
    {
      head_of_account: normalizeText(source.unplanned_head_of_account) || null,
      head_of_account_budget_line_id: toPositiveInt(
        source.unplanned_head_of_account_budget_line_id,
      ),
      head_of_account_budget_proposal_id: toPositiveInt(
        source.unplanned_head_of_account_budget_proposal_id,
      ),
      budget_head: normalizeText(source.unplanned_budget_head) || null,
      sub_head: normalizeText(source.unplanned_budget_sub_head) || null,
      amount: toMoney(source.unplanned_budget_amount),
      description: normalizeText(source.unplanned_budget_description) || null,
    },
  ];
};

const resolveUnplannedBudgetMeta = (source = {}) => {
  const rows = normalizeUnplannedRowsForMeta(source);
  const enabled = parseBoolean(source.unplanned_budget_enabled) || rows.length > 0;
  const amount = enabled
    ? rows.reduce((sum, row) => sum + toMoney(row.amount), 0) ||
      toMoney(source.unplanned_budget_amount)
    : 0;
  const primary = rows[0] || {};
  return {
    unplannedBudgetEnabled: enabled,
    unplannedBudgetAmount: enabled ? amount : null,
    unplannedHeadOfAccount:
      primary.head_of_account || normalizeText(source.unplanned_head_of_account) || null,
    unplannedHeadOfAccountBudgetLineId:
      primary.head_of_account_budget_line_id ||
      toPositiveInt(source.unplanned_head_of_account_budget_line_id),
    unplannedHeadOfAccountBudgetProposalId:
      primary.head_of_account_budget_proposal_id ||
      toPositiveInt(source.unplanned_head_of_account_budget_proposal_id),
    unplannedBudgetHead: primary.budget_head || normalizeText(source.unplanned_budget_head) || null,
    unplannedBudgetSubHead:
      primary.sub_head || normalizeText(source.unplanned_budget_sub_head) || null,
    unplannedBudgetDescription:
      primary.description || normalizeText(source.unplanned_budget_description) || null,
    unplannedRows: rows,
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
    sumRowsByKeys(payload.settlement_rows || payload.settlementrows, [
      'settlement',
      'settlement_amount',
    ]) +
    sumRowsByKeys(payload.expenditure_rows || payload.expenditurerows, [
      'autoSum',
      'auto_sum_amount',
      'expenditure',
    ]);
  const unplanned = resolveUnplannedBudgetMeta(payload);
  return (
    plannedTotal + (unplanned.unplannedBudgetEnabled ? toMoney(unplanned.unplannedBudgetAmount) : 0)
  );
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

/**
 * Payee notifications are per submission round, not per save. `upsertPayee`
 * resets `requested_at` on every save and it is the only round marker the row
 * carries, so it is the dedupe scope: a Save clicked twice — or two saves of
 * the same bank details racing, which `upsertPayee` now resolves instead of
 * failing — collapses to one notification, while a genuine resubmission later
 * is news again and gets through.
 *
 * With no `requested_at` to hand, dedupe is left off rather than keyed on
 * `Date.now()`: a key that can never match is not deduplication, it just fills
 * the unique index with single-use values and reads like an idempotency
 * guarantee that is not there. Same choice, and the same reason, as
 * `budgetNotifications`.
 */
const payeeRoundKey = (payeeId, suffix, requestedAt) => {
  const id = toPositiveInt(payeeId);
  const round = requestedAt ? new Date(requestedAt).getTime() : Number.NaN;
  // Seconds, not milliseconds: MySQL stores the timestamp to the second, but a
  // driver configured for date strings can still hand back a value that parses
  // with millisecond noise.
  return id && Number.isFinite(round) ? `payee:${id}:${suffix}:${Math.floor(round / 1000)}` : null;
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
  return [...roles, role].map((entry) => normalizeText(entry).toLowerCase()).filter(Boolean);
};

const getNormalizedUserPermissions = (req) => {
  const permissions = Array.isArray(req.user?.permissions)
    ? req.user.permissions
    : normalizeText(req.user?.permissions)
      ? [normalizeText(req.user?.permissions)]
      : [];
  return permissions.map((entry) => normalizeText(entry).toLowerCase()).filter(Boolean);
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
    isSuperAdmin:
      Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || roles.includes('super_admin'),
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
  billFiles: Array.isArray(req.files?.bill_files) ? req.files.bill_files : [],
  bulkTransactionFile: Array.isArray(req.files?.bulk_transaction_file)
    ? req.files.bulk_transaction_file[0]
    : // LEGACY: pre-rename field name. Remove with the route's bulk_neft_file entry.
      Array.isArray(req.files?.bulk_neft_file)
      ? req.files.bulk_neft_file[0]
      : null,
  paymentProofFiles: Array.isArray(req.files?.payment_proof_files)
    ? req.files.payment_proof_files
    : [],
});

// `file.path` is derived from the client-supplied `originalname`, so the delete is routed
// through deleteUploadedFile, which refuses any path resolving outside `uploads/`.
const discardUploadedFile = (file) => {
  if (!file?.path) return;
  deleteUploadedFile(file.path);
};

// Multer has already written every part of the multipart request to disk by the time a
// handler can reject it, so all of them have to go — not just the offending one.
const discardExpenditureUploads = (uploads = {}) => {
  [
    uploads.bulkTransactionFile,
    ...(Array.isArray(uploads.billFiles) ? uploads.billFiles : []),
    ...(Array.isArray(uploads.paymentProofFiles) ? uploads.paymentProofFiles : []),
  ].forEach(discardUploadedFile);
};

/**
 * NEFT/RTGS/UPI files must be the bank's Excel template; DD also accepts a document or
 * image scan. Returns an error message when the upload does not match the selected mode.
 */
const validateBulkTransactionUpload = (file, transactionType) => {
  if (!file) return null;

  const extension = path.extname(file.originalname || '').toLowerCase();

  if (isExcelOnlyBulkTransactionType(transactionType)) {
    if (EXCEL_FILE_EXTENSIONS.has(extension)) return null;
    return `${transactionType} bulk transaction upload only accepts Excel files (.xlsx or .xls)`;
  }

  if (DD_FILE_EXTENSIONS.has(extension)) return null;
  return `DD bulk transaction upload accepts only ${[...DD_FILE_EXTENSIONS].join(', ')} files`;
};

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
  if (
    normalized.unplannedbudgetenabled !== undefined &&
    normalized.unplanned_budget_enabled === undefined
  ) {
    normalized.unplanned_budget_enabled = normalized.unplannedbudgetenabled;
  }
  if (
    normalized.unplannedbudgetamount !== undefined &&
    normalized.unplanned_budget_amount === undefined
  ) {
    normalized.unplanned_budget_amount = normalized.unplannedbudgetamount;
  }
  if (
    normalized.unplannedheadofaccount !== undefined &&
    normalized.unplanned_head_of_account === undefined
  ) {
    normalized.unplanned_head_of_account = normalized.unplannedheadofaccount;
  }
  if (
    normalized.unplannedheadofaccountbudgetlineid !== undefined &&
    normalized.unplanned_head_of_account_budget_line_id === undefined
  ) {
    normalized.unplanned_head_of_account_budget_line_id =
      normalized.unplannedheadofaccountbudgetlineid;
  }
  if (
    normalized.unplannedheadofaccountbudgetproposalid !== undefined &&
    normalized.unplanned_head_of_account_budget_proposal_id === undefined
  ) {
    normalized.unplanned_head_of_account_budget_proposal_id =
      normalized.unplannedheadofaccountbudgetproposalid;
  }
  if (
    normalized.unplannedbudgethead !== undefined &&
    normalized.unplanned_budget_head === undefined
  ) {
    normalized.unplanned_budget_head = normalized.unplannedbudgethead;
  }
  if (
    normalized.unplannedbudgetsubhead !== undefined &&
    normalized.unplanned_budget_sub_head === undefined
  ) {
    normalized.unplanned_budget_sub_head = normalized.unplannedbudgetsubhead;
  }
  if (
    normalized.unplannedbudgetdescription !== undefined &&
    normalized.unplanned_budget_description === undefined
  ) {
    normalized.unplanned_budget_description = normalized.unplannedbudgetdescription;
  }
  if (normalized.unplannedrows !== undefined && normalized.unplanned_rows === undefined) {
    normalized.unplanned_rows = normalized.unplannedrows;
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
  if (
    normalized.showbulktransaction !== undefined &&
    normalized.show_bulk_transaction === undefined
  ) {
    normalized.show_bulk_transaction = normalized.showbulktransaction;
  }
  if (normalized.bulktransactiontemplateversion && !normalized.bulk_transaction_template_version) {
    normalized.bulk_transaction_template_version = normalized.bulktransactiontemplateversion;
  }
  if (normalized.bulktransactiontype && !normalized.bulk_transaction_type) {
    normalized.bulk_transaction_type = normalized.bulktransactiontype;
  }
  if (normalized.bulktransactionbank && !normalized.bulk_transaction_bank) {
    normalized.bulk_transaction_bank = normalized.bulktransactionbank;
  }
  // Tri-state: absent means "this client does not manage the bulk transaction section",
  // which must not be read as "the stored file was deleted".
  if (
    normalized.bulktransactionfileretained !== undefined &&
    normalized.bulk_transaction_file_retained === undefined
  ) {
    normalized.bulk_transaction_file_retained = normalized.bulktransactionfileretained;
  }
  normalized.bulk_transaction_file_retained =
    normalized.bulk_transaction_file_retained === undefined
      ? undefined
      : parseBoolean(normalized.bulk_transaction_file_retained);
  // LEGACY: pre-"Bulk Transaction" payload keys. Remove once no deployed client sends them.
  if (normalized.showbulkneft !== undefined && normalized.show_bulk_transaction === undefined) {
    normalized.show_bulk_transaction = normalized.showbulkneft;
  }
  if (normalized.show_bulk_neft !== undefined && normalized.show_bulk_transaction === undefined) {
    normalized.show_bulk_transaction = normalized.show_bulk_neft;
  }
  if (normalized.bulknefttemplateversion && !normalized.bulk_transaction_template_version) {
    normalized.bulk_transaction_template_version = normalized.bulknefttemplateversion;
  }
  if (normalized.bulk_neft_template_version && !normalized.bulk_transaction_template_version) {
    normalized.bulk_transaction_template_version = normalized.bulk_neft_template_version;
  }

  normalized.bulk_transaction_type =
    normalizeBulkTransactionType(normalized.bulk_transaction_type) || DEFAULT_BULK_TRANSACTION_TYPE;
  normalized.bulk_transaction_bank = bulkTransactionTypeNeedsBank(normalized.bulk_transaction_type)
    ? normalizeBulkTransactionBank(normalized.bulk_transaction_bank) ||
      DEFAULT_BULK_TRANSACTION_BANK
    : null;

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
    'Please select a valid',
    'must be greater than',
    'is not linked',
    'are equal, so there is no amount',
    'must be Savings or Current',
    'are required',
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

/**
 * Locates the template to serve for a bank. `isBankSpecific` is false when the shared
 * fallback template was served instead of that bank's own layout — the caller must not
 * then name the download after the bank, or users fill in the wrong layout.
 */
const resolveBulkTransactionTemplate = (bank) => {
  for (const candidate of BULK_TRANSACTION_BANK_TEMPLATE_FILES[bank] || []) {
    const candidatePath = path.join(EXPENDITURE_TEMPLATE_DIR, candidate);
    if (fs.existsSync(candidatePath)) return { templatePath: candidatePath, isBankSpecific: true };
  }

  for (const candidate of FALLBACK_BULK_TRANSACTION_TEMPLATE_FILES) {
    const candidatePath = path.join(EXPENDITURE_TEMPLATE_DIR, candidate);
    if (fs.existsSync(candidatePath)) return { templatePath: candidatePath, isBankSpecific: false };
  }

  return { templatePath: null, isBankSpecific: false };
};

const isSuperAdminRequest = (req) =>
  Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) ||
  getNormalizedUserRoles(req).includes('super_admin');

const hasAnyExpenditureWorkflowPermission = (req) => {
  const permissions = getNormalizedUserPermissions(req);
  return permissions.some(
    (permission) =>
      permission.startsWith('expenditure.workflow.') || permission.startsWith('finance.workflow.'),
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
    ['hod', 'coordinator', 'entity_approver', 'dof', 'principal'].includes(role),
  );
};

const resolveExpenditureLevel1QueueRole = (req) => {
  const normalizedRoles = getNormalizedUserRoles(req);

  const hasCoordinatorRole =
    normalizedRoles.includes('coordinator') || normalizedRoles.includes('entity_approver');
  const hasHodRole = normalizedRoles.includes('hod');

  if (hasCoordinatorRole && !hasHodRole) return 'coordinator';
  if (hasHodRole && !hasCoordinatorRole) return 'hod';
  return null;
};

const canAccessExpenditureRecord = (req, record) => {
  const userId = toPositiveInt(req.user?.id);
  if (!record) return false;
  if (isSuperAdminRequest(req)) return true;
  // Creator OR the applicant it was raised for — the dashboard and list show a claim to both,
  // so both have to be able to open it. See shared/financeOwnership.js.
  if (isFinanceRequestOwner(record, userId)) return true;
  if (hasAnyExpenditureWorkflowPermission(req)) return true;
  return canAccessExpenditureByRole(req);
};

const expenditureController = {
  async downloadBulkTransactionTemplate(req, res) {
    try {
      const bank = normalizeBulkTransactionBank(req.query?.bank) || DEFAULT_BULK_TRANSACTION_BANK;
      const { templatePath, isBankSpecific } = resolveBulkTransactionTemplate(bank);
      if (!templatePath) {
        return sendError(
          res,
          404,
          `${BULK_TRANSACTION_BANK_LABELS[bank]} bulk transaction template not found`,
        );
      }

      // FALLBACK: the shared template is not the bank's layout, so it is not named after
      // the bank. Remove this branch once both Axis and DBS templates are in place.
      const downloadName = isBankSpecific
        ? `bulk-transaction-${bank.toLowerCase()}-template${path.extname(templatePath)}`
        : `bulk-transaction-template${path.extname(templatePath)}`;
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      return res.download(templatePath, downloadName);
    } catch (err) {
      return handleError(res, err, 'Error downloading bulk transaction template');
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
      const fiscalYear = toPositiveInt(req.query.fiscal_year || req.query.fiscalYear);
      const excludeExpenditureId = toPositiveInt(req.query.expenditure_request_id);
      if (!financeRequestId) return sendError(res, 400, 'finance_request_id is required');

      let budgets = await expenditureModel.getApprovedBudgets({
        userId,
        userEmail,
        financeRequestId,
        fiscalYear,
        // The expenditure form is opened from an approved finance request.
        // Budget-line visibility must follow that approved finance request, not
        // only the original finance creator, otherwise Head of Accounts is empty
        // for valid applicant/admin flows.
        allowAnyApprovedFinance: true,
        // When editing an existing expenditure request, exclude its own already-saved
        // usage from "used" so the remaining balance isn't computed against itself.
        excludeExpenditureId,
      });

      const head = normalizeText(req.query.head).toLowerCase();
      const subHead = normalizeText(req.query.sub_head).toLowerCase();
      if (head) budgets = budgets.filter((budget) => budget.head.toLowerCase().includes(head));
      if (subHead)
        budgets = budgets.filter((budget) => budget.subHead.toLowerCase().includes(subHead));

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

      // The applicant the form is being filled for, so the running total covers claims a shared
      // department login raised for them too. It arrives from the query string, so honour it
      // only for a caller entitled to that applicant's figures — an unrelated employee_id would
      // otherwise report someone else's advances. A finance request pins the card on its own,
      // making the applicant filter redundant, so skip the lookup on that path.
      const requestedEmployeeId = toPositiveInt(req.query.employee_id);
      const canScopeToApplicant =
        Boolean(requestedEmployeeId) &&
        !financeRequestId &&
        (isSuperAdminRequest(req) ||
          hasAnyExpenditureWorkflowPermission(req) ||
          (await expenditureModel.canReadApplicantAdvanceTotals({
            userId,
            employeeId: requestedEmployeeId,
          })));
      const employeeId = canScopeToApplicant ? requestedEmployeeId : null;

      const summary = await expenditureModel.getAdvanceSummary({
        userId,
        employeeId,
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

      // When editing a saved request, its own unplanned claim must not count against it.
      const context = await expenditureModel.getFinanceRequestContext(financeId, {
        excludeExpenditureId: toPositiveInt(req.query.expenditure_request_id),
      });
      if (!context) return sendError(res, 404, 'Finance request not found');

      const isOwner = isFinanceRequestOwner(context, userId);
      if (
        !isSuperAdmin &&
        !isOwner &&
        !hasAnyExpenditureWorkflowPermission(req) &&
        !canAccessExpenditureByRole(req)
      ) {
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

  async listPayeeDirectory(req, res) {
    try {
      const {
        search = '',
        status = 'all',
        beneficiary_type: beneficiaryType = 'all',
        limit = 20,
        offset = 0,
      } = req.query;

      const result = await expenditureModel.listPayeeDirectory({
        search,
        status,
        beneficiaryType,
        limit,
        offset,
      });

      return res.json({
        status: 'success',
        success: true,
        data: result.rows,
        meta: {
          total: result.total,
          counts: result.counts,
          pending_total: result.pendingTotal,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error listing payee directory');
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
      // `updatePayeeById` reports a bad payload by throwing, in two shapes: a
      // missing field ("... is required") and a field outside its vocabulary
      // ("account_type must be Savings or Current", "beneficiary_category must
      // be Student, Faculty or Staff"). Both are the caller's mistake, so both
      // answer 400 — without the second pattern a category the form left blank
      // came back as a 500 the user could not act on.
      const message = normalizeText(err.message);
      if (
        message.includes('required') ||
        message.includes('Invalid') ||
        message.includes('must be')
      ) {
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

      // Read after the update so the notification carries the payee's name;
      // `created_by` is who submitted the details and so who has to fix them.
      const payee = await expenditureModel.getPayeeById(id);

      await notificationService.emit({
        type: decision === 'approved' ? 'payee.approved' : 'payee.rejected',
        actorUserId: toPositiveInt(req.user?.id),
        subject: {
          moduleKey: 'expenditure',
          recordId: id,
          name: payee?.payee_name || payee?.account_name || null,
        },
        audience: payee?.created_by
          ? [{ kind: 'user', userId: payee.created_by, recipientRole: 'applicant' }]
          : [],
        data: { feedback: rejectionReason || null },
        // One decision per submission round; a double-clicked Approve is the
        // same decision, not a second one.
        dedupeKey: payeeRoundKey(id, decision, payee?.requested_at),
      });

      return res.json({
        status: 'success',
        message: `Payee ${decision} successfully`,
      });
    } catch (err) {
      const message = normalizeText(err.message);
      if (
        message.includes('required') ||
        message.includes('Invalid') ||
        message.includes('Unsupported')
      ) {
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
      const {
        payee_name,
        account_name,
        account_no,
        ifsc,
        bank_name,
        branch_name,
        beneficiary_type,
        beneficiary_org,
        beneficiary_category,
      } = req.body || {};
      const canonicalPayeeName = resolveCanonicalPayeeName(payee_name, account_name);

      if (!canonicalPayeeName || !account_no || !ifsc || !bank_name || !branch_name) {
        return sendError(
          res,
          400,
          'accountant name, account_no, ifsc, bank_name and branch_name are required',
        );
      }

      if (
        beneficiaryCategoryRequired(beneficiary_type, beneficiary_org, payee_name) &&
        !BENEFICIARY_CATEGORY_OPTIONS.includes(normalizeText(beneficiary_category))
      ) {
        return sendError(res, 400, 'category must be Student, Faculty or Staff');
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

      // upsertPayee forces approval_status back to 'pending' on both the
      // insert and the update path, so every save here needs vetting.
      //
      // Addressed to the DoF rather than to everyone the route lets through
      // (admin/hod/coordinator/dof/principal/entity_approver): the payee
      // directory is a DoF-curated list, and notifying six roles for every
      // bank-detail edit would be noise nobody reads.
      await notificationService.emit({
        type: 'payee.submitted',
        actorUserId: userId,
        subject: { moduleKey: 'expenditure', recordId: payeeId, name: canonicalPayeeName },
        audience: [
          { kind: 'role', roleCodes: ['dof'], recipientRole: 'approver' },
          {
            kind: 'permission',
            permissions: ['expenditure.workflow.dof'],
            recipientRole: 'approver',
          },
        ],
        data: { applicantName: req.user?.name || null },
        // Details can be corrected and resubmitted, and each round needs a
        // fresh look.
        dedupeKey: payeeRoundKey(payeeId, 'submitted', payee?.requested_at),
      });

      return res.status(201).json({
        status: 'success',
        message: 'Payee saved successfully',
        data: payee,
      });
    } catch (err) {
      const message = normalizeText(err.message);
      if (message.includes('required') || message.includes('must be')) {
        return sendError(res, 400, message);
      }
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
        if (
          !paymentDetails.account_no ||
          !paymentDetails.ifsc ||
          !paymentDetails.bank_name ||
          !paymentDetails.beneficiary_org ||
          !paymentDetails.account_type
        ) {
          return sendError(
            res,
            400,
            'payment_details must include account_no, ifsc, bank_name, beneficiary_org and account_type',
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

      const bulkTransactionUploadError = validateBulkTransactionUpload(
        uploads.bulkTransactionFile,
        payload.bulk_transaction_type,
      );
      if (bulkTransactionUploadError) {
        discardExpenditureUploads(uploads);
        return sendError(res, 400, bulkTransactionUploadError);
      }

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
          console.error(
            'Failed to fully clean up expenditure request after workflow failure',
            cleanupError,
          );
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
      const { mine, status, budget_line_id, request_type, finance_request_id, page, limit } =
        req.query;
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

      return res.json({
        status: 'success',
        data: { ...record, ...details, status_updates: statusUpdates },
      });
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

      const isOwner = isFinanceRequestOwner(record, userId);
      const isWorkflowEditor = hasAnyExpenditureWorkflowPermission(req) || isSuperAdminRequest(req);
      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(
        workflowState?.status || record.workflow_status || record.overall_status,
      ).toLowerCase();
      const currentStage = normalizeText(
        workflowState?.currentStage || record.workflow_stage,
      ).toLowerCase();
      const isTerminalWorkflow = ['approved', 'rejected', 'archived', 'completed'].includes(
        workflowStatus,
      );
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
        req.files?.bulk_transaction_file ||
        // LEGACY: pre-rename field name. Remove with the route's bulk_neft_file entry.
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
        req.body?.payeerows,
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

        const bulkTransactionUploadError = validateBulkTransactionUpload(
          uploads.bulkTransactionFile,
          payload.bulk_transaction_type,
        );
        if (bulkTransactionUploadError) {
          discardExpenditureUploads(uploads);
          return sendError(res, 400, bulkTransactionUploadError);
        }

        const result = await expenditureModel.updateExpenditureRequest(
          id,
          payload,
          userId,
          uploads,
          {
            actor: resolveActor(req),
            isSuperAdmin: isSuperAdminRequest(req),
            isWorkflowEditor,
          },
        );

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

      if (!isSuperAdmin && !isFinanceRequestOwner(record, userId)) {
        return sendError(res, 403, 'Only applicant can delete this request');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      const workflowStatus = normalizeText(
        workflowState?.status || record.workflow_status || record.overall_status,
      ).toLowerCase();
      const currentStage = normalizeText(
        workflowState?.currentStage || record.workflow_stage,
      ).toLowerCase();
      const hasStartedApproval =
        Boolean(workflowState) && currentStage && currentStage !== 'level1';

      if (
        !isSuperAdmin &&
        workflowStatus &&
        ['approved', 'rejected', 'archived', 'completed', 'returned'].includes(workflowStatus)
      ) {
        return sendError(res, 409, 'This request can no longer be deleted');
      }

      if (!isSuperAdmin && hasStartedApproval) {
        return sendError(res, 409, 'This request can only be deleted before Level-1 approval');
      }

      await expenditureModel.deleteExpenditure(id, { isSuperAdmin });

      // Only meaningful when a super admin deletes someone else's request: an
      // applicant deleting their own is the actor and is excluded.
      const ownerUserId = toPositiveInt(record.created_by);
      await notificationService.emit({
        type: 'expenditure.deleted',
        actorUserId: userId,
        subject: { moduleKey: 'expenditure', recordId: id, applicantUserId: ownerUserId },
        audience: ownerUserId
          ? [{ kind: 'user', userId: ownerUserId, recipientRole: 'applicant' }]
          : [],
        dedupeKey: `expenditure:${id}:deleted`,
      });

      return res.json({ status: 'success', message: 'Expenditure request deleted' });
    } catch (err) {
      if (normalizeText(err.message).toLowerCase().includes('only pending'))
        return sendError(res, 409, err.message);
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
      const {
        page,
        limit,
        workflowStatus,
        statusCategory,
        level1Role,
        q,
        allProposals,
        fiscalYear,
      } = req.query;
      const normalizedLevel1Role = normalizeText(level1Role).toLowerCase();
      const effectiveLevel1Role =
        stage === 'level1'
          ? ['hod', 'coordinator'].includes(normalizedLevel1Role)
            ? normalizedLevel1Role
            : resolveExpenditureLevel1QueueRole(req)
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

  /**
   * Same queue, unpaginated, with every request's advance/expenditure/settlement rows —
   * backs the admin "Export CSV" action so the file covers the whole filtered set.
   */
  async getExpenditureQueueExport(req, res) {
    try {
      const stage = normalizeText(req.params.stage).toLowerCase();
      const {
        workflowStatus,
        statusCategory,
        level1Role,
        q,
        allProposals,
        fiscalYear,
        dateFrom,
        dateTo,
      } = req.query;
      const normalizedLevel1Role = normalizeText(level1Role).toLowerCase();
      const effectiveLevel1Role =
        stage === 'level1'
          ? ['hod', 'coordinator'].includes(normalizedLevel1Role)
            ? normalizedLevel1Role
            : resolveExpenditureLevel1QueueRole(req)
          : null;

      const queue = await workflowService.listQueueForExport({
        moduleKey: 'expenditure',
        stage,
        actor: resolveActor(req),
        filters: {
          workflowStatus,
          statusCategory,
          // An explicit date range replaces the fiscal-year scoping so the export can
          // span years; the client blanks fiscalYear when it sends a range.
          fiscalYear,
          dateFrom,
          dateTo,
          level1Role: effectiveLevel1Role,
          q,
          allProposals: String(allProposals || '').toLowerCase() === 'true' || allProposals === '1',
        },
      });

      return res.status(200).json({
        // `status` keeps this in line with the rest of the expenditure module; `success`
        // satisfies the project-wide response contract.
        success: true,
        status: 'success',
        data: queue.items,
        lineItems: queue.lineItems,
        pagination: {
          total: queue.total,
          exported: queue.items.length,
          truncated: queue.truncated,
          maxRows: queue.maxRows,
          statusCounts: queue.statusCounts,
        },
      });
    } catch (err) {
      return handleError(res, err, 'Error in getExpenditureQueueExport');
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
        workflowState?.status || record.workflow_status || record.overall_status,
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
            { actor },
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
        workflowState?.status || record.workflow_status || record.overall_status,
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
              : 'You are not allowed to unarchive this request',
          );
        }

        const restoreResult =
          await expenditureModel.restoreWorkflowSnapshotFromLatestArchive(expenditureId);
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

      if (!isFinanceRequestOwner(record, userId)) {
        return sendError(res, 403, 'Only applicant can resubmit this request');
      }

      const workflowState = parseWorkflowState(record.workflow_state) || null;
      if (!workflowState || normalizeText(workflowState.status).toLowerCase() !== 'returned') {
        return sendError(res, 409, 'Only returned requests can be resubmitted');
      }

      const resubmissionComment = normalizeText(
        req.body?.feedback || req.body?.comment || req.body?.remarks,
      );
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
