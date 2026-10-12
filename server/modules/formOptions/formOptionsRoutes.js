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

// Project organization routes (funding agencies, collaborating institutes)
router.get(
  '/project-options/organizations',
  canReadFormOptions,
  formOptionsController.getProjectOrganizations,
);
router.post(
  '/project-options/organizations',
  canEditFormOptions,
  formOptionsController.addProjectOrganization,
);
router.put(
  '/project-options/organizations/:id',
  canEditFormOptions,
  formOptionsController.updateProjectOrganization,
);
router.delete(
  '/project-options/organizations/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectOrganization,
);

// Project scheme routes
router.get('/project-options/schemes', canReadFormOptions, formOptionsController.getProjectSchemes);
router.post('/project-options/schemes', canEditFormOptions, formOptionsController.addProjectScheme);
router.put(
  '/project-options/schemes/:id',
  canEditFormOptions,
  formOptionsController.updateProjectScheme,
);
router.delete(
  '/project-options/schemes/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectScheme,
);

// Project budget head routes (the vocabulary the project form offers)
router.get(
  '/project-options/budget-heads',
  canReadFormOptions,
  formOptionsController.getProjectBudgetHeads,
);
router.post(
  '/project-options/budget-heads',
  canEditFormOptions,
  formOptionsController.addProjectBudgetHead,
);
router.put(
  '/project-options/budget-heads/:id',
  canEditFormOptions,
  formOptionsController.updateProjectBudgetHead,
);
router.delete(
  '/project-options/budget-heads/:id',
  canEditFormOptions,
  formOptionsController.deleteProjectBudgetHead,
);

export default router;
