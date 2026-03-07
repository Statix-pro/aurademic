import express from 'express';
import BudgetController from './budgetController.js';
import {
  authMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

const BUDGET_PERMISSIONS = Object.freeze({
  workflowLevel1: 'budget.workflow.level1',
  workflowDof: 'budget.workflow.dof',
  workflowPrincipal: 'budget.workflow.principal',
  adminView: 'budget.admin.view',
  adminManage: 'budget.admin.manage',
});

const canAccessLevel1Queue = permissionMiddleware([BUDGET_PERMISSIONS.workflowLevel1]);
const canAccessDofQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowDof]);
const canAccessPrincipalQueue = permissionMiddleware([BUDGET_PERMISSIONS.workflowPrincipal]);
const canProcessWorkflow = permissionMiddleware([
  BUDGET_PERMISSIONS.workflowLevel1,
  BUDGET_PERMISSIONS.workflowDof,
  BUDGET_PERMISSIONS.workflowPrincipal,
  BUDGET_PERMISSIONS.adminView,
  BUDGET_PERMISSIONS.adminManage,
]);

router.use(authMiddleware);

router.get('/faculty', BudgetController.getFacultyDetails);
router.get('/search-applicant', BudgetController.searchApplicant);
router.get('/org-units', BudgetController.getAllOrgUnits);
router.get('/org-units/:type', BudgetController.getOrgUnits);

router.get('/my', BudgetController.getMyBudgets);
router.get('/hod', canAccessLevel1Queue, BudgetController.getHodBudgets);
router.get('/coordinator', canAccessLevel1Queue, BudgetController.getCoordinatorBudgets);
router.get('/dof', canAccessDofQueue, BudgetController.getDofBudgets);
router.get('/principal', canAccessPrincipalQueue, BudgetController.getPrincipalBudgets);

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
