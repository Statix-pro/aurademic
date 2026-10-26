import express from 'express';

import controller from './organizationDirectoryController.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
const canReadDirectory = permissionMiddleware(['directory.read']);
const canCreateDirectory = permissionMiddleware(['directory.create']);
const canEditDirectory = permissionMiddleware(['directory.edit']);
router.get('/organizations', canReadDirectory, controller.list);
router.post('/organizations', canCreateDirectory, controller.submit);
router.put('/organizations/:id', canEditDirectory, controller.update);
// Not under /api/admin: adminRoutes guards that whole prefix with adminAuthMiddleware,
// which would turn away a Directory Admin, a deliberately non-admin role. Super admins
// pass permissionMiddleware on their own.
const canReviewOrganizations = permissionMiddleware([
  'organization_directory.workflow.directory_admin',
]);
router.get('/organization-submissions', canReviewOrganizations, controller.pending);
router.put('/organization-submissions/:id', canReviewOrganizations, controller.updateSubmission);
router.patch('/organization-submissions/:id/review', canReviewOrganizations, controller.review);
// Tag and Specialization lists: every directory user reads the active entries for the
// form; only the Directory Admin sees retired ones and changes the lists.
router.get('/organization-options', canReadDirectory, controller.listOptions);
router.get('/organization-options/all', canReviewOrganizations, controller.listAllOptions);
router.post(
  '/organization-options/:list(tag|specialization)',
  canReviewOrganizations,
  controller.addOption,
);
router.put('/organization-options/:id(\\d+)', canReviewOrganizations, controller.updateOption);
router.delete('/organization-options/:id(\\d+)', canReviewOrganizations, controller.deleteOption);

export default router;
