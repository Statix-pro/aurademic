import express from 'express';

import formOptionsController from './formOptionsController.js';
import { adminAuthMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Apply admin authentication middleware
router.use(adminAuthMiddleware);

const canReadFormOptions = permissionMiddleware([
  'form_options.read',
  'form_options.edit',
  'form_options.manage',
]);

const canEditFormOptions = permissionMiddleware(['form_options.edit', 'form_options.manage']);

// Form options CRUD operations
router.get('/journals', canReadFormOptions, formOptionsController.getAllOptions);
router.post('/journals', canEditFormOptions, formOptionsController.addOption);
router.put('/journals/:id', canEditFormOptions, formOptionsController.updateOption);
router.delete('/journals/:id', canEditFormOptions, formOptionsController.deleteOption);

// Project Agency Options routes
router.get(
  '/project-options/agencies',
  canReadFormOptions,
  formOptionsController.getProjectAgencyOptions,
);
router.post(
  '/project-options/agencies',
  canEditFormOptions,
  formOptionsController.addProjectAgencyOption,
);
router.put(
  '/project-options/agencies/:id',
  canEditFormOptions,
  formOptionsController.updateProjectAgencyOption,
);
router.delete(
  '/project-options/agencies/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectAgencyOption,
);

// Project Scheme Options routes
router.get(
  '/project-options/schemes',
  canReadFormOptions,
  formOptionsController.getProjectSchemeOptions,
);
router.post(
  '/project-options/schemes',
  canEditFormOptions,
  formOptionsController.addProjectSchemeOption,
);
router.put(
  '/project-options/schemes/:id',
  canEditFormOptions,
  formOptionsController.updateProjectSchemeOption,
);
router.delete(
  '/project-options/schemes/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectSchemeOption,
);

// Project Agency Type Options routes
router.get(
  '/project-options/agency-types',
  canReadFormOptions,
  formOptionsController.getProjectAgencyTypeOptions,
);
router.post(
  '/project-options/agency-types',
  canEditFormOptions,
  formOptionsController.addProjectAgencyTypeOption,
);
router.put(
  '/project-options/agency-types/:id',
  canEditFormOptions,
  formOptionsController.updateProjectAgencyTypeOption,
);
router.delete(
  '/project-options/agency-types/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectAgencyTypeOption,
);

export default router;
