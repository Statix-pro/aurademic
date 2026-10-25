import express from 'express';

import journalController from './journalController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * Writing an "admin reply" on someone's publication progress update is a
 * reviewer action, so it needs the same gate as the equivalent route on the
 * admin router (`PATCH /api/admin/status-updates/:id/admin-reply`). Without it
 * any authenticated user could post a reply that renders to the author as
 * coming from an administrator.
 */
const canReplyAsReviewer = permissionMiddleware([
  'admin_dashboard.approve',
  'admin_dashboard.manage',
]);

// Protected routes - require authentication
router.use(authMiddleware); // Add authentication middleware for all routes below

// The publication and project forms' pickers. They were public, which handed staff names and
// the journal list's metrics to anyone off the network; both forms only ever call them signed
// in, through authenticityUtility.
// Sign-in only, like the publisher routes below: faculty hold no `publications.*` permission
// yet they are the ones filling these forms, so a permission gate would take the pickers away
// from them. The repo owner approved this exception to AGENTS.md hard rule 1 on 2026-10-25.
// Both are read-only searches: journal names with their list metrics, and staff names.
router.get('/journals/search', journalController.searchJournals);
router.get('/authors/search', journalController.searchAuthor);

// Journal CRUD operations
router.post('/journals', journalController.createJournal);
router.get('/journals/:id', journalController.getJournal);
router.put('/journals/:id', journalController.updateJournal);
router.delete('/journals/:id', journalController.deleteJournal);

// Author operations
router.post('/journals/:id/authors', journalController.addAuthor);
router.put('/journals/:id/authors/:dbAuthorId', journalController.updateAuthor);
router.delete('/journals/:id/authors/:dbAuthorId', journalController.deleteAuthor);
router.get('/journals/:id/authors', journalController.getAuthors);

// Index operations
router.post('/journals/:id/indexes', journalController.addIndex);
router.put('/journals/:id/indexes', journalController.replaceIndexes);
router.get('/journals/:id/indexes', journalController.getIndexes);

// Status Update operations
router.post('/journals/:id/status-updates', journalController.createStatusUpdate);
router.get('/journals/:id/status-updates', journalController.getStatusUpdates);
// NOTE: no client calls this — the admin dashboard uses the `/api/admin`
// equivalent. It is kept and gated rather than deleted in case an external
// consumer relies on it; it is a candidate for removal once that is confirmed.
router.put(
  '/status-updates/:statusUpdateId/admin-reply',
  canReplyAsReviewer,
  journalController.updateStatusUpdateAdminReply,
);

//Uploads
router.post('/journals/:id/upload', upload.single('file'), journalController.uploadFile);

// Publisher master (Conference, Book and Book Chapter publishers).
// Sign-in only, like every publication-form route in this file: faculty (role `user`)
// hold no `publications.*` permission, yet they are the ones filing publications, so a
// permission gate would take the publisher picker away from them. The repo owner
// approved this exception to AGENTS.md hard rule 1 on 2026-10-21. Search returns names
// only; an add is a pending entry visible to its requester until an admin reviews it
// under /api/form-options/publishers, which is permission-gated.
router.get('/publishers', journalController.searchPublishers);
router.post('/publishers', journalController.requestPublisher);

// Reference data for the form. Login-only, like every other journal form route:
// anyone who may enter a publication needs the list, and there is no permission
// that all of them hold. Read-only, and only active department names.
router.get('/journal-departments', journalController.listDepartments);

// Journal Request routes
router.post('/journal-requests', journalController.createJournalRequest);
router.get('/journal-requests', journalController.getUserJournalRequests);
router.get('/journal-requests/:id', journalController.getJournalRequest);

export default router;
