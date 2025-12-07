import express from 'express';
import researchProjectController from './projectController.js';
import upload from '../../middleware/uploadMiddleware.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
const router = express.Router();
router.use(authMiddleware);
// Add these new routes before the existing project routes
router.get('/project-options/agencies/search', researchProjectController.searchAgencies);
router.get('/project-options/schemes/search', researchProjectController.searchSchemes);
router.get('/project-options/agency-types/search', researchProjectController.searchAgencyTypes);
// Project Request routes
router.post('/project-requests', researchProjectController.createProjectRequest);
router.get('/project-requests', researchProjectController.getUserProjectRequests);
router.get('/project-requests/:id', researchProjectController.getProjectRequest);
// Research Project CRUD operations
router.post('/projects', researchProjectController.createProject);
router.get('/projects/:id', researchProjectController.getProjectDetails);
router.put('/projects/:id', researchProjectController.updateProject);
router.delete('/projects/:id', researchProjectController.deleteProject);
// Author operations
router.post('/projects/:id/authors', researchProjectController.addAuthor);
router.get('/projects/:id/authors', researchProjectController.getAuthors);
// Route to remove an author from a project
router.delete('/projects/:id/authors', researchProjectController.removeAuthor);
// Financial contribution operations
router.post('/projects/:id/contributions', researchProjectController.addFinancialContribution);
router.get('/projects/:id/contributions', researchProjectController.getFinancialContributions);
router.delete('/projects/:id/contributions/:contributionId', researchProjectController.deleteFinancialContribution);
// Grant disbursement operations
router.post('/projects/:id/grant-disbursements', researchProjectController.addGrantDisbursement);
router.get('/projects/:id/grant-disbursements', researchProjectController.getGrantDisbursements);
router.put('/projects/:id/grant-disbursements/:disbursementId', researchProjectController.updateGrantDisbursement);
router.delete('/projects/:id/grant-disbursements/:disbursementId', researchProjectController.deleteGrantDisbursement);
// Project details operations
router.post('/projects/:id/details', researchProjectController.addProjectDetails);
router.get('/projects/:id/details', researchProjectController.getProjectDetails);
// Collaboration operations
router.post('/projects/:id/collaborations', researchProjectController.addCollaboration);
router.get('/projects/:id/collaborations', researchProjectController.getCollaborations);
router.put('/projects/:id/collaborations/:collabId', researchProjectController.updateCollaboration);
router.delete('/projects/:id/collaborations/:collabId', researchProjectController.deleteCollaboration);
// File upload
router.post('/projects/:id/upload', upload.single('file'), researchProjectController.uploadFile);
// Journal article upload route
router.post('/projects/:id/upload-journal', upload.single('file'), researchProjectController.uploadFile);
// router.post('/projects/:id/jousrnal-article/upload', upload.single('file'), );
//  Grant Disbursement File Uploads
router.post('/projects/:projectId/grant-disbursements/:disbursementId/upload-sanction', upload.single('file'), researchProjectController.uploadDisbursementSanctionLetter);
router.post('/projects/:projectId/grant-disbursements/:disbursementId/upload-ucsoe', upload.single('file'), researchProjectController.uploadDisbursementUcAndSoe);
// router.post('/projects/:id/upload',
//     upload.single('file'),
//     multerErrorHandler,
//     researchProjectController.uploadFile
// );
export default router;
