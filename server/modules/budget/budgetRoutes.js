import express from 'express';
import BudgetController from './budgetController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

const BUDGET_PERMISSIONS = Object.freeze({
  proposalManage: 'budget.proposal.manage',
  workflowHod: 'budget.workflow.hod',
  workflowDof: 'budget.workflow.dof',
  workflowPrincipal: 'budget.workflow.principal',
  adminView: 'budget.admin.view',
  adminManage: 'budget.admin.manage',
});

const canAccessAnyBudget = permissionMiddleware(Object.values(BUDGET_PERMISSIONS));
const canManageProposal = permissionMiddleware([BUDGET_PERMISSIONS.proposalManage]);
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

/* =====================================================
   GLOBAL AUTH
===================================================== */
router.use(authMiddleware);

/* =====================================================
   0. HEALTH CHECK
===================================================== */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'budget',
    version: 'v10.0',
    schema: 'master_entities_budget_v1',
    timestamp: new Date().toISOString(),
    user: req.user
      ? {
          id: req.user.id,
          permissions: req.user.permissions || [],
          roles: req.user.roles || [],
          department: req.user.department || null,
        }
      : null,
  });
});

/* =====================================================
   1. FORM SUPPORT & METADATA
===================================================== */
router.get('/faculty', canAccessAnyBudget, BudgetController.getFacultyDetails);
router.get('/approval-flows', canViewBudgetAdmin, BudgetController.getApprovalFlows);
router.get('/org-units', canAccessAnyBudget, BudgetController.getAllOrgUnits);
router.get('/org-units/:type', canAccessAnyBudget, BudgetController.getOrgUnits);

/* =====================================================
   1.1 ENTITY MASTER (RBAC)
===================================================== */
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

/* =====================================================
   2. DASHBOARDS
===================================================== */
router.get('/my', canManageProposal, BudgetController.getMyBudgets);
router.get('/hod', canAccessHodQueue, BudgetController.getHodBudgets);
router.get('/dof', canAccessDofQueue, BudgetController.getDofBudgets);
router.get('/principal', canAccessPrincipalQueue, BudgetController.getPrincipalBudgets);
router.get('/aggregates', canViewBudgetAdmin, BudgetController.getAggregates);
router.get('/stats', canViewBudgetAdmin, BudgetController.getStats);

/* =====================================================
   3. ADMIN & REPORTING
===================================================== */
router.get('/admin', canViewBudgetAdmin, BudgetController.adminList);
router.get('/export', canViewBudgetAdmin, BudgetController.export);
router.get('/search', canViewBudgetAdmin, BudgetController.search);

/* =====================================================
   4. ADMIN CONFIG MANAGEMENT
===================================================== */
router.patch('/admin/flow/:id(\\d+)', canManageBudgetAdmin, BudgetController.updateFlowConfig);

/* =====================================================
   5. CREATE & UPDATE OPERATIONS
===================================================== */
router.post('/', canManageProposal, BudgetController.create);
router.put('/:id(\\d+)', canManageProposal, BudgetController.update);

/* =====================================================
   6. PER-PROPOSAL OPERATIONS
===================================================== */
router.get('/:id(\\d+)/history', canAccessAnyBudget, BudgetController.getHistory);
router.get('/:id(\\d+)/allocations', canAccessAnyBudget, BudgetController.getMonthAllocations);
router.get('/:id(\\d+)/status', canAccessAnyBudget, BudgetController.getStatus);

router.patch('/:id(\\d+)/approval', canProcessWorkflow, BudgetController.approve);

router.delete('/:id(\\d+)', canManageProposal, BudgetController.deleteProposal);

router.post(
  '/:id(\\d+)/upload',
  canManageProposal,
  upload.fields([
    { name: 'sanctionLetter', maxCount: 1 },
    { name: 'attachments', maxCount: 5 },
  ]),
  BudgetController.uploadFiles
);

/* =====================================================
   7. GET SINGLE PROPOSAL (ALWAYS LAST)
===================================================== */
router.get('/:id(\\d+)', canAccessAnyBudget, BudgetController.get);

/* =====================================================
   ERROR HANDLER
===================================================== */
router.use((err, req, res, next) => {
  console.error('Budget routes error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export default router;
