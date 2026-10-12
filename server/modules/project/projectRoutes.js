import express from 'express';
import multer from 'multer';

import projectController from './projectController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * The project form posts a `payload` JSON part plus one file part per document
 * slot, and the slot names are dynamic (a tranche's fields include its row
 * key), so the parts cannot be declared up front — `any()` accepts them and
 * `parseDocumentFieldName` validates each name.
 */
const acceptProjectUpload = upload.any();

/** Turns multer's own rejections (size, mime) into the API's error envelope. */
const handleUploadErrors = (req, res, next) =>
  acceptProjectUpload(req, res, (error) => {
    if (!error) return next();

    const isKnownUploadError =
      error instanceof multer.MulterError || /Invalid file type/i.test(error.message ?? '');

    if (isKnownUploadError) {
      return res.status(400).json({
        success: false,
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'One of the uploaded files is too large.'
            : error.message,
      });
    }

    return next(error);
  });

// ---------------------------------------------------------------------------
// Form lookups
// ---------------------------------------------------------------------------
router.get('/project-lookups', projectController.getFormLookups);
router.get('/project-options/organizations', projectController.searchOrganizations);
router.get('/project-options/schemes', projectController.listSchemes);
// Sign-in only, like every route in this file: faculty (role `user`) hold no
// `projects.*` permission, yet they are the ones filling in project forms, so a
// permission gate would take Fetch away from them. The repo owner approved this
// exception to AGENTS.md hard rule 1 on 2026-09-30. It returns only public
// publication metadata (title, venue, year) for the DOI asked about.
router.get('/project-options/doi', projectController.lookupDoi);

// ---------------------------------------------------------------------------
// Master-data add requests
// ---------------------------------------------------------------------------
router.post('/project-requests', projectController.createProjectRequest);
router.get('/project-requests', projectController.getUserProjectRequests);
router.get('/project-requests/:id', projectController.getProjectRequest);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
router.post('/projects', handleUploadErrors, projectController.createProject);
router.get('/projects/:id', projectController.getProject);
router.put('/projects/:id', handleUploadErrors, projectController.updateProject);
router.delete('/projects/:id', projectController.deleteProject);

export default router;
