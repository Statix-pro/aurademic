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

// Protect all routes with authentication
router.use(authMiddleware);

// Get user dashboard stats and profile
router.get('/stats', userDashboardController.getDashboardStats);
router.get('/profile', userDashboardController.getUserProfile);

router.get('/budgets', userDashboardController.getUserBudgets);

// Journal routes
router.get('/journals', userDashboardController.getUserJournals);
router.get('/journals/:id', userDashboardController.getJournalDetails);
router.delete('/journals/:id', userDashboardController.deleteJournal);

// Project routes
router.get('/projects', userDashboardController.getUserProjects);
router.get('/projects/:id', userDashboardController.getProjectDetails);

export default router;
