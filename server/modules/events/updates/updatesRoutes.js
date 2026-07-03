import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import * as updatesController from './updatesController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const safe = path
      .basename(String(file.originalname || ''))
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '');
    cb(null, `${stamp}_${safe}`);
  },
});

// Reject executable/scriptable file types (html/svg/etc.); allow only documents and images.
const allowedExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
]);
const fileFilter = (req, file, cb) => {
  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  if (allowedExtensions.has(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type.'));
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// All update endpoints require authentication.
router.use(authMiddleware);

// Event updates
router.get('/events/:id', updatesController.getEventDetails);
router.put('/events/:id/publicity', updatesController.updatePublicity);

// Resource persons
router.post('/events/:id/resource_persons', updatesController.addResourcePerson);
router.put('/events/:id/resource_persons/:pid', updatesController.updateResourcePerson);
router.delete('/events/:id/resource_persons/:pid', updatesController.deleteResourcePerson);

// Letters
router.put('/events/:id/letters', updatesController.upsertLetter);

// Uploads
router.post('/events/:id/uploads', upload.single('file'), updatesController.handleUpload);
router.delete('/uploads/:uid', updatesController.deleteUpload);

export default router;
