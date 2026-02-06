import express from 'express';
import accessControlController from './accessControlController.js';
import {
  authMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.use(superAdminMiddleware);

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
