import express from 'express';
import userDashboardController from './userDashboardController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

// Protect all routes with authentication
router.use(authMiddleware);

// Get user dashboard stats and profile
router.get('/stats', asyncHandler(userDashboardController.getDashboardStats));
router.get('/profile', asyncHandler(userDashboardController.getUserProfile));

router.get('/budgets', asyncHandler(userDashboardController.getUserBudgets));

// Journal routes
router.get('/journals', asyncHandler(userDashboardController.getUserJournals));
router.get('/journals/:id', asyncHandler(userDashboardController.getJournalDetails));
router.delete('/journals/:id', asyncHandler(userDashboardController.deleteJournal));

// Project routes
router.get('/projects', asyncHandler(userDashboardController.getUserProjects));
router.get('/projects/:id', asyncHandler(userDashboardController.getProjectDetails));

export default router;
