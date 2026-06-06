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
const upload = multer({ storage });

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
