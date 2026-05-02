import db from '../../config/connection.js';
import * as orgUnitQueries from '../shared/budget/orgUnitQueries.js';
import fs from 'fs';
import path from 'path';

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
const FINANCE_PRINCIPAL_DOC_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'finance-principal-documents');
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
    [normalizedColumn]
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
      LIMIT 1`
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
  if (normalized === 'professional body' || normalized === 'professional bodies') return 'Professional Body';
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
  const amount = enabled && Number.isFinite(parsedAmount) && parsedAmount > 0
    ? toMoney(parsedAmount)
    : 0;

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
  normalizeText(beneficiaryType)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  if (normalized === 'SECTION') return 'SECTION';
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
    const headOnlyMatch = Boolean(row?.head_only_match);
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
    remarks: normalizeText(row?.remarks || row?.remark),
    credit_account: normalizeText(row?.creditAccount || row?.credit_account),
    sort_order: index,
  }));

const normalizeFinanceAnnexures = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const originalName = normalizeText(row?.original_name || row?.originalName || row?.annexure_file_name);
      const storedName = normalizeText(row?.stored_name || row?.storedName || row?.annexure_storage_name) || originalName;
      return {
        annexure_type: normalizeText(row?.annexure_type || row?.annexureType),
        original_name: originalName,
        stored_name: storedName,
        file_path: normalizeText(row?.file_path || row?.filePath || row?.annexure_file_path),
        mime_type: normalizeText(row?.mime_type || row?.mimeType || row?.annexure_mime_type),
        file_size: Number.isFinite(Number(row?.file_size ?? row?.fileSize ?? row?.annexure_file_size))
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
      .filter((name) => name && FINANCE_ANNEXURE_STORED_NAME_PATTERN.test(name))
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
        .filter(Boolean)
    )
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
      normalizedFinanceIds
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
    [normalizedFinanceId]
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
    ]
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
    [normalizedFinanceId]
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
  return [{
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
  }];
};

const normalizeWorkflowStatus = (state) =>
  normalizeText(state?.status).toLowerCase();

const normalizeToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const normalizeStringForMatch = (value) =>
  normalizeText(value).toLowerCase().trim();

const isLooseTextMatch = (leftValue, rightValue) => {
  const leftNormalized = normalizeStringForMatch(leftValue);
  const rightNormalized = normalizeStringForMatch(rightValue);

  if (!leftNormalized || !rightNormalized) {
    return false;
  }

  return leftNormalized === rightNormalized;
};

const normalizeHeadLabelForMatch = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shouldUseHeadOnlyAvailabilityMatch = (budgetHead) => {
  const normalized = normalizeHeadLabelForMatch(budgetHead);
  return Boolean(normalized);
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
} = {}) => `
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
  const hasUnplannedBudgetEnabled = await hasFinanceRequestColumn('unplanned_budget_enabled', { tx });
  const hasUnplannedBudgetAmount = await hasFinanceRequestColumn('unplanned_budget_amount', { tx });
  const hasUnplannedBudgetDescription = await hasFinanceRequestColumn('unplanned_budget_description', { tx });
  const hasAnnexureType = await hasFinanceRequestColumn('annexure_type', { tx });
  const hasAnnexureFileName = await hasFinanceRequestColumn('annexure_file_name', { tx });
  const hasAnnexureStorageName = await hasFinanceRequestColumn('annexure_storage_name', { tx });
  const hasAnnexureFilePath = await hasFinanceRequestColumn('annexure_file_path', { tx });
  const hasAnnexureMimeType = await hasFinanceRequestColumn('annexure_mime_type', { tx });
  const hasAnnexureFileSize = await hasFinanceRequestColumn('annexure_file_size', { tx });
  return buildFinanceSelectSql({
    budgetTagSelectSql: hasBudgetTag ? 'fr.budget_tag' : 'NULL AS budget_tag',
    unplannedBudgetEnabledSelectSql: hasUnplannedBudgetEnabled ? 'fr.unplanned_budget_enabled' : 'NULL AS unplanned_budget_enabled',
    unplannedBudgetAmountSelectSql: hasUnplannedBudgetAmount ? 'fr.unplanned_budget_amount' : 'NULL AS unplanned_budget_amount',
    unplannedBudgetDescriptionSelectSql: hasUnplannedBudgetDescription ? 'fr.unplanned_budget_description' : 'NULL AS unplanned_budget_description',
    annexureTypeSelectSql: hasAnnexureType ? 'fr.annexure_type' : 'NULL AS annexure_type',
    annexureFileNameSelectSql: hasAnnexureFileName ? 'fr.annexure_file_name' : 'NULL AS annexure_file_name',
    annexureStorageNameSelectSql: hasAnnexureStorageName ? 'fr.annexure_storage_name' : 'NULL AS annexure_storage_name',
    annexureFilePathSelectSql: hasAnnexureFilePath ? 'fr.annexure_file_path' : 'NULL AS annexure_file_path',
    annexureMimeTypeSelectSql: hasAnnexureMimeType ? 'fr.annexure_mime_type' : 'NULL AS annexure_mime_type',
    annexureFileSizeSelectSql: hasAnnexureFileSize ? 'fr.annexure_file_size' : 'NULL AS annexure_file_size',
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
    unplanned_budget_enabled: updateData.unplanned_budget_enabled ?? previousRecord.unplanned_budget_enabled,
    unplanned_budget_amount: updateData.unplanned_budget_amount ?? previousRecord.unplanned_budget_amount,
    unplanned_budget_description: updateData.unplanned_budget_description ?? previousRecord.unplanned_budget_description,
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
    { storageKey: 'unplanned_budget_enabled', label: 'Unplanned budget enabled' },
    { storageKey: 'unplanned_budget_amount', label: 'Unplanned budget amount' },
    { storageKey: 'unplanned_budget_description', label: 'Unplanned budget description' },
    { storageKey: 'annexure_type', label: 'Annexure type' },
    { storageKey: 'annexure_file_name', label: 'Annexure file name' },
    { storageKey: 'annexure_storage_name', label: 'Annexure storage name' },
    { storageKey: 'annexure_file_path', label: 'Annexure file path' },
    { storageKey: 'annexure_mime_type', label: 'Annexure mime type' },
    { storageKey: 'annexure_file_size', label: 'Annexure file size' },
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
    Section: 'SECTION',
    'Professional Body': 'PROFESSIONAL_BODY',
    ProfessionalBodies: 'PROFESSIONAL_BODY',
    'Professional Bodies': 'PROFESSIONAL_BODY',
  };

  return map[normalizedType] || null;
};

const resolveBudgetAvailabilityScope = async (conn, scope = {}) => {
  const beneficiaryType = normalizeBeneficiaryType(scope?.beneficiaryType || scope?.beneficiary_type);
  const beneficiaryValue = normalizeText(scope?.beneficiaryValue || scope?.beneficiary_value);
  const beneficiaryTypeToken = normalizeBeneficiaryTypeToken(beneficiaryType);
  const providedDepartmentId = toPositiveInt(scope?.departmentId || scope?.department_id);
  const providedEntityId = toPositiveInt(scope?.beneficiaryEntityId || scope?.beneficiary_entity_id);

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
        [beneficiaryValue]
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
      [entityTypeCode, beneficiaryValue]
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
  excludeFinanceId = null,
  beneficiaryType = null,
  beneficiaryValue = null,
  departmentId = null,
  beneficiaryEntityId = null,
} = {}) => {
  const normalizedUserId = toPositiveInt(userId);
  const normalizedUserEmail = normalizeText(userEmail).toLowerCase();
  const normalizedBudgetHead = normalizeText(budgetHead);
  const normalizedSubHead = normalizeSubHeadForLookup(subHead);
  const normalizedPreferredBudgetLineId = toPositiveInt(preferredBudgetLineId);
  const normalizedExcludeFinanceId = toPositiveInt(excludeFinanceId);
  const applyHeadOnlyMatch = Boolean(headOnlyMatch) || shouldUseHeadOnlyAvailabilityMatch(normalizedBudgetHead);
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
    ((scope.mode === 'user' && !normalizedUserId && !normalizedUserEmail) ||
      (scope.mode === 'department' && !scope.departmentId) ||
      (scope.mode === 'entity' && !scope.entityId)) ||
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
       bp.beneficiary_type,
       bp.beneficiary_value,
       COALESCE(bpl.approved_line_total, bpl.line_total, 0) AS budget_line_amount,
       COALESCE(fblu.consumed_amount, 0) AS consumed_amount,
       COALESCE(frbr.reserved_amount, 0) AS reserved_amount,
       (
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)
         - COALESCE(fblu.consumed_amount, 0)
         - COALESCE(frbr.reserved_amount, 0)
       ) AS available_amount
     FROM budget_proposal_lines bpl
     JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
     LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
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
       AND (
         LOWER(TRIM(bp.status)) IN ('completed', 'approved', 'principal_approved')
         OR LOWER(TRIM(bp.current_stage)) = 'completed'
       )
     ORDER BY
       (
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)
         - COALESCE(fblu.consumed_amount, 0)
         - COALESCE(frbr.reserved_amount, 0)
       ) DESC,
       bp.updated_at DESC,
       bpl.id DESC`,
    [
      normalizedExcludeFinanceId,
      normalizedExcludeFinanceId,
      ...ownerScopeParams,
    ]
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
      budgetLineAmount: toMoney(row.budget_line_amount),
      consumedAmount: toMoney(row.consumed_amount),
      reservedAmount: toMoney(row.reserved_amount),
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
  } = {}
) => {
  const enrichedRows = [];
  const requestedByBudgetLine = new Map();
  const requestedByHead = new Map();
  const normalizedLookupBudgetHead = normalizeText(lookupBudgetHead);
  const normalizedLookupSubHead = normalizeSubHeadForLookup(lookupSubHead);

  for (const row of budgetRows) {
    const effectiveLookupBudgetHead = row.budget_head || normalizedLookupBudgetHead;
    const effectiveLookupSubHead = normalizeSubHeadForLookup(row.sub_head) || normalizedLookupSubHead;
    const applyHeadOnlyMatch =
      Boolean(row.head_only_match) || shouldUseHeadOnlyAvailabilityMatch(effectiveLookupBudgetHead);

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
    });

    const headReservationKey =
      normalizeHeadLabelForMatch(effectiveLookupBudgetHead) || normalizeText(effectiveLookupBudgetHead).toLowerCase();
    const alreadyRequestedForHead = toMoney(requestedByHead.get(headReservationKey) || 0);
    const remainingHeadAfterLocalReservations = Math.max(0, availability.totalAvailable - alreadyRequestedForHead);

    if (applyHeadOnlyMatch) {
      if (!availability.matches.length || remainingHeadAfterLocalReservations <= 0) {
        throw new Error(
          `No approved budget allocation found for "${effectiveLookupBudgetHead}" in the selected beneficiary scope`
        );
      }

      if (row.amount > remainingHeadAfterLocalReservations) {
        throw new Error(
          `Requested amount ${row.amount.toFixed(2)} exceeds remaining available amount ${remainingHeadAfterLocalReservations.toFixed(2)} for "${effectiveLookupBudgetHead}" after other rows in this request`
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

        const alreadyRequestedForLine = toMoney(requestedByBudgetLine.get(candidateBudgetLineId) || 0);
        const remainingForLine = Math.max(0, toMoney(match.availableAmount) - alreadyRequestedForLine);
        if (remainingForLine <= 0) continue;

        const allocatedAmount = Math.min(remainingToAllocate, remainingForLine);
        if (allocatedAmount <= 0) continue;

        requestedByBudgetLine.set(candidateBudgetLineId, toMoney(alreadyRequestedForLine + allocatedAmount));
        enrichedRows.push({
          ...row,
          sub_head: normalizeText(match.subHead) || row.sub_head,
          amount: toMoney(allocatedAmount),
          budget_line_id: candidateBudgetLineId,
          budget_proposal_id: toPositiveInt(match.budgetProposalId),
          available_amount_snapshot: remainingForLine,
        });

        remainingToAllocate = toMoney(remainingToAllocate - allocatedAmount);
      }

      if (remainingToAllocate > 0) {
        throw new Error(
          `Unable to map full amount ${row.amount.toFixed(2)} to approved budget lines for "${effectiveLookupBudgetHead}". Remaining ${remainingToAllocate.toFixed(2)} is unmapped.`
        );
      }

      requestedByHead.set(headReservationKey, alreadyRequestedForHead + row.amount);
      continue;
    }

    const selected = availability.selected;
    if (!selected) {
      throw new Error(
        `No approved budget allocation found for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" in the selected beneficiary scope`
      );
    }

    if (row.amount > selected.availableAmount) {
      throw new Error(
        `Requested amount ${row.amount.toFixed(2)} exceeds available amount ${selected.availableAmount.toFixed(2)} for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}"`
      );
    }

    const selectedBudgetLineId = toPositiveInt(selected.budgetLineId);
    if (!selectedBudgetLineId) {
      throw new Error(
        `No approved budget allocation found for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" in the selected beneficiary scope`
      );
    }

    const alreadyRequested = toMoney(requestedByBudgetLine.get(selectedBudgetLineId) || 0);
    const remainingAfterLocalReservations = Math.max(0, selected.availableAmount - alreadyRequested);
    if (row.amount > remainingAfterLocalReservations) {
      throw new Error(
        `Requested amount ${row.amount.toFixed(2)} exceeds remaining available amount ${remainingAfterLocalReservations.toFixed(2)} for "${effectiveLookupBudgetHead}" / "${effectiveLookupSubHead}" after other rows in this request`
      );
    }
    requestedByBudgetLine.set(selectedBudgetLineId, alreadyRequested + row.amount);
    requestedByHead.set(headReservationKey, alreadyRequestedForHead + row.amount);

    enrichedRows.push({
      ...row,
      budget_line_id: selectedBudgetLineId,
      budget_proposal_id: toPositiveInt(selected.budgetProposalId),
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
      values
    );
  }
};

const replaceFinanceAnnexures = async (conn, financeId, annexures = []) => {
  let financeFkColumn = 'finance_id';
  try {
    await conn.query('DELETE FROM finance_request_annexures WHERE finance_id = ?', [financeId]);
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR') {
      financeFkColumn = 'finance_request_id';
      await conn.query('DELETE FROM finance_request_annexures WHERE finance_request_id = ?', [financeId]);
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
      ]
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

  const [financeRows] = await conn.query(
    'SELECT unplanned_budget_enabled, unplanned_budget_amount FROM finance_requests WHERE id = ? FOR UPDATE',
    [financeId]
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
    [financeId]
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
    [financeId]
  );

  let approvedTotalAmount = unplannedBudgetEnabled ? unplannedBudgetAmount : 0;
  let totalRemainingAmount = 0;

  for (const row of rows) {
    const budgetLineId = toPositiveInt(row.budget_line_id);
    const requestedAmount = toMoney(row.amount);

    if (requestedAmount <= 0) {
      throw new Error(
        `Requested amount must be greater than 0 for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`
      );
    }

    if (!budgetLineId) {
      const lookupBudgetHead = normalizeText(row.budget_head);
      if (!lookupBudgetHead) {
        throw new Error(
          `Budget line mapping is missing for "${normalizeText(row.budget_head)}" / "${normalizeText(row.sub_head)}"`
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
          `Insufficient budget balance for "${lookupBudgetHead}". Requested ${requestedAmount.toFixed(2)}, available ${headLevelAvailability.totalAvailable.toFixed(2)}`
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
          [candidateBudgetLineId]
        );

        const [usageRows] = await conn.query(
          `SELECT consumed_amount
           FROM finance_budget_line_usage
           WHERE budget_line_id = ?
           FOR UPDATE`,
          [candidateBudgetLineId]
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
          [balanceAfter, candidateBudgetLineId]
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
          ]
        );

        remainingToConsume = toMoney(remainingToConsume - consumeAmount);
      }

      if (remainingToConsume > 0) {
        throw new Error(
          `Insufficient budget balance for "${lookupBudgetHead}". Requested ${requestedAmount.toFixed(2)}, available ${headLevelAvailability.totalAvailable.toFixed(2)}`
        );
      }

      const remainingAfter = Math.max(0, headLevelAvailability.totalAvailable - requestedAmount);

      await conn.query(
        `UPDATE finance_budget_breakup
         SET approved_amount = ?,
             remaining_amount_snapshot = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [requestedAmount, remainingAfter, row.id]
      );

      approvedTotalAmount += requestedAmount;
      totalRemainingAmount += remainingAfter;
      continue;
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

const getFinanceBreakupTotal = async (conn, financeId) => {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_budget_breakup
     WHERE finance_id = ?`,
    [financeId]
  );
  return toMoney(rows?.[0]?.total);
};

const financeModel = {
  async createFinanceRequest(financeData, userId, userEmail = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });
      const hasUnplannedBudgetEnabledColumn = await hasFinanceRequestColumn('unplanned_budget_enabled', { tx: connection });
      const hasUnplannedBudgetAmountColumn = await hasFinanceRequestColumn('unplanned_budget_amount', { tx: connection });
      const hasUnplannedBudgetDescriptionColumn = await hasFinanceRequestColumn('unplanned_budget_description', { tx: connection });
      const hasAnnexureTypeColumn = await hasFinanceRequestColumn('annexure_type', { tx: connection });
      const hasAnnexureFileNameColumn = await hasFinanceRequestColumn('annexure_file_name', { tx: connection });
      const hasAnnexureStorageNameColumn = await hasFinanceRequestColumn('annexure_storage_name', { tx: connection });
      const hasAnnexureFilePathColumn = await hasFinanceRequestColumn('annexure_file_path', { tx: connection });
      const hasAnnexureMimeTypeColumn = await hasFinanceRequestColumn('annexure_mime_type', { tx: connection });
      const hasAnnexureFileSizeColumn = await hasFinanceRequestColumn('annexure_file_size', { tx: connection });

      const workflowContext = await resolveFinanceWorkflowContext(connection, financeData);
      const normalizedBudgetRows = normalizeBudgetRows(Array.isArray(financeData.budget_rows) ? financeData.budget_rows : []);
      const budgetRows = await enrichBudgetRowsWithBudgetRefs(connection, userId, userEmail, normalizedBudgetRows, {
        beneficiaryType: financeData.beneficiary_type,
        beneficiaryValue: financeData.beneficiary_value,
        departmentId: workflowContext.departmentId,
        beneficiaryEntityId: workflowContext.beneficiaryEntityId,
        lookupBudgetHead: financeData.primary_head,
        lookupSubHead: financeData.event_sub_head,
      });
      const incomeRows = normalizeIncomeRows(Array.isArray(financeData.income_rows) ? financeData.income_rows : []);
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
          ? (normalizeText(financeData.unplanned_budget_description) || null)
          : null;
      }
      if (hasAnnexureTypeColumn) {
        financeEntry.annexure_type = primaryAnnexure
          ? primaryAnnexure.annexure_type || null
          : (normalizeText(financeData.annexure_type) || null);
      }
      if (hasAnnexureFileNameColumn) {
        financeEntry.annexure_file_name = primaryAnnexure
          ? (primaryAnnexure.original_name || primaryAnnexure.stored_name || null)
          : (normalizeText(financeData.annexure_file_name) || null);
      }
      if (hasAnnexureStorageNameColumn) {
        financeEntry.annexure_storage_name = primaryAnnexure
          ? primaryAnnexure.stored_name || null
          : (normalizeText(financeData.annexure_storage_name) || null);
      }
      if (hasAnnexureFilePathColumn) {
        financeEntry.annexure_file_path = primaryAnnexure
          ? primaryAnnexure.file_path || null
          : (normalizeText(financeData.annexure_file_path) || null);
      }
      if (hasAnnexureMimeTypeColumn) {
        financeEntry.annexure_mime_type = primaryAnnexure
          ? primaryAnnexure.mime_type || null
          : (normalizeText(financeData.annexure_mime_type) || null);
      }
      if (hasAnnexureFileSizeColumn) {
        const parsedAnnexureSize = primaryAnnexure ? Number(primaryAnnexure.file_size) : Number(financeData.annexure_file_size);
        financeEntry.annexure_file_size = Number.isFinite(parsedAnnexureSize) ? parsedAnnexureSize : null;
      }

      const [result] = await connection.query('INSERT INTO finance_requests SET ?', [financeEntry]);
      await insertFinanceRequestReference(connection, result.insertId, financeData.request_date);
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

  async updateFinanceRequest(id, financeData, actor = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const hasBudgetTagColumn = await hasFinanceRequestColumn('budget_tag', { tx: connection });
      const hasUnplannedBudgetEnabledColumn = await hasFinanceRequestColumn('unplanned_budget_enabled', { tx: connection });
      const hasUnplannedBudgetAmountColumn = await hasFinanceRequestColumn('unplanned_budget_amount', { tx: connection });
      const hasUnplannedBudgetDescriptionColumn = await hasFinanceRequestColumn('unplanned_budget_description', { tx: connection });
      const hasAnnexureTypeColumn = await hasFinanceRequestColumn('annexure_type', { tx: connection });
      const hasAnnexureFileNameColumn = await hasFinanceRequestColumn('annexure_file_name', { tx: connection });
      const hasAnnexureStorageNameColumn = await hasFinanceRequestColumn('annexure_storage_name', { tx: connection });
      const hasAnnexureFilePathColumn = await hasFinanceRequestColumn('annexure_file_path', { tx: connection });
      const hasAnnexureMimeTypeColumn = await hasFinanceRequestColumn('annexure_mime_type', { tx: connection });
      const hasAnnexureFileSizeColumn = await hasFinanceRequestColumn('annexure_file_size', { tx: connection });
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
      const mergedRecordForContext = {
        employee_id: financeData.employee_id ?? existingRecord.employee_id,
        beneficiary_type: financeData.beneficiary_type ?? existingRecord.beneficiary_type,
        beneficiary_value: financeData.beneficiary_value ?? existingRecord.beneficiary_value,
        primary_head: financeData.primary_head ?? existingRecord.primary_head,
        event_sub_head: financeData.event_sub_head ?? existingRecord.event_sub_head,
      };
      const workflowContext = await resolveFinanceWorkflowContext(connection, mergedRecordForContext);
      const hasBudgetRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'budget_rows');
      const hasIncomeRowsInput = Object.prototype.hasOwnProperty.call(financeData, 'income_rows');
      const hasAnnexuresInput = Object.prototype.hasOwnProperty.call(financeData, 'annexures');
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
          }
        )
        : [];
      const incomeRows = hasIncomeRowsInput
        ? normalizeIncomeRows(Array.isArray(financeData.income_rows) ? financeData.income_rows : [])
        : [];
      const annexures = hasAnnexuresInput
        ? await normalizeFinanceAnnexures(Array.isArray(financeData.annexures) ? financeData.annexures : [])
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
          [id]
        )
        : [[]];
      const [previousIncomeRows] = hasIncomeRowsInput
        ? await connection.query(
          `SELECT income_source, contribution, amount, status, remarks, credit_account
               FROM finance_income_rows
               WHERE finance_id = ?
               ORDER BY sort_order ASC, id ASC`,
          [id]
        )
        : [[]];
      const updateData = Object.fromEntries(
        Object.entries(financeData)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value === '' ? null : value])
      );
      delete updateData.budget_rows;
      delete updateData.income_rows;
      delete updateData.annexures;
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
            unplanned_budget_enabled:
              Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled')
                ? updateData.unplanned_budget_enabled
                : existingRecord.unplanned_budget_enabled,
            unplanned_budget_amount: updateData.unplanned_budget_amount,
          });
          updateData.unplanned_budget_amount = normalizedUnplanned.enabled ? normalizedUnplanned.amount : null;
        } else {
          delete updateData.unplanned_budget_amount;
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_description')) {
        if (hasUnplannedBudgetDescriptionColumn) {
          updateData.unplanned_budget_description = normalizeText(updateData.unplanned_budget_description) || null;
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
          updateData.annexure_storage_name = normalizeText(updateData.annexure_storage_name) || null;
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
          updateData.annexure_file_size = Number.isFinite(parsedAnnexureSize) ? parsedAnnexureSize : null;
        } else {
          delete updateData.annexure_file_size;
        }
      }

      if (hasAnnexuresInput) {
        const firstAnnexure = annexures[0] || null;
        if (hasAnnexureTypeColumn) {
          updateData.annexure_type = firstAnnexure ? firstAnnexure.annexure_type || null : null;
        }
        if (hasAnnexureFileNameColumn) {
          updateData.annexure_file_name = firstAnnexure
            ? (firstAnnexure.original_name || firstAnnexure.stored_name || null)
            : null;
        }
        if (hasAnnexureStorageNameColumn) {
          updateData.annexure_storage_name = firstAnnexure ? firstAnnexure.stored_name || null : null;
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
        updateData.beneficiary_type = normalizeBeneficiaryTypeForStorage(updateData.beneficiary_type);
      }

      updateData.department_id = workflowContext.departmentId;
      updateData.beneficiary_entity_id = workflowContext.beneficiaryEntityId;

      if (hasBudgetRowsInput) {
        await replaceBudgetRows(connection, id, budgetRows);
        const totalBudget = calculateFinanceTotalBudget(budgetRows, {
          unplanned_budget_enabled:
            Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled')
              ? updateData.unplanned_budget_enabled
              : existingRecord.unplanned_budget_enabled,
          unplanned_budget_amount:
            Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount')
              ? updateData.unplanned_budget_amount
              : existingRecord.unplanned_budget_amount,
        });
        updateData.total_budget = totalBudget;
      } else if (
        Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled') ||
        Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount')
      ) {
        const plannedTotal = await getFinanceBreakupTotal(connection, id);
        const totalBudget = calculateFinanceTotalBudget(
          [{ amount: plannedTotal }],
          {
            unplanned_budget_enabled:
              Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_enabled')
                ? updateData.unplanned_budget_enabled
                : existingRecord.unplanned_budget_enabled,
            unplanned_budget_amount:
              Object.prototype.hasOwnProperty.call(updateData, 'unplanned_budget_amount')
                ? updateData.unplanned_budget_amount
                : existingRecord.unplanned_budget_amount,
          }
        );
        updateData.total_budget = totalBudget;
      }

      if (hasIncomeRowsInput) {
        await replaceIncomeRows(connection, id, incomeRows);
      }
      if (hasAnnexuresInput) {
        await replaceFinanceAnnexures(connection, id, annexures);
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

      if (hasAnnexuresInput) {
        const previousStoredNames = new Set(
          [
            ...previousAnnexures.map((row) => normalizeText(row?.stored_name)),
            normalizeText(existingRecord?.annexure_storage_name),
          ].filter(Boolean)
        );
        const nextStoredNames = new Set(
          annexures.map((row) => normalizeText(row?.stored_name)).filter(Boolean)
        );

        const removedStoredNames = Array.from(previousStoredNames).filter(
          (storedName) => !nextStoredNames.has(storedName)
        );

        await cleanupOrphanFinanceAnnexureFiles(removedStoredNames);
      }

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
           AND ${FINANCE_NOT_DELETED_CONDITION_SQL}
         LIMIT 1`,
        ['', id]
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
      const params = [''];

      query += ` AND ${FINANCE_NOT_DELETED_CONDITION_SQL}`;

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
      const principalDocuments = await getFinancePrincipalDocumentsByFinanceIds(rows.map((row) => row.id));

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
        [financeId]
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
        }
      );
      await replaceBudgetRows(connection, financeId, enrichedRows);
      const [financeRows] = await connection.query(
        `SELECT unplanned_budget_enabled, unplanned_budget_amount
         FROM finance_requests
         WHERE id = ?
         LIMIT 1`,
        [financeId]
      );
      const financeRow = financeRows[0] || {};
      const totalBudget = calculateFinanceTotalBudget(enrichedRows, {
        unplanned_budget_enabled: financeRow.unplanned_budget_enabled,
        unplanned_budget_amount: financeRow.unplanned_budget_amount,
      });

      await connection.query('UPDATE finance_requests SET total_budget = ? WHERE id = ?', [totalBudget, financeId]);

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
          AND ${FINANCE_NOT_DELETED_CONDITION_SQL}
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

      const canUseDeletedOverallStatus = await supportsFinanceOverallStatusDeletedValue({ tx: connection });
      const nextOverallStatus = canUseDeletedOverallStatus ? 'deleted' : 'archived';

      await connection.query(
        `UPDATE finance_requests
            SET workflow_state = ?,
                overall_status = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [JSON.stringify(nextState), nextOverallStatus, id]
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
    excludeFinanceId = null,
    beneficiaryType = null,
    beneficiaryValue = null,
    departmentId = null,
    beneficiaryEntityId = null,
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

    whereParts.push(FINANCE_NOT_DELETED_CONDITION_SQL);

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
    const principalDocuments = await getFinancePrincipalDocumentsByFinanceIds(rows.map((row) => row.id), { tx });

    return {
      items: rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
        level1_route_type: resolveFinanceLevel1RouteType(row),
        principal_document: principalDocuments.get(toPositiveInt(row.id)) || null,
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
        WHERE ${FINANCE_NOT_DELETED_CONDITION_SQL}
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

  async getPrincipalDocument(recordId) {
    return getFinancePrincipalDocumentByFinanceId(recordId);
  },

  async setPrincipalDocument(recordId, document, { tx = db } = {}) {
    return setFinancePrincipalDocument(recordId, document, { tx });
  },

  async deletePrincipalDocument(recordId, { tx = db } = {}) {
    return deleteFinancePrincipalDocumentByFinanceId(recordId, { tx });
  },
};

export default financeModel;
