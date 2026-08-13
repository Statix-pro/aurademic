import express from 'express';

import { participantAuthMiddleware } from '../../middleware/participantAuthMiddleware.js';

import participantAuthController from './participantAuthController.js';

const router = express.Router();

// Public: any Google account may sign in here.
router.post('/google', (req, res) => participantAuthController.googleLogin(req, res));

router.get('/me', participantAuthMiddleware, (req, res) => participantAuthController.me(req, res));

export default router;
