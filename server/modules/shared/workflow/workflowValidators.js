export const WORKFLOW_STAGE_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export class WorkflowError extends Error {
  constructor(message, statusCode = 400, code = 'WORKFLOW_ERROR') {
    super(message);
    this.name = 'WorkflowError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const normalizeText = (value) => String(value || '').trim();

export const parseJsonValue = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const uniqueStringArray = (values = []) =>
  [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];

export const validateFlowArray = (flow, { field = 'flow' } = {}) => {
  const parsed = parseJsonValue(flow, flow);
  const stages = Array.isArray(parsed) ? parsed.map((stage) => normalizeText(stage).toLowerCase()) : [];

  if (!stages.length) {
    throw new WorkflowError(`${field} must be a non-empty array`, 500, 'INVALID_WORKFLOW_FLOW');
  }

  for (const stage of stages) {
    if (!WORKFLOW_STAGE_KEY_REGEX.test(stage)) {
      throw new WorkflowError(
        `${field} contains invalid stage key: ${stage}`,
        500,
        'INVALID_WORKFLOW_STAGE_KEY'
      );
    }
  }

  const uniqueStages = uniqueStringArray(stages);

  if (uniqueStages.length !== stages.length) {
    throw new WorkflowError(
      `${field} contains duplicate stage keys`,
      500,
      'DUPLICATE_WORKFLOW_STAGE_KEY'
    );
  }

  return uniqueStages;
};

export const validateDecision = (decision) => {
  const normalized = normalizeText(decision).toLowerCase();
  const validDecisions = ['approved', 'rejected', 'returned', 'archived'];

  if (!validDecisions.includes(normalized)) {
    throw new WorkflowError(
      `Invalid workflow decision: ${decision}`,
      400,
      'INVALID_WORKFLOW_DECISION'
    );
  }

  return normalized;
};

export const validateWorkflowMeta = (meta = {}) => {
  const payload = meta && typeof meta === 'object' ? { ...meta } : {};

  const origin = normalizeText(payload.origin).toLowerCase() || 'api';
  if (!['api', 'system', 'resubmit'].includes(origin)) {
    throw new WorkflowError('Invalid workflow meta.origin', 400, 'INVALID_WORKFLOW_META');
  }

  let requestId = null;
  if (payload.requestId !== undefined && payload.requestId !== null) {
    if (typeof payload.requestId !== 'string') {
      throw new WorkflowError('workflow meta.requestId must be string or null', 400, 'INVALID_WORKFLOW_META');
    }
    requestId = normalizeText(payload.requestId) || null;
  }

  let moduleMetaVersion = 1;
  if (payload.moduleMetaVersion !== undefined && payload.moduleMetaVersion !== null) {
    const moduleMetaVersionValue = Number.parseInt(payload.moduleMetaVersion, 10);
    if (!Number.isInteger(moduleMetaVersionValue) || moduleMetaVersionValue <= 0) {
      throw new WorkflowError('workflow meta.moduleMetaVersion must be a positive integer', 400, 'INVALID_WORKFLOW_META');
    }
    moduleMetaVersion = moduleMetaVersionValue;
  }

  const moduleMetaRaw = payload.moduleMeta ?? null;
  const moduleMeta = moduleMetaRaw === null
    ? null
    : typeof moduleMetaRaw === 'object' && !Array.isArray(moduleMetaRaw)
      ? moduleMetaRaw
      : null;

  if (moduleMetaRaw !== null && moduleMeta === null) {
    throw new WorkflowError(
      'workflow meta.moduleMeta must be an object or null',
      400,
      'INVALID_WORKFLOW_META'
    );
  }

  return {
    origin,
    requestId,
    moduleMetaVersion,
    moduleMeta,
  };
};

export const validateStagePolicyMeta = ({ scopeType, meta }) => {
  const normalizedScopeType = normalizeText(scopeType).toLowerCase();

  if (normalizedScopeType === 'global') {
    const parsed = parseJsonValue(meta, meta);
    if (parsed !== null && parsed !== undefined) {
      throw new WorkflowError(
        'workflow stage policy meta must be null for global scope',
        500,
        'INVALID_STAGE_POLICY_META'
      );
    }
    return null;
  }

  if (!['department', 'entity'].includes(normalizedScopeType)) {
    throw new WorkflowError(`Unsupported workflow scope type: ${scopeType}`, 500, 'INVALID_SCOPE_TYPE');
  }

  const payload = parseJsonValue(meta, meta);

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WorkflowError(
      `workflow stage policy meta is required for ${normalizedScopeType} scope`,
      500,
      'INVALID_STAGE_POLICY_META'
    );
  }

  if (!Array.isArray(payload.assignmentRoleCodes)) {
    throw new WorkflowError(
      'workflow stage policy meta.assignmentRoleCodes must be an array',
      500,
      'INVALID_STAGE_POLICY_META'
    );
  }

  if (!payload.assignmentRoleCodes.every((roleCode) => typeof roleCode === 'string')) {
    throw new WorkflowError(
      'workflow stage policy meta.assignmentRoleCodes must contain only strings',
      500,
      'INVALID_STAGE_POLICY_META'
    );
  }

  if (typeof payload.requireAssignment !== 'boolean') {
    throw new WorkflowError(
      'workflow stage policy meta.requireAssignment must be a boolean',
      500,
      'INVALID_STAGE_POLICY_META'
    );
  }

  const assignmentRoleCodes = uniqueStringArray(payload.assignmentRoleCodes).map((roleCode) =>
    roleCode.toLowerCase()
  );
  const requireAssignment = payload.requireAssignment;

  return {
    assignmentRoleCodes,
    requireAssignment,
  };
};

export const isSuperAdminActor = (actor = {}) => {
  if (actor.isSuperAdmin || actor.is_super_admin) {
    return true;
  }

  const roleTokens = Array.isArray(actor.roles) ? actor.roles : [];
  return roleTokens.some((role) => normalizeText(role).toLowerCase() === 'super_admin');
};

export const normalizePermissionSet = (actor = {}) => {
  const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
  return new Set(
    permissions
      .map((permission) => normalizeText(permission).toLowerCase())
      .filter(Boolean)
  );
};
