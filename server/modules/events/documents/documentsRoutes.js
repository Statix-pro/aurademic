import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import {
  getDocumentsAndParticipants,
  updateDocument,
  upsertParticipant,
  deleteParticipant,
  uploadDocumentFile,
  getImportantLinks,
  updateImportantLinks,
  submitForApproval,
  requestEdit,
  deleteUpload,
} from './documentsController.js';

const router = express.Router();

// Setup multer for file uploads
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const safe = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    cb(null, `${stamp}_${safe}`);
  },
});
const upload = multer({ storage });

// Documents + Participants APIs
router.get('/:eventId', getDocumentsAndParticipants); // Get all docs & participants for event
router.put('/:eventId/doc/:docName', updateDocument); // Update doc toggle (fixed route)
router.post('/:eventId/participant', upsertParticipant); // Add/Update participant
router.delete('/participant/:participantId', deleteParticipant); // Delete participant (fixed param)

// File Upload APIs
router.post('/:eventId/doc/:docName/upload', upload.single('file'), uploadDocumentFile); // Upload document file

// Important Links APIs
router.get('/:eventId/links', getImportantLinks); // Get important links
router.put('/:eventId/links', updateImportantLinks); // Update important links

// Approval & Edit Request APIs
router.post('/:eventId/submit', submitForApproval); // Submit for approval
router.post('/:eventId/edit-request', requestEdit); // Request edit

// Upload Management
router.delete('/upload/:uploadId', deleteUpload); // Delete upload file

export default router;
