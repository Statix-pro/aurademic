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
