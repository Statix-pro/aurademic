import express from 'express';
// import rateLimit from 'express-rate-limit';
import accessControlController from './accessControlController.js';
import {
  authMiddleware,
  permissionMiddleware,
  superAdminMiddleware,
} from '../../middleware/authMiddleware.js';
import asyncHandler from '../../middleware/asyncHandler.js';

const router = express.Router();

router.use(authMiddleware);

const canReadAccessControl = permissionMiddleware(['access_control.read', 'access_control.manage']);
const canManageAccessControl = permissionMiddleware(['access_control.manage']);

// Rate limiter: 100 requests per 15 minutes
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: 'Too many requests from this IP, please try again after 15 minutes',
// });

// router.use(limiter);

router.get('/permissions', canReadAccessControl, asyncHandler(accessControlController.getPermissions));
router.post('/permissions', canManageAccessControl, asyncHandler(accessControlController.createPermission));
router.put('/permissions/:permissionId', canManageAccessControl, asyncHandler(accessControlController.updatePermission));
router.delete('/permissions/:permissionId', canManageAccessControl, asyncHandler(accessControlController.deletePermission));

router.get('/roles', canReadAccessControl, asyncHandler(accessControlController.getRoles));
router.post('/roles', canManageAccessControl, asyncHandler(accessControlController.createRole));
router.put('/roles/:roleId', canManageAccessControl, asyncHandler(accessControlController.updateRole));
router.delete('/roles/:roleId', canManageAccessControl, asyncHandler(accessControlController.deleteRole));
router.put('/roles/:roleId/permissions', canManageAccessControl, asyncHandler(accessControlController.updateRolePermissions));

router.get('/users', canReadAccessControl, asyncHandler(accessControlController.getUsers));
router.put('/users/:userId/roles', canManageAccessControl, asyncHandler(accessControlController.updateUserRoles));
router.put('/users/:userId/super-admin', superAdminMiddleware, asyncHandler(accessControlController.setUserSuperAdmin));

export default router;
