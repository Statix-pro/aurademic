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
import { searchApplicant as searchEmployeeApplicants } from '../shared/budget/userResolvers.js';
import { normalizeBeneficiaryType, beneficiaryTypeToEntityTypeCode } from '../shared/budget/budgetUtils.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

const normalizeText = (v) => String(v || '').trim();
const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'];

const isBeneficiaryOrgValue = (value) => BENEFICIARY_ORG_OPTIONS.includes(normalizeText(value));

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
    approval_status: normalizeText(row.approval_status) || 'approved',
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

const normalizeFinanceRequestRefBase = (requestRef, { financeRequestId = null, requestDate = null } = {}) => {
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

  if (!departmentId && beneficiaryType === 'Department' && beneficiaryValue) {
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
const DEFAULT_BULK_NEFT_TEMPLATE_VERSION = '2026-04-11';

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
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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
    payload.advance_rows.some((row) => String(row?.advance || row?.advanceamount || '').trim() !== '')
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
        String(row?.expenditure || row?.autoSum || row?.autosumamount || row?.expenditureinput || '').trim() !== '',
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
    payload.dashboard_row_id ||
      payload.dashboardRowId ||
      null,
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
  const normalized = workflowState && typeof workflowState === 'object' && !Array.isArray(workflowState)
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

async function getWorkflowRowHistory(conn, {
  financeRequestId,
  workflowRowRef,
  dashboardRowId,
  rowIndex,
  sourceRequestId,
} = {}) {
  const financeId = toPositiveInt(financeRequestId);
  const normalizedWorkflowRowRef = normalizeText(workflowRowRef).toLowerCase();
  const normalizedDashboardRowId = normalizeText(dashboardRowId).toLowerCase();
  const normalizedRowIndex = toPositiveInt(rowIndex);
  const anchorRequestIds = deriveLegacyAnchorRequestIds({
    dashboardRowId,
    workflowRowRef,
    sourceRequestId,
  });

  if (!financeId || (!normalizedWorkflowRowRef && !normalizedDashboardRowId && !normalizedRowIndex && !anchorRequestIds.length)) {
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

  if (!normalizedWorkflowRowRef && !normalizedDashboardRowId && !anchorRequestIds.length && normalizedRowIndex) {
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

function validateWorkflowRowFlow(requestType, rowHistory = [], {
  requestedAdvance = 0,
  requestedSettlement = 0,
  requestedExpenditure = 0,
} = {}) {
  if (!rowHistory.length) return;

  const hasAdvance = rowHistory.some((row) => row.requestType === 'Advance');
  const hasSettlement = rowHistory.some((row) => row.requestType === 'Settlement');
  const hasExpenditure = rowHistory.some((row) => row.requestType === 'Expenditure');

  if (requestType === 'Expenditure') {
    if (hasAdvance || hasSettlement) {
      throw new Error('Advance flow already exists for this row. Create a new row for expenditure.');
    }
    if (hasExpenditure) {
      throw new Error('Expenditure already exists for this row. Create a new row for another expenditure.');
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
      throw new Error('Settlement already exists for this row. Create a new row for another advance.');
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
    if (requestedSettlement <= 0) {
      throw new Error('Settlement amount must be greater than 0');
    }
  }
}

async function getCumulativeAdvanceSummary(connOrDb, {
  userId,
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
} = {}) {
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
    scopeParams.push(normalizedWorkflowRowRef);
  }
  if (anchorRequestIds.length) {
    rowIdentityClauses.push(`er.id IN (${anchorRequestIds.map(() => '?').join(', ')})`);
    scopeParams.push(...anchorRequestIds);
  }
  if (!normalizedDashboardRowId && !normalizedWorkflowRowRef && !anchorRequestIds.length && currentRowIndex) {
    rowIdentityClauses.push(`${WORKFLOW_ROW_INDEX_SQL_EXPR} = ?`);
    scopeParams.push(currentRowIndex);
  }
  if (financeId && rowIdentityClauses.length) {
    scopeClause = `
        AND er.finance_request_id = ?
        AND (${rowIdentityClauses.join(' OR ')})
      `;
    scopeParams = [financeId, ...scopeParams];
  } else if (rowIdentityClauses.length) {
    scopeClause = `
        AND (${rowIdentityClauses.join(' OR ')})
      `;
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
    // NEW: ID match is checked first; falls back to normalized text for
    // rows whose IDs were never backfilled.
    const idMatch = headIdVal && subIdVal
      ? `OR (ar.budget_head_id = ? AND ar.budget_sub_head_id = ?)`
      : '';
    rowMatchClause = `
      (
        ar.budget_line_id = ?
        ${idMatch}
        OR (
          ar.budget_line_id IS NULL
          AND LOWER(TRIM(ar.budget_head)) = ?
          AND LOWER(TRIM(ar.sub_head)) = ?
        )
      )
    `;
    rowMatchParams = idMatch
      ? [lineId, headIdVal, subIdVal, normalizedHead, normalizedSubHead]
      : [lineId, normalizedHead, normalizedSubHead];
    if (hasLegacyBudgetLine) {
      legacyMatchClause = 'er.budget_line_id = ?';
      legacyMatchParams = [lineId];
    }
  } else if (!lineId) {
    // NEW: prefer ID match; fall back to text for un-backfilled rows.
    if (headIdVal && subIdVal) {
      rowMatchClause = `
        (
          (ar.budget_head_id = ? AND ar.budget_sub_head_id = ?)
          OR (
            ar.budget_head_id IS NULL
            AND LOWER(TRIM(ar.budget_head)) = ?
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
      WHERE er.created_by = ?
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
      WHERE er.created_by = ?
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
      uid,
      ...scopeParams,
      ...exclusionParams,
      ...rowMatchParams,
      uid,
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

async function getFinanceRequestBudgetUsageByLine(connOrDb, {
  financeRequestId,
  budgetLineIds = [],
  excludeExpenditureId = null,
} = {}) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return new Map();
  const excludedRequestId = toPositiveInt(excludeExpenditureId);

  const normalizedBudgetLineIds = Array.from(
    new Set((Array.isArray(budgetLineIds) ? budgetLineIds : []).map((id) => toPositiveInt(id)).filter(Boolean)),
  );

  const source = connOrDb || db;
  const lineFilterSql = normalizedBudgetLineIds.length
    ? `WHERE usage_rows.budget_line_id IN (${normalizedBudgetLineIds.map(() => '?').join(', ')})`
    : '';

  const [rows] = await source.execute(
    `SELECT
       usage_rows.budget_line_id,
       GREATEST(0, COALESCE(SUM(usage_rows.amount_delta), 0)) AS consumed_amount
     FROM (
       SELECT
         ar.budget_line_id,
         ar.advance_amount AS amount_delta
       FROM expenditure_advance_rows ar
       JOIN expenditure_requests er ON er.id = ar.expenditure_id
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

       UNION ALL

       SELECT
         lr.budget_line_id,
         lr.auto_sum_amount AS amount_delta
       FROM expenditure_line_rows lr
       JOIN expenditure_requests er ON er.id = lr.expenditure_id
       WHERE er.finance_request_id = ?
         AND (? IS NULL OR er.id <> ?)
         AND ${ACTIVE_EXPENDITURE_REQUEST_STATUS_SQL}

    ) AS usage_rows
     ${lineFilterSql}
     GROUP BY usage_rows.budget_line_id`,
    normalizedBudgetLineIds.length
      ? [financeId, excludedRequestId, excludedRequestId, financeId, excludedRequestId, excludedRequestId, ...normalizedBudgetLineIds]
      : [financeId, excludedRequestId, excludedRequestId, financeId, excludedRequestId, excludedRequestId],
  );

  return new Map(
    rows.map((row) => [toPositiveInt(row.budget_line_id), toMoney(row.consumed_amount)]),
  );
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
         CONCAT('#F-', YEAR(COALESCE(fr.request_date, fr.created_at)), '-', LPAD(fr.id, 4, '0'))
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
  const priorAdvanceCount = workflowRowHistory.filter((row) => row.requestType === 'Advance').length;
  let stepSequence = 1;

  if (requestType === 'Advance') {
    stepSequence = priorAdvanceCount >= 1 ? 2 : 1;
  } else if (requestType === 'Settlement') {
    stepSequence = priorAdvanceCount >= 2 ? 3 : 2;
  } else if (requestType === 'Expenditure') {
    stepSequence = 1;
  } else {
    throw new Error(`Unsupported expenditure request type for ref generation: ${requestType || 'unknown'}`);
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
    const year = requestDate
      ? new Date(requestDate).getFullYear()
      : new Date().getFullYear();
    const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
    const lockName = `expenditure_ref_fy_${year}`;
    const [[{ acquired }]] = await conn.execute(
      'SELECT GET_LOCK(?, 15) AS acquired', [lockName],
    );
    if (Number(acquired) !== 1) {
      throw new Error(
        `Could not acquire expenditure reference lock for ${normalizedFinanceRequestId || year}`,
      );
    }

    try {
      const financeRefBase = await getFinanceRequestRefBase(
        conn,
        normalizedFinanceRequestId,
        requestDate,
      );
      const { suffix } = resolveExpenditureRefMeta(
        requestType,
        workflowRowHistory,
        rowIndex,
      );
      const ref = `${financeRefBase}-${suffix}`;

      const [[sequenceRow]] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) + 1 AS next_sequence
           FROM expenditure_request_refs
          WHERE ref_year = ?`,
        [year],
      );
      const storageSequence = Number(sequenceRow?.next_sequence || 1);

      await conn.execute(
        `REPLACE INTO expenditure_request_refs
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
    `SELECT fr.id, fr.created_by
       FROM finance_requests fr
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

export async function getApprovedBudgets({ userId, userEmail, financeRequestId, allowAnyApprovedFinance = false } = {}) {
  const uid = toPositiveInt(userId);
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId || !uid) return [];

  const owner = await getApprovedFinanceRequestOwner(db, financeId);
  if (!owner) return [];
  if (!allowAnyApprovedFinance && toPositiveInt(owner.created_by) !== uid) return [];

  try {
    const [financeRows] = await db.execute(
      `SELECT
         fbb.budget_line_id,
         COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)          AS budget_proposal_id,
         COALESCE(bp.proposal_ref, '')                                     AS proposal_ref,
         bp.fiscal_year,
         COALESCE(NULLIF(TRIM(fbb.budget_head), ''), bpl.budget_head, '')  AS head,
         COALESCE(NULLIF(TRIM(fbb.sub_head), ''), bpl.sub_head, '')        AS sub_head,
         ${FINANCE_BREAKUP_APPROVED_BASE_SQL}                               AS total_amount,
         fr.beneficiary_type,
         fr.beneficiary_value
       FROM finance_budget_breakup fbb
       JOIN finance_requests fr ON fr.id = fbb.finance_id
       LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
       LEFT JOIN budget_proposals bp
         ON bp.id = COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)
       WHERE fbb.finance_id = ?
       ORDER BY fbb.sort_order ASC, fbb.id ASC`,
      [financeId],
    );

    const usageByLineId = await getFinanceRequestBudgetUsageByLine(db, {
      financeRequestId: financeId,
      budgetLineIds: financeRows.map((row) => row.budget_line_id),
    });

    return financeRows.map((r) => {
      const totalAmount = toMoney(r.total_amount);
      const usedAmount = toMoney(usageByLineId.get(toPositiveInt(r.budget_line_id)));

      return {
        budgetLineId: toPositiveInt(r.budget_line_id),
        budgetProposalId: toPositiveInt(r.budget_proposal_id),
        proposalRef: normalizeText(r.proposal_ref),
        fiscalYear: Number(r.fiscal_year) || new Date().getFullYear(),
        head: normalizeText(r.head),
        subHead: normalizeText(r.sub_head),
        totalAmount,
        usedAmount,
        remainingAmount: toMoney(Math.max(0, totalAmount - usedAmount)),
        beneficiaryType: normalizeText(r.beneficiary_type),
        beneficiaryValue: normalizeText(r.beneficiary_value),
      };
    }).filter((row) => row.head && row.subHead);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

// ─── Pre-advance summary ──────────────────────────────────────────────────────

/**
 * Total amount already advanced by this user on a given budget line.
 * First-time → preAdvance = 0.
 */
export async function getAdvanceSummary({
  userId,
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
  return getCumulativeAdvanceSummary(db, {
    userId,
    budgetLineId,
    head,
    subHead,
    budgetHeadId,
    budgetSubHeadId,
    financeRequestId,
    rowIndex,
    sourceRequestId,
    dashboardRowId,
    workflowRowRef,
  });
}

// ─── Payee master ─────────────────────────────────────────────────────────────

export async function listPayees({ search = '', limit = 20, offset = 0 } = {}) {
  const q = normalizeText(search);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);
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
  const payeeSearchableColumns = `
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
      COALESCE(ep.organization_type, ''),
      COALESCE(ep.msme, ''),
      COALESCE(ep.gstin, ''),
      COALESCE(ep.tds_details, ''),
      COALESCE(ep.tds_section, '')
    ))
  `;
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
    const rawAccountCandidate = q
      .split(/\s+/)
      .slice(0, -1)
      .join(' ');
    const normalizedAccountCandidate = rawAccountCandidate
      .toLowerCase()
      .replace(/[\s-]+/g, '');

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
           AND UPPER(TRIM(COALESCE(ifsc, ''))) = ?
           AND ${accountCompareSql} = ?
         ORDER BY updated_at DESC, id DESC
         LIMIT ${limitNum} OFFSET ${offsetNum}`,
        [ifscCandidate, normalizedAccountCandidate],
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
        [ifscCandidate, normalizedAccountCandidate],
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
        AND ${payeeTermClauses}
      ORDER BY ep.payee_name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`,
    [...searchTerms.map((term) => `%${term}%`)],
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
    [...searchTerms.map((term) => `%${term}%`)],
  );

  return payeeRowResults.map(normalizePayeeRecord);
}

export async function getPayeeById(id) {
  const [rows] = await db.execute(
    'SELECT * FROM expenditure_payees WHERE id = ? LIMIT 1', [id],
  );
  return normalizePayeeRecord(rows[0] || null);
}

export async function updatePayeeById(id, payeeData = {}) {
  const payeeId = toPositiveInt(id);
  if (!payeeId) throw new Error('Invalid payee ID');

  const canonicalPayeeName = resolveCanonicalPayeeName(payeeData.payee_name, payeeData.account_name);
  const accountNo = normalizeText(payeeData.account_no);
  const ifsc = normalizeText(payeeData.ifsc).toUpperCase();
  const bankName = normalizeText(payeeData.bank_name);
  const branchName = normalizeText(payeeData.branch_name);
  const beneficiaryType = normalizeText(payeeData.beneficiary_type).toLowerCase() === 'organization'
    ? 'organization'
    : 'individual';
  const beneficiaryOrgRaw = resolveCanonicalBeneficiaryOrg(payeeData.beneficiary_org, payeeData.payee_name);
  const beneficiaryOrg = BENEFICIARY_ORG_OPTIONS.includes(beneficiaryOrgRaw) ? beneficiaryOrgRaw : null;

  if (!canonicalPayeeName || !accountNo || !ifsc || !bankName || !branchName) {
    throw new Error('payee_name, account_no, ifsc, bank_name and branch_name are required');
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
      normalizeText(payeeData.pan_number) || null,
      accountNo,
      normalizeText(payeeData.account_type) || null,
      ifsc,
      bankName,
      branchName,
      beneficiaryType,
      beneficiaryOrg,
      normalizeText(payeeData.organization_type) || null,
      normalizeText(payeeData.msme) || null,
      normalizeText(payeeData.gstin) || null,
      normalizeText(payeeData.tds_details) || null,
      normalizeText(payeeData.tds_section) || null,
      payeeId,
    ],
  );

  return result.affectedRows > 0;
}

export async function updatePayeeApproval(id, { decision, rejectionReason = '', userId = null } = {}) {
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
  const financeParams = [uid];
  const expenditureParams = [uid];
  let financeFySql = '';
  let expenditureFySql = '';

  if (fyStart) {
    const fyFrom = `${fyStart}-04-01`;
    const fyTo = `${fyStart + 1}-04-01`;
    financeFySql = ' AND fr.request_date >= ? AND fr.request_date < ?';
    expenditureFySql = ' AND er.request_date >= ? AND er.request_date < ?';
    financeParams.push(fyFrom, fyTo);
    expenditureParams.push(fyFrom, fyTo);
  }

  const [cardRows] = await db.execute(
    `SELECT
       fr.id AS finance_request_id,
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
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Advance'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.advance_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS advance_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Expenditure'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.expenditure_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS expenditure_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Settlement'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.settlement_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS settlement_amount,
       COUNT(DISTINCT er.id) AS expenditure_request_count
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     LEFT JOIN master_employees emp ON emp.id = fr.employee_id
     LEFT JOIN master_departments dept ON dept.id = emp.department_id
     LEFT JOIN expenditure_requests er ON er.finance_request_id = fr.id
     WHERE fr.created_by = ?
       AND (
         LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
         OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
         OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
       )
       ${financeFySql}
     GROUP BY
       fr.id,
       frr.request_ref,
       applicant_name,
       designation,
       department,
       approved_amount
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
       COALESCE(er.total_amount, 0) AS amount,
       LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) AS overall_status,
         er.created_at
       FROM expenditure_requests er
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
               ar.sub_head,
               ar.sort_order,
               ar.id
             FROM expenditure_advance_rows ar
             UNION ALL
             SELECT
               sr.expenditure_id,
               sr.sub_head,
               sr.sort_order,
               sr.id
             FROM expenditure_settlement_rows sr
             UNION ALL
             SELECT
               lr.expenditure_id,
               lr.sub_head,
               lr.sort_order,
               lr.id
             FROM expenditure_line_rows lr
           ) all_rows
         ) ranked
         WHERE ranked.rn = 1
       ) sample_row ON sample_row.expenditure_id = er.id
       WHERE er.created_by = ?
       AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
       ${expenditureFySql}
     ORDER BY er.created_at DESC, er.id DESC`,
    expenditureParams,
  );

  return {
    cards: cardRows.map((row) => {
      const approvedAmount = toMoney(row.approved_amount);
      const advanceAmount = toMoney(row.advance_amount);
      const settlementAmount = toMoney(row.settlement_amount);
      const expenditureAmount = toMoney(row.expenditure_amount);
      const effectiveUsageAmount = settlementAmount > 0 ? settlementAmount : advanceAmount;
      return {
        finance_request_id: toPositiveInt(row.finance_request_id),
        request_ref: normalizeText(row.request_ref),
        applicant_name: normalizeText(row.applicant_name),
        designation: normalizeText(row.designation),
        department: normalizeText(row.department),
        beneficiary_name: normalizeText(row.beneficiary_name),
        finance_tag: normalizeText(row.finance_tag),
        approved_amount: approvedAmount,
        advance_amount: advanceAmount,
        expenditure_amount: expenditureAmount,
        settlement_amount: settlementAmount,
        balance_amount: Math.max(0, approvedAmount - effectiveUsageAmount - expenditureAmount),
        expenditure_request_count: Number(row.expenditure_request_count || 0),
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
      amount: toMoney(row.amount),
      overall_status: normalizeText(row.overall_status) || 'pending',
      created_at: row.created_at,
    })),
  };
}

export async function getFinanceRequestContext(financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const [rows] = await db.execute(
    `SELECT
       fr.id AS finance_request_id,
       fr.created_by,
       fr.employee_id,
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

  return {
    finance_request_id: toPositiveInt(row.finance_request_id),
    created_by: toPositiveInt(row.created_by),
    employee_id: toPositiveInt(row.employee_id),
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
  };
}

/**
 * Upsert a payee. Unique key: (account_no, ifsc).
 * Returns the payee id (existing or new).
 */
export async function upsertPayee(payeeData, userId, conn = db) {
  const accountNo = normalizeText(payeeData.account_no);
  const ifsc      = normalizeText(payeeData.ifsc).toUpperCase();
  const canonicalPayeeName = resolveCanonicalPayeeName(
    payeeData.payee_name,
    payeeData.account_name,
  );
  const beneficiaryType = normalizeText(payeeData.beneficiary_type).toLowerCase() === 'organization'
    ? 'organization'
    : 'individual';
  const beneficiaryOrgRaw = resolveCanonicalBeneficiaryOrg(
    payeeData.beneficiary_org,
    payeeData.payee_name,
  );
  const beneficiaryOrg = BENEFICIARY_ORG_OPTIONS.includes(beneficiaryOrgRaw)
    ? beneficiaryOrgRaw
    : null;
  if (!accountNo || !ifsc) throw new Error('account_no and ifsc are required');

  const [existing] = await conn.execute(
    'SELECT id FROM expenditure_payees WHERE account_no = ? AND ifsc = ? LIMIT 1',
    [accountNo, ifsc],
  );

  if (existing.length) {
    await conn.execute(
      `UPDATE expenditure_payees
          SET payee_name   = COALESCE(?, payee_name),
              account_name = COALESCE(?, account_name),
              pan_number   = COALESCE(?, pan_number),
              account_type = COALESCE(?, account_type),
              bank_name    = COALESCE(?, bank_name),
              branch_name  = COALESCE(?, branch_name),
              beneficiary_type = COALESCE(?, beneficiary_type),
              beneficiary_org  = COALESCE(?, beneficiary_org),
              organization_type = COALESCE(?, organization_type),
              msme         = COALESCE(?, msme),
              gstin        = COALESCE(?, gstin),
              tds_details  = COALESCE(?, tds_details),
              tds_section  = COALESCE(?, tds_section),
              is_active    = 1,
              updated_at   = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        canonicalPayeeName     || null,
        canonicalPayeeName     || null,
        payeeData.pan_number   || null,
        payeeData.account_type || null,
        payeeData.bank_name    || null,
        payeeData.branch_name  || null,
        beneficiaryType,
        beneficiaryOrg,
        payeeData.organization_type || null,
        payeeData.msme         || null,
        payeeData.gstin        || null,
        payeeData.tds_details  || null,
        payeeData.tds_section  || null,
        existing[0].id,
      ],
    );
    return toPositiveInt(existing[0].id);
  }

  const [result] = await conn.execute(
    `INSERT INTO expenditure_payees
       (payee_name, account_name, account_no, account_type,
        bank_name, branch_name, ifsc, beneficiary_type,
        beneficiary_org, organization_type, msme,
        pan_number, gstin, tds_details, tds_section, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      canonicalPayeeName,
      canonicalPayeeName || null,
      accountNo,
      payeeData.account_type  || null,
      normalizeText(payeeData.bank_name),
      normalizeText(payeeData.branch_name || ''),
      ifsc,
      beneficiaryType,
      beneficiaryOrg,
      payeeData.organization_type || null,
      payeeData.msme         || null,
      payeeData.pan_number  || null,
      payeeData.gstin       || null,
      payeeData.tds_details || null,
      payeeData.tds_section || null,
      userId || null,
    ],
  );
  return result.insertId;
}

// ─── Core SELECT for expenditure_requests ────────────────────────────────────

const EXPENDITURE_SELECT = `
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
    er.advance_total_amount,
    er.settlement_total_amount,
    er.expenditure_total_amount,
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
    e.erp_id
  FROM expenditure_requests er
  LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
  LEFT JOIN master_employees e ON e.id = er.employee_id
  LEFT JOIN master_departments d ON d.id = e.department_id
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
          ar.budget_head,
          ar.sub_head,
          ar.sort_order,
          ar.id
        FROM expenditure_advance_rows ar
        UNION ALL
        SELECT
          sr.expenditure_id,
          sr.budget_line_id,
          sr.budget_proposal_id,
          sr.budget_head,
          sr.sub_head,
          sr.sort_order,
          sr.id
        FROM expenditure_settlement_rows sr
        UNION ALL
        SELECT
          lr.expenditure_id,
          lr.budget_line_id,
          lr.budget_proposal_id,
          lr.budget_head,
          lr.sub_head,
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
          payee_name:   data.payment_details.payee_name   || data.purpose || 'Unknown',
          account_no:   data.payment_details.account_no,
          ifsc:         data.payment_details.ifsc,
          bank_name:    data.payment_details.bank_name,
          branch_name:  data.payment_details.branch_name  || '',
          account_name: data.payment_details.account_name || null,
          account_type: data.payment_details.account_type || null,
          pan_number:   data.payment_details.pan_number   || null,
        },
        userId,
        conn,
      );
    }

    // ── 3. Pre-advance (first time = 0, subsequent = prior total) ──────────
    // NEW: prefer catalog IDs for matching; falls back to text for
    // un-backfilled legacy rows.
    const preAdvanceIds = await resolveCatalogIds(conn, lineRow.head, lineRow.sub_head);
    const { preAdvance } = await getCumulativeAdvanceSummary(conn, {
      userId,
      budgetLineId,
      head: lineRow.head,
      subHead: lineRow.sub_head,
      budgetHeadId: preAdvanceIds.budget_head_id,
      budgetSubHeadId: preAdvanceIds.budget_sub_head_id,
    });

    // ── 4. Resolve department from employee ─────────────────────────────────
    const employeeId = toPositiveInt(data.employee_id);
    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    // ── 5. Insert expenditure row ───────────────────────────────────────────
    const entry = {
      finance_request_id:   toPositiveInt(data.finance_request_id),
      budget_line_id:       budgetLineId,
      budget_proposal_id:   toPositiveInt(lineRow.budget_proposal_id),
      employee_id:          employeeId || null,
      payee_id:             payeeId || null,
      created_by:           toPositiveInt(userId),
      request_date:         data.request_date || new Date().toISOString().slice(0, 10),
      request_type:         'Advance',
      description:          normalizeText(data.description) || null,
      purpose:              normalizeText(data.purpose) || null,
      beneficiary_type:     normalizeBeneficiaryType(data.beneficiary_type)
                              || normalizeText(data.beneficiary_type)
                              || 'Individual Faculty',
      beneficiary_value:    normalizeText(data.beneficiary_value) || null,
      budget_tag:           normalizeText(data.budget_tag) || null,
      department_id:        workflowContext.departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head:         normalizeText(data.primary_head)
                              || normalizeText(lineRow.head)
                              || 'General',
      event_sub_head:       normalizeText(data.event_sub_head) || null,
      head:                 normalizeText(lineRow.head),
      sub_head:             normalizeText(lineRow.sub_head),
      amount:               requestedAmount,
      pre_advance_amount:   preAdvance,
      advance_total_amount: requestedAmount,
      total_amount:         requestedAmount,
      approved_total_amount: 0,
      payment_debit_account: normalizeText(data.payment_debit_account) || null,
      payment_mode:          normalizeText(data.payment_mode) || null,
      payment_status:       'Pending',
      overall_status:       'pending',
    };

    // NEW: resolve catalog IDs for the header head + event sub-head and add
    // them to the entry. Keeps text snapshot AND stable IDs in sync.
    // LEGACY: nulls allowed — text remains authoritative for those rows.
    const advHeaderIds = await resolvePrimaryHeadIds(
      conn,
      entry.primary_head,
      entry.event_sub_head,
    );
    entry.primary_head_id = advHeaderIds.primary_head_id;
    entry.event_sub_head_id = advHeaderIds.event_sub_head_id;

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
    beneficiary_type: normalizeBeneficiaryType(data.beneficiary_type)
      || normalizeText(data.beneficiary_type)
      || 'Individual Faculty',
    beneficiary_value: normalizeText(data.beneficiary_value) || null,
    budget_tag: normalizeText(data.budget_tag) || null,
    primary_head: normalizeText(data.primary_head) || 'General',
    event_sub_head: normalizeText(data.event_sub_head) || null,
    request_type: 'Advance',
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
    payee_rows: data.payee_id || paymentDetails.account_no
      ? [
        {
          payee_id: toPositiveInt(data.payee_id),
          payee_name: resolveCanonicalPayeeName(
            paymentDetails.payee_name || data.payee_name,
            paymentDetails.account_name,
          ) || null,
          bank_name: normalizeText(paymentDetails.bank_name) || null,
          account_no: normalizeText(paymentDetails.account_no) || null,
          ifsc: normalizeText(paymentDetails.ifsc).toUpperCase() || null,
          branch_name: normalizeText(paymentDetails.branch_name) || null,
          amount,
          mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
          account_name: resolveCanonicalPayeeName(
            paymentDetails.payee_name || data.payee_name,
            paymentDetails.account_name,
          ) || null,
          beneficiary_org: resolveCanonicalBeneficiaryOrg(
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
    payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status || 'Pending'),
    payment_debit_account: normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
  };

  return createExpenditureRequest(payload, userId, { billFiles: [], bulkNeftFile: null });
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
    ? `/${filePath.replace(process.cwd(), '').replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
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
      resolveCanonicalPayeeName(row.payeeName || row.payee_name, row.accountName || row.account_name),
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
    const beneficiaryType = sanitizeRowValue(row.beneficiaryType || row.beneficiary_type) || 'individual';
    const beneficiaryOrg = sanitizeRowValue(
      resolveCanonicalBeneficiaryOrg(row.beneficiaryOrg || row.beneficiary_org, row.payeeName || row.payee_name),
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
      [expenditureId, payeeId, payeeName, bankName, accountNo, ifsc, branchName, url, amount, mode,
       accountName, panNumber, accountType, beneficiaryType, beneficiaryOrg,
       organizationType, msme, gstin, tdsDetails, tdsSection, sortOrder],
    );
    sortOrder += 1;
  }
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
           advance_amount, available_amount_snapshot, remaining_amount_snapshot,
           unplanned_available_snapshot, sort_order)
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        advIds.budget_head_id,
        advIds.budget_sub_head_id,
        budgetSnapshot ? budgetSnapshot.budgetAmount : budgetAmount,
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

async function insertSettlementRows(conn, expenditureId, rows = [], budgetSnapshotsByLine = new Map()) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const budgetSnapshot = budgetSnapshotsByLine.get(budgetLineId) || null;
    const advanceAmount = moneyOrNull(row.advance);
    const settlementAmount = toMoney(row.settlement || row.settlement_amount);
    if (!budgetHead && !subHead && settlementAmount === 0) continue;

    // NEW: catalog IDs alongside snapshot text.
    const setIds = await resolveCatalogIds(conn, budgetHead, subHead);

    await conn.execute(
       `INSERT INTO expenditure_settlement_rows
          (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
           amount_source, budget_head, sub_head, budget_head_id, budget_sub_head_id,
           budget_amount, advance_amount,
           settlement_amount, available_amount_snapshot, remaining_amount_snapshot,
           unplanned_available_snapshot, sort_order)
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        setIds.budget_head_id,
        setIds.budget_sub_head_id,
        budgetSnapshot ? budgetSnapshot.budgetAmount : budgetAmount,
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

async function insertExpenditureRows(conn, expenditureId, rows = [], budgetSnapshotsByLine = new Map()) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const budgetSnapshot = budgetSnapshotsByLine.get(budgetLineId) || null;
    const expenditureInput = sanitizeRowValue(row.expenditure || row.expenditure_input || row.autoSum || row.auto_sum_amount);
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
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        expenditureId,
        budgetProposalId,
        budgetLineId,
        budgetHead,
        subHead,
        lineIds.budget_head_id,
        lineIds.budget_sub_head_id,
        budgetSnapshot ? budgetSnapshot.budgetAmount : budgetAmount,
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

async function insertBillFiles(conn, expenditureId, files = []) {
  const validFiles = Array.isArray(files) ? files : [];
  let sortOrder = 0;

  for (const file of validFiles) {
    if (!file?.filename || !file?.path) continue;

    await conn.execute(
      `INSERT INTO expenditure_request_bills
         (expenditure_id, payee_row_id, original_name, stored_name, file_path, mime_type, file_size, sort_order)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
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

async function upsertBulkNeftFile(conn, expenditureId, file = null, templateVersion = null) {
  if (!file?.filename || !file?.path) return;

  await conn.execute(
    `INSERT INTO expenditure_bulk_neft_files
       (expenditure_id, template_version, original_name, stored_name, file_path, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       template_version = VALUES(template_version),
       original_name = VALUES(original_name),
       stored_name = VALUES(stored_name),
       file_path = VALUES(file_path),
       mime_type = VALUES(mime_type),
       file_size = VALUES(file_size),
       updated_at = CURRENT_TIMESTAMP`,
    [
      expenditureId,
      sanitizeRowValue(templateVersion) || DEFAULT_BULK_NEFT_TEMPLATE_VERSION,
      sanitizeRowValue(file.originalname),
      sanitizeRowValue(file.filename),
      toStoredUploadPath(file.path),
      sanitizeRowValue(file.mimetype),
      Number(file.size) || 0,
    ],
  );
}

function collectUsageRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows } = {}) {
  const usageByLine = new Map();

  const addUsage = (budgetLineId, amount) => {
    const lineId = toPositiveInt(budgetLineId);
    const normalizedAmount = toMoney(amount);
    if (!lineId || normalizedAmount <= 0) return;
    usageByLine.set(lineId, toMoney((usageByLine.get(lineId) || 0) + normalizedAmount));
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
      addUsage(row.budgetLineId || row.budget_line_id, row.autoSum || row.auto_sum_amount || row.expenditure);
    });
  }

  return [...usageByLine.entries()].map(([budgetLineId, amount]) => ({ budgetLineId, amount }));
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
) {
  const rows = getRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows });
  const filledRows = rows
    .map((row, index) => ({
      rowNumber: index + 1,
      budgetLineId: toPositiveInt(row.budgetLineId || row.budget_line_id),
      amount: getAmountForWorkflowRow(requestType, row),
    }))
    .filter((row) => row.amount > 0);

  if (!filledRows.length) return;

  const missingBudgetLineRows = filledRows.filter((row) => !row.budgetLineId).map((row) => row.rowNumber);
  if (missingBudgetLineRows.length) {
    throw new Error(
      `Please select a valid approved budget head and sub-head for row ${missingBudgetLineRows.join(', ')}`,
    );
  }

  const uniqueLineIds = Array.from(new Set(filledRows.map((row) => row.budgetLineId).filter(Boolean)));
  if (!uniqueLineIds.length) return;

  const placeholders = uniqueLineIds.map(() => '?').join(', ');
  const [linkedRows] = await conn.execute(
    `SELECT DISTINCT budget_line_id
       FROM finance_budget_breakup
      WHERE finance_id = ?
        AND budget_line_id IN (${placeholders})`,
    [financeRequestId, ...uniqueLineIds],
  );

  const approvedLineIds = new Set(linkedRows.map((row) => toPositiveInt(row.budget_line_id)).filter(Boolean));
  const invalidRows = filledRows
    .filter((row) => row.budgetLineId && !approvedLineIds.has(row.budgetLineId))
    .map((row) => row.rowNumber);

  if (invalidRows.length) {
    throw new Error(
      `Please select a valid approved budget head and sub-head for row ${invalidRows.join(', ')}`,
    );
  }
}

async function assertExpenditureRowsWithinApprovedHeadTotals(conn, financeRequestId, expenditureRows = [], {
  excludeExpenditureId = null,
} = {}) {
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

  const requestedByHead = new Map();
  const headLabelByKey = new Map();
  for (const row of amountRows) {
    const key = row.budgetHeadId ? `id:${row.budgetHeadId}` : `text:${row.headKey}`;
    requestedByHead.set(key, toMoney((requestedByHead.get(key) || 0) + row.amount));
    if (!headLabelByKey.has(key)) {
      headLabelByKey.set(key, row.budgetHead || row.headKey);
    }
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

  for (const row of approvedRows) {
    const catalogHeadId = toPositiveInt(row.budget_head_id);
    const textHeadKey = normalizeBudgetHeadKey(row.budget_head);
    const headKey = catalogHeadId ? `id:${catalogHeadId}` : `text:${textHeadKey}`;
    if (!headKey || !requestedByHead.has(headKey)) continue;

    approvedByHead.set(headKey, toMoney((approvedByHead.get(headKey) || 0) + toMoney(row.approved_amount)));

    const lineId = toPositiveInt(row.budget_line_id);
    if (lineId) {
      if (!lineIdsByHead.has(headKey)) {
        lineIdsByHead.set(headKey, new Set());
      }
      lineIdsByHead.get(headKey).add(lineId);
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
        .filter((row) => (row.budgetHeadId ? `id:${row.budgetHeadId}` : `text:${row.headKey}`) === headKey)
        .map((row) => row.rowNumber);
      throw new Error(
        `Please select a valid approved budget head for row ${rowNumbers.join(', ')}`,
      );
    }

    if (requestedAmount > remainingAmount) {
      const firstRow = amountRows.find((row) => (row.budgetHeadId ? `id:${row.budgetHeadId}` : `text:${row.headKey}`) === headKey);
      throw new Error(
        `Requested expenditure ${requestedAmount.toFixed(2)} exceeds remaining budget ${remainingAmount.toFixed(2)} for "${firstRow?.budgetHead || headLabelByKey.get(headKey) || headKey}"`,
      );
    }
  }
}

async function assertRequestTotalWithinApprovedFinanceAmount(conn, financeRequestId, requestType, requestedAmount) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  const normalizedRequestType = normalizeRequestType(requestType);
  const normalizedRequestedAmount = toMoney(requestedAmount);

  if (
    !normalizedFinanceRequestId ||
    !['Advance', 'Expenditure'].includes(normalizedRequestType) ||
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

async function getRemainingBudgetByLine(conn, financeRequestId, budgetLineIds = [], {
  excludeExpenditureId = null,
} = {}) {
  const normalizedFinanceRequestId = toPositiveInt(financeRequestId);
  const normalizedBudgetLineIds = Array.from(
    new Set((Array.isArray(budgetLineIds) ? budgetLineIds : []).map((id) => toPositiveInt(id)).filter(Boolean)),
  );

  if (!normalizedFinanceRequestId || normalizedBudgetLineIds.length === 0) {
    return new Map();
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
            toMoney(row.approved_amount) - toMoney(usageByLineId.get(toPositiveInt(row.budget_line_id))),
          ),
        ),
      },
    ]),
  );
}

function buildBudgetSnapshotsByLine(requestType, usageRows = [], remainingByLineId = new Map()) {
  const snapshots = new Map();
  const direction = requestType === 'Settlement' ? 0 : -1;

  for (const usageRow of usageRows) {
    const budgetLineId = toPositiveInt(usageRow.budgetLineId);
    const amount = toMoney(usageRow.amount);
    const budgetState = remainingByLineId.get(budgetLineId);
    if (!budgetLineId || !budgetState) continue;

    const availableBefore = toMoney(budgetState.remainingAmount);
    const remainingAfter = toMoney(Math.max(0, availableBefore + (direction * amount)));

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

    const requestDate = data.request_date ? new Date(data.request_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const financeRequestId = toPositiveInt(data.finance_request_id);
    if (!financeRequestId) {
      throw new Error('finance_request_id is required');
    }

    const financeOwner = await getApprovedFinanceRequestOwner(conn, financeRequestId);
    if (!financeOwner) {
      throw new Error('Finance request not found or not approved');
    }
    if (toPositiveInt(financeOwner.created_by) !== uid) {
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
    await assertWorkflowRowsHaveApprovedBudgetLines(conn, financeRequestId, requestType, {
      advanceRows,
      settlementRows,
      expenditureRows,
    });
    const workflowRowIdentity = resolveWorkflowRowIdentifiers(data);
    const sourceRequestId = toPositiveInt(data.source_request_id || data.sourceRequestId);
    const usageRows = collectUsageRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows });

    const advanceTotal = advanceRows.reduce((sum, row) => sum + toMoney(row.advance || row.advance_amount), 0);
    const settlementTotal = settlementRows.reduce((sum, row) => sum + toMoney(row.settlement || row.settlement_amount), 0);
    const expenditureTotal = expenditureRows.reduce((sum, row) => sum + toMoney(row.autoSum || row.expenditure || row.auto_sum_amount), 0);
    const totalAmount = toMoney(advanceTotal + settlementTotal + expenditureTotal);
    const workflowRowHistory = await getWorkflowRowHistory(conn, {
      financeRequestId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
    });

    validateWorkflowRowFlow(requestType, workflowRowHistory, {
      requestedAdvance: advanceTotal,
      requestedSettlement: settlementTotal,
      requestedExpenditure: expenditureTotal,
    });

    if (requestType === 'Advance') {
      await assertRequestTotalWithinApprovedFinanceAmount(conn, financeRequestId, requestType, advanceTotal);
    } else if (requestType === 'Expenditure') {
      await assertRequestTotalWithinApprovedFinanceAmount(conn, financeRequestId, requestType, expenditureTotal);
    } else if (usageRows.length) {
      const remainingByLineId = await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
      );

      for (const usageRow of usageRows) {
        const lineId = toPositiveInt(usageRow.budgetLineId);
        const requestedAmount = toMoney(usageRow.amount);
        const remaining = toMoney(remainingByLineId.get(lineId)?.remainingAmount);

        if (!lineId || !remainingByLineId.has(lineId)) {
          throw new Error(`Budget line ${lineId || 'unknown'} is not linked to this finance request`);
        }
        if (requestType !== 'Settlement' && requestedAmount > remaining) {
          throw new Error(
            `Requested amount ${requestedAmount.toFixed(2)} exceeds remaining budget ${remaining.toFixed(2)} for line ${lineId}`,
          );
        }
      }
    }

    const budgetSnapshotsByLine = buildBudgetSnapshotsByLine(
      requestType,
      usageRows,
      await getRemainingBudgetByLine(conn, financeRequestId, usageRows.map((row) => row.budgetLineId)),
    );

    const entry = {
      finance_request_id: financeRequestId,
      employee_id: employeeId || null,
      applicant_name: normalizeText(data.applicant_name) || (employee ? `${normalizeText(employee.title)} ${normalizeText(employee.first_name)} ${normalizeText(employee.last_name)}`.trim() : null),
      designation: normalizeText(data.designation) || normalizeText(employee?.designation) || null,
      department: normalizeText(data.department) || normalizeText(employee?.department) || null,
      email: normalizeText(data.email) || normalizeText(employee?.email) || null,
      mobile: normalizeText(data.mobile) || normalizeText(employee?.mobile) || null,
      request_date: requestDate,
      description: normalizeText(data.description) || null,
      beneficiary_type: normalizeBeneficiaryType(data.beneficiary_type)
        || normalizeText(data.beneficiary_type)
        || 'Individual Faculty',
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
      income_type: normalizeText(data.income_type) || null,
      income_status: normalizeText(data.income_status) || null,
      income_amount_type: normalizeText(data.income_amount_type) || null,
      credit_status: normalizeText(data.credit_status) || null,
      debit_status: normalizeDebitStatus(data.debit_status),
      partial_amount: moneyOrNull(data.partial_amount),
      show_bulk_neft: (parseBoolean(data.show_bulk_neft) || Boolean(uploads.bulkNeftFile)) ? 1 : 0,
      payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
      payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
      payment_date: paymentDetails.date || data.payment_date || null,
      payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status),
      payment_debit_account: normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
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
      total_amount: totalAmount,
      approved_total_amount: 0.00,
      created_by: uid,
      overall_status: 'pending',
    };

    // NEW: resolve and attach catalog IDs (Phase 2 of catalog ref hardening).
    // LEGACY: nulls when the catalog has no matching name.
    const headerIds = await resolvePrimaryHeadIds(
      conn,
      entry.primary_head,
      entry.event_sub_head,
    );
    entry.primary_head_id = headerIds.primary_head_id;
    entry.event_sub_head_id = headerIds.event_sub_head_id;

    const filteredEntry = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== null && value !== undefined && value !== ''),
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
await insertSettlementRows(conn, expenditureId, settlementRows, budgetSnapshotsByLine);
await insertExpenditureRows(conn, expenditureId, expenditureRows, budgetSnapshotsByLine);
    await insertBillFiles(conn, expenditureId, uploads.billFiles);
    await upsertBulkNeftFile(
      conn,
      expenditureId,
      uploads.bulkNeftFile,
      data.bulk_neft_template_version,
    );

    return { expenditureId, requestRef: ref };
  });
}

export async function updateExpenditureRequest(expenditureId, data, userId, uploads = {}, options = {}) {
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
    const financeRequestId = toPositiveInt(data.finance_request_id) || toPositiveInt(existingRecord.finance_request_id);
    if (!financeRequestId) {
      throw new Error('finance_request_id is required');
    }

    const financeOwner = await getApprovedFinanceRequestOwner(conn, financeRequestId);
    if (!financeOwner) {
      throw new Error('Finance request not found or not approved');
    }
    if (!canBypassFinanceOwnerCheck && toPositiveInt(financeOwner.created_by) !== uid) {
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
    await assertWorkflowRowsHaveApprovedBudgetLines(conn, financeRequestId, requestType, {
      advanceRows,
      settlementRows,
      expenditureRows,
    });

    const workflowRowIdentity = resolveWorkflowRowIdentifiers(data);
    const sourceRequestId = toPositiveInt(data.source_request_id || data.sourceRequestId);
    const usageRows = collectUsageRowsForRequestType(requestType, { advanceRows, settlementRows, expenditureRows });
    const advanceTotal = advanceRows.reduce((sum, row) => sum + toMoney(row.advance || row.advance_amount), 0);
    const settlementTotal = settlementRows.reduce((sum, row) => sum + toMoney(row.settlement || row.settlement_amount), 0);
    const expenditureTotal = expenditureRows.reduce((sum, row) => sum + toMoney(row.autoSum || row.expenditure || row.auto_sum_amount), 0);
    const totalAmount = toMoney(advanceTotal + settlementTotal + expenditureTotal);

    const workflowRowHistory = await getWorkflowRowHistory(conn, {
      financeRequestId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      rowIndex: workflowRowIdentity.rowIndex,
      sourceRequestId,
    });

    if (requestType === 'Advance' && advanceTotal <= 0) {
      throw new Error('Advance amount must be greater than 0');
    }
    if (requestType === 'Settlement' && settlementTotal <= 0) {
      throw new Error('Settlement amount must be greater than 0');
    }
    if (requestType === 'Expenditure' && expenditureTotal <= 0) {
      throw new Error('Expenditure amount must be greater than 0');
    }

    const filteredWorkflowHistory = workflowRowHistory.filter((row) => row.id !== normalizedExpenditureId);
    if (filteredWorkflowHistory.length) {
      const currentRequestType = normalizeText(existingRecord.request_type);
      const hasAdvance = filteredWorkflowHistory.some((row) => row.requestType === 'Advance');
      const hasSettlement = filteredWorkflowHistory.some((row) => row.requestType === 'Settlement');
      const hasExpenditure = filteredWorkflowHistory.some((row) => row.requestType === 'Expenditure');
      if (requestType === 'Advance') {
        if (hasExpenditure) {
          throw new Error('Expenditure already exists for this row. Create a new row for advance.');
        }
        if (hasSettlement) {
          throw new Error('Settlement already exists for this row. Create a new row for another advance.');
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

    if (requestType === 'Advance') {
      await assertRequestTotalWithinApprovedFinanceAmount(conn, financeRequestId, requestType, advanceTotal);
    } else if (requestType === 'Expenditure') {
      await assertRequestTotalWithinApprovedFinanceAmount(conn, financeRequestId, requestType, expenditureTotal);
    } else if (usageRows.length) {
      const remainingByLineId = await getRemainingBudgetByLine(
        conn,
        financeRequestId,
        usageRows.map((row) => row.budgetLineId),
        { excludeExpenditureId: normalizedExpenditureId },
      );

      for (const usageRow of usageRows) {
        const lineId = toPositiveInt(usageRow.budgetLineId);
        const requestedAmount = toMoney(usageRow.amount);
        const remaining = toMoney(remainingByLineId.get(lineId)?.remainingAmount);

        if (!lineId || !remainingByLineId.has(lineId)) {
          throw new Error(`Budget line ${lineId || 'unknown'} is not linked to this finance request`);
        }
        if (requestType !== 'Settlement' && requestedAmount > remaining) {
          throw new Error(
            `Requested amount ${requestedAmount.toFixed(2)} exceeds remaining budget ${remaining.toFixed(2)} for line ${lineId}`,
          );
        }
      }
    }

    const budgetSnapshotsByLine = buildBudgetSnapshotsByLine(
      requestType,
      usageRows,
      await getRemainingBudgetByLine(conn, financeRequestId, usageRows.map((row) => row.budgetLineId), {
        excludeExpenditureId: normalizedExpenditureId,
      }),
    );

    const normalizeSqlDate = (value) => {
      const text = normalizeText(value);
      if (!text) return null;

      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }

      const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : null;
    };

    const normalizedPaymentDate = normalizeSqlDate(paymentDetails.date || data.payment_date);

    const updatedEntry = {
      finance_request_id: financeRequestId,
      employee_id: employeeId || null,
      applicant_name: normalizeText(data.applicant_name) || (employee ? `${normalizeText(employee.title)} ${normalizeText(employee.first_name)} ${normalizeText(employee.last_name)}`.trim() : null),
      designation: normalizeText(data.designation) || normalizeText(employee?.designation) || null,
      department: normalizeText(data.department) || normalizeText(employee?.department) || null,
      email: normalizeText(data.email) || normalizeText(employee?.email) || null,
      mobile: normalizeText(data.mobile) || normalizeText(employee?.mobile) || null,
      request_date: requestDate,
      description: normalizeText(data.description) || null,
      beneficiary_type: normalizeBeneficiaryType(data.beneficiary_type)
        || normalizeText(data.beneficiary_type)
        || 'Individual Faculty',
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
      income_type: normalizeText(data.income_type) || null,
      income_status: normalizeText(data.income_status) || null,
      income_amount_type: normalizeText(data.income_amount_type) || null,
      credit_status: normalizeText(data.credit_status) || null,
      debit_status: normalizeDebitStatus(data.debit_status),
      partial_amount: moneyOrNull(data.partial_amount),
      show_bulk_neft: (parseBoolean(data.show_bulk_neft) || Boolean(uploads.bulkNeftFile)) ? 1 : 0,
      payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
      payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
      payment_date: normalizedPaymentDate,
      payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status),
      payment_debit_account: normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
      advance_total_amount: toMoney(advanceTotal),
      settlement_total_amount: toMoney(settlementTotal),
      expenditure_total_amount: toMoney(expenditureTotal),
      total_amount: totalAmount,
    };

    const filteredUpdateEntry = Object.fromEntries(
      Object.entries(updatedEntry).filter(([, value]) => value !== null && value !== undefined && value !== ''),
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

    await conn.execute('DELETE FROM expenditure_income_rows WHERE expenditure_id = ?', [normalizedExpenditureId]);
    await conn.execute('DELETE FROM expenditure_payee_rows WHERE expenditure_id = ?', [normalizedExpenditureId]);
    await conn.execute('DELETE FROM expenditure_advance_rows WHERE expenditure_id = ?', [normalizedExpenditureId]);
    await conn.execute('DELETE FROM expenditure_settlement_rows WHERE expenditure_id = ?', [normalizedExpenditureId]);
    await conn.execute('DELETE FROM expenditure_line_rows WHERE expenditure_id = ?', [normalizedExpenditureId]);

    if (Array.isArray(uploads.billFiles) && uploads.billFiles.length) {
      await conn.execute('DELETE FROM expenditure_request_bills WHERE expenditure_id = ?', [normalizedExpenditureId]);
    }

    await insertIncomeRows(conn, normalizedExpenditureId, incomeRows);
    await insertPayeeRows(conn, normalizedExpenditureId, payeeRows, uid);
    await insertAdvanceRows(conn, normalizedExpenditureId, advanceRows, uid, budgetSnapshotsByLine, {
      financeRequestId,
      rowIndex: workflowRowIdentity.rowIndex,
      dashboardRowId: workflowRowIdentity.dashboardRowId,
      workflowRowRef: workflowRowIdentity.workflowRowRef,
      sourceRequestId,
    });
    await insertSettlementRows(conn, normalizedExpenditureId, settlementRows, budgetSnapshotsByLine);
    await insertExpenditureRows(conn, normalizedExpenditureId, expenditureRows, budgetSnapshotsByLine);
    await insertBillFiles(conn, normalizedExpenditureId, uploads.billFiles);
    await upsertBulkNeftFile(
      conn,
      normalizedExpenditureId,
      uploads.bulkNeftFile,
      data.bulk_neft_template_version,
    );

    return { expenditureId: normalizedExpenditureId, requestRef: existingRecord.request_ref || null };
  });
}

export async function searchApplicant(query = '', employeeType = null) {
  return searchEmployeeApplicants(query, employeeType);
}

/**
 * Fetch a single expenditure request with joined applicant and payee details.
 */
export async function getExpenditureById(id) {
  const [rows] = await db.execute(
    `${EXPENDITURE_SELECT} WHERE er.id = ? LIMIT 1`, [id],
  );
  return rows[0] || null;
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
      bill_files: [],
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
    bulkNeftFileResult,
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
              sort_order, created_at
         FROM expenditure_request_bills
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, template_version, original_name, stored_name, file_path, mime_type, file_size,
              created_at, updated_at
         FROM expenditure_bulk_neft_files
        WHERE expenditure_id = ?
        LIMIT 1`,
      [expenditureId],
    ),
  ]);

  const [income_rows] = incomeRowsResult;
  const [payee_rows] = payeeRowsResult;
  const [advance_rows] = advanceRowsResult;
  const [settlement_rows] = settlementRowsResult;
  const [expenditure_rows] = expenditureRowsResult;
  const [bill_files] = billFilesResult;
  const [bulkNeftRows] = bulkNeftFileResult;

  return {
    income_rows,
    payee_rows: payee_rows.map(normalizePayeeRecord),
    advance_rows,
    settlement_rows,
    expenditure_rows,
    bill_files: bill_files.map(withUploadAccess),
    bulk_neft_file: withUploadAccess(bulkNeftRows[0] || null),
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
  page  = 1,
  limit = 20,
} = {}) {
  const conditions = [];
  const params     = [];

  if (mine && userId) {
    conditions.push('er.created_by = ?');
    params.push(toPositiveInt(userId));
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

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageNum  = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset   = (pageNum - 1) * limitNum;

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM expenditure_requests er ${where}`, params,
  );

  const [rows] = await db.execute(
    `${EXPENDITURE_SELECT} ${where} ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return { items: rows, total: Number(total), page: pageNum, limit: limitNum };
}

/**
 * Update scalar fields on an expenditure request (payment tracking, status, etc.).
 * Does NOT re-run budget deduction.
 */
export async function updateExpenditure(id, data, actor = null) {
  const ALLOWED = [
  'description', 'payment_debit_account', 'payment_mode',
  'payment_ref_no', 'payment_date', 'payment_status',
];

  const update = Object.fromEntries(
    Object.entries(data)
      .filter(([k, v]) => ALLOWED.includes(k) && v !== undefined)
      .map(([k, v]) => [k, v === '' ? null : v]),
  );

  if (!Object.keys(update).length) return { affectedRows: 0 };

  const updateKeys = Object.keys(update);
  const setClause = updateKeys.map((key) => `${key} = ?`).join(', ');

  const [result] = await db.execute(
    `UPDATE expenditure_requests SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...updateKeys.map((key) => update[key]), id],
  );

  try {
    await db.execute(
      `INSERT INTO expenditure_request_edits
         (expenditure_request_id, edited_by_user_id, edited_by_email,
          edited_by_role, is_admin, summary, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        toPositiveInt(actor?.id)                     || null,
        normalizeText(actor?.email)                  || null,
        normalizeText(actor?.role).toLowerCase()     || null,
        Boolean(actor?.isSuperAdmin) ? 1 : 0,
        'Expenditure request updated',
        JSON.stringify({ updatedKeys: Object.keys(update) }),
      ],
    );
  } catch (auditErr) {
    if (auditErr?.code !== 'ER_NO_SUCH_TABLE') throw auditErr;
  }

  return result;
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
    'SELECT id, created_by FROM expenditure_requests WHERE id = ? LIMIT 1', [n],
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
  const [workflowRows] = await db.execute(
    `SELECT
       wa.id,
       wa.record_id  AS expenditure_id,
       wa.stage,
       wa.decision   AS status,
       wa.feedback   AS comment,
       wa.decided_at AS created_at,
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

  return [...workflowRows, ...editRows].sort((a, b) => {
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

  if (LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY.includes(beneficiaryType) && beneficiaryEntityId) {
    return 'entity_contact';
  }

  return 'department_hod';
};

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL = LEVEL1_COORDINATOR_BENEFICIARY_TYPES
  .map(escapeSqlLiteral)
  .join(', ');
const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL = LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY
  .map(escapeSqlLiteral)
  .join(', ');

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
    [normalizedRecordId]
  );

  if (!rows.length) return null;
  const row = rows[0];

  return {
    beneficiaryType: normalizeBeneficiaryType(row.beneficiary_type) || normalizeText(row.beneficiary_type),
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
    existingRows?.[0]?.workflow_state ?? existingRows?.[0]?.workflowstate
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

export async function autoApprovePrincipalWorkflowStage(recordId, {
  actor = {},
  feedback = 'Auto-approved after DoF clearance',
} = {}, { tx = null } = {}) {
  if (!tx) {
    return withTransaction((conn) =>
      autoApprovePrincipalWorkflowStage(recordId, { actor, feedback }, { tx: conn })
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
    [normalizedRecordId]
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
    ]
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

export async function forceWorkflowTransition(recordId, {
  decision,
  feedback = null,
  actor = {},
  stageHint = null,
} = {}, { tx = db } = {}) {
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
    [normalizedRecordId]
  );

  if (!rows.length) {
    throw new Error('Expenditure request not found');
  }

  const previousState = normalizeWorkflowState(rows[0].workflow_state);
  if (!previousState) {
    throw new Error('Workflow state not found');
  }

  const flow = Array.isArray(previousState.flow) && previousState.flow.length
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
          route: normalizedDecision === 'archived'
            ? 'PATCH /api/expenditure-requests/:id/archive-toggle'
            : 'PATCH /api/expenditure-requests/:id/approval',
        },
      }),
    ]
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
    [normalizedRecordId]
  );

  if (!rows.length) {
    return { restored: false, reason: 'No archived snapshot found' };
  }

  const previousState = normalizeWorkflowState(rows[0].snapshot_before);
  if (!previousState) {
    return { restored: false, reason: 'Archived snapshot is not restorable' };
  }

  const updated = await updateExpenditureWorkflowSnapshot(normalizedRecordId, previousState, { tx });
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
    [normalizedRecordId]
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

export async function listExpenditureQueueRecords(stage, filters = {}, { tx = db } = {}) {
  const normalizedStage = normalizeText(stage).toLowerCase();
  const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';
  const isSuperAdmin = Boolean(filters.isSuperAdmin);
  const isAllProposals = isSuperAdmin && Boolean(filters.allProposals);
  const level1Role = normalizeText(filters.level1Role).toLowerCase();
  const requestedStatusCategory = normalizeText(filters.statusCategory).toLowerCase();
  const statusCategoryFilter = ['pending', 'approved', 'returned', 'rejected', 'archived'].includes(requestedStatusCategory)
    ? requestedStatusCategory
    : '';
  const isAllStage = normalizedStage === 'all';
  const statusStageScope = isAllProposals || isAllStage ? 'all' : normalizedStage;
  const searchTerm = normalizeText(filters.q || filters.search);

  const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereParts = [`LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'`];
  const whereParams = [];

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
        )`
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
        CAST(er.id AS CHAR) LIKE ?
        OR EXISTS (
          SELECT 1
            FROM expenditure_request_refs err_search
           WHERE err_search.expenditure_request_id = er.id
             AND LOWER(COALESCE(err_search.request_ref, '')) LIKE LOWER(?)
        )
        OR LOWER(CONCAT('#EX-', YEAR(COALESCE(er.request_date, er.created_at)), '-', LPAD(er.id, 4, '0'))) LIKE LOWER(?)
        OR LOWER(CONCAT('EX-', YEAR(COALESCE(er.request_date, er.created_at)), '-', LPAD(er.id, 4, '0'))) LIKE LOWER(?)
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
      )`
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
      searchLike,
      searchLike
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
      )`
    );
    whereParams.push(priorTerminalStage);
  }

  const baseWhereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await tx.query(
    `SELECT COUNT(*) AS total
       FROM expenditure_requests er
       ${baseWhereClause}`,
    whereParams
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
    [statusStageScope, statusStageScope, statusStageScope, statusStageScope, statusStageScope, ...whereParams]
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
      END) = ?`
    );
    whereParams.push(statusStageScope, statusStageScope, statusStageScope, statusStageScope, statusStageScope, statusCategoryFilter);
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
       er.created_by,
       er.beneficiary_type,
       er.beneficiary_value,
       er.beneficiary_entity_id,
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
     LEFT JOIN master_employees emp ON emp.id = er.employee_id
     ${whereClause}
     ORDER BY er.created_at DESC
     LIMIT ? OFFSET ?`,
    [statusStageScope, statusStageScope, ...whereParams, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      ...row,
      workflow_state: normalizeWorkflowState(row.workflow_state),
      level1_route_type: resolveExpenditureLevel1RouteType(row),
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
      ORDER BY TRIM(beneficiary_type) ASC`
  );

  const dedup = new Map();
  for (const row of rows || []) {
    const normalized = normalizeBeneficiaryType(row?.beneficiary_type) || normalizeText(row?.beneficiary_type);
    const key = normalizeText(normalized).toLowerCase();
    if (!key || dedup.has(key)) continue;
    dedup.set(key, normalized);
  }

  return Array.from(dedup.values());
}

export async function hardDeleteExpenditureRequest(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) return false;
  const [result] = await db.execute('DELETE FROM expenditure_requests WHERE id = ?', [expenditureId]);
  return result.affectedRows > 0;
}

export async function revertBudgetUsage(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) return false;

  // createExpenditureRequest does not currently reserve finance_budget_line_usage.
  // Keep this cleanup hook non-destructive so workflow-start failures only remove the draft request.
  return true;
}
