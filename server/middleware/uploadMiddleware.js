import fs from 'fs';
import path from 'path';

import multer from 'multer';

import { tenantStorage } from '../config/connection.js';

/**
 * Resolves the upload directory for the current tenant.
 * In a multi-tenant context, files are stored under uploads/{tenant-slug}/temp/.
 * Falls back to uploads/temp/ when no tenant context is active (scripts, tests).
 */
const resolveUploadDir = () => {
  const store = tenantStorage.getStore();
  const tenantSlug = store?.dbName;

  const uploadDir = tenantSlug
    ? path.join(process.cwd(), 'uploads', tenantSlug, 'temp')
    : path.join(process.cwd(), 'uploads', 'temp');

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return uploadDir;
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resolveUploadDir());
  },
  filename: (req, file, cb) => {
    // Add timestamp to prevent filename collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

// Add file filter
const fileFilter = (req, file, cb) => {
  // Add allowed mime types
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];

  if (allowedMimes.includes(file.mimetype)) {
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
