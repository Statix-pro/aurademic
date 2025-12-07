// adminRoutes.js
import express from 'express';
import adminController from './adminController.js';
import { adminAuthMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Protect all admin routes with authentication middleware
router.use(adminAuthMiddleware);

// Dashboard routes
router.get('/dashboard', adminController.getDashboard);
router.get('/projects', adminController.getAllProjects);
router.get('/journals', adminController.getAllJournals);
router.get('/projects/:id', adminController.getProjectDetails);
router.get('/journals/:id', adminController.getJournalDetails);

// Journal Request Management routes
router.get('/journal-requests', adminController.getAllJournalRequests);
router.patch(
  '/journal-requests/:id/approve',
  adminController.approveJournalRequest
);
router.patch(
  '/journal-requests/:id/reject',
  adminController.rejectJournalRequest
);

// Project Request Management routes
router.get('/project-requests', adminController.getAllProjectRequests);
router.patch(
  '/project-requests/:id/approve',
  adminController.approveProjectRequest
);
router.patch(
  '/project-requests/:id/reject',
  adminController.rejectProjectRequest
);

// Journal Status Update Management routes
router.get(
  '/journal-status-updates',
  adminController.getAllJournalStatusUpdates
);
router.get(
  '/journals/:id/status-updates',
  adminController.getJournalStatusUpdates
);
router.get(
  '/journals/:id/with-status-updates',
  adminController.getJournalWithStatusUpdates
);
router.patch(
  '/status-updates/:statusUpdateId/admin-reply',
  adminController.updateStatusUpdateAdminReply
);

export default router;
