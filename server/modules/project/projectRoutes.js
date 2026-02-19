import express from 'express';
import researchProjectController from './projectController.js';
import upload from '../../middleware/uploadMiddleware.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

router.use(authMiddleware);

// Add these new routes before the existing project routes
router.get(
  '/project-options/agencies/search',
  asyncHandler(researchProjectController.searchAgencies)
);
router.get(
  '/project-options/schemes/search',
  asyncHandler(researchProjectController.searchSchemes)
);
router.get(
  '/project-options/agency-types/search',
  asyncHandler(researchProjectController.searchAgencyTypes)
);

// Project Request routes
router.post(
  '/project-requests',
  asyncHandler(researchProjectController.createProjectRequest)
);
router.get(
  '/project-requests',
  asyncHandler(researchProjectController.getUserProjectRequests)
);
router.get(
  '/project-requests/:id',
  asyncHandler(researchProjectController.getProjectRequest)
);

// Research Project CRUD operations
router.post('/projects', asyncHandler(researchProjectController.createProject));
router.get('/projects/:id', asyncHandler(researchProjectController.getProjectDetails));
router.put('/projects/:id', asyncHandler(researchProjectController.updateProject));
router.delete('/projects/:id', asyncHandler(researchProjectController.deleteProject));

// Author operations
router.post('/projects/:id/authors', asyncHandler(researchProjectController.addAuthor));
router.get('/projects/:id/authors', asyncHandler(researchProjectController.getAuthors));
// Route to remove an author from a project
router.delete('/projects/:id/authors', asyncHandler(researchProjectController.removeAuthor));

// Financial contribution operations
router.post(
  '/projects/:id/contributions',
  asyncHandler(researchProjectController.addFinancialContribution)
);
router.get(
  '/projects/:id/contributions',
  asyncHandler(researchProjectController.getFinancialContributions)
);
router.delete(
  '/projects/:id/contributions/:contributionId',
  asyncHandler(researchProjectController.deleteFinancialContribution)
);

// Grant disbursement operations
router.post(
  '/projects/:id/grant-disbursements',
  asyncHandler(researchProjectController.addGrantDisbursement)
);
router.get(
  '/projects/:id/grant-disbursements',
  asyncHandler(researchProjectController.getGrantDisbursements)
);
router.put(
  '/projects/:id/grant-disbursements/:disbursementId',
  asyncHandler(researchProjectController.updateGrantDisbursement)
);
router.delete(
  '/projects/:id/grant-disbursements/:disbursementId',
  asyncHandler(researchProjectController.deleteGrantDisbursement)
);
// Project details operations
router.post(
  '/projects/:id/details',
  asyncHandler(researchProjectController.addProjectDetails)
);
router.get(
  '/projects/:id/details',
  asyncHandler(researchProjectController.getProjectDetails)
);

// Collaboration operations
router.post(
  '/projects/:id/collaborations',
  asyncHandler(researchProjectController.addCollaboration)
);
router.get(
  '/projects/:id/collaborations',
  asyncHandler(researchProjectController.getCollaborations)
);
router.put(
  '/projects/:id/collaborations/:collabId',
  asyncHandler(researchProjectController.updateCollaboration)
);
router.delete(
  '/projects/:id/collaborations/:collabId',
  asyncHandler(researchProjectController.deleteCollaboration)
);
// File upload
router.post(
  '/projects/:id/upload',
  upload.single('file'),
  asyncHandler(researchProjectController.uploadFile)
);
// Journal article upload route
router.post(
  '/projects/:id/upload-journal',
  upload.single('file'),
  asyncHandler(researchProjectController.uploadFile)
);

//  Grant Disbursement File Uploads
router.post(
  '/projects/:projectId/grant-disbursements/:disbursementId/upload-sanction',
  upload.single('file'),
  asyncHandler(researchProjectController.uploadDisbursementSanctionLetter)
);
router.post(
  '/projects/:projectId/grant-disbursements/:disbursementId/upload-ucsoe',
  upload.single('file'),
  asyncHandler(researchProjectController.uploadDisbursementUcAndSoe)
);
// router.post('/projects/:id/upload',
//     upload.single('file'),
//     multerErrorHandler,
//     researchProjectController.uploadFile
// );
export default router;
