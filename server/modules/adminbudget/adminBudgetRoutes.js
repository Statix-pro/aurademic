import express from 'express';
import AdminBudgetController from './adminBudgetController.js';
import {
    authMiddleware,
    permissionMiddleware,
    superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

const BUDGET_PERMISSIONS = Object.freeze({
    workflowLevel1: 'budget.workflow.level1',
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

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Approval flows
router.get('/approval-flows', canViewBudgetAdmin, AdminBudgetController.getApprovalFlows);
router.patch('/admin/flow/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.updateFlowConfig);

// Organizations and contacts
router.get('/entities/:type', canManageBudgetAdmin, AdminBudgetController.getEntitiesByType);
router.post('/entities/:type', canManageBudgetAdmin, AdminBudgetController.createEntity);
router.put('/entities/:type/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.updateEntity);
router.delete('/entities/:type/:id(\\d+)', canManageBudgetAdmin, AdminBudgetController.deleteEntity);
router.get('/entities/:type/:id(\\d+)/contacts', canManageBudgetAdmin, AdminBudgetController.getEntityContacts);
router.put('/entities/:type/:id(\\d+)/contacts', canManageBudgetAdmin, AdminBudgetController.updateEntityContacts);

// Aggregates & Dashboard Stats
router.get('/aggregates', canViewBudgetAdmin, AdminBudgetController.getAggregates);
router.get('/stats', canViewBudgetAdmin, AdminBudgetController.getStats);
router.get('/admin', canViewBudgetAdmin, AdminBudgetController.adminList);
router.get('/superadmin/flow', superAdminMiddleware, AdminBudgetController.getSuperAdminFlowDashboard);

// Export and Search
router.get('/export', canViewBudgetAdmin, AdminBudgetController.export);
router.get('/search', canViewBudgetAdmin, AdminBudgetController.search);

export default router;
