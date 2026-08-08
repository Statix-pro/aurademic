import fs from 'fs';
import path from 'path';

import multer from 'multer';

const uploadDir = path.join(process.cwd(), 'uploads', 'temp');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types and their matching extensions. Both must agree so a spoofed
// Content-Type cannot smuggle an executable extension (e.g. .html/.svg) past the filter.
const allowedMimes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];
const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

// Strip any directory components and unsafe characters so a crafted originalname
// (e.g. "../../evil.html") cannot traverse out of the upload directory.
const sanitizeFilename = (originalname) => {
  const base = path.basename(String(originalname || ''));
  return base.replace(/[^a-zA-Z0-9_.-]/g, '_');
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Add timestamp to prevent filename collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + sanitizeFilename(file.originalname));
  },
});

// Add file filter — validate MIME type AND file extension. The client-supplied
// mimetype alone is spoofable, so the extension must also be on the allow-list.
const fileFilter = (req, file, cb) => {
  const extension = path.extname(String(file.originalname || '')).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.has(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'));
  }
};

// Initialize multer with the storage configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export default upload;
