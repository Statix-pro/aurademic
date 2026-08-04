import { User } from '../../types';

const uniqueStringArray = (values = []) => [
  ...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

const normalizeRoleCodes = (user?: User | null) =>
  uniqueStringArray(Array.isArray(user?.roles) ? user.roles : []);

const normalizePermissionKeys = (user?: User | null) =>
  uniqueStringArray(Array.isArray(user?.permissions) ? user.permissions : []);

export const isSuperAdmin = (user?: User | null) => {
  if (!user) {
    return false;
  }

  return Boolean(user.is_super_admin) || normalizeRoleCodes(user).includes('super_admin');
};

export const hasPermission = (user: User | null | undefined, permissionKey: string) => {
  if (!permissionKey) {
    return false;
  }

  return normalizePermissionKeys(user).includes(permissionKey);
};

export const hasAnyPermission = (user: User | null | undefined, permissionKeys: string[]) => {
  if (!permissionKeys.length) {
    return false;
  }

  const permissionSet = new Set(normalizePermissionKeys(user));

  return permissionKeys.some((permissionKey) => permissionSet.has(permissionKey));
};

export const canAccessAdminArea = (user?: User | null) => {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user) || user.is_admin) {
    return true;
  }

  return hasAnyPermission(user, [
    'admin_dashboard.read',
    'admin_dashboard.edit',
    'admin_dashboard.approve',
    'admin_dashboard.manage',
  ]);
};

export const canManageAccessControl = (user?: User | null) => {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  return hasAnyPermission(user, ['access_control.manage']);
};

export const canAccessBudgetApproval = (user?: User | null) => {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  return hasAnyPermission(user, [
    'budget.admin.view',
    'budget.admin.manage',
    'budget.workflow.level1',
    'budget.workflow.ithead',
    'budget.workflow.dof',
    'budget.workflow.principal',
  ]);
};

const getWorkflowPermissionPrefix = (moduleKey: string) => {
  const normalizedModule = String(moduleKey || '')
    .trim()
    .toLowerCase();
  return normalizedModule ? `${normalizedModule}.workflow.` : '';
};

export const getWorkflowPermissionsForModule = (
  user: User | null | undefined,
  moduleKey: string,
) => {
  const workflowPrefix = getWorkflowPermissionPrefix(moduleKey);

  if (!workflowPrefix) {
    return [];
  }

  return normalizePermissionKeys(user).filter((permissionKey) =>
    permissionKey.startsWith(workflowPrefix),
  );
};

export const canAccessModuleWorkflow = (user: User | null | undefined, moduleKey: string) => {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  if (
    String(moduleKey || '')
      .trim()
      .toLowerCase() === 'expenditure' &&
    canAccessAdminArea(user)
  ) {
    return true;
  }

  return getWorkflowPermissionsForModule(user, moduleKey).length > 0;
};

export const canAccessFinanceWorkflow = (user?: User | null) =>
  canAccessModuleWorkflow(user, 'finance');

export type GuesthouseWorkflowStage = 'admin' | 'hod' | 'principal' | 'guesthouse_admin';

export const getGuesthouseWorkflowStage = (user?: User | null): GuesthouseWorkflowStage | null => {
  if (!user) return null;
  if (
    isSuperAdmin(user) ||
    hasAnyPermission(user, ['guesthouse.workflow.admin', 'guesthouse.manage'])
  ) {
    return 'admin';
  }
  const stages: GuesthouseWorkflowStage[] = ['hod', 'principal', 'guesthouse_admin'];
  const permissions = new Set(normalizePermissionKeys(user));
  return stages.find((stage) => permissions.has(`guesthouse.workflow.${stage}`)) || null;
};

export const canAccessGuesthouseWorkflow = (user?: User | null) => {
  if (!user) {
    return false;
  }

  return getGuesthouseWorkflowStage(user) !== null;
};

const isAdminOrWorkflowRole = (user?: User | null) => {
  if (!user) {
    return false;
  }

  if (isSuperAdmin(user) || user.is_admin) {
    return true;
  }

  const normalizedRoles = normalizeRoleCodes(user);
  const workflowRoles = [
    'admin',
    'hod',
    'coordinator',
    'dof',
    'principal',
    'chairman',
    'entity_approver',
  ];

  return normalizedRoles.some((role) => workflowRoles.includes(role.toLowerCase()));
};

export const canAccessExpenditureWorkflow = (user?: User | null) => {
  if (!user) {
    return false;
  }

  // Super admins and admin-area users should be able to open expenditure approvals.
  if (isSuperAdmin(user) || canAccessAdminArea(user)) {
    return true;
  }

  // Check for expenditure workflow permissions
  const hasWorkflowPermission = canAccessModuleWorkflow(user, 'expenditure');
  if (hasWorkflowPermission) {
    return true;
  }

  // Fallback: check for admin/workflow roles
  return isAdminOrWorkflowRole(user);
};
