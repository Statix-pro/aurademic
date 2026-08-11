/**
 * expenditureReportModel.js
 *
 * Read-only aggregation layer behind the Expenditure Report (/reports/expenditure).
 *
 * Every tab reads the same "spend ledger": the three row tables that hold an expenditure
 * request's money, unioned into one set of (expenditure_id, flow, budget_head, sub_head,
 * amount) tuples. One filter builder feeds all three queries, so the Budget Head,
 * Beneficiary and Month-wise tabs can never disagree about what is in scope.
 *
 * Amount semantics:
 *   advance    — expenditure_advance_rows.advance_amount     (cash advanced out)
 *   settlement — expenditure_settlement_rows.settlement_amount (actual spend against an advance)
 *   spend      — expenditure_line_rows.auto_sum_amount        (direct expenditure, no advance)
 *
 *   totalSpent       = settlement + spend  (an advance is realised BY its settlement, so
 *                                           adding both would double-count the same money)
 *   unsettledAdvance = max(advance - settlement, 0), clamped PER ROW and then summed — never
 *                      recomputed from summed totals, or a row that settled more than it
 *                      advanced would cancel another row's outstanding advance.
 */

import db from '../../config/connection.js';
import { normalizeBeneficiaryType } from '../shared/budget/budgetUtils.js';
import { buildDateRangeCondition, normalizeDateRange } from '../shared/dateRangeFilter.js';
import {
  buildExpenditureDisplayRefExpr,
  buildExpenditureFiscalYearCondition,
  buildFinalizedExpenditureStatusCondition,
  collateBudgetText,
} from '../shared/expenditureFilters.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toMoney = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

/**
 * Roles that see the whole institution. Everyone else is narrowed or falls back to own records.
 *
 * `finance_admin` is this system's Director of Finance — there is no `dof` role_code in the
 * roles table, only the `expenditure.workflow.dof` permission, so listing `dof` alone would
 * silently deny the DOF their own report. `dof` stays in the list for forward compatibility
 * if the role code is ever added.
 */
const GLOBAL_REPORT_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'finance_admin',
  'dof',
  'principal',
  'chairman',
]);

/**
 * Institution-wide access also follows the workflow permission, not just the role code —
 * the same belt-and-braces check the budget report makes
 * (`roleCodes.includes('dof') || hasPermission(user, 'budget.workflow.dof')`), so a custom
 * role granted the DOF or Principal stage still gets the whole picture.
 */
const GLOBAL_REPORT_PERMISSIONS = Object.freeze([
  'expenditure.workflow.dof',
  'expenditure.workflow.principal',
  'finance.workflow.dof',
  'finance.workflow.principal',
]);

const MONTH_LABELS = Object.freeze([
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]);

/** A month-column list longer than this stops being a table anyone can read. */
const MAX_MONTH_COLUMNS = 24;

/** The row's report date — the same expression the approval queue filters and the CSV shows. */
const REPORT_DATE_SQL = `COALESCE(er.request_date, DATE(er.created_at))`;

/**
 * Only finalized money is reported as advance/settlement/expenditure; anything still moving is
 * reported as pending. Defined in shared/ so a second screen needing "has this cleared its
 * workflow" adopts this definition instead of restating it.
 */
const FINALIZED_SQL = buildFinalizedExpenditureStatusCondition('er');

/**
 * Deleted, rejected and archived requests never contribute to the report — the same
 * exclusions the budget report applies to proposals.
 */
const REPORTABLE_REQUEST_SQL = `NOT (
  LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) IN ('deleted', 'rejected', 'archived')
  OR LOWER(TRIM(COALESCE(er.workflow_status, ''))) IN ('rejected', 'archived')
  OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.status')), ''))) IN ('rejected', 'archived')
)`;

/** Same expression the queue displays, so a ref copied from there matches the search here. */
const DISPLAY_REF_SQL = buildExpenditureDisplayRefExpr('er');

const APPLICANT_NAME_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
  NULLIF(TRIM(er.applicant_name), ''),
  'Unknown Applicant'
)`;

const BENEFICIARY_LABEL_SQL = `COALESCE(
  NULLIF(TRIM(ent.name), ''),
  NULLIF(TRIM(dept.name), ''),
  NULLIF(TRIM(er.beneficiary_value), ''),
  NULLIF(TRIM(er.department), ''),
  ''
)`;

/**
 * The unioned spend ledger. `flow` names which of the three tables a row came from, so a
 * single GROUP BY can split the amounts into columns.
 */
const SPEND_LEDGER_SQL = `
  SELECT
    ar.expenditure_id,
    'advance' AS flow,
    ${collateBudgetText('ar.budget_head')} AS budget_head,
    ${collateBudgetText('ar.sub_head')} AS sub_head,
    COALESCE(ar.advance_amount, 0) AS amount
  FROM expenditure_advance_rows ar
  UNION ALL
  SELECT
    sr.expenditure_id,
    'settlement' AS flow,
    ${collateBudgetText('sr.budget_head')} AS budget_head,
    ${collateBudgetText('sr.sub_head')} AS sub_head,
    COALESCE(sr.settlement_amount, 0) AS amount
  FROM expenditure_settlement_rows sr
  UNION ALL
  SELECT
    lr.expenditure_id,
    'spend' AS flow,
    ${collateBudgetText('lr.budget_head')} AS budget_head,
    ${collateBudgetText('lr.sub_head')} AS sub_head,
    COALESCE(lr.auto_sum_amount, 0) AS amount
  FROM expenditure_line_rows lr
`;

/** Joins every report query needs: the ledger plus the labels the rows are grouped by. */
const REPORT_FROM_SQL = `
  FROM expenditure_requests er
  JOIN (${SPEND_LEDGER_SQL}) s ON s.expenditure_id = er.id
  LEFT JOIN master_employees emp ON emp.id = er.employee_id
  LEFT JOIN master_departments dept ON dept.id = er.department_id
  LEFT JOIN master_entities ent ON ent.id = er.beneficiary_entity_id
`;

const finalizedFlowSum = (flow, alias) =>
  `SUM(CASE WHEN ${FINALIZED_SQL} AND s.flow = '${flow}' THEN s.amount ELSE 0 END) AS ${alias}`;

/**
 * The metric columns every grouping shares: finalized money split by flow, plus everything
 * still awaiting approval.
 */
const METRIC_SELECT_SQL = `
  ${finalizedFlowSum('advance', 'advance')},
  ${finalizedFlowSum('settlement', 'settlement')},
  ${finalizedFlowSum('spend', 'expenditure')},
  SUM(CASE WHEN ${FINALIZED_SQL} THEN 0 ELSE s.amount END) AS pending,
  COUNT(DISTINCT er.id) AS request_count
`;

/** Turns the raw metric columns into the shape the client's tables render. */
const mapMetrics = (row = {}) => {
  const advance = toMoney(row.advance);
  const settlement = toMoney(row.settlement);
  const expenditure = toMoney(row.expenditure);

  return {
    advance,
    settlement,
    expenditure,
    totalSpent: Math.round((settlement + expenditure) * 100) / 100,
    unsettledAdvance: Math.max(Math.round((advance - settlement) * 100) / 100, 0),
    pending: toMoney(row.pending),
    requestCount: Number(row.request_count || 0),
  };
};

// ─── Scope ────────────────────────────────────────────────────────────────────

/**
 * What slice of the institution this user may report on, read from user_entity_roles the
 * same way the workflow scope resolver builds its assignment buckets.
 *
 * Fail-closed by design: a role this function does not recognise gets `ownOnly`, never
 * everything — so a new role added to the system cannot silently gain institution-wide
 * visibility of spend.
 *
 * @returns {Promise<{scopeType: 'global'|'department'|'entity'|'own', departmentIds: number[], entityIds: number[], userId: number|null}>}
 */
export async function resolveReportScope({
  userId,
  roles = [],
  permissions = [],
  isSuperAdmin = false,
} = {}) {
  const normalizedUserId = toPositiveInt(userId);
  const toTokens = (values) => [
    ...new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean),
    ),
  ];

  const normalizedRoles = toTokens(roles);
  const normalizedPermissions = toTokens(permissions);

  if (
    isSuperAdmin ||
    normalizedRoles.some((role) => GLOBAL_REPORT_ROLES.includes(role)) ||
    normalizedPermissions.some((permission) => GLOBAL_REPORT_PERMISSIONS.includes(permission))
  ) {
    return { scopeType: 'global', departmentIds: [], entityIds: [], userId: normalizedUserId };
  }

  const isHod = normalizedRoles.includes('hod');
  const isCoordinator =
    normalizedRoles.includes('coordinator') || normalizedRoles.includes('entity_approver');

  if (!normalizedUserId || (!isHod && !isCoordinator)) {
    return { scopeType: 'own', departmentIds: [], entityIds: [], userId: normalizedUserId };
  }

  // Only an assignment made UNDER a scope-granting approver role widens the scope. Counting
  // every `user_entity_roles` row regardless of the role that granted it would hand an HOD any
  // other department they hold a non-approver grant in, and would disagree with the approval
  // queue, which filters the same way (workflowScopeResolver.loadAssignmentBuckets). The early
  // return above guarantees this list is non-empty.
  const scopeRoleCodes = [
    ...(isHod ? ['hod'] : []),
    ...(isCoordinator ? ['coordinator', 'entity_approver'] : []),
  ];

  const [rows] = await db.query(
    `SELECT uer.entity_id, uer.entity_type
       FROM user_entity_roles uer
       JOIN roles r ON r.id = uer.role_id
      WHERE uer.user_id = ?
        AND LOWER(TRIM(r.role_code)) IN (?)`,
    [normalizedUserId, scopeRoleCodes],
  );

  const departmentIds = [];
  const entityIds = [];

  for (const row of rows || []) {
    const entityId = toPositiveInt(row?.entity_id);
    if (!entityId) continue;

    if (normalizeText(row?.entity_type).toUpperCase() === 'DEPARTMENT') {
      departmentIds.push(entityId);
    } else {
      entityIds.push(entityId);
    }
  }

  if (isHod && departmentIds.length) {
    return {
      scopeType: 'department',
      departmentIds: [...new Set(departmentIds)],
      entityIds: [],
      userId: normalizedUserId,
    };
  }

  if (isCoordinator && entityIds.length) {
    return {
      scopeType: 'entity',
      departmentIds: [],
      entityIds: [...new Set(entityIds)],
      userId: normalizedUserId,
    };
  }

  // An approver with no assignment yet sees their own requests rather than everyone's.
  return { scopeType: 'own', departmentIds: [], entityIds: [], userId: normalizedUserId };
}

// ─── Filters ──────────────────────────────────────────────────────────────────

/**
 * Builds the WHERE clause shared by every report query.
 *
 * fiscalYear and the date window are independent and AND together, which is what lets the
 * client offer three period modes off one endpoint: full year (fiscalYear only), a single
 * month (fiscalYear + that month's bounds) and a free range (bounds only, so it can span
 * fiscal years).
 *
 * @returns {{whereSql: string, params: unknown[], dateFrom: string|null, dateTo: string|null}}
 */
export function buildReportFilters({
  fiscalYear,
  dateFrom,
  dateTo,
  beneficiaryType,
  beneficiaryValue,
  q,
  scope,
} = {}) {
  const where = [REPORTABLE_REQUEST_SQL];
  const params = [];

  const normalizedFiscalYear = toPositiveInt(fiscalYear);
  if (normalizedFiscalYear) {
    where.push(buildExpenditureFiscalYearCondition('er'));
    params.push(
      normalizedFiscalYear,
      normalizedFiscalYear,
      normalizedFiscalYear,
      normalizedFiscalYear,
      normalizedFiscalYear,
    );
  }

  const dateRange = buildDateRangeCondition(REPORT_DATE_SQL, { dateFrom, dateTo });
  if (dateRange.sql) {
    where.push(dateRange.sql);
    params.push(...dateRange.params);
  }

  const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
  if (normalizedBeneficiaryType && normalizedBeneficiaryType.toLowerCase() !== 'all') {
    where.push(`LOWER(TRIM(COALESCE(er.beneficiary_type, ''))) = LOWER(TRIM(?))`);
    params.push(normalizedBeneficiaryType);
  }

  const normalizedBeneficiaryValue = normalizeText(beneficiaryValue);
  if (normalizedBeneficiaryValue && normalizedBeneficiaryValue.toLowerCase() !== 'all') {
    // Matches the beneficiary the money was spent FOR, not the submitter's department —
    // same reasoning as getConsolidatedData in adminBudgetModel.js.
    where.push(`(
      LOWER(TRIM(COALESCE(ent.name, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(dept.name, ''))) = LOWER(TRIM(?))
      OR LOWER(TRIM(COALESCE(er.beneficiary_value, ''))) = LOWER(TRIM(?))
    )`);
    params.push(normalizedBeneficiaryValue, normalizedBeneficiaryValue, normalizedBeneficiaryValue);
  }

  const searchTerm = normalizeText(q);
  if (searchTerm) {
    const like = `%${searchTerm}%`;
    where.push(`(
      LOWER(${DISPLAY_REF_SQL}) LIKE LOWER(?)
      OR LOWER(REPLACE(${DISPLAY_REF_SQL}, '#', '')) LIKE LOWER(?)
      OR LOWER(COALESCE(er.applicant_name, '')) LIKE LOWER(?)
      OR LOWER(${APPLICANT_NAME_SQL}) LIKE LOWER(?)
      OR LOWER(COALESCE(er.beneficiary_value, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(ent.name, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(dept.name, '')) LIKE LOWER(?)
      OR LOWER(COALESCE(er.department, '')) LIKE LOWER(?)
      OR LOWER(s.budget_head) LIKE LOWER(?)
      OR LOWER(s.sub_head) LIKE LOWER(?)
    )`);
    params.push(like, like, like, like, like, like, like, like, like, like);
  }

  const scopeType = normalizeText(scope?.scopeType).toLowerCase() || 'own';
  if (scopeType === 'department') {
    const departmentIds = (scope?.departmentIds || []).map(toPositiveInt).filter(Boolean);
    if (!departmentIds.length) {
      where.push('1 = 0');
    } else {
      where.push('er.department_id IN (?)');
      params.push(departmentIds);
    }
  } else if (scopeType === 'entity') {
    const entityIds = (scope?.entityIds || []).map(toPositiveInt).filter(Boolean);
    if (!entityIds.length) {
      where.push('1 = 0');
    } else {
      where.push('er.beneficiary_entity_id IN (?)');
      params.push(entityIds);
    }
  } else if (scopeType !== 'global') {
    const ownerId = toPositiveInt(scope?.userId);
    if (!ownerId) {
      where.push('1 = 0');
    } else {
      where.push('er.created_by = ?');
      params.push(ownerId);
    }
  }

  const { dateFrom: normalizedFrom, dateTo: normalizedTo } = normalizeDateRange({
    dateFrom,
    dateTo,
  });

  return {
    whereSql: `WHERE ${where.join(' AND ')}`,
    params,
    dateFrom: normalizedFrom,
    dateTo: normalizedTo,
    fiscalYear: normalizedFiscalYear,
  };
}

// ─── Tab 1: consolidation by budget head ──────────────────────────────────────

/**
 * Spend rolled up by budget head, plus the per-request detail rows behind each head.
 *
 * Returns the same envelope shape the budget dashboard already consumes
 * ({ consolidatedRows, detailsByHead, availableBeneficiaryTypes }) so both reports share
 * one table-rendering idiom on the client.
 */
export async function getExpenditureConsolidation(filters = {}) {
  const { whereSql, params } = buildReportFilters(filters);

  const [headRows] = await db.query(
    `SELECT
       s.budget_head AS budgetHead,
       ${METRIC_SELECT_SQL}
     ${REPORT_FROM_SQL}
     ${whereSql}
     GROUP BY s.budget_head
     ORDER BY s.budget_head ASC`,
    params,
  );

  const [detailRows] = await db.query(
    `SELECT
       s.budget_head AS budgetHead,
       s.sub_head AS subHead,
       er.id AS expenditureId,
       ${DISPLAY_REF_SQL} AS requestRef,
       ${APPLICANT_NAME_SQL} AS applicantName,
       ${BENEFICIARY_LABEL_SQL} AS beneficiaryLabel,
       COALESCE(NULLIF(TRIM(er.beneficiary_type), ''), 'Unknown') AS beneficiaryType,
       COALESCE(NULLIF(TRIM(er.request_type), ''), '') AS requestType,
       ${REPORT_DATE_SQL} AS requestDate,
       CASE WHEN ${FINALIZED_SQL} THEN 'approved' ELSE 'in_progress' END AS status,
       ${METRIC_SELECT_SQL}
     ${REPORT_FROM_SQL}
     ${whereSql}
     GROUP BY
       s.budget_head,
       s.sub_head,
       er.id,
       requestRef,
       applicantName,
       beneficiaryLabel,
       beneficiaryType,
       requestType,
       requestDate,
       status
     ORDER BY s.budget_head ASC, s.sub_head ASC, er.id ASC`,
    params,
  );

  const detailsByHead = {};
  for (const row of detailRows || []) {
    const head = normalizeText(row.budgetHead) || 'Unspecified';
    if (!detailsByHead[head]) {
      detailsByHead[head] = [];
    }
    detailsByHead[head].push({
      expenditureId: toPositiveInt(row.expenditureId),
      requestRef: normalizeText(row.requestRef),
      applicantName: normalizeText(row.applicantName),
      beneficiaryLabel: normalizeText(row.beneficiaryLabel),
      beneficiaryType: normalizeText(row.beneficiaryType),
      subHead: normalizeText(row.subHead),
      requestType: normalizeText(row.requestType),
      requestDate: row.requestDate || null,
      status: normalizeText(row.status),
      ...mapMetrics(row),
    });
  }

  return {
    consolidatedRows: (headRows || []).map((row) => ({
      budgetHead: normalizeText(row.budgetHead) || 'Unspecified',
      ...mapMetrics(row),
    })),
    detailsByHead,
    availableBeneficiaryTypes: await listReportBeneficiaryTypes(filters),
  };
}

/**
 * "This request has at least one row in the spend ledger."
 *
 * Equivalent to what joining the ledger does for a DISTINCT over `er` columns — the join yields
 * a row exactly when one of these exists — but each EXISTS can stop at the first hit on the
 * `expenditure_id` index instead of materializing the whole three-table union, and it skips the
 * collation conversion that union needs for its text columns.
 */
const HAS_LEDGER_ROWS_SQL = `(
  EXISTS (SELECT 1 FROM expenditure_advance_rows led_ar WHERE led_ar.expenditure_id = er.id)
  OR EXISTS (SELECT 1 FROM expenditure_settlement_rows led_sr WHERE led_sr.expenditure_id = er.id)
  OR EXISTS (SELECT 1 FROM expenditure_line_rows led_lr WHERE led_lr.expenditure_id = er.id)
)`;

/**
 * Beneficiary types present in the filtered set, for the beneficiary dropdown.
 *
 * Deliberately ignores the caller's own beneficiary filters AND their search term, so neither
 * picking a type nor typing a search can empty the list those choices are made from.
 *
 * Because both are blanked, the resulting WHERE touches only `er`, which is what lets this
 * avoid the ledger join entirely and test for ledger rows with EXISTS instead.
 */
async function listReportBeneficiaryTypes(filters = {}) {
  const { whereSql, params } = buildReportFilters({
    ...filters,
    beneficiaryType: '',
    beneficiaryValue: '',
    q: '',
  });

  const [rows] = await db.query(
    `SELECT DISTINCT TRIM(er.beneficiary_type) AS beneficiaryType
     FROM expenditure_requests er
     ${whereSql}
       AND ${HAS_LEDGER_ROWS_SQL}
       AND er.beneficiary_type IS NOT NULL
       AND TRIM(er.beneficiary_type) <> ''
     ORDER BY beneficiaryType ASC`,
    params,
  );

  const dedup = new Map();
  for (const row of rows || []) {
    const normalized = normalizeBeneficiaryType(row?.beneficiaryType);
    const key = normalized.toLowerCase();
    if (!key || dedup.has(key)) continue;
    dedup.set(key, normalized);
  }

  return [...dedup.values()];
}

// ─── Tab 2: consolidation by beneficiary ──────────────────────────────────────

/** Faculty and Staff spend belongs to the department that owns them, as in the budget summary. */
const DEPARTMENT_BENEFICIARY_TYPES = new Set(['faculty', 'staff', 'department']);

const titleCase = (value) =>
  normalizeText(value)
    .toLowerCase()
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');

/**
 * Spend rolled up per beneficiary (department / centre / cell / club / …).
 *
 * SQL groups by the raw identity columns; the merge into one row per beneficiary happens
 * here, because two requests can name the same department with different spellings and only
 * the resolved key can tell that they are the same beneficiary — the same
 * `resolveBeneficiaryMeta` logic the budget summary applies on the client.
 */
export async function getExpenditureBeneficiarySummary(filters = {}) {
  const { whereSql, params } = buildReportFilters(filters);

  const [rows] = await db.query(
    `SELECT
       COALESCE(NULLIF(TRIM(er.beneficiary_type), ''), 'Unknown') AS beneficiaryType,
       er.department_id AS departmentId,
       er.beneficiary_entity_id AS beneficiaryEntityId,
       ${BENEFICIARY_LABEL_SQL} AS beneficiaryLabel,
       ${METRIC_SELECT_SQL}
     ${REPORT_FROM_SQL}
     ${whereSql}
     GROUP BY beneficiaryType, er.department_id, er.beneficiary_entity_id, beneficiaryLabel`,
    params,
  );

  const merged = new Map();

  for (const row of rows || []) {
    const rawType = normalizeBeneficiaryType(row.beneficiaryType);
    const typeToken = rawType.toLowerCase();
    const isDepartmentScoped = DEPARTMENT_BENEFICIARY_TYPES.has(typeToken);
    const typeLabel = isDepartmentScoped ? 'Department' : titleCase(rawType) || 'Unknown';
    const typeKey = typeLabel.toLowerCase();

    const beneficiaryId = isDepartmentScoped
      ? toPositiveInt(row.departmentId)
      : toPositiveInt(row.beneficiaryEntityId);
    const label = normalizeText(row.beneficiaryLabel) || `Unknown ${typeLabel}`;
    const key = beneficiaryId
      ? `${typeKey}::${beneficiaryId}`
      : `${typeKey}::${label.toLowerCase()}`;

    const metrics = mapMetrics(row);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        beneficiaryKey: key,
        beneficiaryLabel: label,
        beneficiaryTypeKey: typeKey,
        beneficiaryTypeLabel: typeLabel,
        ...metrics,
      });
      continue;
    }

    existing.advance += metrics.advance;
    existing.settlement += metrics.settlement;
    existing.expenditure += metrics.expenditure;
    existing.pending += metrics.pending;
    existing.requestCount += metrics.requestCount;
    existing.totalSpent = Math.round((existing.settlement + existing.expenditure) * 100) / 100;
    // Sum the already-clamped per-row values rather than recomputing from the summed totals.
    // `mapMetrics` clamps each group row at zero, so recomputing here let a row that settled
    // more than it advanced cancel another row's outstanding advance — making a beneficiary row
    // disagree with the GRAND TOTAL, which the client builds by summing the clamped values
    // (see sumMetrics in expenditurereport.tsx).
    existing.unsettledAdvance =
      Math.round((existing.unsettledAdvance + metrics.unsettledAdvance) * 100) / 100;
  }

  return [...merged.values()].sort(
    (a, b) =>
      a.beneficiaryTypeLabel.localeCompare(b.beneficiaryTypeLabel) ||
      a.beneficiaryLabel.localeCompare(b.beneficiaryLabel),
  );
}

// ─── Tab 3: month-wise breakdown ──────────────────────────────────────────────

const monthKey = (year, monthIndex) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

const monthLabel = (key) => {
  const [year, month] = String(key).split('-');
  const monthIndex = Number.parseInt(month, 10) - 1;
  return `${MONTH_LABELS[monthIndex] || month} ${String(year).slice(2)}`;
};

/**
 * The month columns the table should show, independent of which months happen to have
 * spend — an empty month is information ("nothing went out in July"), and a fixed column
 * set keeps the table stable while the user changes filters.
 *
 * A date window defines the columns when present; otherwise the fiscal year's April→March
 * span does. A window too wide to render falls back to only the months that carry data, and
 * says so via `truncated` so the client can flag the gap instead of implying full coverage.
 *
 * @returns {{months: string[], truncated: boolean}}
 */
export function resolveMonthColumns({ fiscalYear, dateFrom, dateTo, dataMonthKeys = [] }) {
  const monthsWithData = [...new Set(dataMonthKeys)].sort();
  const spanFrom = (startYear, startMonth, count) =>
    Array.from({ length: count }, (_, offset) => {
      const absolute = startYear * 12 + (startMonth - 1) + offset;
      return monthKey(Math.floor(absolute / 12), absolute % 12);
    });

  if (dateFrom && dateTo) {
    const [fromYear, fromMonth] = dateFrom.split('-').map(Number);
    const [toYear, toMonth] = dateTo.split('-').map(Number);
    const span = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;

    if (span > 0 && span <= MAX_MONTH_COLUMNS) {
      return { months: spanFrom(fromYear, fromMonth, span), truncated: false };
    }

    return { months: monthsWithData, truncated: true };
  }

  if (fiscalYear) {
    // April of the fiscal year through March of the next — the April start every
    // expenditure and finance fiscal-year expression already uses.
    const fiscalSpan = spanFrom(fiscalYear, 4, 12);

    // Fiscal-year membership is proposal-based, not date-based: a request counts
    // towards this year through the proposal its rows point at, or through a
    // carry-forward, so its own date can fall outside April→March. Those months
    // still need a column — dropping them would hide the money from every cell
    // AND from this tab's totals, leaving Month-wise disagreeing with the Budget
    // Head tab under identical filters.
    const outsideSpan = monthsWithData.filter((key) => !fiscalSpan.includes(key));
    if (!outsideSpan.length) {
      return { months: fiscalSpan, truncated: false };
    }

    const widened = [...fiscalSpan, ...outsideSpan].sort();
    if (widened.length <= MAX_MONTH_COLUMNS) {
      return { months: widened, truncated: false };
    }
    return { months: monthsWithData, truncated: true };
  }

  return { months: monthsWithData, truncated: false };
}

/**
 * Spend per budget head per calendar month.
 *
 * Every metric is returned for every cell so the client's metric selector (Total Spent /
 * Advance / Settlement / Direct Expenditure) switches instantly instead of refetching.
 */
export async function getExpenditureMonthlyBreakdown(filters = {}) {
  const { whereSql, params, dateFrom, dateTo, fiscalYear } = buildReportFilters(filters);

  const [rows] = await db.query(
    `SELECT
       DATE_FORMAT(${REPORT_DATE_SQL}, '%Y-%m') AS monthKey,
       s.budget_head AS budgetHead,
       ${METRIC_SELECT_SQL}
     ${REPORT_FROM_SQL}
     ${whereSql}
     GROUP BY monthKey, s.budget_head
     ORDER BY s.budget_head ASC, monthKey ASC`,
    params,
  );

  const byHead = new Map();
  const dataMonthKeys = [];

  for (const row of rows || []) {
    const head = normalizeText(row.budgetHead) || 'Unspecified';
    const key = normalizeText(row.monthKey);
    if (!key) continue;

    dataMonthKeys.push(key);

    if (!byHead.has(head)) {
      byHead.set(head, { budgetHead: head, byMonth: {} });
    }
    byHead.get(head).byMonth[key] = mapMetrics(row);
  }

  const { months, truncated } = resolveMonthColumns({
    fiscalYear,
    dateFrom,
    dateTo,
    dataMonthKeys,
  });

  return {
    months: months.map((key) => ({ key, label: monthLabel(key) })),
    rows: [...byHead.values()].sort((a, b) => a.budgetHead.localeCompare(b.budgetHead)),
    // True when the window was too wide for a readable table and only months carrying data
    // are shown — surfaced so the client flags the gap instead of implying full coverage.
    monthColumnsTruncated: truncated,
    maxMonthColumns: MAX_MONTH_COLUMNS,
  };
}
