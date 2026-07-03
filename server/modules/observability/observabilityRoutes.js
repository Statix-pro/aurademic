import express from 'express';
import rateLimit from 'express-rate-limit';

import {
  ingestClientErrors,
  ingestWebVitals,
  getMetrics,
  getErrors,
  getWebVitals,
} from './observabilityController.js';
import { superAdminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Ingest endpoints are intentionally unauthenticated (errors on the login page
// must still be reportable) but are rate-limited and size-capped.
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many telemetry requests' },
});

router.post('/client-errors', ingestLimiter, express.json({ limit: '256kb' }), ingestClientErrors);
router.post('/web-vitals', ingestLimiter, express.json({ limit: '64kb' }), ingestWebVitals);

// Super-admin-only read endpoints.
router.get('/metrics', superAdminMiddleware, getMetrics);
router.get('/errors', superAdminMiddleware, getErrors);
router.get('/vitals', superAdminMiddleware, getWebVitals);

export default router;
