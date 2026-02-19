import express from 'express';
import {
  getPreEvents,
  getPreEventById,
  createPreEvent,
  updatePreEvent,
  deletePreEvent,
} from './preEventController.js';
import asyncHandler from '../../../middleware/asyncHandler.js';

const router = express.Router();

// Pre-events APIs (normalized schema)
router.get('/', asyncHandler(getPreEvents)); // GET all pre-events
router.get('/:id', asyncHandler(getPreEventById)); // GET pre-event by ID
router.post('/', asyncHandler(createPreEvent)); // CREATE new pre-event
router.put('/:id', asyncHandler(updatePreEvent)); // UPDATE pre-event (and related arrays)
router.delete('/:id', asyncHandler(deletePreEvent)); // DELETE pre-event (cascade deletes related rows)

export default router;
