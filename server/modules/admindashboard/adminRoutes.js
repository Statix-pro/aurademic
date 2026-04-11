// adminRoutes.js
import express from 'express';
import adminController from './adminController.js';
import {
  adminAuthMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';

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
router.get('/dashboard', canReadAdminDashboard, adminController.getDashboard);
router.get('/projects', canReadAdminDashboard, adminController.getAllProjects);
router.get('/journals', canReadAdminDashboard, adminController.getAllJournals);
router.get('/projects/:id', canReadAdminDashboard, adminController.getProjectDetails);
router.get('/journals/:id', canReadAdminDashboard, adminController.getJournalDetails);
router.patch(
  '/journals/:id/submission-approval',
  canApproveAdminWorkflow,
  adminController.updateJournalSubmissionApproval
);

router.get('/budgets', adminController.getAllBudgets);
router.get('/budget-stats', adminController.getBudgetStats);


// Journal Request Management routes
router.get('/journal-requests', canReadAdminDashboard, adminController.getAllJournalRequests);
router.patch(
  '/journal-requests/:id/approve',
  canApproveAdminWorkflow,
  adminController.approveJournalRequest
);
router.patch(
  '/journal-requests/:id/reject',
  canApproveAdminWorkflow,
  adminController.rejectJournalRequest
);

// Project Request Management routes
router.get('/project-requests', canReadAdminDashboard, adminController.getAllProjectRequests);
router.patch(
  '/project-requests/:id/approve',
  canApproveAdminWorkflow,
  adminController.approveProjectRequest
);
router.patch(
  '/project-requests/:id/reject',
  canApproveAdminWorkflow,
  adminController.rejectProjectRequest
);

// Journal Status Update Management routes
router.get(
  '/journal-status-updates',
  canReadAdminDashboard,
  adminController.getAllJournalStatusUpdates
);
router.get(
  '/journals/:id/status-updates',
  canReadAdminDashboard,
  adminController.getJournalStatusUpdates
);
router.get(
  '/journals/:id/with-status-updates',
  canReadAdminDashboard,
  adminController.getJournalWithStatusUpdates
);
router.patch(
  '/status-updates/:statusUpdateId/admin-reply',
  canApproveAdminWorkflow,
  adminController.updateStatusUpdateAdminReply
);

export default router;
