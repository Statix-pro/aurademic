import express from 'express';

import notificationController from './notificationController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Every route below acts on the caller's own notifications, resolved from the
 * verified JWT. There is no permission gate because there is nothing here that
 * one user could want to do to another user's inbox — the model scopes every
 * statement by `user_id`.
 */
router.use(authMiddleware);

// Inbox
router.get('/summary', notificationController.getSummary);
router.get('/', notificationController.list);
router.post('/mark-all-read', notificationController.markAllRead);

// Preferences — declared before /:id so "preferences" is not read as an id.
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

// Web push
router.get('/push/public-key', notificationController.getPushPublicKey);
router.post('/push/subscribe', notificationController.subscribePush);
router.delete('/push/subscribe', notificationController.unsubscribePush);

// Per-notification actions
router.patch('/:id/read', notificationController.markRead);
router.patch('/:id/archive', notificationController.archive);

export default router;
