import express from 'express';
import editRequestController from './editRequestController.js';
import {
  authMiddleware,
  adminAuthMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

const canApproveAdminWorkflow = permissionMiddleware([
  'admin_dashboard.approve',
  'admin_dashboard.manage',
]);

// Protected routes - require authentication
router.use(authMiddleware);

// Edit request operations
router.post(
  '/edit-requests/:entityType/:entityId',
  editRequestController.createEditRequest
); // User requests edit access
router.get(
  '/edit-requests/:entityType/:entityId',
  editRequestController.checkEditRequestStatus
); // User checks edit request status
router.patch(
  '/edit-requests/:entityType/:entityId',
  editRequestController.updateEditRequestStatus
); // User sets status to 'none' after submission

// Admin routes - still under /admin prefix
router.patch(
  '/admin/edit-requests/:requestId/approve',
  adminAuthMiddleware,
  canApproveAdminWorkflow,
  editRequestController.approveEditRequest
); // Admin approves request
router.patch(
  '/admin/edit-requests/:requestId/reject',
  adminAuthMiddleware,
  canApproveAdminWorkflow,
  editRequestController.rejectEditRequest
); // Admin rejects request

export default router;
