import express from 'express';
import rateLimit from 'express-rate-limit';

import guesthouseController from './guesthouseController.js';
import guesthouseModel from './guesthouseModel.js';
import {
  authMiddleware,
  authorizationSnapshotMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

// Guest House endpoints perform database lookups and some accept uploads or
// bulk resource changes. Apply a shared per-IP budget to every route.
const guesthouseRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many Guest House requests. Please try again later.',
  },
});

const GUESTHOUSE_WORKFLOW_PERMISSIONS = ['guesthouse.workflow.*'];
const GUESTHOUSE_MANAGE_PERMISSIONS = ['guesthouse.manage'];

// RBAC is evaluated by the shared authorization middleware; stage checks are
// performed by the workflow service once the target queue is known.
const canAccessGuesthouseWorkflow = permissionMiddleware(GUESTHOUSE_WORKFLOW_PERMISSIONS);

const canManageGuesthouseMasterData = permissionMiddleware(GUESTHOUSE_MANAGE_PERMISSIONS);
const canReadGuesthouse = permissionMiddleware([
  'guesthouse.read',
  'guesthouse.edit',
  'guesthouse.workflow.*',
]);
const canEditGuesthouse = permissionMiddleware(['guesthouse.edit', 'guesthouse.workflow.*']);

const canDeleteGuesthouseBooking = async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const hasWorkflowPermission = permissions.some((permission) =>
      String(permission || '')
        .trim()
        .startsWith('guesthouse.workflow.'),
    );

    if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || hasWorkflowPermission) {
      return next();
    }

    const bookingId = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.user?.id, 10);
    if (
      !Number.isInteger(bookingId) ||
      bookingId <= 0 ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return next();
    }

    const owner = await guesthouseModel.getGuesthouseOwner(bookingId);
    if (!owner) return next();

    if (Number.parseInt(owner.created_by, 10) === userId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      requiredPermissions: GUESTHOUSE_WORKFLOW_PERMISSIONS,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to validate permissions' });
  }
};

router.get(
  '/room-options',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canReadGuesthouse,
  guesthouseController.getRoomOptions,
);
router.get(
  '/spocs',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canReadGuesthouse,
  guesthouseController.getSpocOptions,
);

router.post(
  '/',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canEditGuesthouse,
  guesthouseController.createGuesthouseBooking,
);
router.get(
  '/',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canReadGuesthouse,
  guesthouseController.listGuesthouseBookings,
);

router.get(
  '/workflow/meta',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.getWorkflowMeta,
);
router.get(
  '/queue/:stage/kpi-stats',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.getGuesthouseKpiStats,
);
router.get(
  '/queue/:stage',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.getGuesthouseQueue,
);

router.post(
  '/allotments/:allotmentId/rooms',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.addRoomAllotmentRow,
);
router.delete(
  '/allotments/rooms/:rowId',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.deleteRoomAllotmentRow,
);

router.get(
  '/admin/rooms',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.listGuesthouseRooms,
);
router.post(
  '/admin/rooms',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.createGuesthouseRoom,
);
router.post(
  '/admin/resources/bulk-import',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.bulkImportResources,
);
router.put(
  '/admin/rooms/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.updateGuesthouseRoom,
);
router.delete(
  '/admin/rooms/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.deleteGuesthouseRoom,
);

router.get(
  '/admin/caretakers',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.listGuesthouseCaretakers,
);
router.post(
  '/admin/caretakers',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.createGuesthouseCaretaker,
);
router.put(
  '/admin/caretakers/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.updateGuesthouseCaretaker,
);
router.delete(
  '/admin/caretakers/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canManageGuesthouseMasterData,
  guesthouseController.deleteGuesthouseCaretaker,
);

router.get(
  '/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canReadGuesthouse,
  guesthouseController.getGuesthouseBooking,
);
router.put(
  '/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canEditGuesthouse,
  guesthouseController.updateGuesthouseBooking,
);
router.delete(
  '/:id',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canEditGuesthouse,
  canDeleteGuesthouseBooking,
  guesthouseController.deleteGuesthouseBooking,
);
router.get(
  '/:id/status-updates',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canReadGuesthouse,
  guesthouseController.getStatusUpdates,
);
router.post(
  '/:id/principal-document',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  permissionMiddleware(['guesthouse.workflow.principal', 'guesthouse.workflow.guesthouse_admin']),
  upload.single('file'),
  guesthouseController.uploadPrincipalDocument,
);
router.delete(
  '/:id/principal-document',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  permissionMiddleware(['guesthouse.workflow.principal', 'guesthouse.workflow.guesthouse_admin']),
  guesthouseController.deletePrincipalDocument,
);
router.patch(
  '/:id/approval',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.approveGuesthouseWorkflow,
);
router.patch(
  '/:id/archive-toggle',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.toggleGuesthouseArchive,
);
router.patch(
  '/:id/travel-schedule',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canEditGuesthouse,
  guesthouseController.updateTravelSchedule,
);
router.put(
  '/:id/room-allotments',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.saveRoomAllotments,
);
router.put(
  '/:id/guests/:guestId/room-allotment',
  guesthouseRateLimiter,
  authMiddleware,
  authorizationSnapshotMiddleware,
  canAccessGuesthouseWorkflow,
  guesthouseController.upsertRoomAllotment,
);

export default router;
