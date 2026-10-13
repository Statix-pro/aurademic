import express from 'express';
import controller from './organizationDirectoryController.js';
import { authMiddleware, permissionMiddleware, superAdminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
const canReadDirectory = permissionMiddleware(['master_data.read', 'master_data.manage']);
const canCreateDirectory = permissionMiddleware(['master_data.create', 'master_data.manage']);
const canEditDirectory = permissionMiddleware(['master_data.edit', 'master_data.manage']);
router.get('/organizations', canReadDirectory, controller.list);
router.post('/organizations', canCreateDirectory, controller.submit);
router.put('/organizations/:id', canEditDirectory, controller.update);
router.get('/admin/organization-submissions', superAdminMiddleware, controller.pending);
router.patch('/admin/organization-submissions/:id/review', superAdminMiddleware, controller.review);

export default router;
