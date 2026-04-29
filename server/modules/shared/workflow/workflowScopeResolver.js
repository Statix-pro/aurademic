import db from '../../../config/connection.js';
import {
  WorkflowError,
  normalizeText,
  validateStagePolicyMeta,
  isSuperAdminActor,
} from './workflowValidators.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeRoleCodes = (roleCodes = []) =>
  [...new Set(roleCodes.map((roleCode) => normalizeText(roleCode).toLowerCase()).filter(Boolean))];

const extractRoleToken = (value) => {
  if (typeof value === 'string') return normalizeText(value);
  if (value && typeof value === 'object') {
    const candidates = [value.role, value.role_code, value.roleCode, value.code, value.name, value.value];
    for (const candidate of candidates) {
      const normalized = normalizeText(candidate);
      if (normalized) return normalized;
    }
  }
  return '';
};

const canAccessExpenditureStageByRole = (actor = {}, stageKey = '') => {
  const normalizedStage = normalizeText(stageKey).toLowerCase();
  if (!normalizedStage) {
    return false;
  }

  const roleTokens = Array.isArray(actor?.roles) ? actor.roles : [];
  const roles = roleTokens.map((role) => extractRoleToken(role).toLowerCase()).filter(Boolean);

  if (Boolean(actor?.isSuperAdmin || actor?.is_super_admin) || roles.includes('super_admin')) {
    return true;
  }

  if (roles.includes('admin')) {
    return true;
  }

  if (normalizedStage === 'level1') {
    return roles.some((role) => ['hod', 'coordinator', 'entity_approver'].includes(role));
  }

  if (normalizedStage === 'dof') {
    return roles.includes('dof');
  }

  if (normalizedStage === 'principal') {
    return roles.includes('principal');
  }

  return false;
};

const getActorUserId = (actor = {}) =>
  toPositiveInt(actor?.userId || actor?.id || actor?.actorUserId);

const resolveEffectiveScopeType = ({ stagePolicy, recordContext, filters = {} }) => {
  const baseScopeType = normalizeText(stagePolicy?.scopeType || stagePolicy?.scope_type).toLowerCase();
  const moduleKey = normalizeText(stagePolicy?.moduleKey || stagePolicy?.module_key).toLowerCase();
  const stageKey = normalizeText(stagePolicy?.stageKey || stagePolicy?.stage_key).toLowerCase();
  const level1Role = normalizeText(filters?.level1Role).toLowerCase();

  if (!['finance', 'expenditure'].includes(moduleKey) || stageKey !== 'level1') {
    return baseScopeType;
  }

  if (recordContext) {
    const beneficiaryType = normalizeText(recordContext?.beneficiaryType).toLowerCase();
    const beneficiaryEntityId = toPositiveInt(recordContext?.beneficiaryEntityId);
    if (beneficiaryType === 'department') {
      return 'department';
    }
    if (beneficiaryEntityId) {
      return 'entity';
    }
    return 'department';
  }

  if (level1Role === 'coordinator') {
    return 'entity';
  }

  if (level1Role === 'hod') {
    return 'department';
  }

  return baseScopeType;
};

async function loadAssignmentBuckets(conn, userId, roleCodes = []) {
  const departmentIds = new Set();
  const entityIds = new Set();

  const normalizedUserId = toPositiveInt(userId);
  if (!normalizedUserId) {
    return { departmentIds, entityIds };
  }

  const normalizedRoleCodes = normalizeRoleCodes(roleCodes);
  let sql = `
    SELECT
      uer.entity_id,
      uer.entity_type,
      LOWER(TRIM(r.role_code)) AS role_code
    FROM user_entity_roles uer
    JOIN roles r ON r.id = uer.role_id
    WHERE uer.user_id = ?
  `;
  const params = [normalizedUserId];

  if (normalizedRoleCodes.length > 0) {
    sql += ' AND LOWER(TRIM(r.role_code)) IN (?)';
    params.push(normalizedRoleCodes);
  }

  const [rows] = await conn.query(sql, params);

  for (const row of rows) {
    const entityId = toPositiveInt(row.entity_id);
    if (!entityId) continue;

    const entityType = normalizeText(row.entity_type).toUpperCase();
    if (entityType === 'DEPARTMENT') {
      departmentIds.add(entityId);
    } else {
      entityIds.add(entityId);
    }
  }

  return { departmentIds, entityIds };
}

async function loadPrimaryEmployeeContext(conn, userId) {
  const normalizedUserId = toPositiveInt(userId);
  if (!normalizedUserId) {
    return { departmentId: null, entityId: null };
  }

  const [rows] = await conn.query(
    `SELECT department_id, entity_id
       FROM master_employees
       WHERE user_id = ?
         AND status = 'Active'
       ORDER BY id ASC
       LIMIT 1`,
    [normalizedUserId]
  );

  if (!rows.length) {
    return { departmentId: null, entityId: null };
  }

  return {
    departmentId: toPositiveInt(rows[0].department_id),
    entityId: toPositiveInt(rows[0].entity_id),
  };
}

async function resolveScopedActorIds(conn, actor, stagePolicy, options = {}) {
  const scopeType = resolveEffectiveScopeType({
    stagePolicy,
    recordContext: options?.recordContext || null,
    filters: options?.filters || {},
  });
  const normalizedMeta = validateStagePolicyMeta({
    scopeType,
    meta: stagePolicy?.meta,
  });

  const userId = getActorUserId(actor);
  const superAdmin = isSuperAdminActor(actor);
  const normalizedModuleKey = normalizeText(stagePolicy?.moduleKey || stagePolicy?.module_key).toLowerCase();
  const normalizedStageKey = normalizeText(stagePolicy?.stageKey || stagePolicy?.stage_key).toLowerCase();

  if (superAdmin || scopeType === 'global') {
    return {
      scopeType,
      requireAssignment: false,
      departmentIds: new Set(),
      entityIds: new Set(),
      forceAll: true,
      forceEmpty: false,
    };
  }

  const assignmentRoleCodes = normalizeRoleCodes(normalizedMeta?.assignmentRoleCodes || []);
  const requireAssignment = Boolean(normalizedMeta?.requireAssignment);
  const assignmentBuckets = await loadAssignmentBuckets(conn, userId, assignmentRoleCodes);
  const primaryContext = await loadPrimaryEmployeeContext(conn, userId);

  if (
    normalizedModuleKey === 'expenditure' &&
    normalizedStageKey === 'dof' &&
    canAccessExpenditureStageByRole(actor, normalizedStageKey)
  ) {
    return {
      scopeType,
      requireAssignment,
      departmentIds: new Set(),
      entityIds: new Set(),
      forceAll: true,
      forceEmpty: false,
    };
  }

  if (scopeType === 'department') {
    if (!assignmentBuckets.departmentIds.size && !requireAssignment && primaryContext.departmentId) {
      assignmentBuckets.departmentIds.add(primaryContext.departmentId);
    }

    return {
      scopeType,
      requireAssignment,
      departmentIds: assignmentBuckets.departmentIds,
      entityIds: new Set(),
      forceAll: false,
      forceEmpty: assignmentBuckets.departmentIds.size === 0,
    };
  }

  if (scopeType === 'entity') {
    if (!assignmentBuckets.entityIds.size && !requireAssignment && primaryContext.entityId) {
      assignmentBuckets.entityIds.add(primaryContext.entityId);
    }

    return {
      scopeType,
      requireAssignment,
      departmentIds: new Set(),
      entityIds: assignmentBuckets.entityIds,
      forceAll: false,
      forceEmpty: assignmentBuckets.entityIds.size === 0,
    };
  }

  throw new WorkflowError(`Unsupported stage policy scope: ${scopeType}`, 500, 'INVALID_SCOPE_TYPE');
}

export async function resolveQueueScopeFilters({
  conn = db,
  actor,
  stagePolicy,
  filters = {},
}) {
  return resolveScopedActorIds(conn, actor, stagePolicy, { filters });
}

export async function assertRecordScopeAccess({
  conn = db,
  actor,
  stagePolicy,
  recordContext,
}) {
  const resolvedScope = await resolveScopedActorIds(conn, actor, stagePolicy, {
    recordContext,
  });

  if (resolvedScope.forceAll) {
    return true;
  }

  if (resolvedScope.scopeType === 'department') {
    const departmentId = toPositiveInt(recordContext?.departmentId);

    if (!departmentId) {
      throw new WorkflowError('Department scope requires record department_id', 403, 'SCOPE_CONTEXT_MISSING');
    }

    if (!resolvedScope.departmentIds.has(departmentId)) {
      throw new WorkflowError('Record is outside your department workflow scope', 403, 'WORKFLOW_SCOPE_DENIED');
    }

    return true;
  }

  if (resolvedScope.scopeType === 'entity') {
    const entityId = toPositiveInt(recordContext?.beneficiaryEntityId);

    if (!entityId) {
      throw new WorkflowError('Entity scope requires record beneficiary_entity_id', 403, 'SCOPE_CONTEXT_MISSING');
    }

    if (!resolvedScope.entityIds.has(entityId)) {
      throw new WorkflowError('Record is outside your entity workflow scope', 403, 'WORKFLOW_SCOPE_DENIED');
    }

    return true;
  }

  return true;
}