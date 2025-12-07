import express from 'express';
import journalController from './journalController.js';
import upload from '../../middleware/uploadMiddleware.js';
import { authMiddleware } from '../../middleware/authMiddleware.js'; // Add this import

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Journal
 *   description: Journal management
 */

// Public routes
/**
 * @swagger
 * /journals/search:
 *   get:
 *     summary: Search journals
 *     tags: [Journal]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: List of journals
 */
router.get('/journals/search', journalController.searchJournals);

/**
 * @swagger
 * /authors/search:
 *   get:
 *     summary: Search authors
 *     tags: [Journal]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Author name
 *     responses:
 *       200:
 *         description: List of authors
 */
router.get('/authors/search', journalController.searchAuthor);

// Protected routes - require authentication
router.use(authMiddleware); // Add authentication middleware for all routes below

// Journal CRUD operations
/**
 * @swagger
 * /journals:
 *   post:
 *     summary: Create a new journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Journal created
 */
router.post('/journals', journalController.createJournal);

/**
 * @swagger
 * /journals/{id}:
 *   get:
 *     summary: Get a journal by ID
 *     tags: [Journal]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Journal details
 *   put:
 *     summary: Update a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Journal updated
 *   delete:
 *     summary: Delete a journal
 *     tags: [Journal]
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
router.get('/journals/:id', journalController.getJournal);
router.put('/journals/:id', journalController.updateJournal);
router.delete('/journals/:id', journalController.deleteJournal);

// Author operations
/**
 * @swagger
 * /journals/{id}/authors:
 *   post:
 *     summary: Add an author to a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Author added
 *   get:
 *     summary: Get authors of a journal
 *     tags: [Journal]
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
 *         description: List of authors
 */
router.post('/journals/:id/authors', journalController.addAuthor);
router.get('/journals/:id/authors', journalController.getAuthors);

/**
 * @swagger
 * /journals/{id}/authors/{dbAuthorId}:
 *   put:
 *     summary: Update an author of a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: dbAuthorId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Author updated
 */
router.put('/journals/:id/authors/:dbAuthorId', journalController.updateAuthor);


// Index operations
/**
 * @swagger
 * /journals/{id}/indexes:
 *   post:
 *     summary: Add an index to a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Index added
 *   get:
 *     summary: Get indexes of a journal
 *     tags: [Journal]
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
 *         description: List of indexes
 */
router.post('/journals/:id/indexes', journalController.addIndex);
router.get('/journals/:id/indexes', journalController.getIndexes);

// Status Update operations
/**
 * @swagger
 * /journals/{id}/status-updates:
 *   post:
 *     summary: Create a status update for a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Status update created
 *   get:
 *     summary: Get status updates for a journal
 *     tags: [Journal]
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
router.post(
  '/journals/:id/status-updates',
  journalController.createStatusUpdate
);
router.get('/journals/:id/status-updates', journalController.getStatusUpdates);

/**
 * @swagger
 * /status-updates/{statusUpdateId}/admin-reply:
 *   put:
 *     summary: Admin reply to status update
 *     tags: [Journal]
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
router.put(
  '/status-updates/:statusUpdateId/admin-reply',
  journalController.updateStatusUpdateAdminReply
);

//Uploads
/**
 * @swagger
 * /journals/{id}/upload:
 *   post:
 *     summary: Upload a file for a journal
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: File uploaded
 */
router.post(
  '/journals/:id/upload',
  upload.single('file'),
  journalController.uploadFile
);

// Journal Request routes
/**
 * @swagger
 * /journal-requests:
 *   post:
 *     summary: Create a journal request
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Journal request created
 *   get:
 *     summary: Get user journal requests
 *     tags: [Journal]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal requests
 */
router.post('/journal-requests', journalController.createJournalRequest);
router.get('/journal-requests', journalController.getUserJournalRequests);

/**
 * @swagger
 * /journal-requests/{id}:
 *   get:
 *     summary: Get a journal request by ID
 *     tags: [Journal]
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
 *         description: Journal request details
 */
router.get('/journal-requests/:id', journalController.getJournalRequest);

export default router;
