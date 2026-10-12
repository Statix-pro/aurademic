/**
 * expenditureModel.js
 *
 * Data-access layer for Expenditure (Advance) requests.
 * Follows the same MySQL / mysql2 pool patterns as budgetModel.js and financeModel.js.
 * All writes that touch more than one table run inside a transaction.
 */

import db from '../../config/connection.js';
import {
  resolveCatalogIds,
  resolvePrimaryHeadIds,
} from '../budgetCatalog/budgetCatalogResolver.js';
import {
  normalizeBeneficiaryType,
  beneficiaryTypeToEntityTypeCode,
} from '../shared/budget/budgetUtils.js';
import { searchApplicant as searchEmployeeApplicants } from '../shared/budget/userResolvers.js';
import { buildDateRangeCondition } from '../shared/dateRangeFilter.js';
import { buildSettledAdvanceExpr, resolveAdvanceUsageAmount } from '../shared/expenditureClaims.js';
import {
  buildClaimedExpenditureStatusCondition,
  buildExpenditureDisplayRefExpr,
  buildExpenditureFiscalYearCondition,
  collateBudgetText,
} from '../shared/expenditureFilters.js';
import {
  buildFinanceOwnerCondition,
  buildFinanceOwnerParams,
  isFinanceRequestOwner,
} from '../shared/financeOwnership.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

const normalizeText = (v) => String(v || '').trim();
const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'];
const BENEFICIARY_CATEGORY_OPTIONS = ['Student', 'Faculty', 'Staff'];
const ACCOUNT_TYPE_OPTIONS = ['Savings', 'Current'];
const EXPENDITURE_REQUEST_COLUMN_EXISTS_CACHE = new Map();

const isBeneficiaryOrgValue = (value) => BENEFICIARY_ORG_OPTIONS.includes(normalizeText(value));
const normalizeAccountType = (value) =>
  ACCOUNT_TYPE_OPTIONS.find(
    (option) => option.toLowerCase() === normalizeText(value).toLowerCase(),
  ) || null;
const normalizeBeneficiaryCategory = (value) =>
  BENEFICIARY_CATEGORY_OPTIONS.find(
    (option) => option.toLowerCase() === normalizeText(value).toLowerCase(),
  ) || '';
/**
 * Only an individual from inside the institution has a Student / Faculty /
 * Staff category: an External payee is outside it and an organization is an
 * entity rather than a person, so both are stored with no category at all.
 */
const beneficiaryCategoryApplies = (beneficiaryType, beneficiaryOrg) =>
  beneficiaryType !== 'organization' && (beneficiaryOrg === 'KSRCT' || beneficiaryOrg === 'KSREI');
const sanitizeAlphaNumericUpper = (value, maxLength) =>
  normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);
const extractPanFromGstin = (value) => {
  const gstin = sanitizeAlphaNumericUpper(value, 15);
  return gstin.length >= 12 ? gstin.slice(2, 12) : '';
};

const hasExpenditureRequestColumn = async (columnName, { tx = db } = {}) => {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;
  if (EXPENDITURE_REQUEST_COLUMN_EXISTS_CACHE.has(normalizedColumn)) {
    return EXPENDITURE_REQUEST_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true;
  }

  const [rows] = await tx.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'expenditure_requests'
        AND COLUMN_NAME = ?`,
    [normalizedColumn],
  );
  const exists = Number(rows?.[0]?.count || 0) > 0;
  EXPENDITURE_REQUEST_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const FINANCE_REQUEST_COLUMN_EXISTS_CACHE = new Map();

const hasFinanceRequestColumn = async (columnName, { tx = db } = {}) => {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;
  if (FINANCE_REQUEST_COLUMN_EXISTS_CACHE.has(normalizedColumn)) {
    return FINANCE_REQUEST_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true;
  }

  const [rows] = await tx.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_requests'
        AND COLUMN_NAME = ?`,
    [normalizedColumn],
  );
  const exists = Number(rows?.[0]?.count || 0) > 0;
  FINANCE_REQUEST_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const BULK_TRANSACTION_FILE_COLUMN_EXISTS_CACHE = new Map();

// transaction_type / bank_code are added by the 20260810 migration; guard reads and
// writes so a not-yet-migrated database keeps working.
const hasBulkTransactionFileColumn = async (columnName, { tx = db } = {}) => {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;
  if (BULK_TRANSACTION_FILE_COLUMN_EXISTS_CACHE.has(normalizedColumn)) {
    return BULK_TRANSACTION_FILE_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true;
  }

  const [rows] = await tx.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'expenditure_bulk_neft_files'
        AND COLUMN_NAME = ?`,
    [normalizedColumn],
  );
  const exists = Number(rows?.[0]?.count || 0) > 0;
  BULK_TRANSACTION_FILE_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const resolveCanonicalPayeeName = (payeeName, accountName) => {
  const normalizedPayeeName = normalizeText(payeeName);
  const normalizedAccountName = normalizeText(accountName);

  if (normalizedPayeeName && !isBeneficiaryOrgValue(normalizedPayeeName)) {
    return normalizedPayeeName;
  }

  return normalizedAccountName || normalizedPayeeName;
};

const resolveCanonicalBeneficiaryOrg = (beneficiaryOrg, legacyPayeeName) => {
  const normalizedBeneficiaryOrg = normalizeText(beneficiaryOrg);
  if (normalizedBeneficiaryOrg) {
    return normalizedBeneficiaryOrg;
  }

  const normalizedLegacyPayeeName = normalizeText(legacyPayeeName);
  return isBeneficiaryOrgValue(normalizedLegacyPayeeName) ? normalizedLegacyPayeeName : '';
};

const normalizePayeeRecord = (row) => {
  if (!row) return row;

  const canonicalPayeeName = resolveCanonicalPayeeName(row.payee_name, row.account_name);

  return {
    ...row,
    payee_name: canonicalPayeeName,
    account_name: canonicalPayeeName || null,
    beneficiary_org: resolveCanonicalBeneficiaryOrg(row.beneficiary_org, row.payee_name) || null,
    approval_status:
      normalizeText(row.approval_status) || (row.approved_at ? 'approved' : 'pending'),
    requested_at: row.requested_at || row.created_at || null,
  };
};

const toPositiveInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const toMoney = (v) => {
  const n = Number(String(v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

const normalizeUnplannedBudgetRows = (payload = {}) => {
  const rawRows = Array.isArray(payload?.unplanned_rows)
    ? payload.unplanned_rows
    : Array.isArray(payload?.unplannedRows)
      ? payload.unplannedRows
      : [];

  if (rawRows.length) {
    return rawRows
      .map((row) => {
        const headOfAccount = normalizeText(row?.head_of_account || row?.headOfAccount);
        const headOfAccountBudgetLineId = toPositiveInt(
          row?.head_of_account_budget_line_id || row?.headOfAccountBudgetLineId,
        );
        const headOfAccountBudgetProposalId = toPositiveInt(
          row?.head_of_account_budget_proposal_id || row?.headOfAccountBudgetProposalId,
        );
        const head = normalizeText(row?.budget_head || row?.budgetHead);
        const subHead = normalizeText(row?.sub_head || row?.subHead);
        const amount = toMoney(row?.amount);
        const description =
          normalizeText(row?.description) || [head, subHead].filter(Boolean).join(' - ');

        return {
          headOfAccount,
          headOfAccountBudgetLineId,
          headOfAccountBudgetProposalId,
          head,
          subHead,
          amount,
          description,
        };
      })
      .filter(
        (row) =>
          row.headOfAccount ||
          row.headOfAccountBudgetLineId ||
          row.head ||
          row.subHead ||
          row.amount > 0,
      );
  }

  const enabled = parseBoolean(payload?.unplanned_budget_enabled);
  if (!enabled) return [];

  return [
    {
      headOfAccount: normalizeText(payload?.unplanned_head_of_account),
      headOfAccountBudgetLineId: toPositiveInt(payload?.unplanned_head_of_account_budget_line_id),
      headOfAccountBudgetProposalId: toPositiveInt(
        payload?.unplanned_head_of_account_budget_proposal_id,
      ),
      head: normalizeText(payload?.unplanned_budget_head),
      subHead: normalizeText(payload?.unplanned_budget_sub_head),
      amount: toMoney(payload?.unplanned_budget_amount),
      description:
        normalizeText(payload?.unplanned_budget_description) ||
        [
          normalizeText(payload?.unplanned_budget_head),
          normalizeText(payload?.unplanned_budget_sub_head),
        ]
          .filter(Boolean)
          .join(' - '),
    },
  ];
};

const normalizeUnplannedBudgetPayload = (payload = {}) => {
  const rows = normalizeUnplannedBudgetRows(payload);
  const enabled = parseBoolean(payload?.unplanned_budget_enabled) || rows.length > 0;

  if (!enabled) {
    return {
      enabled: false,
      amount: 0,
      rows: [],
      headOfAccount: '',
      headOfAccountBudgetLineId: null,
      headOfAccountBudgetProposalId: null,
      head: '',
      subHead: '',
      description: '',
    };
  }

  if (!rows.length) {
    throw new Error('Please add at least one Unplanned Expenditure row.');
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    if (row.amount <= 0) {
      throw new Error(`Please enter a valid amount for Unplanned Expenditure row ${rowNumber}.`);
    }
    if (!row.headOfAccount || !row.headOfAccountBudgetLineId) {
      throw new Error(`Please select Head of Accounts for Unplanned Expenditure row ${rowNumber}.`);
    }
    if (!row.head || !row.subHead) {
      throw new Error(
        `Please select budget head and sub head for Unplanned Expenditure row ${rowNumber}.`,
      );
    }
  });

  const primary = rows[0];
  const amount = toMoney(rows.reduce((sum, row) => sum + row.amount, 0));

  return {
    enabled: true,
    amount,
    rows,
    headOfAccount: primary.headOfAccount,
    headOfAccountBudgetLineId: primary.headOfAccountBudgetLineId,
    headOfAccountBudgetProposalId: primary.headOfAccountBudgetProposalId,
    head: primary.head,
    subHead: primary.subHead,
    description: primary.description,
  };
};

const normalizeFinanceRequestRefBase = (
  requestRef,
  { financeRequestId = null, requestDate = null } = {},
) => {
  const normalizedRef = normalizeText(requestRef);
  const structuredMatch = normalizedRef.match(/^#?F[-_](\d{4})[-_](\d+)$/i);
  if (structuredMatch) {
    return `#F-${structuredMatch[1]}-${structuredMatch[2].padStart(4, '0')}`;
  }

  const parsedDate = requestDate ? new Date(requestDate) : null;
  const fallbackYear =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? String(parsedDate.getFullYear())
      : String(new Date().getFullYear());

  return `#F-${fallbackYear}-${String(toPositiveInt(financeRequestId) || 0).padStart(4, '0')}`;
};

async function resolveExpenditureWorkflowContext(conn, expenditureData = {}) {
  const beneficiaryType = normalizeBeneficiaryType(expenditureData.beneficiary_type);
  const entityTypeCode = beneficiaryTypeToEntityTypeCode(beneficiaryType);

  let departmentId = toPositiveInt(expenditureData.department_id);
  let beneficiaryEntityId = toPositiveInt(expenditureData.beneficiary_entity_id);
  const employeeId = toPositiveInt(expenditureData.employee_id);
  const beneficiaryValue = normalizeText(expenditureData.beneficiary_value);

  // If beneficiary_type is 'Department', resolve departmentId from beneficiaryValue first
  if (beneficiaryType === 'Department' && beneficiaryValue) {
    const [departmentRows] = await conn.execute(
      `SELECT id
         FROM master_departments
        WHERE LOWER(TRIM(CONVERT(name USING utf8mb4) COLLATE utf8mb4_unicode_ci))
              = LOWER(TRIM(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))
        LIMIT 1`,
      [beneficiaryValue],
    );

    if (departmentRows.length) {
      departmentId = toPositiveInt(departmentRows[0].id);
    }
  }

  if (employeeId) {
    const [employeeRows] = await conn.execute(
      `SELECT department_id, entity_id
         FROM master_employees
        WHERE id = ?
          AND status = 'Active'
        LIMIT 1`,
      [employeeId],
    );

    if (employeeRows.length) {
      departmentId = departmentId || toPositiveInt(employeeRows[0].department_id);
      beneficiaryEntityId = beneficiaryEntityId || toPositiveInt(employeeRows[0].entity_id);
    }
  }

  if (!beneficiaryEntityId && entityTypeCode && beneficiaryValue) {
    const [entityRows] = await conn.execute(
      `SELECT me.id
         FROM master_entities me
         JOIN master_entity_types met ON met.id = me.entity_type_id
        WHERE me.is_active = 1
          AND UPPER(TRIM(met.code)) = ?
          AND LOWER(TRIM(CONVERT(me.name USING utf8mb4) COLLATE utf8mb4_unicode_ci))
              = LOWER(TRIM(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))
        LIMIT 1`,
      [entityTypeCode, beneficiaryValue],
    );

    if (entityRows.length) {
      beneficiaryEntityId = toPositiveInt(entityRows[0].id);
    }
  }

  return {
    beneficiaryType,
    departmentId,
    beneficiaryEntityId,
  };
}

const FINANCE_BREAKUP_APPROVED_BASE_SQL = `
  COALESCE(
    NULLIF(fbb.approved_amount, 0),
    NULLIF(fbb.amount, 0),
    NULLIF(fbb.available_amount_snapshot, 0),
    NULLIF(bpl.approved_line_total, 0),
    NULLIF(bpl.line_total, 0),
    0
  )
`;

const VALID_REQUEST_TYPES = new Set(['Advance', 'Settlement', 'Expenditure']);
const DEFAULT_BULK_TRANSACTION_TEMPLATE_VERSION = '2026-04-11';
const VALID_BULK_TRANSACTION_TYPES = new Set(['NEFT', 'RTGS', 'UPI', 'DD']);
const DEFAULT_BULK_TRANSACTION_TYPE = 'NEFT';
const VALID_BULK_TRANSACTION_BANKS = new Set(['AXIS', 'DBS']);

const normalizeBulkTransactionType = (value) => {
  const type = normalizeText(value).toUpperCase();
  return VALID_BULK_TRANSACTION_TYPES.has(type) ? type : DEFAULT_BULK_TRANSACTION_TYPE;
};

const normalizeBulkTransactionBank = (value) => {
  const bank = normalizeText(value).toUpperCase();
  return VALID_BULK_TRANSACTION_BANKS.has(bank) ? bank : null;
};

const normalizeRequestType = (value) => {
  const type = normalizeText(value);
  if (!type) return null;
  const formatted = `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`;
  return VALID_REQUEST_TYPES.has(formatted) ? formatted : null;
};

const normalizePaymentStatus = (value) => {
  const status = normalizeText(value);
  const allowed = new Set(['Paid', 'Pending', 'Processing', 'Cancelled']);
  return allowed.has(status) ? status : null;
};

const normalizeSqlDate = (value) => {
  const text = normalizeText(value);
  if (!text) return null;

  const ymdMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;

  const dmyMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
};

const ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL = `
  LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) NOT IN ('rejected', 'deleted', 'archived')
`;

const WORKFLOW_ROW_REF_SQL_EXPR = `
  LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.workflowrowref')), '')))
`;

const DASHBOARD_ROW_ID_SQL_EXPR = `
  LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.dashboardRowId')), '')))
`;

const WORKFLOW_ROW_INDEX_SQL_EXPR = `
  COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.rowIndex')) AS UNSIGNED), 0)
`;

const normalizeDebitStatus = (value) => {
  const status = normalizeText(value).toLowerCase();
  const allowed = new Set(['credited', 'reimbursement']);
  return allowed.has(status) ? status : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase(),
  );
};

const inferRequestType = (payload = {}) => {
  const explicitType = normalizeRequestType(
    payload.request_type ||
      payload.requesttype ||
      payload.requestType ||
      payload.workflowrequesttype ||
      payload.workflow_request_type ||
      payload.activeTab,
  );
  if (explicitType) return explicitType;

  if (
    Array.isArray(payload.advance_rows) &&
    payload.advance_rows.some(
      (row) => String(row?.advance || row?.advanceamount || '').trim() !== '',
    )
  ) {
    return 'Advance';
  }

  if (
    Array.isArray(payload.settlement_rows) &&
    payload.settlement_rows.some(
      (row) => String(row?.settlement || row?.settlementamount || '').trim() !== '',
    )
  ) {
    return 'Settlement';
  }

  if (
    Array.isArray(payload.expenditure_rows) &&
    payload.expenditure_rows.some(
      (row) =>
        String(
          row?.expenditure || row?.autoSum || row?.autosumamount || row?.expenditureinput || '',
        ).trim() !== '',
    )
  ) {
    return 'Expenditure';
  }

  return null;
};

let expenditureRequestColumnCache = null;

async function getExpenditureRequestColumns(source) {
  if (expenditureRequestColumnCache) return expenditureRequestColumnCache;

  const [rows] = await source.execute('SHOW COLUMNS FROM expenditure_requests');
  expenditureRequestColumnCache = new Set(rows.map((row) => String(row.Field || '').trim()));
  return expenditureRequestColumnCache;
}

function resolveWorkflowRowIdentifiers(payload = {}) {
  const explicitWorkflowRowRef = normalizeText(
    payload.workflowrowref ||
      payload.workflow_row_ref ||
      payload.rowReferenceId ||
      payload.row_reference_id ||
      null,
  );
  const explicitDashboardRowId = normalizeText(
    payload.dashboard_row_id || payload.dashboardRowId || null,
  );
  const rowIndex = toPositiveInt(payload.row_index || payload.rowIndex);

  const derivedRowRef =
    explicitWorkflowRowRef ||
    explicitDashboardRowId ||
    (rowIndex ? `finance-row-${rowIndex}` : null);

  return {
    workflowRowRef: derivedRowRef || null,
    dashboardRowId: explicitDashboardRowId || derivedRowRef || null,
    rowIndex,
  };
}

function getPersistentWorkflowRowState(workflowState = {}) {
  const normalized =
    workflowState && typeof workflowState === 'object' && !Array.isArray(workflowState)
      ? workflowState
      : {};

  return {
    module: normalizeRequestType(normalized.module) || null,
    workflowrowref: normalizeText(normalized.workflowrowref) || null,
    dashboardRowId: normalizeText(normalized.dashboardRowId) || null,
    rowIndex: toPositiveInt(normalized.rowIndex),
    workflowbudgetlineid: toPositiveInt(normalized.workflowbudgetlineid),
    workflowbudgetproposalid: toPositiveInt(normalized.workflowbudgetproposalid),
    sourceRequestId: toPositiveInt(normalized.sourceRequestId),
  };
}

function deriveLegacyAnchorRequestIds({
  dashboardRowId = null,
  workflowRowRef = null,
  sourceRequestId = null,
} = {}) {
  const ids = new Set();
  const explicitSourceRequestId = toPositiveInt(sourceRequestId);
  if (explicitSourceRequestId) ids.add(explicitSourceRequestId);

  const candidates = [dashboardRowId, workflowRowRef];
  for (const candidate of candidates) {
    const text = normalizeText(candidate);
    const match = text.match(/(?:^|-)request-(\d+)$/i);
    if (match) {
      const parsed = toPositiveInt(match[1]);
      if (parsed) ids.add(parsed);
    }
  }

  return [...ids];
}

async function getWorkflowRowHistory(
  conn,
  { financeRequestId, workflowRowRef, dashboardRowId, rowIndex, sourceRequestId } = {},
) {
  const financeId = toPositiveInt(financeRequestId);
  const normalizedWorkflowRowRef = normalizeText(workflowRowRef).toLowerCase();
  const normalizedDashboardRowId = normalizeText(dashboardRowId).toLowerCase();
  const normalizedRowIndex = toPositiveInt(rowIndex);
  const anchorRequestIds = deriveLegacyAnchorRequestIds({
    dashboardRowId,
    workflowRowRef,
    sourceRequestId,
  });

  if (
    !financeId ||
    (!normalizedWorkflowRowRef &&
      !normalizedDashboardRowId &&
      !normalizedRowIndex &&
      !anchorRequestIds.length)
  ) {
    return [];
  }

  const matchClauses = [];
  const params = [financeId];

  if (normalizedWorkflowRowRef) {
    matchClauses.push(`${WORKFLOW_ROW_REF_SQL_EXPR} = ?`);
    params.push(normalizedWorkflowRowRef);
  }

  if (normalizedDashboardRowId) {
    matchClauses.push(`${DASHBOARD_ROW_ID_SQL_EXPR} = ?`);
    params.push(normalizedDashboardRowId);
  }

  if (anchorRequestIds.length) {
    matchClauses.push(`er.id IN (${anchorRequestIds.map(() => '?').join(', ')})`);
    params.push(...anchorRequestIds);
  }

  if (
    !normalizedWorkflowRowRef &&
    !normalizedDashboardRowId &&
    !anchorRequestIds.length &&
    normalizedRowIndex
  ) {
    matchClauses.push(`${WORKFLOW_ROW_INDEX_SQL_EXPR} = ?`);
    params.push(normalizedRowIndex);
  }

  const [rows] = await conn.execute(
    `SELECT
       er.id,
       er.request_type,
       er.advance_total_amount,
       er.settlement_total_amount,
       er.expenditure_total_amount,
       er.total_amount
     FROM expenditure_requests er
     WHERE er.finance_request_id = ?
       AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}
       AND (${matchClauses.join(' OR ')})
     ORDER BY er.created_at ASC, er.id ASC`,
    params,
  );

  return rows.map((row) => ({
    id: toPositiveInt(row.id),
    requestType: normalizeText(row.request_type),
    advanceAmount: toMoney(row.advance_total_amount),
    settlementAmount: toMoney(row.settlement_total_amount),
    expenditureAmount: toMoney(row.expenditure_total_amount),
    totalAmount: toMoney(row.total_amount),
  }));
}

function validateWorkflowRowFlow(
  requestType,
  rowHistory = [],
  {
    requestedAdvance = 0,
    requestedSettlement = 0,
    requestedExpenditure = 0,
    allowZeroSettlement = false,
  } = {},
) {
  if (!rowHistory.length) return;

  const hasAdvance = rowHistory.some((row) => row.requestType === 'Advance');
  const hasSettlement = rowHistory.some((row) => row.requestType === 'Settlement');
  const hasExpenditure = rowHistory.some((row) => row.requestType === 'Expenditure');

  if (requestType === 'Expenditure') {
    if (hasAdvance || hasSettlement) {
      throw new Error(
        'Advance flow already exists for this row. Create a new row for expenditure.',
      );
    }
    if (hasExpenditure) {
      throw new Error(
        'Expenditure already exists for this row. Create a new row for another expenditure.',
      );
    }
    if (requestedExpenditure <= 0) {
      throw new Error('Expenditure amount must be greater than 0');
    }
    return;
  }

  if (requestType === 'Advance') {
    if (hasExpenditure) {
      throw new Error('Expenditure already exists for this row. Create a new row for advance.');
    }
    if (hasSettlement) {
      throw new Error(
        'Settlement already exists for this row. Create a new row for another advance.',
      );
    }
    if (requestedAdvance <= 0) {
      throw new Error('Advance amount must be greater than 0');
    }
    return;
  }

  if (requestType === 'Settlement') {
    if (!hasAdvance) {
      throw new Error('Settlement requires an existing advance on the same row.');
    }
    if (hasExpenditure) {
      throw new Error('Settlement cannot be created for an expenditure row.');
    }
    if (hasSettlement) {
      throw new Error('Settlement already exists for this row.');
    }
    if (requestedSettlement < 0 || (requestedSettlement === 0 && !allowZeroSettlement)) {
      throw new Error('Settlement amount must be greater than 0');
    }
  }
}

const hasExplicitMoneyValue = (row = {}, keys = []) =>
  keys.some((key) => {
    if (!Object.prototype.hasOwnProperty.call(row, key)) return false;
    const value = row[key];
    return value !== null && value !== undefined && String(value).trim() !== '';
  });

const hasBudgetLineSelection = (row = {}) =>
  Boolean(toPositiveInt(row.budgetLineId || row.budget_line_id)) ||
  Boolean(sanitizeRowValue(row.budgetHead || row.budget_head)) ||
  Boolean(sanitizeRowValue(row.subHead || row.sub_head));

const hasSettlementRowsForClosure = (rows = []) =>
  Array.isArray(rows) &&
  rows.some(
    (row) =>
      hasExplicitMoneyValue(row, ['settlement', 'settlement_amount', 'settlementamount']) &&
      hasBudgetLineSelection(row),
  );

// LEGACY: expenditure requests raised before `expenditure_requests.employee_id` existed carry
// NULL there, so the creating login is the only claimant identity available for them. Remove
// once every row has employee_id populated.
const LEGACY_NULL_APPLICANT_CLAIMANT_SQL = '(er.employee_id IS NULL AND er.created_by = ?)';

async function getCumulativeAdvanceSummary(
  connOrDb,
  {
    userId,
    // The applicant the claim is FOR. A cumulative advance belongs to the applicant, not to
    // the login that typed it — a shared department account and the applicant's own login can
    // both raise claims against the same head and both have to count. See
    // shared/financeOwnership.js for why the two are routinely different people.
    employeeId = null,
    budgetLineId,
    head,
    subHead,
    // NEW: catalog IDs. When present, matching prefers IDs over text so
    // renames in the catalog don't break the cumulative count. LEGACY: when
    // IDs are null (older rows pre-dating the catalog), match by normalized
    // text on snapshot columns.
    budgetHeadId = null,
    budgetSubHeadId = null,
    financeRequestId = null,
    rowIndex = null,
    sourceRequestId = null,
    dashboardRowId = null,
    workflowRowRef = null,
    excludeExpenditureId = null,
  } = {},
) {
  const uid = toPositiveInt(userId);
  const lineId = toPositiveInt(budgetLineId);
  const financeId = toPositiveInt(financeRequestId);
  const currentRowIndex = toPositiveInt(rowIndex);
  const anchorRequestIds = deriveLegacyAnchorRequestIds({
    dashboardRowId,
    workflowRowRef,
    sourceRequestId,
  });
  const excludedExpenditureId = toPositiveInt(excludeExpenditureId);
  const normalizedDashboardRowId = normalizeText(dashboardRowId).toLowerCase();
  const normalizedWorkflowRowRef = normalizeText(workflowRowRef).toLowerCase();
  const normalizedWorkflowRowRefForAdvance = normalizedWorkflowRowRef
    .replace('-settlement-', '-advance-')
    .replace('-expenditure-', '-advance-');
  const normalizedHead = normalizeText(head).toLowerCase();
  const normalizedSubHead = normalizeText(subHead).toLowerCase();

  if (!uid || (!lineId && (!normalizedHead || !normalizedSubHead))) {
    return { preAdvance: 0, count: 0 };
  }

  const source = connOrDb || db;
  const activeStatusClause = `
    LOWER(TRIM(er.overall_status)) NOT IN ('rejected', 'deleted')
  `;
  const requestColumns = await getExpenditureRequestColumns(source);
  const hasLegacyBudgetLine = requestColumns.has('budget_line_id');
  const hasLegacyHead = requestColumns.has('head');
  const hasLegacySubHead = requestColumns.has('sub_head');
  const legacyAmountExpr = requestColumns.has('amount')
    ? 'COALESCE(er.advance_total_amount, er.amount, er.total_amount, 0)'
    : 'COALESCE(er.advance_total_amount, er.total_amount, 0)';
  let scopeClause = '';
  let scopeParams = [];
  const rowIdentityClauses = [];
  if (normalizedDashboardRowId) {
    rowIdentityClauses.push(`${DASHBOARD_ROW_ID_SQL_EXPR} = ?`);
    scopeParams.push(normalizedDashboardRowId);
  }
  if (normalizedWorkflowRowRef) {
    rowIdentityClauses.push(`${WORKFLOW_ROW_REF_SQL_EXPR} = ?`);
    scopeParams.push(normalizedWorkflowRowRefForAdvance);
  }
  if (anchorRequestIds.length) {
    rowIdentityClauses.push(`er.id IN (${anchorRequestIds.map(() => '?').join(', ')})`);
    scopeParams.push(...anchorRequestIds);
  }
  if (
    !normalizedDashboardRowId &&
    !normalizedWorkflowRowRef &&
    !anchorRequestIds.length &&
    currentRowIndex
  ) {
    rowIdentityClauses.push(`${WORKFLOW_ROW_INDEX_SQL_EXPR} = ?`);
    scopeParams.push(currentRowIndex);
  }

  if (financeId) {
    if (rowIdentityClauses.length) {
      scopeClause = `
          AND er.finance_request_id = ?
          AND (${rowIdentityClauses.join(' OR ')})
        `;
      scopeParams = [financeId, ...scopeParams];
    } else {
      scopeClause = `
          AND er.finance_request_id = ?
        `;
      scopeParams = [financeId];
    }
  } else if (rowIdentityClauses.length) {
    scopeClause = `
        AND (${rowIdentityClauses.join(' OR ')})
      `;
  }

  // Who the prior advances have to belong to, in order of precision:
  //   1. a finance request pins the card, which is narrower than any person — no person filter.
  //   2. the applicant employee, when known: every claim raised FOR them counts, whichever
  //      login typed it. Callers must authorize the applicant first — see
  //      `canReadApplicantAdvanceTotals`.
  //   3. otherwise the caller's own identity — creator OR the applicant whose login this is —
  //      which is the same rule the dashboard and list use.
  const claimantEmployeeId = toPositiveInt(employeeId);
  let claimantClause;
  let claimantParams;
  if (financeId) {
    claimantClause = '1 = 1';
    claimantParams = [];
  } else if (claimantEmployeeId) {
    claimantClause = `(er.employee_id = ? OR ${LEGACY_NULL_APPLICANT_CLAIMANT_SQL})`;
    claimantParams = [claimantEmployeeId, uid];
  } else {
    claimantClause = buildFinanceOwnerCondition('er');
    claimantParams = buildFinanceOwnerParams(uid);
  }

  const exclusionClause = excludedExpenditureId ? 'AND er.id <> ?' : '';
  const exclusionParams = excludedExpenditureId ? [excludedExpenditureId] : [];

  const headIdVal = toPositiveInt(budgetHeadId);
  const subIdVal = toPositiveInt(budgetSubHeadId);

  let rowMatchClause = 'ar.budget_line_id = ?';
  let legacyMatchClause = '1 = 0';
  let rowMatchParams = [lineId];
  let legacyMatchParams = [];

  if (lineId && normalizedHead && normalizedSubHead) {
    const nullLineIdMatch =
      headIdVal && subIdVal
        ? `OR (
          ar.budget_line_id IS NULL
          AND ar.budget_head_id = ?
          AND ar.budget_sub_head_id = ?
        )`
        : '';
    rowMatchClause = `
      (
        ar.budget_line_id = ?
        ${nullLineIdMatch}
        OR (
          ar.budget_line_id IS NULL
          AND LOWER(TRIM(ar.budget_head)) = ?
          AND LOWER(TRIM(ar.sub_head)) = ?
        )
      )
    `;
    rowMatchParams = nullLineIdMatch
      ? [lineId, headIdVal, subIdVal, normalizedHead, normalizedSubHead]
      : [lineId, normalizedHead, normalizedSubHead];
    if (hasLegacyBudgetLine) {
      legacyMatchClause = `
        (
          er.budget_line_id = ?
          OR (
            er.budget_line_id IS NULL
            AND LOWER(TRIM(er.head)) = ?
            AND LOWER(TRIM(er.sub_head)) = ?
          )
        )
      `;
      legacyMatchParams = [lineId, normalizedHead, normalizedSubHead];
    }
  } else if (!lineId) {
    // NEW: the ID match catches rows whose head/sub was renamed in the catalog. The text match
    // runs beside it — never instead of it — for two reasons:
    //   LEGACY: rows pre-dating the catalog, which carry snapshot text and no IDs. Remove this
    //     reason once every advance row is backfilled:
    //       SELECT COUNT(*) FROM expenditure_advance_rows WHERE budget_head_id IS NULL;
    //   Rows pointing at a DUPLICATE catalog entry of the same name. No backfill fixes those,
    //     so this reason stands until duplicates are merged out of the catalog.
    // Both arms must count, whatever the other one holds — callers that resolve IDs (settlement
    // validation) and callers that don't (the advance-summary endpoint the form reads) have to
    // arrive at the same total or the form's figure gets rejected.
    if (headIdVal && subIdVal) {
      rowMatchClause = `
        (
          (ar.budget_head_id = ? AND ar.budget_sub_head_id = ?)
          OR (
            LOWER(TRIM(ar.budget_head)) = ?
            AND LOWER(TRIM(ar.sub_head)) = ?
          )
        )
      `;
      rowMatchParams = [headIdVal, subIdVal, normalizedHead, normalizedSubHead];
    } else {
      rowMatchClause = `
        LOWER(TRIM(ar.budget_head)) = ?
        AND LOWER(TRIM(ar.sub_head)) = ?
      `;
      rowMatchParams = [normalizedHead, normalizedSubHead];
    }
    if (hasLegacyHead && hasLegacySubHead) {
      legacyMatchClause = `
        LOWER(TRIM(er.head)) = ?
        AND LOWER(TRIM(er.sub_head)) = ?
      `;
      legacyMatchParams = [normalizedHead, normalizedSubHead];
    }
  } else if (hasLegacyBudgetLine) {
    legacyMatchClause = 'er.budget_line_id = ?';
    legacyMatchParams = [lineId];
  }

  const [[row]] = await source.execute(
    `SELECT
       COALESCE(row_totals.total_advanced, 0) + COALESCE(legacy_totals.total_advanced, 0) AS total_advanced,
       COALESCE(row_totals.cnt, 0) + COALESCE(legacy_totals.cnt, 0)                         AS cnt
     FROM (
       SELECT
         COALESCE(SUM(ar.advance_amount), 0) AS total_advanced,
         COUNT(DISTINCT er.id)               AS cnt
       FROM expenditure_advance_rows ar
       JOIN expenditure_requests er ON er.id = ar.expenditure_id
      WHERE ${claimantClause}
        AND er.request_type = 'Advance'
        AND ${activeStatusClause}
        ${scopeClause}
        ${exclusionClause}
        AND ${rowMatchClause}
     ) AS row_totals
     CROSS JOIN (
       SELECT
         COALESCE(SUM(${legacyAmountExpr}), 0) AS total_advanced,
         COUNT(*)                              AS cnt
       FROM expenditure_requests er
      WHERE ${claimantClause}
        AND er.request_type = 'Advance'
        AND ${activeStatusClause}
        ${scopeClause}
        ${exclusionClause}
        AND ${legacyMatchClause}
        AND NOT EXISTS (
          SELECT 1
            FROM expenditure_advance_rows arx
           WHERE arx.expenditure_id = er.id
        )
     ) AS legacy_totals`,
    [
      ...claimantParams,
      ...scopeParams,
      ...exclusionParams,
      ...rowMatchParams,
      ...claimantParams,
      ...scopeParams,
      ...exclusionParams,
      ...legacyMatchParams,
    ],
  );

  return {
    preAdvance: toMoney(row?.total_advanced),
    count: Number(row?.cnt || 0),
  };
}

const getFinanceBudgetUsageMatchKey = ({ budgetLineId, budgetHead, subHead }) => {
  const lineId = toPositiveInt(budgetLineId);
  const head = normalizeText(budgetHead).replace(/\s+/g, ' ').toLowerCase();
  const sub = normalizeText(subHead).replace(/\s+/g, ' ').toLowerCase();
  return lineId && head && sub ? `${lineId}::${head}::${sub}` : null;
};

async function getFinanceRequestBudgetUsageByBreakup(
  connOrDb,
  { financeRequestId, budgetBreakups = [], excludeExpenditureId = null } = {},
) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return new Map();
  const excludedRequestId = toPositiveInt(excludeExpenditureId);

  const normalizedBreakups = (Array.isArray(budgetBreakups) ? budgetBreakups : [])
    .map((breakup) => ({
      id: toPositiveInt(breakup?.finance_budget_breakup_id ?? breakup?.id),
      budgetLineId: toPositiveInt(breakup?.budget_line_id ?? breakup?.budgetLineId),
      budgetHead: normalizeText(breakup?.head ?? breakup?.budget_head),
      subHead: normalizeText(breakup?.sub_head ?? breakup?.subHead),
    }))
    .filter((breakup) => breakup.id && breakup.budgetLineId);

  const breakupsById = new Map(normalizedBreakups.map((breakup) => [breakup.id, breakup]));
  const breakupsByLegacyKey = new Map();
  const breakupsByLineId = new Map();
  for (const breakup of normalizedBreakups) {
    const legacyKey = getFinanceBudgetUsageMatchKey(breakup);
    if (legacyKey) {
      const matching = breakupsByLegacyKey.get(legacyKey) || [];
      matching.push(breakup);
      breakupsByLegacyKey.set(legacyKey, matching);
    }

    const lineMatching = breakupsByLineId.get(breakup.budgetLineId) || [];
    lineMatching.push(breakup);
    breakupsByLineId.set(breakup.budgetLineId, lineMatching);
  }

  const normalizedBudgetLineIds = Array.from(breakupsByLineId.keys());

  const source = connOrDb || db;
  const lineFilterSql = normalizedBudgetLineIds.length
    ? `WHERE usage_rows.budget_line_id IN (${normalizedBudgetLineIds.map(() => '?').join(', ')})`
    : '';
  const unplannedUsageUnionSql = `
       UNION ALL

       SELECT
         NULL AS finance_budget_breakup_id,
         eur.head_of_account_budget_line_id AS budget_line_id,
         ${collateBudgetText('eur.budget_head')} AS budget_head,
         ${collateBudgetText('eur.sub_head')} AS sub_head,
         eur.amount AS amount_delta
       FROM expenditure_unplanned_rows eur
       JOIN expenditure_requests er ON er.id = eur.expenditure_id
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND eur.head_of_account_budget_line_id IS NOT NULL
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

       UNION ALL

       SELECT
         NULL AS finance_budget_breakup_id,
         er.unplanned_head_of_account_budget_line_id AS budget_line_id,
         ${collateBudgetText('er.unplanned_budget_head')} AS budget_head,
         ${collateBudgetText('er.unplanned_budget_sub_head')} AS sub_head,
         er.unplanned_budget_amount AS amount_delta
       FROM expenditure_requests er
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND er.unplanned_budget_enabled = 1
         AND er.unplanned_head_of_account_budget_line_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
             FROM expenditure_unplanned_rows eur_existing
            WHERE eur_existing.expenditure_id = er.id
         )
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}
`;

  const [rows] = await source.execute(
    `SELECT
       usage_rows.finance_budget_breakup_id,
       usage_rows.budget_line_id,
       usage_rows.budget_head,
       usage_rows.sub_head,
       GREATEST(0, COALESCE(SUM(usage_rows.amount_delta), 0)) AS consumed_amount
     FROM (
       SELECT
         ar.finance_budget_breakup_id,
         ar.budget_line_id,
         ${collateBudgetText('ar.budget_head')} AS budget_head,
         ${collateBudgetText('ar.sub_head')} AS sub_head,
         ar.advance_amount AS amount_delta
       FROM expenditure_advance_rows ar
       JOIN expenditure_requests er ON er.id = ar.expenditure_id
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

       UNION ALL

       SELECT
         lr.finance_budget_breakup_id,
         lr.budget_line_id,
         ${collateBudgetText('lr.budget_head')} AS budget_head,
         ${collateBudgetText('lr.sub_head')} AS sub_head,
         lr.auto_sum_amount AS amount_delta
       FROM expenditure_line_rows lr
       JOIN expenditure_requests er ON er.id = lr.expenditure_id
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

       ${unplannedUsageUnionSql}

    ) AS usage_rows
     ${lineFilterSql}
     GROUP BY usage_rows.finance_budget_breakup_id,
              usage_rows.budget_line_id,
              usage_rows.budget_head,
              usage_rows.sub_head`,
    normalizedBudgetLineIds.length
      ? [
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
          ...normalizedBudgetLineIds,
        ]
      : [
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
          financeId,
          excludedRequestId,
          excludedRequestId,
        ],
  );

  const usageByBreakupId = new Map();
  for (const row of rows) {
    const consumedAmount = toMoney(row.consumed_amount);
    if (!(consumedAmount > 0)) continue;

    const explicitBreakupId = toPositiveInt(row.finance_budget_breakup_id);
    let matchedBreakup = explicitBreakupId ? breakupsById.get(explicitBreakupId) : null;

    // LEGACY: rows created before finance_budget_breakup_id was persisted don't
    // carry it, so match them by their stored budget line plus head/sub-head
    // instead. When more than one breakup shares that key, attribute the usage
    // to the earliest (lowest id) breakup rather than drop it, since dropping
    // it would understate consumed amount and overstate available budget.
    // Remove once all expenditure_advance_rows/expenditure_line_rows have
    // finance_budget_breakup_id populated.
    if (!matchedBreakup) {
      const legacyKey = getFinanceBudgetUsageMatchKey({
        budgetLineId: row.budget_line_id,
        budgetHead: row.budget_head,
        subHead: row.sub_head,
      });
      const legacyMatches = legacyKey ? breakupsByLegacyKey.get(legacyKey) || [] : [];
      const lineMatches = breakupsByLineId.get(toPositiveInt(row.budget_line_id)) || [];
      const candidates = legacyMatches.length ? legacyMatches : lineMatches;
      matchedBreakup = candidates.reduce(
        (earliest, candidate) => (!earliest || candidate.id < earliest.id ? candidate : earliest),
        null,
      );
    }

    if (!matchedBreakup) continue;
    usageByBreakupId.set(
      matchedBreakup.id,
      toMoney((usageByBreakupId.get(matchedBreakup.id) || 0) + consumedAmount),
    );
  }

  return usageByBreakupId;
}

// Line-keyed view of finance budget usage, for callers that budget per budget
// line rather than per finance breakup (approved-head total checks and the
// per-line remaining-budget lock). Loads the finance's breakups for the given
// lines, delegates to getFinanceRequestBudgetUsageByBreakup, then folds the
// breakup-keyed usage back down to a Map keyed by budget_line_id.
async function getFinanceRequestBudgetUsageByLine(
  connOrDb,
  { financeRequestId, budgetLineIds = [], excludeExpenditureId = null } = {},
) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return new Map();

  const normalizedBudgetLineIds = Array.from(
    new Set(
      (Array.isArray(budgetLineIds) ? budgetLineIds : [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean),
    ),
  );
  if (normalizedBudgetLineIds.length === 0) return new Map();

  const source = connOrDb || db;
  const placeholders = normalizedBudgetLineIds.map(() => '?').join(', ');
  const [breakupRows] = await source.execute(
    `SELECT id AS finance_budget_breakup_id, budget_line_id, budget_head AS head, sub_head
       FROM finance_budget_breakup
      WHERE finance_id = ?
        AND budget_line_id IN (${placeholders})`,
    [financeId, ...normalizedBudgetLineIds],
  );

  const usageByBreakupId = await getFinanceRequestBudgetUsageByBreakup(source, {
    financeRequestId: financeId,
    budgetBreakups: breakupRows,
    excludeExpenditureId,
  });

  const lineIdByBreakupId = new Map(
    breakupRows.map((row) => [
      toPositiveInt(row.finance_budget_breakup_id),
      toPositiveInt(row.budget_line_id),
    ]),
  );

  const usageByLineId = new Map();
  for (const [breakupId, amount] of usageByBreakupId.entries()) {
    const lineId = lineIdByBreakupId.get(toPositiveInt(breakupId));
    if (!lineId) continue;
    usageByLineId.set(lineId, toMoney((usageByLineId.get(lineId) || 0) + toMoney(amount)));
  }
  return usageByLineId;
}

// ─── Transaction helper (same signature as budgetModel.withTransaction) ────────

export async function withTransaction(callback) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw new Error(`Transaction failed: ${err.message}`);
  } finally {
    conn.release();
  }
}

// ─── Reference-number generation (mirrors budget_proposal_refs pattern) ────────

async function getFinanceRequestRefBase(conn, financeRequestId, requestDate) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  if (!normalizedFinanceRequestId) {
    return normalizeFinanceRequestRefBase('', {
      financeRequestId,
      requestDate,
    });
  }

  const [rows] = await conn.execute(
    `SELECT
       fr.id,
       fr.request_date,
       COALESCE(
         frr.request_ref,
         CONCAT(
           '#F-',
           COALESCE(
             (
               SELECT MIN(bp_ref.fiscal_year)
                 FROM finance_budget_breakup fbb_ref
                 JOIN budget_proposals bp_ref ON bp_ref.id = fbb_ref.budget_proposal_id
                WHERE fbb_ref.finance_id = fr.id
             ),
             YEAR(COALESCE(fr.request_date, fr.created_at))
               - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
           ),
           '-',
           LPAD(fr.id, 4, '0')
         )
       ) AS request_ref
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     WHERE fr.id = ?
     LIMIT 1`,
    [normalizedFinanceRequestId],
  );

  const row = rows[0] || null;
  return normalizeFinanceRequestRefBase(row?.request_ref, {
    financeRequestId: normalizedFinanceRequestId,
    requestDate: row?.request_date || requestDate,
  });
}

function resolveExpenditureRefYear(financeRefBase, requestDate = null) {
  const refYearMatch = String(financeRefBase || '').match(/^#?F-(\d{4})-/i);
  const refYear = toPositiveInt(refYearMatch?.[1]);
  if (refYear) {
    return refYear;
  }

  const dateObj = requestDate ? new Date(requestDate) : new Date();
  const fallbackDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  return fallbackDate.getFullYear() - (fallbackDate.getMonth() < 3 ? 1 : 0);
}

function getWorkflowRowLetter(sequence) {
  const normalized = Math.max(toPositiveInt(sequence) || 1, 1);
  let index = normalized;
  let label = '';

  while (index > 0) {
    index -= 1;
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26);
  }

  return label;
}

function resolveExpenditureRefMeta(requestType, workflowRowHistory = [], rowIndex = null) {
  const normalizedRowIndex = toPositiveInt(rowIndex);
  const rowLetter = getWorkflowRowLetter(normalizedRowIndex || 1);
  const priorAdvanceCount = workflowRowHistory.filter(
    (row) => row.requestType === 'Advance',
  ).length;
  let stepSequence = 1;

  if (requestType === 'Advance') {
    stepSequence = priorAdvanceCount >= 1 ? 2 : 1;
  } else if (requestType === 'Settlement') {
    stepSequence = priorAdvanceCount >= 2 ? 3 : 2;
  } else if (requestType === 'Expenditure') {
    stepSequence = 1;
  } else {
    throw new Error(
      `Unsupported expenditure request type for ref generation: ${requestType || 'unknown'}`,
    );
  }

  return {
    suffix: `${rowLetter}${stepSequence}`,
  };
}

async function insertExpenditureRef(
  conn,
  {
    expenditureId,
    financeRequestId,
    requestDate,
    requestType,
    workflowRowHistory = [],
    rowIndex = null,
  } = {},
) {
  try {
    const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
    const financeRefBase = await getFinanceRequestRefBase(
      conn,
      normalizedFinanceRequestId,
      requestDate,
    );
    const year = resolveExpenditureRefYear(financeRefBase, requestDate);
    const lockName = `expenditure_ref_fy_${year}`;
    const [[{ acquired }]] = await conn.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
    if (Number(acquired) !== 1) {
      throw new Error(
        `Could not acquire expenditure reference lock for ${normalizedFinanceRequestId || year}`,
      );
    }

    try {
      const { suffix } = resolveExpenditureRefMeta(requestType, workflowRowHistory, rowIndex);
      const ref = `${financeRefBase}-${suffix}`;

      const [[sequenceRow]] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) + 1 AS next_sequence
           FROM expenditure_request_refs
          WHERE ref_year = ?`,
        [year],
      );
      const storageSequence = Number(sequenceRow?.next_sequence || 1);

      await conn.execute(
        `INSERT INTO expenditure_request_refs
           (expenditure_request_id, ref_year, ref_sequence, request_ref)
         VALUES (?, ?, ?, ?)`,
        [expenditureId, year, storageSequence, ref],
      );

      return ref;
    } finally {
      await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null;
    if (err?.code === 'ER_DUP_ENTRY') {
      throw new Error('Expenditure already exists for this workflow row.');
    }
    throw err;
  }
}

// ─── Approved-budget helpers ──────────────────────────────────────────────────

/**
 * Return all approved budget lines visible to the given user,
 * enriched with consumed amount and remaining balance.
 * "Approved" means the parent proposal status is 'completed'.
 */
async function getApprovedFinanceRequestOwner(connOrDb, financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const source = connOrDb || db;
  const [rows] = await source.execute(
    // `applicant_user_id` is the login of the applicant the request was raised FOR, which is a
    // different person from `created_by` whenever a shared department account submitted it.
    // Both count as the owner — see shared/financeOwnership.js.
    `SELECT fr.id, fr.created_by, emp_owner.user_id AS applicant_user_id
       FROM finance_requests fr
       LEFT JOIN master_employees emp_owner ON emp_owner.id = fr.employee_id
      WHERE fr.id = ?
        AND (
          LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
          OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
          OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
        )
      LIMIT 1`,
    [financeId],
  );

  return rows[0] || null;
}

async function getFinanceCarryForwardTargetYear(connOrDb, financeRequestId, fiscalYear) {
  const financeId = toPositiveInt(financeRequestId);
  const targetYear = toPositiveInt(fiscalYear);
  if (!financeId || !targetYear) return null;

  const source = connOrDb || db;
  const [rows] = await source.execute(
    `SELECT target_fiscal_year
       FROM finance_carry_forward_allocations
      WHERE finance_request_id = ?
        AND target_fiscal_year = ?
        AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'
      LIMIT 1`,
    [financeId, targetYear],
  );

  return toPositiveInt(rows?.[0]?.target_fiscal_year);
}

async function getFinanceBudgetScope(connOrDb, financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const source = connOrDb || db;
  const [rows] = await source.execute(
    `SELECT
       fr.id,
       fr.beneficiary_type,
       fr.beneficiary_value,
       fr.department_id,
       fr.beneficiary_entity_id,
       COALESCE(frr.request_ref, '') AS finance_request_ref
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     WHERE fr.id = ?
     LIMIT 1`,
    [financeId],
  );

  return rows?.[0] || null;
}

function buildBudgetProposalScope(scope = {}) {
  const where = [];
  const params = [];
  const beneficiaryType = normalizeText(scope.beneficiary_type).toLowerCase();
  const beneficiaryValue = normalizeText(scope.beneficiary_value);
  const departmentId = toPositiveInt(scope.department_id);
  const entityId = toPositiveInt(scope.beneficiary_entity_id);

  if (departmentId) {
    where.push('bp.department_id = ?');
    params.push(departmentId);
  }

  if (
    entityId &&
    !['department', 'faculty', 'staff', 'individual faculty'].includes(beneficiaryType)
  ) {
    where.push('bp.beneficiary_entity_id = ?');
    params.push(entityId);
  }

  if (!where.length && beneficiaryType) {
    where.push("LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = ?");
    params.push(beneficiaryType);
  }

  if (!where.length && beneficiaryValue) {
    where.push(
      "LOWER(TRIM(CONVERT(COALESCE(bp.beneficiary_value, '') USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))",
    );
    params.push(beneficiaryValue);
  }

  return {
    sql: where.length ? ` AND ${where.join(' AND ')}` : '',
    params,
  };
}

async function getGlobalBudgetUsageByLine(
  connOrDb,
  budgetLineIds = [],
  { excludeExpenditureId = null } = {},
) {
  const normalizedBudgetLineIds = Array.from(
    new Set(
      (Array.isArray(budgetLineIds) ? budgetLineIds : [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean),
    ),
  );
  if (!normalizedBudgetLineIds.length) return new Map();

  const source = connOrDb || db;
  const placeholders = normalizedBudgetLineIds.map(() => '?').join(', ');
  const excludedRequestId = toPositiveInt(excludeExpenditureId);

  const [rows] = await source.execute(
    `SELECT usage_rows.budget_line_id, COALESCE(SUM(usage_rows.amount_delta), 0) AS consumed_amount
       FROM (
         SELECT ar.budget_line_id, ar.advance_amount AS amount_delta
           FROM expenditure_advance_rows ar
           JOIN expenditure_requests er ON er.id = ar.expenditure_id
          WHERE ar.budget_line_id IN (${placeholders})
            AND (? IS NULL OR er.id <> ?)
            AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

         UNION ALL

         SELECT lr.budget_line_id, lr.auto_sum_amount AS amount_delta
           FROM expenditure_line_rows lr
           JOIN expenditure_requests er ON er.id = lr.expenditure_id
          WHERE lr.budget_line_id IN (${placeholders})
            AND (? IS NULL OR er.id <> ?)
            AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

         UNION ALL

         SELECT sr.budget_line_id, sr.settlement_amount AS amount_delta
           FROM expenditure_settlement_rows sr
           JOIN expenditure_requests er ON er.id = sr.expenditure_id
           JOIN finance_requests fr ON fr.id = er.finance_request_id
           JOIN budget_proposals bp_sr ON bp_sr.id = sr.budget_proposal_id
          WHERE sr.budget_line_id IN (${placeholders})
            AND (? IS NULL OR er.id <> ?)
            AND bp_sr.fiscal_year <> COALESCE(
              (
                SELECT MIN(bp_src.fiscal_year)
                  FROM finance_budget_breakup fbb_src
                  JOIN budget_proposals bp_src ON bp_src.id = fbb_src.budget_proposal_id
                 WHERE fbb_src.finance_id = fr.id
              ),
              YEAR(COALESCE(fr.request_date, fr.created_at))
                - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
            )
            AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

         UNION ALL

         SELECT eur.head_of_account_budget_line_id AS budget_line_id, eur.amount AS amount_delta
           FROM expenditure_unplanned_rows eur
           JOIN expenditure_requests er ON er.id = eur.expenditure_id
          WHERE eur.head_of_account_budget_line_id IN (${placeholders})
            AND (? IS NULL OR er.id <> ?)
            AND eur.head_of_account_budget_line_id IS NOT NULL
            AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}
       ) usage_rows
      GROUP BY usage_rows.budget_line_id`,
    [
      ...normalizedBudgetLineIds,
      excludedRequestId,
      excludedRequestId,
      ...normalizedBudgetLineIds,
      excludedRequestId,
      excludedRequestId,
      ...normalizedBudgetLineIds,
      excludedRequestId,
      excludedRequestId,
      ...normalizedBudgetLineIds,
      excludedRequestId,
      excludedRequestId,
    ],
  );

  return new Map(
    rows.map((row) => [toPositiveInt(row.budget_line_id), toMoney(row.consumed_amount)]),
  );
}

async function getApprovedCarryForwardFiscalYearBudgets({
  connOrDb = db,
  financeRequestId,
  fiscalYear,
  excludeExpenditureId = null,
} = {}) {
  const financeId = toPositiveInt(financeRequestId);
  const targetYear = await getFinanceCarryForwardTargetYear(connOrDb, financeId, fiscalYear);
  if (!financeId || !targetYear) return [];

  const scope = await getFinanceBudgetScope(connOrDb, financeId);
  if (!scope) return [];

  const { sql: scopeSql, params: scopeParams } = buildBudgetProposalScope(scope);
  const source = connOrDb || db;

  // Carry-forward "shows the same card in the target FY", so the settlement may
  // only use the SOURCE request's head/sub combinations — not every budget line
  // in the department's target-year budget. Build the allowed head::sub keys from
  // this finance request's budget breakup and filter the target-year lines to them.
  const [sourceHeadRows] = await source.execute(
    `SELECT DISTINCT
       LOWER(TRIM(COALESCE(NULLIF(TRIM(fbb.budget_head), ''), bpl.budget_head, ''))) AS h,
       LOWER(TRIM(COALESCE(NULLIF(TRIM(fbb.sub_head), ''), bpl.sub_head, '')))       AS s
     FROM finance_budget_breakup fbb
     LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
     WHERE fbb.finance_id = ?`,
    [financeId],
  );
  const allowedHeadSubKeys = new Set(
    sourceHeadRows
      .map((row) => `${normalizeText(row.h).toLowerCase()}::${normalizeText(row.s).toLowerCase()}`)
      .filter((key) => key !== '::'),
  );
  const [rows] = await source.execute(
    `SELECT
       bpl.id AS budget_line_id,
       bpl.budget_proposal_id,
       ? AS finance_request_ref,
       bp.fiscal_year,
       COALESCE(NULLIF(TRIM(bpl.budget_head), ''), '') AS head,
       COALESCE(NULLIF(TRIM(bpl.sub_head), ''), '') AS sub_head,
       COALESCE(NULLIF(bpl.approved_line_total, 0), NULLIF(bpl.line_total, 0), 0) AS total_amount,
       bp.beneficiary_type,
       bp.beneficiary_value
     FROM budget_proposal_lines bpl
     JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
     WHERE bp.fiscal_year = ?
       AND (
         LOWER(TRIM(COALESCE(bp.status, ''))) IN ('completed', 'approved', 'principal_approved')
         OR LOWER(TRIM(COALESCE(bp.current_stage, ''))) = 'completed'
       )
       ${scopeSql}
     ORDER BY bpl.budget_head ASC, bpl.sub_head ASC, bpl.id ASC`,
    [normalizeText(scope.finance_request_ref), targetYear, ...scopeParams],
  );

  const usageByLineId = await getGlobalBudgetUsageByLine(
    connOrDb,
    rows.map((row) => row.budget_line_id),
    { excludeExpenditureId },
  );

  return (
    rows
      .map((row) => {
        const totalAmount = toMoney(row.total_amount);
        const usedAmount = toMoney(usageByLineId.get(toPositiveInt(row.budget_line_id)));
        return {
          budgetLineId: toPositiveInt(row.budget_line_id),
          budgetProposalId: toPositiveInt(row.budget_proposal_id),
          financeRequestRef: normalizeText(row.finance_request_ref),
          fiscalYear: Number(row.fiscal_year) || targetYear,
          head: normalizeText(row.head),
          subHead: normalizeText(row.sub_head),
          totalAmount,
          usedAmount,
          remainingAmount: toMoney(Math.max(0, totalAmount - usedAmount)),
          beneficiaryType: normalizeText(row.beneficiary_type),
          beneficiaryValue: normalizeText(row.beneficiary_value),
        };
      })
      .filter((row) => row.budgetLineId && row.head && row.subHead)
      // Restrict to the source card's head/sub combinations (carry-forward shows the
      // same card). If the source had no resolvable head/sub keys, fall back to the
      // full scoped list rather than hiding everything.
      .filter(
        (row) =>
          allowedHeadSubKeys.size === 0 ||
          allowedHeadSubKeys.has(
            `${normalizeText(row.head).toLowerCase()}::${normalizeText(row.subHead).toLowerCase()}`,
          ),
      )
  );
}

export async function getApprovedBudgets({
  userId,
  userEmail,
  financeRequestId,
  fiscalYear = null,
  allowAnyApprovedFinance = false,
  excludeExpenditureId = null,
} = {}) {
  const uid = toPositiveInt(userId);
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId || !uid) return [];

  const [[owner]] = await db.execute(
    `SELECT id, created_by
       FROM finance_requests
      WHERE id = ?
      LIMIT 1`,
    [financeId],
  );
  if (!owner) return [];
  if (!allowAnyApprovedFinance && toPositiveInt(owner.created_by) !== uid) return [];

  const carryForwardBudgets = await getApprovedCarryForwardFiscalYearBudgets({
    financeRequestId: financeId,
    fiscalYear,
  });
  if (carryForwardBudgets.length) {
    return carryForwardBudgets;
  }

  try {
    const [financeRows] = await db.execute(
      `SELECT
         fbb.id AS finance_budget_breakup_id,
         fbb.budget_line_id,
         COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)          AS budget_proposal_id,
         COALESCE(frr.request_ref, '')                                     AS finance_request_ref,
         bp.fiscal_year,
         COALESCE(NULLIF(TRIM(fbb.budget_head), ''), bpl.budget_head, '')  AS head,
         COALESCE(NULLIF(TRIM(fbb.sub_head), ''), bpl.sub_head, '')        AS sub_head,
         ${FINANCE_BREAKUP_APPROVED_BASE_SQL}                               AS total_amount,
         fr.beneficiary_type,
         fr.beneficiary_value
       FROM finance_budget_breakup fbb
       JOIN finance_requests fr ON fr.id = fbb.finance_id
       LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
       LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
       LEFT JOIN budget_proposals bp
         ON bp.id = COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)
       WHERE fbb.finance_id = ?
       ORDER BY fbb.sort_order ASC, fbb.id ASC`,
      [financeId],
    );

    const usageByBreakupId = await getFinanceRequestBudgetUsageByBreakup(db, {
      financeRequestId: financeId,
      budgetBreakups: financeRows,
      excludeExpenditureId,
    });

    return financeRows
      .map((r) => {
        const totalAmount = toMoney(r.total_amount);
        const usedAmount = toMoney(
          usageByBreakupId.get(toPositiveInt(r.finance_budget_breakup_id)),
        );
        const head = normalizeText(r.head);
        const subHead = normalizeText(r.sub_head);
        if (!head || !subHead || totalAmount <= 0) return null;

        return {
          budgetLineId: toPositiveInt(r.budget_line_id),
          budgetProposalId: toPositiveInt(r.budget_proposal_id),
          financeRequestRef: normalizeText(r.finance_request_ref),
          fiscalYear: Number(r.fiscal_year) || new Date().getFullYear(),
          head,
          subHead,
          totalAmount,
          usedAmount,
          remainingAmount: toMoney(Math.max(0, totalAmount - usedAmount)),
          beneficiaryType: normalizeText(r.beneficiary_type),
          beneficiaryValue: normalizeText(r.beneficiary_value),
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

// ─── Pre-advance summary ──────────────────────────────────────────────────────

/**
 * May this login read the cumulative advance total of this applicant?
 *
 * The advance-summary endpoint takes its applicant from the query string, and that total is a
 * money figure, so an arbitrary employee_id must not be honoured — otherwise any authenticated
 * user could probe any employee's advances. Entitled callers are:
 *
 *   - the applicant themselves (their login is `master_employees.user_id`);
 *   - a login that has already raised a finance or expenditure request FOR that applicant,
 *     which is the shared department-account case this whole rule exists for.
 *
 * Everyone else falls back to their own totals — see `getAdvanceSummary`. Workflow actors and
 * super admins are allowed by the caller, since they already see every claim.
 */
export async function canReadApplicantAdvanceTotals({ userId, employeeId } = {}) {
  const uid = toPositiveInt(userId);
  const empId = toPositiveInt(employeeId);
  if (!uid || !empId) return false;

  const [rows] = await db.execute(
    `SELECT 1
       FROM master_employees me
      WHERE me.id = ?
        AND (
          me.user_id = ?
          OR EXISTS (
            SELECT 1
              FROM finance_requests fr
             WHERE fr.employee_id = me.id
               AND fr.created_by = ?
          )
          OR EXISTS (
            SELECT 1
              FROM expenditure_requests er
             WHERE er.employee_id = me.id
               AND er.created_by = ?
          )
        )
      LIMIT 1`,
    [empId, uid, uid, uid],
  );

  return rows.length > 0;
}

/**
 * Total amount already advanced for a given applicant on a given budget line.
 * First-time → preAdvance = 0.
 *
 * Pass `employeeId` whenever the caller knows the applicant AND has authorized it via
 * `canReadApplicantAdvanceTotals`: it is the identity the total belongs to, and without it the
 * total covers only claims the calling login owns.
 */
export async function getAdvanceSummary({
  userId,
  employeeId = null,
  budgetLineId,
  head,
  subHead,
  budgetHeadId = null,
  budgetSubHeadId = null,
  financeRequestId = null,
  rowIndex = null,
  sourceRequestId = null,
  dashboardRowId = null,
  workflowRowRef = null,
} = {}) {
  // Resolve the catalog IDs the settlement validation resolves too, so the total the form
  // reads here and the total the submission is checked against come from the same matching.
  const resolvedIds =
    toPositiveInt(budgetHeadId) || toPositiveInt(budgetSubHeadId)
      ? {
          budget_head_id: toPositiveInt(budgetHeadId),
          budget_sub_head_id: toPositiveInt(budgetSubHeadId),
        }
      : await resolveCatalogIds(db, head, subHead);

  return getCumulativeAdvanceSummary(db, {
    userId,
    employeeId,
    budgetLineId,
    head,
    subHead,
    budgetHeadId: resolvedIds?.budget_head_id ?? null,
    budgetSubHeadId: resolvedIds?.budget_sub_head_id ?? null,
    financeRequestId,
    rowIndex,
    sourceRequestId,
    dashboardRowId,
    workflowRowRef,
  });
}

// ─── Payee master ─────────────────────────────────────────────────────────────

const PAYEE_SEARCHABLE_COLUMNS_SQL = `
  LOWER(CONCAT_WS(' ',
    COALESCE(ep.payee_name, ''),
    COALESCE(ep.account_name, ''),
    COALESCE(ep.account_no, ''),
    COALESCE(ep.bank_name, ''),
    COALESCE(ep.branch_name, ''),
    COALESCE(ep.ifsc, ''),
    COALESCE(ep.pan_number, ''),
    COALESCE(ep.beneficiary_type, ''),
    COALESCE(ep.beneficiary_org, ''),
    COALESCE(ep.beneficiary_category, ''),
    COALESCE(ep.organization_type, ''),
    COALESCE(ep.msme, ''),
    COALESCE(ep.gstin, ''),
    COALESCE(ep.tds_details, ''),
    COALESCE(ep.tds_section, '')
  ))
`;

// Mirrors normalizePayeeRecord() so the SQL tiles and the rendered badges can
// never disagree: blank status means pending unless the row was approved.
const PAYEE_STATUS_SQL = `
  LOWER(TRIM(COALESCE(
    NULLIF(TRIM(ep.approval_status), ''),
    CASE WHEN ep.approved_at IS NOT NULL THEN 'approved' ELSE 'pending' END
  )))
`;

const PAYEE_BENEFICIARY_TYPE_SQL = `
  LOWER(TRIM(COALESCE(NULLIF(TRIM(ep.beneficiary_type), ''), 'individual')))
`;

// Mirrors resolveCanonicalPayeeName(): a legacy row can carry the beneficiary
// org ('KSRCT'/'KSREI'/'External') in payee_name, and the screen then renders
// account_name instead. Now that paging is server-side, the sort has to follow
// the name that is actually rendered, or an alphabetical list breaks across
// page boundaries. CAST(... AS BINARY) keeps the match case-sensitive, as
// isBeneficiaryOrgValue() is.
const PAYEE_DISPLAY_NAME_SQL = `
  COALESCE(
    NULLIF(
      CASE
        WHEN CAST(TRIM(COALESCE(ep.payee_name, '')) AS BINARY)
             IN (${BENEFICIARY_ORG_OPTIONS.map((option) => `'${option}'`).join(', ')})
          THEN ''
        ELSE TRIM(COALESCE(ep.payee_name, ''))
      END,
      ''
    ),
    NULLIF(TRIM(COALESCE(ep.account_name, '')), ''),
    TRIM(COALESCE(ep.payee_name, '')),
    ''
  )
`;

const PAYEE_DIRECTORY_STATUSES = ['pending', 'approved', 'rejected'];
const PAYEE_DIRECTORY_BENEFICIARY_TYPES = ['individual', 'organization'];
const PAYEE_DIRECTORY_MAX_LIMIT = 100;

// A payee search is a literal substring match, so `%`, `_` and `\` typed into
// the box must not be read as LIKE syntax — without this, searching "50%"
// matches every payee and a trailing backslash escapes the closing wildcard.
const escapeLikeLiteral = (value) => value.replace(/[\\%_]/g, '\\$&');

const buildPayeeDirectoryFilters = ({ search, beneficiaryType }) => {
  const clauses = ['ep.is_active = 1'];
  const params = [];

  const normalizedBeneficiaryType = normalizeText(beneficiaryType).toLowerCase();
  if (PAYEE_DIRECTORY_BENEFICIARY_TYPES.includes(normalizedBeneficiaryType)) {
    clauses.push(`${PAYEE_BENEFICIARY_TYPE_SQL} = ?`);
    params.push(normalizedBeneficiaryType);
  }

  normalizeText(search)
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8)
    .forEach((term) => {
      clauses.push(`${PAYEE_SEARCHABLE_COLUMNS_SQL} LIKE ? ESCAPE '\\\\'`);
      params.push(`%${escapeLikeLiteral(term)}%`);
    });

  return { where: clauses.join('\n    AND '), params };
};

/**
 * Count of every active payee still awaiting approval, ignoring the directory's
 * search and beneficiary filters — the figure the "Payees" nav badge shows.
 */
async function countPendingPayees() {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS pending_count
       FROM expenditure_payees ep
      WHERE ep.is_active = 1
        AND ${PAYEE_STATUS_SQL} = 'pending'`,
    [],
  );
  return Number(row?.pending_count || 0);
}

/**
 * Paged reader for the payee management directory.
 *
 * Unlike listPayees() (a typeahead helper that returns a bare array), this
 * returns one page of rows plus server-side totals, so the screen never has to
 * hold the whole payee master in memory to know how many records exist.
 */
export async function listPayeeDirectory({
  search = '',
  status = 'all',
  beneficiaryType = 'all',
  limit = 20,
  offset = 0,
} = {}) {
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), PAYEE_DIRECTORY_MAX_LIMIT);
  const offsetNum = Math.max(Number(offset) || 0, 0);
  const normalizedStatus = normalizeText(status).toLowerCase();
  const statusFilter = PAYEE_DIRECTORY_STATUSES.includes(normalizedStatus) ? normalizedStatus : '';
  const { where, params } = buildPayeeDirectoryFilters({ search, beneficiaryType });

  // Status counts deliberately ignore the status filter so every tile keeps its
  // full value while one status is being browsed.
  const [[countRow]] = await db.execute(
    `SELECT
       COUNT(*) AS all_count,
       ${PAYEE_DIRECTORY_STATUSES.map(
         (value) =>
           `SUM(CASE WHEN ${PAYEE_STATUS_SQL} = '${value}' THEN 1 ELSE 0 END) AS ${value}_count`,
       ).join(',\n       ')}
     FROM expenditure_payees ep
     WHERE ${where}`,
    params,
  );

  const counts = {
    all: Number(countRow?.all_count || 0),
    pending: Number(countRow?.pending_count || 0),
    approved: Number(countRow?.approved_count || 0),
    rejected: Number(countRow?.rejected_count || 0),
  };
  const total = statusFilter ? counts[statusFilter] : counts.all;

  // counts.pending narrows with the search box, which is right for the tile but
  // wrong for the "Payees" nav badge — that has to keep saying how many payees
  // await approval in total, not how many the current query happens to show.
  const isFiltered = params.length > 0;
  const pendingTotal = isFiltered ? await countPendingPayees() : counts.pending;

  if (!total) {
    return { rows: [], total: 0, counts, pendingTotal, limit: limitNum, offset: offsetNum };
  }

  const [rows] = await db.execute(
    `SELECT ep.* FROM expenditure_payees ep
      WHERE ${where}
        ${statusFilter ? `AND ${PAYEE_STATUS_SQL} = ?` : ''}
      ORDER BY
        CASE WHEN ${PAYEE_STATUS_SQL} = 'pending' THEN 0 ELSE 1 END,
        ${PAYEE_DISPLAY_NAME_SQL} ASC,
        ep.id ASC
      LIMIT ${limitNum} OFFSET ${offsetNum}`,
    statusFilter ? [...params, statusFilter] : params,
  );

  return {
    rows: rows.map(normalizePayeeRecord),
    total,
    counts,
    pendingTotal,
    limit: limitNum,
    offset: offsetNum,
  };
}

export async function listPayees({ search = '', limit = 20, offset = 0, status = 'all' } = {}) {
  const q = normalizeText(search);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);
  const normalizedStatus = normalizeText(status).toLowerCase();
  const statusClause =
    normalizedStatus && normalizedStatus !== 'all'
      ? "AND LOWER(TRIM(COALESCE(ep.approval_status, 'approved'))) = ?"
      : '';
  const statusParams = statusClause ? [normalizedStatus] : [];
  const searchTerms = q
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const accountCompareSql = `
    REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(account_no, ''))), ' ', ''), '-', ''), '\t', '')
  `;
  const rowAccountCompareSql = `
    REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(epr.account_no, ''))), ' ', ''), '-', ''), '\t', '')
  `;
  const payeeSearchableColumns = PAYEE_SEARCHABLE_COLUMNS_SQL;
  const payeeRowSearchableColumns = `
    LOWER(CONCAT_WS(' ',
      COALESCE(epr.payee_name, ''),
      COALESCE(epr.account_name, ''),
      COALESCE(epr.account_no, ''),
      COALESCE(epr.bank_name, ''),
      COALESCE(epr.branch_name, ''),
      COALESCE(epr.ifsc, ''),
      COALESCE(epr.pan_number, ''),
      COALESCE(epr.beneficiary_type, ''),
      COALESCE(epr.beneficiary_org, ''),
      COALESCE(epr.organization_type, ''),
      COALESCE(epr.msme, ''),
      COALESCE(epr.gstin, ''),
      COALESCE(epr.tds_details, ''),
      COALESCE(epr.tds_section, '')
    ))
  `;

  if (searchTerms.length >= 2) {
    const ifscCandidate = searchTerms[searchTerms.length - 1].toUpperCase();
    const rawAccountCandidate = q.split(/\s+/).slice(0, -1).join(' ');
    const normalizedAccountCandidate = rawAccountCandidate.toLowerCase().replace(/[\s-]+/g, '');

    if (normalizedAccountCandidate && ifscCandidate) {
      const [exactPayees] = await db.execute(
        `SELECT
           id,
           payee_name,
           account_name,
           pan_number,
           account_no,
           account_type,
           bank_name,
           branch_name,
           UPPER(TRIM(COALESCE(ifsc, ''))) AS ifsc,
           beneficiary_type,
           beneficiary_org,
           beneficiary_category,
           organization_type,
           msme,
           gstin,
           tds_details,
           tds_section,
           is_active,
           created_at,
           updated_at
         FROM expenditure_payees
         WHERE is_active = 1
           ${statusClause ? "AND LOWER(TRIM(COALESCE(approval_status, 'approved'))) = ?" : ''}
           AND UPPER(TRIM(COALESCE(ifsc, ''))) = ?
           AND ${accountCompareSql} = ?
         ORDER BY updated_at DESC, id DESC
         LIMIT ${limitNum} OFFSET ${offsetNum}`,
        [...statusParams, ifscCandidate, normalizedAccountCandidate],
      );
      if (exactPayees.length) return exactPayees.map(normalizePayeeRecord);

      const [exactPayeeRows] = await db.execute(
        `SELECT
           ep.id,
           ep.id AS payee_id,
           COALESCE(NULLIF(TRIM(epr.payee_name), ''), ep.payee_name) AS payee_name,
           COALESCE(NULLIF(TRIM(epr.account_name), ''), ep.account_name) AS account_name,
           COALESCE(NULLIF(TRIM(epr.pan_number), ''), ep.pan_number) AS pan_number,
           COALESCE(NULLIF(TRIM(epr.account_no), ''), ep.account_no) AS account_no,
           COALESCE(NULLIF(TRIM(epr.account_type), ''), ep.account_type) AS account_type,
           COALESCE(NULLIF(TRIM(epr.bank_name), ''), ep.bank_name) AS bank_name,
           COALESCE(NULLIF(TRIM(epr.branch_name), ''), ep.branch_name) AS branch_name,
           UPPER(TRIM(COALESCE(NULLIF(TRIM(epr.ifsc), ''), ep.ifsc, ''))) AS ifsc,
           COALESCE(NULLIF(TRIM(epr.beneficiary_type), ''), ep.beneficiary_type) AS beneficiary_type,
           COALESCE(NULLIF(TRIM(epr.beneficiary_org), ''), ep.beneficiary_org) AS beneficiary_org,
           ep.beneficiary_category,
           COALESCE(NULLIF(TRIM(epr.organization_type), ''), ep.organization_type) AS organization_type,
           COALESCE(NULLIF(TRIM(epr.msme), ''), ep.msme) AS msme,
           COALESCE(NULLIF(TRIM(epr.gstin), ''), ep.gstin) AS gstin,
           COALESCE(NULLIF(TRIM(epr.tds_details), ''), ep.tds_details) AS tds_details,
           COALESCE(NULLIF(TRIM(epr.tds_section), ''), ep.tds_section) AS tds_section,
           ep.is_active,
           ep.approval_status,
           ep.rejection_reason,
           ep.requested_at,
           ep.approved_at,
           ep.created_at,
           ep.updated_at
         FROM expenditure_payee_rows epr
         INNER JOIN expenditure_payees ep
                 ON ep.id = epr.payee_id
                AND ep.is_active = 1
                ${statusClause ? "AND LOWER(TRIM(COALESCE(ep.approval_status, 'approved'))) = ?" : ''}
         INNER JOIN (
           SELECT MAX(id) AS id
             FROM expenditure_payee_rows
            WHERE NULLIF(TRIM(account_no), '') IS NOT NULL
              AND NULLIF(TRIM(ifsc), '') IS NOT NULL
            GROUP BY
              REPLACE(REPLACE(REPLACE(LOWER(TRIM(account_no)), ' ', ''), '-', ''), '\t', ''),
              UPPER(TRIM(ifsc))
         ) latest ON latest.id = epr.id
         WHERE UPPER(TRIM(COALESCE(epr.ifsc, ''))) = ?
           AND ${rowAccountCompareSql} = ?
         ORDER BY epr.updated_at DESC, epr.id DESC
         LIMIT ${limitNum} OFFSET ${offsetNum}`,
        [...statusParams, ifscCandidate, normalizedAccountCandidate],
      );
      if (exactPayeeRows.length) return exactPayeeRows.map(normalizePayeeRecord);
    }
  }

  const payeeTermClauses = searchTerms.length
    ? searchTerms.map(() => `${payeeSearchableColumns} LIKE ?`).join(' AND ')
    : '1 = 1';

  const [rows] = await db.execute(
    `SELECT * FROM expenditure_payees ep
      WHERE ep.is_active = 1
        ${statusClause}
        AND ${payeeTermClauses}
      ORDER BY ep.payee_name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`,
    [...statusParams, ...searchTerms.map((term) => `%${term}%`)],
  );

  if (rows.length) return rows.map(normalizePayeeRecord);

  const termClauses = searchTerms.length
    ? searchTerms.map(() => `${payeeRowSearchableColumns} LIKE ?`).join(' AND ')
    : '1 = 1';

  const [payeeRowResults] = await db.execute(
    `SELECT
       ep.id,
       ep.id AS payee_id,
       COALESCE(NULLIF(TRIM(epr.payee_name), ''), ep.payee_name) AS payee_name,
       COALESCE(NULLIF(TRIM(epr.account_name), ''), ep.account_name) AS account_name,
       COALESCE(NULLIF(TRIM(epr.pan_number), ''), ep.pan_number) AS pan_number,
       COALESCE(NULLIF(TRIM(epr.account_no), ''), ep.account_no) AS account_no,
       COALESCE(NULLIF(TRIM(epr.account_type), ''), ep.account_type) AS account_type,
       COALESCE(NULLIF(TRIM(epr.bank_name), ''), ep.bank_name) AS bank_name,
       COALESCE(NULLIF(TRIM(epr.branch_name), ''), ep.branch_name) AS branch_name,
       UPPER(TRIM(COALESCE(NULLIF(TRIM(epr.ifsc), ''), ep.ifsc, ''))) AS ifsc,
       COALESCE(NULLIF(TRIM(epr.beneficiary_type), ''), ep.beneficiary_type) AS beneficiary_type,
       COALESCE(NULLIF(TRIM(epr.beneficiary_org), ''), ep.beneficiary_org) AS beneficiary_org,
       ep.beneficiary_category,
       COALESCE(NULLIF(TRIM(epr.organization_type), ''), ep.organization_type) AS organization_type,
       COALESCE(NULLIF(TRIM(epr.msme), ''), ep.msme) AS msme,
       COALESCE(NULLIF(TRIM(epr.gstin), ''), ep.gstin) AS gstin,
       COALESCE(NULLIF(TRIM(epr.tds_details), ''), ep.tds_details) AS tds_details,
       COALESCE(NULLIF(TRIM(epr.tds_section), ''), ep.tds_section) AS tds_section,
       ep.is_active,
       ep.approval_status,
       ep.rejection_reason,
       ep.requested_at,
       ep.approved_at,
       ep.created_at,
       ep.updated_at
     FROM expenditure_payee_rows epr
     INNER JOIN expenditure_payees ep
             ON ep.id = epr.payee_id
            AND ep.is_active = 1
            ${statusClause ? "AND LOWER(TRIM(COALESCE(ep.approval_status, 'approved'))) = ?" : ''}
     INNER JOIN (
       SELECT MAX(id) AS id
         FROM expenditure_payee_rows
        WHERE COALESCE(NULLIF(TRIM(payee_name), ''), NULLIF(TRIM(account_no), ''), NULLIF(TRIM(ifsc), '')) IS NOT NULL
        GROUP BY
          CASE
            WHEN NULLIF(TRIM(account_no), '') IS NOT NULL THEN LOWER(TRIM(account_no))
            ELSE CONCAT('__payee_row__', id)
          END,
          CASE
            WHEN NULLIF(TRIM(ifsc), '') IS NOT NULL THEN UPPER(TRIM(ifsc))
            ELSE CONCAT('__payee_row__', id)
          END
     ) latest ON latest.id = epr.id
     WHERE ${termClauses}
     ORDER BY epr.updated_at DESC, epr.id DESC
     LIMIT ${limitNum} OFFSET ${offsetNum}`,
    [...statusParams, ...searchTerms.map((term) => `%${term}%`)],
  );

  return payeeRowResults.map(normalizePayeeRecord);
}

export async function getPayeeById(id) {
  const [rows] = await db.execute('SELECT * FROM expenditure_payees WHERE id = ? LIMIT 1', [id]);
  return normalizePayeeRecord(rows[0] || null);
}

export async function updatePayeeById(id, payeeData = {}) {
  const payeeId = toPositiveInt(id);
  if (!payeeId) throw new Error('Invalid payee ID');

  const canonicalPayeeName = resolveCanonicalPayeeName(
    payeeData.payee_name,
    payeeData.account_name,
  );
  const accountNo = normalizeText(payeeData.account_no);
  const ifsc = normalizeText(payeeData.ifsc).toUpperCase();
  const bankName = normalizeText(payeeData.bank_name);
  const branchName = normalizeText(payeeData.branch_name);
  const beneficiaryType =
    normalizeText(payeeData.beneficiary_type).toLowerCase() === 'organization'
      ? 'organization'
      : 'individual';
  const beneficiaryOrgRaw = resolveCanonicalBeneficiaryOrg(
    payeeData.beneficiary_org,
    payeeData.payee_name,
  );
  const beneficiaryOrg = BENEFICIARY_ORG_OPTIONS.includes(beneficiaryOrgRaw)
    ? beneficiaryOrgRaw
    : null;
  const accountType = normalizeAccountType(payeeData.account_type);
  const categoryApplies = beneficiaryCategoryApplies(beneficiaryType, beneficiaryOrg);
  const beneficiaryCategory = categoryApplies
    ? normalizeBeneficiaryCategory(payeeData.beneficiary_category)
    : '';
  const gstin = sanitizeAlphaNumericUpper(payeeData.gstin, 15);
  const panNumber = sanitizeAlphaNumericUpper(
    payeeData.pan_number || extractPanFromGstin(gstin),
    10,
  );

  if (!canonicalPayeeName || !accountNo || !ifsc || !bankName || !branchName) {
    throw new Error('payee_name, account_no, ifsc, bank_name and branch_name are required');
  }
  if (!beneficiaryOrg) throw new Error('beneficiary_org is required');
  if (!accountType) throw new Error('account_type must be Savings or Current');
  // Unlike upsertPayee, this path is only ever reached from a payee form, so
  // an internal individual arriving without a category is an incomplete edit
  // rather than an unrelated save that should leave the stored one alone.
  if (categoryApplies && !beneficiaryCategory) {
    throw new Error('beneficiary_category must be Student, Faculty or Staff');
  }

  const [existingRows] = await db.execute(
    'SELECT id FROM expenditure_payees WHERE id = ? AND is_active = 1 LIMIT 1',
    [payeeId],
  );

  if (!existingRows.length) {
    return false;
  }

  const [result] = await db.execute(
    `UPDATE expenditure_payees
        SET payee_name = ?,
            account_name = ?,
            pan_number = ?,
            account_no = ?,
            account_type = ?,
            ifsc = ?,
            bank_name = ?,
            branch_name = ?,
            beneficiary_type = ?,
            beneficiary_org = ?,
            beneficiary_category = ?,
            organization_type = ?,
            msme = ?,
            gstin = ?,
            tds_details = ?,
            tds_section = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND is_active = 1`,
    [
      canonicalPayeeName,
      canonicalPayeeName || null,
      panNumber || null,
      accountNo,
      accountType,
      ifsc,
      bankName,
      branchName,
      beneficiaryType,
      beneficiaryOrg,
      beneficiaryCategory || null,
      normalizeText(payeeData.organization_type) || null,
      normalizeText(payeeData.msme) || null,
      beneficiaryType === 'organization' ? gstin || null : null,
      normalizeText(payeeData.tds_details) || null,
      normalizeText(payeeData.tds_section) || null,
      payeeId,
    ],
  );

  return result.affectedRows >= 0;
}

export async function updatePayeeApproval(
  id,
  { decision, rejectionReason = '', userId = null } = {},
) {
  const payeeId = toPositiveInt(id);
  const normalizedDecision = normalizeText(decision).toLowerCase();
  if (!payeeId) throw new Error('Invalid payee ID');
  if (!['approved', 'rejected'].includes(normalizedDecision)) {
    throw new Error('Unsupported payee approval decision');
  }
  if (normalizedDecision === 'rejected' && !normalizeText(rejectionReason)) {
    throw new Error('Rejection reason is required');
  }

  const [result] = await db.execute(
    `UPDATE expenditure_payees
        SET approval_status = ?,
            approved_by = ?,
            approved_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END,
            rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND is_active = 1`,
    [
      normalizedDecision,
      toPositiveInt(userId),
      normalizedDecision,
      normalizedDecision,
      normalizeText(rejectionReason) || null,
      payeeId,
    ],
  );

  return result.affectedRows > 0;
}

export async function deletePayeeById(id) {
  const payeeId = toPositiveInt(id);
  if (!payeeId) throw new Error('Invalid payee ID');

  const [result] = await db.execute(
    `UPDATE expenditure_payees
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND is_active = 1`,
    [payeeId],
  );

  return result.affectedRows > 0;
}

export async function getExpenditureDashboard({ userId, fiscalYear } = {}) {
  const uid = toPositiveInt(userId);
  if (!uid) {
    return { cards: [], requests: [] };
  }

  const fyStart = toPositiveInt(fiscalYear);
  // Two bind values each: the owner predicate matches creator OR applicant. See
  // shared/financeOwnership.js — a card submitted by a shared department login has to reach
  // the applicant it was raised for.
  const financeParams = buildFinanceOwnerParams(uid);
  const expenditureParams = buildFinanceOwnerParams(uid);
  let financeFySql = '';
  let requestFinanceFySql = '';

  const buildDashboardFinanceFySql = (financeAlias) => ` AND (
      COALESCE(
        (
          SELECT MIN(bp_card.fiscal_year)
            FROM finance_budget_breakup fbb_card
            JOIN budget_proposals bp_card ON bp_card.id = fbb_card.budget_proposal_id
           WHERE fbb_card.finance_id = ${financeAlias}.id
        ),
        YEAR(COALESCE(${financeAlias}.request_date, ${financeAlias}.created_at))
          - (MONTH(COALESCE(${financeAlias}.request_date, ${financeAlias}.created_at)) < 4)
      ) = ?
      OR EXISTS (
        SELECT 1
          FROM finance_carry_forward_allocations cf_card
         WHERE cf_card.finance_request_id = ${financeAlias}.id
           AND cf_card.target_fiscal_year = ?
           AND LOWER(TRIM(cf_card.status)) = 'active'
      )
    )`;
  // A card belongs to its BUDGET fiscal year (or carry-forward target year), NOT
  // the year an advance/settlement was entered. Matching by expenditure request
  // date pulled cards into the next FY before any carry-forward — removed so a card
  // only appears in the target FY once it has actually been carried forward.

  if (fyStart) {
    financeFySql = buildDashboardFinanceFySql('fr');
    requestFinanceFySql = buildDashboardFinanceFySql('fr_req');
    financeParams.push(fyStart, fyStart);
    expenditureParams.push(fyStart, fyStart);
  }

  // FALLBACK: finance_requests.closed_at may not exist before the
  // 20260710_add_closed_status_to_finance_requests migration runs; emit NULL so
  // the dashboard treats every card as not-closed. Remove after the migration is
  // applied everywhere.
  const hasClosedAtColumn = await hasFinanceRequestColumn('closed_at');
  const closedAtSelectSql = hasClosedAtColumn ? 'fr.closed_at' : 'NULL AS closed_at';

  const [cardRows] = await db.execute(
    `SELECT
       fr.id AS finance_request_id,
       ${closedAtSelectSql},
       COALESCE(frr.request_ref, CONCAT('#F-', fr.id)) AS request_ref,
       COALESCE(
         NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
         NULLIF(TRIM(fr.applicant_name), ''),
         'Unknown Applicant'
       ) AS applicant_name,
       COALESCE(NULLIF(TRIM(emp.designation), ''), NULLIF(TRIM(fr.designation), ''), '') AS designation,
       COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(fr.department), ''), '') AS department,
       COALESCE(NULLIF(TRIM(fr.beneficiary_value), ''), NULLIF(TRIM(fr.beneficiary_type), ''), 'Finance') AS beneficiary_name,
       COALESCE(
         NULLIF(TRIM(fr.budget_tag), ''),
         NULLIF(TRIM(fr.event_sub_head), ''),
         NULLIF(TRIM(fr.primary_head), ''),
         ''
       ) AS finance_tag,
       COALESCE(
         NULLIF(fr.approved_total_amount, 0),
         NULLIF(fr.total_budget, 0),
         NULLIF(fr.proposed_amount, 0),
         0
       ) AS approved_amount,
       COALESCE(
         (
           SELECT MIN(bp_card_label.fiscal_year)
             FROM finance_budget_breakup fbb_card_label
             JOIN budget_proposals bp_card_label ON bp_card_label.id = fbb_card_label.budget_proposal_id
            WHERE fbb_card_label.finance_id = fr.id
         ),
         YEAR(COALESCE(fr.request_date, fr.created_at))
           - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
       ) AS source_fiscal_year,
       (
         SELECT GROUP_CONCAT(DISTINCT cf_card_targets.target_fiscal_year ORDER BY cf_card_targets.target_fiscal_year ASC)
           FROM finance_carry_forward_allocations cf_card_targets
          WHERE cf_card_targets.finance_request_id = fr.id
            AND LOWER(TRIM(cf_card_targets.status)) = 'active'
       ) AS carry_forward_target_years,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Advance'
             AND ${buildClaimedExpenditureStatusCondition('er')}
           THEN COALESCE(er.advance_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS advance_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Expenditure'
             AND ${buildClaimedExpenditureStatusCondition('er')}
           THEN COALESCE(er.expenditure_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS expenditure_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Settlement'
             AND ${buildClaimedExpenditureStatusCondition('er')}
           THEN COALESCE(er.settlement_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS settlement_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Settlement'
             AND ${buildClaimedExpenditureStatusCondition('er')}
           THEN ${buildSettledAdvanceExpr('er')}
           ELSE 0
         END
       ), 0) AS settled_advance_amount,
       -- Counted over the same requests the amounts above are summed over. A bare
       -- COUNT(DISTINCT er.id) also counted deleted and rejected requests, so a card could
       -- report requests raised against it while every amount beside the count read zero.
       COUNT(DISTINCT
         CASE WHEN ${buildClaimedExpenditureStatusCondition('er')} THEN er.id END
       ) AS expenditure_request_count
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     LEFT JOIN master_employees emp ON emp.id = fr.employee_id
     LEFT JOIN master_departments dept ON dept.id = emp.department_id
     LEFT JOIN expenditure_requests er ON er.finance_request_id = fr.id
     WHERE ${buildFinanceOwnerCondition('fr')}
       AND (
         LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
         OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
         OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
       )
       ${financeFySql}
     GROUP BY
       fr.id,
       closed_at,
       frr.request_ref,
       applicant_name,
       designation,
       department,
       approved_amount,
       source_fiscal_year,
       carry_forward_target_years
     ORDER BY fr.request_date DESC, fr.id DESC`,
    financeParams,
  );

  const [requestRows] = await db.execute(
    `SELECT
       er.id,
       er.finance_request_id AS finance_id,
       COALESCE(frr.request_ref, CONCAT('#F-', er.finance_request_id)) AS proposal_ref,
       COALESCE(err.request_ref, '') AS request_ref,
       COALESCE(
           NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
           NULLIF(TRIM(er.applicant_name), ''),
           'Unknown Applicant'
         ) AS applicant_name,
       COALESCE(NULLIF(TRIM(er.beneficiary_type), ''), 'Unknown') AS beneficiary_type,
       COALESCE(NULLIF(TRIM(er.primary_head), ''), 'Not specified') AS primary_head,
       COALESCE(NULLIF(TRIM(sample_row.sub_head), ''), '') AS sub_head,
	       er.request_type,
	       er.workflow_state,
	       er.payment_status,
	       COALESCE(er.total_amount, 0) AS amount,
       LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) AS overall_status,
         er.created_at
       FROM expenditure_requests er
       JOIN finance_requests fr_req ON fr_req.id = er.finance_request_id
       LEFT JOIN master_employees emp ON emp.id = er.employee_id
       LEFT JOIN finance_request_refs frr ON frr.finance_request_id = er.finance_request_id
       LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
       LEFT JOIN (
         SELECT
           ranked.expenditure_id,
           ranked.sub_head
         FROM (
           SELECT
             all_rows.expenditure_id,
             all_rows.sub_head,
             ROW_NUMBER() OVER (
               PARTITION BY all_rows.expenditure_id
               ORDER BY all_rows.sort_order ASC, all_rows.id ASC
             ) AS rn
           FROM (
             SELECT
               ar.expenditure_id,
               ${collateBudgetText('ar.sub_head')} AS sub_head,
               ar.sort_order,
               ar.id
             FROM expenditure_advance_rows ar
             UNION ALL
             SELECT
               sr.expenditure_id,
               ${collateBudgetText('sr.sub_head')} AS sub_head,
               sr.sort_order,
               sr.id
             FROM expenditure_settlement_rows sr
             UNION ALL
             SELECT
               lr.expenditure_id,
               ${collateBudgetText('lr.sub_head')} AS sub_head,
               lr.sort_order,
               lr.id
             FROM expenditure_line_rows lr
           ) all_rows
         ) ranked
         WHERE ranked.rn = 1
       ) sample_row ON sample_row.expenditure_id = er.id
       WHERE ${buildFinanceOwnerCondition('er')}
       AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
       AND (
         LOWER(TRIM(COALESCE(fr_req.overall_status, ''))) = 'approved'
         OR LOWER(TRIM(COALESCE(fr_req.workflow_status, ''))) IN ('approved', 'completed')
         OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr_req.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
       )
       ${requestFinanceFySql}
     ORDER BY er.created_at DESC, er.id DESC`,
    expenditureParams,
  );

  return {
    cards: cardRows.map((row) => {
      const approvedAmount = toMoney(row.approved_amount);
      const advanceAmount = toMoney(row.advance_amount);
      const settlementAmount = toMoney(row.settlement_amount);
      const expenditureAmount = toMoney(row.expenditure_amount);
      const effectiveUsageAmount = resolveAdvanceUsageAmount({
        advanceAmount,
        settlementAmount,
        settledAdvanceAmount: row.settled_advance_amount,
      });
      const sourceFiscalYear = toPositiveInt(row.source_fiscal_year);
      return {
        finance_request_id: toPositiveInt(row.finance_request_id),
        request_ref: normalizeText(row.request_ref),
        applicant_name: normalizeText(row.applicant_name),
        designation: normalizeText(row.designation),
        department: normalizeText(row.department),
        beneficiary_name: normalizeText(row.beneficiary_name),
        finance_tag: normalizeText(row.finance_tag),
        approved_amount: approvedAmount,
        source_fiscal_year: sourceFiscalYear,
        carry_forward_target_years: normalizeText(row.carry_forward_target_years),
        advance_amount: advanceAmount,
        expenditure_amount: expenditureAmount,
        settlement_amount: settlementAmount,
        balance_amount: Math.max(0, approvedAmount - effectiveUsageAmount - expenditureAmount),
        expenditure_request_count: Number(row.expenditure_request_count || 0),
        closed_at: row.closed_at ?? null,
      };
    }),
    requests: requestRows.map((row) => ({
      id: toPositiveInt(row.id),
      finance_id: toPositiveInt(row.finance_id),
      proposal_ref: normalizeText(row.proposal_ref),
      request_ref: normalizeText(row.request_ref),
      applicant_name: normalizeText(row.applicant_name),
      beneficiary_type: normalizeText(row.beneficiary_type),
      primary_head: normalizeText(row.primary_head),
      sub_head: normalizeText(row.sub_head),
      request_type: normalizeText(row.request_type),
      workflow_state: row.workflow_state,
      payment_status: normalizeText(row.payment_status),
      amount: toMoney(row.amount),
      overall_status: normalizeText(row.overall_status) || 'pending',
      created_at: row.created_at,
    })),
  };
}

export async function getFinanceRequestContext(financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const hasBudgetTag = await hasFinanceRequestColumn('budget_tag');
  const budgetTagSql = hasBudgetTag ? 'fr.budget_tag,' : 'NULL AS budget_tag,';
  const hasPaymentDebitAccount = await hasFinanceRequestColumn('payment_debit_account');
  const paymentDebitAccountSql = hasPaymentDebitAccount
    ? 'fr.payment_debit_account,'
    : 'NULL AS payment_debit_account,';
  const hasUnplannedBudgetEnabled = await hasFinanceRequestColumn('unplanned_budget_enabled');
  const unplannedBudgetEnabledSql = hasUnplannedBudgetEnabled
    ? 'fr.unplanned_budget_enabled,'
    : 'NULL AS unplanned_budget_enabled,';
  const hasUnplannedBudgetAmount = await hasFinanceRequestColumn('unplanned_budget_amount');
  const unplannedBudgetAmountSql = hasUnplannedBudgetAmount
    ? 'fr.unplanned_budget_amount,'
    : 'NULL AS unplanned_budget_amount,';
  const hasUnplannedBudgetDescription = await hasFinanceRequestColumn(
    'unplanned_budget_description',
  );
  const unplannedBudgetDescriptionSql = hasUnplannedBudgetDescription
    ? 'fr.unplanned_budget_description,'
    : 'NULL AS unplanned_budget_description,';

  const [rows] = await db.query(
    `SELECT
       fr.id AS finance_request_id,
       fr.created_by,
       fr.employee_id,
       emp.user_id AS applicant_user_id,
       COALESCE(frr.request_ref, CONCAT('#F-', fr.id)) AS request_ref,
       COALESCE(
         NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
         NULLIF(TRIM(fr.applicant_name), ''),
         'Unknown Applicant'
       ) AS applicant_name,
       COALESCE(NULLIF(TRIM(emp.designation), ''), NULLIF(TRIM(fr.designation), ''), '') AS designation,
       COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(fr.department), ''), '') AS department,
       COALESCE(NULLIF(TRIM(emp.email), ''), NULLIF(TRIM(fr.email), ''), '') AS email,
       COALESCE(NULLIF(TRIM(emp.mobile), ''), NULLIF(TRIM(fr.mobile), ''), '') AS mobile,
       fr.request_date,
       fr.description,
       fr.beneficiary_type,
       fr.beneficiary_value,
       fr.primary_head,
       fr.event_sub_head,
       ${budgetTagSql}
       ${paymentDebitAccountSql}
       ${unplannedBudgetEnabledSql}
       ${unplannedBudgetAmountSql}
       ${unplannedBudgetDescriptionSql}
       COALESCE(
         NULLIF(fr.approved_total_amount, 0),
         NULLIF(fr.total_budget, 0),
         NULLIF(fr.proposed_amount, 0),
         0
       ) AS approved_amount
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     LEFT JOIN master_employees emp ON emp.id = fr.employee_id
     LEFT JOIN master_departments dept ON dept.id = emp.department_id
       WHERE fr.id = ?
        AND (
          LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
          OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
          OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
        )
       LIMIT 1`,
    [financeId],
  );

  const row = rows[0];
  if (!row) return null;

  const financeAnnexures = await getFinanceAnnexuresForExpenditure(financeId);

  return {
    finance_request_id: toPositiveInt(row.finance_request_id),
    created_by: toPositiveInt(row.created_by),
    employee_id: toPositiveInt(row.employee_id),
    // Consumed by the controller's owner check, so an applicant can open a card a shared
    // department login submitted for them.
    applicant_user_id: toPositiveInt(row.applicant_user_id) || null,
    request_ref: normalizeText(row.request_ref),
    applicant_name: normalizeText(row.applicant_name),
    designation: normalizeText(row.designation),
    department: normalizeText(row.department),
    email: normalizeText(row.email),
    mobile: normalizeText(row.mobile),
    request_date: row.request_date,
    description: normalizeText(row.description),
    beneficiary_type: normalizeText(row.beneficiary_type),
    beneficiary_value: normalizeText(row.beneficiary_value),
    primary_head: normalizeText(row.primary_head),
    event_sub_head: normalizeText(row.event_sub_head),
    approved_amount: toMoney(row.approved_amount),
    budget_tag: row.budget_tag ? normalizeText(row.budget_tag) : null,
    payment_debit_account: normalizeText(row.payment_debit_account) || null,
    unplanned_budget_enabled: Boolean(row.unplanned_budget_enabled),
    unplanned_budget_amount: toMoney(row.unplanned_budget_amount),
    unplanned_budget_description: normalizeText(row.unplanned_budget_description) || null,
    finance_annexures: financeAnnexures.map((annexure) => ({
      id: annexure.id,
      annexure_type: annexure.annexure_type,
      original_name: annexure.original_name,
      file_path: annexure.file_path,
      file_url: annexure.file_path,
      mime_type: annexure.mime_type,
      file_size: annexure.file_size,
    })),
  };
}

/**
 * Upsert a payee. Unique key: (account_no, ifsc).
 * Returns the payee id (existing or new).
 */
export async function upsertPayee(payeeData, userId, conn = db) {
  const accountNo = normalizeText(payeeData.account_no);
  const ifsc = normalizeText(payeeData.ifsc).toUpperCase();
  const canonicalPayeeName = resolveCanonicalPayeeName(
    payeeData.payee_name,
    payeeData.account_name,
  );
  const beneficiaryType =
    normalizeText(payeeData.beneficiary_type).toLowerCase() === 'organization'
      ? 'organization'
      : 'individual';
  const beneficiaryOrgRaw = resolveCanonicalBeneficiaryOrg(
    payeeData.beneficiary_org,
    payeeData.payee_name,
  );
  const beneficiaryOrg = BENEFICIARY_ORG_OPTIONS.includes(beneficiaryOrgRaw)
    ? beneficiaryOrgRaw
    : null;
  const accountType = normalizeAccountType(payeeData.account_type);
  const categoryApplies = beneficiaryCategoryApplies(beneficiaryType, beneficiaryOrg);
  const beneficiaryCategory = categoryApplies
    ? normalizeBeneficiaryCategory(payeeData.beneficiary_category)
    : '';
  const gstin = sanitizeAlphaNumericUpper(payeeData.gstin, 15);
  const panNumber = sanitizeAlphaNumericUpper(
    payeeData.pan_number || extractPanFromGstin(gstin),
    10,
  );
  if (!accountNo || !ifsc) throw new Error('account_no and ifsc are required');
  if (!beneficiaryOrg) throw new Error('beneficiary_org is required');
  if (!accountType) throw new Error('account_type must be Savings or Current');

  const findExisting = async () => {
    const [rows] = await conn.execute(
      'SELECT id FROM expenditure_payees WHERE account_no = ? AND ifsc = ? LIMIT 1',
      [accountNo, ifsc],
    );
    return rows.length ? toPositiveInt(rows[0].id) : null;
  };

  const updateExisting = (payeeId) =>
    conn.execute(
      `UPDATE expenditure_payees
          SET payee_name   = COALESCE(?, payee_name),
              account_name = COALESCE(?, account_name),
              pan_number   = COALESCE(?, pan_number),
              account_type = COALESCE(?, account_type),
              bank_name    = COALESCE(?, bank_name),
              branch_name  = COALESCE(?, branch_name),
              beneficiary_type = COALESCE(?, beneficiary_type),
              beneficiary_org  = COALESCE(?, beneficiary_org),
              -- Cleared outright once the payee is External or an
              -- organization, so a category picked under a previous
              -- beneficiary cannot linger. While it still applies, a save
              -- that carries no category (an expenditure request reusing
              -- these bank details) leaves the stored one alone.
              beneficiary_category = IF(?, COALESCE(?, beneficiary_category), NULL),
              organization_type = COALESCE(?, organization_type),
              msme         = COALESCE(?, msme),
              gstin        = COALESCE(?, gstin),
              tds_details  = COALESCE(?, tds_details),
              tds_section  = COALESCE(?, tds_section),
              approval_status = 'pending',
              approved_by   = NULL,
              approved_at   = NULL,
              rejection_reason = NULL,
              requested_at  = CURRENT_TIMESTAMP,
              is_active    = 1,
              updated_at   = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        canonicalPayeeName || null,
        canonicalPayeeName || null,
        panNumber || null,
        accountType,
        payeeData.bank_name || null,
        payeeData.branch_name || null,
        beneficiaryType,
        beneficiaryOrg,
        categoryApplies ? 1 : 0,
        beneficiaryCategory || null,
        payeeData.organization_type || null,
        payeeData.msme || null,
        beneficiaryType === 'organization' ? gstin || null : null,
        payeeData.tds_details || null,
        payeeData.tds_section || null,
        payeeId,
      ],
    );

  const existingId = await findExisting();
  if (existingId) {
    await updateExisting(existingId);
    return existingId;
  }

  try {
    const [result] = await conn.execute(
      `INSERT INTO expenditure_payees
         (payee_name, account_name, account_no, account_type,
          bank_name, branch_name, ifsc, beneficiary_type,
          beneficiary_org, beneficiary_category, organization_type, msme,
          pan_number, gstin, tds_details, tds_section,
          approval_status, requested_at, approved_by, approved_at, rejection_reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, NULL, NULL, NULL, ?)`,
      [
        canonicalPayeeName,
        canonicalPayeeName || null,
        accountNo,
        accountType,
        normalizeText(payeeData.bank_name),
        normalizeText(payeeData.branch_name || ''),
        ifsc,
        beneficiaryType,
        beneficiaryOrg,
        beneficiaryCategory || null,
        payeeData.organization_type || null,
        payeeData.msme || null,
        panNumber || null,
        beneficiaryType === 'organization' ? gstin || null : null,
        payeeData.tds_details || null,
        payeeData.tds_section || null,
        userId || null,
      ],
    );
    return result.insertId;
  } catch (err) {
    if (err?.code !== 'ER_DUP_ENTRY') throw err;
    // The lookup above and this insert are not atomic, so two saves for the
    // same (account_no, ifsc) — a double-clicked Save, or two users entering
    // the same bank details — can both miss and then both insert. The row is
    // there now, so treat the loser as the update path instead of a 500.
    const racedId = await findExisting();
    if (!racedId) throw err;
    await updateExisting(racedId);
    return racedId;
  }
}

// ─── Core SELECT for expenditure_requests ────────────────────────────────────

const EXPENDITURE_SELECT_TEMPLATE = `
  SELECT
    er.id,
    COALESCE(err.request_ref, CONCAT('#EX-', er.id)) AS request_ref,
    er.finance_request_id,
    er.employee_id,
    er.created_by,
    er.request_type,
    er.request_date,
    er.description,
    er.beneficiary_type,
    er.beneficiary_value,
    er.budget_tag,
    er.primary_head,
    er.event_sub_head,
    er.is_budget_proposed,
    er.unplanned_budget_enabled,
    er.unplanned_budget_amount,
__OPTIONAL_UNPLANNED_HEAD_COLUMNS__
    er.unplanned_budget_head,
    er.unplanned_budget_sub_head,
    er.unplanned_budget_description,
    er.advance_total_amount,
    er.settlement_total_amount,
    er.expenditure_total_amount,
    er.settlement_remarks,
    er.expenditure_remarks,
    er.tentative_settlement_date,
    er.total_amount,
    CASE
      WHEN LOWER(TRIM(COALESCE(er.overall_status, ''))) IN ('approved', 'completed')
        THEN COALESCE(NULLIF(er.approved_total_amount, 0), NULLIF(er.total_amount, 0), 0)
      ELSE COALESCE(er.approved_total_amount, 0)
    END AS approved_total_amount,
    er.debit_status,
    er.payment_debit_account,
    er.payment_mode,
    er.payment_ref_no,
    er.payment_date,
    er.payment_status,
    er.overall_status,
    er.workflow_state,
    er.workflow_status,
    er.workflow_stage,
    er.created_at,
    er.updated_at,
    sample_row.budget_line_id,
    sample_row.budget_proposal_id,
    sample_row.budget_head AS head,
    sample_row.sub_head,
    sample_payee.payee_id,
    sample_payee.payee_name,
    sample_payee.account_no,
    sample_payee.ifsc,
    sample_payee.bank_name,
    sample_payee.branch_name,
    sample_payee.account_name,
    sample_payee.account_type,
    COALESCE(
      NULLIF(TRIM(CONCAT(
        COALESCE(e.title,''),' ',
        COALESCE(e.first_name,''),' ',
        COALESCE(e.last_name,'')
      )), ''),
      NULLIF(TRIM(er.applicant_name), ''),
      ''
    ) AS applicant_name,
    COALESCE(NULLIF(TRIM(e.designation), ''), NULLIF(TRIM(er.designation), ''), '') AS designation,
    COALESCE(NULLIF(TRIM(d.name), ''), NULLIF(TRIM(er.department), ''), '') AS department,
    COALESCE(NULLIF(TRIM(e.email), ''), NULLIF(TRIM(er.email), ''), '') AS email,
    COALESCE(NULLIF(TRIM(e.mobile), ''), NULLIF(TRIM(er.mobile), ''), '') AS mobile,
    e.erp_id,
    -- The applicant's own login, which is NOT the creator when a shared department account
    -- submitted the claim. Both count as the owner -- see shared/financeOwnership.js.
    e.user_id AS applicant_user_id,
    creator_user.email AS created_by_email
  FROM expenditure_requests er
  LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
  LEFT JOIN master_employees e ON e.id = er.employee_id
  LEFT JOIN master_departments d ON d.id = e.department_id
  LEFT JOIN users creator_user ON creator_user.id = er.created_by
  LEFT JOIN (
    SELECT
      ranked.expenditure_id,
      ranked.budget_line_id,
      ranked.budget_proposal_id,
      ranked.budget_head,
      ranked.sub_head
    FROM (
      SELECT
        all_rows.expenditure_id,
        all_rows.budget_line_id,
        all_rows.budget_proposal_id,
        all_rows.budget_head,
        all_rows.sub_head,
        ROW_NUMBER() OVER (
          PARTITION BY all_rows.expenditure_id
          ORDER BY all_rows.sort_order ASC, all_rows.id ASC
        ) AS rn
      FROM (
        SELECT
          ar.expenditure_id,
          ar.budget_line_id,
          ar.budget_proposal_id,
          ${collateBudgetText('ar.budget_head')} AS budget_head,
          ${collateBudgetText('ar.sub_head')} AS sub_head,
          ar.sort_order,
          ar.id
        FROM expenditure_advance_rows ar
        UNION ALL
        SELECT
          sr.expenditure_id,
          sr.budget_line_id,
          sr.budget_proposal_id,
          ${collateBudgetText('sr.budget_head')} AS budget_head,
          ${collateBudgetText('sr.sub_head')} AS sub_head,
          sr.sort_order,
          sr.id
        FROM expenditure_settlement_rows sr
        UNION ALL
        SELECT
          lr.expenditure_id,
          lr.budget_line_id,
          lr.budget_proposal_id,
          ${collateBudgetText('lr.budget_head')} AS budget_head,
          ${collateBudgetText('lr.sub_head')} AS sub_head,
          lr.sort_order,
          lr.id
        FROM expenditure_line_rows lr
      ) all_rows
    ) ranked
    WHERE ranked.rn = 1
  ) sample_row ON sample_row.expenditure_id = er.id
  LEFT JOIN (
    SELECT
      ranked_payee.expenditure_id,
      ranked_payee.payee_id,
      ranked_payee.payee_name,
      ranked_payee.account_no,
      ranked_payee.ifsc,
      ranked_payee.bank_name,
      ranked_payee.branch_name,
      ranked_payee.account_name,
      ranked_payee.account_type
    FROM (
      SELECT
        p.expenditure_id,
        p.payee_id,
        p.payee_name,
        p.account_no,
        p.ifsc,
        p.bank_name,
        p.branch_name,
        p.account_name,
        p.account_type,
        ROW_NUMBER() OVER (
          PARTITION BY p.expenditure_id
          ORDER BY p.sort_order ASC, p.id ASC
        ) AS rn
      FROM expenditure_payee_rows p
    ) ranked_payee
    WHERE ranked_payee.rn = 1
  ) sample_payee ON sample_payee.expenditure_id = er.id
`;

// Optional columns (added by the 20260604 migration). The write paths already guard
// these via hasExpenditureRequestColumn; the read path must match, otherwise a SELECT
// against a not-yet-migrated database throws "Unknown column". When a column is missing
// we emit `NULL AS <col>` so the result shape stays stable. Memoized via the cached
// column-existence lookups.
const OPTIONAL_UNPLANNED_HEAD_COLUMNS = [
  'unplanned_head_of_account',
  'unplanned_head_of_account_budget_line_id',
  'unplanned_head_of_account_budget_proposal_id',
];

let expenditureSelectSqlPromise = null;
const getExpenditureSelect = async () => {
  if (expenditureSelectSqlPromise) {
    return expenditureSelectSqlPromise;
  }
  expenditureSelectSqlPromise = (async () => {
    const optionalColumnSql = [];
    for (const column of OPTIONAL_UNPLANNED_HEAD_COLUMNS) {
      const exists = await hasExpenditureRequestColumn(column);
      optionalColumnSql.push(exists ? `    er.${column},` : `    NULL AS ${column},`);
    }
    return EXPENDITURE_SELECT_TEMPLATE.replace(
      '__OPTIONAL_UNPLANNED_HEAD_COLUMNS__',
      optionalColumnSql.join('\n'),
    );
  })().catch((error) => {
    expenditureSelectSqlPromise = null;
    throw error;
  });
  return expenditureSelectSqlPromise;
};

// ─── Expenditure CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new expenditure (advance) request.
 *
 * Steps inside the transaction:
 *   1. Validate budget line is approved with sufficient remaining balance.
 *   2. Upsert payee if inline payment_details provided instead of payee_id.
 *   3. Calculate pre-advance (sum of prior approved advances on same budget line).
 *   4. Insert expenditure_requests row.
 *   5. Allocate a sequential reference number.
 *   6. Deduct amount from finance_budget_line_usage (consumed_amount).
 *   7. Write to audit ledger.
 */
async function createExpenditureLegacy(data, userId) {
  return withTransaction(async (conn) => {
    // ── 1. Budget validation ────────────────────────────────────────────────
    const budgetLineId = toPositiveInt(data.budget_line_id);
    if (!budgetLineId) throw new Error('budget_line_id is required');

    const [[lineRow]] = await conn.execute(
      `SELECT
         bpl.id,
         bpl.budget_proposal_id,
         bpl.budget_head  AS head,
         bpl.sub_head,
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)  AS total_amount,
         COALESCE(fblu.consumed_amount, 0)                      AS used_amount,
         GREATEST(
           0,
           COALESCE(bpl.approved_line_total, bpl.line_total, 0)
           - COALESCE(fblu.consumed_amount, 0)
         )                                                       AS remaining_amount,
         bp.status
       FROM budget_proposal_lines bpl
       JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
       LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
       WHERE bpl.id = ?
         AND (
           LOWER(TRIM(bp.status)) IN ('completed','approved','principal_approved')
           OR LOWER(TRIM(bp.current_stage)) = 'completed'
         )
       LIMIT 1 FOR UPDATE`,
      [budgetLineId],
    );

    if (!lineRow) throw new Error('Budget line not found or not yet approved');

    const requestedAmount = toMoney(data.amount);
    if (requestedAmount <= 0) throw new Error('amount must be greater than 0');

    const remaining = toMoney(lineRow.remaining_amount);
    if (requestedAmount > remaining) {
      throw new Error(
        `Requested ₹${requestedAmount.toFixed(2)} exceeds remaining budget ₹${remaining.toFixed(2)}`,
      );
    }

    // ── 2. Resolve payee ────────────────────────────────────────────────────
    let payeeId = toPositiveInt(data.payee_id);
    if (!payeeId && data.payment_details) {
      payeeId = await upsertPayee(
        {
          payee_name: data.payment_details.payee_name || data.purpose || 'Unknown',
          account_no: data.payment_details.account_no,
          ifsc: data.payment_details.ifsc,
          bank_name: data.payment_details.bank_name,
          branch_name: data.payment_details.branch_name || '',
          account_name: data.payment_details.account_name || null,
          account_type: data.payment_details.account_type || null,
          pan_number: data.payment_details.pan_number || null,
          beneficiary_org: data.payment_details.beneficiary_org || null,
          beneficiary_type: data.payment_details.beneficiary_type || 'individual',
        },
        userId,
        conn,
      );
    }

    // ── 3. Pre-advance (first time = 0, subsequent = prior total) ──────────
    // NEW: prefer catalog IDs for matching; falls back to text for
    // un-backfilled legacy rows.
    const preAdvanceIds = await resolveCatalogIds(conn, lineRow.head, lineRow.sub_head);
    const employeeId = toPositiveInt(data.employee_id);
    const { preAdvance } = await getCumulativeAdvanceSummary(conn, {
      userId,
      // No finance request pins this path, so the applicant is what scopes the running total.
      employeeId,
      budgetLineId,
      head: lineRow.head,
      subHead: lineRow.sub_head,
      budgetHeadId: preAdvanceIds.budget_head_id,
      budgetSubHeadId: preAdvanceIds.budget_sub_head_id,
    });

    // ── 4. Resolve department from employee ─────────────────────────────────
    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    // ── 5. Insert expenditure row ───────────────────────────────────────────
    const entry = {
      finance_request_id: toPositiveInt(data.finance_request_id),
      budget_line_id: budgetLineId,
      budget_proposal_id: toPositiveInt(lineRow.budget_proposal_id),
      employee_id: employeeId || null,
      payee_id: payeeId || null,
      created_by: toPositiveInt(userId),
      request_date: data.request_date || new Date().toISOString().slice(0, 10),
      request_type: 'Advance',
      description: normalizeText(data.description) || null,
      purpose: normalizeText(data.purpose) || null,
      beneficiary_type:
        normalizeBeneficiaryType(data.beneficiary_type) ||
        normalizeText(data.beneficiary_type) ||
        'Individual Faculty',
      beneficiary_value: normalizeText(data.beneficiary_value) || null,
      budget_tag: normalizeText(data.budget_tag) || null,
      department_id: workflowContext.departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head: normalizeText(data.primary_head) || normalizeText(lineRow.head) || 'General',
      event_sub_head: normalizeText(data.event_sub_head) || null,
      head: normalizeText(lineRow.head),
      sub_head: normalizeText(lineRow.sub_head),
      amount: requestedAmount,
      pre_advance_amount: preAdvance,
      advance_total_amount: requestedAmount,
      total_amount: requestedAmount,
      approved_total_amount: 0,
      payment_debit_account: normalizeText(data.payment_debit_account) || null,
      payment_mode: normalizeText(data.payment_mode) || null,
      payment_status: 'Pending',
      overall_status: 'pending',
    };

    const hasPrimaryHeadIdColumn = await hasExpenditureRequestColumn('primary_head_id', {
      tx: conn,
    });
    const hasEventSubHeadIdColumn = await hasExpenditureRequestColumn('event_sub_head_id', {
      tx: conn,
    });
    if (hasPrimaryHeadIdColumn || hasEventSubHeadIdColumn) {
      // NEW: resolve catalog IDs for the header head + event sub-head and add
      // them to the entry. Keeps text snapshot AND stable IDs in sync.
      // LEGACY: nulls allowed — text remains authoritative for those rows.
      const advHeaderIds = await resolvePrimaryHeadIds(
        conn,
        entry.primary_head,
        entry.event_sub_head,
      );
      if (hasPrimaryHeadIdColumn) entry.primary_head_id = advHeaderIds.primary_head_id;
      if (hasEventSubHeadIdColumn) entry.event_sub_head_id = advHeaderIds.event_sub_head_id;
    }

    const filteredEntry = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== null && value !== undefined),
    );
    const entryKeys = Object.keys(filteredEntry);
    const entryValues = Object.values(filteredEntry);

    const [result] = await conn.execute(
      `INSERT INTO expenditure_requests (${entryKeys.map((key) => `\`${key}\``).join(', ')})
       VALUES (${entryKeys.map(() => '?').join(', ')})`,
      entryValues,
    );
    const expenditureId = result.insertId;

    // ── 6. Sequential reference number ─────────────────────────────────────
    const ref = await insertExpenditureRef(conn, {
      expenditureId,
      financeRequestId: toPositiveInt(data.finance_request_id),
      requestDate: data.request_date,
      requestType: 'Advance',
      workflowRowHistory: [],
      rowIndex: 1,
    });

    // ── 7. Consume budget balance ───────────────────────────────────────────
    await conn.execute(
      `INSERT INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)
       ON DUPLICATE KEY UPDATE budget_line_id = budget_line_id`,
      [budgetLineId],
    );
    await conn.execute(
      `UPDATE finance_budget_line_usage
          SET consumed_amount = consumed_amount + ?,
              updated_at      = CURRENT_TIMESTAMP
        WHERE budget_line_id  = ?`,
      [requestedAmount, budgetLineId],
    );

    // ── 8. Audit ledger ────────────────────────────────────────────────────
    try {
      await conn.execute(
        `INSERT INTO expenditure_budget_ledger
           (expenditure_id, budget_line_id, operation, amount,
            balance_after, actor_user_id, remarks)
         VALUES (?, ?, 'advance', ?, ?, ?, 'Advance requested')`,
        [
          expenditureId,
          budgetLineId,
          requestedAmount,
          toMoney(lineRow.used_amount) + requestedAmount,
          toPositiveInt(userId),
        ],
      );
    } catch (auditErr) {
      if (auditErr?.code !== 'ER_NO_SUCH_TABLE') throw auditErr;
    }

    return { expenditureId, requestRef: ref };
  });
}

export async function createExpenditure(data, userId) {
  const financeRequestId = toPositiveInt(data.finance_request_id);
  if (!financeRequestId) {
    throw new Error('finance_request_id is required');
  }

  const budgetLineId = toPositiveInt(data.budget_line_id);
  if (!budgetLineId) {
    throw new Error('budget_line_id is required');
  }

  const amount = toMoney(data.amount);
  if (amount <= 0) {
    throw new Error('amount must be greater than 0');
  }

  const paymentDetails = data.payment_details || {};
  const payload = {
    finance_request_id: financeRequestId,
    employee_id: toPositiveInt(data.employee_id),
    request_date: data.request_date || new Date().toISOString().slice(0, 10),
    description: normalizeText(data.description) || normalizeText(data.purpose) || null,
    beneficiary_type:
      normalizeBeneficiaryType(data.beneficiary_type) ||
      normalizeText(data.beneficiary_type) ||
      'Individual Faculty',
    beneficiary_value: normalizeText(data.beneficiary_value) || null,
    budget_tag: normalizeText(data.budget_tag) || null,
    primary_head: normalizeText(data.primary_head) || 'General',
    event_sub_head: normalizeText(data.event_sub_head) || null,
    request_type: 'Advance',
    unplanned_budget_enabled: parseBoolean(data.unplanned_budget_enabled),
    unplanned_budget_amount: data.unplanned_budget_amount ?? null,
    unplanned_head_of_account: data.unplanned_head_of_account ?? null,
    unplanned_head_of_account_budget_line_id: data.unplanned_head_of_account_budget_line_id ?? null,
    unplanned_head_of_account_budget_proposal_id:
      data.unplanned_head_of_account_budget_proposal_id ?? null,
    unplanned_budget_head: data.unplanned_budget_head ?? null,
    unplanned_budget_sub_head: data.unplanned_budget_sub_head ?? null,
    unplanned_budget_description: data.unplanned_budget_description ?? null,
    advance_rows: [
      {
        budget_line_id: budgetLineId,
        budgetLineId,
        budget_proposal_id: toPositiveInt(data.budget_proposal_id),
        budgetProposalId: toPositiveInt(data.budget_proposal_id),
        budget_head: normalizeText(data.head) || null,
        budgetHead: normalizeText(data.head) || null,
        sub_head: normalizeText(data.sub_head) || null,
        subHead: normalizeText(data.sub_head) || null,

        advance_amount: amount,
        advance: amount,
      },
    ],
    payee_rows:
      data.payee_id || paymentDetails.account_no
        ? [
            {
              payee_id: toPositiveInt(data.payee_id),
              payee_name:
                resolveCanonicalPayeeName(
                  paymentDetails.payee_name || data.payee_name,
                  paymentDetails.account_name,
                ) || null,
              bank_name: normalizeText(paymentDetails.bank_name) || null,
              account_no: normalizeText(paymentDetails.account_no) || null,
              ifsc: normalizeText(paymentDetails.ifsc).toUpperCase() || null,
              branch_name: normalizeText(paymentDetails.branch_name) || null,
              amount,
              mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
              account_name:
                resolveCanonicalPayeeName(
                  paymentDetails.payee_name || data.payee_name,
                  paymentDetails.account_name,
                ) || null,
              beneficiary_org:
                resolveCanonicalBeneficiaryOrg(
                  paymentDetails.beneficiary_org || data.beneficiary_org,
                  paymentDetails.payee_name || data.payee_name,
                ) || null,
            },
          ]
        : [],
    payment_details: paymentDetails,
    payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
    payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
    payment_date: paymentDetails.date || data.payment_date || null,
    payment_status: normalizePaymentStatus(
      paymentDetails.status || data.payment_status || 'Pending',
    ),
    payment_debit_account:
      normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
  };

  return createExpenditureRequest(payload, userId, { billFiles: [], bulkTransactionFile: null });
}

function sanitizeRowValue(value) {
  return normalizeText(value) || null;
}

function moneyOrNull(value) {
  const amount = toMoney(value);
  return amount !== 0 ? amount : null;
}

function toStoredUploadPath(filePath = '') {
  const relativePath = filePath
    ? `/${filePath
        .replace(process.cwd(), '')
        .replace(/^[\\/]+/, '')
        .replace(/\\/g, '/')}`
    : null;
  return relativePath;
}

function withUploadAccess(row) {
  if (!row) return null;

  const filePath = normalizeText(row.file_path) || null;
  return {
    ...row,
    file_url: filePath,
    download_url: filePath,
  };
}

async function insertIncomeRows(conn, expenditureId, rows = []) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const incomeSource = sanitizeRowValue(row.incomeSource || row.income_source);
    const contribution = sanitizeRowValue(row.contribution);
    const amount = toMoney(row.amount);
    const status = sanitizeRowValue(row.status);
    const creditAccount = sanitizeRowValue(row.creditAccount || row.credit_account);
    if (!incomeSource && !contribution && amount === 0 && !status && !creditAccount) continue;

    await conn.execute(
      `INSERT INTO expenditure_income_rows
         (expenditure_id, income_source, contribution, amount, status, remarks, credit_account, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [expenditureId, incomeSource, contribution, amount, status, null, creditAccount, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertPayeeRows(conn, expenditureId, rows = [], userId = null) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const existingPayeeId = toPositiveInt(row.payeeId || row.payee_id);
    const payeeName = sanitizeRowValue(
      resolveCanonicalPayeeName(
        row.payeeName || row.payee_name,
        row.accountName || row.account_name,
      ),
    );
    const bankName = sanitizeRowValue(row.bankName || row.bank_name);
    const accountNo = sanitizeRowValue(row.accountNo || row.account_no);
    const ifsc = sanitizeRowValue(row.ifsc);
    const branchName = sanitizeRowValue(row.branchName || row.branch_name);
    const url = sanitizeRowValue(row.url);
    const amount = toMoney(row.amount);
    const mode = sanitizeRowValue(row.mode);
    const accountName = payeeName;
    const panNumber = sanitizeRowValue(row.panNumber || row.pan_number);
    const accountType = sanitizeRowValue(row.accountType || row.account_type);
    const beneficiaryType =
      sanitizeRowValue(row.beneficiaryType || row.beneficiary_type) || 'individual';
    const beneficiaryOrg = sanitizeRowValue(
      resolveCanonicalBeneficiaryOrg(
        row.beneficiaryOrg || row.beneficiary_org,
        row.payeeName || row.payee_name,
      ),
    );
    const organizationType = sanitizeRowValue(row.organizationType || row.organization_type);
    const msme = sanitizeRowValue(row.msme);
    const gstin = sanitizeRowValue(row.gstin);
    const tdsDetails = sanitizeRowValue(row.tdsDetails || row.tds_details);
    const tdsSection = sanitizeRowValue(row.tdsSection || row.tds_section);
    if (!payeeName && !accountNo && !bankName && amount === 0 && !mode) continue;

    let payeeId = existingPayeeId || null;
    if (!payeeId && accountNo && ifsc) {
      payeeId = await upsertPayee(
        {
          payee_name: payeeName,
          bank_name: bankName,
          account_no: accountNo,
          ifsc,
          branch_name: branchName,
          account_name: accountName,
          pan_number: panNumber,
          account_type: accountType,
          beneficiary_type: beneficiaryType,
          beneficiary_org: beneficiaryOrg,
          organization_type: organizationType,
          msme,
          gstin,
          tds_details: tdsDetails,
          tds_section: tdsSection,
        },
        userId,
        conn,
      );
    }

    await conn.execute(
      `INSERT INTO expenditure_payee_rows
         (expenditure_id, payee_id, payee_name, bank_name, account_no, ifsc, branch_name, url,
          amount, mode, account_name, pan_number, account_type,
          beneficiary_type, beneficiary_org, organization_type, msme, gstin, tds_details, tds_section, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
        payeeId,
        payeeName,
        bankName,
        accountNo,
        ifsc,
        branchName,
        url,
        amount,
        mode,
        accountName,
        panNumber,
        accountType,
        beneficiaryType,
        beneficiaryOrg,
        organizationType,
        msme,
        gstin,
        tdsDetails,
        tdsSection,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function resolveFinanceBudgetBreakupIdForExpenditureRow(
  conn,
  { financeRequestId, budgetLineId, budgetHead, subHead } = {},
) {
  const financeId = toPositiveInt(financeRequestId);
  const lineId = toPositiveInt(budgetLineId);
  const head = normalizeText(budgetHead);
  const sub = normalizeText(subHead);
  if (!financeId || !lineId || !head || !sub) return null;

  const [rows] = await conn.execute(
    `SELECT id
       FROM finance_budget_breakup
      WHERE finance_id = ?
        AND budget_line_id = ?
        AND LOWER(TRIM(CONVERT(budget_head USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
            LOWER(TRIM(CONVERT(? USING utf8mb4))) COLLATE utf8mb4_unicode_ci
        AND LOWER(TRIM(CONVERT(sub_head USING utf8mb4))) COLLATE utf8mb4_unicode_ci =
            LOWER(TRIM(CONVERT(? USING utf8mb4))) COLLATE utf8mb4_unicode_ci
      ORDER BY id ASC
      LIMIT 2`,
    [financeId, lineId, head, sub],
  );

  return rows.length === 1 ? toPositiveInt(rows[0].id) : null;
}

async function insertAdvanceRows(
  conn,
  expenditureId,
  rows = [],
  userId = null,
  budgetSnapshotsByLine = new Map(),
  workflowRowIdentity = {},
) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const budgetSnapshot = budgetSnapshotsByLine.get(budgetLineId) || null;
    const financeBudgetBreakupId =
      toPositiveInt(row.financeBudgetBreakupId || row.finance_budget_breakup_id) ||
      (await resolveFinanceBudgetBreakupIdForExpenditureRow(conn, {
        financeRequestId: workflowRowIdentity.financeRequestId,
        budgetLineId,
        budgetHead,
        subHead,
      }));
    let preAdvanceAmount = moneyOrNull(row.preAdvance || row.pre_advance_amount);
    const advanceAmount = toMoney(row.advance || row.advance_amount);

    if (!budgetHead && !subHead && advanceAmount === 0) continue;

    // NEW: resolve catalog IDs and pass to summary so cumulative match
    // prefers IDs over text. Block resolves both row-level IDs and
    // available_amount_snapshot in the INSERT just below.
    const earlyResolvedIds = await resolveCatalogIds(conn, budgetHead, subHead);
    const uid = toPositiveInt(userId);
    if (uid && (budgetLineId || (budgetHead && subHead))) {
      const summary = await getCumulativeAdvanceSummary(conn, {
        userId: uid,
        budgetLineId,
        head: budgetHead,
        subHead,
        budgetHeadId: earlyResolvedIds.budget_head_id,
        budgetSubHeadId: earlyResolvedIds.budget_sub_head_id,
        financeRequestId: workflowRowIdentity.financeRequestId,
        rowIndex: workflowRowIdentity.rowIndex,
        sourceRequestId: workflowRowIdentity.sourceRequestId,
        dashboardRowId: workflowRowIdentity.dashboardRowId,
        workflowRowRef: workflowRowIdentity.workflowRowRef,
        excludeExpenditureId: expenditureId,
      });
      preAdvanceAmount = moneyOrNull(summary.preAdvance);
    }

    // NEW: catalog IDs alongside snapshot text — reuse `earlyResolvedIds`
    // computed above so the insert and the cumulative-summary query agree.
    const advIds = earlyResolvedIds;

    await conn.execute(
      `INSERT INTO expenditure_advance_rows
          (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
           amount_source, budget_head, sub_head, budget_head_id, budget_sub_head_id,
           budget_amount, pre_advance_amount,
           advance_amount,
           available_amount_snapshot, remaining_amount_snapshot,
           unplanned_available_snapshot, sort_order)
       VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        financeBudgetBreakupId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        advIds.budget_head_id,
        advIds.budget_sub_head_id,
        budgetAmount,
        preAdvanceAmount,
        advanceAmount,
        budgetSnapshot ? budgetSnapshot.availableAmountSnapshot : null,
        budgetSnapshot ? budgetSnapshot.remainingAmountSnapshot : null,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function insertSettlementRows(
  conn,
  expenditureId,
  rows = [],
  budgetSnapshotsByLine = new Map(),
  {
    userId = null,
    financeRequestId = null,
    rowIndex = null,
    sourceRequestId = null,
    dashboardRowId = null,
    workflowRowRef = null,
    excludeExpenditureId = null,
  } = {},
) {
  const validRows = Array.isArray(rows) ? rows : [];
  // Same per-head/sub allocation the submitted totals were validated against, so the stored
  // advance_amount of the rows adds up to the advance the settlement was checked against.
  const advanceAllocations = await allocateSettlementAdvances(conn, validRows, {
    userId,
    financeRequestId,
    rowIndex,
    sourceRequestId,
    dashboardRowId,
    workflowRowRef,
    excludeExpenditureId,
  });
  let sortOrder = 0;
  for (let rowPosition = 0; rowPosition < validRows.length; rowPosition += 1) {
    const row = validRows[rowPosition];
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const budgetSnapshot = budgetSnapshotsByLine.get(budgetLineId) || null;
    const financeBudgetBreakupId =
      toPositiveInt(row.financeBudgetBreakupId || row.finance_budget_breakup_id) ||
      (await resolveFinanceBudgetBreakupIdForExpenditureRow(conn, {
        financeRequestId,
        budgetLineId,
        budgetHead,
        subHead,
      }));
    const settlementAmount = getSettlementRowSettlementAmount(row);
    // Same rule `allocateSettlementAdvances` skipped by, so the allocation stays aligned.
    if (isEmptySettlementRow(row)) continue;

    // NEW: catalog IDs alongside snapshot text.
    const setIds = await resolveCatalogIds(conn, budgetHead, subHead);
    const advanceAmount = toMoney(advanceAllocations[rowPosition]);

    await conn.execute(
      `INSERT INTO expenditure_settlement_rows
          (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
           amount_source, budget_head, sub_head, budget_head_id, budget_sub_head_id,
           budget_amount, advance_amount,
           settlement_amount, available_amount_snapshot, remaining_amount_snapshot,
           unplanned_available_snapshot, sort_order)
       VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        financeBudgetBreakupId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        setIds.budget_head_id,
        setIds.budget_sub_head_id,
        budgetAmount,
        advanceAmount,
        settlementAmount,
        budgetSnapshot ? budgetSnapshot.availableAmountSnapshot : null,
        budgetSnapshot ? budgetSnapshot.remainingAmountSnapshot : null,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function getSettlementAdvanceAmount(
  conn,
  row = {},
  {
    userId = null,
    financeRequestId = null,
    rowIndex = null,
    sourceRequestId = null,
    dashboardRowId = null,
    workflowRowRef = null,
    excludeExpenditureId = null,
    budgetHead = null,
    subHead = null,
    budgetLineId = null,
    budgetHeadId = null,
    budgetSubHeadId = null,
    // Narrow the lookup to the row's own budget line instead of the whole head/sub. Only the
    // per-line split inside `allocateSettlementAdvances` wants this; validation never does.
    matchByBudgetLine = false,
  } = {},
) {
  const uid = toPositiveInt(userId);
  const resolvedBudgetHead = sanitizeRowValue(budgetHead || row.budgetHead || row.budget_head);
  const resolvedSubHead = sanitizeRowValue(subHead || row.subHead || row.sub_head);
  const resolvedBudgetLineId = toPositiveInt(
    budgetLineId || row.budgetLineId || row.budget_line_id,
  );

  if (!uid || (!resolvedBudgetLineId && (!resolvedBudgetHead || !resolvedSubHead))) {
    return toMoney(row.advance || row.advance_amount);
  }

  const resolvedIds =
    budgetHeadId || budgetSubHeadId
      ? {
          budget_head_id: toPositiveInt(budgetHeadId),
          budget_sub_head_id: toPositiveInt(budgetSubHeadId),
        }
      : await resolveCatalogIds(conn, resolvedBudgetHead, resolvedSubHead);

  // Match the advance by head/sub across every budget line, never by a single
  // budget_line_id, because that is exactly what the settlement form did when it
  // showed the user the advance to adjust: it groups all budget lines sharing a
  // head/sub into one option and calls /expenditure/advance-summary once WITHOUT a
  // budget_line_id. An advance booked across two lines of the same head/sub (or on
  // the SOURCE-year line of a carry-forward, while the settlement uses the
  // TARGET-year line) would otherwise be counted here only in part, and the
  // settlement the form showed as fully adjusted gets rejected as a mismatch.
  // The row-identity scope (finance request + dashboard row) already pins the card,
  // so widening from line to head/sub cannot pull in another card's advance.
  const advanceMatchLineId =
    resolvedBudgetHead && resolvedSubHead && !matchByBudgetLine ? null : resolvedBudgetLineId;

  const summary = await getCumulativeAdvanceSummary(conn, {
    userId: uid,
    budgetLineId: advanceMatchLineId,
    head: resolvedBudgetHead,
    subHead: resolvedSubHead,
    budgetHeadId: resolvedIds.budget_head_id,
    budgetSubHeadId: resolvedIds.budget_sub_head_id,
    financeRequestId,
    rowIndex,
    sourceRequestId,
    dashboardRowId,
    workflowRowRef,
    excludeExpenditureId,
  });

  return toMoney(summary.preAdvance);
}

const getSettlementRowSettlementAmount = (row = {}) =>
  toMoney(row.settlement || row.settlement_amount);

const getSettlementRowBudgetLineId = (row = {}) =>
  toPositiveInt(row.budgetLineId || row.budget_line_id);

const isEmptySettlementRow = (row = {}) =>
  !sanitizeRowValue(row.budgetHead || row.budget_head) &&
  !sanitizeRowValue(row.subHead || row.sub_head) &&
  getSettlementRowSettlementAmount(row) === 0;

const getSettlementAdvanceGroupKey = (row = {}) => {
  const head = normalizeText(sanitizeRowValue(row.budgetHead || row.budget_head)).toLowerCase();
  const subHead = normalizeText(sanitizeRowValue(row.subHead || row.sub_head)).toLowerCase();
  if (head && subHead) return `head::${head}::${subHead}`;
  return `line::${getSettlementRowBudgetLineId(row)}`;
};

/**
 * The advance each settlement row discharges, aligned index-for-index with `rows`.
 *
 * The advance is looked up per head/sub GROUP, because that is the unit the settlement form
 * works in: it collapses every budget line sharing a head/sub into one option and reads the
 * advance for the group. Looking it up per row instead would report the group's whole advance
 * on each row of the group and double it.
 *
 * Inside a group the total is then split back out per budget line, so `advance_amount` keeps
 * saying WHICH advance each row discharged — `resolveAdvanceUsageAmount` reads it back to tell
 * a settled advance from one still outstanding, and it reads it per row.
 */
async function allocateSettlementAdvances(conn, rows = [], options = {}) {
  const validRows = Array.isArray(rows) ? rows : [];
  const allocations = new Array(validRows.length).fill(0);
  const groupPositions = new Map();

  for (let index = 0; index < validRows.length; index += 1) {
    if (isEmptySettlementRow(validRows[index])) continue;
    const groupKey = getSettlementAdvanceGroupKey(validRows[index]);
    const positions = groupPositions.get(groupKey) || [];
    positions.push(index);
    groupPositions.set(groupKey, positions);
  }

  for (const positions of groupPositions.values()) {
    // The group's whole advance, across every budget line under this head/sub — the same
    // figure the form showed the user and validated the payee amounts against.
    let unallocated = await getSettlementAdvanceAmount(conn, validRows[positions[0]], options);
    const seenBudgetLineIds = new Set();

    for (const position of positions) {
      if (unallocated <= 0) break;
      // A row recording no spend cannot hold any of the advance: `buildSettledAdvanceExpr`
      // counts advance_amount only where settlement_amount > 0, so an advance parked here
      // would be reported as still outstanding after the settlement that discharged it. Its
      // line's advance stays unallocated and reaches a spend-bearing row as the remainder
      // below. Skipped before `seenBudgetLineIds`, so a later row that does record spend on
      // the same budget line still gets that line's share.
      if (getSettlementRowSettlementAmount(validRows[position]) <= 0) continue;
      const budgetLineId = getSettlementRowBudgetLineId(validRows[position]);
      // Two rows on one budget line share that line's advance; it is allocated once.
      if (!budgetLineId || seenBudgetLineIds.has(budgetLineId)) continue;
      seenBudgetLineIds.add(budgetLineId);

      const lineAdvance = await getSettlementAdvanceAmount(conn, validRows[position], {
        ...options,
        matchByBudgetLine: true,
      });
      // Capped by what is left, so a row that also matches line-less legacy advances by
      // head/sub text cannot claim more of the group than the group holds.
      const share = toMoney(Math.min(lineAdvance, unallocated));
      if (share <= 0) continue;
      allocations[position] = toMoney(allocations[position] + share);
      unallocated = toMoney(unallocated - share);
    }

    // Advance sitting on budget lines this settlement has no spend row for is still discharged
    // by it, so it has to land somewhere. It goes on a row that records spend, because the claim
    // accounting (`buildSettledAdvanceExpr`) only counts advance_amount where
    // settlement_amount > 0 — parking it on a zero-spend row would report the advance as still
    // outstanding.
    if (unallocated > 0) {
      const carrier =
        positions.find((position) => getSettlementRowSettlementAmount(validRows[position]) > 0) ??
        positions[0];
      allocations[carrier] = toMoney(allocations[carrier] + unallocated);
    }
  }

  return allocations;
}

// Exported for tests: the per-row split is the part with the interesting edge cases.
export const allocateSettlementAdvancesForTest = allocateSettlementAdvances;

export async function getSettlementAdvanceTotal(conn, rows = [], options = {}) {
  const allocations = await allocateSettlementAdvances(conn, rows, options);
  return toMoney(allocations.reduce((sum, amount) => sum + toMoney(amount), 0));
}

const formatMoney = (value) =>
  toMoney(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function assertSettlementPayeesMatchAdjustment(
  conn,
  {
    requestType,
    settlementRows = [],
    payeeRows = [],
    normalizedUnplanned = { amount: 0 },
    userId = null,
    financeRequestId = null,
    rowIndex = null,
    sourceRequestId = null,
    dashboardRowId = null,
    workflowRowRef = null,
    excludeExpenditureId = null,
  } = {},
) {
  if (requestType !== 'Settlement') return;

  const settlementTotal = toMoney(
    settlementRows.reduce((sum, row) => sum + toMoney(row.settlement || row.settlement_amount), 0) +
      toMoney(normalizedUnplanned.amount),
  );
  const advanceTotal = await getSettlementAdvanceTotal(conn, settlementRows, {
    userId,
    financeRequestId,
    rowIndex,
    sourceRequestId,
    dashboardRowId,
    workflowRowRef,
    excludeExpenditureId,
  });
  const expectedPayeeTotal = Math.abs(toMoney(settlementTotal - advanceTotal));
  const submittedPayeeTotal = toMoney(payeeRows.reduce((sum, row) => sum + toMoney(row.amount), 0));

  if (toMoney(expectedPayeeTotal) === submittedPayeeTotal) return;

  if (toMoney(expectedPayeeTotal) === 0) {
    throw new Error(
      `Settlement expenditure and advance are equal, so there is no amount to be received or returned. Payee transaction amount must be ₹ ${formatMoney(0)}.`,
    );
  }

  throw new Error(
    `Settlement adjustment amount is ₹ ${formatMoney(expectedPayeeTotal)} and total payee transaction amount is ₹ ${formatMoney(submittedPayeeTotal)}. Both must be exactly the same.`,
  );
}

async function insertExpenditureRows(
  conn,
  expenditureId,
  rows = [],
  budgetSnapshotsByLine = new Map(),
  financeRequestId = null,
) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const budgetSnapshot = budgetSnapshotsByLine.get(budgetLineId) || null;
    const financeBudgetBreakupId =
      toPositiveInt(row.financeBudgetBreakupId || row.finance_budget_breakup_id) ||
      (await resolveFinanceBudgetBreakupIdForExpenditureRow(conn, {
        financeRequestId,
        budgetLineId,
        budgetHead,
        subHead,
      }));
    const expenditureInput = sanitizeRowValue(
      row.expenditure || row.expenditure_input || row.autoSum || row.auto_sum_amount,
    );
    const autoSumAmount = toMoney(row.autoSum || row.auto_sum_amount || row.expenditure);
    if (!budgetHead && !subHead && autoSumAmount === 0 && !expenditureInput) continue;

    // NEW: catalog IDs alongside snapshot text.
    const lineIds = await resolveCatalogIds(conn, budgetHead, subHead);

    await conn.execute(
      `INSERT INTO expenditure_line_rows
          (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
           amount_source, budget_head, sub_head, budget_head_id, budget_sub_head_id,
           budget_amount, expenditure_input,
           auto_sum_amount, available_amount_snapshot, remaining_amount_snapshot,
           unplanned_available_snapshot, sort_order)
       VALUES (?, ?, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        financeBudgetBreakupId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        lineIds.budget_head_id,
        lineIds.budget_sub_head_id,
        budgetAmount,
        expenditureInput,
        autoSumAmount,
        budgetSnapshot ? budgetSnapshot.availableAmountSnapshot : null,
        budgetSnapshot ? budgetSnapshot.remainingAmountSnapshot : null,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function insertUnplannedRows(conn, expenditureId, rows = []) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const headOfAccount = sanitizeRowValue(row.headOfAccount || row.head_of_account);
    const headOfAccountBudgetLineId = toPositiveInt(
      row.headOfAccountBudgetLineId || row.head_of_account_budget_line_id,
    );
    const headOfAccountBudgetProposalId = toPositiveInt(
      row.headOfAccountBudgetProposalId || row.head_of_account_budget_proposal_id,
    );
    const budgetHead = sanitizeRowValue(row.head || row.budget_head || row.budgetHead);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const amount = toMoney(row.amount);
    const description =
      sanitizeRowValue(row.description) || [budgetHead, subHead].filter(Boolean).join(' - ');
    if (!headOfAccountBudgetLineId || !budgetHead || !subHead || amount <= 0) continue;

    await conn.execute(
      `INSERT INTO expenditure_unplanned_rows
         (expenditure_id, head_of_account, head_of_account_budget_line_id,
          head_of_account_budget_proposal_id, budget_head, sub_head, amount,
          description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
        headOfAccount,
        headOfAccountBudgetLineId,
        headOfAccountBudgetProposalId,
        budgetHead,
        subHead,
        amount,
        description,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function insertBillFiles(conn, expenditureId, files = [], fileCategory = 'bill') {
  const validFiles = Array.isArray(files) ? files : [];
  if (!validFiles.length) return;

  const category = fileCategory === 'payment_proof' ? 'payment_proof' : 'bill';

  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
       FROM expenditure_request_bills
      WHERE expenditure_id = ?
        AND file_category = ?`,
    [expenditureId, category],
  );
  let sortOrder = Number(rows[0]?.max_sort_order ?? -1) + 1;

  for (const file of validFiles) {
    if (!file?.filename || !file?.path) continue;

    await conn.execute(
      `INSERT INTO expenditure_request_bills
         (expenditure_id, payee_row_id, file_category, original_name, stored_name, file_path, mime_type, file_size, sort_order)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
        category,
        sanitizeRowValue(file.originalname),
        sanitizeRowValue(file.filename),
        toStoredUploadPath(file.path),
        sanitizeRowValue(file.mimetype),
        Number(file.size) || 0,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function getFinanceAnnexuresForExpenditure(financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return [];

  const [rows] = await db.query(
    `SELECT id, finance_id, annexure_type, original_name, stored_name, file_path,
            mime_type, file_size, sort_order, created_at
       FROM finance_request_annexures
      WHERE finance_id = ?
      ORDER BY sort_order ASC, id ASC`,
    [financeId],
  );
  return rows;
}

async function linkFinanceAnnexuresToExpenditure(conn, expenditureId, financeRequestId) {
  const annexures = await getFinanceAnnexuresForExpenditure(financeRequestId);
  if (!annexures.length) return;

  const [existingRows] = await conn.execute(
    `SELECT source_finance_annexure_id
       FROM expenditure_request_bills
      WHERE expenditure_id = ?
        AND source_finance_annexure_id IS NOT NULL`,
    [expenditureId],
  );
  const alreadyLinked = new Set(existingRows.map((row) => Number(row.source_finance_annexure_id)));

  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
       FROM expenditure_request_bills
      WHERE expenditure_id = ?
        AND file_category = 'bill'`,
    [expenditureId],
  );
  let sortOrder = Number(rows[0]?.max_sort_order ?? -1) + 1;

  for (const annexure of annexures) {
    if (alreadyLinked.has(Number(annexure.id))) continue;

    await conn.execute(
      `INSERT INTO expenditure_request_bills
         (expenditure_id, payee_row_id, file_category, original_name, stored_name, file_path, mime_type, file_size, sort_order, source_finance_annexure_id)
       VALUES (?, NULL, 'bill', ?, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
        sanitizeRowValue(annexure.original_name),
        sanitizeRowValue(annexure.stored_name),
        sanitizeRowValue(annexure.file_path),
        sanitizeRowValue(annexure.mime_type),
        Number(annexure.file_size) || 0,
        sortOrder,
        annexure.id,
      ],
    );
    sortOrder += 1;
  }
}

/**
 * Persists the bulk transaction payout file for a request.
 *
 * `meta.fileRetained` tells us what the client did with an already-stored file when no
 * new one was uploaded: `false` means the user deleted it (drop the row), `true` means
 * they kept it but may have switched mode/bank (update those columns only). Undefined —
 * a caller that does not manage this section at all — leaves the row untouched.
 */
async function upsertBulkTransactionFile(conn, expenditureId, file = null, meta = {}) {
  const transactionType = normalizeBulkTransactionType(meta.transactionType);
  const bankCode = normalizeBulkTransactionBank(meta.bankCode);

  if (!file?.filename || !file?.path) {
    if (meta.fileRetained === false) {
      await conn.execute('DELETE FROM expenditure_bulk_neft_files WHERE expenditure_id = ?', [
        expenditureId,
      ]);
      return;
    }

    if (meta.fileRetained !== true) return;

    // File kept as-is; only the mode/bank selection can have changed.
    const assignments = [];
    const assignmentValues = [];
    if (await hasBulkTransactionFileColumn('transaction_type', { tx: conn })) {
      assignments.push('transaction_type = ?');
      assignmentValues.push(transactionType);
    }
    if (await hasBulkTransactionFileColumn('bank_code', { tx: conn })) {
      assignments.push('bank_code = ?');
      assignmentValues.push(bankCode);
    }
    if (!assignments.length) return;

    await conn.execute(
      `UPDATE expenditure_bulk_neft_files
          SET ${assignments.join(', ')},
              updated_at = CURRENT_TIMESTAMP
        WHERE expenditure_id = ?`,
      [...assignmentValues, expenditureId],
    );
    return;
  }

  const columns = ['expenditure_id', 'template_version'];
  const values = [
    expenditureId,
    sanitizeRowValue(meta.templateVersion) || DEFAULT_BULK_TRANSACTION_TEMPLATE_VERSION,
  ];

  if (await hasBulkTransactionFileColumn('transaction_type', { tx: conn })) {
    columns.push('transaction_type');
    values.push(transactionType);
  }
  if (await hasBulkTransactionFileColumn('bank_code', { tx: conn })) {
    columns.push('bank_code');
    values.push(bankCode);
  }

  columns.push('original_name', 'stored_name', 'file_path', 'mime_type', 'file_size');
  values.push(
    sanitizeRowValue(file.originalname),
    sanitizeRowValue(file.filename),
    toStoredUploadPath(file.path),
    sanitizeRowValue(file.mimetype),
    Number(file.size) || 0,
  );

  const updateSql = columns
    .filter((column) => column !== 'expenditure_id')
    .map((column) => `${column} = VALUES(${column})`)
    .join(',\n       ');

  await conn.execute(
    `INSERT INTO expenditure_bulk_neft_files
       (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE
       ${updateSql},
       updated_at = CURRENT_TIMESTAMP`,
    values,
  );
}

function collectUsageRowsForRequestType(
  requestType,
  { advanceRows, settlementRows, expenditureRows } = {},
) {
  const usageByLine = new Map();

  const addUsage = (budgetLineId, amount, extra = {}) => {
    const lineId = toPositiveInt(budgetLineId);
    const normalizedAmount = toMoney(amount);
    if (!lineId || normalizedAmount <= 0) return;
    const current = usageByLine.get(lineId) || { budgetLineId: lineId, amount: 0 };
    usageByLine.set(lineId, {
      ...current,
      ...extra,
      budgetLineId: lineId,
      amount: toMoney((current.amount || 0) + normalizedAmount),
    });
  };

  if (requestType === 'Advance') {
    (Array.isArray(advanceRows) ? advanceRows : []).forEach((row) => {
      addUsage(row.budgetLineId || row.budget_line_id, row.advance || row.advance_amount);
    });
  } else if (requestType === 'Settlement') {
    (Array.isArray(settlementRows) ? settlementRows : []).forEach((row) => {
      addUsage(row.budgetLineId || row.budget_line_id, row.settlement || row.settlement_amount);
    });
  } else if (requestType === 'Expenditure') {
    (Array.isArray(expenditureRows) ? expenditureRows : []).forEach((row) => {
      addUsage(
        row.budgetLineId || row.budget_line_id,
        row.autoSum || row.auto_sum_amount || row.expenditure,
      );
    });
  }

  return [...usageByLine.values()];
}

function addUnplannedUsageRows(usageRows = [], normalizedUnplanned = {}) {
  if (!normalizedUnplanned?.enabled) return usageRows;

  (Array.isArray(normalizedUnplanned.rows) ? normalizedUnplanned.rows : []).forEach((row) => {
    const budgetLineId = toPositiveInt(row.headOfAccountBudgetLineId);
    const amount = toMoney(row.amount);
    if (!budgetLineId || amount <= 0) return;

    usageRows.push({
      budgetLineId,
      amount,
      isUnplanned: true,
      direction: -1,
    });
  });
  return usageRows;
}

// Validate that the usage rows do not exceed the remaining budget per line.
// Amounts must be aggregated by budget line before comparing: a single request can
// carry multiple rows for the same line (e.g. a normal draw plus the unplanned
// head-of-account deduction), and checking each row independently would let the
// combined draw slip past the remaining balance. This mirrors how
// buildBudgetSnapshotsByLine sums deltas per line.
function assertUsageRowsWithinRemainingBudget(
  requestType,
  usageRows = [],
  remainingByLineId = new Map(),
) {
  const requestedByLine = new Map();

  for (const usageRow of usageRows) {
    const lineId = toPositiveInt(usageRow.budgetLineId);
    if (!lineId || !remainingByLineId.has(lineId)) {
      throw new Error(`Budget line ${lineId || 'unknown'} is not linked to this finance request`);
    }
    // Settlement rows don't draw down the remaining budget, except the unplanned
    // head-of-account deduction, which always does.
    const countsAgainstRemaining =
      requestType !== 'Settlement' || usageRow.isUnplanned || usageRow.countsAgainstRemaining;
    if (!countsAgainstRemaining) continue;
    requestedByLine.set(
      lineId,
      toMoney((requestedByLine.get(lineId) || 0) + toMoney(usageRow.amount)),
    );
  }

  for (const [lineId, requestedAmount] of requestedByLine.entries()) {
    const remaining = toMoney(remainingByLineId.get(lineId)?.remainingAmount);
    if (requestedAmount > remaining) {
      throw new Error(
        `Requested amount ${requestedAmount.toFixed(2)} exceeds remaining budget ${remaining.toFixed(2)} for line ${lineId}`,
      );
    }
  }
}

function getAmountForWorkflowRow(requestType, row = {}) {
  if (requestType === 'Advance') {
    return toMoney(row.advance || row.advance_amount);
  }
  if (requestType === 'Settlement') {
    return toMoney(row.settlement || row.settlement_amount);
  }
  return toMoney(row.autoSum || row.auto_sum_amount || row.expenditure || row.expenditure_input);
}

function getRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows } = {}) {
  if (requestType === 'Advance') return Array.isArray(advanceRows) ? advanceRows : [];
  if (requestType === 'Settlement') return Array.isArray(settlementRows) ? settlementRows : [];
  return Array.isArray(expenditureRows) ? expenditureRows : [];
}

const normalizeBudgetHeadKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function assertWorkflowRowsHaveApprovedBudgetLines(
  conn,
  financeRequestId,
  requestType,
  { advanceRows, settlementRows, expenditureRows } = {},
  { budgetFiscalYear = null } = {},
) {
  const rows = getRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows });
  const filledRows = rows
    .map((row, index) => ({
      rowNumber: index + 1,
      budgetLineId: toPositiveInt(row.budgetLineId || row.budget_line_id),
      amount: getAmountForWorkflowRow(requestType, row),
      hasExplicitAmount:
        requestType === 'Settlement'
          ? hasExplicitMoneyValue(row, ['settlement', 'settlement_amount', 'settlementamount'])
          : getAmountForWorkflowRow(requestType, row) > 0,
    }))
    .filter((row) => row.hasExplicitAmount && (requestType === 'Settlement' || row.amount > 0));

  if (!filledRows.length) return;

  const missingBudgetLineRows = filledRows
    .filter((row) => !row.budgetLineId)
    .map((row) => row.rowNumber);
  if (missingBudgetLineRows.length) {
    throw new Error(
      `Please select a valid approved budget head and sub-head for row ${missingBudgetLineRows.join(', ')}`,
    );
  }

  const uniqueLineIds = Array.from(
    new Set(filledRows.map((row) => row.budgetLineId).filter(Boolean)),
  );
  if (!uniqueLineIds.length) return;

  const targetFiscalYear =
    requestType === 'Settlement'
      ? await getFinanceCarryForwardTargetYear(conn, financeRequestId, budgetFiscalYear)
      : null;
  if (targetFiscalYear) {
    const approvedRows = await getApprovedCarryForwardFiscalYearBudgets({
      connOrDb: conn,
      financeRequestId,
      fiscalYear: targetFiscalYear,
    });
    const approvedLineIds = new Set(
      approvedRows.map((row) => toPositiveInt(row.budgetLineId)).filter(Boolean),
    );
    const invalidRows = filledRows
      .filter((row) => row.budgetLineId && !approvedLineIds.has(row.budgetLineId))
      .map((row) => row.rowNumber);

    if (invalidRows.length) {
      throw new Error(
        `Please select a valid FY ${targetFiscalYear}-${String(targetFiscalYear + 1).slice(2)} approved budget head and sub-head for row ${invalidRows.join(', ')}`,
      );
    }
    return;
  }

  const placeholders = uniqueLineIds.map(() => '?').join(', ');
  const [linkedRows] = await conn.execute(
    `SELECT DISTINCT budget_line_id
       FROM finance_budget_breakup
      WHERE finance_id = ?
        AND budget_line_id IN (${placeholders})`,
    [financeRequestId, ...uniqueLineIds],
  );

  const approvedLineIds = new Set(
    linkedRows.map((row) => toPositiveInt(row.budget_line_id)).filter(Boolean),
  );
  const invalidRows = filledRows
    .filter((row) => row.budgetLineId && !approvedLineIds.has(row.budgetLineId))
    .map((row) => row.rowNumber);

  if (invalidRows.length) {
    throw new Error(
      `Please select a valid approved budget head and sub-head for row ${invalidRows.join(', ')}`,
    );
  }
}

async function assertExpenditureRowsWithinApprovedHeadTotals(
  conn,
  financeRequestId,
  expenditureRows = [],
  { excludeExpenditureId = null } = {},
) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  const filledRows = [];
  for (const [index, row] of (Array.isArray(expenditureRows) ? expenditureRows : []).entries()) {
    const budgetHead = normalizeText(row.budgetHead || row.budget_head);
    const ids = await resolveCatalogIds(conn, budgetHead, row.subHead || row.sub_head);
    filledRows.push({
      rowNumber: index + 1,
      budgetHead,
      headKey: normalizeBudgetHeadKey(budgetHead),
      budgetHeadId: toPositiveInt(ids.budget_head_id),
      amount: getAmountForWorkflowRow('Expenditure', row),
    });
  }
  const amountRows = filledRows.filter((row) => row.amount > 0);

  if (!normalizedFinanceRequestId || !amountRows.length) return;

  const missingHeadRows = amountRows.filter((row) => !row.headKey).map((row) => row.rowNumber);
  if (missingHeadRows.length) {
    throw new Error(
      `Please select a valid approved budget head for row ${missingHeadRows.join(', ')}`,
    );
  }

  const [approvedRows] = await conn.execute(
    `SELECT
       fbb.budget_line_id,
       COALESCE(fbb.budget_head_id, bpl.budget_head_id) AS budget_head_id,
       COALESCE(NULLIF(TRIM(fbb.budget_head), ''), bpl.budget_head, '') AS budget_head,
       ${FINANCE_BREAKUP_APPROVED_BASE_SQL} AS approved_amount
     FROM finance_budget_breakup fbb
     LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
     WHERE fbb.finance_id = ?
     FOR UPDATE`,
    [normalizedFinanceRequestId],
  );

  const approvedByHead = new Map();
  const lineIdsByHead = new Map();
  const canonicalKeyByAlias = new Map();

  const addAlias = (alias, canonicalKey) => {
    if (alias && canonicalKey && !canonicalKeyByAlias.has(alias)) {
      canonicalKeyByAlias.set(alias, canonicalKey);
    }
  };

  for (const row of approvedRows) {
    const catalogHeadId = toPositiveInt(row.budget_head_id);
    const textHeadKey = normalizeBudgetHeadKey(row.budget_head);
    const canonicalKey = catalogHeadId ? `id:${catalogHeadId}` : `text:${textHeadKey}`;
    if (!canonicalKey) continue;

    addAlias(canonicalKey, canonicalKey);
    const legacyTextKey = textHeadKey ? `text:${textHeadKey}` : '';
    if (legacyTextKey) addAlias(legacyTextKey, canonicalKey);

    approvedByHead.set(
      canonicalKey,
      toMoney((approvedByHead.get(canonicalKey) || 0) + toMoney(row.approved_amount)),
    );

    const lineId = toPositiveInt(row.budget_line_id);
    if (lineId) {
      if (!lineIdsByHead.has(canonicalKey)) {
        lineIdsByHead.set(canonicalKey, new Set());
      }
      lineIdsByHead.get(canonicalKey).add(lineId);
    }
  }

  const requestedByHead = new Map();
  const headLabelByKey = new Map();
  const rowKeyByNumber = new Map();
  for (const row of amountRows) {
    const rawKey = row.budgetHeadId ? `id:${row.budgetHeadId}` : `text:${row.headKey}`;
    const canonicalKey = canonicalKeyByAlias.get(rawKey) || rawKey;
    rowKeyByNumber.set(row.rowNumber, canonicalKey);
    requestedByHead.set(
      canonicalKey,
      toMoney((requestedByHead.get(canonicalKey) || 0) + row.amount),
    );
    if (!headLabelByKey.has(canonicalKey)) {
      headLabelByKey.set(canonicalKey, row.budgetHead || row.headKey);
    }
  }

  const usageByLineId = await getFinanceRequestBudgetUsageByLine(conn, {
    financeRequestId: normalizedFinanceRequestId,
    budgetLineIds: Array.from(
      new Set(Array.from(lineIdsByHead.values()).flatMap((lineIds) => Array.from(lineIds))),
    ),
    excludeExpenditureId,
  });

  for (const [headKey, requestedAmount] of requestedByHead.entries()) {
    const approvedAmount = toMoney(approvedByHead.get(headKey));
    const usedAmount = Array.from(lineIdsByHead.get(headKey) || []).reduce(
      (sum, lineId) => toMoney(sum + toMoney(usageByLineId.get(lineId))),
      0,
    );
    const remainingAmount = toMoney(Math.max(0, approvedAmount - usedAmount));

    if (approvedAmount <= 0) {
      const rowNumbers = amountRows
        .filter((row) => rowKeyByNumber.get(row.rowNumber) === headKey)
        .map((row) => row.rowNumber);
      throw new Error(
        `Please select a valid approved budget head for row ${rowNumbers.join(', ')}`,
      );
    }

    if (requestedAmount > remainingAmount) {
      const firstRow = amountRows.find((row) => rowKeyByNumber.get(row.rowNumber) === headKey);
      throw new Error(
        `Requested expenditure ${requestedAmount.toFixed(2)} exceeds remaining budget ${remainingAmount.toFixed(2)} for "${firstRow?.budgetHead || headLabelByKey.get(headKey) || headKey}"`,
      );
    }
  }
}

async function assertRequestTotalWithinApprovedFinanceAmount(
  conn,
  financeRequestId,
  requestType,
  requestedAmount,
) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  const normalizedRequestType = normalizeRequestType(requestType);
  const normalizedRequestedAmount = toMoney(requestedAmount);

  if (
    !normalizedFinanceRequestId ||
    !['Advance', 'Settlement', 'Expenditure'].includes(normalizedRequestType) ||
    normalizedRequestedAmount <= 0
  ) {
    return;
  }

  const [rows] = await conn.execute(
    `SELECT COALESCE(
       NULLIF(fr.approved_total_amount, 0),
       NULLIF(fr.total_budget, 0),
       NULLIF(fr.proposed_amount, 0),
       0
     ) AS approved_amount
       FROM finance_requests fr
      WHERE fr.id = ?
      LIMIT 1`,
    [normalizedFinanceRequestId],
  );

  const approvedAmount = toMoney(rows?.[0]?.approved_amount);

  if (approvedAmount > 0 && normalizedRequestedAmount > approvedAmount) {
    throw new Error(
      `Total ${normalizedRequestType.toLowerCase()} amount ${normalizedRequestedAmount.toFixed(2)} exceeds approved finance amount ${approvedAmount.toFixed(2)}`,
    );
  }
}

async function applyBudgetUsageDelta(conn, usageRows = [], multiplier = 1) {
  for (const usageRow of usageRows) {
    const budgetLineId = toPositiveInt(usageRow.budgetLineId);
    const amount = toMoney(usageRow.amount) * multiplier;
    if (!budgetLineId || amount === 0) continue;

    await conn.execute(
      `INSERT INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)
       ON DUPLICATE KEY UPDATE budget_line_id = budget_line_id`,
      [budgetLineId],
    );

    await conn.execute(
      `UPDATE finance_budget_line_usage
          SET consumed_amount = GREATEST(0, consumed_amount + ?),
              updated_at = CURRENT_TIMESTAMP
        WHERE budget_line_id = ?`,
      [amount, budgetLineId],
    );
  }
}

async function getRemainingBudgetByLine(
  conn,
  financeRequestId,
  budgetLineIds = [],
  { excludeExpenditureId = null, budgetFiscalYear = null } = {},
) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  const normalizedBudgetLineIds = Array.from(
    new Set(
      (Array.isArray(budgetLineIds) ? budgetLineIds : [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean),
    ),
  );

  if (!normalizedFinanceRequestId || normalizedBudgetLineIds.length === 0) {
    return new Map();
  }

  const targetFiscalYear = await getFinanceCarryForwardTargetYear(
    conn,
    normalizedFinanceRequestId,
    budgetFiscalYear,
  );
  if (targetFiscalYear) {
    const approvedRows = await getApprovedCarryForwardFiscalYearBudgets({
      connOrDb: conn,
      financeRequestId: normalizedFinanceRequestId,
      fiscalYear: targetFiscalYear,
      excludeExpenditureId,
    });
    return new Map(
      approvedRows
        .filter((row) => normalizedBudgetLineIds.includes(toPositiveInt(row.budgetLineId)))
        .map((row) => [
          toPositiveInt(row.budgetLineId),
          {
            approvedAmount: toMoney(row.totalAmount),
            usedAmount: toMoney(row.usedAmount),
            remainingAmount: toMoney(row.remainingAmount),
          },
        ]),
    );
  }

  const usageByLineId = await getFinanceRequestBudgetUsageByLine(conn, {
    financeRequestId: normalizedFinanceRequestId,
    budgetLineIds: normalizedBudgetLineIds,
    excludeExpenditureId,
  });

  const placeholders = normalizedBudgetLineIds.map(() => '?').join(', ');
  const [budgetRows] = await conn.execute(
    `SELECT
     fbb.budget_line_id,
     SUM(${FINANCE_BREAKUP_APPROVED_BASE_SQL}) AS approved_amount,
     0 AS used_amount,
     SUM(${FINANCE_BREAKUP_APPROVED_BASE_SQL}) AS remaining_amount
   FROM finance_budget_breakup fbb
   LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
   WHERE fbb.finance_id = ?
     AND fbb.budget_line_id IN (${placeholders})
   GROUP BY fbb.budget_line_id
   FOR UPDATE`,
    [normalizedFinanceRequestId, ...normalizedBudgetLineIds],
  );
  return new Map(
    budgetRows.map((row) => [
      toPositiveInt(row.budget_line_id),
      {
        approvedAmount: toMoney(row.approved_amount),
        usedAmount: toMoney(usageByLineId.get(toPositiveInt(row.budget_line_id))),
        remainingAmount: toMoney(
          Math.max(
            0,
            toMoney(row.approved_amount) -
              toMoney(usageByLineId.get(toPositiveInt(row.budget_line_id))),
          ),
        ),
      },
    ]),
  );
}

function buildBudgetSnapshotsByLine(requestType, usageRows = [], remainingByLineId = new Map()) {
  const snapshots = new Map();
  const defaultDirection = requestType === 'Settlement' ? 0 : -1;
  const deltasByLine = new Map();

  for (const usageRow of usageRows) {
    const budgetLineId = toPositiveInt(usageRow.budgetLineId);
    const amount = toMoney(usageRow.amount);
    const direction = Number.isFinite(Number(usageRow.direction))
      ? Number(usageRow.direction)
      : defaultDirection;
    if (!budgetLineId || amount <= 0) continue;
    deltasByLine.set(
      budgetLineId,
      toMoney((deltasByLine.get(budgetLineId) || 0) + direction * amount),
    );
  }

  for (const [budgetLineId, amountDelta] of deltasByLine.entries()) {
    const budgetState = remainingByLineId.get(budgetLineId);
    if (!budgetLineId || !budgetState) continue;

    const availableBefore = toMoney(budgetState.remainingAmount);
    const remainingAfter = toMoney(Math.max(0, availableBefore + amountDelta));

    snapshots.set(budgetLineId, {
      budgetAmount: availableBefore,
      availableAmountSnapshot: availableBefore,
      remainingAmountSnapshot: remainingAfter,
    });
  }

  return snapshots;
}

export async function createExpenditureRequest(data, userId, uploads = {}) {
  return withTransaction(async (conn) => {
    const uid = toPositiveInt(userId);
    if (!uid) {
      throw new Error('Invalid user context');
    }

    const requestType = inferRequestType(data);
    if (!requestType) {
      throw new Error('Invalid request type. Expected Advance, Settlement, or Expenditure.');
    }

    const employeeId = toPositiveInt(data.employee_id);
    let departmentId = null;
    let employee = null;
    if (employeeId) {
      const [rows] = await conn.execute(
        `SELECT e.id, e.department_id, e.email, e.mobile, e.title, e.first_name, e.last_name,
                e.designation, d.name AS department
           FROM master_employees e
           LEFT JOIN master_departments d ON d.id = e.department_id
          WHERE e.id = ?
            AND e.status = 'Active'
          LIMIT 1`,
        [employeeId],
      );
      employee = rows[0] || null;
      departmentId = toPositiveInt(employee?.department_id);
    }

    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id ?? departmentId,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    const requestDate = data.request_date
      ? new Date(data.request_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const financeRequestId = toPositiveInt(data.finance_request_id);
    if (!financeRequestId) {
      throw new Error('finance_request_id is required');
    }

    const financeOwner = await getApprovedFinanceRequestOwner(conn, financeRequestId);
    if (!financeOwner) {
      throw new Error('Finance request not found or not approved');
    }
    if (!isFinanceRequestOwner(financeOwner, uid)) {
      throw new Error('Access denied for this finance request');
    }

    const paymentDetails = data.payment_details || {};
    const advanceRows = Array.isArray(data.advance_rows)
      ? data.advance_rows
      : Array.isArray(data.advancerows)
        ? data.advancerows
        : [];

    const settlementRows = Array.isArray(data.settlement_rows)
      ? data.settlement_rows
      : Array.isArray(data.settlementrows)
        ? data.settlementrows
        : [];

    const expenditureRows = Array.isArray(data.expenditure_rows)
      ? data.expenditure_rows
      : Array.isArray(data.expenditurerows)
        ? data.expenditurerows
        : [];

    const payeeRows = Array.isArray(data.payee_rows)
      ? data.payee_rows
      : Array.isArray(data.payeerows)
        ? data.payeerows
        : [];

    const incomeRows = Array.isArray(data.income_rows)
      ? data.income_rows
      : Array.isArray(data.incomerows)
        ? data.incomerows
        : [];
    const budgetFiscalYear = toPositiveInt(data.budget_fiscal_year || data.budgetFiscalYear);
    await assertWorkflowRowsHaveApprovedBudgetLines(
      conn,
      financeRequestId,
      requestType,
      {
        advanceRows,
        settlementRows,
        expenditureRows,
      },
      {
        budgetFiscalYear,
      },
    );
    const workflowRowIdentity = resolveWorkflowRowIdentifiers(data);
    const sourceRequestId = toPositiveInt(data.source_request_id || data.sourceRequestId);

    const advanceTotal = advanceRows.reduce(
      (sum, row) => sum + toMoney(row.advance || row.advance_amount),
      0,
    );
    const settlementTotal = settlementRows.reduce(
      (sum, row) => sum + toMoney(row.settlement || row.settlement_amount),
      0,
    );
    const expenditureTotal = expenditureRows.reduce(
      (sum, row) => sum + toMoney(row.autoSum || row.expenditure || row.auto_sum_amount),
      0,
    );
    const normalizedUnplanned = normalizeUnplannedBudgetPayload(data);
    const usageRows = addUnplannedUsageRows(
      collectUsageRowsForRequestType(requestType, {
        advanceRows,
        settlementRows,
        expenditureRows,
      }),
      normalizedUnplanned,
    );
    const activeRequestTotal = toMoney(
      (requestType === 'Advance'
        ? advanceTotal
        : requestType === 'Settlement'
          ? settlementTotal
          : expenditureTotal) + normalizedUnplanned.amount,
    );
    const totalAmount = toMoney(
      advanceTotal + settlementTotal + expenditureTotal + normalizedUnplanned.amount,
    );
    const workflowRowHistory = await getWorkflowRowHistory(conn, {
      financeRequestId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
    });
    const allowZeroSettlement =
      requestType === 'Settlement' && hasSettlementRowsForClosure(settlementRows);

    validateWorkflowRowFlow(requestType, workflowRowHistory, {
      requestedAdvance: requestType === 'Advance' ? activeRequestTotal : advanceTotal,
      requestedSettlement: requestType === 'Settlement' ? activeRequestTotal : settlementTotal,
      requestedExpenditure: requestType === 'Expenditure' ? activeRequestTotal : expenditureTotal,
      allowZeroSettlement,
    });

    await assertSettlementPayeesMatchAdjustment(conn, {
      requestType,
      settlementRows,
      payeeRows,
      normalizedUnplanned,
      userId: uid,
      financeRequestId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
    });

    await assertRequestTotalWithinApprovedFinanceAmount(
      conn,
      financeRequestId,
      requestType,
      activeRequestTotal,
    );
    if (requestType === 'Expenditure') {
      await assertExpenditureRowsWithinApprovedHeadTotals(conn, financeRequestId, expenditureRows);
    }
    if (usageRows.length) {
      const remainingByLineId = await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
        { budgetFiscalYear },
      );

      assertUsageRowsWithinRemainingBudget(requestType, usageRows, remainingByLineId);
    }

    const budgetSnapshotsByLine = buildBudgetSnapshotsByLine(
      requestType,
      usageRows,
      await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
        {
          budgetFiscalYear,
        },
      ),
    );

    const entry = {
      finance_request_id: financeRequestId,
      employee_id: employeeId || null,
      applicant_name:
        normalizeText(data.applicant_name) ||
        (employee
          ? `${normalizeText(employee.title)} ${normalizeText(employee.first_name)} ${normalizeText(employee.last_name)}`.trim()
          : null),
      designation: normalizeText(data.designation) || normalizeText(employee?.designation) || null,
      department: normalizeText(data.department) || normalizeText(employee?.department) || null,
      email: normalizeText(data.email) || normalizeText(employee?.email) || null,
      mobile: normalizeText(data.mobile) || normalizeText(employee?.mobile) || null,
      request_date: requestDate,
      description: normalizeText(data.description) || null,
      beneficiary_type:
        normalizeBeneficiaryType(data.beneficiary_type) ||
        normalizeText(data.beneficiary_type) ||
        'Individual Faculty',
      beneficiary_value: normalizeText(data.beneficiary_value) || null,
      budget_tag: normalizeText(data.budget_tag) || null,
      department_id: workflowContext.departmentId || departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head: normalizeText(data.primary_head) || 'General',
      event_sub_head: normalizeText(data.event_sub_head) || null,
      request_type: requestType,
      is_budget_proposed: normalizeText(data.is_budget_proposed) === 'Yes' ? 'Yes' : 'No',
      proposed_amount: moneyOrNull(data.proposed_amount),
      balance_amount: moneyOrNull(data.balance_amount),
      unplanned_budget_enabled: normalizedUnplanned.enabled ? 1 : 0,
      unplanned_budget_amount: normalizedUnplanned.enabled ? normalizedUnplanned.amount : null,
      unplanned_head_of_account: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccount
        : null,
      unplanned_head_of_account_budget_line_id: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccountBudgetLineId
        : null,
      unplanned_head_of_account_budget_proposal_id: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccountBudgetProposalId
        : null,
      unplanned_budget_head: normalizedUnplanned.enabled ? normalizedUnplanned.head : null,
      unplanned_budget_sub_head: normalizedUnplanned.enabled ? normalizedUnplanned.subHead : null,
      unplanned_budget_description: normalizedUnplanned.enabled
        ? normalizedUnplanned.description
        : null,
      income_type: normalizeText(data.income_type) || null,
      income_status: normalizeText(data.income_status) || null,
      income_amount_type: normalizeText(data.income_amount_type) || null,
      credit_status: normalizeText(data.credit_status) || null,
      debit_status: normalizeDebitStatus(data.debit_status),
      partial_amount: moneyOrNull(data.partial_amount),
      // DB column keeps its original name; the API/UI field is show_bulk_transaction.
      show_bulk_neft:
        parseBoolean(data.show_bulk_transaction) || Boolean(uploads.bulkTransactionFile) ? 1 : 0,
      payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
      payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
      payment_date: paymentDetails.date || data.payment_date || null,
      payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status),
      payment_debit_account:
        normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
      workflow_state: JSON.stringify({
        module: normalizeRequestType(requestType),
        workflowrowref: workflowRowIdentity.workflowRowRef,
        dashboardRowId: workflowRowIdentity.dashboardRowId,
        rowIndex: workflowRowIdentity.rowIndex,
        workflowbudgetlineid: toPositiveInt(data.workflowbudgetlineid),
        workflowbudgetproposalid: toPositiveInt(data.workflowbudgetproposalid),
        sourceRequestId,
      }),
      advance_total_amount: toMoney(advanceTotal),
      settlement_total_amount: toMoney(settlementTotal),
      expenditure_total_amount: toMoney(expenditureTotal),
      settlement_remarks:
        requestType === 'Settlement' ? normalizeText(data.settlement_remarks) || null : null,
      expenditure_remarks:
        requestType === 'Expenditure' ? normalizeText(data.expenditure_remarks) || null : null,
      tentative_settlement_date:
        requestType === 'Advance'
          ? normalizeSqlDate(data.tentative_settlement_date || data.tentativeSettlementDate)
          : null,
      total_amount: totalAmount,
      approved_total_amount: 0.0,
      created_by: uid,
      overall_status: 'pending',
    };

    const hasPrimaryHeadIdColumn = await hasExpenditureRequestColumn('primary_head_id', {
      tx: conn,
    });
    const hasEventSubHeadIdColumn = await hasExpenditureRequestColumn('event_sub_head_id', {
      tx: conn,
    });
    const hasUnplannedHeadOfAccountColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account',
      { tx: conn },
    );
    const hasUnplannedHeadOfAccountBudgetLineIdColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account_budget_line_id',
      { tx: conn },
    );
    const hasUnplannedHeadOfAccountBudgetProposalIdColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account_budget_proposal_id',
      { tx: conn },
    );
    if (!hasUnplannedHeadOfAccountColumn) delete entry.unplanned_head_of_account;
    if (!hasUnplannedHeadOfAccountBudgetLineIdColumn)
      delete entry.unplanned_head_of_account_budget_line_id;
    if (!hasUnplannedHeadOfAccountBudgetProposalIdColumn)
      delete entry.unplanned_head_of_account_budget_proposal_id;
    if (hasPrimaryHeadIdColumn || hasEventSubHeadIdColumn) {
      // NEW: resolve and attach catalog IDs (Phase 2 of catalog ref hardening).
      // LEGACY: nulls when the catalog has no matching name.
      const headerIds = await resolvePrimaryHeadIds(conn, entry.primary_head, entry.event_sub_head);
      if (hasPrimaryHeadIdColumn) entry.primary_head_id = headerIds.primary_head_id;
      if (hasEventSubHeadIdColumn) entry.event_sub_head_id = headerIds.event_sub_head_id;
    }

    const filteredEntry = Object.fromEntries(
      Object.entries(entry).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      ),
    );
    const entryKeys = Object.keys(filteredEntry);
    const entryValues = Object.values(filteredEntry);

    const [result] = await conn.execute(
      `INSERT INTO expenditure_requests (${entryKeys.map((key) => `\`${key}\``).join(', ')})
       VALUES (${entryKeys.map(() => '?').join(', ')})`,
      entryValues,
    );
    const expenditureId = result.insertId;

    const ref = await insertExpenditureRef(conn, {
      expenditureId,
      financeRequestId,
      requestDate,
      requestType,
      workflowRowHistory,
      rowIndex: workflowRowIdentity.rowIndex,
    });

    await insertIncomeRows(conn, expenditureId, incomeRows);
    await insertPayeeRows(conn, expenditureId, payeeRows, userId);
    await insertAdvanceRows(conn, expenditureId, advanceRows, userId, budgetSnapshotsByLine, {
      financeRequestId,
      rowIndex: workflowRowIdentity.rowIndex,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      sourceRequestId,
    });
    await insertSettlementRows(conn, expenditureId, settlementRows, budgetSnapshotsByLine, {
      userId: uid,
      financeRequestId,
      rowIndex: workflowRowIdentity.rowIndex,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      sourceRequestId,
    });
    await insertExpenditureRows(
      conn,
      expenditureId,
      expenditureRows,
      budgetSnapshotsByLine,
      financeRequestId,
    );
    await insertUnplannedRows(conn, expenditureId, normalizedUnplanned.rows);
    await insertBillFiles(conn, expenditureId, uploads.billFiles);
    await insertBillFiles(conn, expenditureId, uploads.paymentProofFiles, 'payment_proof');
    await linkFinanceAnnexuresToExpenditure(conn, expenditureId, financeRequestId);
    await upsertBulkTransactionFile(conn, expenditureId, uploads.bulkTransactionFile, {
      templateVersion: data.bulk_transaction_template_version,
      transactionType: data.bulk_transaction_type,
      bankCode: data.bulk_transaction_bank,
      fileRetained: data.bulk_transaction_file_retained,
    });

    return { expenditureId, requestRef: ref };
  });
}

export async function updateExpenditureRequest(
  expenditureId,
  data,
  userId,
  uploads = {},
  options = {},
) {
  const normalizedExpenditureId = toPositiveInt(expenditureId);
  if (!normalizedExpenditureId) {
    throw new Error('Invalid expenditure request ID');
  }

  const canBypassFinanceOwnerCheck = Boolean(
    options?.isSuperAdmin ||
    options?.isWorkflowEditor ||
    options?.actor?.isSuperAdmin ||
    options?.actor?.is_super_admin ||
    normalizeText(options?.actor?.role).toLowerCase() === 'super_admin' ||
    (Array.isArray(options?.actor?.roles) &&
      options.actor.roles.some((role) => normalizeText(role).toLowerCase() === 'super_admin')),
  );

  return withTransaction(async (conn) => {
    const uid = toPositiveInt(userId);
    if (!uid) {
      throw new Error('Invalid user context');
    }

    const [existingRows] = await conn.execute(
      `SELECT er.id,
              er.finance_request_id,
              COALESCE(err.request_ref, CONCAT('#EX-', YEAR(COALESCE(er.request_date, er.created_at)), '-', LPAD(er.id, 4, '0'))) AS request_ref,
              er.request_type,
              er.workflow_state,
              er.overall_status
         FROM expenditure_requests er
    LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
        WHERE er.id = ?
        LIMIT 1
        FOR UPDATE`,
      [normalizedExpenditureId],
    );

    const existingRecord = existingRows[0] || null;
    if (!existingRecord) {
      throw new Error('Expenditure request not found');
    }

    const requestType = inferRequestType(data) || normalizeRequestType(existingRecord.request_type);
    if (!requestType) {
      throw new Error('Invalid request type. Expected Advance, Settlement, or Expenditure.');
    }

    const employeeId = toPositiveInt(data.employee_id);
    let departmentId = null;
    let employee = null;
    if (employeeId) {
      const [rows] = await conn.execute(
        `SELECT e.id, e.department_id, e.email, e.mobile, e.title, e.first_name, e.last_name,
                e.designation, d.name AS department
           FROM master_employees e
           LEFT JOIN master_departments d ON d.id = e.department_id
          WHERE e.id = ?
            AND e.status = 'Active'
          LIMIT 1`,
        [employeeId],
      );
      employee = rows[0] || null;
      departmentId = toPositiveInt(employee?.department_id);
    }

    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id ?? departmentId,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    const requestDate = data.request_date
      ? new Date(data.request_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const financeRequestId =
      toPositiveInt(data.finance_request_id) || toPositiveInt(existingRecord.finance_request_id);
    if (!financeRequestId) {
      throw new Error('finance_request_id is required');
    }

    const financeOwner = await getApprovedFinanceRequestOwner(conn, financeRequestId);
    if (!financeOwner) {
      throw new Error('Finance request not found or not approved');
    }
    if (!canBypassFinanceOwnerCheck && !isFinanceRequestOwner(financeOwner, uid)) {
      throw new Error('Access denied for this finance request');
    }

    const paymentDetails = data.payment_details || {};
    const advanceRows = Array.isArray(data.advance_rows)
      ? data.advance_rows
      : Array.isArray(data.advancerows)
        ? data.advancerows
        : [];
    const settlementRows = Array.isArray(data.settlement_rows)
      ? data.settlement_rows
      : Array.isArray(data.settlementrows)
        ? data.settlementrows
        : [];
    const expenditureRows = Array.isArray(data.expenditure_rows)
      ? data.expenditure_rows
      : Array.isArray(data.expenditurerows)
        ? data.expenditurerows
        : [];
    const payeeRows = Array.isArray(data.payee_rows)
      ? data.payee_rows
      : Array.isArray(data.payeerows)
        ? data.payeerows
        : [];
    const incomeRows = Array.isArray(data.income_rows)
      ? data.income_rows
      : Array.isArray(data.incomerows)
        ? data.incomerows
        : [];
    const budgetFiscalYear = toPositiveInt(data.budget_fiscal_year || data.budgetFiscalYear);
    await assertWorkflowRowsHaveApprovedBudgetLines(
      conn,
      financeRequestId,
      requestType,
      {
        advanceRows,
        settlementRows,
        expenditureRows,
      },
      {
        budgetFiscalYear,
      },
    );

    const workflowRowIdentity = resolveWorkflowRowIdentifiers(data);
    const sourceRequestId = toPositiveInt(data.source_request_id || data.sourceRequestId);
    const advanceTotal = advanceRows.reduce(
      (sum, row) => sum + toMoney(row.advance || row.advance_amount),
      0,
    );
    const settlementTotal = settlementRows.reduce(
      (sum, row) => sum + toMoney(row.settlement || row.settlement_amount),
      0,
    );
    const expenditureTotal = expenditureRows.reduce(
      (sum, row) => sum + toMoney(row.autoSum || row.expenditure || row.auto_sum_amount),
      0,
    );
    const normalizedUnplanned = normalizeUnplannedBudgetPayload(data);
    const usageRows = addUnplannedUsageRows(
      collectUsageRowsForRequestType(requestType, {
        advanceRows,
        settlementRows,
        expenditureRows,
      }),
      normalizedUnplanned,
    );
    const activeRequestTotal = toMoney(
      (requestType === 'Advance'
        ? advanceTotal
        : requestType === 'Settlement'
          ? settlementTotal
          : expenditureTotal) + normalizedUnplanned.amount,
    );
    const totalAmount = toMoney(
      advanceTotal + settlementTotal + expenditureTotal + normalizedUnplanned.amount,
    );

    const workflowRowHistory = await getWorkflowRowHistory(conn, {
      financeRequestId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
    });
    const allowZeroSettlement =
      requestType === 'Settlement' && hasSettlementRowsForClosure(settlementRows);

    if (requestType === 'Advance' && activeRequestTotal <= 0) {
      throw new Error('Advance amount must be greater than 0');
    }
    if (
      requestType === 'Settlement' &&
      (activeRequestTotal < 0 || (activeRequestTotal === 0 && !allowZeroSettlement))
    ) {
      throw new Error('Settlement amount must be greater than 0');
    }
    if (requestType === 'Expenditure' && activeRequestTotal <= 0) {
      throw new Error('Expenditure amount must be greater than 0');
    }

    const filteredWorkflowHistory = workflowRowHistory.filter(
      (row) => row.id !== normalizedExpenditureId,
    );
    if (filteredWorkflowHistory.length) {
      const currentRequestType = normalizeText(existingRecord.request_type);
      const hasAdvance = filteredWorkflowHistory.some((row) => row.requestType === 'Advance');
      const hasSettlement = filteredWorkflowHistory.some((row) => row.requestType === 'Settlement');
      const hasExpenditure = filteredWorkflowHistory.some(
        (row) => row.requestType === 'Expenditure',
      );
      if (requestType === 'Advance') {
        if (hasExpenditure) {
          throw new Error('Expenditure already exists for this row. Create a new row for advance.');
        }
        if (hasSettlement) {
          throw new Error(
            'Settlement already exists for this row. Create a new row for another advance.',
          );
        }
      } else if (requestType === 'Settlement') {
        if (!hasAdvance && currentRequestType !== 'Settlement') {
          throw new Error('Settlement requires an existing advance on the same row.');
        }
        if (hasExpenditure) {
          throw new Error('Settlement cannot be created for an expenditure row.');
        }
      }
    }

    await assertSettlementPayeesMatchAdjustment(conn, {
      requestType,
      settlementRows,
      payeeRows,
      normalizedUnplanned,
      userId: uid,
      financeRequestId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      excludeExpenditureId: normalizedExpenditureId,
    });

    await assertRequestTotalWithinApprovedFinanceAmount(
      conn,
      financeRequestId,
      requestType,
      activeRequestTotal,
    );
    if (requestType === 'Expenditure') {
      await assertExpenditureRowsWithinApprovedHeadTotals(conn, financeRequestId, expenditureRows, {
        excludeExpenditureId: normalizedExpenditureId,
      });
    }
    if (usageRows.length) {
      const remainingByLineId = await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
        { excludeExpenditureId: normalizedExpenditureId, budgetFiscalYear },
      );

      assertUsageRowsWithinRemainingBudget(requestType, usageRows, remainingByLineId);
    }

    const budgetSnapshotsByLine = buildBudgetSnapshotsByLine(
      requestType,
      usageRows,
      await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
        {
          excludeExpenditureId: normalizedExpenditureId,
          budgetFiscalYear,
        },
      ),
    );

    const normalizedPaymentDate = normalizeSqlDate(paymentDetails.date || data.payment_date);

    const updatedEntry = {
      finance_request_id: financeRequestId,
      employee_id: employeeId || null,
      applicant_name:
        normalizeText(data.applicant_name) ||
        (employee
          ? `${normalizeText(employee.title)} ${normalizeText(employee.first_name)} ${normalizeText(employee.last_name)}`.trim()
          : null),
      designation: normalizeText(data.designation) || normalizeText(employee?.designation) || null,
      department: normalizeText(data.department) || normalizeText(employee?.department) || null,
      email: normalizeText(data.email) || normalizeText(employee?.email) || null,
      mobile: normalizeText(data.mobile) || normalizeText(employee?.mobile) || null,
      request_date: requestDate,
      description: normalizeText(data.description) || null,
      beneficiary_type:
        normalizeBeneficiaryType(data.beneficiary_type) ||
        normalizeText(data.beneficiary_type) ||
        'Individual Faculty',
      beneficiary_value: normalizeText(data.beneficiary_value) || null,
      budget_tag: normalizeText(data.budget_tag) || null,
      department_id: workflowContext.departmentId || departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head: normalizeText(data.primary_head) || 'General',
      event_sub_head: normalizeText(data.event_sub_head) || null,
      request_type: requestType,
      is_budget_proposed: normalizeText(data.is_budget_proposed) === 'Yes' ? 'Yes' : 'No',
      proposed_amount: moneyOrNull(data.proposed_amount),
      balance_amount: moneyOrNull(data.balance_amount),
      unplanned_budget_enabled: normalizedUnplanned.enabled ? 1 : 0,
      unplanned_budget_amount: normalizedUnplanned.enabled ? normalizedUnplanned.amount : null,
      unplanned_head_of_account: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccount
        : null,
      unplanned_head_of_account_budget_line_id: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccountBudgetLineId
        : null,
      unplanned_head_of_account_budget_proposal_id: normalizedUnplanned.enabled
        ? normalizedUnplanned.headOfAccountBudgetProposalId
        : null,
      unplanned_budget_head: normalizedUnplanned.enabled ? normalizedUnplanned.head : null,
      unplanned_budget_sub_head: normalizedUnplanned.enabled ? normalizedUnplanned.subHead : null,
      unplanned_budget_description: normalizedUnplanned.enabled
        ? normalizedUnplanned.description
        : null,
      income_type: normalizeText(data.income_type) || null,
      income_status: normalizeText(data.income_status) || null,
      income_amount_type: normalizeText(data.income_amount_type) || null,
      credit_status: normalizeText(data.credit_status) || null,
      debit_status: normalizeDebitStatus(data.debit_status),
      partial_amount: moneyOrNull(data.partial_amount),
      // DB column keeps its original name; the API/UI field is show_bulk_transaction.
      show_bulk_neft:
        parseBoolean(data.show_bulk_transaction) || Boolean(uploads.bulkTransactionFile) ? 1 : 0,
      payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
      payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
      payment_date: normalizedPaymentDate,
      payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status),
      payment_debit_account:
        normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
      advance_total_amount: toMoney(advanceTotal),
      settlement_total_amount: toMoney(settlementTotal),
      expenditure_total_amount: toMoney(expenditureTotal),
      settlement_remarks:
        requestType === 'Settlement' ? normalizeText(data.settlement_remarks) || null : null,
      expenditure_remarks:
        requestType === 'Expenditure' ? normalizeText(data.expenditure_remarks) || null : null,
      tentative_settlement_date:
        requestType === 'Advance'
          ? normalizeSqlDate(data.tentative_settlement_date || data.tentativeSettlementDate)
          : null,
      total_amount: totalAmount,
    };

    const hasPrimaryHeadIdColumn = await hasExpenditureRequestColumn('primary_head_id', {
      tx: conn,
    });
    const hasEventSubHeadIdColumn = await hasExpenditureRequestColumn('event_sub_head_id', {
      tx: conn,
    });
    const hasUnplannedHeadOfAccountColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account',
      { tx: conn },
    );
    const hasUnplannedHeadOfAccountBudgetLineIdColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account_budget_line_id',
      { tx: conn },
    );
    const hasUnplannedHeadOfAccountBudgetProposalIdColumn = await hasExpenditureRequestColumn(
      'unplanned_head_of_account_budget_proposal_id',
      { tx: conn },
    );
    if (!hasUnplannedHeadOfAccountColumn) delete updatedEntry.unplanned_head_of_account;
    if (!hasUnplannedHeadOfAccountBudgetLineIdColumn)
      delete updatedEntry.unplanned_head_of_account_budget_line_id;
    if (!hasUnplannedHeadOfAccountBudgetProposalIdColumn)
      delete updatedEntry.unplanned_head_of_account_budget_proposal_id;
    if (hasPrimaryHeadIdColumn || hasEventSubHeadIdColumn) {
      const headerIds = await resolvePrimaryHeadIds(
        conn,
        updatedEntry.primary_head,
        updatedEntry.event_sub_head,
      );
      if (hasPrimaryHeadIdColumn) updatedEntry.primary_head_id = headerIds.primary_head_id;
      if (hasEventSubHeadIdColumn) updatedEntry.event_sub_head_id = headerIds.event_sub_head_id;
    }

    const nullableCatalogIdKeys = new Set([
      'primary_head_id',
      'event_sub_head_id',
      'unplanned_budget_amount',
      'unplanned_head_of_account',
      'unplanned_head_of_account_budget_line_id',
      'unplanned_head_of_account_budget_proposal_id',
      'unplanned_budget_head',
      'unplanned_budget_sub_head',
      'unplanned_budget_description',
      'settlement_remarks',
      'expenditure_remarks',
    ]);
    const filteredUpdateEntry = Object.fromEntries(
      Object.entries(updatedEntry).filter(
        ([key, value]) =>
          nullableCatalogIdKeys.has(key) || (value !== null && value !== undefined && value !== ''),
      ),
    );

    if (Object.keys(filteredUpdateEntry).length) {
      const updateSql = Object.keys(filteredUpdateEntry)
        .map((key) => `\`${key}\` = ?`)
        .join(', ');
      await conn.execute(
        `UPDATE expenditure_requests
            SET ${updateSql},
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [...Object.values(filteredUpdateEntry), normalizedExpenditureId],
      );
    }

    await conn.execute('DELETE FROM expenditure_income_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);
    await conn.execute('DELETE FROM expenditure_payee_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);
    await conn.execute('DELETE FROM expenditure_advance_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);
    await conn.execute('DELETE FROM expenditure_settlement_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);
    await conn.execute('DELETE FROM expenditure_line_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);
    await conn.execute('DELETE FROM expenditure_unplanned_rows WHERE expenditure_id = ?', [
      normalizedExpenditureId,
    ]);

    if (Array.isArray(uploads.billFiles) && uploads.billFiles.length) {
      await conn.execute(
        `DELETE FROM expenditure_request_bills
          WHERE expenditure_id = ?
            AND file_category = 'bill'`,
        [normalizedExpenditureId],
      );
    }

    await insertIncomeRows(conn, normalizedExpenditureId, incomeRows);
    await insertPayeeRows(conn, normalizedExpenditureId, payeeRows, uid);
    await insertAdvanceRows(
      conn,
      normalizedExpenditureId,
      advanceRows,
      uid,
      budgetSnapshotsByLine,
      {
        financeRequestId,
        rowIndex: workflowRowIdentity.rowIndex,
        dashboardRowId: workflowRowIdentity.dashboardRowId,
        workflowRowRef: workflowRowIdentity.workflowRowRef,
        sourceRequestId,
      },
    );
    await insertSettlementRows(
      conn,
      normalizedExpenditureId,
      settlementRows,
      budgetSnapshotsByLine,
      {
        userId: uid,
        financeRequestId,
        rowIndex: workflowRowIdentity.rowIndex,
        dashboardRowId: workflowRowIdentity.dashboardRowId,
        workflowRowRef: workflowRowIdentity.workflowRowRef,
        sourceRequestId,
        excludeExpenditureId: normalizedExpenditureId,
      },
    );
    await insertExpenditureRows(
      conn,
      normalizedExpenditureId,
      expenditureRows,
      budgetSnapshotsByLine,
      financeRequestId,
    );
    await insertUnplannedRows(conn, normalizedExpenditureId, normalizedUnplanned.rows);
    await insertBillFiles(conn, normalizedExpenditureId, uploads.billFiles);
    await insertBillFiles(
      conn,
      normalizedExpenditureId,
      uploads.paymentProofFiles,
      'payment_proof',
    );
    await linkFinanceAnnexuresToExpenditure(conn, normalizedExpenditureId, financeRequestId);
    await upsertBulkTransactionFile(conn, normalizedExpenditureId, uploads.bulkTransactionFile, {
      templateVersion: data.bulk_transaction_template_version,
      transactionType: data.bulk_transaction_type,
      bankCode: data.bulk_transaction_bank,
      fileRetained: data.bulk_transaction_file_retained,
    });

    return {
      expenditureId: normalizedExpenditureId,
      requestRef: existingRecord.request_ref || null,
    };
  });
}

export async function searchApplicant(query = '', employeeType = null) {
  return searchEmployeeApplicants(query, employeeType);
}

/**
 * Fetch a single expenditure request with joined applicant and payee details.
 */
export async function getExpenditureById(id) {
  const expenditureSelect = await getExpenditureSelect();
  const [rows] = await db.execute(`${expenditureSelect} WHERE er.id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

/**
 * Bulk transaction payout file for a request, with the transaction type / bank the
 * file was prepared for. Both are selected only when the 20260810 migration has run.
 */
async function getBulkTransactionFileRow(expenditureId) {
  const optionalColumns = [];
  for (const column of ['transaction_type', 'bank_code']) {
    const exists = await hasBulkTransactionFileColumn(column);
    optionalColumns.push(exists ? `${column},` : `NULL AS ${column},`);
  }

  const [rows] = await db.execute(
    `SELECT id, template_version, ${optionalColumns.join(' ')}
            original_name, stored_name, file_path, mime_type, file_size,
            created_at, updated_at
       FROM expenditure_bulk_neft_files
      WHERE expenditure_id = ?
      LIMIT 1`,
    [expenditureId],
  );

  const row = rows[0] || null;
  if (!row) return null;

  return withUploadAccess({
    ...row,
    transaction_type: normalizeBulkTransactionType(row.transaction_type),
    bank_code: normalizeBulkTransactionBank(row.bank_code),
  });
}

export async function getExpenditureDetails(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) {
    return {
      income_rows: [],
      payee_rows: [],
      advance_rows: [],
      settlement_rows: [],
      expenditure_rows: [],
      unplanned_rows: [],
      bill_files: [],
      payment_proof_files: [],
      bulk_transaction_file: null,
      // LEGACY: pre-rename response key, kept for older clients. Remove once unused.
      bulk_neft_file: null,
    };
  }

  const [
    incomeRowsResult,
    payeeRowsResult,
    advanceRowsResult,
    settlementRowsResult,
    expenditureRowsResult,
    billFilesResult,
    paymentProofFilesResult,
    bulkTransactionFileResult,
  ] = await Promise.all([
    db.execute(
      `SELECT id, income_source, contribution, amount, status, remarks, credit_account, sort_order,
              created_at, updated_at
         FROM expenditure_income_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, payee_id, payee_name, bank_name, account_no, ifsc, branch_name, url, amount, mode,
              account_name, pan_number, account_type, beneficiary_type, beneficiary_org,
              organization_type, msme, gstin, tds_details, tds_section, sort_order,
              created_at, updated_at
         FROM expenditure_payee_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, pre_advance_amount, advance_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_advance_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, advance_amount, settlement_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_settlement_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, expenditure_input, auto_sum_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_line_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, payee_row_id, original_name, stored_name, file_path, mime_type, file_size,
              sort_order, created_at, source_finance_annexure_id
         FROM expenditure_request_bills
        WHERE expenditure_id = ?
          AND file_category = 'bill'
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, original_name, stored_name, file_path, mime_type, file_size,
              sort_order, created_at
         FROM expenditure_request_bills
        WHERE expenditure_id = ?
          AND file_category = 'payment_proof'
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    getBulkTransactionFileRow(expenditureId),
  ]);

  const [income_rows] = incomeRowsResult;
  const [payee_rows] = payeeRowsResult;
  const [advance_rows] = advanceRowsResult;
  const [settlement_rows] = settlementRowsResult;
  const [expenditure_rows] = expenditureRowsResult;
  const [bill_files] = billFilesResult;
  const [payment_proof_files] = paymentProofFilesResult;
  const bulkTransactionRow = bulkTransactionFileResult;
  let unplanned_rows = [];
  try {
    const [unplannedRowsResult] = await db.execute(
      `SELECT id, head_of_account, head_of_account_budget_line_id,
              head_of_account_budget_proposal_id, budget_head, sub_head,
              amount, description, sort_order, created_at, updated_at
         FROM expenditure_unplanned_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    );
    unplanned_rows = unplannedRowsResult;
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }

  return {
    income_rows,
    payee_rows: payee_rows.map(normalizePayeeRecord),
    advance_rows,
    settlement_rows,
    expenditure_rows,
    unplanned_rows,
    bill_files: bill_files.map(withUploadAccess),
    payment_proof_files: payment_proof_files.map(withUploadAccess),
    bulk_transaction_file: bulkTransactionRow,
    // LEGACY: pre-rename response key, kept for older clients. Remove once unused.
    bulk_neft_file: bulkTransactionRow,
  };
}

/**
 * Paginated list of expenditure requests.
 * Supports filters: mine, status, budgetLineId, requestType.
 */
export async function listExpenditures({
  userId,
  mine = false,
  status,
  budgetLineId,
  requestType,
  financeRequestId,
  page = 1,
  limit = 20,
} = {}) {
  const conditions = [];
  const params = [];

  if (mine && userId) {
    // Same rule as the expenditure dashboard, so "my requests" and the dashboard cannot
    // disagree about which claims belong to the caller. See shared/financeOwnership.js.
    conditions.push(buildFinanceOwnerCondition('er'));
    params.push(...buildFinanceOwnerParams(userId));
  }
  if (status) {
    conditions.push('LOWER(TRIM(er.overall_status)) = ?');
    params.push(normalizeText(status).toLowerCase());
  }
  const lineId = toPositiveInt(budgetLineId);
  if (lineId) {
    conditions.push(`(
      EXISTS (
        SELECT 1 FROM expenditure_advance_rows ar
         WHERE ar.expenditure_id = er.id AND ar.budget_line_id = ?
      )
      OR EXISTS (
        SELECT 1 FROM expenditure_settlement_rows sr
         WHERE sr.expenditure_id = er.id AND sr.budget_line_id = ?
      )
      OR EXISTS (
        SELECT 1 FROM expenditure_line_rows lr
         WHERE lr.expenditure_id = er.id AND lr.budget_line_id = ?
      )
    )`);
    params.push(lineId, lineId, lineId);
  }
  if (requestType) {
    conditions.push('UPPER(TRIM(er.request_type)) = ?');
    params.push(normalizeText(requestType).toUpperCase());
  }
  const financeId = toPositiveInt(financeRequestId);
  if (financeId) {
    conditions.push('er.finance_request_id = ?');
    params.push(financeId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset = (pageNum - 1) * limitNum;

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM expenditure_requests er ${where}`,
    params,
  );

  const expenditureSelect = await getExpenditureSelect();
  const [rows] = await db.execute(
    `${expenditureSelect} ${where} ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return { items: rows, total: Number(total), page: pageNum, limit: limitNum };
}

/**
 * Update scalar fields on an expenditure request (payment tracking, status, etc.).
 * Does NOT re-run budget deduction.
 */
export async function updateExpenditure(id, data, actor = null, uploads = {}) {
  const ALLOWED_UPDATE_COLUMNS = {
    description: 'description',
    payment_debit_account: 'payment_debit_account',
    payment_mode: 'payment_mode',
    payment_ref_no: 'payment_ref_no',
    payment_date: 'payment_date',
    payment_status: 'payment_status',
  };

  const update = Object.fromEntries(
    Object.entries(data)
      .filter(
        ([k, v]) =>
          Object.prototype.hasOwnProperty.call(ALLOWED_UPDATE_COLUMNS, k) && v !== undefined,
      )
      .map(([k, v]) => [k, v === '' ? null : v]),
  );

  if (Object.prototype.hasOwnProperty.call(update, 'payment_date')) {
    update.payment_date = normalizeSqlDate(update.payment_date);
  }

  if (Object.prototype.hasOwnProperty.call(update, 'payment_status')) {
    update.payment_status = normalizePaymentStatus(update.payment_status);
  }

  const paymentProofFiles = Array.isArray(uploads.paymentProofFiles)
    ? uploads.paymentProofFiles
    : [];

  if (!Object.keys(update).length && !paymentProofFiles.length) {
    return { affectedRows: 0, payment_proof_files: [] };
  }

  let result = { affectedRows: 0 };

  if (Object.keys(update).length) {
    const updateKeys = Object.keys(update);
    const setClause = updateKeys.map((key) => `${ALLOWED_UPDATE_COLUMNS[key]} = ?`).join(', ');
    const updateValues = updateKeys.map((key) => update[key]);

    [result] = await db.execute(
      `UPDATE expenditure_requests SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...updateValues, id],
    );
  }

  await insertBillFiles(db, id, paymentProofFiles, 'payment_proof');

  try {
    await db.execute(
      `INSERT INTO expenditure_request_edits
         (expenditure_request_id, edited_by_user_id, edited_by_email,
          edited_by_role, is_admin, summary, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        toPositiveInt(actor?.id) || null,
        normalizeText(actor?.email) || null,
        normalizeText(actor?.role).toLowerCase() || null,
        actor?.isSuperAdmin ? 1 : 0,
        'Expenditure request updated',
        JSON.stringify({
          updatedKeys: Object.keys(update),
          paymentProofFilesAdded: paymentProofFiles.length,
        }),
      ],
    );
  } catch (auditErr) {
    console.warn('Failed to write expenditure edit audit log:', auditErr?.message || auditErr);
  }

  const details = await getExpenditureDetails(id);
  return {
    affectedRows: result.affectedRows,
    payment_proof_files: details.payment_proof_files,
  };
}

/**
 * Delete an expenditure request and release the reserved budget.
 * Only allowed when overall_status = 'pending'.
 */
export async function deleteExpenditure(id, options = {}) {
  const { isSuperAdmin = false } = options;

  return withTransaction(async (conn) => {
    const [[row]] = await conn.execute(
      `SELECT id, request_type, overall_status
         FROM expenditure_requests WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    );

    if (!row) {
      throw new Error('Expenditure request not found');
    }
    if (!isSuperAdmin && normalizeText(row.overall_status).toLowerCase() !== 'pending') {
      throw new Error('Only pending requests can be deleted');
    }

    await conn.execute('DELETE FROM expenditure_requests WHERE id = ?', [id]);

    return true;
  });
}

// ─── Ownership lookup (used by route-level delete guard) ──────────────────────

export async function getExpenditureOwner(id) {
  const n = toPositiveInt(id);
  if (!n) return null;
  const [rows] = await db.execute(
    'SELECT id, created_by FROM expenditure_requests WHERE id = ? LIMIT 1',
    [n],
  );
  return rows[0] || null;
}

// ─── Applicant auto-fill ──────────────────────────────────────────────────────

/**
 * Return the logged-in user's employee profile for auto-filling the form.
 */
export async function getCurrentEmployee(userId) {
  const [rows] = await db.execute(
    `SELECT
       e.id AS employee_id,
       e.erp_id,
       TRIM(CONCAT(
         COALESCE(e.title,''),' ',e.first_name,' ',COALESCE(e.last_name,'')
       ))             AS name,
       e.designation,
       d.name         AS department,
       e.email,
       e.mobile
     FROM master_employees e
     LEFT JOIN master_departments d ON d.id = e.department_id
     WHERE e.user_id = ? AND e.status = 'Active'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

// ─── Timeline / status history ────────────────────────────────────────────────

export async function getStatusUpdates(expenditureId) {
  const [requestRows] = await db.execute(
    `SELECT
       er.id AS expenditure_id,
       er.created_by AS user_id,
       er.created_at,
       COALESCE(
         NULLIF(TRIM(CONCAT(
           COALESCE(emp.title,''),' ',
           COALESCE(emp.first_name,''),' ',
           COALESCE(emp.last_name,'')
         )),''),
         NULLIF(TRIM(er.applicant_name), ''),
         u.name,
         er.email
       ) AS actor_name,
       COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(er.email), '')) AS actor_email
     FROM expenditure_requests er
     LEFT JOIN users u ON u.id = er.created_by
     LEFT JOIN master_employees emp
       ON emp.email COLLATE utf8mb4_unicode_ci =
          COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(er.email), '')) COLLATE utf8mb4_unicode_ci
     WHERE er.id = ?
     LIMIT 1`,
    [expenditureId],
  );

  const submissionRows = requestRows.map((row) => ({
    id: -Number(expenditureId),
    expenditure_id: row.expenditure_id,
    user_id: row.user_id,
    stage: 'submitted',
    status: 'submitted',
    decision: 'submitted',
    comment: 'Initial expenditure request submitted',
    feedback: 'Initial expenditure request submitted',
    created_at: row.created_at,
    decided_at: row.created_at,
    actor_email: row.actor_email,
    actor_role: 'user',
    actor_name: row.actor_name,
    snapshot_before: null,
    meta: null,
    details: null,
  }));

  const [workflowRows] = await db.execute(
    `SELECT
       wa.id,
       wa.record_id  AS expenditure_id,
       wa.stage,
       wa.decision   AS status,
       wa.feedback   AS comment,
       wa.decided_at AS created_at,
       wa.snapshot_before,
       wa.meta,
       wa.actor_email,
       wa.actor_role,
       COALESCE(
         NULLIF(TRIM(CONCAT(
           COALESCE(emp.title,''),' ',
           COALESCE(emp.first_name,''),' ',
           COALESCE(emp.last_name,'')
         )),''),
         u.name
       ) AS actor_name
     FROM workflow_actions wa
     LEFT JOIN users u ON u.id = wa.actor_user_id
     LEFT JOIN master_employees emp
       ON emp.email COLLATE utf8mb4_unicode_ci = wa.actor_email COLLATE utf8mb4_unicode_ci
     WHERE wa.module_key = 'expenditure' AND wa.record_id = ?
     ORDER BY wa.decided_at ASC, wa.id ASC`,
    [expenditureId],
  );

  let editRows = [];
  try {
    const [rows] = await db.execute(
      `SELECT id, expenditure_request_id AS expenditure_id,
              'updated' AS status, summary AS comment,
              created_at, edited_by_email AS actor_email, edited_by_role AS actor_role
         FROM expenditure_request_edits
        WHERE expenditure_request_id = ?
        ORDER BY created_at ASC, id ASC`,
      [expenditureId],
    );
    editRows = rows;
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
  }

  return [...submissionRows, ...workflowRows, ...editRows].sort((a, b) => {
    const ta = new Date(a.decided_at || a.created_at || 0).getTime();
    const tb = new Date(b.decided_at || b.created_at || 0).getTime();
    return ta !== tb ? ta - tb : (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

const WORKFLOW_STATUS_SQL_EXPR = `
  COALESCE(
    NULLIF(LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.status')))), ''),
    NULLIF(LOWER(TRIM(er.workflow_status)), ''),
    'in_progress'
  )
`;

const WORKFLOW_STAGE_SQL_EXPR = `
  COALESCE(
    NULLIF(LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.currentStage')))), ''),
    NULLIF(LOWER(TRIM(er.workflow_stage)), ''),
    ''
  )
`;

/** Shared with the report, which searches on this expression. */
const QUEUE_DISPLAY_REF_SQL_EXPR = buildExpenditureDisplayRefExpr('er');

const normalizeWorkflowState = (workflowState) => {
  if (!workflowState) return null;
  if (typeof workflowState === 'object' && !Array.isArray(workflowState)) {
    return {
      ...workflowState,
      flow: Array.isArray(workflowState.flow) ? workflowState.flow : [],
      currentStage: normalizeText(workflowState.currentStage).toLowerCase() || null,
      status: normalizeText(workflowState.status).toLowerCase() || null,
      isEditableByApplicant: Boolean(workflowState.isEditableByApplicant),
    };
  }

  if (typeof workflowState === 'string') {
    try {
      const parsed = JSON.parse(workflowState);
      return normalizeWorkflowState(parsed);
    } catch {
      return null;
    }
  }

  return null;
};

const mapWorkflowStatusToOverallStatus = (workflowState) => {
  const status = normalizeText(workflowState?.status).toLowerCase();
  if (status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'archived') return 'archived';
  if (status === 'deleted') return 'deleted';
  return 'pending';
};

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES = Object.freeze([
  'centre',
  'cell',
  'club',
  'section',
  'professional body',
  'professional bodies',
]);

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY = Object.freeze(['faculty', 'staff']);
const escapeSqlLiteral = (value) => `'${String(value || '').replace(/'/g, "''")}'`;

const resolveExpenditureLevel1RouteType = (record = {}) => {
  const beneficiaryType = normalizeBeneficiaryType(record?.beneficiary_type).toLowerCase();
  const beneficiaryEntityId = toPositiveInt(record?.beneficiary_entity_id);

  if (LEVEL1_COORDINATOR_BENEFICIARY_TYPES.includes(beneficiaryType)) {
    return 'entity_contact';
  }

  if (
    LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY.includes(beneficiaryType) &&
    beneficiaryEntityId
  ) {
    return 'entity_contact';
  }

  return 'department_hod';
};

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL =
  LEVEL1_COORDINATOR_BENEFICIARY_TYPES.map(escapeSqlLiteral).join(', ');
const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL =
  LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY.map(escapeSqlLiteral).join(', ');

const LEVEL1_COORDINATOR_ROUTE_SQL_EXPR = `
  (
    LOWER(TRIM(COALESCE(er.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL})
    OR (
      LOWER(TRIM(COALESCE(er.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL})
      AND COALESCE(er.beneficiary_entity_id, 0) > 0
    )
  )
`;

export async function getExpenditureRecordContext(recordId, { tx = db, forUpdate = false } = {}) {
  const normalizedRecordId = toPositiveInt(recordId);
  if (!normalizedRecordId) return null;

  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await tx.query(
    `SELECT
       er.id,
       er.created_by,
       er.beneficiary_type,
       er.beneficiary_entity_id,
       er.department_id,
       er.total_amount
     FROM expenditure_requests er
     WHERE er.id = ?${lockClause}`,
    [normalizedRecordId],
  );

  if (!rows.length) return null;
  const row = rows[0];

  return {
    beneficiaryType:
      normalizeBeneficiaryType(row.beneficiary_type) || normalizeText(row.beneficiary_type),
    beneficiaryEntityId: toPositiveInt(row.beneficiary_entity_id),
    departmentId: toPositiveInt(row.department_id),
    totalBudget: toMoney(row.total_amount),
    applicantUserId: toPositiveInt(row.created_by),
  };
}

export async function updateExpenditureWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
  const normalizedRecordId = toPositiveInt(recordId);
  if (!normalizedRecordId) return false;

  const source = tx?.execute ? tx : db;

  const [existingRows] = await source.execute(
    `SELECT workflow_state
       FROM expenditure_requests
      WHERE id = ?
      LIMIT 1`,
    [normalizedRecordId],
  );

  const previousState = normalizeWorkflowState(
    existingRows?.[0]?.workflow_state ?? existingRows?.[0]?.workflowstate,
  );
  const persistentState = getPersistentWorkflowRowState(previousState);

  const mergedState = {
    ...persistentState,
    ...(newState || {}),
  };

  const workflowStatePayload = JSON.stringify(mergedState ?? null);
  const overallStatus = mapWorkflowStatusToOverallStatus(mergedState);

  const [result] = await source.execute(
    `UPDATE expenditure_requests
        SET workflow_state = ?,
            overall_status = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [workflowStatePayload, overallStatus, normalizedRecordId],
  );

  return Number(result?.affectedRows || 0) > 0;
}

export async function autoApprovePrincipalWorkflowStage(
  recordId,
  { actor = {}, feedback = 'Auto-approved after DoF clearance' } = {},
  { tx = null } = {},
) {
  if (!tx) {
    return withTransaction((conn) =>
      autoApprovePrincipalWorkflowStage(recordId, { actor, feedback }, { tx: conn }),
    );
  }

  const normalizedRecordId = toPositiveInt(recordId);
  if (!normalizedRecordId) {
    throw new Error('Invalid expenditure request ID');
  }

  const [rows] = await tx.query(
    `SELECT workflow_state
       FROM expenditure_requests
      WHERE id = ?
      FOR UPDATE`,
    [normalizedRecordId],
  );

  if (!rows.length) {
    throw new Error('Expenditure request not found');
  }

  const previousState = normalizeWorkflowState(rows[0].workflow_state);
  if (!previousState) {
    throw new Error('Workflow state not found');
  }

  const flow = Array.isArray(previousState.flow)
    ? previousState.flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
    : [];
  const currentStage = normalizeText(previousState.currentStage).toLowerCase();
  const principalIndex = flow.indexOf('principal');

  if (
    currentStage !== 'principal' ||
    previousState.status !== 'in_progress' ||
    principalIndex < 0
  ) {
    return {
      autoApproved: false,
      previousState,
      currentState: previousState,
    };
  }

  const nowIso = new Date().toISOString();
  const nextStage = flow[principalIndex + 1] || null;
  const nextState = {
    ...previousState,
    flow,
    currentStage: nextStage,
    status: nextStage ? 'in_progress' : 'completed',
    isEditableByApplicant: false,
    resolvedAt: nextStage ? null : nowIso,
    lastDecision: 'approved',
    lastFeedback: normalizeText(feedback) || null,
    updatedAt: nowIso,
  };

  const actorUserId = toPositiveInt(actor?.userId || actor?.id);

  await tx.query(
    `INSERT INTO workflow_actions (
        module_key,
        record_id,
        stage,
        decision,
        feedback,
        actor_user_id,
        actor_email,
        actor_role,
        snapshot_before,
        meta
      ) VALUES (?, ?, 'principal', 'approved', ?, ?, ?, 'principal', ?, ?)`,
    [
      'expenditure',
      normalizedRecordId,
      nextState.lastFeedback,
      actorUserId,
      'system-auto@ksrct.ac.in',
      JSON.stringify(previousState),
      JSON.stringify({
        origin: 'system',
        requestId: null,
        moduleMetaVersion: 1,
        moduleMeta: {
          trigger: 'auto_principal_approval_after_dof',
          route: 'PATCH /api/expenditure-requests/:id/approval',
        },
      }),
    ],
  );

  const updated = await updateExpenditureWorkflowSnapshot(normalizedRecordId, nextState, { tx });
  if (!updated) {
    throw new Error('Failed to update workflow snapshot');
  }

  return {
    autoApproved: true,
    previousState,
    currentState: nextState,
  };
}

export async function forceWorkflowTransition(
  recordId,
  { decision, feedback = null, actor = {}, stageHint = null } = {},
  { tx = db } = {},
) {
  const normalizedRecordId = toPositiveInt(recordId);
  const normalizedDecision = normalizeText(decision).toLowerCase();

  if (!normalizedRecordId) {
    throw new Error('Invalid expenditure request ID');
  }

  if (!['returned', 'archived'].includes(normalizedDecision)) {
    throw new Error(`Unsupported forced workflow transition: ${normalizedDecision}`);
  }

  const [rows] = await tx.query(
    `SELECT workflow_state
       FROM expenditure_requests
      WHERE id = ?
      FOR UPDATE`,
    [normalizedRecordId],
  );

  if (!rows.length) {
    throw new Error('Expenditure request not found');
  }

  const previousState = normalizeWorkflowState(rows[0].workflow_state);
  if (!previousState) {
    throw new Error('Workflow state not found');
  }

  const flow =
    Array.isArray(previousState.flow) && previousState.flow.length
      ? previousState.flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
      : ['level1', 'dof', 'principal'];
  const fallbackStage =
    normalizeText(stageHint).toLowerCase() ||
    normalizeText(previousState.currentStage).toLowerCase() ||
    flow[flow.length - 1] ||
    'level1';

  const nowIso = new Date().toISOString();
  const normalizedFeedback = normalizeText(feedback) || null;
  const nextState = {
    ...previousState,
    flow,
    status: normalizedDecision,
    currentStage: normalizedDecision === 'returned' ? fallbackStage : null,
    isEditableByApplicant: normalizedDecision === 'returned',
    resolvedAt: normalizedDecision === 'archived' ? nowIso : null,
    lastDecision: normalizedDecision,
    lastFeedback: normalizedFeedback,
    updatedAt: nowIso,
  };

  const actorUserId = toPositiveInt(actor?.userId || actor?.id);
  const actorEmail = normalizeText(actor?.email).toLowerCase() || null;
  const actorRole = normalizeText(actor?.role).toLowerCase() || null;

  await tx.query(
    `INSERT INTO workflow_actions (
        module_key,
        record_id,
        stage,
        decision,
        feedback,
        actor_user_id,
        actor_email,
        actor_role,
        snapshot_before,
        meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'expenditure',
      normalizedRecordId,
      fallbackStage,
      normalizedDecision,
      normalizedFeedback,
      actorUserId,
      actorEmail,
      actorRole,
      JSON.stringify(previousState),
      JSON.stringify({
        origin: 'api',
        requestId: null,
        moduleMetaVersion: 1,
        moduleMeta: {
          trigger: 'super_admin_forced_transition',
          route:
            normalizedDecision === 'archived'
              ? 'PATCH /api/expenditure-requests/:id/archive-toggle'
              : 'PATCH /api/expenditure-requests/:id/approval',
        },
      }),
    ],
  );

  const updated = await updateExpenditureWorkflowSnapshot(normalizedRecordId, nextState, { tx });
  if (!updated) {
    throw new Error('Failed to update workflow snapshot');
  }

  return {
    previousState,
    currentState: nextState,
    decision: normalizedDecision,
    stage: fallbackStage,
  };
}

export async function restoreWorkflowSnapshotFromLatestArchive(recordId, { tx = db } = {}) {
  const normalizedRecordId = toPositiveInt(recordId);
  if (!normalizedRecordId) {
    return { restored: false, reason: 'Invalid expenditure request ID' };
  }

  const [rows] = await tx.query(
    `SELECT snapshot_before
       FROM workflow_actions
      WHERE module_key = 'expenditure'
        AND record_id = ?
        AND decision = 'archived'
      ORDER BY decided_at DESC, id DESC
      LIMIT 1`,
    [normalizedRecordId],
  );

  if (!rows.length) {
    return { restored: false, reason: 'No archived snapshot found' };
  }

  const previousState = normalizeWorkflowState(rows[0].snapshot_before);
  if (!previousState) {
    return { restored: false, reason: 'Archived snapshot is not restorable' };
  }

  const updated = await updateExpenditureWorkflowSnapshot(normalizedRecordId, previousState, {
    tx,
  });
  return {
    restored: Boolean(updated),
    restoredState: previousState,
    reason: updated ? null : 'Failed to update workflow snapshot',
  };
}

export async function getLatestArchiveAction(recordId, { tx = db } = {}) {
  const normalizedRecordId = toPositiveInt(recordId);
  if (!normalizedRecordId) return null;

  const [rows] = await tx.query(
    `SELECT id, stage, actor_user_id, actor_email, decided_at
       FROM workflow_actions
      WHERE module_key = 'expenditure'
        AND record_id = ?
        AND decision = 'archived'
      ORDER BY decided_at DESC, id DESC
      LIMIT 1`,
    [normalizedRecordId],
  );

  if (!rows.length) return null;
  return {
    id: toPositiveInt(rows[0].id),
    stage: normalizeText(rows[0].stage).toLowerCase() || null,
    actorUserId: toPositiveInt(rows[0].actor_user_id),
    actorEmail: normalizeText(rows[0].actor_email).toLowerCase() || null,
    decidedAt: rows[0].decided_at || null,
  };
}

/**
 * Bulk row breakdown for the workflow CSV export: every advance, expenditure and
 * settlement row for the given requests, grouped by expenditure id. One query per
 * row table so the export stays a fixed number of round trips.
 */
export async function listExpenditureRowsForExport(expenditureIds = [], { tx = db } = {}) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(expenditureIds) ? expenditureIds : [])
        .map((value) => toPositiveInt(value))
        .filter(Boolean),
    ),
  );

  if (!normalizedIds.length) {
    return {};
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const [rows] = await tx.query(
    `SELECT expenditure_id, 'Advance' AS row_kind, budget_head, sub_head, amount_source,
            budget_amount, advance_amount AS amount, sort_order, id
       FROM expenditure_advance_rows
      WHERE expenditure_id IN (${placeholders})
     UNION ALL
     SELECT expenditure_id, 'Expenditure' AS row_kind, budget_head, sub_head, amount_source,
            budget_amount, auto_sum_amount AS amount, sort_order, id
       FROM expenditure_line_rows
      WHERE expenditure_id IN (${placeholders})
     UNION ALL
     SELECT expenditure_id, 'Settlement' AS row_kind, budget_head, sub_head, amount_source,
            budget_amount, settlement_amount AS amount, sort_order, id
       FROM expenditure_settlement_rows
      WHERE expenditure_id IN (${placeholders})
      ORDER BY expenditure_id ASC, row_kind ASC, sort_order ASC, id ASC`,
    [...normalizedIds, ...normalizedIds, ...normalizedIds],
  );

  const grouped = {};
  for (const row of rows || []) {
    const key = String(toPositiveInt(row.expenditure_id));
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({
      row_kind: row.row_kind,
      budget_head: row.budget_head,
      sub_head: row.sub_head,
      amount_source: row.amount_source,
      budget_amount: row.budget_amount,
      amount: row.amount,
    });
  }
  return grouped;
}

export async function getExpenditureBillsByExpenditureIds(expenditureIds = [], { tx = db } = {}) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(expenditureIds) ? expenditureIds : [])
        .map((value) => toPositiveInt(value))
        .filter(Boolean),
    ),
  );

  if (!normalizedIds.length) {
    return new Map();
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const selectSql = `SELECT
         id,
         expenditure_id,
         original_name,
         stored_name,
         file_path,
         mime_type,
         file_size,
         sort_order,
         created_at
       FROM expenditure_request_bills
       WHERE expenditure_id IN (${placeholders})
         AND file_category = 'bill'
       ORDER BY sort_order ASC, id ASC`;

  const [rows] = await tx.query(selectSql, normalizedIds);

  const resultMap = new Map();
  for (const row of rows) {
    const expenditureId = toPositiveInt(row.expenditure_id);
    if (!resultMap.has(expenditureId)) {
      resultMap.set(expenditureId, []);
    }
    resultMap.get(expenditureId).push(
      withUploadAccess({
        id: row.id,
        original_name: row.original_name,
        stored_name: row.stored_name,
        file_path: row.file_path,
        mime_type: row.mime_type,
        file_size: row.file_size,
        sort_order: row.sort_order,
        created_at: row.created_at,
      }),
    );
  }
  return resultMap;
}

export async function listExpenditureQueueRecords(stage, filters = {}, { tx = db } = {}) {
  const normalizedStage = normalizeText(stage).toLowerCase();
  const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';
  const isSuperAdmin = Boolean(filters.isSuperAdmin);
  const isAllProposals = isSuperAdmin && Boolean(filters.allProposals);
  const level1Role = normalizeText(filters.level1Role).toLowerCase();
  const requestedStatusCategory = normalizeText(filters.statusCategory).toLowerCase();
  const statusCategoryFilter = ['pending', 'approved', 'returned', 'rejected', 'archived'].includes(
    requestedStatusCategory,
  )
    ? requestedStatusCategory
    : '';
  const isAllStage = normalizedStage === 'all';
  const statusStageScope = isAllProposals || isAllStage ? 'all' : normalizedStage;
  const searchTerm = normalizeText(filters.q || filters.search);
  const fiscalYear = toPositiveInt(filters.fiscalYear || filters.fiscal_year);

  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereParts = [`LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'`];
  const whereParams = [];

  // Same expression the queue and the CSV's Date column display, so a date-filtered
  // export can never contain a row dated outside the requested window.
  const dateRange = buildDateRangeCondition('COALESCE(er.request_date, DATE(er.created_at))', {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  if (dateRange.sql) {
    whereParts.push(dateRange.sql);
    whereParams.push(...dateRange.params);
  }

  if (fiscalYear) {
    whereParts.push(buildExpenditureFiscalYearCondition('er'));
    whereParams.push(fiscalYear, fiscalYear, fiscalYear, fiscalYear, fiscalYear);
  }

  if (workflowStatus === 'all') {
    if (isAllProposals || isAllStage) {
      whereParts.push('1 = 1');
    } else {
      whereParts.push(
        `( 
          (${WORKFLOW_STAGE_SQL_EXPR} = ? AND ${WORKFLOW_STATUS_SQL_EXPR} IN ('in_progress', 'returned'))
          OR EXISTS (
            SELECT 1
            FROM workflow_actions wa
            WHERE wa.module_key = 'expenditure'
              AND wa.record_id = er.id
              AND LOWER(TRIM(wa.stage)) = ?
              AND wa.decision IN ('approved', 'returned', 'rejected', 'archived')
          )
        )`,
      );
      whereParams.push(normalizedStage, normalizedStage);
    }
  } else {
    if (!isAllProposals && !isAllStage) {
      whereParts.push(`${WORKFLOW_STAGE_SQL_EXPR} = ?`);
      whereParams.push(normalizedStage);
    }
    whereParts.push(`${WORKFLOW_STATUS_SQL_EXPR} = ?`);
    whereParams.push(workflowStatus);
  }

  const scopeFilters = filters.scopeFilters || {};

  if (normalizedStage === 'level1' && ['hod', 'coordinator'].includes(level1Role)) {
    if (level1Role === 'coordinator') {
      whereParts.push(LEVEL1_COORDINATOR_ROUTE_SQL_EXPR);
    } else {
      whereParts.push(`NOT ${LEVEL1_COORDINATOR_ROUTE_SQL_EXPR}`);
    }
  }

  if (!scopeFilters.forceAll) {
    if (scopeFilters.scopeType === 'department') {
      const departmentIds = Array.from(scopeFilters.departmentIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      if (scopeFilters.forceEmpty || departmentIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      whereParts.push('er.department_id IN (?)');
      whereParams.push(departmentIds);
    }

    if (scopeFilters.scopeType === 'entity') {
      const entityIds = Array.from(scopeFilters.entityIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      if (scopeFilters.forceEmpty || entityIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      whereParts.push('er.beneficiary_entity_id IN (?)');
      whereParams.push(entityIds);
    }
  }

  if (searchTerm) {
    const searchLike = `%${searchTerm}%`;
    whereParts.push(
      `(
        LOWER(${QUEUE_DISPLAY_REF_SQL_EXPR}) LIKE LOWER(?)
        OR LOWER(REPLACE(${QUEUE_DISPLAY_REF_SQL_EXPR}, '#', '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.applicant_name, '')) LIKE LOWER(?)
        OR EXISTS (
          SELECT 1
            FROM master_employees emp_search
           WHERE emp_search.id = er.employee_id
             AND LOWER(CONCAT_WS(' ',
               emp_search.title,
               emp_search.first_name,
               emp_search.last_name,
               emp_search.erp_id,
               emp_search.email
             )) LIKE LOWER(?)
        )
        OR LOWER(COALESCE(er.request_type, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.beneficiary_type, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.beneficiary_value, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.primary_head, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.department, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(er.description, '')) LIKE LOWER(?)
      )`,
    );
    whereParams.push(
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
      searchLike,
    );
  }

  const priorTerminalStageByDashboard = {
    principal: 'dof',
    chairman: 'principal',
  };
  const priorTerminalStage = priorTerminalStageByDashboard[normalizedStage];
  if (priorTerminalStage) {
    whereParts.push(
      `NOT EXISTS (
        SELECT 1
          FROM workflow_actions latest_terminal
         WHERE latest_terminal.id = (
           SELECT wa_latest.id
             FROM workflow_actions wa_latest
            WHERE wa_latest.module_key = 'expenditure'
              AND wa_latest.record_id = er.id
            ORDER BY wa_latest.decided_at DESC, wa_latest.id DESC
            LIMIT 1
         )
           AND LOWER(TRIM(latest_terminal.stage)) = ?
           AND latest_terminal.decision IN ('returned', 'rejected')
      )`,
    );
    whereParams.push(priorTerminalStage);
  }

  const baseWhereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await tx.query(
    `SELECT COUNT(*) AS total
       FROM expenditure_requests er
       ${baseWhereClause}`,
    whereParams,
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [statusCountRows] = await tx.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status_category = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status_category = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN status_category = 'returned' THEN 1 ELSE 0 END) AS returned,
       SUM(CASE WHEN status_category = 'rejected' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN status_category = 'archived' THEN 1 ELSE 0 END) AS archived
     FROM (
       SELECT
         CASE
           WHEN combined_status LIKE '%archive%' THEN 'archived'
           WHEN combined_status LIKE '%rejected%' THEN 'rejected'
           WHEN combined_status LIKE '%returned%' OR combined_status LIKE '%return%' THEN 'returned'
           WHEN (? = 'all' OR workflow_stage = ?) AND workflow_status = 'in_progress' THEN 'pending'
           WHEN workflow_stage_decision LIKE '%approved%' OR combined_status LIKE '%approved%' OR combined_status LIKE '%completed%' THEN 'approved'
           ELSE CASE WHEN ? = 'all' THEN 'pending' ELSE 'other' END
         END AS status_category
       FROM (
         SELECT
           ${WORKFLOW_STATUS_SQL_EXPR} AS workflow_status,
           ${WORKFLOW_STAGE_SQL_EXPR} AS workflow_stage,
           COALESCE((
             SELECT LOWER(TRIM(wa.decision))
               FROM workflow_actions wa
              WHERE wa.module_key = 'expenditure'
                AND wa.record_id = er.id
                AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
              ORDER BY wa.decided_at DESC, wa.id DESC
              LIMIT 1
           ), '') AS workflow_stage_decision,
           LOWER(CONCAT_WS(' ',
             ${WORKFLOW_STATUS_SQL_EXPR},
             ${WORKFLOW_STAGE_SQL_EXPR},
             COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
           )) AS combined_status
         FROM expenditure_requests er
         ${baseWhereClause}
       ) scoped_status
     ) categorized_status`,
    [
      statusStageScope,
      statusStageScope,
      statusStageScope,
      statusStageScope,
      statusStageScope,
      ...whereParams,
    ],
  );

  const statusCounts = {
    total: Number(statusCountRows?.[0]?.total || 0),
    pending: Number(statusCountRows?.[0]?.pending || 0),
    approved: Number(statusCountRows?.[0]?.approved || 0),
    returned: Number(statusCountRows?.[0]?.returned || 0),
    rejected: Number(statusCountRows?.[0]?.rejected || 0),
    archived: Number(statusCountRows?.[0]?.archived || 0),
  };

  if (statusCategoryFilter) {
    whereParts.push(
      `(CASE
        WHEN LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%archive%' THEN 'archived'
        WHEN LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%rejected%' THEN 'rejected'
        WHEN LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%returned%' OR LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%return%' THEN 'returned'
        WHEN (? = 'all' OR ${WORKFLOW_STAGE_SQL_EXPR} = ?) AND ${WORKFLOW_STATUS_SQL_EXPR} = 'in_progress' THEN 'pending'
        WHEN COALESCE((
          SELECT LOWER(TRIM(wa.decision))
            FROM workflow_actions wa
           WHERE wa.module_key = 'expenditure'
             AND wa.record_id = er.id
             AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
           ORDER BY wa.decided_at DESC, wa.id DESC
           LIMIT 1
        ), '') LIKE '%approved%' OR LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%approved%' OR LOWER(CONCAT_WS(' ',
          ${WORKFLOW_STATUS_SQL_EXPR},
          ${WORKFLOW_STAGE_SQL_EXPR},
          COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '')
        )) LIKE '%completed%' THEN 'approved'
        ELSE CASE WHEN ? = 'all' THEN 'pending' ELSE 'other' END
      END) = ?`,
    );
    whereParams.push(
      statusStageScope,
      statusStageScope,
      statusStageScope,
      statusStageScope,
      statusStageScope,
      statusCategoryFilter,
    );
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const filteredTotal = statusCategoryFilter
    ? Number(statusCounts[statusCategoryFilter] || 0)
    : total;

  const [rows] = await tx.query(
    `SELECT
       er.id,
       COALESCE(err.request_ref, CONCAT('#EX-', YEAR(COALESCE(er.request_date, er.created_at)), '-', LPAD(er.id, 4, '0'))) AS proposal_ref,
       er.request_type,
       er.finance_request_id,
       COALESCE(frr.request_ref, '') AS finance_request_ref,
       (
         -- Carry-forward eligibility for the Advance card: unsettled advance for
         -- this finance request = all approved advances - all approved settlements.
         -- Attributed to the budget's FY (no request-date filter), matching how the
         -- rest of expenditure auto-uses the budget year. Drives the advance-card icon.
         SELECT GREATEST(0, COALESCE(SUM(CASE
           WHEN ecf.request_type = 'Advance'
             AND (
               LOWER(TRIM(COALESCE(ecf.overall_status, ''))) IN ('approved', 'completed')
               OR LOWER(TRIM(COALESCE(ecf.workflow_status, ''))) IN ('approved', 'completed')
             )
           THEN COALESCE(ecf.advance_total_amount, ecf.total_amount, 0)
           WHEN ecf.request_type = 'Settlement'
             AND (
               LOWER(TRIM(COALESCE(ecf.overall_status, ''))) IN ('approved', 'completed')
               OR LOWER(TRIM(COALESCE(ecf.workflow_status, ''))) IN ('approved', 'completed')
             )
           THEN -COALESCE(ecf.settlement_total_amount, ecf.total_amount, 0)
           ELSE 0
         END), 0))
         FROM expenditure_requests ecf
         WHERE ecf.finance_request_id = er.finance_request_id
       ) AS carry_forward_unsettled_advance_amount,
       er.created_by,
       er.beneficiary_type,
       er.beneficiary_value,
       er.beneficiary_entity_id,
       er.budget_tag,
       er.description,
       er.primary_head,
       er.total_amount,
       er.approved_total_amount,
       er.department,
       er.workflow_state,
       ${WORKFLOW_STATUS_SQL_EXPR} AS workflow_status,
       ${WORKFLOW_STAGE_SQL_EXPR} AS workflow_stage,
       (
         SELECT wa.decision
         FROM workflow_actions wa
         WHERE wa.module_key = 'expenditure'
           AND wa.record_id = er.id
           AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
         ORDER BY wa.decided_at DESC, wa.id DESC
         LIMIT 1
       ) AS workflow_stage_decision,
       COALESCE(
         NULLIF(TRIM(CONCAT(COALESCE(emp.title,''), ' ', COALESCE(emp.first_name,''), ' ', COALESCE(emp.last_name,''))), ''),
         NULLIF(TRIM(er.applicant_name), ''),
         'Unknown Applicant'
       ) AS applicant_name,
       er.created_at,
       er.updated_at
     FROM expenditure_requests er
     LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = er.finance_request_id
     LEFT JOIN master_employees emp ON emp.id = er.employee_id
     ${whereClause}
     ORDER BY
       CASE
         WHEN ${WORKFLOW_STATUS_SQL_EXPR} = 'in_progress'
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.lastDecision')), '') = 'resubmitted'
         THEN 0
         ELSE 1
       END,
       COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.resubmittedAt')), '') DESC,
       er.created_at DESC,
       -- created_at is a second-precision TIMESTAMP, so requests raised in the same
       -- second tie. Without a unique final key the LIMIT/OFFSET order is undefined
       -- between pages, which makes the CSV export (10 pages of 100) repeat some rows
       -- and drop others.
       er.id DESC
     LIMIT ? OFFSET ?`,
    [statusStageScope, statusStageScope, ...whereParams, limit, offset],
  );

  const expenditureIds = rows.map((row) => row.id);
  const billsMap = await getExpenditureBillsByExpenditureIds(expenditureIds, { tx });

  return {
    items: rows.map((row) => ({
      ...row,
      workflow_state: normalizeWorkflowState(row.workflow_state),
      level1_route_type: resolveExpenditureLevel1RouteType(row),
      annexures: billsMap.get(toPositiveInt(row.id)) || [],
    })),
    total: filteredTotal,
    statusCounts,
    page,
    limit,
  };
}

export async function listAvailableBeneficiaryTypes({ tx = db } = {}) {
  const [rows] = await tx.query(
    `SELECT DISTINCT TRIM(beneficiary_type) AS beneficiary_type
       FROM expenditure_requests er
      WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
        AND beneficiary_type IS NOT NULL
        AND TRIM(beneficiary_type) <> ''
      ORDER BY TRIM(beneficiary_type) ASC`,
  );

  const dedup = new Map();
  for (const row of rows || []) {
    const normalized =
      normalizeBeneficiaryType(row?.beneficiary_type) || normalizeText(row?.beneficiary_type);
    const key = normalizeText(normalized).toLowerCase();
    if (!key || dedup.has(key)) continue;
    dedup.set(key, normalized);
  }

  return Array.from(dedup.values());
}

export async function listAvailableFiscalYears({ tx = db } = {}) {
  const [rows] = await tx.query(
    `SELECT DISTINCT fiscal_year
       FROM (
         SELECT bp.fiscal_year AS fiscal_year
           FROM expenditure_advance_rows ar
           JOIN budget_proposals bp ON bp.id = ar.budget_proposal_id
           JOIN expenditure_requests er ON er.id = ar.expenditure_id
          WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
            AND bp.fiscal_year IS NOT NULL
         UNION
         SELECT bp.fiscal_year AS fiscal_year
           FROM expenditure_settlement_rows sr
           JOIN budget_proposals bp ON bp.id = sr.budget_proposal_id
           JOIN expenditure_requests er ON er.id = sr.expenditure_id
          WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
            AND bp.fiscal_year IS NOT NULL
         UNION
         SELECT bp.fiscal_year AS fiscal_year
           FROM expenditure_line_rows lr
           JOIN budget_proposals bp ON bp.id = lr.budget_proposal_id
           JOIN expenditure_requests er ON er.id = lr.expenditure_id
          WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
            AND bp.fiscal_year IS NOT NULL
         UNION
         SELECT (
                  YEAR(COALESCE(er.request_date, er.created_at))
                    - (MONTH(COALESCE(er.request_date, er.created_at)) < 4)
                ) AS fiscal_year
           FROM expenditure_requests er
          WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
            AND NOT EXISTS (SELECT 1 FROM expenditure_advance_rows ar WHERE ar.expenditure_id = er.id AND ar.budget_proposal_id IS NOT NULL)
            AND NOT EXISTS (SELECT 1 FROM expenditure_settlement_rows sr WHERE sr.expenditure_id = er.id AND sr.budget_proposal_id IS NOT NULL)
            AND NOT EXISTS (SELECT 1 FROM expenditure_line_rows lr WHERE lr.expenditure_id = er.id AND lr.budget_proposal_id IS NOT NULL)
         UNION
         -- Carry-forward target years, so approvers can select the year a
         -- proposal was carried into (mirrors finance listAvailableFiscalYears).
         SELECT cf.target_fiscal_year AS fiscal_year
           FROM finance_carry_forward_allocations cf
           JOIN expenditure_requests er ON er.finance_request_id = cf.finance_request_id
          WHERE LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
            AND LOWER(TRIM(COALESCE(cf.status, 'active'))) = 'active'
            AND cf.target_fiscal_year IS NOT NULL
       ) years
      WHERE fiscal_year IS NOT NULL
      ORDER BY fiscal_year DESC`,
  );

  return (rows || []).map((row) => toPositiveInt(row?.fiscal_year)).filter(Boolean);
}

export async function hardDeleteExpenditureRequest(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) return false;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      'DELETE FROM expenditure_request_refs WHERE expenditure_request_id = ?',
      [expenditureId],
    );
    await connection.query('DELETE FROM expenditure_advance_rows WHERE expenditure_id = ?', [
      expenditureId,
    ]);
    await connection.query('DELETE FROM expenditure_line_rows WHERE expenditure_id = ?', [
      expenditureId,
    ]);
    await connection.query('DELETE FROM expenditure_settlement_rows WHERE expenditure_id = ?', [
      expenditureId,
    ]);
    await connection.query('DELETE FROM expenditure_income_rows WHERE expenditure_id = ?', [
      expenditureId,
    ]);
    await connection.query('DELETE FROM expenditure_request_bills WHERE expenditure_id = ?', [
      expenditureId,
    ]);
    await connection.query('DELETE FROM expenditure_requests WHERE id = ?', [expenditureId]);

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw new Error(`Error deleting expenditure request: ${error.message}`);
  } finally {
    connection.release();
  }
}

export async function revertBudgetUsage(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) return false;

  // createExpenditureRequest does not currently reserve finance_budget_line_usage.
  // Keep this cleanup hook non-destructive so workflow-start failures only remove the draft request.
  return true;
}
