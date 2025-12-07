import express from 'express';
import userDashboardController from './userDashboardController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Debug middleware to log requests
// router.use((req, res, next) => {
//     console.log('Dashboard Request:', {
//         path: req.path,
//         method: req.method,
//         token: req.headers.authorization
//     });
//     next();
// });

/**
 * @swagger
 * tags:
 *   name: UserDashboard
 *   description: User dashboard operations
 */

// Protect all routes with authentication
router.use(authMiddleware);

// Get user dashboard stats and profile
/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [UserDashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/stats', userDashboardController.getDashboardStats);

/**
 * @swagger
 * /dashboard/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [UserDashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/profile', userDashboardController.getUserProfile);

// Journal routes
/**
 * @swagger
 * /dashboard/journals:
 *   get:
 *     summary: Get user journals
 *     tags: [UserDashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user journals
 */
router.get('/journals', userDashboardController.getUserJournals);

/**
 * @swagger
 * /dashboard/journals/{id}:
 *   get:
 *     summary: Get journal details
 *     tags: [UserDashboard]
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
 *   delete:
 *     summary: Delete a journal
 *     tags: [UserDashboard]
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
 *         description: Journal deleted
 */
router.get('/journals/:id', userDashboardController.getJournalDetails);
router.delete('/journals/:id', userDashboardController.deleteJournal);

// Project routes
/**
 * @swagger
 * /dashboard/projects:
 *   get:
 *     summary: Get user projects
 *     tags: [UserDashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user projects
 */
router.get('/projects', userDashboardController.getUserProjects);

/**
 * @swagger
 * /dashboard/projects/{id}:
 *   get:
 *     summary: Get project details
 *     tags: [UserDashboard]
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
router.get('/projects/:id', userDashboardController.getProjectDetails);

export default router;
