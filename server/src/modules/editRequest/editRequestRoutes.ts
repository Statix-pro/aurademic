import express from 'express';
import editRequestController from './editRequestController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

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
  editRequestController.approveEditRequest
); // Admin approves request
router.patch(
  '/admin/edit-requests/:requestId/reject',
  editRequestController.rejectEditRequest
); // Admin rejects request

export default router;
