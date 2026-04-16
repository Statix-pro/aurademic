import db from '../../config/connection.js';
import {
  VALID_MONTHS as SHARED_VALID_MONTHS,
  APPROVAL_FLOW as SHARED_APPROVAL_FLOW,
  EDITABLE_STATES as SHARED_EDITABLE_STATES,
  ENTITY_TYPE_BY_BENEFICIARY as SHARED_ENTITY_TYPE_BY_BENEFICIARY,
  ENTITY_BENEFICIARY_TYPES as SHARED_ENTITY_BENEFICIARY_TYPES,
  LEVEL1_ROUTE_TYPE as SHARED_LEVEL1_ROUTE_TYPE,
  LEVEL1_ASSIGNMENT_STATUS as SHARED_LEVEL1_ASSIGNMENT_STATUS,
  WORKFLOW_STAGES as SHARED_WORKFLOW_STAGES,
  normalizeText as sharedNormalizeText,
  normalizeBeneficiaryType as sharedNormalizeBeneficiaryType,
  normalizeEntityTypeCode as sharedNormalizeEntityTypeCode,
  normalizeBudgetRole as sharedNormalizeBudgetRole,
  isEntityBeneficiaryType as sharedIsEntityBeneficiaryType,
  beneficiaryTypeToEntityTypeCode as sharedBeneficiaryTypeToEntityTypeCode,
  getCurrentFinancialYear as sharedGetCurrentFinancialYear,
  getDefaultFreezeCutoffDate as sharedGetDefaultFreezeCutoffDate,
  groupAllocationsByLine as sharedGroupAllocationsByLine,
  resolveLevel1AssignmentStatus as sharedResolveLevel1AssignmentStatus,
  resolveLevel1Route as sharedResolveLevel1Route,
  resolveStageLabel as sharedResolveStageLabel,
  formatApprovalFlowString as sharedFormatApprovalFlowString,
  parsePositiveAmount as sharedParsePositiveAmount,
} from '../shared/budget/budgetUtils.js';
import * as userResolvers from '../shared/budget/userResolvers.js';
import * as orgUnitQueries from '../shared/budget/orgUnitQueries.js';
import { resolveApprovalFlow as resolveSharedApprovalFlow } from '../shared/budget/approvalFlowResolver.js';
import { buildBudgetList, buildBudgetKpiStats } from '../shared/budget/budgetListBuilder.js';

const VALID_MONTHS = SHARED_VALID_MONTHS;
const APPROVAL_FLOW = SHARED_APPROVAL_FLOW;
const EDITABLE_STATES = SHARED_EDITABLE_STATES;
const ENTITY_TYPE_BY_BENEFICIARY = SHARED_ENTITY_TYPE_BY_BENEFICIARY;
const ENTITY_BENEFICIARY_TYPES = SHARED_ENTITY_BENEFICIARY_TYPES;
const LEVEL1_ROUTE_TYPE = SHARED_LEVEL1_ROUTE_TYPE;
const LEVEL1_ASSIGNMENT_STATUS = SHARED_LEVEL1_ASSIGNMENT_STATUS;
const WORKFLOW_STAGES = SHARED_WORKFLOW_STAGES;
const normalizeText = sharedNormalizeText;
const parsePositiveAmount = sharedParsePositiveAmount;
const ARCHIVE_META_PREFIX = '__archive_meta__:';
const WORKFLOW_STAGE_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export const normalizeBeneficiaryType = (beneficiaryType) => sharedNormalizeBeneficiaryType(beneficiaryType);
const BUDGET_PROPOSAL_COLUMN_EXISTS_CACHE = new Map();

export const normalizeEntityTypeCode = (value) => sharedNormalizeEntityTypeCode(value);
export const normalizeBudgetRole = (value) => sharedNormalizeBudgetRole(value);
const formatApprovalFlowString = (flow) => sharedFormatApprovalFlowString(flow);

async function hasBudgetProposalColumn(columnName) {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;

  if (BUDGET_PROPOSAL_COLUMN_EXISTS_CACHE.get(normalizedColumn) === true) {
    return true;
  }

  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'budget_proposals'
         AND COLUMN_NAME = ?`,
    [normalizedColumn]
  );

  const exists = Number(rows?.[0]?.count || 0) > 0;

  if (exists) {
    BUDGET_PROPOSAL_COLUMN_EXISTS_CACHE.set(normalizedColumn, true);
  } else {
    BUDGET_PROPOSAL_COLUMN_EXISTS_CACHE.delete(normalizedColumn);
  }

  return exists;
}

async function hasBudgetAnnualTable(conn = db) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Budget_annual'`
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function resolveFreezeCutoffDateTimeForFiscalYear(fiscalYear, conn = db) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const fallbackDate = getDefaultFreezeCutoffDate(fy);

  try {
    const [rows] = await conn.execute(
      `SELECT cutoff_date
         FROM budget_time_freeze_config
         WHERE fiscal_year = ?
         LIMIT 1`,
      [fy]
    );
    const cutoffDate = rows?.[0]?.cutoff_date ? String(rows[0].cutoff_date) : fallbackDate;
    return `${cutoffDate} 23:59:59`;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return `${fallbackDate} 23:59:59`;
    }
    throw error;
  }
}

async function applyBudgetAnnualDeltaByProposalId(proposalId, conn, direction = 'add') {
  const proposalIdentifier = Number(proposalId);
  if (!Number.isInteger(proposalIdentifier) || proposalIdentifier <= 0) {
    return;
  }

  const tableExists = await hasBudgetAnnualTable(conn);
  if (!tableExists) {
    return;
  }

  const hasBudgetWindowTypeColumn = await hasBudgetProposalColumn('budget_window_type');
  const budgetWindowSelect = hasBudgetWindowTypeColumn ? 'budget_window_type,' : '';

  const [rows] = await conn.execute(
    `SELECT id,
            fiscal_year,
            beneficiary_type,
            beneficiary_value,
            beneficiary_entity_id,
            department_id,
            ${budgetWindowSelect}
            request_date,
            created_at,
            approved_total_amount
       FROM budget_proposals
      WHERE id = ?
      LIMIT 1`,
    [proposalIdentifier]
  );

  const proposal = rows?.[0];
  if (!proposal) {
    return;
  }

  const amount = Number(proposal.approved_total_amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const delta = direction === 'subtract' ? -amount : amount;
  const fiscalYear = Number.parseInt(proposal.fiscal_year, 10) || getCurrentFinancialYear();
  const persistedWindowType = normalizeText(proposal?.budget_window_type).toLowerCase();
  let isInitial = persistedWindowType === 'initial';
  if (!['initial', 'additional'].includes(persistedWindowType)) {
    const proposalDateSource = proposal?.request_date || proposal?.created_at || null;
    const proposalCreatedAt = proposalDateSource ? new Date(proposalDateSource) : null;
    const cutoffDateTime = await resolveFreezeCutoffDateTimeForFiscalYear(fiscalYear, conn);
    const cutoffAt = new Date(cutoffDateTime.replace(' ', 'T'));
    isInitial = proposalCreatedAt && !Number.isNaN(proposalCreatedAt.getTime())
      ? proposalCreatedAt.getTime() <= cutoffAt.getTime()
      : true;
  }
  const initialDelta = isInitial ? delta : 0;
  const additionalDelta = isInitial ? 0 : delta;
  const normalizedTypeRaw = normalizeText(proposal.beneficiary_type);
  const normalizedTypeLower = normalizedTypeRaw.toLowerCase();
  const beneficiaryType = ['faculty', 'staff'].includes(normalizedTypeLower)
    ? 'Department'
    : (normalizedTypeRaw || 'Unknown');
  const departmentId =
    Number.isInteger(Number(proposal.department_id)) && Number(proposal.department_id) > 0
      ? Number(proposal.department_id)
      : null;
  let beneficiaryEntityId =
    Number.isInteger(Number(proposal.beneficiary_entity_id)) && Number(proposal.beneficiary_entity_id) > 0
      ? Number(proposal.beneficiary_entity_id)
      : null;

  const beneficiaryTypeForEntity = normalizeBeneficiaryType(proposal.beneficiary_type);
  const entityTypeCode = beneficiaryTypeToEntityTypeCode(beneficiaryTypeForEntity);

  if (!beneficiaryEntityId && isEntityBeneficiaryType(beneficiaryTypeForEntity) && entityTypeCode) {
    const normalizedBeneficiaryValue = normalizeText(proposal.beneficiary_value);

    if (normalizedBeneficiaryValue) {
      const [entityRows] = await conn.execute(
        `SELECT me.id
           FROM master_entities me
           JOIN master_entity_types met ON me.entity_type_id = met.id
          WHERE me.is_active = 1
            AND met.code = ?
            AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
          LIMIT 1`,
        [entityTypeCode, normalizedBeneficiaryValue]
      );
      if (entityRows.length) {
        beneficiaryEntityId = Number(entityRows[0].id);
      }
    }

    if (!beneficiaryEntityId && entityTypeCode === 'INSTITUTION') {
      const [entityRows] = await conn.execute(
        `SELECT me.id
           FROM master_entities me
           JOIN master_entity_types met ON me.entity_type_id = met.id
          WHERE me.is_active = 1
            AND met.code = ?
          ORDER BY me.id ASC
          LIMIT 2`,
        [entityTypeCode]
      );
      if (entityRows.length === 1) {
        beneficiaryEntityId = Number(entityRows[0].id);
      }
    }

    if (beneficiaryEntityId) {
      await conn.execute(
        `UPDATE budget_proposals
            SET beneficiary_entity_id = ?
          WHERE id = ?
            AND (beneficiary_entity_id IS NULL OR beneficiary_entity_id <= 0)`,
        [beneficiaryEntityId, proposalIdentifier]
      );
    }
  }

  const [updated] = await conn.execute(
    `UPDATE Budget_annual
        SET proposed_total_amount = proposed_total_amount + ?,
            approved_total_amount = approved_total_amount + ?,
            initial_total_amount = initial_total_amount + ?,
            additional_total_amount = additional_total_amount + ?,
            annual_total_amount = annual_total_amount + ?,
            balance_total_amount = (initial_total_amount + ?) + (additional_total_amount + ?) - expenditure_total_amount
      WHERE fiscal_year = ?
        AND LOWER(TRIM(beneficiary_type)) = LOWER(TRIM(?))
        AND department_id <=> ?
        AND COALESCE(entity_id, beneficiary_entity_id) <=> ?`,
    [
      delta,
      delta,
      initialDelta,
      additionalDelta,
      delta,
      initialDelta,
      additionalDelta,
      fiscalYear,
      beneficiaryType,
      departmentId,
      beneficiaryEntityId,
    ]
  );

  if (Number(updated?.affectedRows || 0) === 0 && delta > 0) {
    await conn.execute(
      `INSERT INTO Budget_annual (
          fiscal_year,
          beneficiary_type,
          beneficiary_entity_id,
          department_id,
          entity_id,
          proposed_total_amount,
          approved_total_amount,
          initial_total_amount,
          additional_total_amount,
          expenditure_total_amount,
          balance_total_amount,
          annual_total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        fiscalYear,
        beneficiaryType,
        beneficiaryEntityId,
        departmentId,
        beneficiaryEntityId,
        amount,
        amount,
        isInitial ? amount : 0,
        isInitial ? 0 : amount,
        amount,
        amount,
      ]
    );
  }

  if (delta < 0) {
    await conn.execute(
      `DELETE FROM Budget_annual
        WHERE fiscal_year = ?
          AND LOWER(TRIM(beneficiary_type)) = LOWER(TRIM(?))
          AND department_id <=> ?
          AND COALESCE(entity_id, beneficiary_entity_id) <=> ?
          AND annual_total_amount <= 0
          AND approved_total_amount <= 0`,
      [fiscalYear, beneficiaryType, departmentId, beneficiaryEntityId]
    );
  }
}

export async function getBudgetTags() {
  try {
    const [rows] = await db.execute(
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
    throw error;
  }
}

export async function searchApplicant(query = '', employeeType = null) {
  return userResolvers.searchApplicant(query, employeeType);
}

export function getDefaultFreezeCutoffDate(fiscalYear) {
  return sharedGetDefaultFreezeCutoffDate(fiscalYear);
}

export async function getFreezeConfig(fiscalYear) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  let rows = [];
  try {
    const [resultRows] = await db.execute(
      `SELECT fiscal_year, cutoff_date, is_frozen, updated_at
         FROM budget_time_freeze_config
         WHERE fiscal_year = ?
         LIMIT 1`,
      [fy]
    );
    rows = resultRows;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return {
        fiscalYear: fy,
        cutoffDate: getDefaultFreezeCutoffDate(fy),
        isFrozen: false,
        updatedAt: null,
      };
    }
    throw error;
  }

  if (!rows.length) {
    return {
      fiscalYear: fy,
      cutoffDate: getDefaultFreezeCutoffDate(fy),
      isFrozen: false,
      updatedAt: null,
    };
  }

  const row = rows[0];
  return {
    fiscalYear: Number(row.fiscal_year),
    cutoffDate: row.cutoff_date ? String(row.cutoff_date) : getDefaultFreezeCutoffDate(fy),
    isFrozen: Number(row.is_frozen) === 1,
    updatedAt: row.updated_at || null,
  };
}

export async function upsertFreezeConfig({
  fiscalYear,
  cutoffDate,
  isFrozen,
  updatedByUserId,
  updatedByEmail,
}) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const freezeFlag = Number(isFrozen) === 1 ? 1 : 0;
  const safeCutoffDate = cutoffDate || getDefaultFreezeCutoffDate(fy);

  await db.execute(
    `INSERT INTO budget_time_freeze_config
        (fiscal_year, cutoff_date, is_frozen, updated_by_user_id, updated_by_email)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        cutoff_date = VALUES(cutoff_date),
        is_frozen = VALUES(is_frozen),
        updated_by_user_id = VALUES(updated_by_user_id),
        updated_by_email = VALUES(updated_by_email),
        updated_at = CURRENT_TIMESTAMP`,
    [
      fy,
      safeCutoffDate,
      freezeFlag,
      Number.isInteger(Number(updatedByUserId)) ? Number(updatedByUserId) : null,
      normalizeText(updatedByEmail) || null,
    ]
  );

  // Keep persisted proposal classification in sync with updated cutoff.
  if (await hasBudgetProposalColumn('budget_window_type')) {
    await db.execute(
      `UPDATE budget_proposals bp
       SET bp.budget_window_type = CASE
         WHEN COALESCE(bp.request_date, DATE(bp.created_at))
              <= COALESCE(?, STR_TO_DATE(CONCAT(bp.fiscal_year, '-02-01'), '%Y-%m-%d'))
           THEN 'initial'
         ELSE 'additional'
       END
       WHERE bp.fiscal_year = ?`,
      [safeCutoffDate, fy]
    );
  }

  return getFreezeConfig(fy);
}

function encodeArchiveFeedback(feedback, proposal) {
  const snapshot = {
    previousStatus: normalizeText(proposal?.status),
    previousStage: normalizeText(proposal?.current_stage),
  };
  const encodedSnapshot = Buffer.from(JSON.stringify(snapshot), 'utf8').toString('base64');
  const userFeedback = normalizeText(feedback);

  return userFeedback
    ? `${ARCHIVE_META_PREFIX}${encodedSnapshot}\n${userFeedback}`
    : `${ARCHIVE_META_PREFIX}${encodedSnapshot}`;
}

function decodeArchiveSnapshot(feedback) {
  const rawFeedback = normalizeText(feedback);

  if (!rawFeedback.startsWith(ARCHIVE_META_PREFIX)) {
    return null;
  }

  const encodedPayload = rawFeedback
    .slice(ARCHIVE_META_PREFIX.length)
    .split(/\r?\n/, 1)[0]
    .trim();

  if (!encodedPayload) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    const previousStatus = normalizeText(parsed?.previousStatus);
    const previousStage = normalizeText(parsed?.previousStage);

    if (!previousStatus || !previousStage) {
      return null;
    }

    return { previousStatus, previousStage };
  } catch {
    return null;
  }
}

function deriveUnarchiveFallbackState(proposal, archiveRole) {
  const flowStages = normalizeText(proposal?.approval_flow)
    .split('_')
    .map((stage) => normalizeText(stage).toLowerCase())
    .filter(Boolean);

  const normalizedArchiveRole = normalizeText(archiveRole).toLowerCase();
  const includesLevel1 = flowStages.includes('level1');
  const includesDof = flowStages.includes('dof');

  if (['level1', 'hod', 'coordinator'].includes(normalizedArchiveRole)) {
    return { previousStatus: 'submitted', previousStage: 'level1' };
  }

  if (normalizedArchiveRole === 'dof') {
    return {
      previousStatus: includesLevel1 ? 'level1_approved' : 'submitted',
      previousStage: 'dof',
    };
  }

  if (normalizedArchiveRole === 'principal') {
    return {
      previousStatus: includesDof ? 'dof_approved' : includesLevel1 ? 'level1_approved' : 'submitted',
      previousStage: 'principal',
    };
  }

  const firstStage = flowStages[0] || 'level1';

  if (firstStage === 'dof') {
    return { previousStatus: 'submitted', previousStage: 'dof' };
  }

  if (firstStage === 'principal') {
    return { previousStatus: 'submitted', previousStage: 'principal' };
  }

  return { previousStatus: 'submitted', previousStage: 'level1' };
}

export async function getProposalForArchiveToggle(proposalId, conn = db) {
  const parsedProposalId = Number(proposalId);

  if (!Number.isInteger(parsedProposalId) || parsedProposalId <= 0) {
    return null;
  }

  const [rows] = await conn.execute(
    `SELECT id, status, current_stage, approval_flow
       FROM budget_proposals
       WHERE id = ?
         AND LOWER(TRIM(status)) <> 'deleted'
       LIMIT 1`,
    [parsedProposalId]
  );

  return rows[0] || null;
}

export async function toggleArchiveState(proposalId, { role, feedback, approverUserId, approverEmail, isSuperAdmin }) {
  const parsedProposalId = Number(proposalId);

  if (!Number.isInteger(parsedProposalId) || parsedProposalId <= 0) {
    throw new Error('Invalid proposal ID');
  }

  return withTransaction(async (conn) => {
    const proposal = await getProposalForArchiveToggle(parsedProposalId, conn);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const isArchived = ['archive', 'archived'].includes(normalizeText(proposal.status).toLowerCase())
      || ['archive', 'archived'].includes(normalizeText(proposal.current_stage).toLowerCase());

    if (!isArchived) {
      await conn.execute(
        `UPDATE budget_proposals
           SET status = 'archived', current_stage = 'archived', updated_at = NOW()
           WHERE id = ?`,
        [parsedProposalId]
      );

      await conn.execute(
        `INSERT INTO budget_proposal_approvals(
            budget_proposal_id, role, approver_user_id, approver_email,
            decision, feedback, allows_edit
          ) VALUES(?, ?, ?, ?, 'archived', ?, 0)`,
        [
          parsedProposalId,
          normalizeText(role).toLowerCase() || 'admin',
          Number(approverUserId),
          normalizeText(approverEmail),
          encodeArchiveFeedback(feedback, proposal),
        ]
      );

      return { action: 'archived', proposal };
    }

    const [archiveRows] = await conn.execute(
      `SELECT role, approver_user_id, approver_email, feedback
         FROM budget_proposal_approvals
         WHERE budget_proposal_id = ?
           AND LOWER(TRIM(decision)) IN ('archive', 'archived')
         ORDER BY decided_at DESC, id DESC
         LIMIT 1`,
      [parsedProposalId]
    );

    if (!archiveRows.length) {
      throw new Error('Cannot unarchive: archive record not found');
    }

    const latestArchive = archiveRows[0];
    const requesterEmail = normalizeText(approverEmail).toLowerCase();
    const archivedByEmail = normalizeText(latestArchive.approver_email).toLowerCase();
    const requesterUserId = Number(approverUserId);
    const archivedByUserId = Number(latestArchive.approver_user_id);
    const sameUserById = Number.isInteger(requesterUserId)
      && requesterUserId > 0
      && Number.isInteger(archivedByUserId)
      && archivedByUserId > 0
      && requesterUserId === archivedByUserId;
    const sameUserByEmail = requesterEmail.length > 0 && requesterEmail === archivedByEmail;

    if (!sameUserById && !sameUserByEmail && !isSuperAdmin) {
      return { error: 'Only the user who archived this proposal can unarchive it (or a super admin)' };
    }

    const snapshotFromFeedback = decodeArchiveSnapshot(latestArchive.feedback);
    const fallbackState = deriveUnarchiveFallbackState(proposal, latestArchive.role);
    const restoreState = snapshotFromFeedback || fallbackState;

    await conn.execute(
      `UPDATE budget_proposals
         SET status = ?, current_stage = ?, updated_at = NOW()
         WHERE id = ?`,
      [restoreState.previousStatus, restoreState.previousStage, parsedProposalId]
    );

    await conn.execute(
      `INSERT INTO budget_proposal_approvals(
          budget_proposal_id, role, approver_user_id, approver_email,
          decision, feedback, allows_edit
        ) VALUES(?, ?, ?, ?, 'unarchived', ?, 0)`,
      [
        parsedProposalId,
        normalizeText(latestArchive.role).toLowerCase() || 'admin',
        requesterUserId,
        normalizeText(approverEmail),
        normalizeText(feedback) || `Restored to ${restoreState.previousStage}`,
      ]
    );

    return { action: 'unarchived', proposal };
  });
}

export async function updateApprovedAmounts(
  proposalId,
  payload,
  { editorRole, editorUserId, editorEmail } = {}
) {
  const proposal = await getBudgetById(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  const normalizedCurrentStatus = normalizeText(proposal.status).toLowerCase();
  const isTerminalStatus =
    ['archived', 'archive', 'completed'].includes(normalizedCurrentStatus)
    || normalizedCurrentStatus.includes('rejected')
    || normalizedCurrentStatus.includes('returned');

  if (isTerminalStatus) {
    throw new Error(`Proposal cannot be processed from status: ${proposal.status}`);
  }

  return withTransaction(async (conn) => {
    try {
      await conn.execute(
        `ALTER TABLE budget_proposal_lines
           ADD COLUMN approved_month_allocations_json LONGTEXT NULL AFTER approved_line_total`
      );
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }

    const [existingLines] = await conn.execute(
      `SELECT id, budget_head, sub_head, line_description, quantity, unit_amount, line_total, approved_unit_amount, approved_line_total, approved_month_allocations_json
         FROM budget_proposal_lines
         WHERE budget_proposal_id = ?
         ORDER BY id`,
      [proposalId]
    );

    const incomingLines = Array.isArray(payload?.lines) ? payload.lines : [];
    if (!incomingLines.length || !existingLines.length) {
      throw new Error('At least one budget line required');
    }

    const [proposedAllocationRows] = await conn.execute(
      `SELECT m.budget_line_id AS line_id, m.month, m.amount
         FROM budget_line_month_allocations m
         JOIN budget_proposal_lines l ON l.id = m.budget_line_id
         WHERE l.budget_proposal_id = ?`,
      [proposalId]
    );
    const normalizeMonthKey = (value) => {
      const monthValue = normalizeText(value);
      if (!monthValue) return '';
      const direct = VALID_MONTHS.find((month) => month === monthValue);
      if (direct) return direct;
      const lower = monthValue.toLowerCase();
      return VALID_MONTHS.find((month) => month.toLowerCase() === lower) || '';
    };

    const normalizeMonthMap = (raw = {}) => {
      const out = {};
      for (const month of VALID_MONTHS) {
        out[month] = Number(raw?.[month] || 0);
      }
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [monthKey, amount] of Object.entries(raw)) {
          const normalizedMonth = normalizeMonthKey(monthKey);
          if (!normalizedMonth) continue;
          out[normalizedMonth] = Number(amount || 0);
        }
      }
      return out;
    };

    const toMonthMapByLine = (rows = []) => {
      const map = new Map();
      for (const row of rows) {
        const lineId = Number(row?.line_id);
        const month = normalizeMonthKey(row?.month);
        if (!Number.isInteger(lineId) || !VALID_MONTHS.includes(month)) continue;
        if (!map.has(lineId)) map.set(lineId, {});
        map.get(lineId)[month] = Number(row?.amount || 0);
      }
      return map;
    };

    const toDiffLabel = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '0';
      return Number.isInteger(numeric) ? String(numeric) : String(Number(numeric.toFixed(2)));
    };

    const proposedMonthByLineId = toMonthMapByLine(proposedAllocationRows);
    const incomingByLineId = new Map();
    for (const line of incomingLines) {
      const lineId = Number(line?.line_id);
      if (Number.isInteger(lineId) && lineId > 0) {
        incomingByLineId.set(lineId, line);
      }
    }

    const upto = Math.min(existingLines.length, incomingLines.length);
    const changedRows = [];
    const lineChangeDetails = [];
    const proposalChanges = [];
    const normalizedEditorRole = normalizeText(editorRole).toLowerCase();
    const logRole = normalizedEditorRole === 'level1'
      ? (isEntityBeneficiaryType(proposal.beneficiary_type) ? 'coordinator' : 'hod')
      : normalizedEditorRole || 'admin';
    const parseApprovedMonthJson = (value) => {
      if (!value) return {};
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
      } catch {
        return {};
      }
    };

    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
    const hasBudgetTagColumn = await hasBudgetProposalColumn('budget_tag');
    const hasTagInput = hasBudgetTagColumn && hasOwn(payload, 'budget_tag');
    const hasBeneficiaryEmployeeInput =
      Number.isInteger(Number.parseInt(payload?.beneficiary_employee_id, 10))
      && Number(payload?.beneficiary_employee_id) > 0;
    const hasBeneficiaryInput =
      hasOwn(payload, 'beneficiary_type') ||
      hasOwn(payload, 'beneficiary_value') ||
      hasBeneficiaryEmployeeInput;

    if (hasTagInput || hasBeneficiaryInput) {
      const oldBeneficiaryType = normalizeBeneficiaryType(proposal?.beneficiary_type);
      const oldBeneficiaryValue = normalizeText(proposal?.beneficiary_value);
      const oldTag = normalizeText(proposal?.budget_tag);
      const oldApprovalFlow = normalizeText(proposal?.approval_flow);

      const nextBeneficiaryType = hasOwn(payload, 'beneficiary_type')
        ? normalizeBeneficiaryType(payload?.beneficiary_type)
        : oldBeneficiaryType;
      const nextBeneficiaryValue = hasOwn(payload, 'beneficiary_value')
        ? normalizeText(payload?.beneficiary_value)
        : oldBeneficiaryValue;
      const nextBeneficiaryEmployeeId = hasOwn(payload, 'beneficiary_employee_id')
        ? payload?.beneficiary_employee_id
        : null;
      const nextTag = hasTagInput ? normalizeText(payload?.budget_tag) : oldTag;

      let nextDepartmentId = await resolveDepartmentId(conn, {
        beneficiary_type: nextBeneficiaryType,
        beneficiary_value: nextBeneficiaryValue,
        department: payload?.department || proposal?.department,
      });
      const shouldPreserveExistingFacultyRouting =
        ['Faculty', 'Staff'].includes(normalizeBeneficiaryType(nextBeneficiaryType))
        && !Number.isInteger(Number.parseInt(nextBeneficiaryEmployeeId, 10))
        && normalizeBeneficiaryType(nextBeneficiaryType) === normalizeBeneficiaryType(proposal?.beneficiary_type)
        && nextBeneficiaryValue === normalizeText(proposal?.beneficiary_value);
      let entityTypeCode = null;
      let beneficiaryEntityId = null;

      if (shouldPreserveExistingFacultyRouting) {
        nextDepartmentId =
          proposal?.department_id != null && Number.isInteger(Number(proposal.department_id))
            ? Number(proposal.department_id)
            : nextDepartmentId;
        beneficiaryEntityId =
          proposal?.beneficiary_entity_id != null && Number.isInteger(Number(proposal.beneficiary_entity_id))
            ? Number(proposal.beneficiary_entity_id)
            : null;

        if (Number.isInteger(Number(beneficiaryEntityId)) && Number(beneficiaryEntityId) > 0) {
          const existingEntity = await getEntityById(conn, Number(beneficiaryEntityId));
          entityTypeCode = normalizeEntityTypeCode(existingEntity?.type_code);
        }
      } else {
        const resolvedBeneficiary = await resolveBeneficiaryEntity(
          conn,
          nextBeneficiaryType,
          nextBeneficiaryValue,
          nextBeneficiaryEmployeeId
        );
        entityTypeCode = resolvedBeneficiary.entityTypeCode;
        beneficiaryEntityId = resolvedBeneficiary.beneficiaryEntityId;
      }

      if (
        nextDepartmentId == null &&
        !hasOwn(payload, 'department') &&
        normalizeBeneficiaryType(nextBeneficiaryType) !== 'Department'
      ) {
        nextDepartmentId =
          proposal?.department_id != null && Number.isInteger(Number(proposal.department_id))
            ? Number(proposal.department_id)
            : null;
      }

      const flow = await resolveApprovalFlow(nextBeneficiaryType, entityTypeCode, conn, {
        budgetTag: nextTag,
      });
      const nextApprovalFlow = formatApprovalFlowString(flow);

      if (oldBeneficiaryType !== nextBeneficiaryType) {
        proposalChanges.push(`Beneficiary Type changed from "${oldBeneficiaryType || '-'}" to "${nextBeneficiaryType || '-'}"`);
      }
      if (oldBeneficiaryValue !== nextBeneficiaryValue) {
        proposalChanges.push(`Beneficiary Value changed from "${oldBeneficiaryValue || '-'}" to "${nextBeneficiaryValue || '-'}"`);
      }
      if (oldTag !== nextTag) {
        proposalChanges.push(`Tag changed from "${oldTag || '-'}" to "${nextTag || '-'}"`);
      }
      if (oldApprovalFlow !== nextApprovalFlow) {
        proposalChanges.push(`Approval Flow changed from "${oldApprovalFlow || '-'}" to "${nextApprovalFlow || '-'}"`);
      }

      const proposalSet = [
        'beneficiary_type = ?',
        'beneficiary_value = ?',
        'beneficiary_entity_id = ?',
        'department_id = ?',
        'approval_flow = ?',
      ];
      const toNullablePositiveInt = (value) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      };

      const proposalParams = [
        nextBeneficiaryType,
        nextBeneficiaryValue || null,
        toNullablePositiveInt(beneficiaryEntityId),
        toNullablePositiveInt(nextDepartmentId),
        nextApprovalFlow,
      ];

      if (hasBudgetTagColumn) {
        proposalSet.push('budget_tag = ?');
        proposalParams.push(nextTag || null);
      }

      await conn.execute(
        `UPDATE budget_proposals
           SET ${proposalSet.join(', ')},
               updated_at = NOW()
           WHERE id = ?`,
        [...proposalParams, proposalId]
      );
    }

    const incomingLineIds = new Set(incomingLines.map(l => Number(l.line_id)).filter(id => Number.isInteger(id) && id > 0));

    // Handle line deletions
    for (let idx = 0; idx < existingLines.length; idx += 1) {
      const prevLine = existingLines[idx];
      const lineNo = idx + 1;
      
      if (!incomingLineIds.has(Number(prevLine.id))) {
        await conn.execute('DELETE FROM budget_line_month_allocations WHERE budget_line_id = ?', [prevLine.id]);
        await conn.execute('DELETE FROM budget_proposal_lines WHERE id = ?', [prevLine.id]);
        changedRows.push(lineNo);
        lineChangeDetails.push({ lineNo, changes: ['Line removed'] });
      }
    }

    // Handle updates and additions
    for (let idx = 0; idx < incomingLines.length; idx += 1) {
      const incoming = incomingLines[idx];
      const lineId = Number(incoming.line_id);
      const prevLine = Number.isInteger(lineId) && lineId > 0 ? existingLines.find((l) => Number(l.id) === lineId) : null;
      const isExistingLine = Boolean(prevLine);
      const lineNo = idx + 1;

      if (isExistingLine) {
        const oldBudgetHead = normalizeText(prevLine.budget_head);
        const oldSubHead = normalizeText(prevLine.sub_head);
        const oldDescription = normalizeText(prevLine.line_description);
        const nextBudgetHead = hasOwn(incoming, 'budget_head')
          ? normalizeText(incoming?.budget_head)
          : oldBudgetHead;
        const nextSubHead = hasOwn(incoming, 'sub_head')
          ? normalizeText(incoming?.sub_head)
          : oldSubHead;
        const nextDescription = hasOwn(incoming, 'line_description')
          ? normalizeText(incoming?.line_description)
          : oldDescription;
        const previousApprovedUnit = Number(prevLine.approved_unit_amount ?? prevLine.unit_amount) || 0;
        const previousApprovedLineTotal = Number(prevLine.approved_line_total ?? prevLine.line_total) || 0;
        const inferredApprovedQuantity =
          previousApprovedUnit > 0
            ? (previousApprovedLineTotal / previousApprovedUnit)
            : Number(prevLine.quantity || 1);
        const baseQuantity = Number.isFinite(inferredApprovedQuantity) && inferredApprovedQuantity > 0
          ? inferredApprovedQuantity
          : (Number(prevLine.quantity) || 1);
        const effectiveQuantity = Number.isFinite(Number(incoming.quantity)) && Number(incoming.quantity) > 0
          ? Number(incoming.quantity)
          : baseQuantity;
        const nextApprovedUnit = Number.isFinite(Number(incoming.unit_amount))
          ? Number(incoming.unit_amount)
          : previousApprovedUnit;
        const nextApprovedLineTotal = Number((nextApprovedUnit * effectiveQuantity).toFixed(2));
        const changes = [];

        const baseMonthMap = normalizeMonthMap(
          parseApprovedMonthJson(prevLine.approved_month_allocations_json)
          || proposedMonthByLineId.get(Number(prevLine.id))
          || {}
        );
        const nextMonthMap = normalizeMonthMap(incoming.month_allocations || baseMonthMap);
        const monthDiffs = [];
        for (const month of VALID_MONTHS) {
          const from = Number(baseMonthMap[month] || 0);
          const to = Number(nextMonthMap[month] || 0);
          if (Math.abs(from - to) > 0.01) {
            monthDiffs.push(`${month}: ${toDiffLabel(from)} -> ${toDiffLabel(to)}`);
          }
        }

        if (Number(nextApprovedUnit.toFixed(2)) !== Number(previousApprovedUnit.toFixed(2))) {
          changes.push(`Approved Unit Amount changed from ${previousApprovedUnit} to ${nextApprovedUnit}`);
        }

        if (Math.abs(Number(effectiveQuantity) - Number(baseQuantity)) > 0.0001) {
          changes.push(`Quantity changed from ${toDiffLabel(baseQuantity)} to ${toDiffLabel(effectiveQuantity)}`);
        }

        if (Number(nextApprovedLineTotal.toFixed(2)) !== Number(previousApprovedLineTotal.toFixed(2))) {
          changes.push(`Approved Line Total changed from ${previousApprovedLineTotal} to ${nextApprovedLineTotal}`);
        }

        if (monthDiffs.length > 0) {
          changes.push(`Month allocations changed (${monthDiffs.join(', ')})`);
        }

        if (oldBudgetHead !== nextBudgetHead) {
          changes.push(`Budget Head changed from "${oldBudgetHead || '-'}" to "${nextBudgetHead || '-'}"`);
        }

        if (oldSubHead !== nextSubHead) {
          changes.push(`Sub Head changed from "${oldSubHead || '-'}" to "${nextSubHead || '-'}"`);
        }

        if (oldDescription !== nextDescription) {
          changes.push('Description updated');
        }

        if (changes.length > 0) {
          await conn.execute(
            `UPDATE budget_proposal_lines
               SET budget_head = ?,
                   sub_head = ?,
                   line_description = ?,
                   approved_unit_amount = ?,
                   approved_line_total = ?,
                   approved_month_allocations_json = ?
               WHERE id = ?`,
            [
              nextBudgetHead || null,
              nextSubHead || null,
              nextDescription || null,
              nextApprovedUnit,
              nextApprovedLineTotal,
              JSON.stringify(nextMonthMap),
              prevLine.id,
            ]
          );

          if (!changedRows.includes(lineNo)) changedRows.push(lineNo);
          lineChangeDetails.push({ lineNo, changes });
        }
      } else {
        // Line added
        const newLineId = await insertBudgetLine(proposalId, incoming, conn);
        const nextMonthMap = normalizeMonthMap(incoming.month_allocations || {});
        for (const month of VALID_MONTHS) {
          if (nextMonthMap[month]) {
             await insertMonthAllocation(newLineId, month, nextMonthMap[month], conn);
          }
        }
        await conn.execute(
          `UPDATE budget_proposal_lines SET approved_month_allocations_json = ? WHERE id = ?`, 
          [JSON.stringify(nextMonthMap), newLineId]
        );
        if (!changedRows.includes(lineNo)) changedRows.push(lineNo);
        lineChangeDetails.push({ lineNo, changes: ['Line added'] });
      }
    }

    const hasAnyEdit = changedRows.length > 0 || proposalChanges.length > 0;

    if (changedRows.length > 0) {
      await conn.execute(
        `UPDATE budget_proposals bp
           SET bp.approved_total_amount = (
             SELECT COALESCE(SUM(COALESCE(bpl.approved_line_total, bpl.line_total)), 0)
             FROM budget_proposal_lines bpl
             WHERE bpl.budget_proposal_id = bp.id
           ),
           bp.updated_at = NOW()
           WHERE bp.id = ?`,
        [proposalId]
      );
    }

    if (hasAnyEdit) {
      const summaryParts = [];
      if (lineChangeDetails.length > 0) {
        summaryParts.push(`${lineChangeDetails.length} line(s) updated`);
      }
      if (proposalChanges.length > 0) {
        summaryParts.push(`${proposalChanges.length} proposal field(s) updated`);
      }
      const editSummary = summaryParts.join(' | ') || 'Proposal updated';

      try {
        await conn.execute(
          `INSERT INTO budget_proposal_edits
              (budget_proposal_id, edited_by_user_id, edited_by_email, summary, details)
             VALUES (?, ?, ?, ?, ?)`,
          [
            proposalId,
            editorUserId || null,
            normalizeText(editorEmail) || null,
            editSummary,
            JSON.stringify({
              editorRole: normalizedEditorRole || 'admin',
              lines: lineChangeDetails,
              proposalChanges,
            }),
          ]
        );
      } catch (error) {
        if (error?.code !== 'ER_NO_SUCH_TABLE') {
          throw error;
        }
      }

      const feedbackParts = [];
      if (changedRows.length > 0) {
        feedbackParts.push(`Approved values updated for Row No. ${changedRows.join(', ')}`);
      }
      if (proposalChanges.length > 0) {
        feedbackParts.push(`Proposal fields updated: ${proposalChanges.join('; ')}`);
      }
      const rowText = feedbackParts.join(' | ') || 'Proposal updated';

      await conn.execute(
        `INSERT INTO budget_proposal_approvals(
            budget_proposal_id, role, approver_user_id, approver_email,
            decision, feedback, allows_edit
          ) VALUES(?, ?, ?, ?, 'updated', ?, 0)`,
        [proposalId, logRole, Number(editorUserId), normalizeText(editorEmail), rowText]
      );
    }

    return {
      changedRows,
    };
  });
}

export function getCurrentFinancialYear() {
  return sharedGetCurrentFinancialYear();
}

export async function getUserAssignments(userId) {
  return userResolvers.getUserAssignments(userId);
}

export function beneficiaryTypeToEntityTypeCode(beneficiaryType) {
  return sharedBeneficiaryTypeToEntityTypeCode(beneficiaryType);
}

export function isEntityBeneficiaryType(beneficiaryType) {
  return sharedIsEntityBeneficiaryType(beneficiaryType);
}

export function resolveLevel1Route(proposalOrPayload = {}) {
  return sharedResolveLevel1Route(proposalOrPayload);
}

function pickEntityLevel1Contact(contacts = []) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return null;
  }

  const normalizedContacts = contacts
    .map((contact) => ({
      id: Number(contact.id),
      role: normalizeText(contact.role).toLowerCase(),
      email: normalizeText(contact.email).toLowerCase(),
      is_primary: Number(contact.is_primary) === 1,
    }))
    .filter((contact) => contact.email.length > 0);

  if (!normalizedContacts.length) {
    return null;
  }

  const byRoleHod = normalizedContacts.find((contact) => contact.role === 'hod');
  if (byRoleHod) {
    return byRoleHod;
  }

  const byRoleOffice = normalizedContacts.find((contact) => contact.role === 'office');
  if (byRoleOffice) {
    return byRoleOffice;
  }

  const primaryContact = normalizedContacts.find((contact) => contact.is_primary);
  if (primaryContact) {
    return primaryContact;
  }

  return normalizedContacts[0];
}

export async function resolveEntityLevel1Assignee(entityId, conn = db) {
  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    return null;
  }

  const [rows] = await conn.execute(
    `SELECT id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id = ?
       ORDER BY id ASC`,
    [parsedEntityId]
  );

  const selectedContact = pickEntityLevel1Contact(rows);

  if (!selectedContact) {
    return null;
  }

  return {
    id: selectedContact.id,
    role: selectedContact.role,
    email: selectedContact.email,
    is_primary: selectedContact.is_primary,
  };
}

export function resolveLevel1AssignmentStatus({ routeType, assigneeEmail } = {}) {
  return sharedResolveLevel1AssignmentStatus({ routeType, assigneeEmail });
}

async function resolveEntityAssigneeMap(entityIds = [], conn = db) {
  const uniqueEntityIds = [
    ...new Set(
      entityIds
        .map((entityId) => Number(entityId))
        .filter((entityId) => Number.isInteger(entityId) && entityId > 0)
    ),
  ];

  const assigneeMap = new Map();

  if (!uniqueEntityIds.length) {
    return assigneeMap;
  }

  const [rows] = await conn.query(
    `SELECT entity_id, id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id IN (?)
       ORDER BY entity_id ASC, id ASC`,
    [uniqueEntityIds]
  );

  const groupedContacts = new Map();

  for (const row of rows) {
    const entityId = Number(row.entity_id);
    if (!groupedContacts.has(entityId)) {
      groupedContacts.set(entityId, []);
    }
    groupedContacts.get(entityId).push(row);
  }

  for (const [entityId, contacts] of groupedContacts.entries()) {
    const selectedContact = pickEntityLevel1Contact(contacts);
    if (selectedContact) {
      assigneeMap.set(entityId, selectedContact);
    }
  }

  return assigneeMap;
}

async function attachLevel1AssignmentMetadata(rows = [], conn = db) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const entityIds = rows
    .map((row) => resolveLevel1Route(row))
    .filter((route) => route.routeType === LEVEL1_ROUTE_TYPE.entityContact)
    .map((route) => Number(route.entityId))
    .filter((entityId) => Number.isInteger(entityId) && entityId > 0);
  const entityAssigneeMap = await resolveEntityAssigneeMap(entityIds, conn);

  return rows.map((row) => {
    const level1Route = resolveLevel1Route(row);
    const entityAssignee =
      level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact
        ? entityAssigneeMap.get(level1Route.entityId) || null
        : null;
    const assigneeEmail = entityAssignee?.email || null;

    return {
      ...row,
      level1_route_type: level1Route.routeType,
      level1_assignee_email: assigneeEmail,
      level1_assignment_status: resolveLevel1AssignmentStatus({
        routeType: level1Route.routeType,
        assigneeEmail,
      }),
    };
  });
}

export function groupAllocationsByLine(allocations) {
  return sharedGroupAllocationsByLine(allocations);
}


export async function withTransaction(callback) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw new Error(`Transaction failed: ${error.message}`);
  } finally {
    conn.release();
  }
}

export async function getUserDepartmentByUserId(userId) {
  return userResolvers.getUserDepartmentByUserId(userId);
}

export async function getEmployeeDepartmentByEmployeeId(employeeId) {
  return userResolvers.getEmployeeDepartmentByEmployeeId(employeeId);
}

export async function getUserDepartmentByEmail(userEmail) {
  return userResolvers.getUserDepartmentByEmail(userEmail);
}


export async function getDepartmentByName(name, conn = db) {
  return orgUnitQueries.getDepartmentByName(name, conn);
}

async function resolveDepartmentId(conn, payload) {
  const beneficiaryType = normalizeText(payload?.beneficiary_type);
  const beneficiaryValue = normalizeText(payload?.beneficiary_value);
  const requestDepartment = normalizeText(payload?.department);

  if (beneficiaryType === 'Department' && beneficiaryValue) {
    const department = await getDepartmentByName(beneficiaryValue, conn);

    if (!department) {
      throw new Error(`Invalid department beneficiary: ${beneficiaryValue}`);
    }

    return Number(department.id);
  }

  if (!requestDepartment) {
    return null;
  }

  const department = await getDepartmentByName(requestDepartment, conn);
  return department ? Number(department.id) : null;
}

async function resolveBeneficiaryEntity(conn, beneficiaryType, beneficiaryValue, beneficiaryEmployeeId = null) {
  const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
  const entityTypeCode = beneficiaryTypeToEntityTypeCode(beneficiaryType);

  if (['Faculty', 'Staff'].includes(normalizedBeneficiaryType)) {
    const parsedBeneficiaryEmployeeId = Number.parseInt(beneficiaryEmployeeId, 10);

    if (!Number.isInteger(parsedBeneficiaryEmployeeId) || parsedBeneficiaryEmployeeId <= 0) {
      return { entityTypeCode: null, beneficiaryEntityId: null };
    }

    const employeeContext = await getEmployeeDepartmentByEmployeeId(parsedBeneficiaryEmployeeId);
    const beneficiaryEntityId = Number(employeeContext?.entity_id);
    const beneficiaryEntityTypeCode = normalizeEntityTypeCode(employeeContext?.entity_type_code);

    if (!Number.isInteger(beneficiaryEntityId) || beneficiaryEntityId <= 0 || !beneficiaryEntityTypeCode) {
      return { entityTypeCode: null, beneficiaryEntityId: null };
    }

    const entityRecord = await getEntityById(conn, beneficiaryEntityId);
    if (!entityRecord || entityRecord.is_active !== 1) {
      return { entityTypeCode: null, beneficiaryEntityId: null };
    }

    return {
      entityTypeCode: beneficiaryEntityTypeCode,
      beneficiaryEntityId,
    };
  }

  if (!entityTypeCode) {
    return { entityTypeCode: null, beneficiaryEntityId: null };
  }

  const normalizedBeneficiaryValue = normalizeText(beneficiaryValue);

  if (!normalizedBeneficiaryValue) {
    throw new Error(`beneficiary_value required for ${beneficiaryType}`);
  }

  const [rows] = await conn.execute(
    `SELECT me.id
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.is_active = 1
         AND met.code = ?
         AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
       LIMIT 1`,
    [entityTypeCode, normalizedBeneficiaryValue]
  );

  if (!rows.length) {
    throw new Error(`Invalid beneficiary_value for ${beneficiaryType}: ${normalizedBeneficiaryValue}`);
  }

  return {
    entityTypeCode,
    beneficiaryEntityId: Number(rows[0].id),
  };
}


export async function resolveApprovalFlow(beneficiaryType, entityTypeCode = null, conn = db, options = {}) {
  return resolveSharedApprovalFlow(beneficiaryType, entityTypeCode, conn, options);
}













function mapDecisionToStageState(decision) {
  const normalizedDecision = normalizeText(decision).toLowerCase();

  if (normalizedDecision === 'approved') {
    return 'approved';
  }

  if (normalizedDecision === 'rejected') {
    return 'rejected';
  }

  if (normalizedDecision === 'returned') {
    return 'returned';
  }

  return 'pending';
}

export async function listSuperAdminFlowBudgets({
  page = 1,
  limit = 20,
  status,
  fiscalYear,
  q,
  department,
}) {
  const budgetsResult = await listBudgets({
    role: 'super_admin',
    page,
    limit,
    status,
    fiscalYear,
    q,
    departmentFilter: department,
  });

  const budgets = Array.isArray(budgetsResult.budgets) ? budgetsResult.budgets : [];

  if (!budgets.length) {
    return {
      rows: [],
      pagination: budgetsResult.pagination,
    };
  }

  const proposalIds = budgets
    .map((budget) => Number(budget.id))
    .filter((proposalId) => Number.isInteger(proposalId) && proposalId > 0);

  let approvalRows = [];

  if (proposalIds.length > 0) {
    const [rows] = await db.query(
      `SELECT
           bpa.id,
           bpa.budget_proposal_id,
           bpa.role,
           bpa.decision,
           bpa.feedback,
           bpa.approver_email,
           bpa.approver_user_id,
           bpa.allows_edit,
           bpa.decided_at,
           DATE_FORMAT(bpa.decided_at, '%Y-%m-%d %H:%i') AS decided_at_formatted,
           CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS approver_name
         FROM budget_proposal_approvals bpa
         LEFT JOIN master_employees emp ON bpa.approver_user_id = emp.user_id AND emp.status = 'Active'
         WHERE bpa.budget_proposal_id IN (?)
         ORDER BY bpa.decided_at ASC, bpa.id ASC`,
      [proposalIds]
    );
    approvalRows = rows;
  }

  const approvalsByProposal = new Map();

  for (const approval of approvalRows) {
    const proposalId = Number(approval.budget_proposal_id);
    if (!approvalsByProposal.has(proposalId)) {
      approvalsByProposal.set(proposalId, []);
    }
    approvalsByProposal.get(proposalId).push(approval);
  }

  const level1AssigneeEmails = [
    ...new Set(
      budgets
        .map((budget) => normalizeText(budget.level1_assignee_email).toLowerCase())
        .filter((email) => email.length > 0)
    ),
  ];

  const level1AssigneeNameMap = new Map();

  if (level1AssigneeEmails.length > 0) {
    const [assigneeRows] = await db.query(
      `SELECT
           LOWER(TRIM(email)) AS email_key,
           CONCAT(first_name, ' ', COALESCE(last_name, '')) AS full_name
         FROM master_employees
         WHERE status = 'Active'
           AND LOWER(TRIM(email)) IN (?)`,
      [level1AssigneeEmails]
    );

    for (const assignee of assigneeRows) {
      const emailKey = normalizeText(assignee.email_key).toLowerCase();
      if (emailKey) {
        level1AssigneeNameMap.set(emailKey, normalizeText(assignee.full_name) || null);
      }
    }
  }

  const rows = budgets.map((budget) => {
    const proposalId = Number(budget.id);
    const proposalApprovals = approvalsByProposal.get(proposalId) || [];
    const approvalByRole = new Map();

    for (const approval of proposalApprovals) {
      const roleKey = normalizeText(approval.role).toLowerCase();
      if (roleKey) {
        approvalByRole.set(roleKey, approval);
      }
    }

    const flowStages = new Set(
      normalizeText(budget.approval_flow)
        .split('_')
        .map((stage) => normalizeText(stage).toLowerCase())
        .filter(Boolean)
    );
    const currentStage = normalizeText(budget.current_stage).toLowerCase();
    const currentStageIndex = WORKFLOW_STAGES.indexOf(currentStage);

    const buildStage = (stageKey) => {
      const stageIndex = WORKFLOW_STAGES.indexOf(stageKey);
      const requiresStage = flowStages.has(stageKey);
      const approval = approvalByRole.get(stageKey) || null;
      const stageStatusToken = `${stageKey}_approved`;

      let state = 'pending';

      if (!requiresStage) {
        state = 'not_required';
      } else if (approval) {
        state = mapDecisionToStageState(approval.decision);
      } else if (
        stageKey === 'level1' &&
        budget.level1_assignment_status === LEVEL1_ASSIGNMENT_STATUS.unassigned
      ) {
        state = 'unassigned';
      } else if (currentStage === stageKey) {
        state = 'pending';
      } else if (
        currentStage === 'completed' ||
        (currentStageIndex >= 0 && stageIndex >= 0 && currentStageIndex > stageIndex) ||
        normalizeText(budget.status).toLowerCase().includes(stageStatusToken)
      ) {
        state = 'approved';
      }

      let approverEmail = approval?.approver_email
        ? normalizeText(approval.approver_email).toLowerCase()
        : null;
      let approverName = normalizeText(approval?.approver_name) || null;

      if (!approval && stageKey === 'level1' && budget.level1_assignee_email) {
        approverEmail = normalizeText(budget.level1_assignee_email).toLowerCase();
        approverName = level1AssigneeNameMap.get(approverEmail) || null;
      }

      return {
        state,
        decision: approval?.decision || null,
        approverName,
        approverEmail,
        label: resolveStageLabel(stageKey, budget),
        decidedAt: approval?.decided_at_formatted || approval?.decided_at || null,
        isAuto: stageKey === 'principal' && approverEmail === 'system-auto@ksrct.ac.in',
      };
    };

    return {
      proposalId,
      proposalRef: budget.proposal_ref,
      fiscalYear: budget.fiscal_year,
      facultyName: normalizeText(budget.faculty_name) || null,
      requesterEmail: normalizeText(budget.user_email).toLowerCase() || null,
      beneficiaryType: budget.beneficiary_type,
      beneficiaryValue: budget.beneficiary_value,
      department: budget.department,
      totalAmount: Number(budget.total_amount || 0),
      status: budget.status,
      currentStage: budget.current_stage,
      approvalFlow: budget.approval_flow,
      createdDate: budget.created_date,
      level1_route_type: budget.level1_route_type || null,
      level1_assignee_email: budget.level1_assignee_email || null,
      level1_assignment_status: budget.level1_assignment_status || LEVEL1_ASSIGNMENT_STATUS.assigned,
      level1: buildStage('level1'),
      financeAdmin: buildStage('dof'),
      principal: buildStage('principal'),
    };
  });

  return {
    rows,
    pagination: budgetsResult.pagination,
  };
}


export function resolveStageLabel(stageKey, proposal = {}) {
  return sharedResolveStageLabel(stageKey, proposal);
}

export async function dashboardAggregates({ department, departmentId, role, fiscalYear }) {
  const currentFY = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const params = [currentFY];
  const where = ['bp.fiscal_year = ?', "LOWER(TRIM(bp.status)) <> 'deleted'"];

  if (normalizeBudgetRole(role) === 'hod') {
    if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
      where.push('bp.department_id = ?');
      params.push(Number(departmentId));
    } else if (normalizeText(department)) {
      const departmentRow = await getDepartmentByName(department);
      if (departmentRow) {
        where.push('bp.department_id = ?');
        params.push(Number(departmentRow.id));
      } else {
        where.push('1 = 0');
      }
    } else {
      where.push('1 = 0');
    }
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const approvedSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) AS amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
        AND bp.status IN ('level1_approved', 'dof_approved', 'principal_approved', 'completed')
      GROUP BY bpl.budget_head
    `;

  const pendingSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) AS amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
        AND bp.status IN ('submitted', 'level1_approved')
      GROUP BY bpl.budget_head
    `;

  const [[approvedRows], [pendingRows]] = await Promise.all([
    db.execute(approvedSql, params),
    db.execute(pendingSql, params),
  ]);

  return {
    approved: approvedRows,
    pending: pendingRows,
    summary: {
      totalApproved: approvedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      totalPending: pendingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    },
  };
}

export async function getConsolidatedData({
  userId,
  userEmail,
  department,
  departmentId,
  role,
  fiscalYear,
  beneficiaryType,
  beneficiaryValue,
  q,
}) {
  const hasBudgetWindowTypeColumn = await hasBudgetProposalColumn('budget_window_type');
  const currentFY = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const safeRole = normalizeBudgetRole(role);
  const safeUserId = Number(userId) > 0 ? Number(userId) : -1;

  const where = ['bp.fiscal_year = ?', "LOWER(TRIM(bp.status)) <> 'deleted'"];
  const params = [Number(currentFY)];

  // 1. Role-based scoping (mirrored from buildBudgetList)
  switch (safeRole) {
    case 'hod': {
      where.push(`(
        (LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NULL)
        OR LOWER(TRIM(bp.beneficiary_type)) = 'department'
      )`);
      where.push('md.type = "Academic"');
      const hodAuthorizationScope = [];
      if (safeUserId > 0) {
        hodAuthorizationScope.push(`bp.department_id IN (
          SELECT entity_id
          FROM user_entity_roles
          WHERE user_id = ?
            AND entity_type = 'DEPARTMENT'
        )`);
        params.push(safeUserId);
      }
      where.push(hodAuthorizationScope.length ? `(${hodAuthorizationScope.join(' OR ')})` : '1 = 0');

      const hodFilterScope = [];
      if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
        hodFilterScope.push('bp.department_id = ?');
        params.push(Number(departmentId));
      }
      if (normalizeText(department)) {
        const normalizedDept = normalizeText(department);
        hodFilterScope.push(`(LOWER(TRIM(md.name)) = LOWER(TRIM(?)) OR LOWER(TRIM(md.code)) = LOWER(TRIM(?)) OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(?)))`);
        params.push(normalizedDept, normalizedDept, normalizedDept);
      }
      if (hodFilterScope.length) {
        where.push(`(${hodFilterScope.join(' OR ')})`);
      }
      break;
    }
    case 'coordinator': {
      where.push(`(
        LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body', 'section')
        OR (LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NOT NULL)
      )`);
      const filterConditions = [];
      if (safeUserId > 0) {
        filterConditions.push(`me.id IN (SELECT entity_id FROM user_entity_roles WHERE user_id = ? AND entity_type IN ('CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'))`);
        params.push(safeUserId);
      }
      if (userEmail) {
        filterConditions.push('EXISTS (SELECT 1 FROM master_entity_contacts mec_sub WHERE mec_sub.entity_id = me.id AND LOWER(TRIM(mec_sub.email)) = LOWER(TRIM(?)))');
        params.push(userEmail);
      }
      where.push(filterConditions.length ? `(${filterConditions.join(' OR ')})` : '1 = 0');
      break;
    }
    case 'ithead':
      where.push('LOWER(TRIM(bp.budget_tag)) = LOWER(TRIM(?))');
      params.push('IT Infrastructure');
      break;
    case 'dof':
    case 'principal':
    case 'admin':
    case 'super_admin':
      break;
    default:
      // General users shouldn't really be calling this, but for safety:
      where.push('(bp.user_id = ? OR bp.user_email = ?)');
      params.push(safeUserId, normalizeText(userEmail));
      break;
  }

  // 2. Status scoping:
  // - keep proposed visible for pre-approval records
  // - compute approved/initial/additional only for approval-reached statuses
  where.push(`LOWER(TRIM(bp.status)) NOT LIKE '%rejected%'`);
  where.push(`LOWER(TRIM(bp.status)) NOT LIKE '%returned%'`);
  where.push(`LOWER(TRIM(bp.status)) NOT LIKE '%archive%'`);

  let approvedCondition = "1=0";
  if (safeRole === 'hod' || safeRole === 'coordinator') {
    approvedCondition = "bp.status IN ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
  } else if (safeRole === 'ithead') {
    approvedCondition = "bp.status IN ('ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
  } else if (safeRole === 'dof') {
    approvedCondition = "bp.status IN ('dof_approved', 'principal_approved', 'completed')";
  } else {
    approvedCondition = "bp.status IN ('principal_approved', 'completed')";
  }

  // Capture available beneficiary types before applying user-selected filters (beneficiaryType, q)
  const typesSql = `
    SELECT DISTINCT bp.beneficiary_type
    FROM budget_proposals bp
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    WHERE ${where.join(' AND ')}
    ORDER BY bp.beneficiary_type ASC
  `;
  const [typeRows] = await db.execute(typesSql, params);
  const availableBeneficiaryTypes = typeRows.map(tr => tr.beneficiary_type).filter(Boolean);

  // 3. Other Filters
  if (normalizeText(beneficiaryType) && normalizeText(beneficiaryType).toLowerCase() !== 'all') {
    where.push('LOWER(TRIM(bp.beneficiary_type)) = LOWER(TRIM(?))');
    params.push(normalizeText(beneficiaryType));
  }

  if (normalizeText(beneficiaryValue)) {
    const val = normalizeText(beneficiaryValue);
    where.push(`(
      LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(?))
      OR LOWER(TRIM(md.name)) = LOWER(TRIM(?))
      OR LOWER(TRIM(me.name)) = LOWER(TRIM(?))
    )`);
    params.push(val, val, val);
  }

  if (normalizeText(q)) {
    const searchPattern = `%${normalizeText(q)}%`;
    where.push(`(
      bp.proposal_ref LIKE ?
      OR bp.beneficiary_value LIKE ?
      OR md.name LIKE ?
      OR me.name LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;
  const cutoffExpr = `COALESCE(
    (
      SELECT CONCAT(CAST(btf.cutoff_date AS CHAR), ' 23:59:59')
      FROM budget_time_freeze_config btf
      WHERE btf.fiscal_year = bp.fiscal_year
      LIMIT 1
    ),
    CONCAT(bp.fiscal_year, '-02-01 23:59:59')
  )`;
  const persistedWindowExpr = hasBudgetWindowTypeColumn
    ? "NULLIF(LOWER(TRIM(bp.budget_window_type)), '')"
    : "NULL";
  const windowTypeExpr = `COALESCE(
    ${persistedWindowExpr},
    CASE
      WHEN COALESCE(TIMESTAMP(bp.request_date, '23:59:59'), bp.created_at) <= ${cutoffExpr}
        THEN 'initial'
      ELSE 'additional'
    END
  )`;

  const sql = `
    SELECT
      bpl.budget_head AS budgetHead,
      SUM(COALESCE(bpl.approved_line_total, bpl.line_total, 0)) AS proposed,
      SUM(CASE WHEN ${approvedCondition} THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END) AS approved,
      SUM(CASE WHEN ${windowTypeExpr} = 'initial' THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END) AS initial,
      SUM(CASE WHEN ${windowTypeExpr} = 'additional' THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END) AS additional,
      0 AS expenditure
    FROM budget_proposals bp
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
    ${whereClause}
    GROUP BY bpl.budget_head
    ORDER BY bpl.budget_head ASC
  `;

  const [rows] = await db.execute(sql, params);

  // Also fetch details per budget head for the expanded view
  // To avoid N+1 later, we'll fetch all lines with proposal/applicant info
  const hasApplicantName = await hasBudgetProposalColumn('applicant_name');
  
  const applicantNameExpr = hasApplicantName 
    ? `COALESCE(NULLIF(TRIM(bp.applicant_name), ''), NULLIF(TRIM(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))), ''), bp.user_email)`
    : `COALESCE(NULLIF(TRIM(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))), ''), bp.user_email)`;

  const detailsSql = `
    SELECT
      bpl.budget_head,
      bpl.sub_head,
      bp.id AS proposalId,
      ${applicantNameExpr} AS applicantName,
      COALESCE(bpl.approved_line_total, bpl.line_total, 0) AS proposedAmount,
      CASE WHEN ${approvedCondition} THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END AS approvedAmount,
      CASE WHEN ${windowTypeExpr} = 'initial' THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END AS initialAmount,
      CASE WHEN ${windowTypeExpr} = 'additional' THEN COALESCE(bpl.approved_line_total, bpl.line_total, 0) ELSE 0 END AS additionalAmount
    FROM budget_proposals bp
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    LEFT JOIN master_employees applicant_emp ON bp.user_id = applicant_emp.user_id AND applicant_emp.status = 'Active'
    JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
    ${whereClause}
    ORDER BY bpl.budget_head ASC, bpl.sub_head ASC
  `;

  const [detailRows] = await db.execute(detailsSql, params);

  const detailsByHead = {};
  for (const row of detailRows) {
    if (!detailsByHead[row.budget_head]) {
      detailsByHead[row.budget_head] = [];
    }
    detailsByHead[row.budget_head].push({
      proposalId: row.proposalId,
      applicantName: row.applicantName,
      subHead: row.sub_head,
      proposedAmount: Number(row.proposedAmount || 0),
      approvedAmount: Number(row.approvedAmount || 0),
      initialAmount: Number(row.initialAmount || 0),
      additionalAmount: Number(row.additionalAmount || 0),
    });
  }

  return {
    consolidatedRows: rows.map(r => ({
      ...r,
      proposed: Number(r.proposed || 0),
      approved: Number(r.approved || 0),
      initial: Number(r.initial || 0),
      additional: Number(r.additional || 0),
      expenditure: Number(r.expenditure || 0),
      balance: Number(r.initial || 0) + Number(r.additional || 0) - Number(r.expenditure || 0)
    })),
    detailsByHead,
    availableBeneficiaryTypes
  };
}

export async function listBudgetAnnualSummaryEntries({
  userId,
  userEmail,
  department,
  departmentId,
  role,
  fiscalYear,
  q,
}) {
  const hasBudgetWindowTypeColumn = await hasBudgetProposalColumn('budget_window_type');
  const tableExists = await hasBudgetAnnualTable(db);
  if (!tableExists) {
    return [];
  }

  const currentFY = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const safeRole = normalizeBudgetRole(role);
  const safeUserId = Number(userId) > 0 ? Number(userId) : -1;
  const safeEmail = normalizeText(userEmail);
  const where = ['ba.fiscal_year = ?'];
  const params = [Number(currentFY)];

  switch (safeRole) {
    case 'hod': {
      where.push(`LOWER(TRIM(ba.beneficiary_type)) = 'department'`);
      where.push('md.type = "Academic"');
      const hodAuthorizationScope = [];
      if (safeUserId > 0) {
        hodAuthorizationScope.push(`ba.department_id IN (
          SELECT entity_id
          FROM user_entity_roles
          WHERE user_id = ?
            AND entity_type = 'DEPARTMENT'
        )`);
        params.push(safeUserId);
      }
      where.push(hodAuthorizationScope.length ? `(${hodAuthorizationScope.join(' OR ')})` : '1 = 0');

      const hodFilterScope = [];
      if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
        hodFilterScope.push('ba.department_id = ?');
        params.push(Number(departmentId));
      }
      if (normalizeText(department)) {
        const normalizedDept = normalizeText(department);
        hodFilterScope.push(`(LOWER(TRIM(md.name)) = LOWER(TRIM(?)) OR LOWER(TRIM(md.code)) = LOWER(TRIM(?)))`);
        params.push(normalizedDept, normalizedDept);
      }
      if (hodFilterScope.length) {
        where.push(`(${hodFilterScope.join(' OR ')})`);
      }
      break;
    }
    case 'coordinator': {
      where.push(`LOWER(TRIM(ba.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body', 'section')`);
      const filterConditions = [];
      if (safeUserId > 0) {
        filterConditions.push(`me.id IN (SELECT entity_id FROM user_entity_roles WHERE user_id = ? AND entity_type IN ('CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'))`);
        params.push(safeUserId);
      }
      if (safeEmail) {
        filterConditions.push('EXISTS (SELECT 1 FROM master_entity_contacts mec_sub WHERE mec_sub.entity_id = me.id AND LOWER(TRIM(mec_sub.email)) = LOWER(TRIM(?)))');
        params.push(safeEmail);
      }
      where.push(filterConditions.length ? `(${filterConditions.join(' OR ')})` : '1 = 0');
      break;
    }
    case 'ithead':
    case 'dof':
    case 'principal':
    case 'admin':
    case 'super_admin':
      break;
    default:
      where.push('1 = 0');
      break;
  }

  if (normalizeText(q)) {
    const searchPattern = `%${normalizeText(q)}%`;
    where.push(`(
      ba.beneficiary_type LIKE ?
      OR md.name LIKE ?
      OR me.name LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const sql = `
    SELECT
      ba.id,
      'completed' AS status,
      ba.beneficiary_type,
      ba.department_id,
      COALESCE(ba.entity_id, ba.beneficiary_entity_id) AS beneficiary_entity_id,
      md.name AS department,
      COALESCE(md.name, me.name, NULLIF(TRIM(ba.beneficiary_type), ''), CONCAT('Unknown #', ba.id)) AS beneficiary_label,
      ba.created_at AS created_at,
      ba.proposed_total_amount,
      ba.approved_total_amount,
      ba.initial_total_amount,
      ba.additional_total_amount,
      ba.expenditure_total_amount,
      ba.balance_total_amount,
      ba.annual_total_amount
    FROM Budget_annual ba
    LEFT JOIN master_departments md ON ba.department_id = md.id
    LEFT JOIN master_entities me ON COALESCE(ba.entity_id, ba.beneficiary_entity_id) = me.id
    WHERE ${where.join(' AND ')}
    ORDER BY ba.beneficiary_type ASC, beneficiary_label ASC
  `;

  const [rows] = await db.execute(sql, params);
  const annualRows = Array.isArray(rows) ? rows : [];

  // Include pre-approval proposed data so summary shows proposals even before approval.
  // This is primarily consumed by DOF/Super Admin summary views.
  const pendingWhere = ['bp.fiscal_year = ?', "LOWER(TRIM(bp.status)) <> 'deleted'"];
  const pendingParams = [Number(currentFY)];

  switch (safeRole) {
    case 'dof':
    case 'principal':
    case 'admin':
    case 'super_admin':
      break;
    default:
      // Keep legacy scoping for non-admin roles if endpoint is ever called directly.
      pendingWhere.push('1 = 0');
      break;
  }

  pendingWhere.push(`LOWER(TRIM(bp.status)) NOT LIKE '%rejected%'`);
  pendingWhere.push(`LOWER(TRIM(bp.status)) NOT LIKE '%returned%'`);
  pendingWhere.push(`LOWER(TRIM(bp.status)) NOT LIKE '%archive%'`);
  pendingWhere.push(`LOWER(TRIM(bp.status)) NOT IN ('principal_approved', 'completed')`);

  if (normalizeText(q)) {
    const searchPattern = `%${normalizeText(q)}%`;
    pendingWhere.push(`(
      bp.beneficiary_type LIKE ?
      OR md.name LIKE ?
      OR me.name LIKE ?
      OR bp.beneficiary_value LIKE ?
    )`);
    pendingParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const pendingSql = `
    SELECT
      CASE
        WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN 'Department'
        WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'section') THEN CONCAT(UPPER(LEFT(TRIM(bp.beneficiary_type), 1)), LOWER(SUBSTRING(TRIM(bp.beneficiary_type), 2)))
        WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
        ELSE TRIM(bp.beneficiary_type)
      END AS beneficiary_type,
      CASE
        WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN bp.department_id
        ELSE NULL
      END AS department_id,
      CASE
        WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
        ELSE bp.beneficiary_entity_id
      END AS beneficiary_entity_id,
      CASE
        WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN md.name
        ELSE COALESCE(me.name, bp.beneficiary_value)
      END AS beneficiary_label,
      SUM(COALESCE(bpl.line_total, 0)) AS proposed_total_amount,
      SUM(
        CASE
          WHEN COALESCE(
            ${hasBudgetWindowTypeColumn ? "NULLIF(LOWER(TRIM(bp.budget_window_type)), '')" : "NULL"},
            CASE
              WHEN COALESCE(bp.request_date, DATE(bp.created_at))
                   <= COALESCE(
                        (
                          SELECT btf.cutoff_date
                          FROM budget_time_freeze_config btf
                          WHERE btf.fiscal_year = bp.fiscal_year
                          LIMIT 1
                        ),
                        STR_TO_DATE(CONCAT(bp.fiscal_year, '-02-01'), '%Y-%m-%d')
                      )
                THEN 'initial'
              ELSE 'additional'
            END
          ) = 'initial'
            THEN COALESCE(bpl.line_total, 0)
          ELSE 0
        END
      ) AS initial_total_amount,
      SUM(
        CASE
          WHEN COALESCE(
            ${hasBudgetWindowTypeColumn ? "NULLIF(LOWER(TRIM(bp.budget_window_type)), '')" : "NULL"},
            CASE
              WHEN COALESCE(bp.request_date, DATE(bp.created_at))
                   <= COALESCE(
                        (
                          SELECT btf.cutoff_date
                          FROM budget_time_freeze_config btf
                          WHERE btf.fiscal_year = bp.fiscal_year
                          LIMIT 1
                        ),
                        STR_TO_DATE(CONCAT(bp.fiscal_year, '-02-01'), '%Y-%m-%d')
                      )
                THEN 'initial'
              ELSE 'additional'
            END
          ) = 'additional'
            THEN COALESCE(bpl.line_total, 0)
          ELSE 0
        END
      ) AS additional_total_amount
    FROM budget_proposals bp
    JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    WHERE ${pendingWhere.join(' AND ')}
    GROUP BY beneficiary_type, department_id, beneficiary_entity_id, beneficiary_label
  `;

  const [pendingRowsRaw] = await db.execute(pendingSql, pendingParams);
  const pendingRows = Array.isArray(pendingRowsRaw) ? pendingRowsRaw : [];

  const toKey = (row = {}) => {
    const type = normalizeText(row.beneficiary_type).toLowerCase() || 'unknown';
    const departmentIdVal = Number(row.department_id);
    const entityIdVal = Number(row.beneficiary_entity_id);
    const label = normalizeText(row.beneficiary_label).toLowerCase();
    if (Number.isInteger(departmentIdVal) && departmentIdVal > 0) return `${type}::dept::${departmentIdVal}`;
    if (Number.isInteger(entityIdVal) && entityIdVal > 0) return `${type}::entity::${entityIdVal}`;
    return `${type}::label::${label}`;
  };

  const mergedMap = new Map();
  for (const row of annualRows) {
    mergedMap.set(toKey(row), { ...row });
  }

  for (const row of pendingRows) {
    const key = toKey(row);
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, {
        id: null,
        status: 'submitted',
        beneficiary_type: row.beneficiary_type,
        department_id: row.department_id ?? null,
        beneficiary_entity_id: row.beneficiary_entity_id ?? null,
        department: null,
        beneficiary_label: row.beneficiary_label || '-',
        created_at: null,
        proposed_total_amount: Number(row.proposed_total_amount || 0),
        approved_total_amount: 0,
        initial_total_amount: Number(row.initial_total_amount || 0),
        additional_total_amount: Number(row.additional_total_amount || 0),
        expenditure_total_amount: 0,
        balance_total_amount: Number(row.proposed_total_amount || 0),
        annual_total_amount: 0,
      });
      continue;
    }
    existing.proposed_total_amount = Number(existing.proposed_total_amount || 0) + Number(row.proposed_total_amount || 0);
    existing.initial_total_amount = Number(existing.initial_total_amount || 0) + Number(row.initial_total_amount || 0);
    existing.additional_total_amount = Number(existing.additional_total_amount || 0) + Number(row.additional_total_amount || 0);
    existing.balance_total_amount = Number(existing.initial_total_amount || 0)
      + Number(existing.additional_total_amount || 0)
      - Number(existing.expenditure_total_amount || 0);
  }

  return Array.from(mergedMap.values()).sort((a, b) => {
    const typeA = normalizeText(a.beneficiary_type).toLowerCase();
    const typeB = normalizeText(b.beneficiary_type).toLowerCase();
    if (typeA !== typeB) return typeA.localeCompare(typeB);
    return normalizeText(a.beneficiary_label).localeCompare(normalizeText(b.beneficiary_label));
  });
}

/* =====================================================
   8. ORG UNIT / ENTITY HELPERS
===================================================== */
export async function getDepartments() {
  return orgUnitQueries.getDepartments();
}

export async function getEntitiesByType(typeCode) {
  return orgUnitQueries.getEntitiesByType(typeCode);
}

export async function getOrgUnitsByType(typeCode) {
  return orgUnitQueries.getOrgUnitsByType(typeCode);
}

export async function getAllOrgUnits() {
  return orgUnitQueries.getAllOrgUnits();
}

export async function getAllDepartments(beneficiaryType) {
  const normalizedType = sharedNormalizeBeneficiaryType(beneficiaryType);
  const typeLower = normalizedType.toLowerCase();
  
  if (['centre', 'cell', 'club', 'professional body', 'section'].includes(typeLower)) {
    // Only return entities that have at least one proposal
    const [rows] = await db.execute(
      `SELECT DISTINCT me.name 
       FROM budget_proposals bp
       JOIN master_entities me ON bp.beneficiary_entity_id = me.id
       WHERE LOWER(TRIM(bp.status)) <> 'deleted'
         AND LOWER(TRIM(bp.beneficiary_type)) = ? 
       ORDER BY name ASC`,
      [typeLower]
    );
    return rows;
  }

  if (['department', 'faculty', 'staff'].includes(typeLower)) {
    // Return Departments OR Entities associated with these proposals
    const [rows] = await db.execute(
      `SELECT DISTINCT name FROM (
         SELECT md.name AS name FROM budget_proposals bp JOIN master_departments md ON bp.department_id = md.id WHERE LOWER(TRIM(bp.status)) <> 'deleted' AND LOWER(TRIM(bp.beneficiary_type)) = ?
         UNION
         SELECT me.name AS name FROM budget_proposals bp JOIN master_entities me ON bp.beneficiary_entity_id = me.id WHERE LOWER(TRIM(bp.status)) <> 'deleted' AND LOWER(TRIM(bp.beneficiary_type)) = ?
       ) AS sub ORDER BY name ASC`,
      [typeLower, typeLower]
    );
    return rows;
  }

  // Default: Return any department or entity that has any proposals
  const [rows] = await db.execute(
    `SELECT DISTINCT name FROM (
       SELECT md.name AS name FROM budget_proposals bp JOIN master_departments md ON bp.department_id = md.id WHERE LOWER(TRIM(bp.status)) <> 'deleted'
       UNION
       SELECT me.name AS name FROM budget_proposals bp JOIN master_entities me ON bp.beneficiary_entity_id = me.id WHERE LOWER(TRIM(bp.status)) <> 'deleted'
     ) AS available WHERE name IS NOT NULL AND name != '' ORDER BY name ASC`
  );
  return rows;
}

export async function getOrgUnitEmails(orgUnitId) {
  return orgUnitQueries.getOrgUnitEmails(orgUnitId);
}

async function getEntityById(conn, entityId) {
  const [rows] = await conn.execute(
    `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              me.sort_order,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.id = ?
       LIMIT 1`,
    [entityId]
  );

  return rows[0] || null;
}

async function assertEntityInType(conn, typeCode, entityId) {
  const [rows] = await conn.execute(
    `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              me.sort_order,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.id = ? AND met.code = ?
       LIMIT 1`,
    [entityId, typeCode]
  );

  if (!rows.length) {
    throw new Error('Entity not found for the requested type');
  }

  return rows[0];
}

export async function createEntity(typeCode, payload) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(normalizedTypeCode)) {
    throw new Error('Invalid entity type code');
  }

  const name = normalizeText(payload?.name);

  if (!name) {
    throw new Error('name is required');
  }

  const code = normalizeText(payload?.code) || null;
  const sortOrder = Number.isFinite(Number(payload?.sort_order)) ? Number(payload.sort_order) : 0;
  const isActive = payload?.is_active === undefined ? 1 : payload.is_active ? 1 : 0;

  return withTransaction(async (conn) => {
    const [typeRows] = await conn.execute(
      'SELECT id FROM master_entity_types WHERE code = ? LIMIT 1',
      [normalizedTypeCode]
    );

    if (!typeRows.length) {
      throw new Error('Entity type not found');
    }

    const [insertResult] = await conn.execute(
      `INSERT INTO master_entities (entity_type_id, code, name, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      [typeRows[0].id, code, name, isActive, sortOrder]
    );

    return getEntityById(conn, insertResult.insertId);
  });
}

export async function updateEntity(typeCode, entityId, payload) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(normalizedTypeCode)) {
    throw new Error('Invalid entity type code');
  }

  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    throw new Error('Invalid entity id');
  }

  return withTransaction(async (conn) => {
    const existing = await assertEntityInType(conn, normalizedTypeCode, parsedEntityId);

    const nextName =
      payload?.name !== undefined ? normalizeText(payload.name) : normalizeText(existing.name);
    const nextCode =
      payload?.code !== undefined ? normalizeText(payload.code) || null : existing.code || null;
    const nextSortOrder =
      payload?.sort_order !== undefined && Number.isFinite(Number(payload.sort_order))
        ? Number(payload.sort_order)
        : Number(existing.sort_order || 0);
    const nextIsActive =
      payload?.is_active !== undefined ? (payload.is_active ? 1 : 0) : existing.is_active ? 1 : 0;

    if (!nextName) {
      throw new Error('name is required');
    }

    await conn.execute(
      `UPDATE master_entities
         SET code = ?,
             name = ?,
             is_active = ?,
             sort_order = ?,
             updated_at = NOW()
         WHERE id = ?`,
      [nextCode, nextName, nextIsActive, nextSortOrder, parsedEntityId]
    );

    return getEntityById(conn, parsedEntityId);
  });
}

export async function deleteEntity(typeCode, entityId) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(normalizedTypeCode)) {
    throw new Error('Invalid entity type code');
  }

  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    throw new Error('Invalid entity id');
  }

  return withTransaction(async (conn) => {
    await assertEntityInType(conn, normalizedTypeCode, parsedEntityId);
    const [result] = await conn.execute('DELETE FROM master_entities WHERE id = ?', [parsedEntityId]);
    return result.affectedRows > 0;
  });
}

export async function getEntityContacts(typeCode, entityId) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(normalizedTypeCode)) {
    throw new Error('Invalid entity type code');
  }

  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    throw new Error('Invalid entity id');
  }

  await assertEntityInType(db, normalizedTypeCode, parsedEntityId);

  const [rows] = await db.execute(
    `SELECT id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id = ?
       ORDER BY is_primary DESC, role ASC, email ASC`,
    [parsedEntityId]
  );

  return rows;
}

export async function updateEntityContacts(typeCode, entityId, contacts = []) {
  const normalizedTypeCode = normalizeEntityTypeCode(typeCode);

  if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(normalizedTypeCode)) {
    throw new Error('Invalid entity type code');
  }

  const parsedEntityId = Number(entityId);

  if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
    throw new Error('Invalid entity id');
  }

  const normalizedContacts = (Array.isArray(contacts) ? contacts : [])
    .map((contact) => ({
      role: ['office', 'hod', 'finance', 'generic'].includes(normalizeText(contact?.role).toLowerCase())
        ? normalizeText(contact.role).toLowerCase()
        : 'office',
      email: normalizeText(contact?.email).toLowerCase(),
      is_primary: contact?.is_primary ? 1 : 0,
    }))
    .filter((contact) => contact.email.length > 0);

  return withTransaction(async (conn) => {
    await assertEntityInType(conn, normalizedTypeCode, parsedEntityId);

    await conn.execute('DELETE FROM master_entity_contacts WHERE entity_id = ?', [parsedEntityId]);

    for (const contact of normalizedContacts) {
      await conn.execute(
        `INSERT INTO master_entity_contacts (entity_id, role, email, is_primary)
           VALUES (?, ?, ?, ?)`,
        [parsedEntityId, contact.role, contact.email, contact.is_primary]
      );
    }

    const [rows] = await conn.execute(
      `SELECT id, role, email, is_primary
         FROM master_entity_contacts
         WHERE entity_id = ?
         ORDER BY is_primary DESC, role ASC, email ASC`,
      [parsedEntityId]
    );

    return rows;
  });
}

async function insertBudgetLine(proposalId, line, conn) {
  const unitAmount = Number(line.unit_amount) || 0;
  const quantity = Number(line.quantity) || 1;
  const lineTotal = unitAmount * quantity;

  const [result] = await conn.execute(
    `INSERT INTO budget_proposal_lines (
        budget_proposal_id,
        budget_head,
        sub_head,
        unit_amount,
        approved_unit_amount,
        quantity,
        line_total,
        approved_line_total,
        line_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposalId,
      line.budget_head,
      line.sub_head || '',
      unitAmount,
      unitAmount,
      quantity,
      lineTotal,
      lineTotal,
      line.line_description || '',
    ]
  );

  return result.insertId;
}

async function insertMonthAllocation(lineId, month, amount, conn) {
  const normalizedAmount = parsePositiveAmount(amount);
  if (normalizedAmount === null) {
    throw new Error(`Invalid month allocation amount for ${month}`);
  }

  await conn.execute(
    'INSERT INTO budget_line_month_allocations (budget_line_id, month, amount) VALUES (?, ?, ?)',
    [lineId, month, normalizedAmount]
  );
}

async function deleteBudgetProposal(proposalId, actor = {}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT status
         FROM budget_proposals
        WHERE id = ?
        LIMIT 1
        FOR UPDATE`,
      [proposalId]
    );

    if (!rows.length) {
      return false;
    }

    if (normalizeText(rows[0]?.status).toLowerCase() === 'deleted') {
      return false;
    }

    const [result] = await conn.execute(
      `UPDATE budget_proposals
          SET status = 'deleted',
              current_stage = 'deleted',
              updated_at = NOW()
        WHERE id = ?`,
      [proposalId]
    );

    await applyBudgetAnnualDeltaByProposalId(proposalId, conn, 'subtract');

    const actorRole = normalizeText(actor?.role).toLowerCase() || 'admin';
    const actorUserId = Number.isInteger(Number(actor?.userId || actor?.id))
      ? Number(actor.userId || actor.id)
      : 0;
    const actorEmail = normalizeText(actor?.email) || '';
    const feedback = normalizeText(actor?.feedback) || 'Deleted by user';

    await conn.execute(
      `INSERT INTO budget_proposal_approvals(
          budget_proposal_id, role, approver_user_id, approver_email,
          decision, feedback, allows_edit
        ) VALUES(?, ?, ?, ?, 'deleted', ?, 0)`,
      [proposalId, actorRole, actorUserId, actorEmail, feedback]
    );

    return result.affectedRows > 0;
  });
}

export { deleteBudgetProposal as delete };

export async function processApproval(proposalId, { role, decision, feedback, approverUserId, approverEmail }) {
  const normalizedDecision = normalizeText(decision).toLowerCase();

  if (!['approved', 'rejected', 'returned', 'archived'].includes(normalizedDecision)) {
    throw new Error('Invalid decision');
  }

  const proposal = await getBudgetById(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }

  if (normalizedDecision === 'archived') {
    const logRole = normalizeText(role).toLowerCase() || 'admin';

    return withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE budget_proposals
           SET status = 'archived', current_stage = 'archived', updated_at = NOW()
           WHERE id = ? `,
        [proposalId]
      );

      await conn.execute(
        `INSERT INTO budget_proposal_approvals(
            budget_proposal_id, role, approver_user_id, approver_email,
            decision, feedback, allows_edit
          ) VALUES(?, ?, ?, ?, 'archived', ?, 0)`,
        [
          proposalId,
          logRole,
          approverUserId,
          approverEmail || '',
          feedback || '',
        ]
      );
    });
  }

  if (!['level1', 'ithead', 'dof', 'principal'].includes(role)) {
    throw new Error('Invalid role');
  }

  if (proposal.current_stage !== role) {
    throw new Error(`Stage mismatch: expected ${role}, got ${proposal.current_stage} `);
  }

  let newStatus = decision;
  let nextStage = role;
  const flowStages = normalizeText(proposal.approval_flow).split('_').filter(Boolean);
  const currentStageIndex = flowStages.indexOf(role);
  const dynamicNextStage =
    currentStageIndex >= 0 && currentStageIndex < flowStages.length - 1
      ? flowStages[currentStageIndex + 1]
      : 'completed';
  const requiresPrincipalStage = flowStages.includes('principal');
  const flow = APPROVAL_FLOW[role];

  if (normalizedDecision === 'approved') {
    newStatus = flow.approve;
    nextStage = dynamicNextStage || flow.next;

    if (role === 'dof' || role === 'principal') {
      newStatus = 'completed';
      nextStage = 'completed';
    }
  } else if (normalizedDecision === 'rejected') {
    newStatus = flow.reject;
  } else {
    newStatus = flow.returned;
    nextStage = role;
  }

  const displayRole = (role === 'level1')
    ? (isEntityBeneficiaryType(proposal.beneficiary_type) ? 'coordinator' : 'hod')
    : role;

  return withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE budget_proposals
         SET status = ?, current_stage = ?, updated_at = NOW()
         WHERE id = ? `,
      [newStatus, nextStage, proposalId]
    );

    if (normalizedDecision !== 'approved' && !normalizeText(feedback)) {
      throw new Error('Feedback required for reject/return');
    }

    await conn.execute(
      `INSERT INTO budget_proposal_approvals(
          budget_proposal_id, role, approver_user_id, approver_email,
          decision, feedback, allows_edit
        ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        displayRole,
        approverUserId,
        approverEmail || '',
        normalizedDecision,
        feedback || '',
        normalizedDecision === 'returned' ? 1 : 0,
      ]
    );

    if (role === 'dof' && normalizedDecision === 'approved' && requiresPrincipalStage) {
      await conn.execute(
        `INSERT INTO budget_proposal_approvals(
            budget_proposal_id, role, approver_user_id, approver_email,
            decision, feedback, allows_edit, decided_at
          ) VALUES(?, 'principal', ?, ?, 'approved', 'Auto-approved after DoF clearance', 0, NOW())`,
        [proposalId, approverUserId, 'system-auto@ksrct.ac.in']
      );
    }

    if (normalizedDecision === 'approved' && newStatus === 'completed') {
      await applyBudgetAnnualDeltaByProposalId(proposalId, conn, 'add');
    }
  });
}

export async function listBudgets({
  userId,
  userEmail,
  department,
  departmentId,
  role,
  superAdminQueueView = false,
  page = 1,
  limit = 10,
  status,
  fiscalYear,
  q,
  departmentFilter,
  beneficiaryType,
}) {
  const hasApplicantNameColumn = await hasBudgetProposalColumn('applicant_name');
  const hasBudgetTagColumn = await hasBudgetProposalColumn('budget_tag');
  const hasBudgetWindowTypeColumn = await hasBudgetProposalColumn('budget_window_type');
  const result = await buildBudgetList({
    userId,
    userEmail,
    department,
    departmentId,
    role,
    superAdminQueueView,
    page,
    limit,
    status,
    fiscalYear,
    q,
    departmentFilter,
    beneficiaryType,
    isAdminView: true,
    hasColumnCache: {
      applicant_name: hasApplicantNameColumn,
      budget_tag: hasBudgetTagColumn,
      budget_window_type: hasBudgetWindowTypeColumn,
    },
  });
  const enrichedRows = await attachLevel1AssignmentMetadata(result.rows);
  return {
    budgets: enrichedRows,
    pagination: result.pagination,
  };
}

export async function getKpiStats({
  userId,
  userEmail,
  department,
  departmentId,
  role,
  superAdminQueueView = false,
  fiscalYear,
  q,
  departmentFilter,
  beneficiaryType,
}) {
  return buildBudgetKpiStats({
    userId,
    userEmail,
    department,
    departmentId,
    role,
    superAdminQueueView,
    fiscalYear,
    q,
    departmentFilter,
    beneficiaryType,
    isAdminView: true
  });
}

export async function getBudgetById(proposalId) {
  const [rows] = await db.execute(
    `SELECT
        bp.*,
        DATE_FORMAT(bp.request_date, '%Y-%m-%d') AS request_date,
        md.name AS department,
        md.code AS department_code,
        me.name AS org_unit_name,
        me.code AS org_unit_code,
        met.name AS org_unit_type,
        met.code AS org_unit_type_code,
        emp.designation,
        emp.designation AS user_designation,
        emp.mobile,
        emp.mobile AS user_mobile,
        COALESCE(emp_parent_dept.name, emp_parent_dept_fallback.name, emp_dept.name) AS user_department,
        COALESCE(emp_parent_dept.name, emp_parent_dept_fallback.name, emp_dept.name) AS applicant_department,
        CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS user_name,
        CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS name
      FROM budget_proposals bp
      LEFT JOIN master_departments md ON bp.department_id = md.id
      LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
      LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
      LEFT JOIN master_employees emp ON bp.user_id = emp.user_id
      LEFT JOIN master_departments emp_dept ON emp.department_id = emp_dept.id
      LEFT JOIN master_departments emp_parent_dept ON emp.parent_department_id = emp_parent_dept.id
      LEFT JOIN master_departments emp_parent_dept_fallback ON emp_dept.parent_id = emp_parent_dept_fallback.id
      WHERE bp.id = ?
        AND LOWER(TRIM(bp.status)) <> 'deleted'`,
    [proposalId]
  );

  const proposal = rows[0] || null;
  if (!proposal) {
    return null;
  }

  if (normalizeBeneficiaryType(proposal.beneficiary_type) === 'Department') {
    proposal.beneficiary_value = normalizeText(proposal.department) || proposal.beneficiary_value;
  }

  return proposal;
}

export async function getFull(proposalId) {
  const master = await getBudgetById(proposalId);

  if (!master) {
    return null;
  }

  const [lines] = await db.execute(
    `SELECT *
       FROM budget_proposal_lines
       WHERE budget_proposal_id = ?
       ORDER BY id`,
    [proposalId]
  );

  const [allocations] = await db.execute(
    `SELECT l.id AS line_id, m.month, m.amount, l.budget_head, l.sub_head
       FROM budget_proposal_lines l
       JOIN budget_line_month_allocations m ON l.id = m.budget_line_id
       WHERE l.budget_proposal_id = ?
       ORDER BY l.id, FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
    [proposalId]
  );

  const approvedAllocationsByLineId = {};
  for (const line of lines) {
    const lineId = Number(line?.id);
    if (!Number.isInteger(lineId)) continue;
    const raw = line?.approved_month_allocations_json;
    if (!raw) continue;
    let parsed = null;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const normalized = {};
    for (const month of VALID_MONTHS) {
      normalized[month] = Number(parsed?.[month] || 0);
    }
    const hasAny = Object.values(normalized).some((v) => Number(v) !== 0);
    if (hasAny) {
      approvedAllocationsByLineId[lineId] = normalized;
    }
  }
  const approvedAllocations =
    Object.keys(approvedAllocationsByLineId).length > 0
      ? approvedAllocationsByLineId
      : null;

  const [approvals] = await db.execute(
    `SELECT *, DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i') AS decided_at_formatted
       FROM budget_proposal_approvals
       WHERE budget_proposal_id = ?
       ORDER BY decided_at ASC, id ASC`,
    [proposalId]
  );

  let edits = [];
  try {
    const [editRows] = await db.execute(
      `SELECT
           id,
           budget_proposal_id,
           edited_by_user_id,
           edited_by_email,
           summary,
           details,
           created_at,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at_formatted
         FROM budget_proposal_edits
         WHERE budget_proposal_id = ?
         ORDER BY created_at ASC, id ASC`,
      [proposalId]
    );
    edits = editRows;
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
  }

  return {
    master,
    lines,
    allocations: groupAllocationsByLine(allocations),
    approved_allocations: approvedAllocations,
    approvals,
    edits,
  };
}

export async function getManyFull(proposalIds) {
  if (!Array.isArray(proposalIds) || !proposalIds.length) return [];

  // 1. Fetch masters
  const [masters] = await db.query(
    "SELECT * FROM budget_proposals WHERE id IN (?) AND LOWER(TRIM(status)) <> 'deleted'",
    [proposalIds]
  );

  if (!masters.length) return [];

  const foundIds = masters.map((m) => m.id);

  // 2. Fetch lines
  const [lines] = await db.query(
    'SELECT * FROM budget_proposal_lines WHERE budget_proposal_id IN (?) ORDER BY id ASC',
    [foundIds]
  );

  // 3. Fetch allocations
  const [allocations] = await db.query(
    `SELECT l.id AS line_id, m.month, m.amount, l.budget_head, l.sub_head, l.budget_proposal_id
       FROM budget_proposal_lines l
       JOIN budget_line_month_allocations m ON l.id = m.budget_line_id
       WHERE l.budget_proposal_id IN (?)
       ORDER BY l.id, FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
    [foundIds]
  );

  // 4. Group data by proposal
  return masters.map((master) => {
    const proposalLines = lines.filter((l) => l.budget_proposal_id === master.id);
    const lineIds = proposalLines.map(l => l.id);
    const proposalAllocations = allocations.filter((a) => a.budget_proposal_id === master.id);
    
    const approvedAllocationsByLineId = {};
    for (const line of proposalLines) {
      const lineId = Number(line?.id);
      if (!Number.isInteger(lineId)) continue;
      const raw = line?.approved_month_allocations_json;
      if (!raw) continue;
      
      let parsed = null;
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        parsed = null;
      }
      
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
      
      const normalized = {};
      for (const month of VALID_MONTHS) {
        normalized[month] = Number(parsed?.[month] || 0);
      }
      
      const hasAny = Object.values(normalized).some((v) => Number(v) !== 0);
      if (hasAny) {
        approvedAllocationsByLineId[lineId] = normalized;
      }
    }

    return {
      master,
      lines: proposalLines,
      allocations: groupAllocationsByLine(proposalAllocations),
      approved_allocations: Object.keys(approvedAllocationsByLineId).length > 0 ? approvedAllocationsByLineId : null,
    };
  });
}

export async function validateUserAccess(proposalId, userId, userEmail, role, department, departmentId) {
  const proposal = await getBudgetById(proposalId);
  if (!proposal) return false;

  const uid = Number(userId);
  const pid = Number(proposal.user_id);
  const normalizedRole = normalizeBudgetRole(role);
  const emailMatch = proposal.user_email
    && userEmail
    && normalizeText(proposal.user_email).toLowerCase() === normalizeText(userEmail).toLowerCase();

  if (pid === uid || emailMatch) return true;

  switch (normalizedRole) {
    case 'user':
      return pid === uid || emailMatch;
    case 'hod':
    case 'coordinator':
    case 'level1': {
      const level1Route = resolveLevel1Route(proposal);
      if (level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact) {
        const normalizedUserEmail = normalizeText(userEmail).toLowerCase();
        if (normalizedUserEmail) {
          const [contacts] = await db.execute(`SELECT email FROM master_entity_contacts WHERE entity_id = ? `, [level1Route.entityId]);
          if (contacts.some((c) => normalizeText(c.email).toLowerCase() === normalizedUserEmail)) {
            return true;
          }
        }
        if (uid > 0) {
          const [uerRows] = await db.execute(
            `SELECT 1 FROM user_entity_roles WHERE user_id = ? AND entity_id = ? LIMIT 1`,
            [uid, level1Route.entityId]
          );
          if (uerRows.length > 0) return true;
        }
        return false;
      }

      const normalizedDepartment = normalizeText(department).toLowerCase();
      if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0 && proposal.department_id) {
        return Number(proposal.department_id) === Number(departmentId);
      }
      if (normalizedDepartment) {
        const proposalDepartmentName = normalizeText(proposal.department).toLowerCase();
        const proposalDepartmentCode = normalizeText(proposal.department_code).toLowerCase();
        const proposalBeneficiaryValue = normalizeText(proposal.beneficiary_value).toLowerCase();
        const proposalBeneficiaryType = normalizeBeneficiaryType(proposal.beneficiary_type).toLowerCase();
        if (proposalDepartmentName === normalizedDepartment || proposalDepartmentCode === normalizedDepartment) {
          return true;
        }
        if (proposalBeneficiaryType === 'department' && proposalBeneficiaryValue === normalizedDepartment) {
          return true;
        }
      }
      return false;
    }
    case 'ithead':
    case 'dof':
    case 'principal':
    case 'admin':
    case 'super_admin':
      return true;
    default:
      return pid === uid || emailMatch;
  }
}



export async function getApprovalFlowConfigs() {
  const [rows] = await db.execute(
    `SELECT afc.*, met.name AS entity_type_name
       FROM approval_flow_config afc
       LEFT JOIN master_entity_types met ON afc.entity_type_code = met.code
       WHERE afc.is_active = 1
         AND LOWER(TRIM(afc.module_key)) IN ('budget', '*')
       ORDER BY afc.beneficiary_type, met.name`
  );

  return rows.map((row) => {
    let flow = [];
    try {
      const parsedFlow = typeof row.flow === 'string' ? JSON.parse(row.flow) : row.flow;
      flow = Array.isArray(parsedFlow)
        ? parsedFlow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean)
        : [];
    } catch {
      flow = [];
    }

    return {
      ...row,
      flow,
      requiresLevel1: flow.includes('level1') ? 1 : 0,
      requiresDof: flow.includes('dof') ? 1 : 0,
      requiresPrincipal: flow.includes('principal') ? 1 : 0,
    };
  });
}

export async function updateApprovalFlowConfig(id, { requiresLevel1, requiresDof, requiresPrincipal, flow }) {
  let resolvedFlow = Array.isArray(flow)
    ? [...new Set(flow.map((stage) => normalizeText(stage).toLowerCase()).filter(Boolean))]
    : [];

  if (!resolvedFlow.length) {
    resolvedFlow = [];
    if (Number(requiresLevel1) === 1) resolvedFlow.push('level1');
    if (Number(requiresDof) === 1) resolvedFlow.push('dof');
    if (Number(requiresPrincipal) === 1) resolvedFlow.push('principal');
  }

  if (!resolvedFlow.length) {
    resolvedFlow = ['level1', 'dof', 'principal'];
  }

  if (resolvedFlow.some((stage) => !WORKFLOW_STAGE_KEY_REGEX.test(stage))) {
    throw new Error('Flow contains invalid stage key. Use lowercase snake_case stage keys only.');
  }

  const [result] = await db.execute(
    `UPDATE approval_flow_config
       SET flow = ?,
           updated_at = NOW()
       WHERE id = ?`,
    [JSON.stringify(resolvedFlow), id]
  );

  return result.affectedRows > 0;
}

export async function getBudgetStatsByFY(fiscalYear, options = {}) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const { role } = options;

  let where = "bp.fiscal_year = ? AND LOWER(TRIM(bp.status)) <> 'deleted'";
  const params = [fy];

  if (role && role !== 'admin' && role !== 'super_admin') {
     // For now, simpler scoping for stats or we can just leave it global if it's purely for dashboard overview
     // But to be secure, if a role is passed, we should probably scope it.
     // However, the dashboard 'Overview' card usually shows the big picture.
     // If we really want to scope it:
     if (role === 'hod' || role === 'coordinator') {
        // ... complicated SQL injection for role scoping ...
        // Actually, if we want to BE SECURE, we should probably NOT show global stats to non-admins.
     }
  }

  const [stats] = await db.execute(
    `SELECT
         COUNT(DISTINCT bp.id) AS total_proposals,
         SUM(bp.total_amount) AS total_amount,
         COUNT(DISTINCT CASE WHEN bp.status LIKE '%_approved' THEN bp.id END) AS approved_count,
         SUM(CASE WHEN bp.status LIKE '%_approved' THEN bp.total_amount ELSE 0 END) AS approved_amount,
         COUNT(DISTINCT CASE WHEN bp.status = 'submitted' THEN bp.id END) AS pending_count,
         SUM(CASE WHEN bp.status = 'submitted' THEN bp.total_amount ELSE 0 END) AS pending_amount,
         COUNT(DISTINCT CASE WHEN bp.status LIKE '%_rejected' THEN bp.id END) AS rejected_count
       FROM budget_proposals bp
       WHERE ${where}`,
    params
  );

  const [byDepartment] = await db.execute(
    `SELECT
         md.name AS department,
         COUNT(*) AS proposal_count,
         SUM(bp.total_amount) AS total_amount
       FROM budget_proposals bp
       LEFT JOIN master_departments md ON bp.department_id = md.id
       WHERE bp.fiscal_year = ?
         AND LOWER(TRIM(bp.status)) <> 'deleted'
         AND bp.department_id IS NOT NULL
       GROUP BY md.name
       ORDER BY total_amount DESC`,
    [fy]
  );

  const [byBeneficiary] = await db.execute(
    `SELECT
         bp.beneficiary_type,
         COUNT(*) AS proposal_count,
         SUM(bp.total_amount) AS total_amount
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ?
         AND LOWER(TRIM(bp.status)) <> 'deleted'
       GROUP BY bp.beneficiary_type
       ORDER BY proposal_count DESC`,
    [fy]
  );

  return {
    overall: stats[0],
    byDepartment,
    byBeneficiaryType: byBeneficiary,
  };
}


export async function getProposalDataForExport(proposalId) {
  const master = await getBudgetById(proposalId);

  if (!master) {
    return null;
  }

  const [lines] = await db.execute(
    `SELECT bpl.*,
              GROUP_CONCAT(
                CONCAT(m.month, ':', m.amount)
                ORDER BY FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})
                SEPARATOR '|'
              ) AS month_allocations_str
       FROM budget_proposal_lines bpl
       LEFT JOIN budget_line_month_allocations m ON bpl.id = m.budget_line_id
       WHERE bpl.budget_proposal_id = ?
       GROUP BY bpl.id`,
    [proposalId]
  );

  const [approvals] = await db.execute(
    `SELECT role,
              id,
              decision,
              feedback,
              approver_email,
              DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i:%s') AS decided_at
       FROM budget_proposal_approvals
       WHERE budget_proposal_id = ?
       ORDER BY decided_at ASC, id ASC`,
    [proposalId]
  );

  return {
    master,
    lines,
    approvals,
  };
}
