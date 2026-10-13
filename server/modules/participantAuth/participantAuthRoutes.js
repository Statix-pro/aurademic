import express from 'express';
import rateLimit from 'express-rate-limit';

import participantAuthController from './participantAuthController.js';
import { participantAuthMiddleware } from '../../middleware/participantAuthMiddleware.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authLimiter);

// Public: any Google account may sign in here.
router.post('/google', (req, res) => participantAuthController.googleLogin(req, res));

router.get('/me', participantAuthMiddleware, (req, res) => participantAuthController.me(req, res));

export default router;
