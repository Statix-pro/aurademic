// modules/finance/financeRoutes.js

import express from 'express';
import financeController from './financeController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

/* =====================================================
   All Finance routes are PROTECTED
   (same pattern as journals)
====================================================== */
router.use(authMiddleware);

/* =====================================================
   Finance Request CRUD
====================================================== */

// Create finance request
router.post('/', financeController.createFinanceRequest);

// List finance requests (dashboard / approvals / my requests)
router.get('/', financeController.listFinanceRequests);

// Get current user's employee info (for auto-fill applicant data)
router.get('/me', financeController.getCurrentEmployeeInfo);

// Get full finance request (view / approval page)
router.get('/:id', financeController.getFinanceRequest);

// Update finance request (applicant only, pending state)
router.put('/:id', financeController.updateFinanceRequest);

/* =====================================================
   Budget Breakup
====================================================== */

// Add budget breakup rows
router.post('/:id/budget', financeController.addBudgetBreakup);

// Get budget breakup
router.get('/:id/budget', financeController.getBudgetBreakup);

/* =====================================================
   Status / Approval Workflow
====================================================== */

// Add approval / status update
router.post('/:id/status-updates', financeController.addStatusUpdate);

// Get approval history
router.get('/:id/status-updates', financeController.getStatusUpdates);

export default router;