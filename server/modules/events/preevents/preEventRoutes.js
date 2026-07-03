import express from 'express';

import {
  getPreEvents,
  getPreEventById,
  createPreEvent,
  updatePreEvent,
  deletePreEvent,
} from './preEventController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

// All pre-event endpoints require authentication.
router.use(authMiddleware);

// Pre-events APIs (normalized schema)
router.get('/', getPreEvents); // GET all pre-events
router.get('/:id', getPreEventById); // GET pre-event by ID
router.post('/', createPreEvent); // CREATE new pre-event
router.put('/:id', updatePreEvent); // UPDATE pre-event (and related arrays)
router.delete('/:id', deletePreEvent); // DELETE pre-event (cascade deletes related rows)

export default router;
