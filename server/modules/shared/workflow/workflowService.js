import { getWorkflowModule } from './workflowModuleRegistry.js';
import { assertRecordScopeAccess, resolveQueueScopeFilters } from './workflowScopeResolver.js';
import {
  WorkflowError,
  normalizeText,
  parseJsonValue,
  validateFlowArray,
  validateDecision,
  validateWorkflowMeta,
  validateStagePolicyMeta,
  isSuperAdminActor,
  normalizePermissionSet,
} from './workflowValidators.js';
import db from '../../../config/connection.js';

const DEFAULT_FLOW = Object.freeze(['level1', 'dof', 'principal']);
const TERMINAL_STATUSES = new Set(['completed', 'rejected', 'archived']);
const ACTIONABLE_STATUSES = new Set(['in_progress', 'returned']);

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const ensureSafeIdentifier = (value, label) => {
  const token = normalizeText(value);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
    throw new WorkflowError(`Invalid ${label}: ${value}`, 500, 'INVALID_WORKFLOW_REGISTRY');
  }
  return token;
};

const withTransaction = async (callback, { tx = null } = {}) => {
  if (tx) {
    return callback(tx);
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

const parseWorkflowState = (rawState) => {
  const state = parseJsonValue(rawState, null);
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return null;
  }
  return state;
};

async function getWorkflowStateFromRecord(
  conn,
  moduleConfig,
  recordId,
  { forUpdate = false } = {},
) {
  const tableName = ensureSafeIdentifier(moduleConfig.tableName, 'tableName');
  const idColumn = ensureSafeIdentifier(moduleConfig.idColumn, 'idColumn');
  const stateColumn = ensureSafeIdentifier(moduleConfig.stateColumn, 'stateColumn');
  const normalizedRecordId = toPositiveInt(recordId);

  if (!normalizedRecordId) {
    throw new WorkflowError('Invalid record ID', 400, 'INVALID_RECORD_ID');
  }

  const lockClause = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(
    `SELECT \`${stateColumn}\` AS workflow_state
     FROM \`${tableName}\`
     WHERE \`${idColumn}\` = ?${lockClause}`,
    [normalizedRecordId],
  );

  if (!rows.length) {
    return null;
  }

  return parseWorkflowState(rows[0].workflow_state);
}

async function resolveEntityTypeCodeFromContext(conn, context = {}) {
  const beneficiaryEntityId = toPositiveInt(context?.beneficiaryEntityId);

  if (!beneficiaryEntityId) {
    return null;
  }

  const [rows] = await conn.query(
    `SELECT met.code
     FROM master_entities me
     JOIN master_entity_types met ON met.id = me.entity_type_id
     WHERE me.id = ?
     LIMIT 1`,
    [beneficiaryEntityId],
  );

  if (!rows.length) {
    return null;
  }

  return normalizeText(rows[0].code).toUpperCase() || null;
}

async function resolveFlowConfig(conn, { moduleKey, beneficiaryType, entityTypeCode }) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedBeneficiaryType = normalizeText(beneficiaryType).toLowerCase() || '*';
  const normalizedEntityTypeCode = normalizeText(entityTypeCode).toUpperCase() || null;

  const [rows] = await conn.query(
    `SELECT id, module_key, beneficiary_type, entity_type_code, flow
     FROM approval_flow_config
     WHERE is_active = 1
       AND LOWER(TRIM(module_key)) IN (?, '*')
       AND LOWER(TRIM(beneficiary_type)) IN (?, '*')
       AND (
         (? IS NULL AND entity_type_code IS NULL)
         OR (? IS NOT NULL AND (
           UPPER(TRIM(entity_type_code)) = ?
           OR entity_type_code IS NULL
         ))
       )
     ORDER BY
       CASE WHEN LOWER(TRIM(module_key)) = ? THEN 0 ELSE 1 END,
       CASE WHEN LOWER(TRIM(beneficiary_type)) = ? THEN 0 ELSE 1 END,
       CASE
         WHEN ? IS NOT NULL AND UPPER(TRIM(entity_type_code)) = ? THEN 0
         WHEN entity_type_code IS NULL THEN 1
         ELSE 2
       END,
       id ASC
     LIMIT 1`,
    [
      normalizedModuleKey,
      normalizedBeneficiaryType,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
      normalizedModuleKey,
      normalizedBeneficiaryType,
      normalizedEntityTypeCode,
      normalizedEntityTypeCode,
    ],
  );

  if (!rows.length) {
    return [...DEFAULT_FLOW];
  }

  return validateFlowArray(rows[0].flow, { field: 'approval_flow_config.flow' });
}

async function resolveStagePolicy(conn, { moduleKey, stageKey }) {
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

const buildInitialState = (flow, extras = {}) => {
  const nowIso = new Date().toISOString();

  return {
    version: 1,
    flow,
    currentStage: flow[0],
    status: 'in_progress',
    isEditableByApplicant: false,
    startedAt: nowIso,
    updatedAt: nowIso,
    resolvedAt: null,
    lastDecision: null,
    lastFeedback: null,
    ...extras,
  };
};

const validateAdapterModuleMeta = async ({
  moduleConfig,
  normalizedMeta,
  operation,
  recordId,
  context,
  decision = null,
}) => {
  const validator = moduleConfig?.adapter?.validateModuleMeta;

  if (typeof validator !== 'function') {
    return normalizedMeta;
  }

  const validatedModuleMeta = await validator(normalizedMeta.moduleMeta, {
    operation,
    recordId: toPositiveInt(recordId),
    context,
    decision,
  });

  return {
    ...normalizedMeta,
    moduleMeta: validatedModuleMeta ?? null,
  };
};

const assertWorkflowActionable = (state) => {
  if (!state) {
    throw new WorkflowError('Workflow state not found', 400, 'WORKFLOW_NOT_STARTED');
  }

  const flow = validateFlowArray(state.flow, { field: 'workflow_state.flow' });
  const status = normalizeText(state.status).toLowerCase();
  const currentStage = normalizeText(state.currentStage).toLowerCase();

  if (TERMINAL_STATUSES.has(status)) {
    throw new WorkflowError('Workflow is already in a terminal state', 409, 'WORKFLOW_TERMINAL');
  }

  if (!ACTIONABLE_STATUSES.has(status)) {
    throw new WorkflowError(
      `Workflow cannot be acted on in status: ${status}`,
      409,
      'WORKFLOW_NOT_ACTIONABLE',
    );
  }

  if (!currentStage) {
    throw new WorkflowError('Workflow current stage is missing', 409, 'WORKFLOW_STAGE_MISSING');
  }

  if (!flow.includes(currentStage)) {
    throw new WorkflowError(
      'Workflow current stage is not present in flow',
      409,
      'WORKFLOW_STAGE_INVALID',
    );
  }

  return {
    flow,
    status,
    currentStage,
  };
};

const computeNextWorkflowState = ({ state, decision, feedback }) => {
  const nowIso = new Date().toISOString();
  const clonedState = {
    ...state,
    flow: [...state.flow],
  };

  const currentStage = normalizeText(clonedState.currentStage).toLowerCase();
  const stageIndex = clonedState.flow.indexOf(currentStage);

  if (stageIndex < 0) {
    throw new WorkflowError('Current stage not found in flow', 409, 'WORKFLOW_STAGE_INVALID');
  }

  const normalizedFeedback = normalizeText(feedback) || null;

  if (['rejected', 'returned'].includes(decision) && !normalizedFeedback) {
    throw new WorkflowError(
      'Feedback is required for returned/rejected decisions',
      400,
      'FEEDBACK_REQUIRED',
    );
  }

  clonedState.lastDecision = decision;
  clonedState.lastFeedback = normalizedFeedback;
  clonedState.updatedAt = nowIso;

  if (decision === 'approved') {
    const nextStage = clonedState.flow[stageIndex + 1] || null;

    if (!nextStage) {
      clonedState.currentStage = null;
      clonedState.status = 'completed';
      clonedState.resolvedAt = nowIso;
      clonedState.isEditableByApplicant = false;
      return clonedState;
    }

    clonedState.currentStage = nextStage;
    clonedState.status = 'in_progress';
    clonedState.resolvedAt = null;
    clonedState.isEditableByApplicant = false;
    return clonedState;
  }

  if (decision === 'returned') {
    clonedState.status = 'returned';
    clonedState.resolvedAt = null;
    clonedState.isEditableByApplicant = true;
    return clonedState;
  }

  if (decision === 'rejected') {
    clonedState.status = 'rejected';
    clonedState.currentStage = null;
    clonedState.resolvedAt = nowIso;
    clonedState.isEditableByApplicant = false;
    return clonedState;
  }

  if (decision === 'archived') {
    clonedState.status = 'archived';
    clonedState.currentStage = null;
    clonedState.resolvedAt = nowIso;
    clonedState.isEditableByApplicant = false;
    return clonedState;
  }

  throw new WorkflowError(`Unsupported decision: ${decision}`, 400, 'INVALID_WORKFLOW_DECISION');
};

const assertDecisionPermission = ({ moduleKey, currentStage, actor }) => {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedStageKey = normalizeText(currentStage).toLowerCase();

  // Super admin: always allowed
  if (isSuperAdminActor(actor)) {
    return;
  }

  // Role-based access (hod / coordinator / dof / principal / chairman)
  if (
    canAccessStageByRole({ moduleKey: normalizedModuleKey, actor, stageKey: normalizedStageKey })
  ) {
    return;
  }

  const permissionSet = normalizePermissionSet(actor);

  // For expenditure, also accept finance.workflow.* permissions
  const permissionModuleKeys =
    normalizedModuleKey === 'expenditure' ? ['expenditure', 'finance'] : [normalizedModuleKey];

  const hasPermission = permissionModuleKeys.some((mk) =>
    permissionSet.has(`${mk}.workflow.${normalizedStageKey}`),
  );

  if (!hasPermission) {
    throw new WorkflowError(
      `Insufficient permission for stage: ${normalizedStageKey}`,
      403,
      'WORKFLOW_PERMISSION_DENIED',
    );
  }
};

const extractToken = (value) => {
  if (typeof value === 'string') return normalizeText(value);
  if (value && typeof value === 'object') {
    const candidates = [
      value.role,
      value.role_code,
      value.roleCode,
      value.permission,
      value.permission_key,
      value.permissionKey,
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

const normalizeTokenList = (value) => {
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => extractToken(item)).filter(Boolean);
};

const normalizeActorPayload = (actor = {}) => {
  const roles = normalizeTokenList(actor?.roles);
  const role = normalizeText(actor?.role).toLowerCase() || null;
  if (role && !roles.some((item) => normalizeText(item).toLowerCase() === role)) {
    roles.push(role);
  }

  return {
    userId: toPositiveInt(actor?.userId || actor?.id),
    email: normalizeText(actor?.email).toLowerCase() || null,
    role,
    roles,
    permissions: normalizeTokenList(actor?.permissions),
    isSuperAdmin: Boolean(actor?.isSuperAdmin || actor?.is_super_admin),
  };
};

const getNormalizedActorRoles = (actor = {}) =>
  (Array.isArray(actor?.roles) ? actor.roles : [])
    .map((role) => extractToken(role).toLowerCase())
    .filter(Boolean);

const canAccessExpenditureStageByRole = (actor = {}, stageKey = '') => {
  const normalizedStage = normalizeText(stageKey).toLowerCase();
  if (!normalizedStage) {
    return false;
  }

  if (isSuperAdminActor(actor)) {
    return true;
  }

  const roles = getNormalizedActorRoles(actor);
  if (!roles.length) {
    return false;
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

const canAccessStageByRole = ({ moduleKey, actor = {}, stageKey = '' }) => {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedStage = normalizeText(stageKey).toLowerCase();
  if (!normalizedModuleKey || !normalizedStage) {
    return false;
  }

  if (normalizedStage === 'level1') {
    const roles = getNormalizedActorRoles(actor);
    return roles.some((role) => ['hod', 'coordinator', 'entity_approver'].includes(role));
  }

  if (normalizedStage === 'dof') {
    const roles = getNormalizedActorRoles(actor);
    return roles.includes('dof');
  }

  if (normalizedStage === 'principal') {
    const roles = getNormalizedActorRoles(actor);
    return roles.includes('principal');
  }

  if (normalizedStage === 'chairman') {
    const roles = getNormalizedActorRoles(actor);
    return normalizedModuleKey === 'finance' && roles.includes('chairman');
  }

  return normalizedModuleKey === 'expenditure'
    ? canAccessExpenditureStageByRole(actor, normalizedStage)
    : false;
};

export async function startWorkflow({ moduleKey, recordId, metadata = {}, actor = null, tx = null }) {
  const moduleConfig = getWorkflowModule(moduleKey);

  return withTransaction(
    async (conn) => {
      const context = await moduleConfig.adapter.getRecordContext(recordId, {
        tx: conn,
        forUpdate: true,
      });

      if (!context) {
        throw new WorkflowError('Record not found', 404, 'WORKFLOW_RECORD_NOT_FOUND');
      }

      // Legacy records may be initialized concurrently by two approval
      // requests. The row lock makes initialization and the following action
      // observe one state; never overwrite a state another request created.
      const existingState = await getWorkflowStateFromRecord(conn, moduleConfig, recordId, {
        forUpdate: true,
      });
      if (existingState) {
        return {
          moduleKey,
          recordId: toPositiveInt(recordId),
          state: existingState,
          initialized: false,
        };
      }

      const normalizedMeta = await validateAdapterModuleMeta({
        moduleConfig,
        normalizedMeta: validateWorkflowMeta(metadata),
        operation: 'start',
        recordId,
        context,
      });

      const entityTypeCode = await resolveEntityTypeCodeFromContext(conn, context);
      const adapterFlowResolver = moduleConfig?.adapter?.resolveStartFlow;
      const adapterResolvedFlow =
        typeof adapterFlowResolver === 'function'
          ? adapterFlowResolver({
              context,
              metadata: normalizedMeta,
            })
          : null;

      const flow =
        Array.isArray(adapterResolvedFlow) && adapterResolvedFlow.length > 0
          ? validateFlowArray(adapterResolvedFlow, { field: 'workflow adapter start flow' })
          : await resolveFlowConfig(conn, {
              moduleKey,
              beneficiaryType: context.beneficiaryType,
              entityTypeCode,
          });

      if (actor) {
        const normalizedActor = normalizeActorPayload(actor);
        if (!normalizedActor.userId) {
          throw new WorkflowError('Actor user ID is required', 400, 'ACTOR_REQUIRED');
        }
        const firstStage = flow[0];
        assertDecisionPermission({
          moduleKey: normalizeText(moduleKey).toLowerCase(),
          currentStage: firstStage,
          actor: normalizedActor,
        });
        const stagePolicy = await resolveStagePolicy(conn, {
          moduleKey,
          stageKey: firstStage,
        });
        await assertRecordScopeAccess({
          conn,
          actor: normalizedActor,
          stagePolicy,
          recordContext: context,
        });
      }

      const initialState = buildInitialState(flow, {
        submittedTotalBudget: Number(context.totalBudget || 0),
      });

      const financeMeta = normalizedMeta?.moduleMeta?.financeMeta;
      if (financeMeta && typeof financeMeta === 'object' && !Array.isArray(financeMeta)) {
        initialState.financeMeta = {
          ...financeMeta,
        };
      }

      const expenditureMeta = normalizedMeta?.moduleMeta?.expenditureMeta;
      if (
        expenditureMeta &&
        typeof expenditureMeta === 'object' &&
        !Array.isArray(expenditureMeta)
      ) {
        initialState.expenditureMeta = {
          ...expenditureMeta,
        };
      }

      await moduleConfig.adapter.updateRecordWorkflowSnapshot(recordId, initialState, {
        tx: conn,
        metadata: normalizedMeta,
      });

      return {
        moduleKey,
        recordId: toPositiveInt(recordId),
        state: initialState,
      };
    },
    { tx },
  );
}

export async function getWorkflow({ moduleKey, recordId }) {
  const moduleConfig = getWorkflowModule(moduleKey);
  const conn = await db.getConnection();

  try {
    const state = await getWorkflowStateFromRecord(conn, moduleConfig, recordId);
    return state;
  } finally {
    conn.release();
  }
}

export async function actOnWorkflow({
  moduleKey,
  recordId,
  decision,
  feedback,
  actor,
  metadata = {},
}) {
  const moduleConfig = getWorkflowModule(moduleKey);
  const normalizedDecision = validateDecision(decision);
  const normalizedActor = normalizeActorPayload(actor);

  if (!normalizedActor.userId) {
    throw new WorkflowError('Actor user ID is required', 400, 'ACTOR_REQUIRED');
  }

  return withTransaction(async (conn) => {
    const context = await moduleConfig.adapter.getRecordContext(recordId, {
      tx: conn,
      forUpdate: true,
    });

    if (!context) {
      throw new WorkflowError('Record not found', 404, 'WORKFLOW_RECORD_NOT_FOUND');
    }

    const previousState = await getWorkflowStateFromRecord(conn, moduleConfig, recordId, {
      forUpdate: true,
    });

    const { currentStage } = assertWorkflowActionable(previousState);

    assertDecisionPermission({
      moduleKey: normalizeText(moduleKey).toLowerCase(),
      currentStage,
      actor: normalizedActor,
    });

    const stagePolicy = await resolveStagePolicy(conn, {
      moduleKey,
      stageKey: currentStage,
    });

    await assertRecordScopeAccess({
      conn,
      actor: normalizedActor,
      stagePolicy,
      recordContext: context,
    });

    const nextState = computeNextWorkflowState({
      state: previousState,
      decision: normalizedDecision,
      feedback,
    });

    const normalizedMeta = await validateAdapterModuleMeta({
      moduleConfig,
      normalizedMeta: validateWorkflowMeta(metadata),
      operation: 'act',
      recordId,
      context,
      decision: normalizedDecision,
    });

    await conn.query(
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
        normalizeText(moduleKey).toLowerCase(),
        toPositiveInt(recordId),
        currentStage,
        normalizedDecision,
        normalizeText(feedback) || null,
        normalizedActor.userId,
        normalizedActor.email,
        normalizedActor.role,
        JSON.stringify(previousState),
        JSON.stringify(normalizedMeta),
      ],
    );

    await moduleConfig.adapter.updateRecordWorkflowSnapshot(recordId, nextState, {
      tx: conn,
      metadata: normalizedMeta,
    });

    return {
      moduleKey: normalizeText(moduleKey).toLowerCase(),
      recordId: toPositiveInt(recordId),
      previousState,
      currentState: nextState,
      decision: normalizedDecision,
      stage: currentStage,
    };
  });
}

export async function restoreWorkflow({ moduleKey, recordId, actor, metadata = {} }) {
  const moduleConfig = getWorkflowModule(moduleKey);
  const normalizedActor = normalizeActorPayload(actor);

  if (!normalizedActor.userId) {
    throw new WorkflowError('Actor user ID is required', 400, 'ACTOR_REQUIRED');
  }

  return withTransaction(async (conn) => {
    const context = await moduleConfig.adapter.getRecordContext(recordId, {
      tx: conn,
      forUpdate: true,
    });
    if (!context) {
      throw new WorkflowError('Record not found', 404, 'WORKFLOW_RECORD_NOT_FOUND');
    }

    const currentState = await getWorkflowStateFromRecord(conn, moduleConfig, recordId, {
      forUpdate: true,
    });
    if (normalizeText(currentState?.status).toLowerCase() !== 'archived') {
      throw new WorkflowError('Workflow is not archived', 409, 'WORKFLOW_NOT_ARCHIVED');
    }

    const [archiveRows] = await conn.query(
      `SELECT stage, snapshot_before
         FROM workflow_actions
        WHERE module_key = ? AND record_id = ? AND decision = 'archived'
        ORDER BY id DESC
        LIMIT 1`,
      [normalizeText(moduleKey).toLowerCase(), toPositiveInt(recordId)],
    );
    if (!archiveRows.length || !archiveRows[0].snapshot_before) {
      throw new WorkflowError('Archived workflow snapshot not found', 409, 'ARCHIVE_SNAPSHOT_MISSING');
    }

    const restoredState = parseWorkflowState(archiveRows[0].snapshot_before);
    const restoredStage = normalizeText(restoredState?.currentStage).toLowerCase();
    if (!restoredState || !restoredStage) {
      throw new WorkflowError('Archived workflow snapshot is invalid', 409, 'ARCHIVE_SNAPSHOT_INVALID');
    }

    assertDecisionPermission({
      moduleKey: normalizeText(moduleKey).toLowerCase(),
      currentStage: restoredStage,
      actor: normalizedActor,
    });
    const stagePolicy = await resolveStagePolicy(conn, { moduleKey, stageKey: restoredStage });
    await assertRecordScopeAccess({
      conn,
      actor: normalizedActor,
      stagePolicy,
      recordContext: context,
    });

    const normalizedMeta = await validateAdapterModuleMeta({
      moduleConfig,
      normalizedMeta: validateWorkflowMeta(metadata),
      operation: 'restore',
      recordId,
      context,
      decision: 'returned',
    });

    restoredState.updatedAt = new Date().toISOString();
    restoredState.lastDecision = 'returned';
    restoredState.lastFeedback = 'Restored from archive';
    await moduleConfig.adapter.updateRecordWorkflowSnapshot(recordId, restoredState, { tx: conn });

    await conn.query(
      `INSERT INTO workflow_actions (
          module_key, record_id, stage, decision, feedback, actor_user_id,
          actor_email, actor_role, snapshot_before, meta
        ) VALUES (?, ?, ?, 'returned', ?, ?, ?, ?, ?, ?)`,
      [
        normalizeText(moduleKey).toLowerCase(),
        toPositiveInt(recordId),
        restoredStage,
        'Restored from archive',
        normalizedActor.userId,
        normalizedActor.email,
        normalizedActor.role,
        JSON.stringify(currentState),
        JSON.stringify(normalizedMeta),
      ],
    );

    return { action: 'restored', currentState: restoredState };
  });
}

export async function listQueue({ moduleKey, stage, actor, filters = {} }) {
  const moduleConfig = getWorkflowModule(moduleKey);
  const normalizedStage = normalizeText(stage).toLowerCase();
  const normalizedActor = normalizeActorPayload(actor);

  if (!normalizedStage) {
    throw new WorkflowError('Queue stage is required', 400, 'WORKFLOW_STAGE_REQUIRED');
  }

  assertDecisionPermission({
    moduleKey: normalizeText(moduleKey).toLowerCase(),
    currentStage: normalizedStage,
    actor: normalizedActor,
  });

  const conn = await db.getConnection();

  try {
    const stagePolicy = await resolveStagePolicy(conn, {
      moduleKey,
      stageKey: normalizedStage,
    });

    const scopeFilters = await resolveQueueScopeFilters({
      conn,
      actor: normalizedActor,
      stagePolicy,
      filters,
    });

    return moduleConfig.adapter.listRecordsForQueue(
      normalizedStage,
      {
        ...filters,
        workflowStatus: normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress',
        moduleKey: normalizeText(moduleKey).toLowerCase(),
        isSuperAdmin: isSuperAdminActor(normalizedActor),
        scopeFilters,
      },
      { tx: conn },
    );
  } finally {
    conn.release();
  }
}

// The queue models clamp `limit` to 100, so the export walks pages instead of asking
// for one huge page. EXPORT_MAX_ROWS caps a runaway export; anything beyond it is
// reported back as `truncated` so the UI can warn instead of silently shortening.
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 1000;

/**
 * Same stage/scope rules as listQueue, but returns every matching record (up to
 * EXPORT_MAX_ROWS) rather than a single page, plus each record's line items when the
 * module adapter exposes `listLineItemsForExport`. Backs the admin CSV export.
 */
export async function listQueueForExport({ moduleKey, stage, actor, filters = {} }) {
  const moduleConfig = getWorkflowModule(moduleKey);
  const normalizedStage = normalizeText(stage).toLowerCase();
  const normalizedActor = normalizeActorPayload(actor);

  if (!normalizedStage) {
    throw new WorkflowError('Queue stage is required', 400, 'WORKFLOW_STAGE_REQUIRED');
  }

  assertDecisionPermission({
    moduleKey: normalizeText(moduleKey).toLowerCase(),
    currentStage: normalizedStage,
    actor: normalizedActor,
  });

  const conn = await db.getConnection();

  try {
    const stagePolicy = await resolveStagePolicy(conn, {
      moduleKey,
      stageKey: normalizedStage,
    });

    const scopeFilters = await resolveQueueScopeFilters({
      conn,
      actor: normalizedActor,
      stagePolicy,
      filters,
    });

    const baseFilters = {
      ...filters,
      workflowStatus: normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress',
      moduleKey: normalizeText(moduleKey).toLowerCase(),
      isSuperAdmin: isSuperAdminActor(normalizedActor),
      scopeFilters,
    };

    const items = [];
    let total = 0;
    let statusCounts;
    let exportedItems = [];
    let lineItems = {};

    // The pages, and the line-item fetch that follows them, read inside one read-only
    // transaction so they all see the same snapshot. Without it a decision taken while
    // the export is paging shifts the OFFSET window under us, so a record can land in
    // the file twice or not at all.
    await conn.beginTransaction();

    try {
      for (let page = 1; ; page += 1) {
        const result = await moduleConfig.adapter.listRecordsForQueue(
          normalizedStage,
          { ...baseFilters, page, limit: EXPORT_PAGE_SIZE },
          { tx: conn },
        );

        const pageItems = Array.isArray(result?.items) ? result.items : [];
        if (page === 1) {
          total = Number(result?.total || 0);
          statusCounts = result?.statusCounts;
        }

        items.push(...pageItems);

        if (pageItems.length < EXPORT_PAGE_SIZE || items.length >= EXPORT_MAX_ROWS) {
          break;
        }
      }

      exportedItems = items.slice(0, EXPORT_MAX_ROWS);

      if (typeof moduleConfig.adapter.listLineItemsForExport === 'function') {
        const recordIds = exportedItems.map((row) => toPositiveInt(row?.id)).filter(Boolean);
        lineItems =
          (await moduleConfig.adapter.listLineItemsForExport(recordIds, { tx: conn })) || {};
      }
    } finally {
      // Read-only: nothing to commit, and rolling back releases the snapshot.
      await conn.rollback();
    }

    return {
      items: exportedItems,
      lineItems,
      total,
      statusCounts,
      // Only flag truncation when the row cap is what actually bound the result. The
      // client narrows further (stage visibility, role tab, amount band), so `total`
      // alone exceeding the exported count is normal and must not trigger a warning.
      truncated: exportedItems.length >= EXPORT_MAX_ROWS && total > exportedItems.length,
      maxRows: EXPORT_MAX_ROWS,
    };
  } finally {
    conn.release();
  }
}

export async function getTimeline({ moduleKey, recordId }) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedRecordId = toPositiveInt(recordId);

  if (!normalizedModuleKey || !normalizedRecordId) {
    throw new WorkflowError('Invalid module or record ID', 400, 'INVALID_TIMELINE_REQUEST');
  }

  const [rows] = await db.query(
    `SELECT
        id,
        module_key,
        record_id,
        stage,
        decision,
        feedback,
        actor_user_id,
        actor_email,
        actor_role,
        decided_at,
        snapshot_before,
        meta
      FROM workflow_actions
      WHERE module_key = ?
        AND record_id = ?
      ORDER BY decided_at ASC, id ASC`,
    [normalizedModuleKey, normalizedRecordId],
  );

  return rows.map((row) => ({
    id: row.id,
    moduleKey: row.module_key,
    recordId: row.record_id,
    stage: row.stage,
    decision: row.decision,
    feedback: row.feedback,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    decidedAt: row.decided_at,
    snapshotBefore: parseJsonValue(row.snapshot_before, null),
    meta: parseJsonValue(row.meta, null),
  }));
}

export async function logWorkflowResubmission({
  moduleKey,
  recordId,
  stage,
  feedback = null,
  actor = {},
  snapshotBefore = null,
  metadata = {},
  tx = null,
}) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedRecordId = toPositiveInt(recordId);
  const normalizedStage = normalizeText(stage).toLowerCase() || 'level1';

  if (!normalizedModuleKey || !normalizedRecordId) {
    throw new WorkflowError('Invalid module or record ID', 400, 'INVALID_RESUBMIT_LOG_REQUEST');
  }

  const actorUserId = toPositiveInt(actor?.userId || actor?.id);
  const actorEmail = normalizeText(actor?.email).toLowerCase() || null;
  const actorRole = normalizeText(actor?.role).toLowerCase() || null;

  const executor = tx || db;
  await executor.query(
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
      ) VALUES (?, ?, ?, 'resubmitted', ?, ?, ?, ?, ?, ?)`,
    [
      normalizedModuleKey,
      normalizedRecordId,
      normalizedStage,
      normalizeText(feedback) || null,
      actorUserId,
      actorEmail,
      actorRole,
      JSON.stringify(snapshotBefore || {}),
      JSON.stringify(validateWorkflowMeta(metadata)),
    ],
  );
}

export async function getWorkflowMetadata({ moduleKey, actor }) {
  const normalizedModuleKey = normalizeText(moduleKey).toLowerCase();
  const normalizedActor = normalizeActorPayload(actor);
  const permissionSet = normalizePermissionSet(normalizedActor);

  const [flowRows, policyRows] = await Promise.all([
    db.query(
      `SELECT flow
         FROM approval_flow_config
         WHERE is_active = 1
           AND LOWER(TRIM(module_key)) IN (?, '*')
         ORDER BY CASE WHEN LOWER(TRIM(module_key)) = ? THEN 0 ELSE 1 END, id ASC`,
      [normalizedModuleKey, normalizedModuleKey],
    ),
    db.query(
      `SELECT stage_key
         FROM workflow_stage_policies
         WHERE is_active = 1
           AND LOWER(TRIM(module_key)) IN (?, '*')
         ORDER BY CASE WHEN LOWER(TRIM(module_key)) = ? THEN 0 ELSE 1 END, id ASC`,
      [normalizedModuleKey, normalizedModuleKey],
    ),
  ]);

  const orderedStages = [];
  const seenStageKeys = new Set();

  for (const row of flowRows[0] || []) {
    const flowStages = validateFlowArray(row.flow, { field: 'approval_flow_config.flow' });
    for (const stageKey of flowStages) {
      if (!seenStageKeys.has(stageKey)) {
        orderedStages.push(stageKey);
        seenStageKeys.add(stageKey);
      }
    }
  }

  for (const row of policyRows[0] || []) {
    const stageKey = normalizeText(row.stage_key).toLowerCase();
    if (stageKey && !seenStageKeys.has(stageKey)) {
      orderedStages.push(stageKey);
      seenStageKeys.add(stageKey);
    }
  }

  if (!orderedStages.length) {
    for (const stageKey of DEFAULT_FLOW) {
      orderedStages.push(stageKey);
      seenStageKeys.add(stageKey);
    }
  }

  const permissionStageKeys = [...permissionSet]
    .map((permissionKey) => normalizeText(permissionKey).toLowerCase())
    .filter((permissionKey) => permissionKey.startsWith(`${normalizedModuleKey}.workflow.`))
    .map((permissionKey) => permissionKey.replace(`${normalizedModuleKey}.workflow.`, ''))
    .filter(Boolean);

  for (const stageKey of permissionStageKeys) {
    if (!seenStageKeys.has(stageKey)) {
      orderedStages.push(stageKey);
      seenStageKeys.add(stageKey);
    }
  }

  const allStageKeys = orderedStages;
  let permittedStageKeys = isSuperAdminActor(normalizedActor)
    ? allStageKeys
    : allStageKeys.filter(
        (stageKey) =>
          permissionSet.has(`${normalizedModuleKey}.workflow.${stageKey}`) ||
          canAccessStageByRole({
            moduleKey: normalizedModuleKey,
            actor: normalizedActor,
            stageKey,
          }),
      );

  if (!permittedStageKeys.length) {
    permittedStageKeys = allStageKeys.filter((stageKey) =>
      canAccessStageByRole({ moduleKey: normalizedModuleKey, actor: normalizedActor, stageKey }),
    );
  }

  return {
    moduleKey: normalizedModuleKey,
    stages: allStageKeys,
    permittedStages: permittedStageKeys,
    isSuperAdmin: isSuperAdminActor(normalizedActor),
  };
}

export default {
  startWorkflow,
  actOnWorkflow,
  restoreWorkflow,
  listQueue,
  listQueueForExport,
  getTimeline,
  getWorkflow,
  logWorkflowResubmission,
  getWorkflowMetadata,
};
