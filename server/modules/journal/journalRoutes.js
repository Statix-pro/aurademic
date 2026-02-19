import express from 'express';
import journalController from './journalController.js';
import upload from '../../middleware/uploadMiddleware.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

// Public routes
router.get('/journals/search', asyncHandler(journalController.searchJournals));
router.get('/authors/search', asyncHandler(journalController.searchAuthor));

// Protected routes - require authentication
router.use(authMiddleware);

// Journal CRUD operations
router.post('/journals', asyncHandler(journalController.createJournal));
router.get('/journals/:id', asyncHandler(journalController.getJournal));
router.put('/journals/:id', asyncHandler(journalController.updateJournal));
router.delete('/journals/:id', asyncHandler(journalController.deleteJournal));

// Author operations
router.post('/journals/:id/authors', asyncHandler(journalController.addAuthor));
router.put('/journals/:id/authors/:dbAuthorId', asyncHandler(journalController.updateAuthor));
router.get('/journals/:id/authors', asyncHandler(journalController.getAuthors));

// Index operations
router.post('/journals/:id/indexes', asyncHandler(journalController.addIndex));
router.get('/journals/:id/indexes', asyncHandler(journalController.getIndexes));

// Status Update operations
router.post(
  '/journals/:id/status-updates',
  asyncHandler(journalController.createStatusUpdate)
);
router.get('/journals/:id/status-updates', asyncHandler(journalController.getStatusUpdates));
router.put(
  '/status-updates/:statusUpdateId/admin-reply',
  asyncHandler(journalController.updateStatusUpdateAdminReply)
);

//Uploads
router.post(
  '/journals/:id/upload',
  upload.single('file'),
  asyncHandler(journalController.uploadFile)
);

// Journal Request routes
router.post('/journal-requests', asyncHandler(journalController.createJournalRequest));
router.get('/journal-requests', asyncHandler(journalController.getUserJournalRequests));
router.get('/journal-requests/:id', asyncHandler(journalController.getJournalRequest));

export default router;
