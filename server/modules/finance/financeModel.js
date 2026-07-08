import fs from 'fs';
import path from 'path';

import db from '../../config/connection.js';
import {
  resolveCatalogIds,
  resolvePrimaryHeadIds,
} from '../budgetCatalog/budgetCatalogResolver.js';
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
const parseBooleanLike = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = normalizeText(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};
const normalizeSubHeadForLookup = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (!normalized.includes('::')) return normalized;
  const parts = normalized.split('::');
  if (parts[0] === 'sub' && parts.length >= 3) {
    return normalizeText(parts.slice(2).join('::'));
  }
  return normalizeText(parts[1]);
};
const FINANCE_ANNEXURE_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'finance-annexures');
const FINANCE_ANNEXURE_PUBLIC_PREFIX = '/uploads/finance-annexures/';
const FINANCE_ANNEXURE_STORED_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const FINANCE_PRINCIPAL_DOC_UPLOAD_DIR = path.resolve(
  process.cwd(),
  'uploads',
  'finance-principal-documents',
);
const FINANCE_PRINCIPAL_DOC_PUBLIC_PREFIX = '/uploads/finance-principal-documents/';
const FINANCE_REQUEST_COLUMN_EXISTS_CACHE = new Map();
const FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE = new Map();
const FINANCE_INCOME_ROWS_COLUMN_EXISTS_CACHE = new Map();
const FINANCE_OVERALL_STATUS_DELETED_SUPPORT_CACHE = { value: null };
const FINANCE_NOT_DELETED_CONDITION_SQL = `
  LOWER(TRIM(COALESCE(fr.overall_status, ''))) <> 'deleted'
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) <> 'deleted'
`;

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
    [normalizedColumn],
  );

  const exists = Number(rows?.[0]?.count || 0) > 0;
  FINANCE_BUDGET_BREAKUP_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const hasFinanceIncomeRowsColumn = async (columnName, { tx = db } = {}) => {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;

  if (FINANCE_INCOME_ROWS_COLUMN_EXISTS_CACHE.has(normalizedColumn)) {
    return FINANCE_INCOME_ROWS_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true;
  }

  const [rows] = await tx.query(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'finance_income_rows'
         AND COLUMN_NAME = ?`,
    [normalizedColumn],
  );

  const exists = Number(rows?.[0]?.count || 0) > 0;
  FINANCE_INCOME_ROWS_COLUMN_EXISTS_CACHE.set(normalizedColumn, exists);
  return exists;
};

const supportsFinanceOverallStatusDeletedValue = async ({ tx = db } = {}) => {
  if (FINANCE_OVERALL_STATUS_DELETED_SUPPORT_CACHE.value !== null) {
    return FINANCE_OVERALL_STATUS_DELETED_SUPPORT_CACHE.value === true;
  }

  const [rows] = await tx.query(
    `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'finance_requests'
        AND COLUMN_NAME = 'overall_status'
      LIMIT 1`,
  );
  const columnType = normalizeText(rows?.[0]?.COLUMN_TYPE || rows?.[0]?.column_type).toLowerCase();
  const supportsDeleted = columnType.includes("'deleted'");
  FINANCE_OVERALL_STATUS_DELETED_SUPPORT_CACHE.value = supportsDeleted;
  return supportsDeleted;
};

const normalizeBeneficiaryTypeForStorage = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType).toLowerCase();

  if (!normalized) return 'Institution';
  if (['faculty', 'individual faculty'].includes(normalized)) return 'Faculty';
  if (['staff', 'faculty_team', 'faculty team'].includes(normalized)) return 'Staff';
  if (['student_team', 'student team'].includes(normalized)) return 'Department';
  if (normalized === 'professional body' || normalized === 'professional bodies')
    return 'Professional Body';
  if (normalized === 'department') return 'Department';
  if (normalized === 'centre') return 'Centre';
  if (normalized === 'cell') return 'Cell';
  if (normalized === 'club') return 'Club';
  if (normalized === 'section') return 'Section';
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

const normalizeUnplannedBudgetPayload = (payload = {}) => {
  const enabled = Boolean(payload?.unplanned_budget_enabled);
  const parsedAmount = Number(payload?.unplanned_budget_amount);
  const amount =
    enabled && Number.isFinite(parsedAmount) && parsedAmount > 0 ? toMoney(parsedAmount) : 0;

  return {
    enabled,
    amount,
  };
};

const calculateFinanceTotalBudget = (budgetRows = [], unplannedPayload = {}) => {
  const plannedTotal = Array.isArray(budgetRows)
    ? budgetRows.reduce((sum, row) => sum + toMoney(row?.amount), 0)
    : 0;
  const unplanned = normalizeUnplannedBudgetPayload(unplannedPayload);
  return toMoney(plannedTotal + unplanned.amount);
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

const normalizeBeneficiaryTypeToken = (beneficiaryType) =>
  normalizeText(beneficiaryType).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

const isIndividualBeneficiaryType = (beneficiaryType) => {
  const token = normalizeBeneficiaryTypeToken(beneficiaryType);
  return token === 'faculty' || token === 'staff';
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

const resolveFinanceLevel1RouteType = (record = {}) => {
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

const normalizeEntityTypeCode = (typeCode) => {
  const normalized = normalizeText(typeCode)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (['DEPT', 'DEPARTMENT'].includes(normalized)) return 'DEPARTMENT';
  if (['CENTRE', 'CENTER'].includes(normalized)) return 'CENTRE';
  if (normalized === 'CELL') return 'CELL';
  if (normalized === 'CLUB') return 'CLUB';
  if (normalized === 'SECTION') return 'SECTION';
  if (['PROF_BODY', 'PROFESSIONAL_BODY', 'PROFESSIONAL_BODIES'].includes(normalized)) {
    return 'PROFESSIONAL_BODY';
  }

  return normalized || null;
};

const normalizeHeadLabelForMatch = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shouldUseHeadOnlyAvailabilityMatch = (budgetHead, _subHead = '') => {
  const normalized = normalizeHeadLabelForMatch(budgetHead);
  return Boolean(normalized);
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
    const headOnlyMatch = shouldUseHeadOnlyAvailabilityMatch(budgetHead, subHead);
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

    if (!subHead && !headOnlyMatch) {
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
      head_only_match: headOnlyMatch,
      amount: toMoney(parsedAmount),
      approved_amount:
        row?.approved_amount !== undefined && row?.approved_amount !== null
          ? toMoney(row.approved_amount)
          : null,
      budget_line_id: toPositiveInt(row?.budget_line_id),
      budget_proposal_id: toPositiveInt(row?.budget_proposal_id),
      fiscal_year: toPositiveInt(row?.fiscal_year || row?.fiscalYear),
      available_amount_snapshot: hasAvailableSnapshot ? toMoney(parsedAvailableSnapshot) : null,
      remaining_amount_snapshot:
        row?.remaining_amount_snapshot !== undefined && row?.remaining_amount_snapshot !== null
          ? toMoney(row.remaining_amount_snapshot)
          : null,
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
    remarks: normalizeText(row?.remarks || row?.remark),
    credit_account: normalizeText(row?.creditAccount || row?.credit_account),
    sort_order: index,
  }));

const normalizeFinanceAnnexures = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const originalName = normalizeText(
        row?.original_name || row?.originalName || row?.annexure_file_name,
      );
      const storedName =
        normalizeText(row?.stored_name || row?.storedName || row?.annexure_storage_name) ||
        originalName;
      return {
        annexure_type: normalizeText(row?.annexure_type || row?.annexureType),
        original_name: originalName,
        stored_name: storedName,
        file_path: normalizeText(row?.file_path || row?.filePath || row?.annexure_file_path),
        mime_type: normalizeText(row?.mime_type || row?.mimeType || row?.annexure_mime_type),
        file_size: Number.isFinite(
          Number(row?.file_size ?? row?.fileSize ?? row?.annexure_file_size),
        )
          ? Number(row?.file_size ?? row?.fileSize ?? row?.annexure_file_size)
          : null,
        sort_order: index,
      };
    })
    .filter((row) => row.file_path && (row.stored_name || row.original_name));

const cleanupOrphanFinanceAnnexureFiles = async (storedNames = []) => {
  if (!Array.isArray(storedNames) || storedNames.length === 0) {
    return;
  }

  const safeBase = `${FINANCE_ANNEXURE_UPLOAD_DIR}${path.sep}`;
  const uniqueNames = new Set(
    storedNames
      .map((name) => normalizeText(name))
      .filter((name) => name && FINANCE_ANNEXURE_STORED_NAME_PATTERN.test(name)),
  );

  for (const storedName of uniqueNames) {
    const resolvedPath = path.resolve(FINANCE_ANNEXURE_UPLOAD_DIR, storedName);
    if (!resolvedPath.startsWith(safeBase)) {
      continue;
    }

    try {
      await fs.promises.unlink(resolvedPath);
    } catch (_error) {
      // Best-effort cleanup only; request update is already committed.
      // Ignore unlink failures to avoid reporting false negatives to API clients.
    }
  }
};

const normalizeFinancePrincipalDocument = (row = {}) => ({
  id: toPositiveInt(row.id),
  finance_id: toPositiveInt(row.finance_id),
  original_name: normalizeText(row.original_name),
  stored_name: normalizeText(row.stored_name),
  file_path: normalizeText(row.file_path),
  mime_type: normalizeText(row.mime_type),
  file_size: Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
  uploaded_at: row.created_at || null,
});

const getFinancePrincipalDocumentsByFinanceIds = async (financeIds = [], { tx = db } = {}) => {
  const normalizedFinanceIds = Array.from(
    new Set(
      (Array.isArray(financeIds) ? financeIds : [])
        .map((value) => toPositiveInt(value))
        .filter(Boolean),
    ),
  );

  if (!normalizedFinanceIds.length) {
    return new Map();
  }

  const placeholders = normalizedFinanceIds.map(() => '?').join(', ');
  try {
    const [rows] = await tx.query(
      `SELECT id, finance_id, original_name, stored_name, file_path, mime_type, file_size, created_at
         FROM finance_request_annexures
        WHERE annexure_type = 'principal_approval'
          AND finance_id IN (${placeholders})`,
      normalizedFinanceIds,
    );

    const map = new Map();
    for (const row of rows || []) {
      map.set(toPositiveInt(row.finance_id), normalizeFinancePrincipalDocument(row));
    }
    return map;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return new Map();
    }
    throw error;
  }
};

const getFinancePrincipalDocumentByFinanceId = async (financeId, { tx = db } = {}) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  if (!normalizedFinanceId) {
    return null;
  }

  const map = await getFinancePrincipalDocumentsByFinanceIds([normalizedFinanceId], { tx });
  return map.get(normalizedFinanceId) || null;
};

const setFinancePrincipalDocument = async (financeId, document, { tx = db } = {}) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  if (!normalizedFinanceId) {
    return null;
  }

  await tx.query(
    `DELETE FROM finance_request_annexures WHERE annexure_type = 'principal_approval' AND finance_id = ?`,
    [normalizedFinanceId],
  );

  if (!document || !normalizeText(document.file_path)) {
    return null;
  }

  const [result] = await tx.query(
    `INSERT INTO finance_request_annexures
       (finance_id, annexure_type, original_name, stored_name, file_path, mime_type, file_size)
     VALUES (?, 'principal_approval', ?, ?, ?, ?, ?)`,
    [
      normalizedFinanceId,
      normalizeText(document.original_name) || null,
      normalizeText(document.stored_name) || null,
      normalizeText(document.file_path),
      normalizeText(document.mime_type) || null,
      Number.isFinite(Number(document.file_size)) ? Number(document.file_size) : null,
    ],
  );

  return {
    id: toPositiveInt(result.insertId),
    finance_id: normalizedFinanceId,
    original_name: normalizeText(document.original_name) || null,
    stored_name: normalizeText(document.stored_name) || null,
    file_path: normalizeText(document.file_path),
    mime_type: normalizeText(document.mime_type) || null,
    file_size: Number.isFinite(Number(document.file_size)) ? Number(document.file_size) : null,
    uploaded_at: new Date().toISOString(),
  };
};

const deleteFinancePrincipalDocumentByFinanceId = async (financeId, { tx = db } = {}) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  if (!normalizedFinanceId) {
    return false;
  }

  const [result] = await tx.query(
    `DELETE FROM finance_request_annexures WHERE annexure_type = 'principal_approval' AND finance_id = ?`,
    [normalizedFinanceId],
  );

  return Number(result?.affectedRows || 0) > 0;
};

const getLegacyAnnexureFromRecord = (record = {}) => {
  const filePath = normalizeText(record?.annexure_file_path);
  const storedName = normalizeText(record?.annexure_storage_name);
  const originalName = normalizeText(record?.annexure_file_name);
  const fallbackStoredName = storedName || originalName;
  if (!filePath || !fallbackStoredName) {
    return [];
  }
  return [
    {
      id: null,
      finance_id: toPositiveInt(record?.id),
      annexure_type: normalizeText(record?.annexure_type),
      original_name: originalName || fallbackStoredName,
      stored_name: fallbackStoredName,
      file_path: filePath,
      mime_type: normalizeText(record?.annexure_mime_type),
      file_size: Number.isFinite(Number(record?.annexure_file_size))
        ? Number(record?.annexure_file_size)
        : null,
      sort_order: 0,
      created_at: null,
    },
  ];
};

const normalizeWorkflowStatus = (state) => normalizeText(state?.status).toLowerCase();

const normalizeToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeStringForMatch = (value) => normalizeText(value).toLowerCase().trim();

const isLooseTextMatch = (leftValue, rightValue) => {
  const leftNormalized = normalizeStringForMatch(leftValue);
  const rightNormalized = normalizeStringForMatch(rightValue);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  return leftNormalized === rightNormalized;
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

const QUEUE_DISPLAY_REF_SQL_EXPR = `
  COALESCE(
    (
      SELECT frr_display.request_ref
        FROM finance_request_refs frr_display
       WHERE frr_display.finance_request_id = fr.id
       ORDER BY frr_display.id ASC
       LIMIT 1
    ),
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
  )
`;

const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL =
  LEVEL1_COORDINATOR_BENEFICIARY_TYPES.map(escapeSqlLiteral).join(', ');
const LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL =
  LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY.map(escapeSqlLiteral).join(', ');

const LEVEL1_COORDINATOR_ROUTE_SQL_EXPR = `
  (
    LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_SQL})
    OR (
      LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) IN (${LEVEL1_COORDINATOR_BENEFICIARY_TYPES_WITH_ENTITY_SQL})
      AND COALESCE(fr.beneficiary_entity_id, 0) > 0
    )
  )
`;

const buildFinanceSelectSql = ({
  budgetTagSelectSql = 'NULL AS budget_tag',
  unplannedBudgetEnabledSelectSql = 'NULL AS unplanned_budget_enabled',
  unplannedBudgetAmountSelectSql = 'NULL AS unplanned_budget_amount',
  unplannedBudgetDescriptionSelectSql = 'NULL AS unplanned_budget_description',
  annexureTypeSelectSql = 'NULL AS annexure_type',
  annexureFileNameSelectSql = 'NULL AS annexure_file_name',
  annexureStorageNameSelectSql = 'NULL AS annexure_storage_name',
  annexureFilePathSelectSql = 'NULL AS annexure_file_path',
  annexureMimeTypeSelectSql = 'NULL AS annexure_mime_type',
  annexureFileSizeSelectSql = 'NULL AS annexure_file_size',
  paymentDebitAccountSelectSql = 'NULL AS payment_debit_account',
} = {}) => `
  SELECT
    fr.id,
    fr.employee_id,
    e.user_id AS applicant_user_id,
    fr.created_by,
    COALESCE(
      TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))),
      fr.applicant_name
    ) AS applicant_name,
    COALESCE(e.designation, fr.designation) AS designation,
    COALESCE(emp_dept.name, fr.department) AS department,
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
    ${unplannedBudgetEnabledSelectSql},
    ${unplannedBudgetAmountSelectSql},
    ${unplannedBudgetDescriptionSelectSql},
    fr.total_budget,
    fr.approved_total_amount,
    fr.income_type,
    fr.income_status,
    fr.income_amount_type,
    fr.credit_status,
    fr.debit_status,
    ${paymentDebitAccountSelectSql},
    fr.partial_amount,
    fr.enclosures,
    ${annexureTypeSelectSql},
    ${annexureFileNameSelectSql},
    ${annexureStorageNameSelectSql},
    ${annexureFilePathSelectSql},
    ${annexureMimeTypeSelectSql},
    ${annexureFileSizeSelectSql},
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
      SELECT MIN(bp.fiscal_year)
        FROM finance_budget_breakup fbb
        JOIN budget_proposals bp ON bp.id = fbb.budget_proposal_id
       WHERE fbb.finance_id = fr.id
    ) AS fiscal_year,
    (
      SELECT GREATEST(
        0,
        COALESCE(SUM(CASE
          WHEN er_cf.request_type = 'Advance'
            AND (
              YEAR(COALESCE(er_cf.request_date, er_cf.created_at))
                - (MONTH(COALESCE(er_cf.request_date, er_cf.created_at)) < 4)
            ) = COALESCE(
              (
                SELECT MIN(bp_cf.fiscal_year)
                  FROM finance_budget_breakup fbb_cf
                  JOIN budget_proposals bp_cf ON bp_cf.id = fbb_cf.budget_proposal_id
                 WHERE fbb_cf.finance_id = fr.id
              ),
              YEAR(COALESCE(fr.request_date, fr.created_at))
                - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
            )
            AND (
              LOWER(TRIM(COALESCE(er_cf.overall_status, ''))) IN ('approved', 'completed')
              OR LOWER(TRIM(COALESCE(er_cf.workflow_status, ''))) IN ('approved', 'completed')
              OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er_cf.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
            )
          THEN COALESCE(er_cf.advance_total_amount, er_cf.total_amount, 0)
          WHEN er_cf.request_type = 'Settlement'
            AND (
              LOWER(TRIM(COALESCE(er_cf.overall_status, ''))) IN ('approved', 'completed')
              OR LOWER(TRIM(COALESCE(er_cf.workflow_status, ''))) IN ('approved', 'completed')
              OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er_cf.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
            )
          THEN -COALESCE(er_cf.settlement_total_amount, er_cf.total_amount, 0)
          ELSE 0
        END), 0)
      )
      FROM expenditure_requests er_cf
      WHERE er_cf.finance_request_id = fr.id
    ) AS carry_forward_unsettled_advance_amount,
    (
      SELECT wa.decision
        FROM workflow_actions wa
       WHERE wa.module_key = 'finance'
         AND wa.record_id = fr.id
         AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
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
  const hasUnplannedBudgetEnabled = await hasFinanceRequestColumn('unplanned_budget_enabled', {
    tx,
  });
  const hasUnplannedBudgetAmount = await hasFinanceRequestColumn('unplanned_budget_amount', { tx });
  const hasUnplannedBudgetDescription = await hasFinanceRequestColumn(
    'unplanned_budget_description',
    { tx },
  );
  const hasAnnexureType = await hasFinanceRequestColumn('annexure_type', { tx });
  const hasAnnexureFileName = await hasFinanceRequestColumn('annexure_file_name', { tx });
  const hasAnnexureStorageName = await hasFinanceRequestColumn('annexure_storage_name', { tx });
  const hasAnnexureFilePath = await hasFinanceRequestColumn('annexure_file_path', { tx });
  const hasAnnexureMimeType = await hasFinanceRequestColumn('annexure_mime_type', { tx });
  const hasAnnexureFileSize = await hasFinanceRequestColumn('annexure_file_size', { tx });
  const hasPaymentDebitAccount = await hasFinanceRequestColumn('payment_debit_account', { tx });
  return buildFinanceSelectSql({
    budgetTagSelectSql: hasBudgetTag ? 'fr.budget_tag' : 'NULL AS budget_tag',
    unplannedBudgetEnabledSelectSql: hasUnplannedBudgetEnabled
      ? 'fr.unplanned_budget_enabled'
      : 'NULL AS unplanned_budget_enabled',
    unplannedBudgetAmountSelectSql: hasUnplannedBudgetAmount
      ? 'fr.unplanned_budget_amount'
      : 'NULL AS unplanned_budget_amount',
    unplannedBudgetDescriptionSelectSql: hasUnplannedBudgetDescription
      ? 'fr.unplanned_budget_description'
      : 'NULL AS unplanned_budget_description',
    annexureTypeSelectSql: hasAnnexureType ? 'fr.annexure_type' : 'NULL AS annexure_type',
    annexureFileNameSelectSql: hasAnnexureFileName
      ? 'fr.annexure_file_name'
      : 'NULL AS annexure_file_name',
    annexureStorageNameSelectSql: hasAnnexureStorageName
      ? 'fr.annexure_storage_name'
      : 'NULL AS annexure_storage_name',
    annexureFilePathSelectSql: hasAnnexureFilePath
      ? 'fr.annexure_file_path'
      : 'NULL AS annexure_file_path',
    annexureMimeTypeSelectSql: hasAnnexureMimeType
      ? 'fr.annexure_mime_type'
      : 'NULL AS annexure_mime_type',
    annexureFileSizeSelectSql: hasAnnexureFileSize
      ? 'fr.annexure_file_size'
      : 'NULL AS annexure_file_size',
    paymentDebitAccountSelectSql: hasPaymentDebitAccount
      ? 'fr.payment_debit_account'
      : 'NULL AS payment_debit_account',
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
    const isMoneyField = field.valueType === 'money';
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

    const normalizeFieldValue = (value) => {
      if (isDateField) return normalizeDateOnly(value);
      if (isMoneyField)
        return Number.isFinite(Number(value)) ? toMoney(value).toFixed(2) : normalizeText(value);
      return normalizeText(value);
    };

    const previousValue = normalizeFieldValue(previousRecord?.[field.storageKey]);
    const nextValue = normalizeFieldValue(nextRecord?.[field.storageKey]);

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
  const nextValue = (key) =>
    Object.prototype.hasOwnProperty.call(updateData, key) ? updateData[key] : previousRecord[key];
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
    unplanned_budget_enabled: nextValue('unplanned_budget_enabled'),
    unplanned_budget_amount: nextValue('unplanned_budget_amount'),
    unplanned_budget_description: nextValue('unplanned_budget_description'),
    annexure_type: updateData.annexure_type ?? previousRecord.annexure_type,
    annexure_file_name: updateData.annexure_file_name ?? previousRecord.annexure_file_name,
    annexure_storage_name: updateData.annexure_storage_name ?? previousRecord.annexure_storage_name,
    annexure_file_path: updateData.annexure_file_path ?? previousRecord.annexure_file_path,
    annexure_mime_type: updateData.annexure_mime_type ?? previousRecord.annexure_mime_type,
    annexure_file_size: updateData.annexure_file_size ?? previousRecord.annexure_file_size,
    total_budget: updateData.total_budget ?? previousRecord.total_budget,
    income_type: updateData.income_type ?? previousRecord.income_type,
    income_status: updateData.income_status ?? previousRecord.income_status,
    income_amount_type: updateData.income_amount_type ?? previousRecord.income_amount_type,
    credit_status: updateData.credit_status ?? previousRecord.credit_status,
    debit_status: updateData.debit_status ?? previousRecord.debit_status,
    partial_amount: updateData.partial_amount ?? previousRecord.partial_amount,
    payment_debit_account: nextValue('payment_debit_account'),
  };

  const fieldChanges = collectChangedFields(previousRecord, nextRecord, [
    { storageKey: 'request_date', label: 'Request date', valueType: 'date' },
    { storageKey: 'description', label: 'Description' },
    { storageKey: 'beneficiary_type', label: 'Beneficiary type' },
    { storageKey: 'beneficiary_value', label: 'Beneficiary value' },
    { storageKey: 'budget_tag', label: 'Budget tag' },
    { storageKey: 'primary_head', label: 'Primary head' },
    { storageKey: 'event_sub_head', label: 'Event sub head' },
    { storageKey: 'proposed_amount', label: 'Proposed amount', valueType: 'money' },
    { storageKey: 'balance_amount', label: 'Balance amount', valueType: 'money' },
    { storageKey: 'unplanned_budget_enabled', label: 'Unplanned expenditure enabled' },
    {
      storageKey: 'unplanned_budget_amount',
      label: 'Unplanned expenditure amount',
      valueType: 'money',
    },
    { storageKey: 'unplanned_budget_description', label: 'Unplanned expenditure description' },
    { storageKey: 'annexure_type', label: 'Annexure type' },
    { storageKey: 'annexure_file_name', label: 'Annexure file name' },
    { storageKey: 'annexure_storage_name', label: 'Annexure storage name' },
    { storageKey: 'annexure_file_path', label: 'Annexure file path' },
    { storageKey: 'annexure_mime_type', label: 'Annexure mime type' },
    { storageKey: 'annexure_file_size', label: 'Annexure file size' },
    { storageKey: 'total_budget', label: 'Total budget', valueType: 'money' },
    { storageKey: 'income_type', label: 'Income type' },
    { storageKey: 'income_status', label: 'Income status' },
    { storageKey: 'income_amount_type', label: 'Income amount type' },
    { storageKey: 'credit_status', label: 'Credit status' },
    { storageKey: 'debit_status', label: 'Debit status' },
    { storageKey: 'partial_amount', label: 'Partial amount', valueType: 'money' },
  ]);

  const rowChanges = [];
  if (budgetRowsInput) {
    rowChanges.push(
      `Budget breakup ${budgetRowsChanged ? 'updated' : 'reviewed'} (${budgetRowsInput.length} row(s))`,
    );
  }
  if (incomeRowsInput) {
    rowChanges.push(
      `Income rows ${incomeRowsChanged ? 'updated' : 'reviewed'} (${incomeRowsInput.length} row(s))`,
    );
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
      actorIsAdmin: Boolean(
        actor?.isSuperAdmin ||
        ['admin', 'super_admin', 'superadmin'].includes(normalizeText(actor?.role).toLowerCase()),
      ),
    },
  };
};

const resolveEntityTypeCodeFromBeneficiaryType = (beneficiaryType) => {
  const normalizedType = normalizeBeneficiaryType(beneficiaryType);

  const map = {
    Centre: 'CENTRE',
    Cell: 'CELL',
    Club: 'CLUB',
    Section: 'SECTION',
    'Professional Body': 'PROFESSIONAL_BODY',
    ProfessionalBodies: 'PROFESSIONAL_BODY',
    'Professional Bodies': 'PROFESSIONAL_BODY',
  };

  return map[normalizedType] || null;
};

const resolveBudgetAvailabilityScope = async (conn, scope = {}) => {
  const beneficiaryType = normalizeBeneficiaryType(
    scope?.beneficiaryType || scope?.beneficiary_type,
  );
  const beneficiaryValue = normalizeText(scope?.beneficiaryValue || scope?.beneficiary_value);
  const beneficiaryTypeToken = normalizeBeneficiaryTypeToken(beneficiaryType);
  const providedDepartmentId = toPositiveInt(scope?.departmentId || scope?.department_id);
  const providedEntityId = toPositiveInt(
    scope?.beneficiaryEntityId || scope?.beneficiary_entity_id,
  );

  if (!beneficiaryTypeToken) {
    return {
      mode: 'user',
      beneficiaryType,
      departmentId: null,
      entityId: null,
    };
  }

  if (isIndividualBeneficiaryType(beneficiaryTypeToken)) {
    if (beneficiaryValue) {
      return {
        mode: 'individual',
        beneficiaryType,
        beneficiaryValue,
        departmentId: null,
        entityId: null,
      };
    }

    return {
      mode: 'user',
      beneficiaryType,
      departmentId: null,
      entityId: null,
    };
  }

  if (beneficiaryTypeToken === 'department') {
    if (providedDepartmentId) {
      return {
        mode: 'department',
        beneficiaryType,
        departmentId: providedDepartmentId,
        entityId: null,
      };
    }

    if (beneficiaryValue) {
      const [rows] = await conn.query(
        `SELECT id
         FROM master_departments
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         LIMIT 1`,
        [beneficiaryValue],
      );

      const departmentId = toPositiveInt(rows?.[0]?.id);
      if (departmentId) {
        return {
          mode: 'department',
          beneficiaryType,
          departmentId,
          entityId: null,
        };
      }
    }

    return {
      mode: 'department',
      beneficiaryType,
      departmentId: null,
      entityId: null,
    };
  }

  if (beneficiaryTypeToken === 'institution') {
    return {
      mode: 'institution',
      beneficiaryType,
      departmentId: null,
      entityId: null,
    };
  }

  const entityTypeCode = resolveEntityTypeCodeFromBeneficiaryType(beneficiaryType);
  if (providedEntityId) {
    return {
      mode: 'entity',
      beneficiaryType,
      departmentId: null,
      entityId: providedEntityId,
      entityTypeCode,
    };
  }

  if (entityTypeCode && beneficiaryValue) {
    const [rows] = await conn.query(
      `SELECT me.id
       FROM master_entities me
       JOIN master_entity_types met ON met.id = me.entity_type_id
       WHERE me.is_active = 1
         AND UPPER(TRIM(met.code)) = ?
         AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
       LIMIT 1`,
      [entityTypeCode, beneficiaryValue],
    );

    const entityId = toPositiveInt(rows?.[0]?.id);
    if (entityId) {
      return {
        mode: 'entity',
        beneficiaryType,
        departmentId: null,
        entityId,
        entityTypeCode,
      };
    }

    return {
      mode: 'entity',
      beneficiaryType,
      departmentId: null,
      entityId: null,
      entityTypeCode,
    };
  }

  if (entityTypeCode) {
    return {
      mode: 'entity',
      beneficiaryType,
      departmentId: null,
      entityId: null,
      entityTypeCode,
    };
  }

  return {
    mode: 'user',
    beneficiaryType,
    departmentId: null,
    entityId: null,
  };
};

const getBudgetLineAvailabilityById = async (conn, budgetLineId) => {
  const [rows] = await conn.query(
    `SELECT
       bpl.id AS budget_line_id,
       bpl.budget_proposal_id,
       bpl.budget_head,
       bpl.sub_head,
       bpl.budget_head_id,
       bpl.budget_sub_head_id,
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
    [budgetLineId],
  );

  if (!rows.length) {
    return null;
  }

  return {
    budgetLineId: toPositiveInt(rows[0].budget_line_id),
    budgetProposalId: toPositiveInt(rows[0].budget_proposal_id),
    budgetHead: normalizeText(rows[0].budget_head),
    subHead: normalizeText(rows[0].sub_head),
    budgetHeadId: toPositiveInt(rows[0].budget_head_id),
    budgetSubHeadId: toPositiveInt(rows[0].budget_sub_head_id),
    budgetLineAmount: toMoney(rows[0].budget_line_amount),
    consumedAmount: toMoney(rows[0].consumed_amount),
    availableAmount: Math.max(0, toMoney(rows[0].available_amount)),
  };
};

const resolveBudgetAvailabilityForUser = async (
  conn,
  {
    userId,
    userEmail = null,
    budgetHead,
    subHead,
    preferredBudgetLineId = null,
    headOnlyMatch = false,
    excludeFinanceId = null,
    beneficiaryType = null,
    beneficiaryValue = null,
    departmentId = null,
    beneficiaryEntityId = null,
    fiscalYear = null,
  } = {},
) => {
  const normalizedUserId = toPositiveInt(userId);
  const normalizedUserEmail = normalizeText(userEmail).toLowerCase();
  const normalizedBudgetHead = normalizeText(budgetHead);
  const normalizedSubHead = normalizeSubHeadForLookup(subHead);
  const normalizedPreferredBudgetLineId = toPositiveInt(preferredBudgetLineId);
  const normalizedExcludeFinanceId = toPositiveInt(excludeFinanceId);
  const normalizedFiscalYear = toPositiveInt(fiscalYear);
  const applyHeadOnlyMatch =
    Boolean(headOnlyMatch) ||
    shouldUseHeadOnlyAvailabilityMatch(normalizedBudgetHead, normalizedSubHead);
  // NEW: resolve the currently selected catalog labels to IDs, then use those
  // IDs against approved budget lines. LEGACY: if either side has no ID, text
  // matching below remains the fallback.
  const requestedCatalogIds = await resolveCatalogIds(
    conn,
    normalizedBudgetHead,
    normalizedSubHead,
  );
  const requestedBudgetHeadId = toPositiveInt(requestedCatalogIds.budget_head_id);
  const requestedBudgetSubHeadId = toPositiveInt(requestedCatalogIds.budget_sub_head_id);
  const scope = await resolveBudgetAvailabilityScope(conn, {
    beneficiaryType,
    beneficiaryValue,
    departmentId,
    beneficiaryEntityId,
  });

  const userOwnerScopeSql = `
      (
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
      )`;
  const userOwnerScopeParams = [
    normalizedUserId,
    normalizedUserId,
    normalizedUserEmail,
    normalizedUserEmail,
    normalizedUserId,
    normalizedUserId,
    normalizedUserEmail,
    normalizedUserEmail,
  ];
  let ownerScopeSql = userOwnerScopeSql;
  let ownerScopeParams = [...userOwnerScopeParams];

  if (scope.mode === 'department') {
    ownerScopeSql = `bp.department_id = ? AND LOWER(TRIM(bp.beneficiary_type)) = 'department'`;
    ownerScopeParams = [scope.departmentId];
  } else if (scope.mode === 'entity') {
    ownerScopeSql = `
      bp.beneficiary_entity_id = ?
      AND LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body', 'section')`;
    ownerScopeParams = [scope.entityId];
  } else if (scope.mode === 'institution') {
    ownerScopeSql = `LOWER(TRIM(bp.beneficiary_type)) = 'institution'`;
    ownerScopeParams = [];
  } else if (scope.mode === 'individual') {
    const scopeTypeToken = normalizeBeneficiaryTypeToken(scope?.beneficiaryType);
    const hasScopedType = scopeTypeToken === 'faculty' || scopeTypeToken === 'staff';
    const scopeValue = normalizeText(scope?.beneficiaryValue).toLowerCase();
    const beneficiaryTypeSql = hasScopedType
      ? `LOWER(TRIM(bp.beneficiary_type)) = ?`
      : `LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff')`;

    ownerScopeSql = `
      (
        ${beneficiaryTypeSql}
        AND (
          (? <> '' AND LOWER(TRIM(bp.beneficiary_value)) = ?)
          OR (
            (? <> '' AND (bp.beneficiary_value IS NULL OR TRIM(bp.beneficiary_value) = ''))
            AND (${userOwnerScopeSql})
          )
        )
      )`;
    ownerScopeParams = [
      ...(hasScopedType ? [scopeTypeToken] : []),
      scopeValue,
      scopeValue,
      scopeValue,
      ...userOwnerScopeParams,
    ];
  }

  if (
    (scope.mode === 'user' && !normalizedUserId && !normalizedUserEmail) ||
    (scope.mode === 'department' && !scope.departmentId) ||
    (scope.mode === 'entity' && !scope.entityId) ||
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
       bpl.budget_head_id,
       bpl.budget_sub_head_id,
       bp.proposal_ref,
       bp.fiscal_year,
       bp.beneficiary_type,
       bp.beneficiary_value,
       COALESCE(bpl.approved_line_total, bpl.line_total, 0) AS budget_line_amount,
       COALESCE(fblu.consumed_amount, 0) AS consumed_amount,
       COALESCE(own_consumed.amount, 0) AS own_consumed_amount,
       COALESCE(frbr.reserved_amount, 0) AS reserved_amount,
       (
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)
         - GREATEST(0, COALESCE(fblu.consumed_amount, 0) - COALESCE(own_consumed.amount, 0))
         - COALESCE(frbr.reserved_amount, 0)
       ) AS available_amount
     FROM budget_proposal_lines bpl
     JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
     LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
     LEFT JOIN (
       -- When editing an existing (already-approved) finance request, its own
       -- consumed amount is still rolled up in finance_budget_line_usage. Add it
       -- back so the editor can re-enter/adjust what they already had instead of
       -- being blocked by their own prior consumption. Only 'consume' entries
       -- exist (no release/adjust), so SUM of consume = this finance's usage.
       -- finance_id = NULL (no excludeFinanceId) matches no rows -> 0, a no-op.
       SELECT budget_line_id, SUM(amount) AS amount
       FROM finance_budget_usage_ledger
       WHERE operation = 'consume' AND finance_id = ?
       GROUP BY budget_line_id
     ) own_consumed ON own_consumed.budget_line_id = bpl.id
     LEFT JOIN (
       SELECT
         fbb.budget_line_id,
         SUM(COALESCE(fbb.amount, 0)) AS reserved_amount
       FROM finance_budget_breakup fbb
       JOIN finance_requests fr2 ON fr2.id = fbb.finance_id
       WHERE fbb.budget_line_id IS NOT NULL
         AND (
           COALESCE(
             NULLIF(LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(fr2.workflow_state, '$.status')))), ''),
             NULLIF(LOWER(TRIM(fr2.workflow_status)), ''),
             'in_progress'
           ) IN ('in_progress', 'submitted', 'returned')
         )
         AND LOWER(TRIM(COALESCE(fr2.overall_status, 'pending'))) NOT IN ('approved', 'rejected', 'archived')
         AND (? IS NULL OR fr2.id <> ?)
       GROUP BY fbb.budget_line_id
     ) frbr ON frbr.budget_line_id = bpl.id
     WHERE (${ownerScopeSql})
       AND (? IS NULL OR bp.fiscal_year = ?)
       AND (
         LOWER(TRIM(bp.status)) IN ('completed', 'approved', 'principal_approved')
         OR LOWER(TRIM(bp.current_stage)) = 'completed'
       )
     ORDER BY
       (
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)
         - GREATEST(0, COALESCE(fblu.consumed_amount, 0) - COALESCE(own_consumed.amount, 0))
         - COALESCE(frbr.reserved_amount, 0)
       ) DESC,
       bp.updated_at DESC,
       bpl.id DESC`,
    [
      normalizedExcludeFinanceId,
      normalizedExcludeFinanceId,
      normalizedExcludeFinanceId,
      ...ownerScopeParams,
      normalizedFiscalYear,
      normalizedFiscalYear,
    ],
  );

  const matches = rows
    .map((row) => ({
      budgetLineId: toPositiveInt(row.budget_line_id),
      budgetProposalId: toPositiveInt(row.budget_proposal_id),
      proposalRef: normalizeText(row.proposal_ref) || null,
      fiscalYear: row.fiscal_year ? Number(row.fiscal_year) : null,
      proposalBeneficiaryType: normalizeText(row.beneficiary_type),
      proposalBeneficiaryValue: normalizeText(row.beneficiary_value),
      budgetHead: normalizeText(row.budget_head),
      subHead: normalizeText(row.sub_head),
      budgetHeadId: toPositiveInt(row.budget_head_id),
      budgetSubHeadId: toPositiveInt(row.budget_sub_head_id),
      budgetLineAmount: toMoney(row.budget_line_amount),
      consumedAmount: toMoney(row.consumed_amount),
      reservedAmount: toMoney(row.reserved_amount),
      availableAmount: Math.max(0, toMoney(row.available_amount)),
    }))
    .filter((row) => {
      const headMatches =
        requestedBudgetHeadId && row.budgetHeadId
          ? row.budgetHeadId === requestedBudgetHeadId
          : isLooseTextMatch(row.budgetHead, normalizedBudgetHead);

      if (!headMatches) {
        return false;
      }

      if (applyHeadOnlyMatch) {
        return true;
      }

      if (requestedBudgetSubHeadId && row.budgetSubHeadId) {
        return row.budgetSubHeadId === requestedBudgetSubHeadId;
      }

      return isLooseTextMatch(row.subHead, normalizedSubHead);
    });

  const totalAvailable = matches.reduce((sum, row) => sum + row.availableAmount, 0);
  const matchedHeadIds = Array.from(
    new Set(matches.map((row) => toPositiveInt(row.budgetHeadId)).filter(Boolean)),
  );
  const reservationHeadKey = requestedBudgetHeadId
    ? `id:${requestedBudgetHeadId}`
    : matchedHeadIds.length === 1
      ? `id:${matchedHeadIds[0]}`
      : `text:${normalizeHeadLabelForMatch(normalizedBudgetHead) || normalizedBudgetHead.toLowerCase()}`;

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
    reservationHeadKey,
  };
};

const enrichBudgetRowsWithBudgetRefs = async (
  conn,
  userId,
  userEmail,
  budgetRows = [],
  {
    excludeFinanceId = null,
    beneficiaryType = null,
    beneficiaryValue = null,
    departmentId = null,
    beneficiaryEntityId = null,
    lookupBudgetHead = null,
    lookupSubHead = null,
  } = {},
) => {
  const enrichedRows = [];
  const requestedByBudgetLine = new Map();
  const requestedByHead = new Map();
  const normalizedLookupBudgetHead = normalizeText(lookupBudgetHead);
  const normalizedLookupSubHead = normalizeSubHeadForLookup(lookupSubHead);

  for (const row of budgetRows) {
    const effectiveLookupBudgetHead = row.budget_head || normalizedLookupBudgetHead;
    const effectiveLookupSubHead =
      normalizeSubHeadForLookup(row.sub_head) || normalizedLookupSubHead;
    const applyHeadOnlyMatch =
      Boolean(row.head_only_match) ||
      shouldUseHeadOnlyAvailabilityMatch(effectiveLookupBudgetHead, effectiveLookupSubHead);

    const availability = await resolveBudgetAvailabilityForUser(conn, {
      userId,
      userEmail,
      budgetHead: effectiveLookupBudgetHead,
      subHead: effectiveLookupSubHead,
      preferredBudgetLineId: row.budget_line_id,
      headOnlyMatch: applyHeadOnlyMatch,
      excludeFinanceId,
      beneficiaryType,
      beneficiaryValue,
      departmentId,
      beneficiaryEntityId,
      fiscalYear: row.fiscal_year,
    });

    const headReservationKey =
      availability.reservationHeadKey ||
      `text:${normalizeHeadLabelForMatch(effectiveLookupBudgetHead) || normalizeText(effectiveLookupBudgetHead).toLowerCase()}`;
    const alreadyRequestedForHead = toMoney(requestedByHead.get(headReservationKey) || 0);
    const remainingHeadAfterLocalReservations = Math.max(
      0,
      availability.totalAvailable - alreadyRequestedForHead,
    );

    if (applyHeadOnlyMatch) {
      if (!availability.matches.length || remainingHeadAfterLocalReservations <= 0) {
        throw new Error(
          `No approved budget allocation found for "${effectiveLookupBudgetHead}" in the selected beneficiary scope`,
        );
      }

      if (row.amount > remainingHeadAfterLocalReservations) {
        throw new Error(
          `Requested amount ${row.amount.toFixed(2)} exceeds remaining available amount ${remainingHeadAfterLocalReservations.toFixed(2)} for "${effectiveLookupBudgetHead}" after other rows in this request`,
        );
      }

      let remainingToAllocate = toMoney(row.amount);
      const preferredBudgetLineId = toPositiveInt(row.budget_line_id);
      const orderedMatches = [...availability.matches];

      if (preferredBudgetLineId) {
        orderedMatches.sort((a, b) => {
          if (a.budgetLineId === preferredBudgetLineId) return -1;
          if (b.budgetLineId === preferredBudgetLineId) return 1;
          return 0;
        });
      }

      for (const match of orderedMatches) {
        if (remainingToAllocate <= 0) break;

        const candidateBudgetLineId = toPositiveInt(match.budgetLineId);
        if (!candidateBudgetLineId) continue;

        const alreadyRequestedForLine = toMoney(
          requestedByBudgetLine.get(candidateBudgetLineId) || 0,
        );
        const remainingForLine = Math.max(
          0,
          toMoney(match.availableAmount) - alreadyRequestedForLine,
        );
        if (remainingForLine <= 0) continue;

        const allocatedAmount = Math.min(remainingToAllocate, remainingForLine);
        if (allocatedAmount <= 0) continue;

        requestedByBudgetLine.set(
          candidateBudgetLineId,
          toMoney(alreadyRequestedForLine + allocatedAmount),
        );
        enrichedRows.push({
          ...row,
          sub_head: row.sub_head,
          amount: toMoney(allocatedAmount),
          budget_line_id: candidateBudgetLineId,
          budget_proposal_id: toPositiveInt(match.budgetProposalId),
          fiscal_year: toPositiveInt(match.fiscalYear),
          budget_head_id: toPositiveInt(match.budgetHeadId),
          budget_sub_head_id: toPositiveInt(match.budgetSubHeadId),
          available_amount_snapshot: remainingForLine,
        });

        remainingToAllocate = toMoney(remainingToAllocate - allocatedAmount);
      }

      if (remainingToAllocate > 0) {
        throw new Error(
          `Unable to map full amount ${row.amount.toFixed(2)} to approved budget lines for "${effectiveLookupBudgetHead}". Remaining ${remainingToAllocate.toFixed(2)} is unmapped.`,
        );
      }

      requestedByHead.set(headReservationKey, alreadyRequestedForHead + row.amount);
      continue;
    }

    const selected = availability.selected;
    if (!selected) {
      throw new Error(
        `No approved budget allocation found for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" in the selected beneficiary scope`,
      );
    }

    if (row.amount > selected.availableAmount) {
      throw new Error(
        `Requested amount ${row.amount.toFixed(2)} exceeds available amount ${selected.availableAmount.toFixed(2)} for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}"`,
      );
    }

    const selectedBudgetLineId = toPositiveInt(selected.budgetLineId);
    if (!selectedBudgetLineId) {
      throw new Error(
        `No approved budget allocation found for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" in the selected beneficiary scope`,
      );
    }

    const alreadyRequested = toMoney(requestedByBudgetLine.get(selectedBudgetLineId) || 0);
    const remainingAfterLocalReservations = Math.max(
      0,
      selected.availableAmount - alreadyRequested,
    );
    if (row.amount > remainingAfterLocalReservations) {
      throw new Error(
        `Requested amount ${row.amount.toFixed(2)} exceeds remaining available amount ${remainingAfterLocalReservations.toFixed(2)} for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" after other rows in this request`,
      );
    }
    requestedByBudgetLine.set(selectedBudgetLineId, alreadyRequested + row.amount);
    requestedByHead.set(headReservationKey, alreadyRequestedForHead + row.amount);

    enrichedRows.push({
      ...row,
      budget_line_id: selectedBudgetLineId,
      budget_proposal_id: toPositiveInt(selected.budgetProposalId),
      fiscal_year: toPositiveInt(selected.fiscalYear),
      budget_head_id: toPositiveInt(selected.budgetHeadId),
      budget_sub_head_id: toPositiveInt(selected.budgetSubHeadId),
      available_amount_snapshot: remainingAfterLocalReservations,
    });
  }

  return enrichedRows.map((row, index) => ({
    ...row,
    sort_order: index,
  }));
};

const replaceBudgetRows = async (conn, financeId, budgetRows = []) => {
  await conn.query('DELETE FROM finance_budget_breakup WHERE finance_id = ?', [financeId]);

  if (!budgetRows.length) {
    return;
  }

  const hasBudgetProposalIdColumn = await hasFinanceBudgetBreakupColumn('budget_proposal_id', {
    tx: conn,
  });
  const hasBudgetHeadIdColumn = await hasFinanceBudgetBreakupColumn('budget_head_id', { tx: conn });
  const hasBudgetSubHeadIdColumn = await hasFinanceBudgetBreakupColumn('budget_sub_head_id', {
    tx: conn,
  });
  const hasApprovedAmountColumn = await hasFinanceBudgetBreakupColumn('approved_amount', {
    tx: conn,
  });
  const hasRemainingAmountSnapshotColumn = await hasFinanceBudgetBreakupColumn(
    'remaining_amount_snapshot',
    {
      tx: conn,
    },
  );
  const hasIsTopupColumn = await hasFinanceBudgetBreakupColumn('is_topup', { tx: conn });

  for (const row of budgetRows) {
    let budget_head_id = toPositiveInt(row.budget_head_id);
    let budget_sub_head_id = toPositiveInt(row.budget_sub_head_id);

    // NEW: carry catalog IDs from the selected approved budget line. LEGACY:
    // only resolve from snapshot text when old/unbackfilled rows do not carry IDs.
    if (!budget_head_id || !budget_sub_head_id) {
      const resolvedIds = await resolveCatalogIds(conn, row.budget_head, row.sub_head);
      budget_head_id = budget_head_id || toPositiveInt(resolvedIds.budget_head_id);
      budget_sub_head_id = budget_sub_head_id || toPositiveInt(resolvedIds.budget_sub_head_id);
    }

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

    if (hasBudgetHeadIdColumn) {
      const idx = columns.indexOf('amount');
      columns.splice(idx, 0, 'budget_head_id');
      values.splice(idx, 0, budget_head_id);
    }
    if (hasBudgetSubHeadIdColumn) {
      const idx = columns.indexOf('amount');
      columns.splice(idx, 0, 'budget_sub_head_id');
      values.splice(idx, 0, budget_sub_head_id);
    }
    if (hasApprovedAmountColumn) {
      const idx = columns.indexOf('available_amount_snapshot');
      columns.splice(idx, 0, 'approved_amount');
      values.splice(idx, 0, row.approved_amount ?? null);
    }
    if (hasRemainingAmountSnapshotColumn) {
      const idx = columns.indexOf('sort_order');
      columns.splice(idx, 0, 'remaining_amount_snapshot');
      values.splice(idx, 0, row.remaining_amount_snapshot ?? null);
    }
    if (hasIsTopupColumn) {
      columns.push('is_topup');
      values.push(row.is_topup ? 1 : 0);
    }

    await conn.query(
      `INSERT INTO finance_budget_breakup
       (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
  }
};

const replaceIncomeRows = async (conn, financeId, incomeRows = []) => {
  await conn.query('DELETE FROM finance_income_rows WHERE finance_id = ?', [financeId]);

  if (!incomeRows.length) {
    return;
  }

  const hasRemarksColumn = await hasFinanceIncomeRowsColumn('remarks', { tx: conn });

  for (const row of incomeRows) {
    const columns = [
      'finance_id',
      'income_source',
      'contribution',
      'amount',
      'status',
      'credit_account',
      'sort_order',
    ];
    const values = [
      financeId,
      row.income_source || null,
      row.contribution || null,
      row.amount,
      row.status || null,
      row.credit_account || null,
      row.sort_order,
    ];

    if (hasRemarksColumn) {
      columns.splice(5, 0, 'remarks');
      values.splice(5, 0, row.remarks || null);
    }

    await conn.query(
      `INSERT INTO finance_income_rows
       (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
  }
};

const resolveReferenceFiscalYearFromBudgetRows = (budgetRows = [], requestDate = null) => {
  const years = Array.from(
    new Set(
      budgetRows.map((row) => toPositiveInt(row?.fiscal_year || row?.fiscalYear)).filter(Boolean),
    ),
  );

  if (years.length > 0) {
    return Math.min(...years);
  }

  const dateObj = requestDate ? new Date(requestDate) : new Date();
  const fallbackDate = Number.isNaN(dateObj.getTime()) ? new Date() : dateObj;
  return fallbackDate.getFullYear() - (fallbackDate.getMonth() < 3 ? 1 : 0);
};

const resolveFinanceSourceFiscalYear = async (
  conn,
  financeId,
  requestDate = null,
  createdAt = null,
) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  if (normalizedFinanceId) {
    const [rows] = await conn.query(
      `SELECT MIN(bp.fiscal_year) AS fiscal_year
         FROM finance_budget_breakup fbb
         JOIN budget_proposals bp ON bp.id = fbb.budget_proposal_id
        WHERE fbb.finance_id = ?`,
      [normalizedFinanceId],
    );
    const linkedYear = toPositiveInt(rows?.[0]?.fiscal_year);
    if (linkedYear) {
      return linkedYear;
    }
  }

  const fallbackDate = requestDate || createdAt;
  return resolveReferenceFiscalYearFromBudgetRows([], fallbackDate);
};

const FINALIZED_EXPENDITURE_STATUS_SQL = `
    (
      LOWER(TRIM(COALESCE(er.overall_status, ''))) IN ('approved', 'completed')
      OR LOWER(TRIM(COALESCE(er.workflow_status, ''))) IN ('approved', 'completed')
      OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
    )`;

const getFinanceUsageSnapshot = async (conn, financeId) => {
  const [usageRows] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN er.request_type = 'Advance'
          AND ${FINALIZED_EXPENDITURE_STATUS_SQL}
         THEN COALESCE(er.advance_total_amount, er.total_amount, 0)
         ELSE 0
       END), 0) AS advance_amount,
       COALESCE(SUM(CASE
         WHEN er.request_type = 'Settlement'
          AND ${FINALIZED_EXPENDITURE_STATUS_SQL}
         THEN COALESCE(er.settlement_total_amount, er.total_amount, 0)
         ELSE 0
       END), 0) AS settlement_amount,
       COALESCE(SUM(CASE
         WHEN er.request_type = 'Expenditure'
          AND ${FINALIZED_EXPENDITURE_STATUS_SQL}
         THEN COALESCE(er.expenditure_total_amount, er.total_amount, 0)
         ELSE 0
       END), 0) AS expenditure_amount
     FROM expenditure_requests er
     WHERE er.finance_request_id = ?`,
    [financeId],
  );

  const advanceAmount = toMoney(usageRows?.[0]?.advance_amount);
  const settlementAmount = toMoney(usageRows?.[0]?.settlement_amount);
  const expenditureAmount = toMoney(usageRows?.[0]?.expenditure_amount);
  const effectiveUsageAmount = settlementAmount > 0 ? settlementAmount : advanceAmount;

  return {
    advanceAmount,
    settlementAmount,
    expenditureAmount,
    effectiveUsageAmount,
  };
};

const getFinanceAdvanceSettlementSnapshotForFiscalYear = async (conn, financeId, fiscalYear) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  const normalizedFiscalYear = toPositiveInt(fiscalYear);
  if (!normalizedFinanceId || !normalizedFiscalYear) {
    return { advanceAmount: 0, settlementAmount: 0, unsettledAdvanceAmount: 0 };
  }

  const [rows] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN er.request_type = 'Advance'
          -- Attribute the advance to its BUDGET's fiscal year, not the date it was
          -- entered. Faculty enter advances in the current year against an older-FY
          -- budget, so a request-date filter wrongly excluded them and blocked
          -- carry-forward. Falls back to the request-date FY only when the request
          -- has no linked budget. Mirrors resolveFinanceSourceFiscalYear.
          AND COALESCE(
            (
              SELECT MIN(bp_src.fiscal_year)
                FROM finance_budget_breakup fbb_src
                JOIN budget_proposals bp_src ON bp_src.id = fbb_src.budget_proposal_id
               WHERE fbb_src.finance_id = er.finance_request_id
            ),
            YEAR(COALESCE(er.request_date, er.created_at))
              - (MONTH(COALESCE(er.request_date, er.created_at)) < 4)
          ) = ?
          AND ${FINALIZED_EXPENDITURE_STATUS_SQL}
         THEN COALESCE(er.advance_total_amount, er.total_amount, 0)
         ELSE 0
       END), 0) AS advance_amount,
       COALESCE(SUM(CASE
         WHEN er.request_type = 'Settlement'
          AND ${FINALIZED_EXPENDITURE_STATUS_SQL}
         THEN COALESCE(er.settlement_total_amount, er.total_amount, 0)
         ELSE 0
       END), 0) AS settlement_amount
     FROM expenditure_requests er
     WHERE er.finance_request_id = ?`,
    [normalizedFiscalYear, normalizedFinanceId],
  );

  const advanceAmount = toMoney(rows?.[0]?.advance_amount);
  const settlementAmount = toMoney(rows?.[0]?.settlement_amount);
  return {
    advanceAmount,
    settlementAmount,
    unsettledAdvanceAmount: Math.max(0, toMoney(advanceAmount - settlementAmount)),
  };
};

const getCarryForwardTargetBudgetAvailability = async (conn, financeId, targetFiscalYear) => {
  const normalizedFinanceId = toPositiveInt(financeId);
  const normalizedTargetYear = toPositiveInt(targetFiscalYear);
  if (!normalizedFinanceId || !normalizedTargetYear) {
    return { hasBudget: false, matchedHeadCount: 0, sourceHeads: [] };
  }

  const [scopeRows] = await conn.query(
    `SELECT
       fr.beneficiary_type,
       fr.beneficiary_value,
       fr.department_id,
       fr.beneficiary_entity_id,
       fr.primary_head
     FROM finance_requests fr
     WHERE fr.id = ?
     LIMIT 1`,
    [normalizedFinanceId],
  );
  const scope = scopeRows?.[0] || null;
  if (!scope) {
    return { hasBudget: false, matchedHeadCount: 0, sourceHeads: [] };
  }

  const [sourceHeadRows] = await conn.query(
    `SELECT DISTINCT
       COALESCE(NULLIF(TRIM(fbb.budget_head), ''), NULLIF(TRIM(bpl.budget_head), '')) AS budget_head
     FROM finance_budget_breakup fbb
     LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
     WHERE fbb.finance_id = ?`,
    [normalizedFinanceId],
  );

  const sourceHeads = Array.from(
    new Set(
      [
        ...(sourceHeadRows || []).map((row) => normalizeText(row.budget_head)),
        normalizeText(scope.primary_head),
      ]
        .map((head) => head.trim())
        .filter(Boolean),
    ),
  );

  if (!sourceHeads.length) {
    return { hasBudget: false, matchedHeadCount: 0, sourceHeads };
  }

  const scopeParts = [];
  const scopeParams = [];
  const beneficiaryType = normalizeText(scope.beneficiary_type).toLowerCase();
  const beneficiaryValue = normalizeText(scope.beneficiary_value);
  const departmentId = toPositiveInt(scope.department_id);
  const entityId = toPositiveInt(scope.beneficiary_entity_id);

  if (departmentId) {
    scopeParts.push('bp.department_id = ?');
    scopeParams.push(departmentId);
  } else if (
    entityId &&
    !['department', 'faculty', 'staff', 'individual faculty'].includes(beneficiaryType)
  ) {
    scopeParts.push('bp.beneficiary_entity_id = ?');
    scopeParams.push(entityId);
  } else if (beneficiaryValue) {
    scopeParts.push(
      "LOWER(TRIM(CONVERT(COALESCE(bp.beneficiary_value, '') USING utf8mb4) COLLATE utf8mb4_unicode_ci)) = LOWER(TRIM(CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci))",
    );
    scopeParams.push(beneficiaryValue);
  } else if (beneficiaryType) {
    scopeParts.push("LOWER(TRIM(COALESCE(bp.beneficiary_type, ''))) = ?");
    scopeParams.push(beneficiaryType);
  }

  const headPlaceholders = sourceHeads.map(() => '?').join(', ');
  const [budgetRows] = await conn.query(
    `SELECT COUNT(DISTINCT bpl.id) AS matched_head_count
       FROM budget_proposals bp
       JOIN budget_proposal_lines bpl ON bpl.budget_proposal_id = bp.id
      WHERE bp.fiscal_year = ?
        AND (
          LOWER(TRIM(COALESCE(bp.status, ''))) IN ('completed', 'approved', 'principal_approved')
          OR LOWER(TRIM(COALESCE(bp.current_stage, ''))) = 'completed'
        )
        ${scopeParts.length ? `AND ${scopeParts.join(' AND ')}` : ''}
        AND LOWER(TRIM(CONVERT(COALESCE(bpl.budget_head, '') USING utf8mb4) COLLATE utf8mb4_unicode_ci)) IN (${headPlaceholders})`,
    [normalizedTargetYear, ...scopeParams, ...sourceHeads.map((head) => head.toLowerCase())],
  );

  const matchedHeadCount = Number(budgetRows?.[0]?.matched_head_count || 0);
  return {
    hasBudget: matchedHeadCount > 0,
    matchedHeadCount,
    sourceHeads,
  };
};

const replaceFinanceAnnexures = async (conn, financeId, annexures = []) => {
  let financeFkColumn = 'finance_id';
  try {
    await conn.query('DELETE FROM finance_request_annexures WHERE finance_id = ?', [financeId]);
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR') {
      financeFkColumn = 'finance_request_id';
      await conn.query('DELETE FROM finance_request_annexures WHERE finance_request_id = ?', [
        financeId,
      ]);
    } else if (error?.code === 'ER_NO_SUCH_TABLE') {
      return;
    } else {
      throw error;
    }
  }

  if (!annexures.length) {
    return;
  }

  for (const row of annexures) {
    const safeStoredName = normalizeText(row.stored_name) || normalizeText(row.original_name);
    await conn.query(
      `INSERT INTO finance_request_annexures
       (${financeFkColumn}, annexure_type, original_name, stored_name, file_path, mime_type, file_size, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        financeId,
        row.annexure_type || null,
        row.original_name || safeStoredName || null,
        safeStoredName || null,
        row.file_path,
        row.mime_type || null,
        row.file_size,
        row.sort_order,
      ],
    );
  }
};

const getFinanceAnnexures = async (financeId, { tx = db } = {}) => {
  let selectSql = `SELECT
         id,
         finance_id,
         annexure_type,
         original_name,
         stored_name,
         file_path,
         mime_type,
         file_size,
         sort_order,
         created_at
       FROM finance_request_annexures
       WHERE finance_id = ?
       ORDER BY sort_order ASC, id ASC`;
  try {
    let rows;
    try {
      [rows] = await tx.query(selectSql, [financeId]);
    } catch (error) {
      if (error?.code !== 'ER_BAD_FIELD_ERROR') {
        throw error;
      }
      selectSql = `SELECT
           id,
           finance_request_id AS finance_id,
           annexure_type,
           original_name,
           stored_name,
           file_path,
           mime_type,
           file_size,
           sort_order,
           created_at
         FROM finance_request_annexures
         WHERE finance_request_id = ?
         ORDER BY sort_order ASC, id ASC`;
      [rows] = await tx.query(selectSql, [financeId]);
    }
    return rows.map((row) => ({
      id: toPositiveInt(row.id),
      finance_id: toPositiveInt(row.finance_id),
      annexure_type: normalizeText(row.annexure_type),
      original_name: normalizeText(row.original_name),
      stored_name: normalizeText(row.stored_name),
      file_path: normalizeText(row.file_path),
      mime_type: normalizeText(row.mime_type),
      file_size: Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
      sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
      created_at: row.created_at || null,
    }));
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw error;
  }
};

const getFinanceAnnexuresByFinanceIds = async (financeIds = [], { tx = db } = {}) => {
  const normalizedFinanceIds = Array.from(
    new Set(
      (Array.isArray(financeIds) ? financeIds : [])
        .map((value) => toPositiveInt(value))
        .filter(Boolean),
    ),
  );

  if (!normalizedFinanceIds.length) {
    return new Map();
  }

  const placeholders = normalizedFinanceIds.map(() => '?').join(', ');
  let selectSql = `SELECT
         id,
         finance_id,
         annexure_type,
         original_name,
         stored_name,
         file_path,
         mime_type,
         file_size,
         sort_order,
         created_at
       FROM finance_request_annexures
       WHERE finance_id IN (${placeholders})
         AND (annexure_type IS NULL OR annexure_type <> 'principal_approval')
       ORDER BY sort_order ASC, id ASC`;

  try {
    let rows;
    try {
      [rows] = await tx.query(selectSql, normalizedFinanceIds);
    } catch (error) {
      if (error?.code !== 'ER_BAD_FIELD_ERROR') {
        throw error;
      }
      selectSql = `SELECT
           id,
           finance_request_id AS finance_id,
           annexure_type,
           original_name,
           stored_name,
           file_path,
           mime_type,
           file_size,
           sort_order,
           created_at
         FROM finance_request_annexures
         WHERE finance_request_id IN (${placeholders})
           AND (annexure_type IS NULL OR annexure_type <> 'principal_approval')
         ORDER BY sort_order ASC, id ASC`;
      [rows] = await tx.query(selectSql, normalizedFinanceIds);
    }

    const map = new Map();
    for (const row of rows || []) {
      const financeId = toPositiveInt(row.finance_id);
      if (!financeId) {
        continue;
      }
      const normalizedRow = {
        id: toPositiveInt(row.id),
        finance_id: financeId,
        annexure_type: normalizeText(row.annexure_type),
        original_name: normalizeText(row.original_name),
        stored_name: normalizeText(row.stored_name),
        file_path: normalizeText(row.file_path),
        mime_type: normalizeText(row.mime_type),
        file_size: Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        created_at: row.created_at || null,
      };
      if (!map.has(financeId)) {
        map.set(financeId, []);
      }
      map.get(financeId).push(normalizedRow);
    }
    return map;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return new Map();
    }
    throw error;
  }
};

const insertFinanceRequestReference = async (
  conn,
  financeId,
  requestDate,
  referenceFiscalYear = null,
) => {
  try {
    const refYear = resolveReferenceFiscalYearFromBudgetRows(
      [{ fiscal_year: referenceFiscalYear }],
      requestDate,
    );

    const [existing] = await conn.query(
      'SELECT request_ref FROM finance_request_refs WHERE finance_request_id = ? LIMIT 1',
      [financeId],
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );

    const [[existingYearSequence]] = await conn.query(
      `SELECT COALESCE(MAX(ref_sequence), 0) AS current_max
         FROM finance_request_refs
        WHERE ref_year = ?`,
      [refYear],
    );
    const currentMaxSequence = Number(existingYearSequence?.current_max || 0);

    await conn.query(
      `INSERT INTO finance_request_ref_tracker (ref_year, last_sequence)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_sequence = GREATEST(last_sequence, VALUES(last_sequence))`,
      [refYear, currentMaxSequence],
    );

    const [rows] = await conn.query(
      `SELECT last_sequence AS current_max
       FROM finance_request_ref_tracker
       WHERE ref_year = ?
       FOR UPDATE`,
      [refYear],
    );

    const sequence = Number(rows?.[0]?.current_max || 0) + 1;
    const requestRef = `#F-${refYear}-${String(sequence).padStart(4, '0')}`;

    await conn.query(
      `INSERT INTO finance_request_refs (finance_request_id, ref_year, ref_sequence, request_ref)
       VALUES (?, ?, ?, ?)`,
      [financeId, refYear, sequence, requestRef],
    );

    await conn.query(
      `UPDATE finance_request_ref_tracker
       SET last_sequence = ?
       WHERE ref_year = ?`,
      [sequence, refYear],
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

  // Resolve department ID from beneficiary_value if beneficiaryType is 'Department'
  if (beneficiaryType === 'Department' && normalizeText(financeData.beneficiary_value)) {
    const [departmentRows] = await conn.query(
      `SELECT id
         FROM master_departments
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         LIMIT 1`,
      [financeData.beneficiary_value],
    );

    if (departmentRows.length) {
      departmentId = toPositiveInt(departmentRows[0].id);
    }
  }

  const employeeId = toPositiveInt(financeData.employee_id);

  if (employeeId) {
    const [employeeRows] = await conn.query(
      `SELECT department_id, entity_id
         FROM master_employees
         WHERE id = ?
           AND status = 'Active'
         LIMIT 1`,
      [employeeId],
    );

    if (employeeRows.length) {
      // Fallback to employee's department_id ONLY if it wasn't already resolved (e.g. for non-Department beneficiary types)
      if (!departmentId) {
        departmentId = toPositiveInt(employeeRows[0].department_id);
      }
      beneficiaryEntityId = toPositiveInt(employeeRows[0].entity_id);
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
      [entityTypeCode, financeData.beneficiary_value],
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
};

const consumeBudgetForApprovedFinance = async (conn, financeId, actorUserId = null) => {
  const [alreadyConsumedRows] = await conn.query(
    `SELECT COUNT(*) AS count
     FROM finance_budget_usage_ledger
     WHERE finance_id = ?
       AND operation = 'consume'`,
    [financeId],
  );

  if (Number(alreadyConsumedRows?.[0]?.count || 0) > 0) {
    return;
  }

  const [financeRows] = await conn.query(
    'SELECT unplanned_budget_enabled, unplanned_budget_amount FROM finance_requests WHERE id = ? FOR UPDATE',
    [financeId],
  );

  const financeRequest = financeRows[0] || {};
  const unplannedBudgetEnabled = Boolean(financeRequest.unplanned_budget_enabled);
  const unplannedBudgetAmount = toMoney(financeRequest.unplanned_budget_amount);
  const [ownerRows] = await conn.query(
    `SELECT
       fr.created_by,
       u.email AS created_by_email,
       fr.beneficiary_type,
       fr.beneficiary_value,
       fr.department_id,
       fr.beneficiary_entity_id
     FROM finance_requests fr
     LEFT JOIN users u ON u.id = fr.created_by
     WHERE fr.id = ?
     LIMIT 1`,
    [financeId],
  );
  const ownerRecord = ownerRows[0] || {};
  const ownerUserId = toPositiveInt(ownerRecord.created_by);
  const ownerUserEmail = normalizeText(ownerRecord.created_by_email) || null;
  const ownerDepartmentId = toPositiveInt(ownerRecord.department_id);
  const ownerBeneficiaryEntityId = toPositiveInt(ownerRecord.beneficiary_entity_id);
  const ownerBeneficiaryType = normalizeText(ownerRecord.beneficiary_type) || null;
  const ownerBeneficiaryValue = normalizeText(ownerRecord.beneficiary_value) || null;

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
    [financeId],
  );

  let approvedTotalAmount = unplannedBudgetEnabled ? unplannedBudgetAmount : 0;
  let totalRemainingAmount = 0;

  for (const row of rows) {
    const budgetLineId = toPositiveInt(row.budget_line_id);
    const requestedAmount = toMoney(row.amount);

    if (requestedAmount <= 0) {
      throw new Error(
        `Requested amount must be greater than 0 for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`,
      );
    }

    if (!budgetLineId) {
      const lookupBudgetHead = normalizeText(row.budget_head);
      if (!lookupBudgetHead) {
        throw new Error(
          `Budget line mapping is missing for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`,
        );
      }

      const headLevelAvailability = await resolveBudgetAvailabilityForUser(conn, {
        userId: ownerUserId,
        userEmail: ownerUserEmail,
        budgetHead: lookupBudgetHead,
        subHead: normalizeSubHeadForLookup(row.sub_head),
        headOnlyMatch: true,
        excludeFinanceId: financeId,
        beneficiaryType: ownerBeneficiaryType,
        beneficiaryValue: ownerBeneficiaryValue,
        departmentId: ownerDepartmentId,
        beneficiaryEntityId: ownerBeneficiaryEntityId,
      });

      if (requestedAmount > headLevelAvailability.totalAvailable) {
        throw new Error(
          `Insufficient budget balance for "${lookupBudgetHead}". Requested ${requestedAmount.toFixed(2)}, available ${headLevelAvailability.totalAvailable.toFixed(2)}`,
        );
      }

      let remainingToConsume = requestedAmount;
      for (const match of headLevelAvailability.matches) {
        if (remainingToConsume <= 0) {
          break;
        }

        const candidateBudgetLineId = toPositiveInt(match.budgetLineId);
        if (!candidateBudgetLineId) {
          continue;
        }

        await conn.query(
          `INSERT IGNORE INTO finance_budget_line_usage (budget_line_id, consumed_amount)
           VALUES (?, 0.00)`,
          [candidateBudgetLineId],
        );

        const [usageRows] = await conn.query(
          `SELECT consumed_amount
           FROM finance_budget_line_usage
           WHERE budget_line_id = ?
           FOR UPDATE`,
          [candidateBudgetLineId],
        );

        const consumedAmount = toMoney(usageRows?.[0]?.consumed_amount);
        const lineBudgetAmount = toMoney(match.budgetLineAmount);
        const availableOnLine = Math.max(0, lineBudgetAmount - consumedAmount);
        if (availableOnLine <= 0) {
          continue;
        }

        const consumeAmount = Math.min(remainingToConsume, availableOnLine);
        const balanceAfter = consumedAmount + consumeAmount;

        await conn.query(
          `UPDATE finance_budget_line_usage
           SET consumed_amount = ?, updated_at = CURRENT_TIMESTAMP
           WHERE budget_line_id = ?`,
          [balanceAfter, candidateBudgetLineId],
        );

        await conn.query(
          `INSERT INTO finance_budget_usage_ledger
           (finance_id, finance_budget_breakup_id, budget_line_id, operation, amount, balance_after, actor_user_id, remarks)
           VALUES (?, ?, ?, 'consume', ?, ?, ?, ?)`,
          [
            financeId,
            row.id,
            candidateBudgetLineId,
            consumeAmount,
            balanceAfter,
            toPositiveInt(actorUserId),
            'Principal approval committed amount',
          ],
        );

        remainingToConsume = toMoney(remainingToConsume - consumeAmount);
      }

      if (remainingToConsume > 0) {
        throw new Error(
          `Insufficient budget balance for "${lookupBudgetHead}". Requested ${requestedAmount.toFixed(2)}, available ${headLevelAvailability.totalAvailable.toFixed(2)}`,
        );
      }

      const remainingAfter = Math.max(0, headLevelAvailability.totalAvailable - requestedAmount);

      await conn.query(
        `UPDATE finance_budget_breakup
         SET approved_amount = ?,
             remaining_amount_snapshot = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [requestedAmount, remainingAfter, row.id],
      );

      approvedTotalAmount += requestedAmount;
      totalRemainingAmount += remainingAfter;
      continue;
    }

    const budgetLine = await getBudgetLineAvailabilityById(conn, budgetLineId);
    if (!budgetLine) {
      throw new Error(
        `Budget line not found/approved for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`,
      );
    }

    await conn.query(
      `INSERT IGNORE INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)`,
      [budgetLineId],
    );

    const [usageRows] = await conn.query(
      `SELECT consumed_amount
       FROM finance_budget_line_usage
       WHERE budget_line_id = ?
       FOR UPDATE`,
      [budgetLineId],
    );

    const consumedAmount = toMoney(usageRows?.[0]?.consumed_amount);
    const availableAmount = Math.max(0, budgetLine.budgetLineAmount - consumedAmount);

    if (requestedAmount > availableAmount) {
      throw new Error(
        `Insufficient budget balance for "${budgetLine.budgetHead}" / "${budgetLine.subHead}". Requested ${requestedAmount.toFixed(2)}, available ${availableAmount.toFixed(2)}`,
      );
    }

    const balanceAfter = consumedAmount + requestedAmount;
    const remainingAfter = Math.max(0, budgetLine.budgetLineAmount - balanceAfter);

    await conn.query(
      `UPDATE finance_budget_line_usage
       SET consumed_amount = ?, updated_at = CURRENT_TIMESTAMP
       WHERE budget_line_id = ?`,
      [balanceAfter, budgetLineId],
    );

    await conn.query(
      `UPDATE finance_budget_breakup
       SET approved_amount = ?,
           remaining_amount_snapshot = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requestedAmount, remainingAfter, row.id],
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
      ],
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
    [approvedTotalAmount, totalRemainingAmount, financeId],
  );
};

const getFinanceBreakupTotal = async (conn, financeId) => {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_budget_breakup
     WHERE finance_id = ?`,
    [financeId],
  );
  return toMoney(rows?.[0]?.total);
};

const calculateApprovedFinanceTotalsSnapshot = async (conn, financeId, unplannedPayload = {}) => {
  const normalizedUnplanned = normalizeUnplannedBudgetPayload(unplannedPayload);
  const [rows] = await conn.query(
    `SELECT
       COALESCE(SUM(COALESCE(NULLIF(approved_amount, 0), amount, 0)), 0) AS approved_total,
       COALESCE(SUM(COALESCE(remaining_amount_snapshot, 0)), 0) AS balance_total
     FROM finance_budget_breakup
     WHERE finance_id = ?`,
    [financeId],
  );

  return {
    approvedTotalAmount: toMoney(toMoney(rows?.[0]?.approved_total) + normalizedUnplanned.amount),
    balanceAmount: toMoney(toMoney(rows?.[0]?.balance_total) + normalizedUnplanned.amount),
  };
};

const financeModel = {
  async createFinanceRequest(financeData, userId, userEmail = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });
      const hasUnplannedBudgetEnabledColumn = await hasFinanceRequestColumn(
        'unplanned_budget_enabled',
        { tx: connection },
      );
      const hasUnplannedBudgetAmountColumn = await hasFinanceRequestColumn(
        'unplanned_budget_amount',
        { tx: connection },
      );
      const hasUnplannedBudgetDescriptionColumn = await hasFinanceRequestColumn(
        'unplanned_budget_description',
        { tx: connection },
      );
      const hasAnnexureTypeColumn = await hasFinanceRequestColumn('annexure_type', {
        tx: connection,
      });
      const hasAnnexureFileNameColumn = await hasFinanceRequestColumn('annexure_file_name', {
        tx: connection,
      });
      const hasAnnexureStorageNameColumn = await hasFinanceRequestColumn('annexure_storage_name', {
        tx: connection,
      });
      const hasAnnexureFilePathColumn = await hasFinanceRequestColumn('annexure_file_path', {
        tx: connection,
      });
      const hasAnnexureMimeTypeColumn = await hasFinanceRequestColumn('annexure_mime_type', {
        tx: connection,
      });
      const hasAnnexureFileSizeColumn = await hasFinanceRequestColumn('annexure_file_size', {
        tx: connection,
      });
      const hasPrimaryHeadIdColumn = await hasFinanceRequestColumn('primary_head_id', {
        tx: connection,
      });
      const hasEventSubHeadIdColumn = await hasFinanceRequestColumn('event_sub_head_id', {
        tx: connection,
      });
      const hasPaymentDebitAccountColumn = await hasFinanceRequestColumn('payment_debit_account', {
        tx: connection,
      });

      const workflowContext = await resolveFinanceWorkflowContext(connection, financeData);
      const normalizedBudgetRows = normalizeBudgetRows(
        Array.isArray(financeData.budget_rows) ? financeData.budget_rows : [],
      );
      const budgetRows = await enrichBudgetRowsWithBudgetRefs(
        connection,
        userId,
        userEmail,
        normalizedBudgetRows,
        {
          beneficiaryType: financeData.beneficiary_type,
          beneficiaryValue: financeData.beneficiary_value,
          departmentId: workflowContext.departmentId,
          beneficiaryEntityId: workflowContext.beneficiaryEntityId,
          lookupBudgetHead: financeData.primary_head,
          lookupSubHead: financeData.event_sub_head,
        },
      );
      const incomeRows = normalizeIncomeRows(
        Array.isArray(financeData.income_rows) ? financeData.income_rows : [],
      );
      const normalizedAnnexures = await normalizeFinanceAnnexures(financeData.annexures);
      const primaryAnnexure = normalizedAnnexures[0] || null;
      const totalBudget = calculateFinanceTotalBudget(budgetRows, financeData);
      const normalizedUnplanned = normalizeUnplannedBudgetPayload(financeData);

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
      if (hasUnplannedBudgetEnabledColumn) {
        financeEntry.unplanned_budget_enabled = financeData.unplanned_budget_enabled ? 1 : 0;
      }
      if (hasUnplannedBudgetAmountColumn) {
        financeEntry.unplanned_budget_amount = normalizedUnplanned.enabled
          ? normalizedUnplanned.amount
          : null;
      }
      if (hasUnplannedBudgetDescriptionColumn) {
        financeEntry.unplanned_budget_description = normalizedUnplanned.enabled
          ? normalizeText(financeData.unplanned_budget_description) || null
          : null;
      }
      if (hasAnnexureTypeColumn) {
        financeEntry.annexure_type = primaryAnnexure
          ? primaryAnnexure.annexure_type || null
          : normalizeText(financeData.annexure_type) || null;
      }
      if (hasAnnexureFileNameColumn) {
        financeEntry.annexure_file_name = primaryAnnexure
          ? primaryAnnexure.original_name || primaryAnnexure.stored_name || null
          : normalizeText(financeData.annexure_file_name) || null;
      }
      if (hasAnnexureStorageNameColumn) {
        financeEntry.annexure_storage_name = primaryAnnexure
          ? primaryAnnexure.stored_name || null
          : normalizeText(financeData.annexure_storage_name) || null;
      }
      if (hasAnnexureFilePathColumn) {
        financeEntry.annexure_file_path = primaryAnnexure
          ? primaryAnnexure.file_path || null
          : normalizeText(financeData.annexure_file_path) || null;
      }
      if (hasAnnexureMimeTypeColumn) {
        financeEntry.annexure_mime_type = primaryAnnexure
          ? primaryAnnexure.mime_type || null
          : normalizeText(financeData.annexure_mime_type) || null;
      }
      if (hasAnnexureFileSizeColumn) {
        const parsedAnnexureSize = primaryAnnexure
          ? Number(primaryAnnexure.file_size)
          : Number(financeData.annexure_file_size);
        financeEntry.annexure_file_size = Number.isFinite(parsedAnnexureSize)
          ? parsedAnnexureSize
          : null;
      }
      if (hasPaymentDebitAccountColumn) {
        financeEntry.payment_debit_account =
          normalizeText(financeData.payment_debit_account) || null;
      }

      // NEW: resolve catalog IDs for primary_head + event_sub_head.
      // Stored alongside the snapshot text columns so matching survives
      // future catalog renames.
      // LEGACY: nulls when the submitted text isn't in the catalog —
      // downstream code falls back to normalized text matching.
      if (hasPrimaryHeadIdColumn || hasEventSubHeadIdColumn) {
        const { primary_head_id, event_sub_head_id } = await resolvePrimaryHeadIds(
          connection,
          financeEntry.primary_head,
          financeEntry.event_sub_head,
        );
        if (hasPrimaryHeadIdColumn) financeEntry.primary_head_id = primary_head_id;
        if (hasEventSubHeadIdColumn) financeEntry.event_sub_head_id = event_sub_head_id;
      }

      const [result] = await connection.query('INSERT INTO finance_requests SET ?', [financeEntry]);
      const referenceFiscalYear = resolveReferenceFiscalYearFromBudgetRows(
        budgetRows,
        financeData.request_date,
      );
      await insertFinanceRequestReference(
        connection,
        result.insertId,
        financeData.request_date,
        referenceFiscalYear,
      );
      await replaceBudgetRows(connection, result.insertId, budgetRows);
      await replaceIncomeRows(connection, result.insertId, incomeRows);
      await replaceFinanceAnnexures(connection, result.insertId, normalizedAnnexures);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async updateFinanceRequest(id, financeData, actor = null, { tx = null } = {}) {
    const connection = tx || (await db.getConnection());
    const ownsTransaction = !tx;

    try {
      if (ownsTransaction) {
        await connection.beginTransaction();
      }
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });
      const hasUnplannedBudgetEnabledColumn = await hasFinanceRequestColumn(
        'unplanned_budget_enabled',
        { tx: connection },
      );
      const hasUnplannedBudgetAmountColumn = await hasFinanceRequestColumn(
        'unplanned_budget_amount',
        { tx: connection },
      );
      const hasUnplannedBudgetDescriptionColumn = await hasFinanceRequestColumn(
        'unplanned_budget_description',
        { tx: connection },
      );
      const hasAnnexureTypeColumn = await hasFinanceRequestColumn('annexure_type', {
        tx: connection,
      });
      const hasAnnexureFileNameColumn = await hasFinanceRequestColumn('annexure_file_name', {
        tx: connection,
      });
      const hasAnnexureStorageNameColumn = await hasFinanceRequestColumn('annexure_storage_name', {
        tx: connection,
      });
      const hasAnnexureFilePathColumn = await hasFinanceRequestColumn('annexure_file_path', {
        tx: connection,
      });
      const hasAnnexureMimeTypeColumn = await hasFinanceRequestColumn('annexure_mime_type', {
        tx: connection,
      });
      const hasAnnexureFileSizeColumn = await hasFinanceRequestColumn('annexure_file_size', {
        tx: connection,
      });
      const hasPrimaryHeadIdColumn = await hasFinanceRequestColumn('primary_head_id', {
        tx: connection,
      });
      const hasEventSubHeadIdColumn = await hasFinanceRequestColumn('event_sub_head_id', {
        tx: connection,
      });
      const hasPaymentDebitAccountColumn = await hasFinanceRequestColumn('payment_debit_account', {
        tx: connection,
      });
      const budgetTagSelectSql = hasBudgetTagColumn ? 'fr.budget_tag' : 'NULL AS budget_tag';
      const unplannedBudgetEnabledSelectSql = hasUnplannedBudgetEnabledColumn
        ? 'fr.unplanned_budget_enabled'
        : 'NULL AS unplanned_budget_enabled';
      const unplannedBudgetAmountSelectSql = hasUnplannedBudgetAmountColumn
        ? 'fr.unplanned_budget_amount'
        : 'NULL AS unplanned_budget_amount';
      const unplannedBudgetDescriptionSelectSql = hasUnplannedBudgetDescriptionColumn
        ? 'fr.unplanned_budget_description'
        : 'NULL AS unplanned_budget_description';
      const annexureTypeSelectSql = hasAnnexureTypeColumn
        ? 'fr.annexure_type'
        : 'NULL AS annexure_type';
      const annexureFileNameSelectSql = hasAnnexureFileNameColumn
        ? 'fr.annexure_file_name'
        : 'NULL AS annexure_file_name';
      const annexureStorageNameSelectSql = hasAnnexureStorageNameColumn
        ? 'fr.annexure_storage_name'
        : 'NULL AS annexure_storage_name';
      const annexureFilePathSelectSql = hasAnnexureFilePathColumn
        ? 'fr.annexure_file_path'
        : 'NULL AS annexure_file_path';
      const annexureMimeTypeSelectSql = hasAnnexureMimeTypeColumn
        ? 'fr.annexure_mime_type'
        : 'NULL AS annexure_mime_type';
      const annexureFileSizeSelectSql = hasAnnexureFileSizeColumn
        ? 'fr.annexure_file_size'
        : 'NULL AS annexure_file_size';
      const paymentDebitAccountSelectSql = hasPaymentDebitAccountColumn
        ? 'fr.payment_debit_account'
        : 'NULL AS payment_debit_account';

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
           ${unplannedBudgetEnabledSelectSql},
           ${unplannedBudgetAmountSelectSql},
           ${unplannedBudgetDescriptionSelectSql},
           ${annexureTypeSelectSql},
           ${annexureFileNameSelectSql},
           ${annexureStorageNameSelectSql},
           ${annexureFilePathSelectSql},
           ${annexureMimeTypeSelectSql},
           ${annexureFileSizeSelectSql},
           fr.total_budget,
           fr.approved_total_amount,
           fr.income_type,
           fr.income_status,
           fr.income_amount_type,
           fr.credit_status,
           fr.debit_status,
           ${paymentDebitAccountSelectSql},
           fr.partial_amount,
           u.email AS created_by_email
         FROM finance_requests fr
         LEFT JOIN users u ON u.id = fr.created_by
         WHERE fr.id = ?
         LIMIT 1`,
        [id],
      );

      if (!existingRows.length) {
        if (ownsTransaction) {
          await connection.rollback();
        }
        return { affectedRows: 0 };
      }

      const existingRecord = existingRows[0];
      const mergedRecordForContext = {
        employee_id: financeData.employee_id ?? existingRecord.employee_id,
        beneficiary_type: financeData.beneficiary_type ?? existingRecord.beneficiary_type,
        beneficiary_value: financeData.beneficiary_value ?? existingRecord.beneficiary_value,
        primary_head: financeData.primary_head ?? existingRecord.primary_head,
        event_sub_head: financeData.event_sub_head ?? existingRecord.event_sub_head,
      };
      const workflowContext = await resolveFinanceWorkflowContext(
        connection,
        mergedRecordForContext,
      );
      const hasBudgetRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'budget_rows');
      const hasIncomeRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'income_rows');
      const hasAnnexuresInput = Object.prototype.hasOwnProperty.call(financeData, 'annexures');
      const isTopupModeInput = Boolean(
        parseBooleanLike(financeData.topup_mode || financeData.topupMode),
      );
      const normalizedBudgetRows = hasBudgetRowsInput
        ? normalizeBudgetRows(Array.isArray(financeData.budget_rows) ? financeData.budget_rows : [])
        : [];
      const budgetRows = hasBudgetRowsInput
        ? await enrichBudgetRowsWithBudgetRefs(
            connection,
            toPositiveInt(existingRecord.created_by),
            normalizeText(existingRecord.created_by_email) || null,
            normalizedBudgetRows,
            {
              excludeFinanceId: id,
              beneficiaryType: mergedRecordForContext.beneficiary_type,
              beneficiaryValue: mergedRecordForContext.beneficiary_value,
              departmentId: workflowContext.departmentId,
              beneficiaryEntityId: workflowContext.beneficiaryEntityId,
              lookupBudgetHead: mergedRecordForContext.primary_head,
              lookupSubHead: mergedRecordForContext.event_sub_head,
            },
          )
        : [];
      const incomeRows = hasIncomeRowsInput
        ? normalizeIncomeRows(Array.isArray(financeData.income_rows) ? financeData.income_rows : [])
        : [];
      const annexures = hasAnnexuresInput
        ? await normalizeFinanceAnnexures(
            Array.isArray(financeData.annexures) ? financeData.annexures : [],
          )
        : [];
      const previousAnnexures = hasAnnexuresInput
        ? await getFinanceAnnexures(id, { tx: connection })
        : [];
      const [previousBudgetRows] = hasBudgetRowsInput
        ? await connection.query(
            `SELECT budget_head, sub_head, amount
               FROM finance_budget_breakup
               WHERE finance_id = ?
               ORDER BY sort_order ASC, id ASC`,
            [id],
          )
        : [[]];
      const [previousIncomeRows] = hasIncomeRowsInput
        ? await connection.query(
            `SELECT income_source, contribution, amount, status, remarks, credit_account
               FROM finance_income_rows
               WHERE finance_id = ?
               ORDER BY sort_order ASC, id ASC`,
            [id],
          )
        : [[]];
      const updateData = Object.fromEntries(
        Object.entries(financeData)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value === '' ? null : value]),
      );
      delete updateData.budget_rows;
      delete updateData.income_rows;
      delete updateData.annexures;
      delete updateData.topup_mode;
      delete updateData.topupMode;
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
      if (Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled')) {
        if (hasUnplannedBudgetEnabledColumn) {
          updateData.unplanned_budget_enabled = updateData.unplanned_budget_enabled ? 1 : 0;
        } else {
          delete updateData.unplanned_budget_enabled;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount')) {
        if (hasUnplannedBudgetAmountColumn) {
          const normalizedUnplanned = normalizeUnplannedBudgetPayload({
            unplanned_budget_enabled: Object.prototype.hasOwnProperty.call(
              updateData,
              'unplanned_budget_enabled',
            )
              ? updateData.unplanned_budget_enabled
              : existingRecord.unplanned_budget_enabled,
            unplanned_budget_amount: updateData.unplanned_budget_amount,
          });
          updateData.unplanned_budget_amount = normalizedUnplanned.enabled
            ? normalizedUnplanned.amount
            : null;
        } else {
          delete updateData.unplanned_budget_amount;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_description')) {
        if (hasUnplannedBudgetDescriptionColumn) {
          updateData.unplanned_budget_description =
            normalizeText(updateData.unplanned_budget_description) || null;
        } else {
          delete updateData.unplanned_budget_description;
        }
      }
      if (
        hasUnplannedBudgetAmountColumn &&
        Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled') &&
        !updateData.unplanned_budget_enabled
      ) {
        updateData.unplanned_budget_amount = null;
        if (hasUnplannedBudgetDescriptionColumn) {
          updateData.unplanned_budget_description = null;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_type')) {
        if (hasAnnexureTypeColumn) {
          updateData.annexure_type = normalizeText(updateData.annexure_type) || null;
        } else {
          delete updateData.annexure_type;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_file_name')) {
        if (hasAnnexureFileNameColumn) {
          updateData.annexure_file_name = normalizeText(updateData.annexure_file_name) || null;
        } else {
          delete updateData.annexure_file_name;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_storage_name')) {
        if (hasAnnexureStorageNameColumn) {
          updateData.annexure_storage_name =
            normalizeText(updateData.annexure_storage_name) || null;
        } else {
          delete updateData.annexure_storage_name;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_file_path')) {
        if (hasAnnexureFilePathColumn) {
          updateData.annexure_file_path = normalizeText(updateData.annexure_file_path) || null;
        } else {
          delete updateData.annexure_file_path;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_mime_type')) {
        if (hasAnnexureMimeTypeColumn) {
          updateData.annexure_mime_type = normalizeText(updateData.annexure_mime_type) || null;
        } else {
          delete updateData.annexure_mime_type;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'annexure_file_size')) {
        if (hasAnnexureFileSizeColumn) {
          const parsedAnnexureSize = Number(updateData.annexure_file_size);
          updateData.annexure_file_size = Number.isFinite(parsedAnnexureSize)
            ? parsedAnnexureSize
            : null;
        } else {
          delete updateData.annexure_file_size;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'payment_debit_account')) {
        if (hasPaymentDebitAccountColumn) {
          updateData.payment_debit_account =
            normalizeText(updateData.payment_debit_account) || null;
        } else {
          delete updateData.payment_debit_account;
        }
      }

      if (hasAnnexuresInput) {
        const firstAnnexure = annexures[0] || null;
        if (hasAnnexureTypeColumn) {
          updateData.annexure_type = firstAnnexure
            ? firstAnnexure.annexure_type || null
            : normalizeText(updateData.annexure_type) || null;
        }
        if (hasAnnexureFileNameColumn) {
          updateData.annexure_file_name = firstAnnexure
            ? firstAnnexure.original_name || firstAnnexure.stored_name || null
            : null;
        }
        if (hasAnnexureStorageNameColumn) {
          updateData.annexure_storage_name = firstAnnexure
            ? firstAnnexure.stored_name || null
            : null;
        }
        if (hasAnnexureFilePathColumn) {
          updateData.annexure_file_path = firstAnnexure ? firstAnnexure.file_path || null : null;
        }
        if (hasAnnexureMimeTypeColumn) {
          updateData.annexure_mime_type = firstAnnexure ? firstAnnexure.mime_type || null : null;
        }
        if (hasAnnexureFileSizeColumn) {
          const firstSize = firstAnnexure ? Number(firstAnnexure.file_size) : NaN;
          updateData.annexure_file_size = Number.isFinite(firstSize) ? firstSize : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'beneficiary_type')) {
        updateData.beneficiary_type = normalizeBeneficiaryTypeForStorage(
          updateData.beneficiary_type,
        );
      }

      updateData.department_id = workflowContext.departmentId;
      updateData.beneficiary_entity_id = workflowContext.beneficiaryEntityId;

      if (hasBudgetRowsInput) {
        await replaceBudgetRows(connection, id, budgetRows);
        const totalBudget = calculateFinanceTotalBudget(budgetRows, {
          unplanned_budget_enabled: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_enabled',
          )
            ? updateData.unplanned_budget_enabled
            : existingRecord.unplanned_budget_enabled,
          unplanned_budget_amount: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_amount',
          )
            ? updateData.unplanned_budget_amount
            : existingRecord.unplanned_budget_amount,
        });
        updateData.total_budget = totalBudget;
      } else if (
        Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled') ||
        Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount')
      ) {
        const plannedTotal = await getFinanceBreakupTotal(connection, id);
        const totalBudget = calculateFinanceTotalBudget([{ amount: plannedTotal }], {
          unplanned_budget_enabled: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_enabled',
          )
            ? updateData.unplanned_budget_enabled
            : existingRecord.unplanned_budget_enabled,
          unplanned_budget_amount: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_amount',
          )
            ? updateData.unplanned_budget_amount
            : existingRecord.unplanned_budget_amount,
        });
        updateData.total_budget = totalBudget;
      }

      const shouldRecalculateApprovedTotals =
        toMoney(existingRecord.approved_total_amount) > 0 &&
        !isTopupModeInput &&
        (hasBudgetRowsInput ||
          Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled') ||
          Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount'));
      if (shouldRecalculateApprovedTotals) {
        const approvedTotals = await calculateApprovedFinanceTotalsSnapshot(connection, id, {
          unplanned_budget_enabled: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_enabled',
          )
            ? updateData.unplanned_budget_enabled
            : existingRecord.unplanned_budget_enabled,
          unplanned_budget_amount: Object.prototype.hasOwnProperty.call(
            updateData,
            'unplanned_budget_amount',
          )
            ? updateData.unplanned_budget_amount
            : existingRecord.unplanned_budget_amount,
        });
        updateData.approved_total_amount = approvedTotals.approvedTotalAmount;
        updateData.balance_amount = approvedTotals.balanceAmount;
      }

      if (hasIncomeRowsInput) {
        await replaceIncomeRows(connection, id, incomeRows);
      }
      if (hasAnnexuresInput) {
        await replaceFinanceAnnexures(connection, id, annexures);
      }

      // NEW: keep primary_head_id / event_sub_head_id in sync with the
      // snapshot text when an edit changes the head/sub-head.
      if (
        (hasPrimaryHeadIdColumn || hasEventSubHeadIdColumn) &&
        (Object.prototype.hasOwnProperty.call(updateData, 'primary_head') ||
          Object.prototype.hasOwnProperty.call(updateData, 'event_sub_head'))
      ) {
        const headName = Object.prototype.hasOwnProperty.call(updateData, 'primary_head')
          ? updateData.primary_head
          : existingRecord.primary_head;
        const subName = Object.prototype.hasOwnProperty.call(updateData, 'event_sub_head')
          ? updateData.event_sub_head
          : existingRecord.event_sub_head;
        const { primary_head_id, event_sub_head_id } = await resolvePrimaryHeadIds(
          connection,
          headName,
          subName,
        );
        if (hasPrimaryHeadIdColumn) updateData.primary_head_id = primary_head_id;
        if (hasEventSubHeadIdColumn) updateData.event_sub_head_id = event_sub_head_id;
      }

      const [result] = await connection.query('UPDATE finance_requests SET ? WHERE id = ?', [
        updateData,
        id,
      ]);

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
          remarks: normalizeText(row.remarks),
          credit_account: normalizeText(row.credit_account),
        }));
        const nextIncomeSnapshot = incomeRows.map((row) => ({
          income_source: normalizeText(row.income_source),
          contribution: normalizeText(row.contribution),
          amount: toMoney(row.amount),
          status: normalizeText(row.status),
          remarks: normalizeText(row.remarks),
          credit_account: normalizeText(row.credit_account),
        }));

        const audit = buildFinanceUpdateAudit({
          previousRecord: existingRecord,
          updateData,
          budgetRowsInput: hasBudgetRowsInput ? budgetRows : null,
          incomeRowsInput: hasIncomeRowsInput ? incomeRows : null,
          budgetRowsChanged:
            hasBudgetRowsInput &&
            JSON.stringify(previousBudgetSnapshot) !== JSON.stringify(nextBudgetSnapshot),
          incomeRowsChanged:
            hasIncomeRowsInput &&
            JSON.stringify(previousIncomeSnapshot) !== JSON.stringify(nextIncomeSnapshot),
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
            actor?.isSuperAdmin ||
            ['admin', 'super_admin', 'superadmin'].includes(
              normalizeText(actor?.role).toLowerCase(),
            )
              ? 1
              : 0,
            audit.summary,
            JSON.stringify(audit.details),
          ],
        );
      } catch (auditError) {
        if (auditError?.code !== 'ER_NO_SUCH_TABLE') {
          throw auditError;
        }
      }

      if (ownsTransaction) {
        await connection.commit();
      }

      if (ownsTransaction && hasAnnexuresInput) {
        const previousStoredNames = new Set(
          [
            ...previousAnnexures.map((row) => normalizeText(row?.stored_name)),
            normalizeText(existingRecord?.annexure_storage_name),
          ].filter(Boolean),
        );
        const nextStoredNames = new Set(
          annexures.map((row) => normalizeText(row?.stored_name)).filter(Boolean),
        );

        const removedStoredNames = Array.from(previousStoredNames).filter(
          (storedName) => !nextStoredNames.has(storedName),
        );

        await cleanupOrphanFinanceAnnexureFiles(removedStoredNames);
      }

      return {
        ...result,
        affectedRows:
          result.affectedRows ||
          (hasBudgetRowsInput || hasIncomeRowsInput || hasAnnexuresInput ? 1 : 0),
      };
    } catch (error) {
      if (ownsTransaction) {
        await connection.rollback();
      }
      throw new Error(`Error updating finance request: ${error.message}`);
    } finally {
      if (ownsTransaction) {
        connection.release();
      }
    }
  },

  async getFinanceRequestById(id) {
    try {
      const financeSelectSql = await getFinanceSelectSql();
      const [rows] = await db.query(
        `${financeSelectSql}
         WHERE fr.id = ?
           AND ${FINANCE_NOT_DELETED_CONDITION_SQL}
         LIMIT 1`,
        ['', '', id],
      );

      if (!rows.length) return null;

      const finance = rows[0];
      finance.enclosures = safeParseJSON(finance.enclosures, []);
      finance.workflow_state = normalizeWorkflowState(finance.workflow_state);
      finance.level1_route_type = resolveFinanceLevel1RouteType(finance);
      const annexures = await getFinanceAnnexures(id);
      finance.annexures = annexures.length ? annexures : getLegacyAnnexureFromRecord(finance);
      finance.principal_document = await getFinancePrincipalDocumentByFinanceId(id);

      return finance;
    } catch (error) {
      throw new Error(`Error fetching finance request: ${error.message}`);
    }
  },

  async listFinanceRequests({ userId, mine, status }) {
    try {
      const financeSelectSql = await getFinanceSelectSql();
      let query = `${financeSelectSql} WHERE 1 = 1`;
      const params = ['', ''];

      query += ` AND ${FINANCE_NOT_DELETED_CONDITION_SQL}`;

      if (mine) {
        query += ` AND (
          fr.created_by = ?
          OR EXISTS (
            SELECT 1
              FROM master_employees me_owner
             WHERE me_owner.id = fr.employee_id
               AND me_owner.user_id = ?
          )
        )`;
        params.push(userId, userId);
      }

      if (status) {
        query += ' AND fr.overall_status = ?';
        params.push(status);
      }

      query += ' ORDER BY fr.created_at DESC';

      const [rows] = await db.query(query, params);
      const principalDocuments = await getFinancePrincipalDocumentsByFinanceIds(
        rows.map((row) => row.id),
      );

      return rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
        level1_route_type: resolveFinanceLevel1RouteType(row),
        annexures: getLegacyAnnexureFromRecord(row),
        principal_document: principalDocuments.get(toPositiveInt(row.id)) || null,
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
        `SELECT
           fr.created_by,
           u.email AS created_by_email,
           fr.beneficiary_type,
           fr.beneficiary_value,
           fr.department_id,
           fr.beneficiary_entity_id,
           fr.primary_head,
           fr.event_sub_head
         FROM finance_requests fr
         LEFT JOIN users u ON u.id = fr.created_by
         WHERE fr.id = ?
         LIMIT 1`,
        [financeId],
      );

      if (!ownerRows.length) {
        throw new Error('Finance request not found');
      }

      const normalizedRows = normalizeBudgetRows(Array.isArray(budgetRows) ? budgetRows : []);
      const enrichedRows = await enrichBudgetRowsWithBudgetRefs(
        connection,
        toPositiveInt(ownerRows[0].created_by),
        normalizeText(ownerRows[0].created_by_email) || null,
        normalizedRows,
        {
          excludeFinanceId: financeId,
          beneficiaryType: ownerRows[0].beneficiary_type,
          beneficiaryValue: ownerRows[0].beneficiary_value,
          departmentId: toPositiveInt(ownerRows[0].department_id),
          beneficiaryEntityId: toPositiveInt(ownerRows[0].beneficiary_entity_id),
          lookupBudgetHead: ownerRows[0].primary_head,
          lookupSubHead: ownerRows[0].event_sub_head,
        },
      );
      await replaceBudgetRows(connection, financeId, enrichedRows);
      const [financeRows] = await connection.query(
        `SELECT unplanned_budget_enabled, unplanned_budget_amount
         FROM finance_requests
         WHERE id = ?
         LIMIT 1`,
        [financeId],
      );
      const financeRow = financeRows[0] || {};
      const totalBudget = calculateFinanceTotalBudget(enrichedRows, {
        unplanned_budget_enabled: financeRow.unplanned_budget_enabled,
        unplanned_budget_amount: financeRow.unplanned_budget_amount,
      });

      await connection.query('UPDATE finance_requests SET total_budget = ? WHERE id = ?', [
        totalBudget,
        financeId,
      ]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error adding budget breakup: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getBudgetBreakup(financeId, { tx = db } = {}) {
    try {
      const hasBudgetProposalIdColumn = await hasFinanceBudgetBreakupColumn('budget_proposal_id', {
        tx,
      });
      const hasApprovedAmountColumn = await hasFinanceBudgetBreakupColumn('approved_amount', {
        tx,
      });
      const hasRemainingAmountSnapshotColumn = await hasFinanceBudgetBreakupColumn(
        'remaining_amount_snapshot',
        { tx },
      );
      const hasIsTopupColumn = await hasFinanceBudgetBreakupColumn('is_topup', { tx });
      const budgetProposalSelectSql = hasBudgetProposalIdColumn
        ? 'budget_proposal_id'
        : 'NULL AS budget_proposal_id';
      const approvedAmountSelectSql = hasApprovedAmountColumn
        ? 'approved_amount'
        : 'NULL AS approved_amount';
      const remainingAmountSnapshotSelectSql = hasRemainingAmountSnapshotColumn
        ? 'remaining_amount_snapshot'
        : 'NULL AS remaining_amount_snapshot';
      const isTopupSelectSql = hasIsTopupColumn ? 'is_topup' : '0 AS is_topup';

      const [rows] = await tx.query(
        `SELECT
           id,
           finance_id,
           ${budgetProposalSelectSql},
           budget_line_id,
           budget_head,
           sub_head,
           amount,
           ${approvedAmountSelectSql},
           available_amount_snapshot,
           ${remainingAmountSnapshotSelectSql},
           sort_order,
           ${isTopupSelectSql},
           created_at
         FROM finance_budget_breakup
         WHERE finance_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [financeId],
      );
      return rows;
    } catch (error) {
      throw new Error(`Error fetching budget breakup: ${error.message}`);
    }
  },

  async getIncomeRows(financeId) {
    try {
      const hasRemarksColumn = await hasFinanceIncomeRowsColumn('remarks');
      const remarksSelectSql = hasRemarksColumn ? 'remarks' : 'NULL AS remarks';
      const [rows] = await db.query(
        `SELECT
           id,
           finance_id,
           income_source,
           contribution,
           amount,
           status,
           ${remarksSelectSql},
           credit_account,
           sort_order,
           created_at
         FROM finance_income_rows
         WHERE finance_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [financeId],
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
      const [requestRows] = await db.query(
        `SELECT
          fr.id AS finance_id,
          fr.created_by AS user_id,
          fr.created_at,
          COALESCE(
            NULLIF(
              TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))),
              ''
            ),
            NULLIF(TRIM(fr.applicant_name), ''),
            u.name,
            fr.email
          ) AS user_name,
          COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(fr.email), '')) AS actor_email
         FROM finance_requests fr
         LEFT JOIN users u ON u.id = fr.created_by
         LEFT JOIN master_employees emp
           ON emp.email COLLATE utf8mb4_unicode_ci =
              COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(fr.email), '')) COLLATE utf8mb4_unicode_ci
         WHERE fr.id = ?
         LIMIT 1`,
        [financeId],
      );

      const submissionRows = requestRows.map((row) => ({
        id: -Number(financeId),
        finance_id: row.finance_id,
        user_id: row.user_id,
        role: 'submitted',
        stage: 'submitted',
        status: 'submitted',
        decision: 'submitted',
        comment: 'Initial finance request submitted',
        feedback: 'Initial finance request submitted',
        created_at: row.created_at,
        decided_at: row.created_at,
        user_name: row.user_name,
        actor_email: row.actor_email,
        actor_role: 'user',
        snapshot_before: null,
        meta: null,
        details: null,
      }));

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
        [financeId],
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
          [financeId],
        );
        editRows = rows;
      } catch (error) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') {
          throw error;
        }
      }

      const merged = [...submissionRows, ...workflowRows, ...editRows].sort((left, right) => {
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
          AND ${FINANCE_NOT_DELETED_CONDITION_SQL}
        LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  },

  async hardDeleteFinanceRequest(id) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM finance_request_refs WHERE finance_request_id = ?', [id]);
      await connection.query('DELETE FROM finance_budget_breakup WHERE finance_id = ?', [id]);
      await connection.query('DELETE FROM finance_income_rows WHERE finance_id = ?', [id]);
      await connection.query('DELETE FROM finance_request_annexures WHERE finance_id = ?', [id]);
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
        [id],
      );

      if (!rows.length) {
        await connection.rollback();
        return false;
      }

      const previousState = normalizeWorkflowState(rows[0].workflow_state) || {
        flow: ['level1', 'dof', 'principal', 'chairman'],
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
        flow:
          Array.isArray(previousState.flow) && previousState.flow.length
            ? previousState.flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
            : ['level1', 'dof', 'principal', 'chairman'],
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

      const canUseDeletedOverallStatus = await supportsFinanceOverallStatusDeletedValue({
        tx: connection,
      });
      const nextOverallStatus = canUseDeletedOverallStatus ? 'deleted' : 'archived';

      await connection.query(
        `UPDATE finance_requests
            SET workflow_state = ?,
                overall_status = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [JSON.stringify(nextState), nextOverallStatus, id],
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
          'deleted',
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
        ],
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
        [email],
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
           AND is_deleted = 0
         ORDER BY tag_name ASC`,
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
    excludeFinanceId = null,
    beneficiaryType = null,
    beneficiaryValue = null,
    departmentId = null,
    beneficiaryEntityId = null,
    fiscalYear = null,
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
        excludeFinanceId,
        beneficiaryType,
        beneficiaryValue,
        departmentId,
        beneficiaryEntityId,
        fiscalYear,
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
          COALESCE(d.name, ent.name) AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_entities ent ON e.entity_id = ent.id
        WHERE e.status = 'Active'
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;
      } else {
        sql = `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          COALESCE(d.name, ent.name) AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_entities ent ON e.entity_id = ent.id
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
         COALESCE(fr.department_id, scope_dept.id) AS department_id,
         fr.total_budget,
         fr.workflow_state
       FROM finance_requests fr
       LEFT JOIN master_departments scope_dept
         ON LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) = 'department'
        AND LOWER(TRIM(CONVERT(scope_dept.name USING utf8mb4) COLLATE utf8mb4_unicode_ci))
          = LOWER(TRIM(CONVERT(fr.beneficiary_value USING utf8mb4) COLLATE utf8mb4_unicode_ci))
       WHERE fr.id = ?${lockClause}`,
      [normalizedRecordId],
    );

    if (!rows.length) {
      return null;
    }

    const row = rows[0];
    const workflowState = normalizeWorkflowState(row.workflow_state);

    return {
      beneficiaryType: normalizeBeneficiaryType(row.beneficiary_type),
      beneficiaryEntityId: toPositiveInt(row.beneficiary_entity_id),
      departmentId: toPositiveInt(row.department_id),
      totalBudget: toMoney(row.total_budget),
      applicantUserId: toPositiveInt(row.created_by),
      workflowState,
      workflowStatus: normalizeWorkflowStatus(workflowState),
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
      [normalizedRecordId],
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
      [workflowStatePayload, overallStatus, normalizedRecordId],
    );

    if (result.affectedRows > 0 && previousStatus !== 'completed' && nextStatus === 'completed') {
      const [actorRows] = await tx.query(
        `SELECT actor_user_id
         FROM workflow_actions
         WHERE module_key = 'finance'
           AND record_id = ?
         ORDER BY decided_at DESC, id DESC
         LIMIT 1`,
        [normalizedRecordId],
      );
      const actorUserId = toPositiveInt(actorRows?.[0]?.actor_user_id);
      await consumeBudgetForApprovedFinance(tx, normalizedRecordId, actorUserId);
    }

    return result.affectedRows > 0;
  },

  async forceWorkflowTransition(
    recordId,
    { decision, feedback = null, actor = {}, stageHint = null } = {},
    { tx = db } = {},
  ) {
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
      [normalizedRecordId],
    );

    if (!rows.length) {
      throw new Error('Finance request not found');
    }

    const previousState = normalizeWorkflowState(rows[0].workflow_state);
    if (!previousState) {
      throw new Error('Workflow state not found');
    }

    const flow =
      Array.isArray(previousState.flow) && previousState.flow.length
        ? previousState.flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
        : ['level1', 'dof', 'principal', 'chairman'];
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
            route:
              normalizedDecision === 'archived'
                ? 'PATCH /api/finance-requests/:id/archive-toggle'
                : 'PATCH /api/finance-requests/:id/approval',
          },
        }),
      ],
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
      [normalizedRecordId],
    );

    if (!rows.length) {
      return { restored: false, reason: 'No archived snapshot found' };
    }

    const previousState = safeParseJSON(rows[0].snapshot_before, null);
    if (!previousState) {
      return { restored: false, reason: 'Archived snapshot is not restorable' };
    }

    const updated = await this.updateFinanceWorkflowSnapshot(normalizedRecordId, previousState, {
      tx,
    });

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
      [normalizedRecordId],
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
    const isAllProposals = isSuperAdmin && Boolean(filters.allProposals);
    const statusStageScope = isAllProposals ? 'all' : normalizedStage;
    const level1Role = normalizeText(filters.level1Role).toLowerCase();
    const requestedStatusCategory = normalizeText(filters.statusCategory).toLowerCase();
    const statusCategoryFilter = [
      'pending',
      'approved',
      'returned',
      'rejected',
      'archived',
    ].includes(requestedStatusCategory)
      ? requestedStatusCategory
      : '';
    const searchTerm = normalizeText(filters.q || filters.search);
    const fiscalYear = toPositiveInt(filters.fiscalYear || filters.fiscal_year);

    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const whereParts = [];
    const whereParams = [];

    whereParts.push(FINANCE_NOT_DELETED_CONDITION_SQL);

    if (fiscalYear) {
      whereParts.push(`(
        EXISTS (
          SELECT 1
            FROM finance_budget_breakup fbb_fy
            JOIN budget_proposals bp_fy ON bp_fy.id = fbb_fy.budget_proposal_id
           WHERE fbb_fy.finance_id = fr.id
             AND bp_fy.fiscal_year = ?
        )
        OR EXISTS (
          SELECT 1
            FROM finance_carry_forward_allocations cf_fy
           WHERE cf_fy.finance_request_id = fr.id
             AND cf_fy.target_fiscal_year = ?
             AND LOWER(TRIM(cf_fy.status)) = 'active'
        )
        OR (
          NOT EXISTS (
            SELECT 1
              FROM finance_budget_breakup fbb_any
             WHERE fbb_any.finance_id = fr.id
          )
          AND (
            YEAR(COALESCE(fr.request_date, fr.created_at))
              - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
          ) = ?
        )
      )`);
      whereParams.push(fiscalYear, fiscalYear, fiscalYear);
    }

    if (workflowStatus === 'all') {
      if (isAllProposals) {
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
          )`,
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
        const departmentIds = Array.from(scopeFilters.departmentIds || [])
          .map((id) => toPositiveInt(id))
          .filter(Boolean);
        if (scopeFilters.forceEmpty || departmentIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push(`COALESCE(
          fr.department_id,
          (
            SELECT md_scope.id
             FROM master_departments md_scope
             WHERE LOWER(TRIM(COALESCE(fr.beneficiary_type, ''))) = 'department'
               AND LOWER(TRIM(CONVERT(md_scope.name USING utf8mb4) COLLATE utf8mb4_unicode_ci))
                 = LOWER(TRIM(CONVERT(fr.beneficiary_value USING utf8mb4) COLLATE utf8mb4_unicode_ci))
             LIMIT 1
          )
        ) IN (?)`);
        whereParams.push(departmentIds);
      }

      if (scopeFilters.scopeType === 'entity') {
        const entityIds = Array.from(scopeFilters.entityIds || [])
          .map((id) => toPositiveInt(id))
          .filter(Boolean);
        if (scopeFilters.forceEmpty || entityIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push('fr.beneficiary_entity_id IN (?)');
        whereParams.push(entityIds);
      }
    }

    if (searchTerm) {
      const searchLike = `%${searchTerm}%`;
      whereParts.push(
        `(
          LOWER(${QUEUE_DISPLAY_REF_SQL_EXPR}) LIKE LOWER(?)
          OR LOWER(REPLACE(${QUEUE_DISPLAY_REF_SQL_EXPR}, '#', '')) LIKE LOWER(?)
          OR LOWER(COALESCE(fr.applicant_name, '')) LIKE LOWER(?)
          OR EXISTS (
            SELECT 1
              FROM master_employees e_search
             WHERE e_search.id = fr.employee_id
               AND LOWER(CONCAT_WS(' ',
                 e_search.title,
                 e_search.first_name,
                 e_search.last_name,
                 e_search.erp_id,
                 e_search.email
               )) LIKE LOWER(?)
          )
          OR LOWER(COALESCE(fr.beneficiary_type, '')) LIKE LOWER(?)
          OR LOWER(COALESCE(fr.beneficiary_value, '')) LIKE LOWER(?)
          OR LOWER(COALESCE(fr.primary_head, '')) LIKE LOWER(?)
          OR LOWER(COALESCE(fr.event_sub_head, '')) LIKE LOWER(?)
          OR LOWER(COALESCE(fr.description, '')) LIKE LOWER(?)
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
              WHERE wa_latest.module_key = 'finance'
                AND wa_latest.record_id = fr.id
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
         FROM finance_requests fr
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
             WHEN (? = 'all' OR workflow_stage = ?)
               AND workflow_stage IN ('level1', 'dof', 'principal', 'chairman')
               AND workflow_status NOT IN ('completed', 'rejected', 'returned', 'archived', 'deleted')
               THEN 'pending'
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
                WHERE wa.module_key = 'finance'
                  AND wa.record_id = fr.id
                  AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
                ORDER BY wa.decided_at DESC, wa.id DESC
                LIMIT 1
             ), '') AS workflow_stage_decision,
             LOWER(CONCAT_WS(' ',
               ${WORKFLOW_STATUS_SQL_EXPR},
               ${WORKFLOW_STAGE_SQL_EXPR},
               COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
             )) AS combined_status
           FROM finance_requests fr
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
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
          )) LIKE '%archive%' THEN 'archived'
          WHEN LOWER(CONCAT_WS(' ',
            ${WORKFLOW_STATUS_SQL_EXPR},
            ${WORKFLOW_STAGE_SQL_EXPR},
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
          )) LIKE '%rejected%' THEN 'rejected'
          WHEN LOWER(CONCAT_WS(' ',
            ${WORKFLOW_STATUS_SQL_EXPR},
            ${WORKFLOW_STAGE_SQL_EXPR},
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
          )) LIKE '%returned%' OR LOWER(CONCAT_WS(' ',
            ${WORKFLOW_STATUS_SQL_EXPR},
            ${WORKFLOW_STAGE_SQL_EXPR},
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
          )) LIKE '%return%' THEN 'returned'
          WHEN (? = 'all' OR ${WORKFLOW_STAGE_SQL_EXPR} = ?)
            AND ${WORKFLOW_STAGE_SQL_EXPR} IN ('level1', 'dof', 'principal', 'chairman')
            AND ${WORKFLOW_STATUS_SQL_EXPR} NOT IN ('completed', 'rejected', 'returned', 'archived', 'deleted')
            THEN 'pending'
          WHEN COALESCE((
            SELECT LOWER(TRIM(wa.decision))
              FROM workflow_actions wa
             WHERE wa.module_key = 'finance'
               AND wa.record_id = fr.id
               AND (? = 'all' OR LOWER(TRIM(wa.stage)) = ?)
             ORDER BY wa.decided_at DESC, wa.id DESC
             LIMIT 1
          ), '') LIKE '%approved%' OR LOWER(CONCAT_WS(' ',
            ${WORKFLOW_STATUS_SQL_EXPR},
            ${WORKFLOW_STAGE_SQL_EXPR},
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
          )) LIKE '%approved%' OR LOWER(CONCAT_WS(' ',
            ${WORKFLOW_STATUS_SQL_EXPR},
            ${WORKFLOW_STAGE_SQL_EXPR},
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '')
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

    const financeSelectSql = await getFinanceSelectSql({ tx });
    const [rows] = await tx.query(
      `${financeSelectSql}
       ${whereClause}
       ORDER BY
         CASE
           WHEN ${WORKFLOW_STATUS_SQL_EXPR} = 'in_progress'
            AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.lastDecision')), '') = 'resubmitted'
           THEN 0
           ELSE 1
         END,
         COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.resubmittedAt')), '') DESC,
         fr.created_at DESC
       LIMIT ? OFFSET ?`,
      [statusStageScope, statusStageScope, ...whereParams, limit, offset],
    );
    const financeIds = rows.map((row) => row.id);
    const principalDocuments = await getFinancePrincipalDocumentsByFinanceIds(financeIds, { tx });
    const annexuresByFinanceId = await getFinanceAnnexuresByFinanceIds(financeIds, { tx });

    return {
      items: rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
        level1_route_type: resolveFinanceLevel1RouteType(row),
        annexures:
          annexuresByFinanceId.get(toPositiveInt(row.id)) || getLegacyAnnexureFromRecord(row),
        principal_document: principalDocuments.get(toPositiveInt(row.id)) || null,
      })),
      total: filteredTotal,
      statusCounts,
      page,
      limit,
    };
  },

  async listAvailableBeneficiaryTypes({ tx = db } = {}) {
    const [rows] = await tx.query(
      `SELECT DISTINCT TRIM(beneficiary_type) AS beneficiary_type
         FROM finance_requests fr
        WHERE ${FINANCE_NOT_DELETED_CONDITION_SQL}
          AND beneficiary_type IS NOT NULL
          AND TRIM(beneficiary_type) <> ''
        ORDER BY TRIM(beneficiary_type) ASC`,
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

  async listAvailableFiscalYears({ tx = db } = {}) {
    const [rows] = await tx.query(
      `SELECT DISTINCT fiscal_year
         FROM (
           SELECT bp.fiscal_year AS fiscal_year
             FROM finance_budget_breakup fbb
             JOIN budget_proposals bp ON bp.id = fbb.budget_proposal_id
             JOIN finance_requests fr ON fr.id = fbb.finance_id
            WHERE ${FINANCE_NOT_DELETED_CONDITION_SQL}
              AND bp.fiscal_year IS NOT NULL
           UNION
           SELECT (
                    YEAR(COALESCE(fr.request_date, fr.created_at))
                      - (MONTH(COALESCE(fr.request_date, fr.created_at)) < 4)
                  ) AS fiscal_year
             FROM finance_requests fr
            WHERE ${FINANCE_NOT_DELETED_CONDITION_SQL}
              AND NOT EXISTS (
                SELECT 1
                  FROM finance_budget_breakup fbb
                 WHERE fbb.finance_id = fr.id
              )
           UNION
           SELECT cf.target_fiscal_year AS fiscal_year
             FROM finance_carry_forward_allocations cf
             JOIN finance_requests fr ON fr.id = cf.finance_request_id
            WHERE ${FINANCE_NOT_DELETED_CONDITION_SQL}
              AND LOWER(TRIM(cf.status)) = 'active'
         ) years
        WHERE fiscal_year IS NOT NULL
        ORDER BY fiscal_year DESC`,
    );

    return (rows || []).map((row) => toPositiveInt(row?.fiscal_year)).filter(Boolean);
  },

  async getCarryForwardSummary(recordId, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) {
      throw new Error('Invalid finance request ID');
    }

    const [rows] = await tx.query(
      `SELECT
         fr.id,
         fr.request_date,
         fr.created_at,
         COALESCE(
           NULLIF(fr.approved_total_amount, 0),
           NULLIF(fr.total_budget, 0),
           NULLIF(fr.proposed_amount, 0),
           0
         ) AS approved_amount,
         LOWER(TRIM(COALESCE(fr.overall_status, ''))) AS overall_status,
         LOWER(TRIM(COALESCE(fr.workflow_status, ''))) AS workflow_status,
         LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) AS workflow_state_status
       FROM finance_requests fr
       WHERE fr.id = ?
       LIMIT 1`,
      [normalizedRecordId],
    );

    const record = rows?.[0] || null;
    if (!record) {
      throw new Error('Finance request not found');
    }

    const approvedStatuses = new Set(['approved', 'completed']);
    if (
      !approvedStatuses.has(normalizeText(record.overall_status).toLowerCase()) &&
      !approvedStatuses.has(normalizeText(record.workflow_status).toLowerCase()) &&
      !approvedStatuses.has(normalizeText(record.workflow_state_status).toLowerCase())
    ) {
      throw new Error('Only approved finance requests can be carried forward');
    }

    const sourceFiscalYear = await resolveFinanceSourceFiscalYear(
      tx,
      normalizedRecordId,
      record.request_date,
      record.created_at,
    );
    const sourceFyAdvanceSnapshot = await getFinanceAdvanceSettlementSnapshotForFiscalYear(
      tx,
      normalizedRecordId,
      sourceFiscalYear,
    );
    const usage = await getFinanceUsageSnapshot(tx, normalizedRecordId);
    const approvedAmount = toMoney(record.approved_amount);
    const balanceAmount = sourceFyAdvanceSnapshot.unsettledAdvanceAmount;
    const isEligible = sourceFyAdvanceSnapshot.unsettledAdvanceAmount > 0;

    const [allocationRows] = await tx.query(
      `SELECT
         id,
         source_fiscal_year,
         target_fiscal_year,
         carry_forward_amount,
         used_amount,
         remarks,
         status,
         created_by_user_id,
         created_by_email,
         created_at
       FROM finance_carry_forward_allocations
       WHERE finance_request_id = ?
       ORDER BY target_fiscal_year DESC, id DESC`,
      [normalizedRecordId],
    );

    return {
      financeRequestId: normalizedRecordId,
      sourceFiscalYear,
      approvedAmount,
      advanceAmount: usage.advanceAmount,
      settlementAmount: usage.settlementAmount,
      expenditureAmount: usage.expenditureAmount,
      sourceFiscalYearAdvanceAmount: sourceFyAdvanceSnapshot.advanceAmount,
      sourceFiscalYearSettlementAmount: sourceFyAdvanceSnapshot.settlementAmount,
      unsettledAdvanceAmount: sourceFyAdvanceSnapshot.unsettledAdvanceAmount,
      carryForwardMode: 'card_visibility',
      isEligible,
      eligibilityMessage: isEligible
        ? ''
        : 'Carry forward is available only for cards with an unsettled Initial/Interim Advance in the source FY.',
      activeCarryForwardAmount: 0,
      balanceAmount,
      allocations: (allocationRows || []).map((row) => ({
        id: toPositiveInt(row.id),
        sourceFiscalYear: toPositiveInt(row.source_fiscal_year),
        targetFiscalYear: toPositiveInt(row.target_fiscal_year),
        carryForwardAmount: toMoney(row.carry_forward_amount),
        usedAmount: toMoney(row.used_amount),
        remarks: normalizeText(row.remarks),
        status: normalizeText(row.status).toLowerCase() || 'active',
        createdByUserId: toPositiveInt(row.created_by_user_id),
        createdByEmail: normalizeText(row.created_by_email),
        createdAt: row.created_at || null,
      })),
    };
  },

  async createCarryForwardAllocation(recordId, payload = {}, actor = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    const targetFiscalYear = toPositiveInt(payload.targetFiscalYear || payload.target_fiscal_year);
    const remarks = normalizeText(payload.remarks);

    if (!normalizedRecordId) {
      throw new Error('Invalid finance request ID');
    }
    if (!targetFiscalYear) {
      throw new Error('Target fiscal year is required');
    }
    if (!remarks) {
      throw new Error('Carry-forward remarks are required');
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [lockRows] = await conn.query(
        `SELECT id
           FROM finance_requests
          WHERE id = ?
          LIMIT 1
          FOR UPDATE`,
        [normalizedRecordId],
      );
      if (!lockRows.length) {
        throw new Error('Finance request not found');
      }

      const summary = await this.getCarryForwardSummary(normalizedRecordId, { tx: conn });

      if (targetFiscalYear <= summary.sourceFiscalYear) {
        throw new Error('Target fiscal year must be after the source fiscal year');
      }
      if (!summary.isEligible) {
        throw new Error(
          summary.eligibilityMessage ||
            'Carry forward is available only for cards with unsettled advance',
        );
      }

      const existingActive = summary.allocations.find(
        (allocation) =>
          allocation.targetFiscalYear === targetFiscalYear && allocation.status === 'active',
      );
      if (existingActive) {
        throw new Error(
          `Carry-forward is already active for FY ${targetFiscalYear}-${String(targetFiscalYear + 1).slice(2)}`,
        );
      }

      const targetBudgetAvailability = await getCarryForwardTargetBudgetAvailability(
        conn,
        normalizedRecordId,
        targetFiscalYear,
      );
      if (!targetBudgetAvailability.hasBudget) {
        const sourceHeadLabel = targetBudgetAvailability.sourceHeads.length
          ? ` for ${targetBudgetAvailability.sourceHeads.join(', ')}`
          : '';
        throw new Error(
          `No approved FY ${targetFiscalYear}-${String(targetFiscalYear + 1).slice(2)} budget exists${sourceHeadLabel}. Create the target FY budget before carrying forward this card.`,
        );
      }

      const [result] = await conn.query(
        `INSERT INTO finance_carry_forward_allocations
           (finance_request_id, source_fiscal_year, target_fiscal_year,
            carry_forward_amount, remarks, status, created_by_user_id, created_by_email)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          normalizedRecordId,
          summary.sourceFiscalYear,
          targetFiscalYear,
          0,
          remarks,
          toPositiveInt(actor?.id || actor?.userId),
          normalizeText(actor?.email) || null,
        ],
      );

      await conn.commit();
      return {
        id: result.insertId,
        financeRequestId: normalizedRecordId,
        sourceFiscalYear: summary.sourceFiscalYear,
        targetFiscalYear,
        carryForwardAmount: 0,
        unsettledAdvanceAmount: summary.unsettledAdvanceAmount,
        mode: summary.carryForwardMode,
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  },

  async getFinanceOwner(recordId) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) {
      return null;
    }

    const [rows] = await db.query(
      `SELECT fr.id, fr.employee_id, fr.created_by, me.user_id AS applicant_user_id
         FROM finance_requests fr
         LEFT JOIN master_employees me ON me.id = fr.employee_id
         WHERE fr.id = ?
         LIMIT 1`,
      [normalizedRecordId],
    );

    return rows.length ? rows[0] : null;
  },

  async getPrincipalDocument(recordId) {
    return getFinancePrincipalDocumentByFinanceId(recordId);
  },

  async setPrincipalDocument(recordId, document, { tx = db } = {}) {
    return setFinancePrincipalDocument(recordId, document, { tx });
  },

  async deletePrincipalDocument(recordId, { tx = db } = {}) {
    return deleteFinancePrincipalDocumentByFinanceId(recordId, { tx });
  },

  async updateWorkflowStageRemark(recordId, stage, remark, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    const normalizedStage = normalizeText(stage).toLowerCase();
    const normalizedRemark = normalizeText(remark);

    if (!normalizedRecordId || !normalizedRemark) {
      return false;
    }

    const stageColumnMap = {
      dof: 'director_comment',
      principal: 'principal_comment',
      chairman: 'chairman_comment',
    };

    const targetColumn = stageColumnMap[normalizedStage];
    if (!targetColumn) {
      return false;
    }

    await tx.query(
      `UPDATE finance_requests
          SET ${targetColumn} = ?
        WHERE id = ?`,
      [normalizedRemark, normalizedRecordId],
    );

    return true;
  },
};

export default financeModel;
