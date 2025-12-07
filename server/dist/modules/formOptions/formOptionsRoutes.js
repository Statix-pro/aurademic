import express from 'express';
import formOptionsController from './formOptionsController.js';
import { adminAuthMiddleware } from '../../middleware/authMiddleware.js';
const router = express.Router();
// Apply admin authentication middleware
router.use(adminAuthMiddleware);
// Form options CRUD operations
router.get('/journals', formOptionsController.getAllOptions);
router.post('/journals', formOptionsController.addOption);
router.put('/journals/:id', formOptionsController.updateOption);
router.delete('/journals/:id', formOptionsController.deleteOption);
// Project Agency Options routes
router.get('/project-options/agencies', formOptionsController.getProjectAgencyOptions);
router.post('/project-options/agencies', formOptionsController.addProjectAgencyOption);
router.put('/project-options/agencies/:id', formOptionsController.updateProjectAgencyOption);
router.delete('/project-options/agencies/:id', formOptionsController.deleteProjectAgencyOption);
// Project Scheme Options routes
router.get('/project-options/schemes', formOptionsController.getProjectSchemeOptions);
router.post('/project-options/schemes', formOptionsController.addProjectSchemeOption);
router.put('/project-options/schemes/:id', formOptionsController.updateProjectSchemeOption);
router.delete('/project-options/schemes/:id', formOptionsController.deleteProjectSchemeOption);
// Project Agency Type Options routes
router.get('/project-options/agency-types', formOptionsController.getProjectAgencyTypeOptions);
router.post('/project-options/agency-types', formOptionsController.addProjectAgencyTypeOption);
router.put('/project-options/agency-types/:id', formOptionsController.updateProjectAgencyTypeOption);
router.delete('/project-options/agency-types/:id', formOptionsController.deleteProjectAgencyTypeOption);
export default router;
