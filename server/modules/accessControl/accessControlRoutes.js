import express from 'express';
import rateLimit from 'express-rate-limit';
import accessControlController from './accessControlController.js';
import {
  authMiddleware,
  permissionMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const canReadAccessControl = permissionMiddleware([
  'access_control.read',
  'access_control.manage',
]);
const canManageAccessControl = permissionMiddleware(['access_control.manage']);

// Rate limiter: 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});

router.use(limiter);

router.get('/permissions', canReadAccessControl, accessControlController.getPermissions);
router.post('/permissions', canManageAccessControl, accessControlController.createPermission);
router.put(
  '/permissions/:permissionId',
  canManageAccessControl,
  accessControlController.updatePermission
);
router.delete(
  '/permissions/:permissionId',
  canManageAccessControl,
  accessControlController.deletePermission
);

router.get('/roles', canReadAccessControl, accessControlController.getRoles);
router.post('/roles', canManageAccessControl, accessControlController.createRole);
router.put('/roles/:roleId', canManageAccessControl, accessControlController.updateRole);
router.delete('/roles/:roleId', canManageAccessControl, accessControlController.deleteRole);
router.put(
  '/roles/:roleId/permissions',
  canManageAccessControl,
  accessControlController.updateRolePermissions
);

router.get('/users', canReadAccessControl, accessControlController.getUsers);
router.put('/users/:userId/roles', canManageAccessControl, accessControlController.updateUserRoles);
router.put(
  '/users/:userId/super-admin',
  superAdminMiddleware,
  accessControlController.setUserSuperAdmin
);

export default router;
