import express from 'express';
import financeController from './financeController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

const FINANCE_WORKFLOW_PERMISSIONS = [
  'finance.workflow.*',
];

const canAccessFinanceWorkflow = permissionMiddleware(FINANCE_WORKFLOW_PERMISSIONS);

router.use(authMiddleware);

// Core request APIs
router.post('/', financeController.createFinanceRequest);
router.get('/', financeController.listFinanceRequests);
router.get('/search-applicant', financeController.searchApplicant);
router.get('/me', financeController.getCurrentEmployeeInfo);

// Workflow metadata + queues
router.get('/workflow/meta', canAccessFinanceWorkflow, financeController.getWorkflowMeta);
router.get('/queue/:stage', canAccessFinanceWorkflow, financeController.getFinanceQueue);

// Workflow actions
router.patch('/:id/approval', canAccessFinanceWorkflow, financeController.approveFinanceWorkflow);
router.post('/:id/resubmit', financeController.resubmitFinanceRequest);

// Timeline / compatibility endpoint
router.get('/:id/timeline', financeController.getFinanceTimeline);
router.get('/:id/status-updates', financeController.getStatusUpdates);

// Budget breakup
router.post('/:id/budget', financeController.addBudgetBreakup);
router.get('/:id/budget', financeController.getBudgetBreakup);

// Request CRUD
router.get('/:id', financeController.getFinanceRequest);
router.put('/:id', financeController.updateFinanceRequest);

export default router;
