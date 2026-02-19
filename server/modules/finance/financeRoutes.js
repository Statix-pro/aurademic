// modules/finance/financeRoutes.js

import express from 'express';
import financeController from './financeController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

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
router.post('/', asyncHandler(financeController.createFinanceRequest));

// List finance requests (dashboard / approvals / my requests)
router.get('/', asyncHandler(financeController.listFinanceRequests));

// Search applicant (for searchable dropdown)
router.get('/search-applicant', asyncHandler(financeController.searchApplicant));

// Get current user's employee info (for auto-fill applicant data)
router.get('/me', asyncHandler(financeController.getCurrentEmployeeInfo));

// Get full finance request (view / approval page)
router.get('/:id', asyncHandler(financeController.getFinanceRequest));

// Update finance request (applicant only, pending state)
router.put('/:id', asyncHandler(financeController.updateFinanceRequest));

/* =====================================================
   Budget Breakup
====================================================== */

// Add budget breakup rows
router.post('/:id/budget', asyncHandler(financeController.addBudgetBreakup));

// Get budget breakup
router.get('/:id/budget', asyncHandler(financeController.getBudgetBreakup));

/* =====================================================
   Status / Approval Workflow
====================================================== */

// Add approval / status update
router.post('/:id/status-updates', asyncHandler(financeController.addStatusUpdate));

// Get approval history
router.get('/:id/status-updates', asyncHandler(financeController.getStatusUpdates));

export default router;