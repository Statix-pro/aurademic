import db from '../../../config/connection.js';
import { getWorkflowModule } from './workflowModuleRegistry.js';
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
import {
  assertRecordScopeAccess,
  resolveQueueScopeFilters,
} from './workflowScopeResolver.js';

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

const withTransaction = async (callback) => {
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

async function getWorkflowStateFromRecord(conn, moduleConfig, recordId, { forUpdate = false } = {}) {
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
    [normalizedRecordId]
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
    [beneficiaryEntityId]
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
    ]
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
    [normalizedStageKey, normalizedModuleKey, normalizedModuleKey]
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
    throw new WorkflowError(`Workflow cannot be acted on in status: ${status}`, 409, 'WORKFLOW_NOT_ACTIONABLE');
  }

  if (!currentStage) {
    throw new WorkflowError('Workflow current stage is missing', 409, 'WORKFLOW_STAGE_MISSING');
  }

  if (!flow.includes(currentStage)) {
    throw new WorkflowError('Workflow current stage is not present in flow', 409, 'WORKFLOW_STAGE_INVALID');
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
    throw new WorkflowError('Feedback is required for returned/rejected decisions', 400, 'FEEDBACK_REQUIRED');
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
  if (isSuperAdminActor(actor)) {
    return;
  }

  const permissionSet = normalizePermissionSet(actor);
  const requiredPermission = `${moduleKey}.workflow.${currentStage}`;

  if (!permissionSet.has(requiredPermission)) {
    throw new WorkflowError(
      `Insufficient permission for stage: ${currentStage}`,
      403,
      'WORKFLOW_PERMISSION_DENIED'
    );
  }
};

const normalizeActorPayload = (actor = {}) => ({
  userId: toPositiveInt(actor?.userId || actor?.id),
  email: normalizeText(actor?.email).toLowerCase() || null,
  role: normalizeText(actor?.role).toLowerCase() || null,
  roles: Array.isArray(actor?.roles) ? actor.roles : [],
  permissions: Array.isArray(actor?.permissions) ? actor.permissions : [],
  isSuperAdmin: Boolean(actor?.isSuperAdmin || actor?.is_super_admin),
});

export async function startWorkflow({ moduleKey, recordId, metadata = {} }) {
  const moduleConfig = getWorkflowModule(moduleKey);

  return withTransaction(async (conn) => {
    const context = await moduleConfig.adapter.getRecordContext(recordId, {
      tx: conn,
      forUpdate: true,
    });

    if (!context) {
      throw new WorkflowError('Record not found', 404, 'WORKFLOW_RECORD_NOT_FOUND');
    }

    const entityTypeCode = await resolveEntityTypeCodeFromContext(conn, context);

    const flow = await resolveFlowConfig(conn, {
      moduleKey,
      beneficiaryType: context.beneficiaryType,
      entityTypeCode,
    });

    const initialState = buildInitialState(flow, {
      submittedTotalBudget: Number(context.totalBudget || 0),
    });
    const normalizedMeta = await validateAdapterModuleMeta({
      moduleConfig,
      normalizedMeta: validateWorkflowMeta(metadata),
      operation: 'start',
      recordId,
      context,
    });

    await moduleConfig.adapter.updateRecordWorkflowSnapshot(recordId, initialState, {
      tx: conn,
      metadata: normalizedMeta,
    });

    return {
      moduleKey,
      recordId: toPositiveInt(recordId),
      state: initialState,
    };
  });
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

export async function actOnWorkflow({ moduleKey, recordId, decision, feedback, actor, metadata = {} }) {
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
      ]
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
      { tx: conn }
    );
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
    [normalizedModuleKey, normalizedRecordId]
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
      [normalizedModuleKey, normalizedModuleKey]
    ),
    db.query(
      `SELECT stage_key
         FROM workflow_stage_policies
        WHERE is_active = 1
          AND LOWER(TRIM(module_key)) IN (?, '*')
        ORDER BY CASE WHEN LOWER(TRIM(module_key)) = ? THEN 0 ELSE 1 END, id ASC`,
      [normalizedModuleKey, normalizedModuleKey]
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
  const permittedStageKeys = isSuperAdminActor(normalizedActor)
    ? allStageKeys
    : allStageKeys.filter((stageKey) => permissionSet.has(`${normalizedModuleKey}.workflow.${stageKey}`));

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
  listQueue,
  getTimeline,
  getWorkflow,
  getWorkflowMetadata,
};
