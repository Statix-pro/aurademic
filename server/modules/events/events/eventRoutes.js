import express from 'express';

import {
  getEvents,
  getEventById,
  getEventSummary,
  getEventParticipants,
  createEvent,
  updateEvent,
  deleteEvent,
} from './eventController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Event APIs
router.get('/', getEvents); // GET all events
router.get('/:id', getEventById); // GET event by ID
router.get('/:id/summary', getEventSummary); // GET event summary for EventPage
router.get('/:id/participants', getEventParticipants); // GET public-site registrations for staff
router.post('/', createEvent); // CREATE new event
router.put('/:id', updateEvent); // UPDATE event
router.delete('/:id', deleteEvent); // DELETE event

export default router;
