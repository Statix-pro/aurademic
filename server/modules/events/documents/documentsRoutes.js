import express from 'express';

import documentsController, { documentUpload } from './documentsController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// ── Document checklist ─────────────────────────────────────
router.get('/documents/:eventId', documentsController.getDocuments);
router.put('/documents/:eventId/doc/:docname', documentsController.toggleDocument);
router.post(
  '/documents/:eventId/doc/:docname/upload',
  documentUpload.single('file'),
  documentsController.uploadDocument,
);
router.post('/documents/:eventId/edit-request', documentsController.requestEdit);
router.post('/documents/:eventId/submit', documentsController.submitForApproval);

export default router;
