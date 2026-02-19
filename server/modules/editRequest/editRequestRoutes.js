import express from 'express';
import editRequestController from './editRequestController.js';
import {
  authMiddleware,
  adminAuthMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

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
  asyncHandler(editRequestController.createEditRequest)
); // User requests edit access
router.get(
  '/edit-requests/:entityType/:entityId',
  asyncHandler(editRequestController.checkEditRequestStatus)
); // User checks edit request status
router.patch(
  '/edit-requests/:entityType/:entityId',
  asyncHandler(editRequestController.updateEditRequestStatus)
); // User sets status to 'none' after submission

// Admin routes - still under /admin prefix
router.patch(
  '/admin/edit-requests/:requestId/approve',
  adminAuthMiddleware,
  canApproveAdminWorkflow,
  asyncHandler(editRequestController.approveEditRequest)
); // Admin approves request
router.patch(
  '/admin/edit-requests/:requestId/reject',
  adminAuthMiddleware,
  canApproveAdminWorkflow,
  asyncHandler(editRequestController.rejectEditRequest)
); // Admin rejects request

export default router;
