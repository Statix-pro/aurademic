/**
 * Shared Budget Controller Permissions & Auth Helpers
 *
 * Single source of truth for permission constants, role resolution,
 * and request-level auth helpers shared between budget and admin budget controllers.
 */

import { normalizeText } from './budgetUtils.js';

// =====================================================
// PERMISSION CONSTANTS
// =====================================================

export const BUDGET_PERMISSIONS = Object.freeze({
  proposalManage: 'budget.proposal.manage',
  workflowLevel1: 'budget.workflow.level1',
  workflowIthead: 'budget.workflow.ithead',
  workflowDof: 'budget.workflow.dof',
  workflowPrincipal: 'budget.workflow.principal',
  adminView: 'budget.admin.view',
  adminManage: 'budget.admin.manage',
});

export const WORKFLOW_STAGE_PERMISSION = Object.freeze({
  level1: BUDGET_PERMISSIONS.workflowLevel1,
  ithead: BUDGET_PERMISSIONS.workflowIthead,
  dof: BUDGET_PERMISSIONS.workflowDof,
  principal: BUDGET_PERMISSIONS.workflowPrincipal,
});

export const BUDGET_SCOPE_PERMISSIONS = Object.freeze([
  { permission: BUDGET_PERMISSIONS.adminManage, role: 'admin' },
  { permission: BUDGET_PERMISSIONS.adminView, role: 'admin' },
  { permission: BUDGET_PERMISSIONS.workflowPrincipal, role: 'principal' },
  { permission: BUDGET_PERMISSIONS.workflowDof, role: 'dof' },
  { permission: BUDGET_PERMISSIONS.workflowIthead, role: 'ithead' },
  { permission: BUDGET_PERMISSIONS.workflowLevel1, role: 'hod' },
  { permission: BUDGET_PERMISSIONS.proposalManage, role: 'user' },
]);

// =====================================================
// AUTH HELPERS
// =====================================================

export const getUserId = (req) => {
  return req.user?.id || req.user?.userId || null;
};

export const isSuperAdmin = (req) => {
  if (!req?.user) {
    return false;
  }

  if (req.user.is_super_admin || req.user.isSuperAdmin) {
    return true;
  }

  const roleTokens = Array.isArray(req.user.roles) ? req.user.roles : [];
  return roleTokens.some((role) => normalizeText(role).toLowerCase() === 'super_admin');
};

export const getPermissionSet = (req) => {
  const permissionTokens = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  return new Set(permissionTokens.map((token) => normalizeText(token)).filter(Boolean));
};

export const hasPermission = (req, permissionKey) => {
  if (!permissionKey) return false;
  if (isSuperAdmin(req)) return true;
  return getPermissionSet(req).has(permissionKey);
};

export const hasAnyPermission = (req, permissionKeys = []) => {
  if (isSuperAdmin(req)) return true;
  const permissionSet = getPermissionSet(req);
  return permissionKeys.some((permissionKey) => permissionSet.has(permissionKey));
};

export const resolveAccessRoleFromPermissions = (req) => {
  if (isSuperAdmin(req)) {
    return 'super_admin';
  }

  const permissionSet = getPermissionSet(req);

  for (const mapping of BUDGET_SCOPE_PERMISSIONS) {
    if (permissionSet.has(mapping.permission)) {
      return mapping.role;
    }
  }

  return 'user';
};

/**
 * Validates and returns an authorized role string based on user permissions.
 * Prevents privilege escalation by ensuring users only assume roles they are allowed to.
 *
 * @param {Object} req - Express request
 * @param {string} requestedRole - The role string requested (usually from query/body)
 * @returns {string} The authorized role code (e.g., 'admin', 'hod', 'super_admin')
 */
export const getAuthorizedRole = (req, requestedRole) => {
  const baseRole = resolveAccessRoleFromPermissions(req);
  const normalizedRequested = normalizeText(requestedRole)?.toLowerCase();

  // If no role is requested, use the base role resolved from permissions
  if (!normalizedRequested) {
    return baseRole;
  }

  // Super Admin is omnipotent
  if (baseRole === 'super_admin') {
    return normalizedRequested;
  }

  // Exact matches are always fine
  if (normalizedRequested === baseRole) {
    return baseRole;
  }

  /**
   * Capability Matrix: which roles can assume which viewing scopes.
   * Note: 'hod' and 'coordinator' are both 'workflowLevel1' internally but mapped
   * based on context. We allow level1 users to switch between them if they have
   * multiple assignments.
   */
  const capabilityMap = {
    admin: ['hod', 'coordinator', 'ithead', 'dof', 'principal', 'admin', 'user'],
    dof: ['dof', 'user'],
    principal: ['principal', 'user'],
    ithead: ['ithead', 'user'],
    hod: ['hod', 'coordinator', 'user'],
    coordinator: ['hod', 'coordinator', 'user'],
  };

  const allowedScopes = capabilityMap[baseRole] || ['user'];

  if (allowedScopes.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  // Fallback to their authorized base role if they attempt to escalate or assume an invalid scope
  return baseRole;
};
