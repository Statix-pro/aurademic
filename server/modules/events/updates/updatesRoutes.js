import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import * as updatesController from './updatesController.js';

const router = express.Router();

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
/**
 * Same allow-list and cap as `middleware/uploadMiddleware.js`.
 *
 * Without these, `multer({ storage })` accepts a file of any type and any size,
 * writes it to `uploads/` before the controller runs, and `server.js` serves
 * that directory statically with no gate — so an accepted upload is publicly
 * retrievable even when the request that carried it goes on to fail.
 */
const ALLOWED_UPLOAD_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB, matching uploadMiddleware.js
  },
});

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
