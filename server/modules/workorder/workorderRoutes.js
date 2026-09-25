import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import workorderController from './workorderController.js';
import workorderModel from './workorderModel.js';
import { WORK_ORDER_WORKFLOW_PERMISSION } from './workorderWorkflowAdapter.js';
import {
  authMiddleware,
  authorizationSnapshotMiddleware,
  permissionMiddleware,
} from '../../middleware/authMiddleware.js';
const router = express.Router();
// -------------------------------------------------------
// Upload setup for work order item photos
// -------------------------------------------------------
const WORKORDER_PHOTO_DIR = path.join(process.cwd(), 'uploads', 'workorder-photos');
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};
const workorderPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir(WORKORDER_PHOTO_DIR);
      cb(null, WORKORDER_PHOTO_DIR);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${uniquePrefix}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(file.mimetype || '').toLowerCase())) {
      return cb(null, true);
    }
    return cb(new Error('Work order photos only accept image files (.jpg, .jpeg, .png, .webp, .gif)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
// -------------------------------------------------------
// Permission helpers
// -------------------------------------------------------
const WORKORDER_WORKFLOW_PERMISSIONS = [`${WORK_ORDER_WORKFLOW_PERMISSION}*`];
const canAccessWorkOrderWorkflow = permissionMiddleware(WORKORDER_WORKFLOW_PERMISSIONS);
const refreshWorkOrderAuthorization = permissionMiddleware([]);
const canAccessWorkOrderApprovalByRole = canAccessWorkOrderWorkflow;

const canEditWorkOrderAssignment = (req, res, next) => {
  // Reminder-date updates are available to regular users; assignment changes
  // require administrator access.
  if (req.body && !Object.prototype.hasOwnProperty.call(req.body, 'assignedTo')
    && !Object.prototype.hasOwnProperty.call(req.body, 'assignedToRole')) return next();
  const roles = [req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])]
    .map((role) => String(typeof role === 'object'
      ? role?.role || role?.role_code || role?.roleCode || role?.code || role?.name || ''
      : role || '').trim().toLowerCase().replace(/[_-]/g, ''));
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const isAdmin = Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)
    || roles.some((role) => ['admin', 'workorderadmin'].includes(role))
    || permissions.some((permission) => String(permission).toLowerCase().includes('workorder')
      && String(permission).toLowerCase().includes('workflow')
      && (String(permission).toLowerCase().includes('admin') || String(permission).toLowerCase().includes('workorder_admin')));
  if (isAdmin) return next();
  return res.status(403).json({ message: 'Only work order administrators can edit assignments' });
};

const canManageCatalog = (req, res, next) => {
  const roles = [req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])].map((r) => String(typeof r === 'object' ? r?.role || r?.role_code || r?.name : r).toLowerCase().replace(/[_-]/g, ''));
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (req.user?.is_super_admin || req.user?.isSuperAdmin || roles.some((r) => ['admin', 'workorderadmin'].includes(r)) || permissions.includes('work_order.manage')) return next();
  return res.status(403).json({ success: false, message: 'Work order catalogue management permission required' });
};

const canDeleteWorkOrder = async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const hasWorkflowPermission = permissions.some((p) =>
      String(p || '').trim().startsWith('work_order.workflow.'),
    );

    if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || hasWorkflowPermission) {
      return next();
    }
    const workOrderId = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.user?.id, 10);
    if (
      !Number.isInteger(workOrderId) ||
      workOrderId <= 0 ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return next();
    }

    const owner = await workorderModel.getWorkOrderOwner(workOrderId);
    if (!owner) return next();

    const createdBy = Number.parseInt(owner.created_by, 10);
    if (Number.isInteger(createdBy) && createdBy === userId) {
      return next();
    }

    return res.status(403).json({
      message: 'Insufficient permissions',
      requiredPermissions: WORKORDER_WORKFLOW_PERMISSIONS,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to validate permissions' });
  }
};

// -------------------------------------------------------
// Routes
// -------------------------------------------------------

router.use(authMiddleware);
// Refresh role/permission assignments before queue and approval checks so
// workflow access is based on current Access Control data, not stale tokens.
router.use(authorizationSnapshotMiddleware);

// Catalog (public to any authenticated user)
router.get('/catalog', workorderController.getCatalog);
router.post('/catalog/:level', canManageCatalog, workorderController.createCatalogItem);
router.patch('/catalog/:level/:id', canManageCatalog, workorderController.updateCatalogItem);
router.delete('/catalog/:level/:id', canManageCatalog, workorderController.deleteCatalogItem);

// Current employee info
router.get('/me', workorderController.getCurrentEmployeeInfo);
router.get('/assignees', workorderController.listWorkOrderAssignees);

// Workflow meta + queues (admin / approver only)
router.get('/workflow/meta', canAccessWorkOrderApprovalByRole, workorderController.getWorkflowMeta);
router.get('/queue/:stage', canAccessWorkOrderApprovalByRole, workorderController.getWorkOrderQueue);

// Photo upload
router.post(
  '/upload',
  workorderPhotoUpload.single('file'),
  workorderController.uploadPhoto,
);
router.get('/photo/:filename', workorderController.getPhoto);

// Dashboard list (admin / workflow users)
router.get('/dashboard', canAccessWorkOrderWorkflow, workorderController.listWorkOrdersDashboard);

// GET / returns the same listMyWorkOrders payload the dashboard uses (StoredWorkOrderSubmission[])
router.get('/', workorderController.listMyWorkOrders);

// My work orders (submitter view) - alias
router.get('/my', workorderController.listMyWorkOrders);

// Create
router.post('/', workorderController.createWorkOrder);

// Timeline / history
router.get('/:id/timeline', workorderController.getWorkOrderTimeline);

// Workflow approval
router.patch(
  '/:id/approval',
  canAccessWorkOrderApprovalByRole,
  workorderController.approveWorkOrderWorkflow,
);
// Item dashboard update (status, assigned_to, reminder_date)
router.patch(
  '/items/:itemId/dashboard',
  refreshWorkOrderAuthorization,
  canEditWorkOrderAssignment,
  workorderController.updateWorkOrderItemDashboard,
);
// Delete
router.delete('/:id', canDeleteWorkOrder, workorderController.deleteWorkOrder);
// Get single work order (must be last to avoid shadowing named routes above)
router.get('/:id', refreshWorkOrderAuthorization, workorderController.getWorkOrder);
export default router;
