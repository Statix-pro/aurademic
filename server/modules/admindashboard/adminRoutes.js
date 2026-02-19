// adminRoutes.js
import express from 'express';
import adminController from './adminController.js';
import {
  adminAuthMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

// Protect all admin routes with authentication middleware
router.use(adminAuthMiddleware);

const canReadAdminDashboard = permissionMiddleware([
  'admin_dashboard.read',
  'admin_dashboard.edit',
  'admin_dashboard.manage',
]);

const canApproveAdminWorkflow = permissionMiddleware([
  'admin_dashboard.approve',
  'admin_dashboard.manage',
]);

// Dashboard routes
router.get('/dashboard', canReadAdminDashboard, asyncHandler(adminController.getDashboard));
router.get('/projects', canReadAdminDashboard, asyncHandler(adminController.getAllProjects));
router.get('/journals', canReadAdminDashboard, asyncHandler(adminController.getAllJournals));
router.get('/projects/:id', canReadAdminDashboard, asyncHandler(adminController.getProjectDetails));
router.get('/journals/:id', canReadAdminDashboard, asyncHandler(adminController.getJournalDetails));
router.patch(
  '/journals/:id/submission-approval',
  canApproveAdminWorkflow,
  asyncHandler(adminController.updateJournalSubmissionApproval)
);

router.get('/budgets', asyncHandler(adminController.getAllBudgets));
router.get('/budget-stats', asyncHandler(adminController.getBudgetStats));


// Journal Request Management routes
router.get('/journal-requests', canReadAdminDashboard, asyncHandler(adminController.getAllJournalRequests));
router.patch(
  '/journal-requests/:id/approve',
  canApproveAdminWorkflow,
  asyncHandler(adminController.approveJournalRequest)
);
router.patch(
  '/journal-requests/:id/reject',
  canApproveAdminWorkflow,
  asyncHandler(adminController.rejectJournalRequest)
);

// Project Request Management routes
router.get('/project-requests', canReadAdminDashboard, asyncHandler(adminController.getAllProjectRequests));
router.patch(
  '/project-requests/:id/approve',
  canApproveAdminWorkflow,
  asyncHandler(adminController.approveProjectRequest)
);
router.patch(
  '/project-requests/:id/reject',
  canApproveAdminWorkflow,
  asyncHandler(adminController.rejectProjectRequest)
);

// Journal Status Update Management routes
router.get(
  '/journal-status-updates',
  canReadAdminDashboard,
  asyncHandler(adminController.getAllJournalStatusUpdates)
);
router.get(
  '/journals/:id/status-updates',
  canReadAdminDashboard,
  asyncHandler(adminController.getJournalStatusUpdates)
);
router.get(
  '/journals/:id/with-status-updates',
  canReadAdminDashboard,
  asyncHandler(adminController.getJournalWithStatusUpdates)
);
router.patch(
  '/status-updates/:statusUpdateId/admin-reply',
  canApproveAdminWorkflow,
  asyncHandler(adminController.updateStatusUpdateAdminReply)
);

export default router;
