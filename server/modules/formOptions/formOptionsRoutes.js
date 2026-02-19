import express from 'express';
import formOptionsController from './formOptionsController.js';
import {
  adminAuthMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

// Apply admin authentication middleware
router.use(adminAuthMiddleware);

const canReadFormOptions = permissionMiddleware([
  'form_options.read',
  'form_options.edit',
  'form_options.manage',
]);

const canEditFormOptions = permissionMiddleware([
  'form_options.edit',
  'form_options.manage',
]);

// Form options CRUD operations
router.get('/journals', canReadFormOptions, asyncHandler(formOptionsController.getAllOptions));
router.post('/journals', canEditFormOptions, asyncHandler(formOptionsController.addOption));
router.put('/journals/:id', canEditFormOptions, asyncHandler(formOptionsController.updateOption));
router.delete(
  '/journals/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.deleteOption)
);

// Project Agency Options routes
router.get(
  '/project-options/agencies',
  canReadFormOptions,
  asyncHandler(formOptionsController.getProjectAgencyOptions)
);
router.post(
  '/project-options/agencies',
  canEditFormOptions,
  asyncHandler(formOptionsController.addProjectAgencyOption)
);
router.put(
  '/project-options/agencies/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.updateProjectAgencyOption)
);
router.delete(
  '/project-options/agencies/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.deleteProjectAgencyOption)
);

// Project Scheme Options routes
router.get(
  '/project-options/schemes',
  canReadFormOptions,
  asyncHandler(formOptionsController.getProjectSchemeOptions)
);
router.post(
  '/project-options/schemes',
  canEditFormOptions,
  asyncHandler(formOptionsController.addProjectSchemeOption)
);
router.put(
  '/project-options/schemes/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.updateProjectSchemeOption)
);
router.delete(
  '/project-options/schemes/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.deleteProjectSchemeOption)
);

// Project Agency Type Options routes
router.get(
  '/project-options/agency-types',
  canReadFormOptions,
  asyncHandler(formOptionsController.getProjectAgencyTypeOptions)
);
router.post(
  '/project-options/agency-types',
  canEditFormOptions,
  asyncHandler(formOptionsController.addProjectAgencyTypeOption)
);
router.put(
  '/project-options/agency-types/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.updateProjectAgencyTypeOption)
);
router.delete(
  '/project-options/agency-types/:id',
  canEditFormOptions,
  asyncHandler(formOptionsController.deleteProjectAgencyTypeOption)
);

export default router;
