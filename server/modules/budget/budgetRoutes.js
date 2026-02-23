import express from 'express';
import BudgetController from './budgetController.js';
import {
  authMiddleware,
  permissionMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

const BUDGET_PERMISSIONS = Object.freeze({
  workflowHod: 'budget.workflow.hod',
  workflowDof: 'budget.workflow.dof',
  workflowPrincipal: 'budget.workflow.principal',
  adminView: 'budget.admin.view',
  adminManage: 'budget.admin.manage',
});


const canAccessHodQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowHod]);
const canAccessDofQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowDof]);
const canAccessPrincipalQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowPrincipal]);
const canProcessWorkflow = permissionMiddleware([
  BUDGET_PERMISSIONS.workflowHod,
  BUDGET_PERMISSIONS.workflowDof,
  BUDGET_PERMISSIONS.workflowPrincipal,
]);
const canViewBudgetAdmin = permissionMiddleware([BUDGET_PERMISSIONS.adminView]);
const canManageBudgetAdmin = permissionMiddleware([BUDGET_PERMISSIONS.adminManage]);


router.use(authMiddleware);

router.get('/faculty', BudgetController.getFacultyDetails);
router.get('/search-applicant', BudgetController.searchApplicant);
router.get('/approval-flows', canViewBudgetAdmin, BudgetController.getApprovalFlows);
router.get('/org-units', BudgetController.getAllOrgUnits);
router.get('/org-units/:type', BudgetController.getOrgUnits);

router.get('/entities/:type', canManageBudgetAdmin, BudgetController.getEntitiesByType);
router.post('/entities/:type', canManageBudgetAdmin, BudgetController.createEntity);
router.put('/entities/:type/:id(\\d+)', canManageBudgetAdmin, BudgetController.updateEntity);
router.delete('/entities/:type/:id(\\d+)', canManageBudgetAdmin, BudgetController.deleteEntity);
router.get(
  '/entities/:type/:id(\\d+)/contacts',
  canManageBudgetAdmin,
  BudgetController.getEntityContacts
);
router.put(
  '/entities/:type/:id(\\d+)/contacts',
  canManageBudgetAdmin,
  BudgetController.updateEntityContacts
);

router.get('/my', BudgetController.getMyBudgets);
router.get('/hod', canAccessHodQueue, BudgetController.getHodBudgets);
router.get('/dof', canAccessDofQueue, BudgetController.getDofBudgets);
router.get('/principal', canAccessPrincipalQueue, BudgetController.getPrincipalBudgets);
router.get('/aggregates', canViewBudgetAdmin, BudgetController.getAggregates);
router.get('/stats', canViewBudgetAdmin, BudgetController.getStats);

router.get('/admin', canViewBudgetAdmin, BudgetController.adminList);
router.get('/superadmin/flow', superAdminMiddleware, BudgetController.getSuperAdminFlowDashboard);
router.get('/export', canViewBudgetAdmin, BudgetController.export);
router.get('/search', canViewBudgetAdmin, BudgetController.search);

router.patch('/admin/flow/:id(\\d+)', canManageBudgetAdmin, BudgetController.updateFlowConfig);
router.post('/', BudgetController.create);
router.put('/:id(\\d+)', BudgetController.update);

router.get('/:id(\\d+)/history', BudgetController.getHistory);
router.get('/:id(\\d+)/allocations', BudgetController.getMonthAllocations);
router.get('/:id(\\d+)/status', BudgetController.getStatus);

router.patch('/:id(\\d+)/approval', canProcessWorkflow, BudgetController.approve);

router.delete('/:id(\\d+)', BudgetController.deleteProposal);

router.post(
  '/:id(\\d+)/upload',
  upload.fields([
    { name: 'sanctionLetter', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  BudgetController.uploadFiles
);

router.get('/:id(\\d+)', BudgetController.get);


export default router;
