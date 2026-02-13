import express from 'express';
import rateLimit from 'express-rate-limit';
import accessControlController from './accessControlController.js';
import {
  authMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(superAdminMiddleware);

// Rate limiter: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

router.use(limiter);

router.get('/permissions', accessControlController.getPermissions);
router.post('/permissions', accessControlController.createPermission);
router.put('/permissions/:permissionId', accessControlController.updatePermission);
router.delete('/permissions/:permissionId', accessControlController.deletePermission);

router.get('/roles', accessControlController.getRoles);
router.post('/roles', accessControlController.createRole);
router.put('/roles/:roleId', accessControlController.updateRole);
router.delete('/roles/:roleId', accessControlController.deleteRole);
router.put(
  '/roles/:roleId/permissions',
  accessControlController.updateRolePermissions
);

router.get('/users', accessControlController.getUsers);
router.put('/users/:userId/roles', accessControlController.updateUserRoles);
router.put('/users/:userId/super-admin', accessControlController.setUserSuperAdmin);

export default router;
