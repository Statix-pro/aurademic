import express from 'express';
import {
  getEvents,
  getEventById,
  getEventSummary,
  createEvent,
  updateEvent,
  deleteEvent,
} from './eventController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';
import asyncHandler from '../../../middleware/asyncHandler.js';

const router = express.Router();

router.use(authMiddleware);

// Event APIs
router.get('/', asyncHandler(getEvents)); // GET all events
router.get('/:id', asyncHandler(getEventById)); // GET event by ID
router.get('/:id/summary', asyncHandler(getEventSummary)); // GET event summary for EventPage
router.post('/', asyncHandler(createEvent)); // CREATE new event
router.put('/:id', asyncHandler(updateEvent)); // UPDATE event
router.delete('/:id', asyncHandler(deleteEvent)); // DELETE event

export default router;
