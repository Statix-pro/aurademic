import { Router } from 'express';

import { getTenantMetadata } from './tenantController.js';

const router = Router();

// Public endpoint — no auth middleware.
// Called by the React frontend on app initialization to load branding.
router.get('/metadata', getTenantMetadata);

export default router;
