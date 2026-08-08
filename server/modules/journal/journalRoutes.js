import express from 'express';

import journalController from './journalController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

// Public routes
router.get('/journals/search', journalController.searchJournals);
router.get('/authors/search', journalController.searchAuthor);

// Protected routes - require authentication
router.use(authMiddleware); // Add authentication middleware for all routes below

// Journal CRUD operations
router.post('/journals', journalController.createJournal);
router.get('/journals/:id', journalController.getJournal);
router.put('/journals/:id', journalController.updateJournal);
router.delete('/journals/:id', journalController.deleteJournal);

// Author operations
router.post('/journals/:id/authors', journalController.addAuthor);
router.put('/journals/:id/authors/:dbAuthorId', journalController.updateAuthor);
router.get('/journals/:id/authors', journalController.getAuthors);

// Index operations
router.post('/journals/:id/indexes', journalController.addIndex);
router.get('/journals/:id/indexes', journalController.getIndexes);

// Status Update operations
router.post('/journals/:id/status-updates', journalController.createStatusUpdate);
router.get('/journals/:id/status-updates', journalController.getStatusUpdates);
router.put(
  '/status-updates/:statusUpdateId/admin-reply',
  // Posting an official admin reply must require admin-workflow permission,
  // matching the gated /api/admin equivalent (not just any authenticated user).
  permissionMiddleware(['admin_dashboard.approve', 'admin_dashboard.manage']),
  journalController.updateStatusUpdateAdminReply,
);

//Uploads
router.post('/journals/:id/upload', upload.single('file'), journalController.uploadFile);

// Journal Request routes
router.post('/journal-requests', journalController.createJournalRequest);
router.get('/journal-requests', journalController.getUserJournalRequests);
router.get('/journal-requests/:id', journalController.getJournalRequest);

export default router;
