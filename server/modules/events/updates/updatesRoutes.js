import express from 'express';

import updatesController, { updateUpload } from './updatesController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// ── File upload (publicity attachments) ───────────────────
router.post(
  '/updates/events/:id/uploads',
  updateUpload.single('file'),
  updatesController.uploadFile,
);

// ── Publicity ─────────────────────────────────────────────
router.put('/updates/events/:id/publicity', updatesController.savePublicity);

// ── Participants update ───────────────────────────────────
router.post('/updates/events/:id/participants', updatesController.saveParticipants);

// ── Letters ───────────────────────────────────────────────
router.put('/updates/events/:id/letters', updatesController.saveLetters);

// ── Documents checklist ───────────────────────────────────
router.put('/updates/events/:id/documents', updatesController.saveDocuments);

// ── Resource Persons ──────────────────────────────────────
router.post('/updates/events/:id/resource_persons', updatesController.addResourcePerson);
router.put('/updates/events/:id/resource_persons/:pid', updatesController.updateResourcePerson);
router.delete('/updates/events/:id/resource_persons/:pid', updatesController.deleteResourcePerson);

export default router;
