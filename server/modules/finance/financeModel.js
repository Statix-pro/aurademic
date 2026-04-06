import db from '../../config/connection.js';
import * as orgUnitQueries from '../shared/budget/orgUnitQueries.js';

const safeParseJSON = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeText = (value) => String(value || '').trim();
const FINANCE_REQUEST_COLUMN_EXISTS_CACHE = new Map();
const FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE = new Map();

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
    [normalizedColumn]
  );

  const exists = Number(rows?.[0]?.count || 0) > 0;
  FINANCE_REQUEST_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const hasFinanceBudgetBreakupColumn = async (columnName, { tx = db } = {}) => {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;

  if (FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE.has(normalizedColumn)) {
    return FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true;
  }

  const [rows] = await tx.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finance_budget_breakup'
         AND COLUMN_NAME = ?`,
    [normalizedColumn]
  );

  const exists = Number(rows?.[0]?.count || 0) > 0;
  FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const normalizeBeneficiaryTypeForStorage = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType).toLowerCase();

  if (!normalized) return 'Institution';
  if (['faculty', 'individual faculty'].includes(normalized)) return 'Faculty';
  if (['staff', 'faculty_team', 'faculty team'].includes(normalized)) return 'Staff';
  if (['student_team', 'student team'].includes(normalized)) return 'Department';
  if (normalized === 'professional body' || normalized === 'professional bodies') return 'Professional Body';
  if (normalized === 'department') return 'Department';
  if (normalized === 'centre') return 'Centre';
  if (normalized === 'cell') return 'Cell';
  if (normalized === 'club') return 'Club';
  if (normalized === 'institution') return 'Institution';

  return 'Institution';
};

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBeneficiaryType = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType);

  if (normalized === 'Individual Faculty' || normalized === 'Faculty_Team') {
    return 'Faculty';
  }

  if (normalized === 'Student_Team') {
    return 'Department';
  }

  return normalized || 'Institution';
};

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES = Object.freeze([
  'centre',
  'cell',
  'club',
  'professional body',
  'professional bodies',
]);

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY = Object.freeze(['faculty', 'staff']);
const escapeSqlLiteral = (value) => `'${String(value || '').replace(/'/g, "''")}'`;

const resolveFinanceLevel1RouteType = (record = {}) => {
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

const normalizeEntityTypeCode = (typeCode) => {
  const normalized = normalizeText(typeCode).toUpperCase().replace(/[\s-]+/g, '_');

  if (['DEPT', 'DEPARTMENT'].includes(normalized)) return 'DEPARTMENT';
  if (['CENTRE', 'CENTER'].includes(normalized)) return 'CENTRE';
  if (normalized === 'CELL') return 'CELL';
  if (normalized === 'CLUB') return 'CLUB';
  if (['PROF_BODY', 'PROFESSIONAL_BODY', 'PROFESSIONAL_BODIES'].includes(normalized)) {
    return 'PROFESSIONAL_BODY';
  }

  return normalized || null;
};

const normalizeBudgetRows = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('At least one budget breakup row is required');
  }

  const normalizedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNo = index + 1;
    const budgetHead = normalizeText(row?.budget_head || row?.category);
    const subHead = normalizeText(row?.sub_head || row?.head);
    const parsedAmount = Number(row?.amount);
    const hasAvailableSnapshot =
      row?.available_amount_snapshot !== undefined && row?.available_amount_snapshot !== null;
    const parsedAvailableSnapshot = hasAvailableSnapshot
      ? Number(row.available_amount_snapshot)
      : null;
    const rowErrors = [];

    if (!budgetHead) {
      rowErrors.push(`Row ${rowNo}: budget head is required`);
    }

    if (!subHead) {
      rowErrors.push(`Row ${rowNo}: sub head is required`);
    }

    if (!Number.isFinite(parsedAmount)) {
      rowErrors.push(`Row ${rowNo}: amount must be a valid number`);
    } else if (parsedAmount <= 0) {
      rowErrors.push(`Row ${rowNo}: amount must be greater than 0`);
    }

    if (hasAvailableSnapshot && !Number.isFinite(parsedAvailableSnapshot)) {
      rowErrors.push(`Row ${rowNo}: available amount snapshot must be a valid number`);
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    normalizedRows.push({
      budget_head: budgetHead,
      sub_head: subHead,
      head_only_match: Boolean(row?.head_only_match),
      amount: toMoney(parsedAmount),
      budget_line_id: toPositiveInt(row?.budget_line_id),
      budget_proposal_id: toPositiveInt(row?.budget_proposal_id),
      available_amount_snapshot: hasAvailableSnapshot ? toMoney(parsedAvailableSnapshot) : null,
      sort_order: index,
    });
  });

  if (errors.length > 0) {
    throw new Error(`Invalid budget breakup rows: ${errors.join(' | ')}`);
  }

  if (normalizedRows.length === 0) {
    throw new Error('At least one valid budget breakup row is required');
  }

  return normalizedRows;
};

const normalizeIncomeRows = (rows = []) =>
  rows.map((row, index) => ({
    income_source: normalizeText(row?.incomeSource || row?.income_source),
    contribution: normalizeText(row?.contribution),
    amount: toMoney(row?.amount),
    status: normalizeText(row?.status),
    credit_account: normalizeText(row?.creditAccount || row?.credit_account),
    sort_order: index,
  }));

const normalizeWorkflowStatus = (state) =>
  normalizeText(state?.status).toLowerCase();

const normalizeToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeWords = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);

const isLooseTextMatch = (leftValue, rightValue) => {
  const leftToken = normalizeToken(leftValue);
  const rightToken = normalizeToken(rightValue);

  if (!leftToken || !rightToken) {
    return false;
  }

  if (leftToken === rightToken) {
    return true;
  }

  if (leftToken.includes(rightToken) || rightToken.includes(leftToken)) {
    return true;
  }

  const leftWords = new Set(normalizeWords(leftValue));
  const rightWords = new Set(normalizeWords(rightValue));

  if (!leftWords.size || !rightWords.size) {
    return false;
  }

  let commonCount = 0;
  for (const token of leftWords) {
    if (rightWords.has(token)) {
      commonCount += 1;
    }
  }

  const unionSize = new Set([...leftWords, ...rightWords]).size;
  const similarity = unionSize > 0 ? commonCount / unionSize : 0;

  return commonCount >= 1 && similarity >= 0.5;
};

// Fallback only: preferred behavior is to pass head_only_match from frontend
// using getHoacGroupForHead so future heads under these groups work automatically.
const HEAD_ONLY_AVAILABILITY_GROUP_HEADS = new Set([
  'events and competitions',
  'meetings and audits',
]);

const normalizeHeadLabelForMatch = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shouldUseHeadOnlyAvailabilityMatch = (budgetHead) => {
  const normalized = normalizeHeadLabelForMatch(budgetHead);
  if (!normalized) return false;
  return HEAD_ONLY_AVAILABILITY_GROUP_HEADS.has(normalized);
};

const WORKFLOW_STATUS_SQL_EXPR = `
  COALESCE(
    NULLIF(LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')))), ''),
    NULLIF(LOWER(TRIM(fr.workflow_status)), ''),
    'in_progress'
  )
`;

const WORKFLOW_STAGE_SQL_EXPR = `
  COALESCE(
    NULLIF(LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.currentStage')))), ''),
    NULLIF(LOWER(TRIM(fr.workflow_stage)), ''),
    ''
  )
`;

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL = LEVEL1_COORDINATOR_BENEFICIARY_TYPES
  .map(escapeSqlLiteral)
  .join(', ');
const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL = LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY
  .map(escapeSqlLiteral)
  .join(', ');

const LEVEL1_COORDINATOR_ROUTE_SQL_EXPR = `
  (
    LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL})
    OR (
      LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL})
      AND COALESCE(fr.beneficiary_entity_id, 0) > 0
    )
  )
`;

const buildFinanceSelectSql = ({ budgetTagSelectSql = 'NULL AS budget_tag' } = {}) => `
  SELECT
    fr.id,
    fr.employee_id,
    fr.created_by,
    COALESCE(
      TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))),
      fr.applicant_name
    ) AS applicant_name,
    COALESCE(e.designation, fr.designation) AS designation,
    COALESCE(dept.name, emp_dept.name, fr.department) AS department,
    COALESCE(e.email, fr.email) AS email,
    COALESCE(e.mobile, fr.mobile) AS mobile,
    e.erp_id,
    CASE WHEN fr.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
    DATE_FORMAT(fr.request_date, '%Y-%m-%d') AS request_date,
    fr.description,
    fr.beneficiary_type,
    CASE
      WHEN LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) = 'department'
        THEN COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(emp_dept.name), ''), fr.beneficiary_value)
      ELSE fr.beneficiary_value
    END AS beneficiary_value,
    ${budgetTagSelectSql},
    fr.department_id,
    fr.beneficiary_entity_id,
    fr.primary_head,
    fr.event_sub_head,
    fr.is_budget_proposed,
    fr.proposed_amount,
    fr.balance_amount,
    fr.total_budget,
    fr.approved_total_amount,
    fr.income_type,
    fr.income_status,
    fr.income_amount_type,
    fr.credit_status,
    fr.debit_status,
    fr.partial_amount,
    fr.enclosures,
    fr.director_status,
    fr.director_comment,
    fr.principal_status,
    fr.principal_comment,
    fr.principal_priority,
    fr.chairman_status,
    fr.chairman_comment,
    fr.overall_status,
    fr.workflow_state,
    ${WORKFLOW_STATUS_SQL_EXPR} AS workflow_status,
    ${WORKFLOW_STAGE_SQL_EXPR} AS workflow_stage,
    (
      SELECT wa.decision
        FROM workflow_actions wa
       WHERE wa.module_key = 'finance'
         AND wa.record_id = fr.id
         AND LOWER(TRIM(wa.stage)) = ?
       ORDER BY wa.decided_at DESC, wa.id DESC
       LIMIT 1
    ) AS workflow_stage_decision,
    frr.request_ref AS proposal_ref,
    fr.created_at,
    fr.updated_at
  FROM finance_requests fr
  LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
  LEFT JOIN master_employees e ON fr.employee_id = e.id
  LEFT JOIN master_departments dept ON fr.department_id = dept.id
  LEFT JOIN master_departments emp_dept ON e.department_id = emp_dept.id
`;

const getFinanceSelectSql = async ({ tx = db } = {}) => {
  const hasBudgetTag = await hasFinanceRequestColumn('budget_tag', { tx });
  return buildFinanceSelectSql({
    budgetTagSelectSql: hasBudgetTag ? 'fr.budget_tag' : 'NULL AS budget_tag',
  });
};

const mapWorkflowStatusToOverallStatus = (workflowState) => {
  const status = normalizeText(workflowState?.status).toLowerCase();

  if (status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'archived') return 'archived';
  if (status === 'deleted') return 'deleted';
  return 'pending';
};

const normalizeWorkflowState = (workflowState) => {
  const parsed = safeParseJSON(workflowState, workflowState);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return {
    ...parsed,
    flow: Array.isArray(parsed.flow) ? parsed.flow : [],
    currentStage: normalizeText(parsed.currentStage).toLowerCase() || null,
    status: normalizeText(parsed.status).toLowerCase() || null,
    isEditableByApplicant: Boolean(parsed.isEditableByApplicant),
  };
};

const collectChangedFields = (previousRecord, nextRecord, fieldMap = []) => {
  const changes = [];

  for (const field of fieldMap) {
    const isDateField = field.valueType === 'date';
    const normalizeDateOnly = (value) => {
      if (value === undefined || value === null || value === '') return '';
      if (value instanceof Date) {
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, '0');
        const dd = String(value.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const raw = normalizeText(value);
      if (!raw) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      const ymdPrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      return ymdPrefixMatch ? ymdPrefixMatch[1] : raw;
    };

    const previousValue = isDateField
      ? normalizeDateOnly(previousRecord?.[field.storageKey])
      : normalizeText(previousRecord?.[field.storageKey]);
    const nextValue = isDateField
      ? normalizeDateOnly(nextRecord?.[field.storageKey])
      : normalizeText(nextRecord?.[field.storageKey]);

    if (previousValue === nextValue) {
      continue;
    }

    changes.push({
      key: field.storageKey,
      label: field.label,
      before: previousValue || '-',
      after: nextValue || '-',
    });
  }

  return changes;
};

const buildFinanceUpdateAudit = ({
  previousRecord,
  updateData,
  budgetRowsInput = null,
  incomeRowsInput = null,
  budgetRowsChanged = false,
  incomeRowsChanged = false,
  actor = null,
}) => {
  const nextRecord = {
    request_date: updateData.request_date ?? previousRecord.request_date,
    description: updateData.description ?? previousRecord.description,
    beneficiary_type: updateData.beneficiary_type ?? previousRecord.beneficiary_type,
    beneficiary_value: updateData.beneficiary_value ?? previousRecord.beneficiary_value,
    budget_tag: updateData.budget_tag ?? previousRecord.budget_tag,
    primary_head: updateData.primary_head ?? previousRecord.primary_head,
    event_sub_head: updateData.event_sub_head ?? previousRecord.event_sub_head,
    proposed_amount: updateData.proposed_amount ?? previousRecord.proposed_amount,
    balance_amount: updateData.balance_amount ?? previousRecord.balance_amount,
    total_budget: updateData.total_budget ?? previousRecord.total_budget,
    income_type: updateData.income_type ?? previousRecord.income_type,
    income_status: updateData.income_status ?? previousRecord.income_status,
    income_amount_type: updateData.income_amount_type ?? previousRecord.income_amount_type,
    credit_status: updateData.credit_status ?? previousRecord.credit_status,
    debit_status: updateData.debit_status ?? previousRecord.debit_status,
    partial_amount: updateData.partial_amount ?? previousRecord.partial_amount,
  };

  const fieldChanges = collectChangedFields(previousRecord, nextRecord, [
    { storageKey: 'request_date', label: 'Request date', valueType: 'date' },
    { storageKey: 'description', label: 'Description' },
    { storageKey: 'beneficiary_type', label: 'Beneficiary type' },
    { storageKey: 'beneficiary_value', label: 'Beneficiary value' },
    { storageKey: 'budget_tag', label: 'Budget tag' },
    { storageKey: 'primary_head', label: 'Primary head' },
    { storageKey: 'event_sub_head', label: 'Event sub head' },
    { storageKey: 'proposed_amount', label: 'Proposed amount' },
    { storageKey: 'balance_amount', label: 'Balance amount' },
    { storageKey: 'total_budget', label: 'Total budget' },
    { storageKey: 'income_type', label: 'Income type' },
    { storageKey: 'income_status', label: 'Income status' },
    { storageKey: 'income_amount_type', label: 'Income amount type' },
    { storageKey: 'credit_status', label: 'Credit status' },
    { storageKey: 'debit_status', label: 'Debit status' },
    { storageKey: 'partial_amount', label: 'Partial amount' },
  ]);

  const rowChanges = [];
  if (budgetRowsInput) {
    rowChanges.push(`Budget breakup ${budgetRowsChanged ? 'updated' : 'reviewed'} (${budgetRowsInput.length} row(s))`);
  }
  if (incomeRowsInput) {
    rowChanges.push(`Income rows ${incomeRowsChanged ? 'updated' : 'reviewed'} (${incomeRowsInput.length} row(s))`);
  }

  const summaryParts = [];
  if (fieldChanges.length > 0) {
    summaryParts.push(`${fieldChanges.length} field(s) updated`);
  }
  summaryParts.push(...rowChanges);

  return {
    summary: summaryParts.join(' | ') || 'Finance request updated',
    details: {
      changedFields: fieldChanges,
      budgetRowsChanged: Boolean(budgetRowsChanged),
      incomeRowsChanged: Boolean(incomeRowsChanged),
      budgetRowsCount: budgetRowsInput ? budgetRowsInput.length : 0,
      incomeRowsCount: incomeRowsInput ? incomeRowsInput.length : 0,
      actorRole: normalizeText(actor?.role).toLowerCase() || null,
      actorEmail: normalizeText(actor?.email).toLowerCase() || null,
      actorIsAdmin: Boolean(actor?.isSuperAdmin || ['admin', 'super_admin', 'superadmin'].includes(normalizeText(actor?.role).toLowerCase())),
    },
  };
};

const resolveEntityTypeCodeFromBeneficiaryType = (beneficiaryType) => {
  const normalizedType = normalizeBeneficiaryType(beneficiaryType);

  const map = {
    Centre: 'CENTRE',
    Cell: 'CELL',
    Club: 'CLUB',
    'Professional Body': 'PROFESSIONAL_BODY',
    ProfessionalBodies: 'PROFESSIONAL_BODY',
    'Professional Bodies': 'PROFESSIONAL_BODY',
  };

  return map[normalizedType] || null;
};

const getBudgetLineAvailabilityById = async (conn, budgetLineId) => {
  const [rows] = await conn.query(
    `SELECT
       bpl.id AS budget_line_id,
       bpl.budget_proposal_id,
       bpl.budget_head,
       bpl.sub_head,
       COALESCE(bpl.approved_line_total, bpl.line_total, 0) AS budget_line_amount,
       COALESCE(fblu.consumed_amount, 0) AS consumed_amount,
       (COALESCE(bpl.approved_line_total, bpl.line_total, 0) - COALESCE(fblu.consumed_amount, 0)) AS available_amount
     FROM budget_proposal_lines bpl
     JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
     LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
     WHERE bpl.id = ?
       AND (
         LOWER(TRIM(bp.status)) IN ('completed', 'approved', 'principal_approved')
         OR LOWER(TRIM(bp.current_stage)) = 'completed'
       )
     LIMIT 1`,
    [budgetLineId]
  );

  if (!rows.length) {
    return null;
  }

  return {
    budgetLineId: toPositiveInt(rows[0].budget_line_id),
    budgetProposalId: toPositiveInt(rows[0].budget_proposal_id),
    budgetHead: normalizeText(rows[0].budget_head),
    subHead: normalizeText(rows[0].sub_head),
    budgetLineAmount: toMoney(rows[0].budget_line_amount),
    consumedAmount: toMoney(rows[0].consumed_amount),
    availableAmount: Math.max(0, toMoney(rows[0].available_amount)),
  };
};

const resolveBudgetAvailabilityForUser = async (conn, {
  userId,
  userEmail = null,
  budgetHead,
  subHead,
  preferredBudgetLineId = null,
  headOnlyMatch = false,
} = {}) => {
  const normalizedUserId = toPositiveInt(userId);
  const normalizedUserEmail = normalizeText(userEmail).toLowerCase();
  const normalizedBudgetHead = normalizeText(budgetHead);
  const normalizedSubHead = normalizeText(subHead);
  const normalizedPreferredBudgetLineId = toPositiveInt(preferredBudgetLineId);
  const applyHeadOnlyMatch = Boolean(headOnlyMatch) || shouldUseHeadOnlyAvailabilityMatch(normalizedBudgetHead);

  if (
    (!normalizedUserId && !normalizedUserEmail) ||
    !normalizedBudgetHead ||
    (!applyHeadOnlyMatch && !normalizedSubHead)
  ) {
    return {
      selected: null,
      totalAvailable: 0,
      matches: [],
    };
  }

  const [rows] = await conn.query(
    `SELECT
       bpl.id AS budget_line_id,
       bpl.budget_proposal_id,
       bpl.budget_head,
       bpl.sub_head,
       bp.proposal_ref,
       bp.fiscal_year,
       COALESCE(bpl.approved_line_total, bpl.line_total, 0) AS budget_line_amount,
       COALESCE(fblu.consumed_amount, 0) AS consumed_amount,
       (COALESCE(bpl.approved_line_total, bpl.line_total, 0) - COALESCE(fblu.consumed_amount, 0)) AS available_amount
     FROM budget_proposal_lines bpl
     JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
     LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
     WHERE (
         (? IS NOT NULL AND bp.user_id = ?)
         OR (? <> '' AND LOWER(TRIM(bp.user_email)) = ?)
         OR EXISTS (
           SELECT 1
           FROM master_employees me
           WHERE me.id = bp.employee_id
             AND me.status = 'Active'
             AND (
               (? IS NOT NULL AND me.user_id = ?)
               OR (? <> '' AND LOWER(TRIM(me.email)) = ?)
             )
         )
       )
       AND (
         LOWER(TRIM(bp.status)) IN ('completed', 'approved', 'principal_approved')
         OR LOWER(TRIM(bp.current_stage)) = 'completed'
       )
     ORDER BY
       (COALESCE(bpl.approved_line_total, bpl.line_total, 0) - COALESCE(fblu.consumed_amount, 0)) DESC,
       bp.updated_at DESC,
       bpl.id DESC`,
    [
      normalizedUserId,
      normalizedUserId,
      normalizedUserEmail,
      normalizedUserEmail,
      normalizedUserId,
      normalizedUserId,
      normalizedUserEmail,
      normalizedUserEmail,
    ]
  );

  const matches = rows
    .map((row) => ({
      budgetLineId: toPositiveInt(row.budget_line_id),
      budgetProposalId: toPositiveInt(row.budget_proposal_id),
      proposalRef: normalizeText(row.proposal_ref) || null,
      fiscalYear: row.fiscal_year ? Number(row.fiscal_year) : null,
      budgetHead: normalizeText(row.budget_head),
      subHead: normalizeText(row.sub_head),
      budgetLineAmount: toMoney(row.budget_line_amount),
      consumedAmount: toMoney(row.consumed_amount),
      availableAmount: Math.max(0, toMoney(row.available_amount)),
    }))
    .filter((row) => {
      if (!isLooseTextMatch(row.budgetHead, normalizedBudgetHead)) {
        return false;
      }

      if (applyHeadOnlyMatch) {
        return true;
      }

      return isLooseTextMatch(row.subHead, normalizedSubHead);
    });

  const totalAvailable = matches.reduce((sum, row) => sum + row.availableAmount, 0);

  let selected = null;
  if (normalizedPreferredBudgetLineId) {
    selected = matches.find((row) => row.budgetLineId === normalizedPreferredBudgetLineId) || null;
  }
  if (!selected) {
    selected = matches.find((row) => row.availableAmount > 0) || matches[0] || null;
  }

  return {
    selected,
    totalAvailable,
    matches,
  };
};

const enrichBudgetRowsWithBudgetRefs = async (conn, userId, userEmail, budgetRows = []) => {
  const enrichedRows = [];

  for (const row of budgetRows) {
    const availability = await resolveBudgetAvailabilityForUser(conn, {
      userId,
      userEmail,
      budgetHead: row.budget_head,
      subHead: row.sub_head,
      preferredBudgetLineId: row.budget_line_id,
      headOnlyMatch: Boolean(row.head_only_match),
    });

    const selected = availability.selected;
    if (!selected) {
      throw new Error(
        `No approved budget allocation found for "${row.budget_head}" / "${row.sub_head}" in your budget proposals`
      );
    }

    if (row.amount > selected.availableAmount) {
      throw new Error(
        `Requested amount ${row.amount.toFixed(2)} exceeds available amount ${selected.availableAmount.toFixed(2)} for "${row.budget_head}" / "${row.sub_head}"`
      );
    }

    enrichedRows.push({
      ...row,
      budget_line_id: selected.budgetLineId,
      budget_proposal_id: selected.budgetProposalId,
      available_amount_snapshot: selected.availableAmount,
    });
  }

  return enrichedRows;
};

const replaceBudgetRows = async (conn, financeId, budgetRows = []) => {
  await conn.query('DELETE FROM finance_budget_breakup WHERE finance_id = ?', [financeId]);

  if (!budgetRows.length) {
    return;
  }

  const hasBudgetProposalIdColumn = await hasFinanceBudgetBreakupColumn('budget_proposal_id', { tx: conn });

  for (const row of budgetRows) {
    const columns = [
      'finance_id',
      'budget_line_id',
      'budget_head',
      'sub_head',
      'amount',
      'available_amount_snapshot',
      'sort_order',
    ];
    const values = [
      financeId,
      row.budget_line_id || null,
      row.budget_head,
      row.sub_head,
      row.amount,
      row.available_amount_snapshot,
      row.sort_order,
    ];

    if (hasBudgetProposalIdColumn) {
      columns.splice(1, 0, 'budget_proposal_id');
      values.splice(1, 0, row.budget_proposal_id || null);
    }

    await conn.query(
      `INSERT INTO finance_budget_breakup
       (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
  }
};

const replaceIncomeRows = async (conn, financeId, incomeRows = []) => {
  await conn.query('DELETE FROM finance_income_rows WHERE finance_id = ?', [financeId]);

  if (!incomeRows.length) {
    return;
  }

  for (const row of incomeRows) {
    await conn.query(
      `INSERT INTO finance_income_rows
       (finance_id, income_source, contribution, amount, status, credit_account, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        financeId,
        row.income_source || null,
        row.contribution || null,
        row.amount,
        row.status || null,
        row.credit_account || null,
        row.sort_order,
      ]
    );
  }
};

const insertFinanceRequestReference = async (conn, financeId, requestDate) => {
  try {
    const dateObj = requestDate ? new Date(requestDate) : new Date();
    const refYear = Number.isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear();

    const [existing] = await conn.query(
      'SELECT request_ref FROM finance_request_refs WHERE finance_request_id = ? LIMIT 1',
      [financeId]
    );

    if (existing.length) {
      return existing[0].request_ref;
    }

    await conn.query(
      `CREATE TABLE IF NOT EXISTS finance_request_ref_tracker (
         ref_year INT NOT NULL,
         last_sequence INT NOT NULL DEFAULT 0,
         updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (ref_year)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await conn.query(
      `INSERT INTO finance_request_ref_tracker (ref_year, last_sequence)
       VALUES (?, 0)
       ON DUPLICATE KEY UPDATE ref_year = VALUES(ref_year)`,
      [refYear]
    );

    const [rows] = await conn.query(
      `SELECT last_sequence AS current_max
       FROM finance_request_ref_tracker
       WHERE ref_year = ?
       FOR UPDATE`,
      [refYear]
    );

    const sequence = Number(rows?.[0]?.current_max || 0) + 1;
    const requestRef = `#F-${refYear}-${String(sequence).padStart(4, '0')}`;

    await conn.query(
      `INSERT INTO finance_request_refs (finance_request_id, ref_year, ref_sequence, request_ref)
       VALUES (?, ?, ?, ?)`,
      [financeId, refYear, sequence, requestRef]
    );

    await conn.query(
      `UPDATE finance_request_ref_tracker
       SET last_sequence = ?
       WHERE ref_year = ?`,
      [sequence, refYear]
    );

    return requestRef;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw error;
  }
};

const resolveFinanceWorkflowContext = async (conn, financeData = {}) => {
  const beneficiaryType = normalizeBeneficiaryType(financeData.beneficiary_type);
  const entityTypeCode = resolveEntityTypeCodeFromBeneficiaryType(beneficiaryType);

  let departmentId = null;
  let beneficiaryEntityId = null;

  const employeeId = toPositiveInt(financeData.employee_id);

  if (employeeId) {
    const [employeeRows] = await conn.query(
      `SELECT department_id, entity_id
         FROM master_employees
         WHERE id = ?
           AND status = 'Active'
         LIMIT 1`,
      [employeeId]
    );

    if (employeeRows.length) {
      departmentId = toPositiveInt(employeeRows[0].department_id);
      beneficiaryEntityId = toPositiveInt(employeeRows[0].entity_id);
    }
  }

  if (!departmentId && beneficiaryType === 'Department' && normalizeText(financeData.beneficiary_value)) {
    const [departmentRows] = await conn.query(
      `SELECT id
         FROM master_departments
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         LIMIT 1`,
      [financeData.beneficiary_value]
    );

    if (departmentRows.length) {
      departmentId = toPositiveInt(departmentRows[0].id);
    }
  }

  if (!beneficiaryEntityId && entityTypeCode && normalizeText(financeData.beneficiary_value)) {
    const [entityRows] = await conn.query(
      `SELECT me.id
         FROM master_entities me
         JOIN master_entity_types met ON met.id = me.entity_type_id
         WHERE me.is_active = 1
           AND UPPER(TRIM(met.code)) = ?
           AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
         LIMIT 1`,
      [entityTypeCode, financeData.beneficiary_value]
    );

    if (entityRows.length) {
      beneficiaryEntityId = toPositiveInt(entityRows[0].id);
    }
  }

  return {
    beneficiaryType,
    entityTypeCode,
    departmentId,
    beneficiaryEntityId,
  };
};

const consumeBudgetForApprovedFinance = async (conn, financeId, actorUserId = null) => {
  const [alreadyConsumedRows] = await conn.query(
    `SELECT COUNT(*) AS count
     FROM finance_budget_usage_ledger
     WHERE finance_id = ?
       AND operation = 'consume'`,
    [financeId]
  );

  if (Number(alreadyConsumedRows?.[0]?.count || 0) > 0) {
    return;
  }

  const [rows] = await conn.query(
    `SELECT
       fbb.id,
       fbb.budget_line_id,
       fbb.budget_head,
       fbb.sub_head,
       fbb.amount
     FROM finance_budget_breakup fbb
     WHERE fbb.finance_id = ?
     ORDER BY fbb.sort_order ASC, fbb.id ASC
     FOR UPDATE`,
    [financeId]
  );

  let approvedTotalAmount = 0;
  let totalRemainingAmount = 0;

  for (const row of rows) {
    const budgetLineId = toPositiveInt(row.budget_line_id);
    const requestedAmount = toMoney(row.amount);

    if (!budgetLineId) {
      throw new Error(
        `Budget line mapping is missing for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`
      );
    }

    if (requestedAmount <= 0) {
      throw new Error(
        `Requested amount must be greater than 0 for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`
      );
    }

    const budgetLine = await getBudgetLineAvailabilityById(conn, budgetLineId);
    if (!budgetLine) {
      throw new Error(
        `Budget line not found/approved for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`
      );
    }

    await conn.query(
      `INSERT IGNORE INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)`,
      [budgetLineId]
    );

    const [usageRows] = await conn.query(
      `SELECT consumed_amount
       FROM finance_budget_line_usage
       WHERE budget_line_id = ?
       FOR UPDATE`,
      [budgetLineId]
    );

    const consumedAmount = toMoney(usageRows?.[0]?.consumed_amount);
    const availableAmount = Math.max(0, budgetLine.budgetLineAmount - consumedAmount);

    if (requestedAmount > availableAmount) {
      throw new Error(
        `Insufficient budget balance for "${budgetLine.budgetHead}" / "${budgetLine.subHead}". Requested ${requestedAmount.toFixed(2)}, available ${availableAmount.toFixed(2)}`
      );
    }

    const balanceAfter = consumedAmount + requestedAmount;
    const remainingAfter = Math.max(0, budgetLine.budgetLineAmount - balanceAfter);

    await conn.query(
      `UPDATE finance_budget_line_usage
       SET consumed_amount = ?, updated_at = CURRENT_TIMESTAMP
       WHERE budget_line_id = ?`,
      [balanceAfter, budgetLineId]
    );

    await conn.query(
      `UPDATE finance_budget_breakup
       SET approved_amount = ?,
           remaining_amount_snapshot = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requestedAmount, remainingAfter, row.id]
    );

    await conn.query(
      `INSERT INTO finance_budget_usage_ledger
       (finance_id, finance_budget_breakup_id, budget_line_id, operation, amount, balance_after, actor_user_id, remarks)
       VALUES (?, ?, ?, 'consume', ?, ?, ?, ?)`,
      [
        financeId,
        row.id,
        budgetLineId,
        requestedAmount,
        balanceAfter,
        toPositiveInt(actorUserId),
        'Principal approval committed amount',
      ]
    );

    approvedTotalAmount += requestedAmount;
    totalRemainingAmount += remainingAfter;
  }

  await conn.query(
    `UPDATE finance_requests
     SET approved_total_amount = ?,
         balance_amount = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [approvedTotalAmount, totalRemainingAmount, financeId]
  );
};

const financeModel = {
  async createFinanceRequest(financeData, userId, userEmail = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });

      const workflowContext = await resolveFinanceWorkflowContext(connection, financeData);
      const normalizedBudgetRows = normalizeBudgetRows(Array.isArray(financeData.budget_rows) ? financeData.budget_rows : []);
      const budgetRows = await enrichBudgetRowsWithBudgetRefs(connection, userId, userEmail, normalizedBudgetRows);
      const incomeRows = normalizeIncomeRows(Array.isArray(financeData.income_rows) ? financeData.income_rows : []);
      const totalBudget = budgetRows.length
        ? budgetRows.reduce((sum, row) => sum + row.amount, 0)
        : toMoney(financeData.total_budget);

      const financeEntry = {
        employee_id: financeData.employee_id || null,
        applicant_name: financeData.employee_id ? null : financeData.applicant_name || null,
        designation: financeData.employee_id ? null : financeData.designation || null,
        department: financeData.employee_id ? null : financeData.department || null,
        email: financeData.employee_id ? null : financeData.email || null,
        mobile: financeData.employee_id ? null : financeData.mobile || null,

        request_date: financeData.request_date,
        description: financeData.description || null,

        beneficiary_type: normalizeBeneficiaryTypeForStorage(financeData.beneficiary_type),
        beneficiary_value: financeData.beneficiary_value || null,
        department_id: workflowContext.departmentId,
        beneficiary_entity_id: workflowContext.beneficiaryEntityId,

        primary_head: financeData.primary_head,
        event_sub_head: financeData.event_sub_head || null,

        is_budget_proposed: financeData.is_budget_proposed || 'No',
        proposed_amount: financeData.proposed_amount || null,
        balance_amount: financeData.balance_amount || null,

        income_type: financeData.income_type || null,
        income_status: financeData.income_status || null,
        income_amount_type: financeData.income_amount_type || null,
        credit_status: financeData.credit_status || null,
        debit_status: financeData.debit_status || null,
        partial_amount: financeData.partial_amount || null,

        enclosures: financeData.enclosures ? JSON.stringify(financeData.enclosures) : null,

        total_budget: totalBudget,
        created_by: userId,
      };
      if (hasBudgetTagColumn) {
        financeEntry.budget_tag = normalizeText(financeData.budget_tag) || null;
      }

      const [result] = await connection.query('INSERT INTO finance_requests SET ?', [financeEntry]);
      await insertFinanceRequestReference(connection, result.insertId, financeData.request_date);
      await replaceBudgetRows(connection, result.insertId, budgetRows);
      await replaceIncomeRows(connection, result.insertId, incomeRows);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async updateFinanceRequest(id, financeData, actor = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });
      const budgetTagSelectSql = hasBudgetTagColumn ? 'fr.budget_tag' : 'NULL AS budget_tag';

      const [existingRows] = await connection.query(
        `SELECT
           fr.id,
           fr.created_by,
           fr.employee_id,
           fr.request_date,
           fr.description,
           fr.beneficiary_type,
           fr.beneficiary_value,
           ${budgetTagSelectSql},
           fr.primary_head,
           fr.event_sub_head,
           fr.proposed_amount,
           fr.balance_amount,
           fr.total_budget,
           fr.income_type,
           fr.income_status,
           fr.income_amount_type,
           fr.credit_status,
           fr.debit_status,
           fr.partial_amount,
           u.email AS created_by_email
         FROM finance_requests fr
         LEFT JOIN users u ON u.id = fr.created_by
         WHERE fr.id = ?
         LIMIT 1`,
        [id]
      );

      if (!existingRows.length) {
        await connection.rollback();
        return { affectedRows: 0 };
      }

      const existingRecord = existingRows[0];
      const hasBudgetRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'budget_rows');
      const hasIncomeRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'income_rows');
      const normalizedBudgetRows = hasBudgetRowsInput
        ? normalizeBudgetRows(Array.isArray(financeData.budget_rows) ? financeData.budget_rows : [])
        : [];
      const budgetRows = hasBudgetRowsInput
        ? await enrichBudgetRowsWithBudgetRefs(
          connection,
          toPositiveInt(existingRecord.created_by),
          normalizeText(existingRecord.created_by_email) || null,
          normalizedBudgetRows
        )
        : [];
      const incomeRows = hasIncomeRowsInput
        ? normalizeIncomeRows(Array.isArray(financeData.income_rows) ? financeData.income_rows : [])
        : [];
      const [previousBudgetRows] = hasBudgetRowsInput
        ? await connection.query(
          `SELECT budget_head, sub_head, amount
               FROM finance_budget_breakup
               WHERE finance_id = ?
               ORDER BY sort_order ASC, id ASC`,
          [id]
        )
        : [[]];
      const [previousIncomeRows] = hasIncomeRowsInput
        ? await connection.query(
          `SELECT income_source, contribution, amount, status, credit_account
               FROM finance_income_rows
               WHERE finance_id = ?
               ORDER BY sort_order ASC, id ASC`,
          [id]
        )
        : [[]];
      const updateData = Object.fromEntries(
        Object.entries(financeData)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, value === '' ? null : value])
      );
      delete updateData.budget_rows;
      delete updateData.income_rows;
      if (updateData.enclosures) {
        updateData.enclosures = JSON.stringify(updateData.enclosures);
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'debit_status')) {
        const normalizedDebitStatus = normalizeText(updateData.debit_status).toLowerCase();
        updateData.debit_status = ['credited', 'reimbursement'].includes(normalizedDebitStatus)
          ? normalizedDebitStatus
          : null;
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'budget_tag')) {
        if (hasBudgetTagColumn) {
          updateData.budget_tag = normalizeText(updateData.budget_tag) || null;
        } else {
          delete updateData.budget_tag;
        }
      }

      const mergedRecordForContext = {
        employee_id: updateData.employee_id ?? existingRecord.employee_id,
        beneficiary_type: updateData.beneficiary_type ?? existingRecord.beneficiary_type,
        beneficiary_value: updateData.beneficiary_value ?? existingRecord.beneficiary_value,
      };

      if (Object.prototype.hasOwnProperty.call(updateData, 'beneficiary_type')) {
        updateData.beneficiary_type = normalizeBeneficiaryTypeForStorage(updateData.beneficiary_type);
      }

      const workflowContext = await resolveFinanceWorkflowContext(connection, mergedRecordForContext);
      updateData.department_id = workflowContext.departmentId;
      updateData.beneficiary_entity_id = workflowContext.beneficiaryEntityId;

      if (hasBudgetRowsInput) {
        await replaceBudgetRows(connection, id, budgetRows);
        updateData.total_budget = budgetRows.reduce((sum, row) => sum + row.amount, 0);
      }

      if (hasIncomeRowsInput) {
        await replaceIncomeRows(connection, id, incomeRows);
      }

      const [result] = await connection.query('UPDATE finance_requests SET ? WHERE id = ?', [updateData, id]);

      try {
        const previousBudgetSnapshot = previousBudgetRows.map((row) => ({
          budget_head: normalizeText(row.budget_head),
          sub_head: normalizeText(row.sub_head),
          amount: toMoney(row.amount),
        }));
        const nextBudgetSnapshot = budgetRows.map((row) => ({
          budget_head: normalizeText(row.budget_head),
          sub_head: normalizeText(row.sub_head),
          amount: toMoney(row.amount),
        }));
        const previousIncomeSnapshot = previousIncomeRows.map((row) => ({
          income_source: normalizeText(row.income_source),
          contribution: normalizeText(row.contribution),
          amount: toMoney(row.amount),
          status: normalizeText(row.status),
          credit_account: normalizeText(row.credit_account),
        }));
        const nextIncomeSnapshot = incomeRows.map((row) => ({
          income_source: normalizeText(row.income_source),
          contribution: normalizeText(row.contribution),
          amount: toMoney(row.amount),
          status: normalizeText(row.status),
          credit_account: normalizeText(row.credit_account),
        }));

        const audit = buildFinanceUpdateAudit({
          previousRecord: existingRecord,
          updateData,
          budgetRowsInput: hasBudgetRowsInput ? budgetRows : null,
          incomeRowsInput: hasIncomeRowsInput ? incomeRows : null,
          budgetRowsChanged: hasBudgetRowsInput && JSON.stringify(previousBudgetSnapshot) !== JSON.stringify(nextBudgetSnapshot),
          incomeRowsChanged: hasIncomeRowsInput && JSON.stringify(previousIncomeSnapshot) !== JSON.stringify(nextIncomeSnapshot),
          actor,
        });

        await connection.query(
          `INSERT INTO finance_request_edits
             (finance_request_id, edited_by_user_id, edited_by_email, edited_by_role, is_admin, summary, details)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            toPositiveInt(actor?.id) || null,
            normalizeText(actor?.email) || null,
            normalizeText(actor?.role).toLowerCase() || null,
            Boolean(actor?.isSuperAdmin || ['admin', 'super_admin', 'superadmin'].includes(normalizeText(actor?.role).toLowerCase())) ? 1 : 0,
            audit.summary,
            JSON.stringify(audit.details),
          ]
        );
      } catch (auditError) {
        if (auditError?.code !== 'ER_NO_SUCH_TABLE') {
          throw auditError;
        }
      }

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error updating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getFinanceRequestById(id) {
    try {
      const financeSelectSql = await getFinanceSelectSql();
      const [rows] = await db.query(
        `${financeSelectSql}
         WHERE fr.id = ?
           AND LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'
         LIMIT 1`,
        ['', id]
      );

      if (!rows.length) return null;

      const finance = rows[0];
      finance.enclosures = safeParseJSON(finance.enclosures, []);
      finance.workflow_state = normalizeWorkflowState(finance.workflow_state);
      finance.level1_route_type = resolveFinanceLevel1RouteType(finance);

      return finance;
    } catch (error) {
      throw new Error(`Error fetching finance request: ${error.message}`);
    }
  },

  async listFinanceRequests({ userId, mine, status }) {
    try {
      const financeSelectSql = await getFinanceSelectSql();
      let query = `${financeSelectSql} WHERE 1 = 1`;
      const params = [''];

      query += ` AND LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'`;

      if (mine) {
        query += ' AND fr.created_by = ?';
        params.push(userId);
      }

      if (status) {
        query += ' AND fr.overall_status = ?';
        params.push(status);
      }

      query += ' ORDER BY fr.created_at DESC';

      const [rows] = await db.query(query, params);

      return rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
        level1_route_type: resolveFinanceLevel1RouteType(row),
      }));
    } catch (error) {
      throw new Error(`Error listing finance requests: ${error.message}`);
    }
  },

  async addBudgetBreakup(financeId, budgetRows) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [ownerRows] = await connection.query(
        `SELECT fr.created_by, u.email AS created_by_email
         FROM finance_requests fr
         LEFT JOIN users u ON u.id = fr.created_by
         WHERE fr.id = ?
         LIMIT 1`,
        [financeId]
      );

      if (!ownerRows.length) {
        throw new Error('Finance request not found');
      }

      let total = 0;
      const normalizedRows = normalizeBudgetRows(Array.isArray(budgetRows) ? budgetRows : []);
      const enrichedRows = await enrichBudgetRowsWithBudgetRefs(
        connection,
        toPositiveInt(ownerRows[0].created_by),
        normalizeText(ownerRows[0].created_by_email) || null,
        normalizedRows
      );
      await replaceBudgetRows(connection, financeId, enrichedRows);

      for (const row of enrichedRows) {
        total += row.amount;
      }

      await connection.query('UPDATE finance_requests SET total_budget = ? WHERE id = ?', [total, financeId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error adding budget breakup: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getBudgetBreakup(financeId) {
    try {
      const hasBudgetProposalIdColumn = await hasFinanceBudgetBreakupColumn('budget_proposal_id');
      const budgetProposalSelectSql = hasBudgetProposalIdColumn
        ? 'budget_proposal_id'
        : 'NULL AS budget_proposal_id';

      const [rows] = await db.query(
        `SELECT
           id,
           finance_id,
           ${budgetProposalSelectSql},
           budget_line_id,
           budget_head,
           sub_head,
           amount,
           approved_amount,
           available_amount_snapshot,
           remaining_amount_snapshot,
           sort_order,
           created_at
         FROM finance_budget_breakup
         WHERE finance_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [financeId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error fetching budget breakup: ${error.message}`);
    }
  },

  async getIncomeRows(financeId) {
    try {
      const [rows] = await db.query(
        `SELECT
           id,
           finance_id,
           income_source,
           contribution,
           amount,
           status,
           credit_account,
           sort_order,
           created_at
         FROM finance_income_rows
         WHERE finance_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [financeId]
      );
      return rows;
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw new Error(`Error fetching income rows: ${error.message}`);
    }
  },

  async getStatusUpdates(financeId) {
  try {
    const [workflowRows] = await db.query(
      `SELECT
          wa.id,
          wa.record_id AS finance_id,
          wa.actor_user_id AS user_id,
          wa.stage AS role,
          wa.stage,
          wa.decision AS status,
          wa.decision,
          wa.feedback AS comment,
          wa.feedback,
          wa.decided_at AS created_at,
          wa.decided_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))),
              ''
            ),
            u.name
          ) AS user_name,
          wa.actor_email,
          wa.actor_role,
          wa.snapshot_before,
          wa.meta
       FROM workflow_actions wa
       LEFT JOIN users u ON u.id = wa.actor_user_id
       LEFT JOIN master_employees emp
         ON emp.email COLLATE utf8mb4_unicode_ci =
            wa.actor_email COLLATE utf8mb4_unicode_ci
       WHERE wa.module_key = 'finance'
         AND wa.record_id = ?
       ORDER BY wa.decided_at ASC, wa.id ASC`,
      [financeId]
    );

    let editRows = [];
    try {
      const [rows] = await db.query(
        `SELECT
            e.id,
            e.finance_request_id AS finance_id,
            e.edited_by_user_id AS user_id,
            e.edited_by_role AS role,
            'updated' AS status,
            'updated' AS decision,
            e.summary AS comment,
            e.summary,
            e.details,
            e.created_at,
            COALESCE(
              NULLIF(
                TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))),
                ''
              ),
              u.name
            ) AS user_name,
            e.edited_by_email AS actor_email,
            e.edited_by_role AS actor_role,
            e.is_admin,
            NULL AS snapshot_before,
            NULL AS meta
         FROM finance_request_edits e
         LEFT JOIN users u ON u.id = e.edited_by_user_id
         LEFT JOIN master_employees emp
           ON emp.email COLLATE utf8mb4_unicode_ci =
              e.edited_by_email COLLATE utf8mb4_unicode_ci
         WHERE e.finance_request_id = ?
         ORDER BY e.created_at ASC, e.id ASC`,
        [financeId]
      );
      editRows = rows;
    } catch (error) {
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }

    const merged = [...workflowRows, ...editRows].sort((left, right) => {
      const leftTime = new Date(left.decided_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.decided_at || right.created_at || 0).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return (Number(left.id) || 0) - (Number(right.id) || 0);
    });

    return merged.map((row) => ({
      ...row,
      snapshot_before: safeParseJSON(row.snapshot_before, null),
      meta: safeParseJSON(row.meta, null),
      details: safeParseJSON(row.details, null),
    }));
  } catch (error) {
    throw new Error(`Error fetching status updates: ${error.message}`);
  }
},

  async doesFinanceExist(id) {
    const [rows] = await db.query(
      `SELECT 1
         FROM finance_requests fr
        WHERE fr.id = ?
          AND LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'
        LIMIT 1`,
      [id]
    );
    return rows.length > 0;
  },

  async hardDeleteFinanceRequest(id) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM finance_requests WHERE id = ?', [id]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error deleting finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async deleteFinanceRequest(id, actor = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT workflow_state
           FROM finance_requests
          WHERE id = ?
          FOR UPDATE`,
        [id]
      );

      if (!rows.length) {
        await connection.rollback();
        return false;
      }

      const previousState = normalizeWorkflowState(rows[0].workflow_state) || {
        flow: ['level1', 'dof', 'principal'],
        status: 'in_progress',
        currentStage: 'level1',
        isEditableByApplicant: false,
      };

      if (normalizeText(previousState.status).toLowerCase() === 'deleted') {
        await connection.rollback();
        return false;
      }

      const nowIso = new Date().toISOString();
      const actorUserId = toPositiveInt(actor?.id || actor?.userId) || null;
      const actorEmail = normalizeText(actor?.email).toLowerCase() || null;
      const actorRole = normalizeText(actor?.role).toLowerCase() || null;
      const fallbackStage = normalizeText(previousState.currentStage).toLowerCase() || 'level1';

      const nextState = {
        ...previousState,
        flow: Array.isArray(previousState.flow) && previousState.flow.length
          ? previousState.flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
          : ['level1', 'dof', 'principal'],
        status: 'deleted',
        currentStage: 'deleted',
        isEditableByApplicant: false,
        resolvedAt: nowIso,
        lastDecision: 'deleted',
        lastFeedback: 'Deleted by user',
        deletedAt: nowIso,
        deletedByUserId: actorUserId,
        deletedByEmail: actorEmail,
        updatedAt: nowIso,
      };

      await connection.query(
        `UPDATE finance_requests
            SET workflow_state = ?,
                overall_status = 'deleted',
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [JSON.stringify(nextState), id]
      );

      await connection.query(
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
          'finance',
          id,
          fallbackStage,
          'archived',
          'Deleted by user',
          actorUserId,
          actorEmail,
          actorRole,
          JSON.stringify(previousState),
          JSON.stringify({
            origin: 'api',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              trigger: 'soft_delete',
              route: 'DELETE /api/finance-requests/:id',
            },
          }),
        ]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error deleting finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getEmployeeByEmail(email) {
    try {
      const [rows] = await db.query(
        `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.orcid_id,
          e.scopus_id
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.email = ?
          AND e.status = 'Active'
        LIMIT 1`,
        [email]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw new Error(`Error fetching employee: ${error.message}`);
    }
  },

  async getBudgetTags() {
    try {
      const [rows] = await db.query(
        `SELECT id, tag_name, is_active, sort_order
         FROM budget_tags
         WHERE is_active = 1
         ORDER BY sort_order ASC, tag_name ASC`
      );
      return rows;
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return [];
      }
      throw new Error(`Error fetching finance tags: ${error.message}`);
    }
  },

  async getOrgUnitsByType(typeCode) {
    return orgUnitQueries.getOrgUnitsByType(normalizeEntityTypeCode(typeCode));
  },

  async getAllOrgUnits() {
    return orgUnitQueries.getAllOrgUnits();
  },

  async getBudgetAvailabilityForUser({
    userId,
    userEmail = null,
    budgetHead,
    subHead,
    preferredBudgetLineId = null,
    headOnlyMatch = false,
  }) {
    const conn = await db.getConnection();
    try {
      const availability = await resolveBudgetAvailabilityForUser(conn, {
        userId,
        userEmail,
        budgetHead,
        subHead,
        preferredBudgetLineId,
        headOnlyMatch,
      });
      return availability;
    } finally {
      conn.release();
    }
  },

  async searchApplicant(query) {
    try {
      const queryStr = normalizeText(query);
      let sql = '';
      let params = [];

      if (!queryStr) {
        sql = `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;
      } else {
        sql = `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
          AND (
            e.first_name LIKE ?
            OR e.last_name LIKE ?
            OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
            OR e.erp_id LIKE ?
            OR e.email LIKE ?
            OR d.name LIKE ?
          )
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;

        params = [
          `%${queryStr}%`,
          `%${queryStr}%`,
          `%${queryStr}%`,
          `${queryStr}%`,
          `%${queryStr}%`,
          `%${queryStr}%`,
        ];
      }

      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      throw new Error(`Error searching applicant: ${error.message}`);
    }
  },

  async getFinanceRecordContext(recordId, { tx = db, forUpdate = false } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return null;
    }

    const lockClause = forUpdate ? ' FOR UPDATE' : '';

    const [rows] = await tx.query(
      `SELECT
         fr.id,
         fr.created_by,
         fr.beneficiary_type,
         fr.beneficiary_entity_id,
         fr.department_id,
         fr.total_budget
       FROM finance_requests fr
       WHERE fr.id = ?${lockClause}`,
      [normalizedRecordId]
    );

    if (!rows.length) {
      return null;
    }

    const row = rows[0];

    return {
      beneficiaryType: normalizeBeneficiaryType(row.beneficiary_type),
      beneficiaryEntityId: toPositiveInt(row.beneficiary_entity_id),
      departmentId: toPositiveInt(row.department_id),
      totalBudget: toMoney(row.total_budget),
      applicantUserId: toPositiveInt(row.created_by),
    };
  },

  async updateFinanceWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return false;
    }

    const [previousRows] = await tx.query(
      `SELECT workflow_state
       FROM finance_requests
       WHERE id = ?
       FOR UPDATE`,
      [normalizedRecordId]
    );

    if (!previousRows.length) {
      return false;
    }

    const previousState = normalizeWorkflowState(previousRows[0].workflow_state);
    const previousStatus = normalizeWorkflowStatus(previousState);
    const nextStatus = normalizeWorkflowStatus(newState);

    const workflowStatePayload = JSON.stringify(newState || null);
    const overallStatus = mapWorkflowStatusToOverallStatus(newState);

    const [result] = await tx.query(
      `UPDATE finance_requests
          SET workflow_state = ?,
              overall_status = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [workflowStatePayload, overallStatus, normalizedRecordId]
    );

    if (result.affectedRows > 0 && previousStatus !== 'completed' && nextStatus === 'completed') {
      const [actorRows] = await tx.query(
        `SELECT actor_user_id
         FROM workflow_actions
         WHERE module_key = 'finance'
           AND record_id = ?
         ORDER BY decided_at DESC, id DESC
         LIMIT 1`,
        [normalizedRecordId]
      );
      const actorUserId = toPositiveInt(actorRows?.[0]?.actor_user_id);
      await consumeBudgetForApprovedFinance(tx, normalizedRecordId, actorUserId);
    }

    return result.affectedRows > 0;
  },

  async forceWorkflowTransition(recordId, {
    decision,
    feedback = null,
    actor = {},
    stageHint = null,
  } = {}, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    const normalizedDecision = normalizeText(decision).toLowerCase();

    if (!normalizedRecordId) {
      throw new Error('Invalid finance request ID');
    }

    if (!['returned', 'archived'].includes(normalizedDecision)) {
      throw new Error(`Unsupported forced workflow transition: ${normalizedDecision}`);
    }

    const [rows] = await tx.query(
      `SELECT workflow_state
       FROM finance_requests
       WHERE id = ?
       FOR UPDATE`,
      [normalizedRecordId]
    );

    if (!rows.length) {
      throw new Error('Finance request not found');
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
        'finance',
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
              ? 'PATCH /api/finance-requests/:id/archive-toggle'
              : 'PATCH /api/finance-requests/:id/approval',
          },
        }),
      ]
    );

    const updated = await this.updateFinanceWorkflowSnapshot(normalizedRecordId, nextState, { tx });
    if (!updated) {
      throw new Error('Failed to update workflow snapshot');
    }

    return {
      previousState,
      currentState: nextState,
      decision: normalizedDecision,
      stage: fallbackStage,
    };
  },

  async restoreWorkflowSnapshotFromLatestArchive(recordId, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return { restored: false, reason: 'Invalid finance request ID' };
    }

    const [rows] = await tx.query(
      `SELECT snapshot_before
       FROM workflow_actions
       WHERE module_key = 'finance'
         AND record_id = ?
         AND decision = 'archived'
       ORDER BY decided_at DESC, id DESC
       LIMIT 1`,
      [normalizedRecordId]
    );

    if (!rows.length) {
      return { restored: false, reason: 'No archived snapshot found' };
    }

    const previousState = safeParseJSON(rows[0].snapshot_before, null);
    if (!previousState) {
      return { restored: false, reason: 'Archived snapshot is not restorable' };
    }

    const updated = await this.updateFinanceWorkflowSnapshot(
      normalizedRecordId,
      previousState,
      { tx }
    );

    return {
      restored: Boolean(updated),
      restoredState: previousState,
      reason: updated ? null : 'Failed to update workflow snapshot',
    };
  },

  async getLatestArchiveAction(recordId, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return null;
    }

    const [rows] = await tx.query(
      `SELECT id, stage, actor_user_id, actor_email, decided_at
       FROM workflow_actions
       WHERE module_key = 'finance'
         AND record_id = ?
         AND decision = 'archived'
       ORDER BY decided_at DESC, id DESC
       LIMIT 1`,
      [normalizedRecordId]
    );

    if (!rows.length) {
      return null;
    }

    return {
      id: toPositiveInt(rows[0].id),
      stage: normalizeText(rows[0].stage).toLowerCase() || null,
      actorUserId: toPositiveInt(rows[0].actor_user_id),
      actorEmail: normalizeText(rows[0].actor_email).toLowerCase() || null,
      decidedAt: rows[0].decided_at || null,
    };
  },

  async listFinanceQueueRecords(stage, filters = {}, { tx = db } = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';
    const isSuperAdmin = Boolean(filters.isSuperAdmin);
    const level1Role = normalizeText(filters.level1Role).toLowerCase();

    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const whereParts = [];
    const whereParams = [];

    whereParts.push(`LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'`);

    if (workflowStatus === 'all') {
      if (isSuperAdmin) {
        whereParts.push('1 = 1');
      } else {
        whereParts.push(
          `( 
            (${WORKFLOW_STAGE_SQL_EXPR} = ? AND ${WORKFLOW_STATUS_SQL_EXPR} IN ('in_progress', 'returned'))
            OR EXISTS (
              SELECT 1
              FROM workflow_actions wa
              WHERE wa.module_key = 'finance'
                AND wa.record_id = fr.id
                AND LOWER(TRIM(wa.stage)) = ?
                AND wa.decision IN ('approved', 'returned', 'rejected', 'archived')
            )
          )`
        );
        whereParams.push(normalizedStage, normalizedStage);
      }
    } else {
      whereParts.push(`${WORKFLOW_STAGE_SQL_EXPR} = ?`, `${WORKFLOW_STATUS_SQL_EXPR} = ?`);
      whereParams.push(normalizedStage, workflowStatus);
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
        const departmentIds = Array.from(scopeFilters.departmentIds || []).map((id) => toPositiveInt(id)).filter(Boolean);
        if (scopeFilters.forceEmpty || departmentIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push('fr.department_id IN (?)');
        whereParams.push(departmentIds);
      }

      if (scopeFilters.scopeType === 'entity') {
        const entityIds = Array.from(scopeFilters.entityIds || []).map((id) => toPositiveInt(id)).filter(Boolean);
        if (scopeFilters.forceEmpty || entityIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push('fr.beneficiary_entity_id IN (?)');
        whereParams.push(entityIds);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [countRows] = await tx.query(
      `SELECT COUNT(*) AS total
         FROM finance_requests fr
         ${whereClause}`,
      whereParams
    );

    const total = Number(countRows?.[0]?.total || 0);

    const financeSelectSql = await getFinanceSelectSql({ tx });
    const [rows] = await tx.query(
      `${financeSelectSql}
       ${whereClause}
       ORDER BY fr.created_at DESC
       LIMIT ? OFFSET ?`,
      [normalizedStage, ...whereParams, limit, offset]
    );

    return {
      items: rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
        level1_route_type: resolveFinanceLevel1RouteType(row),
      })),
      total,
      page,
      limit,
    };
  },

  async listAvailableBeneficiaryTypes({ tx = db } = {}) {
    const [rows] = await tx.query(
      `SELECT DISTINCT TRIM(beneficiary_type) AS beneficiary_type
         FROM finance_requests fr
        WHERE LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'
          AND beneficiary_type IS NOT NULL
          AND TRIM(beneficiary_type) <> ''
        ORDER BY TRIM(beneficiary_type) ASC`
    );

    const dedup = new Map();
    for (const row of rows || []) {
      const normalized = normalizeBeneficiaryType(row?.beneficiary_type);
      const key = normalizeText(normalized).toLowerCase();
      if (!key || dedup.has(key)) continue;
      dedup.set(key, normalized);
    }

    return Array.from(dedup.values());
  },

  async getFinanceOwner(recordId) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) {
      return null;
    }

    const [rows] = await db.query(
      `SELECT id, created_by
         FROM finance_requests
         WHERE id = ?
         LIMIT 1`,
      [normalizedRecordId]
    );

    return rows.length ? rows[0] : null;
  },
};

export default financeModel;
