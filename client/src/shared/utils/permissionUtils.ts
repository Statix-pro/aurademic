import { User } from '../../types';

const uniqueStringArray = (values = []) => [
  ...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
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

export const hasAnyPermission = (
  user: User | null | undefined,
  permissionKeys: string[]
) => {
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
