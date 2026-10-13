import express from 'express';

import eventsController, { documentUpload, updateUpload } from './eventsController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// ── Public routes (no auth) ────────────────────────────────
router.get('/events/public', eventsController.listPublicEvents);
router.get('/events/public/:id', eventsController.getPublicEvent);

// All remaining event routes require a valid staff JWT
router.use(authMiddleware);

// ── Core CRUD ──────────────────────────────────────────────
router.get('/events', eventsController.listEvents);
router.get('/events/search-employee', eventsController.searchEmployee);
router.get('/events/workflow/meta', eventsController.getWorkflowMeta);
router.get('/events/queue/:stage', eventsController.getEventQueue);
router.get('/events/:id', eventsController.getEventById);
router.post('/events', eventsController.createEvent);
router.put('/events/:id', eventsController.updateEvent);
router.delete('/events/:id', eventsController.deleteEvent);

// ── Approval Workflow Engine Routes ────────────────────────
router.post('/events/:id/submit', eventsController.submitWorkflow);
router.patch('/events/:id/submit', eventsController.submitWorkflow);
router.post('/events/:id/approve', eventsController.approveWorkflow);
router.patch('/events/:id/approve', eventsController.approveWorkflow);
router.post('/events/:id/approval', eventsController.approveWorkflow);
router.patch('/events/:id/approval', eventsController.approveWorkflow);
router.post('/events/:id/reject', eventsController.rejectWorkflow);
router.patch('/events/:id/reject', eventsController.rejectWorkflow);
router.get('/events/:id/history', eventsController.getApprovalHistory);

// ── Per-event sub-resources ────────────────────────────────
router.get('/events/:id/summary', eventsController.getEventSummary);
router.get('/events/:id/participants', eventsController.getParticipants);
router.put('/events/:id/participants/:pid', eventsController.updateParticipant);
router.get('/events/:id/feedback', eventsController.getEventFeedback);
router.post('/events/:id/feedback', eventsController.submitFeedback);
router.get('/events/:id/registration-settings', eventsController.getRegistrationSettings);
router.put('/events/:id/registration-settings', eventsController.saveRegistrationSettings);
router.post('/events/:id/certificates/publish', eventsController.publishCertificates);

// ── Document Checklist Routes ─────────────────────────────
router.get('/documents/:eventId', eventsController.getDocuments);
router.put('/documents/:eventId/doc/:docname', eventsController.toggleDocument);
router.post(
  '/documents/:eventId/doc/:docname/upload',
  documentUpload.single('file'),
  eventsController.uploadDocument,
);
router.post('/documents/:eventId/edit-request', eventsController.requestEdit);
router.post('/documents/:eventId/submit', eventsController.submitForApproval);

// ── Event Updates & Publicity Routes ──────────────────────
router.post(
  '/updates/events/:id/uploads',
  updateUpload.single('file'),
  eventsController.uploadFile,
);
router.put('/updates/events/:id/publicity', eventsController.savePublicity);
router.post('/updates/events/:id/participants', eventsController.saveParticipants);
router.put('/updates/events/:id/letters', eventsController.saveLetters);
router.put('/updates/events/:id/mail-status', eventsController.updateMailStatus);
router.put('/updates/events/:id/documents', eventsController.saveDocuments);
router.post('/updates/events/:id/resource_persons', eventsController.addResourcePerson);
router.put('/updates/events/:id/resource_persons/:pid', eventsController.updateResourcePerson);
router.delete('/updates/events/:id/resource_persons/:pid', eventsController.deleteResourcePerson);

export default router;
