import {
  WorkflowError,
  normalizeText,
  validateStagePolicyMeta,
  isSuperAdminActor,
} from './workflowValidators.js';
import db from '../../../config/connection.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeRoleCodes = (roleCodes = []) => [
  ...new Set(roleCodes.map((roleCode) => normalizeText(roleCode).toLowerCase()).filter(Boolean)),
];

/**
 * Which role codes may act at which stage.
 *
 * This is the single source of truth for the stage->role mapping, read in both
 * directions: `canAccessStageByRole` in workflowService asks "does this actor
 * hold one of these?", and `resolveStageRecipients` below asks "who holds one
 * of these?". They must never disagree, or the system would notify people who
 * cannot act, or stay silent for people who can.
 *
 * `chairman` is finance-only, which the callers enforce; the map itself just
 * lists the candidates.
 */
export const STAGE_ROLE_CODES = Object.freeze({
  level1: Object.freeze(['hod', 'coordinator', 'entity_approver']),
  ithead: Object.freeze(['ithead', 'it_head']),
  dof: Object.freeze(['dof']),
  principal: Object.freeze(['principal']),
  chairman: Object.freeze(['chairman']),
});

const extractRoleToken = (value) => {
  if (typeof value === 'string') return normalizeText(value);
  if (value && typeof value === 'object') {
    const candidates = [
      value.role,
      value.role_code,
      value.roleCode,
      value.code,
      value.name,
      value.value,
    ];
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
  const baseScopeType = normalizeText(
    stagePolicy?.scopeType || stagePolicy?.scope_type,
  ).toLowerCase();
  const moduleKey = normalizeText(stagePolicy?.moduleKey || stagePolicy?.module_key).toLowerCase();
  const stageKey = normalizeText(stagePolicy?.stageKey || stagePolicy?.stage_key).toLowerCase();
  const level1Role = normalizeText(filters?.level1Role).toLowerCase();

  // level1 means "the beneficiary's own approver", so its scope depends on the
  // record rather than on configuration: a department proposal is scoped to the
  // department, an entity proposal to the entity. Budget is listed here for
  // notification recipient resolution only — its own engine never calls into
  // this file, so this cannot affect budget authorization.
  if (!['finance', 'expenditure', 'budget'].includes(moduleKey) || stageKey !== 'level1') {
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
    [normalizedUserId],
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
  const normalizedModuleKey = normalizeText(
    stagePolicy?.moduleKey || stagePolicy?.module_key,
  ).toLowerCase();
  const normalizedStageKey = normalizeText(
    stagePolicy?.stageKey || stagePolicy?.stage_key,
  ).toLowerCase();

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
    if (
      !assignmentBuckets.departmentIds.size &&
      !requireAssignment &&
      primaryContext.departmentId
    ) {
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

  throw new WorkflowError(
    `Unsupported stage policy scope: ${scopeType}`,
    500,
    'INVALID_SCOPE_TYPE',
  );
}

/**
 * Reads the scope policy for a stage, preferring an exact `module_key` match
 * over the `'*'` wildcard and falling back to global scope when the stage has
 * no policy row at all.
 *
 * This lives here rather than in workflowService because both directions need
 * it: the forward check (may this actor act?) and the inverse lookup below
 * (who may act on this?). Keeping one copy is what stops the two from
 * drifting apart.
 */
export async function resolveStagePolicy(conn, { moduleKey, stageKey }) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedStageKey = normalizeText(stageKey).toLowerCase();

  const [rows] = await conn.query(
    `SELECT module_key, stage_key, scope_type, meta
     FROM workflow_stage_policies
     WHERE is_active = 1
       AND LOWER(TRIM(stage_key)) = ?
       AND LOWER(TRIM(module_key)) IN (?, '*')
     ORDER BY CASE WHEN LOWER(TRIM(module_key)) = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [normalizedStageKey, normalizedModuleKey, normalizedModuleKey],
  );

  if (!rows.length) {
    return {
      moduleKey: normalizedModuleKey,
      stageKey: normalizedStageKey,
      scopeType: 'global',
      meta: null,
    };
  }

  const row = rows[0];
  const scopeType = normalizeText(row.scope_type).toLowerCase();
  const normalizedMeta = validateStagePolicyMeta({
    scopeType,
    meta: row.meta,
  });

  return {
    moduleKey: normalizeText(row.module_key).toLowerCase(),
    stageKey: normalizeText(row.stage_key).toLowerCase(),
    scopeType,
    meta: normalizedMeta,
  };
}

/* ============================================================
   INVERSE LOOKUP: given a record and a stage, who may act on it?

   Everything above answers the forward question — "may THIS actor act?" —
   because that is all an authorization check needs. Notifications need the
   opposite, and there is no assignee column to read: approval in this system
   is pull-based, so the set of people who may act is derived, never stored.

   The rules below mirror `resolveScopedActorIds` step for step. Where the
   forward path asks "does the actor's department set contain the record's
   department?", this asks "whose department set contains it?".
   ============================================================ */

/**
 * Users holding any of the given role codes, through either a global
 * (`user_roles`) or a contextual (`user_entity_roles`) assignment — the same
 * UNION that `accessControlModel.getUserAuthorizationSnapshot` uses to build a
 * user's role list.
 */
async function findUserIdsByRoleCodes(conn, roleCodes = []) {
  const normalized = normalizeRoleCodes(roleCodes);
  if (!normalized.length) return new Set();

  const [rows] = await conn.query(
    `SELECT DISTINCT combined.user_id
     FROM (
       SELECT user_id, role_id FROM user_roles
       UNION
       SELECT user_id, role_id FROM user_entity_roles
     ) combined
     JOIN roles r ON r.id = combined.role_id
     WHERE LOWER(TRIM(r.role_code)) IN (?)`,
    [normalized],
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * Users holding any of the given permission keys. This is the inverse of the
 * permission half of `assertDecisionPermission`, so someone granted
 * `finance.workflow.dof` without the `dof` role is still told about work
 * waiting on them.
 */
async function findUserIdsByPermissionKeys(conn, permissionKeys = []) {
  const normalized = [...new Set(permissionKeys.map((key) => normalizeText(key)).filter(Boolean))];
  if (!normalized.length) return new Set();

  const [rows] = await conn.query(
    `SELECT DISTINCT combined.user_id
     FROM (
       SELECT user_id, role_id FROM user_roles
       UNION
       SELECT user_id, role_id FROM user_entity_roles
     ) combined
     JOIN role_permissions rp ON rp.role_id = combined.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE p.permission_key IN (?)`,
    [normalized],
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * Users explicitly assigned to one org unit, optionally narrowed to the role
 * codes the stage policy names in `assignmentRoleCodes`. This is the inverse of
 * `loadAssignmentBuckets`.
 */
async function findUserIdsAssignedToUnit(conn, { entityId, isDepartment, roleCodes = [] }) {
  const normalizedEntityId = toPositiveInt(entityId);
  if (!normalizedEntityId) return new Set();

  const normalizedRoleCodes = normalizeRoleCodes(roleCodes);
  const params = [normalizedEntityId];

  // 'DEPARTMENT' rows are the department bucket; every other entity_type value
  // lands in the entity bucket, exactly as loadAssignmentBuckets splits them.
  let sql = `
    SELECT DISTINCT uer.user_id
    FROM user_entity_roles uer
    JOIN roles r ON r.id = uer.role_id
    WHERE uer.entity_id = ?
      AND uer.entity_type ${isDepartment ? '=' : '<>'} 'DEPARTMENT'
  `;

  if (normalizedRoleCodes.length > 0) {
    sql += ' AND LOWER(TRIM(r.role_code)) IN (?)';
    params.push(normalizedRoleCodes);
  }

  const [rows] = await conn.query(sql, params);
  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * Users who hold no explicit assignment of the relevant kind at all. The
 * forward path falls back to a user's primary employee record only when their
 * assignment bucket came back empty, so the inverse must exclude anyone who
 * has an assignment pointing somewhere else — otherwise an HOD of Department A
 * would be notified about Department B simply because their employee row says
 * B.
 */
async function findUserIdsWithoutUnitAssignment(conn, { isDepartment, roleCodes = [] }) {
  const normalizedRoleCodes = normalizeRoleCodes(roleCodes);
  const params = [];

  let sql = `
    SELECT DISTINCT uer.user_id
    FROM user_entity_roles uer
    JOIN roles r ON r.id = uer.role_id
    WHERE uer.entity_type ${isDepartment ? '=' : '<>'} 'DEPARTMENT'
  `;

  if (normalizedRoleCodes.length > 0) {
    sql += ' AND LOWER(TRIM(r.role_code)) IN (?)';
    params.push(normalizedRoleCodes);
  }

  const [rows] = await conn.query(sql, params);
  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * Inverse of `loadPrimaryEmployeeContext`: whose PRIMARY employee row sits in
 * this org unit?
 *
 * The primary qualifier is the whole point. `loadPrimaryEmployeeContext` — the
 * forward path, and therefore what `assertRecordScopeAccess` enforces — reads
 * one row per user, the lowest-id active one. Matching any active row here
 * would make the notification audience a superset of who can actually open the
 * record: a user with employee rows in two departments would be told about the
 * second department's records and then be refused when they clicked through.
 * The MIN(id) join pins each user to the same single row the forward path picks.
 */
async function findUserIdsByPrimaryEmployeeUnit(conn, { entityId, isDepartment }) {
  const normalizedEntityId = toPositiveInt(entityId);
  if (!normalizedEntityId) return new Set();

  const column = isDepartment ? 'department_id' : 'entity_id';
  const [rows] = await conn.query(
    `SELECT DISTINCT e.user_id
     FROM master_employees e
     JOIN (
       SELECT user_id, MIN(id) AS primary_id
       FROM master_employees
       WHERE status = 'Active'
         AND user_id IS NOT NULL
       GROUP BY user_id
     ) primary_row ON primary_row.primary_id = e.id
     WHERE e.${column} = ?`,
    [normalizedEntityId],
  );

  return new Set(rows.map((row) => toPositiveInt(row.user_id)).filter(Boolean));
}

/**
 * The people who may act on `recordContext` at `stageKey`.
 *
 * Deliberately does NOT include admins or super admins. They can act on
 * everything, so including them here would mean every approval in the
 * institution lands in their bell — the fastest way to make people stop
 * reading notifications. They opt in through their notification preferences
 * instead.
 *
 * @returns {Promise<number[]>} deduped user ids, possibly empty
 */
export async function resolveStageRecipients({
  conn = db,
  moduleKey,
  stageKey,
  recordContext = null,
  stagePolicy = null,
}) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedStageKey = normalizeText(stageKey).toLowerCase();

  if (!normalizedStageKey) return [];

  const policy =
    stagePolicy ||
    (await resolveStagePolicy(conn, {
      moduleKey: normalizedModuleKey,
      stageKey: normalizedStageKey,
    }));

  const scopeType = resolveEffectiveScopeType({
    stagePolicy: policy,
    recordContext,
    filters: {},
  });

  // `resolveEffectiveScopeType` can promote a globally-configured stage to
  // department or entity scope based on the record, and the stricter scope then
  // demands meta the policy row may not carry. The forward path is right to
  // raise on that, but here it would mean an event retrying until it exhausted
  // its attempts. Fall back to empty meta and carry on: the worst case is that
  // we require an explicit assignment where the config meant to allow a
  // fallback, which under-notifies rather than leaking across departments.
  let normalizedMeta = null;
  try {
    normalizedMeta = validateStagePolicyMeta({ scopeType, meta: policy?.meta });
  } catch (error) {
    console.warn(
      `Stage policy meta for ${normalizedModuleKey}/${normalizedStageKey} is not valid for ` +
        `${scopeType} scope (${error.message}); resolving recipients without it.`,
    );
  }

  const requireAssignment = Boolean(normalizedMeta?.requireAssignment);
  const assignmentRoleCodes = normalizeRoleCodes(normalizedMeta?.assignmentRoleCodes || []);

  // `chairman` is finance-only, matching canAccessStageByRole.
  const stageRoleCodes =
    normalizedStageKey === 'chairman' && normalizedModuleKey !== 'finance'
      ? []
      : STAGE_ROLE_CODES[normalizedStageKey] || [];

  // Expenditure additionally honours finance.workflow.* permissions, which is
  // what assertDecisionPermission accepts.
  const permissionModuleKeys =
    normalizedModuleKey === 'expenditure'
      ? ['expenditure', 'finance']
      : [normalizedModuleKey].filter(Boolean);
  const permissionKeys = permissionModuleKeys.map((mk) => `${mk}.workflow.${normalizedStageKey}`);

  const [byRole, byPermission] = await Promise.all([
    findUserIdsByRoleCodes(conn, stageRoleCodes),
    findUserIdsByPermissionKeys(conn, permissionKeys),
  ]);

  const candidates = new Set([...byRole, ...byPermission]);
  if (!candidates.size) return [];

  if (scopeType === 'global') {
    return [...candidates];
  }

  const isDepartment = scopeType === 'department';
  const unitId = isDepartment
    ? toPositiveInt(recordContext?.departmentId)
    : toPositiveInt(recordContext?.beneficiaryEntityId);

  // A scoped stage with no org unit on the record has no addressable audience.
  // The forward path throws SCOPE_CONTEXT_MISSING here; for notifications the
  // right answer is silence, not a 500.
  if (!unitId) return [];

  const assigned = await findUserIdsAssignedToUnit(conn, {
    entityId: unitId,
    isDepartment,
    roleCodes: assignmentRoleCodes,
  });

  const inScope = new Set(assigned);

  if (!requireAssignment) {
    const [employedHere, assignedAnywhere] = await Promise.all([
      findUserIdsByPrimaryEmployeeUnit(conn, { entityId: unitId, isDepartment }),
      findUserIdsWithoutUnitAssignment(conn, { isDepartment, roleCodes: assignmentRoleCodes }),
    ]);

    for (const userId of employedHere) {
      // Only users with no assignment of this kind fall back to their employee
      // record — the same condition the forward path applies.
      if (!assignedAnywhere.has(userId)) inScope.add(userId);
    }
  }

  return [...candidates].filter((userId) => inScope.has(userId));
}

export async function resolveQueueScopeFilters({ conn = db, actor, stagePolicy, filters = {} }) {
  return resolveScopedActorIds(conn, actor, stagePolicy, { filters });
}

export async function assertRecordScopeAccess({ conn = db, actor, stagePolicy, recordContext }) {
  const resolvedScope = await resolveScopedActorIds(conn, actor, stagePolicy, {
    recordContext,
  });

  if (resolvedScope.forceAll) {
    return true;
  }

  if (resolvedScope.scopeType === 'department') {
    const departmentId = toPositiveInt(recordContext?.departmentId);

    if (!departmentId) {
      throw new WorkflowError(
        'Department scope requires record department_id',
        403,
        'SCOPE_CONTEXT_MISSING',
      );
    }

    if (!resolvedScope.departmentIds.has(departmentId)) {
      throw new WorkflowError(
        'Record is outside your department workflow scope',
        403,
        'WORKFLOW_SCOPE_DENIED',
      );
    }

    return true;
  }

  if (resolvedScope.scopeType === 'entity') {
    const entityId = toPositiveInt(recordContext?.beneficiaryEntityId);

    if (!entityId) {
      throw new WorkflowError(
        'Entity scope requires record beneficiary_entity_id',
        403,
        'SCOPE_CONTEXT_MISSING',
      );
    }

    if (!resolvedScope.entityIds.has(entityId)) {
      throw new WorkflowError(
        'Record is outside your entity workflow scope',
        403,
        'WORKFLOW_SCOPE_DENIED',
      );
    }

    return true;
  }

  return true;
}
