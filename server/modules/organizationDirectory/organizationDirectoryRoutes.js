import express from 'express';

import controller from './organizationDirectoryController.js';
import {
  authMiddleware,
  permissionMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
const canReadDirectory = permissionMiddleware(['directory.read']);
const canCreateDirectory = permissionMiddleware(['directory.create']);
const canEditDirectory = permissionMiddleware(['directory.edit']);
router.get('/organizations', canReadDirectory, controller.list);
router.post('/organizations', canCreateDirectory, controller.submit);
router.put('/organizations/:id', canEditDirectory, controller.update);
router.get('/admin/organization-submissions', superAdminMiddleware, controller.pending);
router.patch('/admin/organization-submissions/:id/review', superAdminMiddleware, controller.review);

export default router;
