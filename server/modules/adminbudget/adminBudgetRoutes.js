import express from 'express';
import * as AdminBudgetController from './adminBudgetController.js';
import {
    authMiddleware,
    permissionMiddleware,
    superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

const BUDGET_PERMISSIONS = Object.freeze({
    workflowLevel1: 'budget.workflow.level1',
    workflowIthead: 'budget.workflow.ithead',
    workflowDof: 'budget.workflow.dof',
    workflowPrincipal: 'budget.workflow.principal',
    adminView: 'budget.admin.view',
    adminManage: 'budget.admin.manage',
});

const canViewBudgetAdmin = permissionMiddleware([
    BUDGET_PERMISSIONS.adminView,
    BUDGET_PERMISSIONS.adminManage,
]);
const canManageBudgetAdmin = permissionMiddleware([BUDGET_PERMISSIONS.adminManage]);
const canManageFreeze = permissionMiddleware([
    BUDGET_PERMISSIONS.adminManage,
    BUDGET_PERMISSIONS.workflowDof,
]);
const canToggleArchive = permissionMiddleware([
    BUDGET_PERMISSIONS.workflowLevel1,
    BUDGET_PERMISSIONS.workflowIthead,
    BUDGET_PERMISSIONS.workflowDof,
    BUDGET_PERMISSIONS.workflowPrincipal,
    BUDGET_PERMISSIONS.adminView,
    BUDGET_PERMISSIONS.adminManage,
]);
const canAccessLevel1Queue = permissionMiddleware([BUDGET_PERMISSIONS.workflowLevel1]);
const canAccessItheadQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowIthead]);
const canAccessDofQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowDof]);
const canAccessPrincipalQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowPrincipal]);
const canProcessWorkflow = permissionMiddleware([
    BUDGET_PERMISSIONS.workflowLevel1,
    BUDGET_PERMISSIONS.workflowIthead,
    BUDGET_PERMISSIONS.workflowDof,
    BUDGET_PERMISSIONS.workflowPrincipal,
    BUDGET_PERMISSIONS.adminView,
    BUDGET_PERMISSIONS.adminManage,
]);

/**
 * Statistics and aggregation routes should be accessible to all roles 
 * participating in the budget workflow, as the controller handles 
 * the scoping within the request handler.
 */
const canViewAnyBudgetStats = permissionMiddleware([
    BUDGET_PERMISSIONS.adminView,
    BUDGET_PERMISSIONS.adminManage,
    BUDGET_PERMISSIONS.workflowPrincipal,
    BUDGET_PERMISSIONS.workflowDof,
    BUDGET_PERMISSIONS.workflowIthead,
    BUDGET_PERMISSIONS.workflowLevel1,
]);

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Approval flows
router.get('/approval-flows', canViewBudgetAdmin, AdminBudgetController.getApprovalFlows);
router.patch('/admin/flow/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.updateFlowConfig);
router.get('/freeze-config', canManageFreeze, AdminBudgetController.getFreezeConfig);
router.put('/freeze-config', canManageFreeze, AdminBudgetController.upsertFreezeConfig);

// Admin budget page workflow endpoints (moved from /budget/* usage)
router.get('/faculty', AdminBudgetController.getFacultyDetails);
router.get('/departments', AdminBudgetController.getAllDepartments);
router.get('/search-applicant', AdminBudgetController.searchApplicant);
router.get('/tags', AdminBudgetController.getBudgetTags);
router.get('/org-units', AdminBudgetController.getAllOrgUnits);
router.get('/org-units/:type', AdminBudgetController.getOrgUnits);
router.get('/batch', canViewAnyBudgetStats, AdminBudgetController.getBatch);
router.get('/consolidation', canViewAnyBudgetStats, AdminBudgetController.getConsolidation);
router.get('/annual-summary', canAccessDofQueue, AdminBudgetController.getAnnualSummary);
router.get('/hod', canAccessLevel1Queue, AdminBudgetController.getHodBudgets);
router.get('/coordinator', canAccessLevel1Queue, AdminBudgetController.getCoordinatorBudgets);
router.get('/ithead', canAccessItheadQueue, AdminBudgetController.getItheadBudgets);
router.get('/dof', canAccessDofQueue, AdminBudgetController.getDofBudgets);
router.get('/principal', canAccessPrincipalQueue, AdminBudgetController.getPrincipalBudgets);
router.get('/:id(\\d+)', AdminBudgetController.get);
router.put('/:id(\\d+)', canProcessWorkflow, AdminBudgetController.updateApprovedAmounts);
router.patch('/:id(\\d+)/approval', canProcessWorkflow, AdminBudgetController.approve);
router.patch('/:id(\\d+)/archive-toggle', canToggleArchive, AdminBudgetController.toggleArchive);
router.delete('/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.deleteProposal);

// Organizations and contacts
router.get('/entities/:type', canManageBudgetAdmin, AdminBudgetController.getEntitiesByType);
router.post('/entities/:type', canManageBudgetAdmin, AdminBudgetController.createEntity);
router.put('/entities/:type/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.updateEntity);
router.delete('/entities/:type/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.deleteEntity);
router.get('/entities/:type/:id(\\d+)/contacts', canManageBudgetAdmin, AdminBudgetController.getEntityContacts);
router.put('/entities/:type/:id(\\d+)/contacts', canManageBudgetAdmin, AdminBudgetController.updateEntityContacts);

// Aggregates & Dashboard Stats
router.get('/aggregates', canViewAnyBudgetStats, AdminBudgetController.getAggregates);
router.get('/stats', canViewAnyBudgetStats, AdminBudgetController.getStats);
router.get('/kpi-stats', canViewAnyBudgetStats, AdminBudgetController.getKpiStats);
router.get('/admin', canViewBudgetAdmin, AdminBudgetController.adminList);
router.get('/superadmin/flow', superAdminMiddleware, AdminBudgetController.getSuperAdminFlowDashboard);

// Export and Search
router.get('/export', canViewBudgetAdmin, AdminBudgetController.export);
router.get('/search', canViewBudgetAdmin, AdminBudgetController.search);

export default router;
