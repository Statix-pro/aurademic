// adminRoutes.js
import express from 'express';
import adminController from './adminController.js';
import { adminAuthMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management
 */

// Protect all admin routes with authentication middleware
router.use(adminAuthMiddleware);

// Dashboard routes
/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /admin/projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get('/projects', adminController.getAllProjects);

/**
 * @swagger
 * /admin/journals:
 *   get:
 *     summary: Get all journals
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journals
 */
router.get('/journals', adminController.getAllJournals);

/**
 * @swagger
 * /admin/projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project details
 */
router.get('/projects/:id', adminController.getProjectDetails);

/**
 * @swagger
 * /admin/journals/{id}:
 *   get:
 *     summary: Get journal details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journal details
 */
router.get('/journals/:id', adminController.getJournalDetails);

// Journal Request Management routes
/**
 * @swagger
 * /admin/journal-requests:
 *   get:
 *     summary: Get all journal requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal requests
 */
router.get('/journal-requests', adminController.getAllJournalRequests);

/**
 * @swagger
 * /admin/journal-requests/{id}/approve:
 *   patch:
 *     summary: Approve a journal request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journal request approved
 */
router.patch(
  '/journal-requests/:id/approve',
  adminController.approveJournalRequest
);

/**
 * @swagger
 * /admin/journal-requests/{id}/reject:
 *   patch:
 *     summary: Reject a journal request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journal request rejected
 */
router.patch(
  '/journal-requests/:id/reject',
  adminController.rejectJournalRequest
);

// Project Request Management routes
/**
 * @swagger
 * /admin/project-requests:
 *   get:
 *     summary: Get all project requests
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of project requests
 */
router.get('/project-requests', adminController.getAllProjectRequests);

/**
 * @swagger
 * /admin/project-requests/{id}/approve:
 *   patch:
 *     summary: Approve a project request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project request approved
 */
router.patch(
  '/project-requests/:id/approve',
  adminController.approveProjectRequest
);

/**
 * @swagger
 * /admin/project-requests/{id}/reject:
 *   patch:
 *     summary: Reject a project request
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project request rejected
 */
router.patch(
  '/project-requests/:id/reject',
  adminController.rejectProjectRequest
);

// Journal Status Update Management routes
/**
 * @swagger
 * /admin/journal-status-updates:
 *   get:
 *     summary: Get all journal status updates
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal status updates
 */
router.get(
  '/journal-status-updates',
  adminController.getAllJournalStatusUpdates
);

/**
 * @swagger
 * /admin/journals/{id}/status-updates:
 *   get:
 *     summary: Get status updates for a journal
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of status updates
 */
router.get(
  '/journals/:id/status-updates',
  adminController.getJournalStatusUpdates
);

/**
 * @swagger
 * /admin/journals/{id}/with-status-updates:
 *   get:
 *     summary: Get journal with status updates
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journal with status updates
 */
router.get(
  '/journals/:id/with-status-updates',
  adminController.getJournalWithStatusUpdates
);

/**
 * @swagger
 * /admin/status-updates/{statusUpdateId}/admin-reply:
 *   patch:
 *     summary: Reply to a status update
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: statusUpdateId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admin_reply:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reply updated
 */
router.patch(
  '/status-updates/:statusUpdateId/admin-reply',
  adminController.updateStatusUpdateAdminReply
);

export default router;
