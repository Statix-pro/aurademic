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

export default router;
