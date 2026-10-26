import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import controller from './resourcepersonDirectoryController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import { sanitizeUploadFilename, deleteUploadedFile } from '../shared/uploadPaths.js';
const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'resource-persons');
fs.mkdirSync(uploadDir, { recursive: true });
const allowedExtensions = {
  photoFile: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']),
  resumeFile: new Set(['.pdf', '.doc', '.docx']),
};
const allowedMimeTypes = {
  photoFile: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  resumeFile: new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
};
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${sanitizeUploadFilename(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (
      allowedExtensions[file.fieldname]?.has(extension) &&
      allowedMimeTypes[file.fieldname]?.has(file.mimetype)
    ) {
      return cb(null, true);
    }
    const error = new Error(
      file.fieldname === 'photoFile'
        ? 'Photo must be a JPG, PNG, WEBP, or GIF image.'
        : 'Resume must be a PDF, DOC, or DOCX file.',
    );
    error.status = 400;
    return cb(error);
  },
});

const handleUpload = (middleware) => (req, res, next) =>
  middleware(req, res, (error) => {
    if (!error) return next();
    Object.values(req.files || {})
      .flat()
      .forEach((file) => deleteUploadedFile(file.path));
    if (error.status === 400 || error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: error.message || 'Upload rejected.' });
    }
    return next(error);
  });
router.use(authMiddleware);
const canReadDirectory = permissionMiddleware(['directory.read']);
const canCreateDirectory = permissionMiddleware(['directory.create']);
const canEditDirectory = permissionMiddleware(['directory.edit']);
router.get('/resource-persons', canReadDirectory, controller.list);
router.post(
  '/resource-persons',
  canCreateDirectory,
  handleUpload(
    upload.fields([
      { name: 'photoFile', maxCount: 1 },
      { name: 'resumeFile', maxCount: 1 },
    ]),
  ),
  controller.submit,
);
router.put(
  '/resource-persons/:id',
  canEditDirectory,
  handleUpload(
    upload.fields([
      { name: 'photoFile', maxCount: 1 },
      { name: 'resumeFile', maxCount: 1 },
    ]),
  ),
  controller.update,
);
// Not under /api/admin: see organizationDirectoryRoutes.js.
const canReviewResourcePersons = permissionMiddleware([
  'resource_person_directory.workflow.directory_admin',
]);
router.get('/resource-person-submissions', canReviewResourcePersons, controller.pending);
router.patch(
  '/resource-person-submissions/:id/review',
  canReviewResourcePersons,
  controller.review,
);
// Tag and Specialization lists: every directory user reads the active entries for the
// form; only the Directory Admin sees retired ones and changes the lists.
router.get('/resource-person-options', canReadDirectory, controller.listOptions);
router.get('/resource-person-options/all', canReviewResourcePersons, controller.listAllOptions);
router.post(
  '/resource-person-options/:list(tag|specialization)',
  canReviewResourcePersons,
  controller.addOption,
);
router.put('/resource-person-options/:id(\\d+)', canReviewResourcePersons, controller.updateOption);
router.delete(
  '/resource-person-options/:id(\\d+)',
  canReviewResourcePersons,
  controller.deleteOption,
);
export default router;
