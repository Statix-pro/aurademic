import { User } from '../../types';

const uniqueStringArray = (values = []) => [
  ...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

const normalizeRoleCodes = (user?: User | null) => {
  if (!user) return [];
  const rawRoles: string[] = [];
  if ((user as any).role) rawRoles.push(String((user as any).role));
  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) =>
      rawRoles.push(
        typeof r === 'object'
          ? (r as any).role_code || (r as any).name || (r as any).role
          : String(r),
      ),
    );
  }
  if (Array.isArray((user as any).user_roles)) {
    (user as any).user_roles.forEach((r: any) =>
      rawRoles.push(typeof r === 'object' ? r.role_code || r.name || r.role : String(r)),
    );
  }
  if ((user as any).is_hod || (user as any).isHod || Number((user as any).is_hod) === 1) {
    rawRoles.push('hod', 'head_of_department');
  }
  const designation = String(
    user.designation || (user as any).designation_name || '',
  ).toLowerCase();
  if (designation.includes('hod') || designation.includes('head')) {
    rawRoles.push('hod', 'head_of_department');
  }
  return uniqueStringArray(rawRoles as any);
};

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

/**
 * The client-side twin of the server's `adminAuthMiddleware`, which admits a
 * user on `isSuperAdmin || an is_admin_role role || users.is_admin`. All three
 * are already resolved into the `is_admin` the login payload carries, so that
 * one flag is the whole test.
 *
 * Deliberately narrower than `canAccessAdminArea`, which also admits a user
 * holding only an `admin_dashboard.*` permission. That user belongs in the
 * admin area — the navbar and `ProtectedRoute` are right to let them in — but
 * every route behind `adminAuthMiddleware` answers them 403, so a screen backed
 * by one has to ask this instead.
 */
export const isAdminActor = (user?: User | null) =>
  Boolean(user) && (isSuperAdmin(user) || Boolean(user.is_admin));

/**
 * The form-options master data — Project Options and Publication Management.
 *
 * Mirrors what `formOptionsRoutes.js` actually enforces: `adminAuthMiddleware`
 * on the router, then `permissionMiddleware(['form_options.read', 'edit',
 * 'manage'])`, which a super admin short-circuits. Both halves matter, so both
 * are checked here — gating the link on super-admin alone hid the screen from
 * the admins the API lets in, and gating it on `canAccessAdminArea` offered it
 * to a role granted `admin_dashboard.*` without being an admin role, who then
 * got a 403 from every request the screen makes. Roles carry `is_admin_role`
 * independently of their permissions, so that pairing is one role edit away.
 */
export const canManageFormOptions = (user?: User | null) => {
  if (!isAdminActor(user)) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  return hasAnyPermission(user, ['form_options.read', 'form_options.edit', 'form_options.manage']);
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

  if (isSuperAdmin(user) || canAccessAdminArea(user)) {
    return true;
  }

  const normalized = String(moduleKey || '')
    .trim()
    .toLowerCase();
  const key = normalized === 'events' ? 'event' : normalized;

  const hasPermission = getWorkflowPermissionsForModule(user, key).length > 0;
  if (hasPermission) {
    return true;
  }

  return isAdminOrWorkflowRole(user);
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

export const canAccessExpenditureWorkflow = (user?: User | null) =>
  canAccessModuleWorkflow(user, 'expenditure');

export const canAccessEventWorkflow = (user?: User | null) =>
  canAccessModuleWorkflow(user, 'event');
