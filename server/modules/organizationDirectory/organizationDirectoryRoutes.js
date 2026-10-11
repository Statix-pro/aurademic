import express from 'express';
import controller from './organizationDirectoryController.js';
import { authMiddleware, superAdminMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/organizations', controller.list);
router.post('/organizations', controller.submit);
router.put('/organizations/:id', controller.update);
router.get('/admin/organization-submissions', superAdminMiddleware, controller.pending);
router.patch('/admin/organization-submissions/:id/review', superAdminMiddleware, controller.review);

export default router;
