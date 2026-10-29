import express from 'express';

import guesthouseController from './guesthouseController.js';
import guesthouseModel from './guesthouseModel.js';
import {
  authMiddleware,
  authorizationSnapshotMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

const GUESTHOUSE_WORKFLOW_PERMISSIONS = ['guesthouse.workflow.*'];
const GUESTHOUSE_MANAGE_PERMISSIONS = ['guesthouse.manage'];
const GUESTHOUSE_READ_PERMISSIONS = ['guesthouse.read'];
const GUESTHOUSE_EDIT_PERMISSIONS = ['guesthouse.edit'];

// RBAC is evaluated by the shared authorization middleware; stage checks are
// performed by the workflow service once the target queue is known.
const canAccessGuesthouseWorkflow = permissionMiddleware(GUESTHOUSE_WORKFLOW_PERMISSIONS);

const canManageGuesthouseMasterData = permissionMiddleware(GUESTHOUSE_MANAGE_PERMISSIONS);
const canReadGuesthouse = permissionMiddleware([
  ...GUESTHOUSE_READ_PERMISSIONS,
  ...GUESTHOUSE_WORKFLOW_PERMISSIONS,
]);
const canEditGuesthouse = permissionMiddleware([
  ...GUESTHOUSE_EDIT_PERMISSIONS,
  ...GUESTHOUSE_WORKFLOW_PERMISSIONS,
]);
const canReadGuesthouseOrOwner = async (req, res, next) => {
  const hasReadPermission = req.user?.permissions?.includes('guesthouse.read');
  const hasWorkflowPermission = req.user?.permissions?.some((permission) =>
    String(permission || '').startsWith('guesthouse.workflow.'),
  );
  if (hasReadPermission || hasWorkflowPermission || req.user?.isSuperAdmin || req.user?.is_super_admin) {
    return next();
  }
  const bookingId = Number.parseInt(req.params.id, 10);
  const owner = await guesthouseModel.getGuesthouseOwner(bookingId);
  if (owner && Number.parseInt(owner.created_by, 10) === Number.parseInt(req.user?.id, 10)) {
    return next();
  }
  return res.status(403).json({ message: 'Insufficient permissions', requiredPermissions: GUESTHOUSE_READ_PERMISSIONS });
};

const canDeleteGuesthouseBooking = async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const hasWorkflowPermission = permissions.some((permission) =>
      String(permission || '').trim().startsWith('guesthouse.workflow.'),
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

    if (Number.parseInt(owner.created_by, 10) === userId && req.user?.permissions?.includes('guesthouse.edit')) {
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

router.use(authMiddleware);
// Queue permissions must reflect current Access Control assignments rather than
// the potentially stale role/permission claims embedded in the login token.
router.use(authorizationSnapshotMiddleware);

router.get('/room-options', canReadGuesthouse, guesthouseController.getRoomOptions);
router.get('/spocs', canReadGuesthouse, guesthouseController.getSpocOptions);

router.post('/', permissionMiddleware(GUESTHOUSE_EDIT_PERMISSIONS), guesthouseController.createGuesthouseBooking);
router.get('/', canReadGuesthouse, guesthouseController.listGuesthouseBookings);

router.get('/workflow/meta', canAccessGuesthouseWorkflow, guesthouseController.getWorkflowMeta);
router.get(
  '/queue/:stage/kpi-stats',
  canAccessGuesthouseWorkflow,
  guesthouseController.getGuesthouseKpiStats,
);
router.get('/queue/:stage', canAccessGuesthouseWorkflow, guesthouseController.getGuesthouseQueue);

router.post(
  '/allotments/:allotmentId/rooms',
  canAccessGuesthouseWorkflow,
  guesthouseController.addRoomAllotmentRow,
);
router.delete(
  '/allotments/rooms/:rowId',
  canAccessGuesthouseWorkflow,
  guesthouseController.deleteRoomAllotmentRow,
);

router.get('/admin/rooms', canManageGuesthouseMasterData, guesthouseController.listGuesthouseRooms);
router.post('/admin/rooms', canManageGuesthouseMasterData, guesthouseController.createGuesthouseRoom);
router.post('/admin/resources/bulk-import', canManageGuesthouseMasterData, guesthouseController.bulkImportResources);
router.put(
  '/admin/rooms/:id',
  canManageGuesthouseMasterData,
  guesthouseController.updateGuesthouseRoom,
);
router.delete(
  '/admin/rooms/:id',
  canManageGuesthouseMasterData,
  guesthouseController.deleteGuesthouseRoom,
);

router.get('/admin/caretakers', canManageGuesthouseMasterData, guesthouseController.listGuesthouseCaretakers);
router.post(
  '/admin/caretakers',
  canManageGuesthouseMasterData,
  guesthouseController.createGuesthouseCaretaker,
);
router.put(
  '/admin/caretakers/:id',
  canManageGuesthouseMasterData,
  guesthouseController.updateGuesthouseCaretaker,
);
router.delete(
  '/admin/caretakers/:id',
  canManageGuesthouseMasterData,
  guesthouseController.deleteGuesthouseCaretaker,
);

router.get('/:id', canReadGuesthouseOrOwner, guesthouseController.getGuesthouseBooking);
router.put('/:id', canEditGuesthouse, guesthouseController.updateGuesthouseBooking);
router.delete('/:id', canDeleteGuesthouseBooking, guesthouseController.deleteGuesthouseBooking);
router.get('/:id/status-updates', canReadGuesthouse, guesthouseController.getStatusUpdates);
router.post(
  '/:id/principal-document',
  canAccessGuesthouseWorkflow,
  upload.single('file'),
  guesthouseController.uploadPrincipalDocument,
);
router.delete('/:id/principal-document', canAccessGuesthouseWorkflow, guesthouseController.deletePrincipalDocument);
router.patch(
  '/:id/approval',
  canAccessGuesthouseWorkflow,
  guesthouseController.approveGuesthouseWorkflow,
);
router.patch(
  '/:id/archive-toggle',
  canAccessGuesthouseWorkflow,
  guesthouseController.toggleGuesthouseArchive,
);
router.patch('/:id/travel-schedule', canEditGuesthouse, guesthouseController.updateTravelSchedule);
router.put(
  '/:id/room-allotments',
  canAccessGuesthouseWorkflow,
  guesthouseController.saveRoomAllotments,
);
router.put(
  '/:id/guests/:guestId/room-allotment',
  canAccessGuesthouseWorkflow,
  guesthouseController.upsertRoomAllotment,
);

export default router;
