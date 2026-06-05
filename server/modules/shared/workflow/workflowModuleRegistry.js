const WORKFLOW_MODULE_REGISTRY = new Map();

const normalizeModuleKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const ensureSafeIdentifier = (value, label) => {
  const token = String(value || '').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return token;
};

export const registerWorkflowModule = ({
  moduleKey,
  tableName,
  idColumn = 'id',
  stateColumn = 'workflow_state',
  adapter,
}) => {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);

  if (!normalizedModuleKey) {
    throw new Error('moduleKey is required to register workflow module');
  }

  if (!adapter || typeof adapter !== 'object') {
    throw new Error(`Workflow adapter missing for module: ${normalizedModuleKey}`);
  }

  const requiredMethods = [
    'getRecordContext',
    'updateRecordWorkflowSnapshot',
    'listRecordsForQueue',
  ];

  for (const methodName of requiredMethods) {
    if (typeof adapter[methodName] !== 'function') {
      throw new Error(`Workflow adapter for ${normalizedModuleKey} must implement ${methodName}`);
    }
  }

  WORKFLOW_MODULE_REGISTRY.set(normalizedModuleKey, {
    moduleKey: normalizedModuleKey,
    tableName: ensureSafeIdentifier(tableName, 'tableName'),
    idColumn: ensureSafeIdentifier(idColumn, 'idColumn'),
    stateColumn: ensureSafeIdentifier(stateColumn, 'stateColumn'),
    adapter,
  });
};

export const getWorkflowModule = (moduleKey) => {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);

  if (!normalizedModuleKey) {
    throw new Error('moduleKey is required');
  }

  const entry = WORKFLOW_MODULE_REGISTRY.get(normalizedModuleKey);

  if (!entry) {
    throw new Error(`Workflow module not registered: ${normalizedModuleKey}`);
  }

  return entry;
};

export const listRegisteredWorkflowModules = () => Array.from(WORKFLOW_MODULE_REGISTRY.keys());
