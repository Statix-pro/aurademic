import logger from '../../config/logger.js';
import express from 'express';
import BudgetController from './budgetController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

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

router.get('/faculty', asyncHandler(BudgetController.getFacultyDetails));
router.get('/search-applicant', asyncHandler(BudgetController.searchApplicant));
router.get('/approval-flows', canViewBudgetAdmin, asyncHandler(BudgetController.getApprovalFlows));
router.get('/org-units', asyncHandler(BudgetController.getAllOrgUnits));
router.get('/org-units/:type', asyncHandler(BudgetController.getOrgUnits));

router.get('/entities/:type', canManageBudgetAdmin, asyncHandler(BudgetController.getEntitiesByType));
router.post('/entities/:type', canManageBudgetAdmin, asyncHandler(BudgetController.createEntity));
router.put('/entities/:type/:id(\\d+)', canManageBudgetAdmin, asyncHandler(BudgetController.updateEntity));
router.delete('/entities/:type/:id(\\d+)', canManageBudgetAdmin, asyncHandler(BudgetController.deleteEntity));
router.get(
  '/entities/:type/:id(\\d+)/contacts',
  canManageBudgetAdmin,
  asyncHandler(BudgetController.getEntityContacts)
);
router.put(
  '/entities/:type/:id(\\d+)/contacts',
  canManageBudgetAdmin,
  asyncHandler(BudgetController.updateEntityContacts)
);

router.get('/my', asyncHandler(BudgetController.getMyBudgets));
router.get('/hod', canAccessHodQueue, asyncHandler(BudgetController.getHodBudgets));
router.get('/dof', canAccessDofQueue, asyncHandler(BudgetController.getDofBudgets));
router.get('/principal', canAccessPrincipalQueue, asyncHandler(BudgetController.getPrincipalBudgets));
router.get('/aggregates', canViewBudgetAdmin, asyncHandler(BudgetController.getAggregates));
router.get('/stats', canViewBudgetAdmin, asyncHandler(BudgetController.getStats));

router.get('/admin', canViewBudgetAdmin, asyncHandler(BudgetController.adminList));
router.get('/export', canViewBudgetAdmin, asyncHandler(BudgetController.export));
router.get('/search', canViewBudgetAdmin, asyncHandler(BudgetController.search));

router.patch('/admin/flow/:id(\\d+)', canManageBudgetAdmin, asyncHandler(BudgetController.updateFlowConfig));
router.post('/', asyncHandler(BudgetController.create));
router.put('/:id(\\d+)', asyncHandler(BudgetController.update));

router.get('/:id(\\d+)/history', asyncHandler(BudgetController.getHistory));
router.get('/:id(\\d+)/allocations', asyncHandler(BudgetController.getMonthAllocations));
router.get('/:id(\\d+)/status', asyncHandler(BudgetController.getStatus));

router.patch('/:id(\\d+)/approval', canProcessWorkflow, asyncHandler(BudgetController.approve));

router.delete('/:id(\\d+)', asyncHandler(BudgetController.deleteProposal));

router.post(
  '/:id(\\d+)/upload',
  upload.fields([
    { name: 'sanctionLetter', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  asyncHandler(BudgetController.uploadFiles)
);

router.get('/:id(\\d+)', asyncHandler(BudgetController.get));


export default router;
