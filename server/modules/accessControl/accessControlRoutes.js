import express from 'express';

// import rateLimit from 'express-rate-limit';
import accessControlController from './accessControlController.js';
import {
  authMiddleware,
  permissionMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const canReadAccessControl = permissionMiddleware(['access_control.read', 'access_control.manage']);
const canManageAccessControl = permissionMiddleware(['access_control.manage']);
// What a role and a permission ARE is system configuration: anyone below Super Admin who could
// edit them could grant their own role any approval stage. `access_control.manage` assigns
// existing roles to people; only a Super Admin defines them.
const canDefineAccessControl = superAdminMiddleware;

// Rate limiter: 100 requests per 15 minutes
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again after 15 minutes',
// });

// router.use(limiter);

router.get('/permissions', canReadAccessControl, accessControlController.getPermissions);
router.post('/permissions', canDefineAccessControl, accessControlController.createPermission);
router.put(
  '/permissions/:permissionId',
  canDefineAccessControl,
  accessControlController.updatePermission,
);
router.delete(
  '/permissions/:permissionId',
  canDefineAccessControl,
  accessControlController.deletePermission,
);

router.get('/roles', canReadAccessControl, accessControlController.getRoles);
router.post('/roles', canDefineAccessControl, accessControlController.createRole);
router.put('/roles/:roleId', canDefineAccessControl, accessControlController.updateRole);
router.delete('/roles/:roleId', canDefineAccessControl, accessControlController.deleteRole);
router.put(
  '/roles/:roleId/permissions',
  canDefineAccessControl,
  accessControlController.updateRolePermissions,
);

router.get('/users', canReadAccessControl, accessControlController.getUsers);
router.put('/users/:userId/roles', canManageAccessControl, accessControlController.updateUserRoles);
router.put(
  '/users/:userId/super-admin',
  superAdminMiddleware,
  accessControlController.setUserSuperAdmin,
);

// manual sync endpoint
router.post('/sync-roles', canManageAccessControl, accessControlController.syncRoles);

export default router;
