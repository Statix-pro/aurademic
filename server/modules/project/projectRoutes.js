import express from 'express';
import researchProjectController from './projectController.js';
import upload from '../../middleware/uploadMiddleware.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Project
 *   description: Project management
 */

router.use(authMiddleware);

// Add these new routes before the existing project routes
/**
 * @swagger
 * /project-options/agencies/search:
 *   get:
 *     summary: Search agencies
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of agencies
 */
router.get(
  '/project-options/agencies/search',
  researchProjectController.searchAgencies
);

/**
 * @swagger
 * /project-options/schemes/search:
 *   get:
 *     summary: Search schemes
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of schemes
 */
router.get(
  '/project-options/schemes/search',
  researchProjectController.searchSchemes
);

/**
 * @swagger
 * /project-options/agency-types/search:
 *   get:
 *     summary: Search agency types
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of agency types
 */
router.get(
  '/project-options/agency-types/search',
  researchProjectController.searchAgencyTypes
);

// Project Request routes
/**
 * @swagger
 * /project-requests:
 *   post:
 *     summary: Create a project request
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Project request created
 *   get:
 *     summary: Get user project requests
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of project requests
 */
router.post(
  '/project-requests',
  researchProjectController.createProjectRequest
);
router.get(
  '/project-requests',
  researchProjectController.getUserProjectRequests
);

/**
 * @swagger
 * /project-requests/{id}:
 *   get:
 *     summary: Get a project request by ID
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project request details
 */
router.get(
  '/project-requests/:id',
  researchProjectController.getProjectRequest
);

// Research Project CRUD operations
/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Project created
 */
router.post('/projects', researchProjectController.createProject);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get a project by ID
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project details
 *   put:
 *     summary: Update a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Project updated
 *   delete:
 *     summary: Delete a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Project deleted
 */
router.get('/projects/:id', researchProjectController.getProjectDetails);
router.put('/projects/:id', researchProjectController.updateProject);
router.delete('/projects/:id', researchProjectController.deleteProject);

// Author operations
/**
 * @swagger
 * /projects/{id}/authors:
 *   post:
 *     summary: Add an author to a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Author added
 *   get:
 *     summary: Get authors of a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of authors
 *   delete:
 *     summary: Remove an author from a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *                authorId:
 *                  type: integer
 *     responses:
 *       200:
 *         description: Author removed
 */
router.post('/projects/:id/authors', researchProjectController.addAuthor);
router.get('/projects/:id/authors', researchProjectController.getAuthors);
// Route to remove an author from a project
router.delete('/projects/:id/authors', researchProjectController.removeAuthor);

// Financial contribution operations
/**
 * @swagger
 * /projects/{id}/contributions:
 *   post:
 *     summary: Add a financial contribution to a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Contribution added
 *   get:
 *     summary: Get financial contributions of a project
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of contributions
 */
router.post(
  '/projects/:id/contributions',
  researchProjectController.addFinancialContribution
);
router.get(
  '/projects/:id/contributions',
  researchProjectController.getFinancialContributions
);

/**
 * @swagger
 * /projects/{id}/contributions/{contributionId}:
 *   delete:
 *     summary: Delete a financial contribution
 *     tags: [Project]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: contributionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contribution deleted
 */
router.delete(
  '/projects/:id/contributions/:contributionId',
  researchProjectController.deleteFinancialContribution
);

// Grant disbursement operations
router.post(
  '/projects/:id/grant-disbursements',
  researchProjectController.addGrantDisbursement
);
router.get(
  '/projects/:id/grant-disbursements',
  researchProjectController.getGrantDisbursements
);
router.put(
  '/projects/:id/grant-disbursements/:disbursementId',
  researchProjectController.updateGrantDisbursement
);
router.delete(
  '/projects/:id/grant-disbursements/:disbursementId',
  researchProjectController.deleteGrantDisbursement
);
// Project details operations
router.post(
  '/projects/:id/details',
  researchProjectController.addProjectDetails
);
router.get(
  '/projects/:id/details',
  researchProjectController.getProjectDetails
);

// Collaboration operations
router.post(
  '/projects/:id/collaborations',
  researchProjectController.addCollaboration
);
router.get(
  '/projects/:id/collaborations',
  researchProjectController.getCollaborations
);
router.put(
  '/projects/:id/collaborations/:collabId',
  researchProjectController.updateCollaboration
);
router.delete(
  '/projects/:id/collaborations/:collabId',
  researchProjectController.deleteCollaboration
);
// File upload
router.post(
  '/projects/:id/upload',
  upload.single('file'),
  researchProjectController.uploadFile
);
// Journal article upload route
router.post(
  '/projects/:id/upload-journal',
  upload.single('file'),
  researchProjectController.uploadFile
);
// router.post('/projects/:id/jousrnal-article/upload', upload.single('file'), );

//  Grant Disbursement File Uploads
router.post(
  '/projects/:projectId/grant-disbursements/:disbursementId/upload-sanction',
  upload.single('file'),
  researchProjectController.uploadDisbursementSanctionLetter
);
router.post(
  '/projects/:projectId/grant-disbursements/:disbursementId/upload-ucsoe',
  upload.single('file'),
  researchProjectController.uploadDisbursementUcAndSoe
);
// router.post('/projects/:id/upload',
//     upload.single('file'),
//     multerErrorHandler,
//     researchProjectController.uploadFile
// );
export default router;
