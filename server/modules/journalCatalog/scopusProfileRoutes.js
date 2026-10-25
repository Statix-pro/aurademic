import express from 'express';

import scopusProfileController from './scopusProfileController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Sign-in only: the staff member confirming their own Scopus profile is faculty, who hold no
// permission key, so a permission gate would take the screen away from the people it is for.
// The repo owner approved this exception to AGENTS.md hard rule 1 on 2026-10-25. Every call
// acts on the caller's own staff record, found from their own login — never an id from the
// request — and only a profile suggested for them that nobody holds can be claimed.
router.use(authMiddleware);

router.get('/', scopusProfileController.getProfiles);
router.post('/claims', scopusProfileController.claimProfile);

export default router;
