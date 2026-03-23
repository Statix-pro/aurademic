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

export const normalizeBeneficiaryType = (beneficiaryType) => sharedNormalizeBeneficiaryType(beneficiaryType);
const BUDGET_PROPOSAL_COLUMN_EXISTS_CACHE = new Map();

export const normalizeEntityTypeCode = (value) => sharedNormalizeEntityTypeCode(value);
export const normalizeBudgetRole = (value) => sharedNormalizeBudgetRole(value);
const formatApprovalFlowString = (flow) => sharedFormatApprovalFlowString(flow);

async function hasBudgetProposalColumn(columnName) {
  const normalizedColumn = normalizeText(columnName);
  if (!normalizedColumn) return false;

  // Cache only positive existence so post-migration columns are picked up
  // without requiring a server restart.
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


export function getCurrentFinancialYear() {
  return sharedGetCurrentFinancialYear();
}

export function getDefaultFreezeCutoffDate(fiscalYear) {
  return sharedGetDefaultFreezeCutoffDate(fiscalYear);
}

export async function getFreezeConfig(fiscalYear) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  let rows = [];

  try {
    [rows] = await db.execute(
      `SELECT fiscal_year, cutoff_date, is_frozen, updated_by_user_id, updated_by_email
         FROM budget_time_freeze_config
         WHERE fiscal_year = ?
         LIMIT 1`,
      [fy]
    );
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return {
        fiscalYear: fy,
        cutoffDate: getDefaultFreezeCutoffDate(fy),
        isFrozen: false,
        updatedByUserId: null,
        updatedByEmail: null,
      };
    }
    throw error;
  }

  if (!rows.length) {
    return {
      fiscalYear: fy,
      cutoffDate: getDefaultFreezeCutoffDate(fy),
      isFrozen: false,
      updatedByUserId: null,
      updatedByEmail: null,
    };
  }

  const row = rows[0];
  return {
    fiscalYear: Number(row.fiscal_year),
    cutoffDate: row.cutoff_date ? String(row.cutoff_date) : getDefaultFreezeCutoffDate(fy),
    isFrozen: Number(row.is_frozen) === 1,
    updatedByUserId: row.updated_by_user_id ? Number(row.updated_by_user_id) : null,
    updatedByEmail: normalizeText(row.updated_by_email) || null,
  };
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

export async function getUserAssignments(userId) {
  return userResolvers.getUserAssignments(userId);
}

export async function getEmployeeDepartmentByEmployeeId(employeeId) {
  return userResolvers.getEmployeeDepartmentByEmployeeId(employeeId);
}

export async function checkEmployeeUserMatch(employeeId, userId) {
  return userResolvers.checkEmployeeUserMatch(employeeId, userId);
}

export async function getUserDepartmentByEmail(userEmail) {
  return userResolvers.getUserDepartmentByEmail(userEmail);
}

export async function searchApplicant(query = '', employeeType = null) {
  return userResolvers.searchApplicant(query, employeeType);
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
      throw new Error(`Invalid department beneficiary: ${beneficiaryValue} `);
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

    if (Number.isInteger(beneficiaryEntityId) && beneficiaryEntityId > 0) {
      const entityRecord = await getEntityById(conn, beneficiaryEntityId);
      if (entityRecord && entityRecord.is_active === 1) {
        return {
          entityTypeCode: beneficiaryEntityTypeCode || null,
          beneficiaryEntityId,
        };
      }
    }

    return { entityTypeCode: null, beneficiaryEntityId: null };
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
    throw new Error(`Invalid beneficiary_value for ${beneficiaryType}: ${normalizedBeneficiaryValue} `);
  }

  return {
    entityTypeCode,
    beneficiaryEntityId: Number(rows[0].id),
  };
}


export async function resolveApprovalFlow(beneficiaryType, entityTypeCode = null, conn = db, options = {}) {
  return resolveSharedApprovalFlow(beneficiaryType, entityTypeCode, conn, options);
}


export async function create(payload) {
  return withTransaction(async (conn) => {
    const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
      const amount = Number(line.unit_amount) || 0;
      const qty = Number(line.quantity) || 1;
      return sum + amount * qty;
    }, 0);

    const fyYear = payload.fiscal_year || getCurrentFinancialYear();

    // 1. Acquire a named lock to serialize ref generation across concurrent requests.
    // This prevents duplicate refs when many budgets are created simultaneously.
    const lockName = `budget_ref_fy_${fyYear}`;
    const [lockRows] = await conn.execute('SELECT GET_LOCK(?, 15) AS acquired', [lockName]);
    const lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) {
      throw new Error(`Could not acquire budget reference lock for FY ${fyYear}`);
    }

    try {
      // 2. Ensure tracker row exists for the year
      await conn.execute(
        'INSERT IGNORE INTO budget_proposal_refs (ref_year, ref_sequence, proposal_id, proposal_ref) VALUES (?, 0, NULL, NULL)',
        [fyYear]
      );

      // 2b. Clean up orphan ref rows (proposal_id IS NULL, ref_sequence > 0) from prior deletes
      await conn.execute(
        'DELETE FROM budget_proposal_refs WHERE proposal_id IS NULL AND ref_sequence > 0 AND ref_year = ?',
        [fyYear]
      );

      // 3. Lock the tracker row (belt-and-suspenders with GET_LOCK)
      const [trackerRows] = await conn.execute(
        `SELECT id FROM budget_proposal_refs 
           WHERE ref_year = ? AND proposal_id IS NULL 
           FOR UPDATE`,
        [fyYear]
      );
      if (trackerRows.length === 0) {
        throw new Error(`Budget tracker row missing for FY ${fyYear}`);
      }

      // 4. Get the maximum sequence used (real proposals + orphans from deleted proposals).
      // Orphans: proposal_id IS NULL but ref_sequence > 0 (left when proposal was deleted).
      // Including them prevents reusing a sequence whose proposal_ref still exists in the table.
      const [maxRows] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) AS current_max
           FROM budget_proposal_refs 
           WHERE ref_year = ?
             AND (proposal_id IS NOT NULL OR ref_sequence > 0)`,
        [fyYear]
      );

      const sequence = Number(maxRows[0].current_max) + 1;
      const proposalRef = `#B-${fyYear}-${String(sequence).padStart(4, '0')}`;

      const departmentId = await resolveDepartmentId(conn, payload);
      const { entityTypeCode, beneficiaryEntityId } = await resolveBeneficiaryEntity(
        conn,
        payload.beneficiary_type,
        payload.beneficiary_value,
        payload.beneficiary_employee_id
      );

      const flow = await resolveApprovalFlow(payload.beneficiary_type, entityTypeCode, conn, {
        budgetTag: payload.budget_tag,
      });
      const initialStage = flow.requiresLevel1 ? 'level1' : flow.requiresDof ? 'dof' : 'principal';
      const approvalFlowString = formatApprovalFlowString(flow);
      const level1Route = resolveLevel1Route({
        ...payload,
        department_id: departmentId,
        beneficiary_entity_id: beneficiaryEntityId,
      });
      const level1EntityAssignee =
        level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact
          ? await resolveEntityLevel1Assignee(level1Route.entityId, conn)
          : null;
      const level1AssignmentStatus = resolveLevel1AssignmentStatus({
        routeType: level1Route.routeType,
        assigneeEmail: level1EntityAssignee?.email || null,
      });

      const hasApplicantNameColumn = await hasBudgetProposalColumn('applicant_name');
      const hasBudgetTagColumn = await hasBudgetProposalColumn('budget_tag');
      const applicantNameInsertColumn = hasApplicantNameColumn ? ', applicant_name' : '';
      const budgetTagInsertColumn = hasBudgetTagColumn ? ', budget_tag' : '';
      const applicantNameInsertValue = hasApplicantNameColumn ? ', ?' : '';
      const budgetTagInsertValue = hasBudgetTagColumn ? ', ?' : '';

      const createParams = [
        proposalRef,
        fyYear,
        payload.employee_id || payload.user_id,
        payload.user_id,
        payload.user_email || '',
        payload.request_date,
        payload.beneficiary_type,
        payload.beneficiary_value || null,
        beneficiaryEntityId,
        departmentId,
        payload.proposal_description || null,
        calculatedTotal,
        calculatedTotal,
        approvalFlowString,
        initialStage,
      ];
      if (hasApplicantNameColumn) {
        createParams.push(payload.applicant_name || null);
      }
      if (hasBudgetTagColumn) {
        createParams.push(payload.budget_tag || null);
      }

      const [proposalResult] = await conn.execute(
        `INSERT INTO budget_proposals(
            proposal_ref,
            fiscal_year,
            employee_id,
            user_id,
            user_email,
            request_date,
            beneficiary_type,
            beneficiary_value,
            beneficiary_entity_id,
            department_id,
            proposal_description,
            total_amount,
            approved_total_amount,
            approval_flow,
            status,
            current_stage${applicantNameInsertColumn}${budgetTagInsertColumn},
            created_at
          ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?${applicantNameInsertValue}${budgetTagInsertValue}, NOW())`,
        createParams
      );

      const proposalId = proposalResult.insertId;

      // Use REPLACE INTO to take over any "ghost" rows left by deleted proposals.
      // This solves the "Duplicate entry" error when a previous proposal with the same sequence was deleted.
      await conn.execute(
        `REPLACE INTO budget_proposal_refs(proposal_id, ref_year, ref_sequence, proposal_ref)
        VALUES(?, ?, ?, ?)`,
        [proposalId, fyYear, sequence, proposalRef]
      );

      if (Array.isArray(payload.lines)) {
        for (const line of payload.lines) {
          const lineId = await insertBudgetLine(proposalId, line, conn);

          if (line.month_allocations) {
            for (const [month, amount] of Object.entries(line.month_allocations)) {
              if (VALID_MONTHS.includes(month)) {
                await insertMonthAllocation(lineId, month, amount, conn);
              }
            }
          }
        }
      }

      return {
        proposalId,
        proposalRef,
        fyYear,
        requiresLevel1: flow.requiresLevel1,
        initialStage,
        approvalFlow: approvalFlowString,
        departmentId,
        beneficiaryEntityId,
        level1RouteType: level1Route.routeType,
        level1AssigneeEmail: level1EntityAssignee?.email || null,
        level1AssignmentStatus,
      };
    } finally {
      await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  });
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
        ORDER BY decided_at`,
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
         ORDER BY created_at`,
      [proposalId]
    );
    edits = editRows;
  } catch (error) {
    // Keep response compatible if migration isn't applied yet.
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

export async function getProposalDetailsByIds(proposalIds = []) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(proposalIds) ? proposalIds : [])
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );

  const detailsByProposalId = new Map();

  if (!normalizedIds.length) {
    return detailsByProposalId;
  }

  const [lines] = await db.query(
    `SELECT *
     FROM budget_proposal_lines
     WHERE budget_proposal_id IN (?)
     ORDER BY budget_proposal_id, id`,
    [normalizedIds]
  );

  const linesByProposalId = new Map();
  const approvedAllocationsByProposalId = new Map();

  for (const line of lines) {
    const proposalId = Number(line?.budget_proposal_id);
    if (!Number.isInteger(proposalId)) continue;

    if (!linesByProposalId.has(proposalId)) {
      linesByProposalId.set(proposalId, []);
    }
    linesByProposalId.get(proposalId).push(line);

    const lineId = Number(line?.id);
    const raw = line?.approved_month_allocations_json;
    if (!Number.isInteger(lineId) || !raw) continue;

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
    if (!hasAny) continue;

    if (!approvedAllocationsByProposalId.has(proposalId)) {
      approvedAllocationsByProposalId.set(proposalId, {});
    }
    approvedAllocationsByProposalId.get(proposalId)[lineId] = normalized;
  }

  const [allocRows] = await db.query(
    `SELECT
       l.budget_proposal_id,
       l.id AS line_id,
       m.month,
       m.amount,
       l.budget_head,
       l.sub_head
     FROM budget_proposal_lines l
     JOIN budget_line_month_allocations m ON l.id = m.budget_line_id
     WHERE l.budget_proposal_id IN (?)
     ORDER BY l.budget_proposal_id, l.id, FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
    [normalizedIds]
  );

  const rawAllocationsByProposalId = new Map();
  for (const row of allocRows) {
    const proposalId = Number(row?.budget_proposal_id);
    if (!Number.isInteger(proposalId)) continue;
    if (!rawAllocationsByProposalId.has(proposalId)) {
      rawAllocationsByProposalId.set(proposalId, []);
    }
    rawAllocationsByProposalId.get(proposalId).push(row);
  }

  const [approvals] = await db.query(
    `SELECT
       *,
       DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i') AS decided_at_formatted
     FROM budget_proposal_approvals
     WHERE budget_proposal_id IN (?)
     ORDER BY budget_proposal_id, decided_at`,
    [normalizedIds]
  );

  const approvalsByProposalId = new Map();
  for (const approval of approvals) {
    const proposalId = Number(approval?.budget_proposal_id);
    if (!Number.isInteger(proposalId)) continue;
    if (!approvalsByProposalId.has(proposalId)) {
      approvalsByProposalId.set(proposalId, []);
    }
    approvalsByProposalId.get(proposalId).push(approval);
  }

  const editsByProposalId = new Map();
  try {
    const [edits] = await db.query(
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
       WHERE budget_proposal_id IN (?)
       ORDER BY budget_proposal_id, created_at`,
      [normalizedIds]
    );

    for (const edit of edits) {
      const proposalId = Number(edit?.budget_proposal_id);
      if (!Number.isInteger(proposalId)) continue;
      if (!editsByProposalId.has(proposalId)) {
        editsByProposalId.set(proposalId, []);
      }
      editsByProposalId.get(proposalId).push(edit);
    }
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
  }

  for (const proposalId of normalizedIds) {
    detailsByProposalId.set(proposalId, {
      lines: linesByProposalId.get(proposalId) || [],
      allocations: groupAllocationsByLine(rawAllocationsByProposalId.get(proposalId) || []),
      approved_allocations: approvedAllocationsByProposalId.get(proposalId) || null,
      approvals: approvalsByProposalId.get(proposalId) || [],
      edits: editsByProposalId.get(proposalId) || [],
    });
  }

  return detailsByProposalId;
}


export async function update(
  proposalId,
  payload,
  { skipEditStateValidation = false, editedByUserId = null, editedByEmail = null, editedByRole = null } = {}
) {
  const proposal = await getBudgetById(proposalId);

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  if (!skipEditStateValidation && !EDITABLE_STATES.includes(proposal.status)) {
    throw new Error(`Cannot edit ${proposal.status} proposals`);
  }

  return withTransaction(async (conn) => {
    const [previousLines] = await conn.execute(
      `SELECT id, budget_head, sub_head, unit_amount, quantity, line_description
         FROM budget_proposal_lines
         WHERE budget_proposal_id = ?
         ORDER BY id`,
      [proposalId]
    );
    const [previousAllocationRows] = await conn.execute(
      `SELECT
           l.id AS line_id,
           m.month,
           m.amount
         FROM budget_proposal_lines l
         LEFT JOIN budget_line_month_allocations m ON m.budget_line_id = l.id
         WHERE l.budget_proposal_id = ?
         ORDER BY l.id`,
      [proposalId]
    );
    const previousMonthByLineId = new Map();
    const normalizeMonthKey = (value) => {
      const monthValue = normalizeText(value);
      if (!monthValue) return '';
      const direct = VALID_MONTHS.find((month) => month === monthValue);
      if (direct) return direct;
      const lower = monthValue.toLowerCase();
      return VALID_MONTHS.find((month) => month.toLowerCase() === lower) || '';
    };

    for (const row of previousAllocationRows) {
      if (!previousMonthByLineId.has(row.line_id)) {
        previousMonthByLineId.set(row.line_id, {});
      }
      const normalizedMonth = normalizeMonthKey(row.month);
      if (normalizedMonth) {
        previousMonthByLineId.get(row.line_id)[normalizedMonth] = Number(row.amount || 0);
      }
    }

    const toAmount = (value) => Number(value || 0);
    const toQty = (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) return 1;
      return parsed;
    };
    const normalizeMonthMap = (raw) => {
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
    const incomingLines = Array.isArray(payload.lines) ? payload.lines : [];
    const lineChangeDetails = [];
    const proposalChanges = [];
    let departmentId = await resolveDepartmentId(conn, payload);
    let { entityTypeCode, beneficiaryEntityId } = await resolveBeneficiaryEntity(
      conn,
      payload.beneficiary_type,
      payload.beneficiary_value,
      payload.beneficiary_employee_id
    );
    const shouldPreserveExistingFacultyRouting =
      ['Faculty', 'Staff'].includes(normalizeBeneficiaryType(payload.beneficiary_type))
      && !Number.isInteger(Number.parseInt(payload?.beneficiary_employee_id, 10))
      && normalizeText(payload?.beneficiary_type) === normalizeText(proposal?.beneficiary_type)
      && normalizeText(payload?.beneficiary_value) === normalizeText(proposal?.beneficiary_value);

    if (shouldPreserveExistingFacultyRouting) {
      departmentId = proposal?.department_id != null && Number.isInteger(Number(proposal.department_id))
        ? Number(proposal.department_id)
        : departmentId;
      beneficiaryEntityId = proposal?.beneficiary_entity_id != null && Number.isInteger(Number(proposal.beneficiary_entity_id))
        ? Number(proposal.beneficiary_entity_id)
        : beneficiaryEntityId;
    }
    const flow = await resolveApprovalFlow(payload.beneficiary_type, entityTypeCode, conn, {
      budgetTag: payload.budget_tag,
    });
    const approvalFlowString = formatApprovalFlowString(flow);
    const initialStage = flow.requiresLevel1 ? 'level1' : flow.requiresDof ? 'dof' : 'principal';
    const isReturnedState = proposal.status && proposal.status.endsWith('_returned');
    const nextCurrentStage =
      ['draft', 'submitted'].includes(proposal.status) || isReturnedState
        ? initialStage
        : proposal.current_stage;

    const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
      const amount = Number(line.unit_amount) || 0;
      const qty = Number(line.quantity) || 1;
      return sum + amount * qty;
    }, 0);

    const nextStatus = isReturnedState ? 're_submitted' : proposal.status;

    const hasApplicantNameColumn = await hasBudgetProposalColumn('applicant_name');
    const hasBudgetTagColumn = await hasBudgetProposalColumn('budget_tag');
    if (hasBudgetTagColumn) {
      const oldTag = normalizeText(proposal?.budget_tag);
      const newTag = normalizeText(payload?.budget_tag);
      if (oldTag !== newTag) {
        proposalChanges.push(`Tag changed from "${oldTag || '-'}" to "${newTag || '-'}"`);
      }
    }
    const applicantNameSetClause = hasApplicantNameColumn ? 'applicant_name = ?,' : '';
    const budgetTagSetClause = hasBudgetTagColumn ? 'budget_tag = ?,' : '';
    const updateParams = [];

    if (hasApplicantNameColumn) {
      updateParams.push(payload.applicant_name || null);
    }

    updateParams.push(
      payload.beneficiary_type,
      payload.beneficiary_value || null,
      beneficiaryEntityId,
      departmentId,
      approvalFlowString,
      nextCurrentStage,
      nextStatus,
      payload.proposal_description || null
    );

    if (hasBudgetTagColumn) {
      updateParams.push(payload.budget_tag || null);
    }

    updateParams.push(
      calculatedTotal,
      calculatedTotal,
      proposalId
    );

    await conn.execute(
      `UPDATE budget_proposals
         SET ${applicantNameSetClause}
        beneficiary_type = ?,
        beneficiary_value = ?,
        beneficiary_entity_id = ?,
        department_id = ?,
        approval_flow = ?,
        current_stage = ?,
        status = ?,
        proposal_description = ?,
        ${budgetTagSetClause}
        total_amount = ?,
        approved_total_amount = ?,
        updated_at = NOW()
         WHERE id = ? `,
      updateParams
    );

    await conn.execute(
      `DELETE m
         FROM budget_line_month_allocations m
         JOIN budget_proposal_lines l ON m.budget_line_id = l.id
         WHERE l.budget_proposal_id = ? `,
      [proposalId]
    );

    await conn.execute('DELETE FROM budget_proposal_lines WHERE budget_proposal_id = ?', [proposalId]);

    if (Array.isArray(payload.lines)) {
      for (const line of payload.lines) {
        const lineId = await insertBudgetLine(proposalId, line, conn);

        if (line.month_allocations) {
          for (const [month, amount] of Object.entries(line.month_allocations)) {
            if (VALID_MONTHS.includes(month)) {
              await insertMonthAllocation(lineId, month, amount, conn);
            }
          }
        }
      }
    }

    const maxLineCount = Math.max(previousLines.length, incomingLines.length);
    for (let i = 0; i < maxLineCount; i += 1) {
      const oldLine = previousLines[i];
      const newLine = incomingLines[i];
      const lineNo = i + 1;

      if (oldLine && !newLine) {
        lineChangeDetails.push({
          lineNo,
          changes: ['Line removed'],
        });
        continue;
      }

      if (!oldLine && newLine) {
        lineChangeDetails.push({
          lineNo,
          changes: ['Line added'],
        });
        continue;
      }

      if (!oldLine || !newLine) {
        continue;
      }

      const changes = [];
      const oldBudgetHead = normalizeText(oldLine.budget_head);
      const newBudgetHead = normalizeText(newLine.budget_head);
      if (oldBudgetHead !== newBudgetHead) {
        changes.push(`Budget Head changed from "${oldBudgetHead || '-'}" to "${newBudgetHead || '-'}"`);
      }

      const oldSubHead = normalizeText(oldLine.sub_head);
      const newSubHead = normalizeText(newLine.sub_head);
      if (oldSubHead !== newSubHead) {
        changes.push(`Sub Head changed from "${oldSubHead || '-'}" to "${newSubHead || '-'}"`);
      }

      const oldUnitAmount = toAmount(oldLine.unit_amount);
      const newUnitAmount = toAmount(newLine.unit_amount);
      if (oldUnitAmount !== newUnitAmount) {
        changes.push(`Unit Amount changed from ${oldUnitAmount} to ${newUnitAmount}`);
      }

      const oldQty = toQty(oldLine.quantity);
      const newQty = toQty(newLine.quantity);
      if (oldQty !== newQty) {
        changes.push(`Quantity changed from ${oldQty} to ${newQty}`);
      }

      const oldDescription = normalizeText(oldLine.line_description);
      const newDescription = normalizeText(newLine.line_description);
      if (oldDescription !== newDescription) {
        changes.push('Description updated');
      }

      const oldMonths = normalizeMonthMap(previousMonthByLineId.get(oldLine.id) || {});
      const newMonths = normalizeMonthMap(newLine.month_allocations || {});
      const monthDiffs = [];
      for (const month of VALID_MONTHS) {
        if (oldMonths[month] !== newMonths[month]) {
          monthDiffs.push(`${month}: ${oldMonths[month]} -> ${newMonths[month]}`);
        }
      }
      if (monthDiffs.length > 0) {
        changes.push(`Month allocations changed (${monthDiffs.join(', ')})`);
      }

      if (changes.length > 0) {
        lineChangeDetails.push({ lineNo, changes });
      }
    }

    const summaryParts = [];
    if (lineChangeDetails.length > 0) {
      summaryParts.push(`${lineChangeDetails.length} line(s) updated`);
    }
    if (proposalChanges.length > 0) {
      summaryParts.push(`${proposalChanges.length} proposal field(s) updated`);
    }
    const editSummary = summaryParts.join(' | ') || 'Proposal edited';

    try {
      await conn.execute(
        `INSERT INTO budget_proposal_edits
            (budget_proposal_id, edited_by_user_id, edited_by_email, summary, details)
           VALUES (?, ?, ?, ?, ?)`,
        [
          proposalId,
          editedByUserId || null,
          normalizeText(editedByEmail) || null,
          editSummary,
          JSON.stringify({
            editorRole: normalizeText(editedByRole).toLowerCase(),
            lines: lineChangeDetails,
            proposalChanges,
          }),
        ]
      );
    } catch (error) {
      // Keep update flow working if migration table is not available in a deployment.
      if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }
  });
}


async function deleteBudgetProposal(proposalId) {
  return withTransaction(async (conn) => {
    await conn.execute(
      `DELETE m
         FROM budget_line_month_allocations m
         JOIN budget_proposal_lines l ON m.budget_line_id = l.id
         WHERE l.budget_proposal_id = ? `,
      [proposalId]
    );

    // Preserve historical reference numbers so deleted refs are never reused.
    await conn.execute('DELETE FROM budget_proposal_refs WHERE proposal_id = ?', [proposalId]);

    await conn.execute('DELETE FROM budget_proposal_lines WHERE budget_proposal_id = ?', [proposalId]);
    await conn.execute('DELETE FROM budget_proposal_approvals WHERE budget_proposal_id = ?', [proposalId]);

    const [result] = await conn.execute('DELETE FROM budget_proposals WHERE id = ?', [proposalId]);
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

  // Determine next state
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

    // AUTO-APPROVAL LOGIC
    if (role === 'dof') {
      if (requiresPrincipalStage) {
        // If Principal is required, AUTO-APPROVE and finish
        newStatus = 'completed';
        nextStage = 'completed';
      } else {
        // If Principal is NOT required, just finish
        newStatus = 'completed';
        nextStage = 'completed';
      }
    }
    // Logic for final manual principal approval (if auto-approve fails/disabled)
    else if (role === 'principal') {
      newStatus = 'completed';
      nextStage = 'completed';
    }
  } else if (normalizedDecision === 'rejected') {
    newStatus = flow.reject;
  } else {
    newStatus = flow.returned;
    nextStage = role; // Stay on current stage if returned
  }

  // Determine the descriptive role for logging (e.g., 'hod' or 'coordinator' instead of 'level1')
  const displayRole = (role === 'level1')
    ? (isEntityBeneficiaryType(proposal.beneficiary_type) ? 'coordinator' : 'hod')
    : role;

  // Database Update
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

    // 1. Insert the ACTUAL approval (DoF/Level-1/Principal)
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

    // 2. Insert AUTO-APPROVAL for Principal (Only if DoF Approved + Principal Required)
    if (role === 'dof' && normalizedDecision === 'approved' && requiresPrincipalStage) {
      await conn.execute(
        `INSERT INTO budget_proposal_approvals(
          budget_proposal_id, role, approver_user_id, approver_email,
          decision, feedback, allows_edit, decided_at
        ) VALUES(?, 'principal', ?, ?, 'approved', 'Auto-approved after DoF clearance', 0, NOW())`,
        [proposalId, approverUserId, 'system-auto@ksrct.ac.in']
      );
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
}) {
  const hasApplicantNameColumn = await hasBudgetProposalColumn('applicant_name');
  const hasBudgetTagColumn = await hasBudgetProposalColumn('budget_tag');
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
    isAdminView: false,
    hasColumnCache: {
      applicant_name: hasApplicantNameColumn,
      budget_tag: hasBudgetTagColumn,
    },
  });
  const enrichedRows = await attachLevel1AssignmentMetadata(result.rows);
  return { budgets: enrichedRows, pagination: result.pagination };
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
    isAdminView: false
  });
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



export function resolveStageLabel(stageKey, proposal = {}) {
  return sharedResolveStageLabel(stageKey, proposal);
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






async function insertBudgetLine(proposalId, line, conn) {
  const unitAmount = Number(line.unit_amount) || 0;
  const quantity = Number(line.quantity) || 1;
  const lineTotal = unitAmount * quantity;

  const [result] = await conn.execute(
    `INSERT INTO budget_proposal_lines(
          budget_proposal_id,
          budget_head,
          sub_head,
          unit_amount,
          approved_unit_amount,
          quantity,
          line_total,
          approved_line_total,
          line_description
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  await conn.execute(
    'INSERT INTO budget_line_month_allocations (budget_line_id, month, amount) VALUES (?, ?, ?)',
    [lineId, month, Number(amount) || 0]
  );
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
      COALESCE(applicant_emp.designation, creator_emp.designation) AS designation,
        COALESCE(applicant_emp.designation, creator_emp.designation) AS user_designation,
          COALESCE(applicant_emp.mobile, creator_emp.mobile) AS mobile,
          COALESCE(applicant_emp.mobile, creator_emp.mobile) AS user_mobile,
            COALESCE(creator_parent_dept.name, creator_parent_dept_fallback.name, creator_emp_dept.name) AS user_department,
              COALESCE(applicant_parent_dept.name, applicant_parent_dept_fallback.name, applicant_emp_dept.name) AS applicant_department,
                COALESCE(
                  NULLIF(TRIM(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))), ''),
                  NULLIF(TRIM(CONCAT(creator_emp.first_name, ' ', COALESCE(creator_emp.last_name, ''))), '')
                ) AS applicant_name,
                  COALESCE(
                    NULLIF(TRIM(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))), ''),
                    NULLIF(TRIM(CONCAT(creator_emp.first_name, ' ', COALESCE(creator_emp.last_name, ''))), '')
                  ) AS user_name,
                    COALESCE(
                      NULLIF(TRIM(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))), ''),
                      NULLIF(TRIM(CONCAT(creator_emp.first_name, ' ', COALESCE(creator_emp.last_name, ''))), '')
                    ) AS name,
                    COALESCE(NULLIF(TRIM(applicant_emp.email), ''), NULLIF(TRIM(bp.user_email), '')) AS applicant_email,
                    COALESCE(NULLIF(TRIM(applicant_emp.email), ''), NULLIF(TRIM(bp.user_email), '')) AS email
          FROM budget_proposals bp
          LEFT JOIN master_departments md ON bp.department_id = md.id
          LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
          LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
          LEFT JOIN master_employees applicant_emp ON bp.employee_id = applicant_emp.id
          LEFT JOIN master_departments applicant_emp_dept ON applicant_emp.department_id = applicant_emp_dept.id
          LEFT JOIN master_departments applicant_parent_dept ON applicant_emp.parent_department_id = applicant_parent_dept.id
          LEFT JOIN master_departments applicant_parent_dept_fallback ON applicant_emp_dept.parent_id = applicant_parent_dept_fallback.id
          LEFT JOIN master_employees creator_emp ON bp.user_id = creator_emp.user_id AND creator_emp.status = 'Active'
          LEFT JOIN master_departments creator_emp_dept ON creator_emp.department_id = creator_emp_dept.id
          LEFT JOIN master_departments creator_parent_dept ON creator_emp.parent_department_id = creator_parent_dept.id
          LEFT JOIN master_departments creator_parent_dept_fallback ON creator_emp_dept.parent_id = creator_parent_dept_fallback.id
          WHERE bp.id = ? `,
    [proposalId]
  );

  return rows[0] || null;
}

export async function isFacultyBeneficiaryForUser(proposal = {}, userId) {
  const normalizedBeneficiaryType = normalizeBeneficiaryType(proposal?.beneficiary_type).toLowerCase();
  const beneficiaryValue = normalizeText(proposal?.beneficiary_value).toLowerCase();
  const uid = Number(userId);

  if (normalizedBeneficiaryType !== 'faculty') {
    return false;
  }

  if (!beneficiaryValue || !Number.isInteger(uid) || uid <= 0) {
    return false;
  }

  const [rows] = await db.execute(
    `SELECT 1
       FROM master_employees e
       WHERE e.user_id = ?
         AND e.status = 'Active'
         AND (
           LOWER(TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')))) = ?
           OR LOWER(TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))) = ?
           OR LOWER(TRIM(e.email)) = ?
           OR LOWER(TRIM(e.erp_id)) = ?
         )
       LIMIT 1`,
    [uid, beneficiaryValue, beneficiaryValue, beneficiaryValue, beneficiaryValue]
  );

  return rows.length > 0;
}

export async function validateUserAccess(proposalId, userId, userEmail, role, department, departmentId) {
  const proposal = await getBudgetById(proposalId);

  if (!proposal) {
    return false;
  }

  const uid = Number(userId);
  const pid = Number(proposal.user_id);
  const normalizedRole = normalizeBudgetRole(role);

  const emailMatch =
    proposal.user_email &&
    userEmail &&
    normalizeText(proposal.user_email).toLowerCase() === normalizeText(userEmail).toLowerCase();

  // ✅ ALWAYS allow the owner or named user to access their own proposal
  if (pid === uid || emailMatch) {
    return true;
  }

  // ✅ Allow the applicant (employee on whose behalf proposal was submitted) to view
  if (proposal.employee_id && uid > 0) {
    const [empRows] = await db.execute(
      'SELECT id FROM master_employees WHERE id = ? AND user_id = ? AND status = "Active" LIMIT 1',
      [proposal.employee_id, uid]
    );
    if (empRows.length > 0) {
      return true;
    }
  }

  if (await isFacultyBeneficiaryForUser(proposal, uid)) {
    return true;
  }

  switch (normalizedRole) {
    case 'user':
      return pid === uid || emailMatch;

    case 'hod':
    case 'coordinator':
    case 'level1': {
      const level1Route = resolveLevel1Route(proposal);

      if (level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact) {
        const normalizedUserEmail = normalizeText(userEmail).toLowerCase();

        // Check master_entity_contacts first
        if (normalizedUserEmail) {
          const [contacts] = await db.execute(
            `SELECT email FROM master_entity_contacts WHERE entity_id = ? `,
            [level1Route.entityId]
          );

          if (contacts.some(
            (c) => normalizeText(c.email).toLowerCase() === normalizedUserEmail
          )) {
            return true;
          }
        }

        // Fallback: check user_entity_roles
        if (uid > 0) {
          const [uerRows] = await db.execute(
            `SELECT 1 FROM user_entity_roles WHERE user_id = ? AND entity_id = ? LIMIT 1`,
            [uid, level1Route.entityId]
          );
          if (uerRows.length > 0) {
            return true;
          }
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

        if (
          proposalDepartmentName === normalizedDepartment ||
          proposalDepartmentCode === normalizedDepartment
        ) {
          return true;
        }

        if (
          proposalBeneficiaryType === 'department' &&
          proposalBeneficiaryValue === normalizedDepartment
        ) {
          return true;
        }
      }

      return false;
    }

    case 'dof':
    case 'principal':
    case 'admin':
    case 'super_admin':
      return true;
    case 'ithead': {
      const inItheadStage =
        normalizeText(proposal.current_stage).toLowerCase() === 'ithead'
        || normalizeText(proposal.status).toLowerCase().startsWith('ithead_');
      const tagMatches =
        normalizeText(proposal.budget_tag).toLowerCase() === 'it infrastructure';
      return inItheadStage && tagMatches;
    }

    default:
      return pid === uid || emailMatch;
  }
}




export async function getMonthlyAllocations(proposalId) {
  const [rows] = await db.execute(
    `SELECT
      m.month,
        SUM(m.amount) AS total_amount,
          COUNT(DISTINCT l.id) AS line_count
       FROM budget_line_month_allocations m
       JOIN budget_proposal_lines l ON m.budget_line_id = l.id
       WHERE l.budget_proposal_id = ?
        GROUP BY m.month
       ORDER BY FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
    [proposalId]
  );

  return rows;
}