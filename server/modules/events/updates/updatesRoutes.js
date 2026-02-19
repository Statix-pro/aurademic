import express from 'express';
import * as updatesController from './updatesController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import asyncHandler from '../../../middleware/asyncHandler.js';

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    const safe = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '');
    cb(null, `${stamp}_${safe}`);
  },
});
const upload = multer({ storage });

// Event updates
router.get('/events/:id', asyncHandler(updatesController.getEventDetails));
router.put('/events/:id/publicity', asyncHandler(updatesController.updatePublicity));

// Resource persons
router.post(
  '/events/:id/resource_persons',
  asyncHandler(updatesController.addResourcePerson)
);
router.put(
  '/events/:id/resource_persons/:pid',
  asyncHandler(updatesController.updateResourcePerson)
);
router.delete(
  '/events/:id/resource_persons/:pid',
  asyncHandler(updatesController.deleteResourcePerson)
);

// Letters
router.put('/events/:id/letters', asyncHandler(updatesController.upsertLetter));

// Uploads
router.post(
  '/events/:id/uploads',
  upload.single('file'),
  asyncHandler(updatesController.handleUpload)
);
router.delete('/uploads/:uid', asyncHandler(updatesController.deleteUpload));

export default router;
