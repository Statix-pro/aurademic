import express from 'express';

import publicEventsController from './publicEventsController.js';

// Unauthenticated by design: this is what the public event site reads. Must be
// mounted BEFORE /api/events, whose router applies authMiddleware to everything.
const router = express.Router();

router.get('/', (req, res) => publicEventsController.listEvents(req, res));
router.get('/:id', (req, res) => publicEventsController.getEvent(req, res));

export default router;
