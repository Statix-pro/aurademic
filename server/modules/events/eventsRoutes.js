import express from 'express';

import eventsController from './eventsController.js';
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
router.get('/events/:id', eventsController.getEventById);
router.post('/events', eventsController.createEvent);
router.put('/events/:id', eventsController.updateEvent);
router.delete('/events/:id', eventsController.deleteEvent);

// ── Per-event sub-resources ────────────────────────────────
router.get('/events/:id/summary', eventsController.getEventSummary);
router.get('/events/:id/participants', eventsController.getParticipants);
router.put('/events/:id/participants/:pid', eventsController.updateParticipant);
router.post('/events/:id/feedback', eventsController.submitFeedback);
router.get('/events/:id/registration-settings', eventsController.getRegistrationSettings);
router.put('/events/:id/registration-settings', eventsController.saveRegistrationSettings);

export default router;
