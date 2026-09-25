import fs from 'fs';
import path from 'path';

import workorderModel from './workorderModel.js';
import workflowService from '../shared/workflow/workflowService.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';
import { WORK_ORDER_FLOW, WORK_ORDER_WORKFLOW_PERMISSION } from './workorderWorkflowAdapter.js';

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isSuperAdminRequest = (req) => {
  if (req.user?.is_super_admin || req.user?.isSuperAdmin || req.user?.is_superadmin) return true;
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return roles.map((r) => normalizeText(r).toLowerCase()).some((r) => r === 'super_admin' || r === 'superadmin');
};

const hasWorkOrderWorkflowPermission = (req) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  if (permissions.some((p) => normalizeText(p).toLowerCase().startsWith(WORK_ORDER_WORKFLOW_PERMISSION))) {
    return true;
  }
  const roles = [
    req.user?.role,
    ...(Array.isArray(req.user?.roles) ? req.user.roles : []),
  ].map((role) => normalizeText(
    typeof role === 'object'
      ? role?.role || role?.role_code || role?.roleCode || role?.code || role?.name
      : role,
  ).toLowerCase().replace(/[_-]/g, ''));
  return roles.some((role) =>
    ['hod', 'coordinator', 'entityapprover', 'workorderincharge', 'incharge', 'principal', 'workorderadmin', 'admin'].includes(role),
  );
};

const hasWorkOrderWorkflowEditorAccess = (req) =>
  isSuperAdminRequest(req) || hasWorkOrderWorkflowPermission(req);

const hasWorkOrderAdminAccess = (req) => {
  if (isSuperAdminRequest(req)) return true;
  const roles = [req.user?.role, ...(Array.isArray(req.user?.roles) ? req.user.roles : [])]
    .map((role) => normalizeText(typeof role === 'object' ? role?.role || role?.role_code || role?.name : role).toLowerCase().replace(/[_-]/g, ''));
  return roles.some((role) => ['workorderadmin', 'admin'].includes(role));
};

const isWorkOrderOwner = (userId, workOrder) => {
  const normalizedUserId = toPositiveInt(userId);
  if (!normalizedUserId || !workOrder) return false;
  const createdBy = toPositiveInt(workOrder.created_by);
  return createdBy === normalizedUserId;
};

const normalizeActor = (req) => {
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : normalizeText(req.user?.role)
      ? [normalizeText(req.user.role)]
      : [];

  const normalizedRoles = roles.map((item) => {
    const roleValue = typeof item === 'object'
      ? item?.role || item?.role_code || item?.roleCode || item?.code || item?.name
      : item;
    return normalizeText(roleValue).toLowerCase().replace(/[_-]/g, '');
  });
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];

  // Work-order role names are translated to the shared engine's canonical
  // stages without changing the shared workflow implementation.
  // The shared workflow service derives its permission namespace from the
  // runtime module key (`workorder`), while the persisted RBAC permission
  // namespace is `work_order.workflow.*`. Expose both forms to the service
  // actor so database grants and workflow checks resolve identically.
  const workflowPermissions = [...permissions];
  permissions.forEach((permission) => {
    const normalizedPermission = normalizeText(permission).toLowerCase();
    if (normalizedPermission.startsWith(WORK_ORDER_WORKFLOW_PERMISSION)) {
      workflowPermissions.push(normalizedPermission.replace('work_order.workflow.', 'workorder.workflow.'));
    }
  });
  if (normalizedRoles.some((role) => ['workorderincharge', 'incharge'].includes(role))) {
    workflowPermissions.push(`${WORK_ORDER_WORKFLOW_PERMISSION}incharge`);
    workflowPermissions.push('workorder.workflow.incharge');
  }
  if (normalizedRoles.includes('entityapprover')) {
    workflowPermissions.push(`${WORK_ORDER_WORKFLOW_PERMISSION}level1`);
    workflowPermissions.push('workorder.workflow.level1');
  }
  if (normalizedRoles.some((role) => ['workorderadmin', 'admin'].includes(role))) {
    workflowPermissions.push(`${WORK_ORDER_WORKFLOW_PERMISSION}principal`);
    workflowPermissions.push(`${WORK_ORDER_WORKFLOW_PERMISSION}workorder_admin`);
    workflowPermissions.push('workorder.workflow.principal');
    workflowPermissions.push('workorder.workflow.workorder_admin');
  }

  return {
    id: req.user?.id ?? req.user?.userId,
    userId: req.user?.id ?? req.user?.userId,
    email: req.user?.email,
    role: normalizeText(req.user?.role) || roles[0] || null,
    roles,
    permissions: workflowPermissions,
    isSuperAdmin: isSuperAdminRequest(req),
  };
};

const handleWorkflowError = (res, error, fallbackMessage) => {
  if (error instanceof WorkflowError) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      error: error.message,
      code: error.code,
    });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: error.message || fallbackMessage,
    error: error.message || fallbackMessage,
  });
};

// Upload directory for work order photos
const WORKORDER_PHOTO_DIR = path.resolve(process.cwd(), 'uploads', 'workorder-photos');
const WORKORDER_PHOTO_PUBLIC_PREFIX = '/uploads/workorder-photos/';
const pendingWorkorderUploads = new Map();
setInterval(() => {
  const expiry = Date.now() - 60 * 60 * 1000;
  for (const [filename, pending] of pendingWorkorderUploads) {
    if (pending.uploadedAt > expiry) continue;
    pendingWorkorderUploads.delete(filename);
    try { fs.unlinkSync(path.join(WORKORDER_PHOTO_DIR, filename)); } catch (error) {
      if (error?.code !== 'ENOENT') console.error('Failed to expire workorder photo', error);
    }
  }
}, 15 * 60 * 1000).unref();

const cleanupPreSubmitPhotos = (payload) => {
  const items = Array.isArray(payload?.workItems) ? payload.workItems : payload?.items;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const photos = Array.isArray(item?.locationPhotos) ? item.locationPhotos : [];
    for (const photo of photos) {
      const publicPath = normalizeText(typeof photo === 'string' ? photo : photo?.file_path || photo?.url);
      if (!publicPath.startsWith(WORKORDER_PHOTO_PUBLIC_PREFIX)) continue;
      const filename = path.basename(publicPath);
      if (!filename || filename === '.' || filename.includes('..')) continue;
      try { fs.unlinkSync(path.join(WORKORDER_PHOTO_DIR, filename)); } catch (error) {
        if (error?.code !== 'ENOENT') console.error('Failed to clean up workorder photo', error);
      }
    }
  }
};

const markPreSubmitPhotosPersisted = (payload) => {
  const items = Array.isArray(payload?.workItems) ? payload.workItems : payload?.items;
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const photos = Array.isArray(item?.locationPhotos) ? item.locationPhotos : [];
    for (const photo of photos) {
      const publicPath = normalizeText(typeof photo === 'string' ? photo : photo?.file_path || photo?.url);
      if (publicPath.startsWith(WORKORDER_PHOTO_PUBLIC_PREFIX)) {
        pendingWorkorderUploads.delete(path.basename(publicPath));
      }
    }
  }
};

const workorderController = {
  // GET /api/workorders/catalog
  async getCatalog(req, res) {
    try {
      const catalog = await workorderModel.getCatalog();
      return res.json({ success: true, data: catalog });
    } catch (error) {
      console.error('Error fetching workorder catalog', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch catalog' });
    }
  },

  async createCatalogItem(req, res) {
    try { return res.status(201).json({ success: true, data: await workorderModel.createCatalogItem(req.params.level, req.body || {}) }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  },
  async updateCatalogItem(req, res) {
    try { return res.json({ success: true, data: await workorderModel.updateCatalogItem(req.params.level, req.params.id, req.body || {}) }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  },
  async deleteCatalogItem(req, res) {
    try { await workorderModel.deleteCatalogItem(req.params.level, req.params.id); return res.json({ success: true }); }
    catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  },

  // GET /api/workorders/me
  async getCurrentEmployeeInfo(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Invalid user context' });
      }
      const employee = await workorderModel.getCurrentEmployeeInfo(userId);
      return res.json({ success: true, data: employee || null });
    } catch (error) {
      console.error('Error fetching employee info', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch employee info' });
    }
  },

  async listWorkOrderAssignees(req, res) {
    try {
      return res.json({ success: true, data: await workorderModel.listWorkOrderAssignees(req.query?.q) });
    } catch (error) {
      console.error('Error fetching work order assignees', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch assignees' });
    }
  },

  // POST /api/workorders/
  async createWorkOrder(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const data = req.body || {};

      if (!data.category) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: category',
        });
      }

      if (!data.applicantName && !data.applicant_name && !data.employee_id) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: applicantName or employee_id',
        });
      }

      if (!data.date && !data.request_date) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: date',
        });
      }

      const workItemsArray = Array.isArray(data.workItems) ? data.workItems : Array.isArray(data.items) ? data.items : [];
      if (workItemsArray.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one work order item is required',
        });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Invalid user context' });
      }

      const { workOrderId, woNumber } = await workorderModel.createWorkOrder(data, userId);

      // Work-order approval order: HOD (level1) -> in-charge (dof) -> principal.
      // Workorder admin is the final administrative actor for the principal stage.
      try {
        await workflowService.startWorkflow({
          moduleKey: 'workorder',
          recordId: workOrderId,
          metadata: {
            origin: 'system',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              trigger: 'create_work_order',
              beneficiaryType: normalizeText(data.beneficiary_type) || null,
            },
          },
        });
      } catch (workflowError) {
        // Rollback by marking deleted if workflow fails
        try {
          await workorderModel.deleteWorkOrder(workOrderId);
        } catch (cleanupError) {
          console.error('Failed to clean up work order after workflow start failure', cleanupError);
        }
        throw workflowError;
      }

      const created = await workorderModel.getWorkOrderById(workOrderId);
      markPreSubmitPhotosPersisted(data);

      return res.status(201).json({
        success: true,
        message: 'Work order created successfully',
        data: {
          id: workOrderId,
          wo_number: woNumber,
          workOrder: created,
        },
      });
    } catch (error) {
      cleanupPreSubmitPhotos(req.body || {});
      return handleWorkflowError(res, error, 'Error in createWorkOrder');
    }
  },

  // GET /api/workorders/my  AND  GET /api/workorders (for dashboard)
  async listMyWorkOrders(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Invalid user context' });
      }

      const result = await workorderModel.listMyWorkOrders(
        isSuperAdminRequest(req) ? null : userId,
        isSuperAdminRequest(req) ? { ...req.query, all: true } : req.query,
      );
      // result is already { success: true, data: [...] }
      return res.json(result);
    } catch (error) {
      console.error('Error listing my work orders', error);
      return res.status(500).json({ success: false, message: 'Failed to list work orders' });
    }
  },

  // GET /api/workorders/dashboard
  async listWorkOrdersDashboard(req, res) {
    try {
      const result = await workorderModel.listWorkOrdersDashboard(req.query);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error fetching work orders dashboard', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
    }
  },

  // GET /api/workorders/queue/:stage
  async getWorkOrderQueue(req, res) {
    try {
      const stage = normalizeText(req.params.stage).toLowerCase();
      if (!stage) {
        return res.status(400).json({ success: false, message: 'Stage is required' });
      }

      const actor = normalizeActor(req);
      const filters = {
        ...req.query,
        isSuperAdmin: actor.isSuperAdmin,
      };

      // Resolve scope filters through the shared workflow service. Older
      // databases may still register this module as `work_order`; keep the
      // work-order queue usable while that legacy registration is present.
      let scopeResult = { forceAll: true, forceEmpty: false, scopeType: 'global' };
      if (typeof workflowService.resolveQueueScope === 'function') {
        try {
          scopeResult = await workflowService.resolveQueueScope({
            moduleKey: 'workorder',
            stage,
            actor,
          });
        } catch (scopeError) {
          console.warn('Using workorder queue scope fallback:', scopeError.message);
        }
      }

      filters.scopeFilters = scopeResult;
      if (stage === 'level1' && !actor.isSuperAdmin) {
          filters.scopeFilters = await workorderModel.getWorkOrderHodScope(
            actor.userId,
            req.user?.department_id ?? req.user?.departmentId,
            req.user?.department ?? req.user?.department_name ?? req.user?.departmentName,
          );
      }

      let result = await workorderModel.listWorkOrderQueueRecords(stage, filters);

      const statusCategories = ['total', 'pending', 'approved', 'returned', 'rejected', 'archived'];
      const statusCountResults = await Promise.all(
        statusCategories.map((statusCategory) =>
          workorderModel.listWorkOrderQueueRecords(stage, {
            ...filters,
            statusCategory,
            page: 1,
            limit: 1,
          }),
        ),
      );
      const statusCounts = Object.fromEntries(
        statusCategories.map((statusCategory, index) => [
          statusCategory,
          Number(statusCountResults[index]?.total || 0),
        ]),
      );
      const submissions = await Promise.all(
        (result.items || []).map((item) => workorderModel.getWorkOrderById(item.id)),
      );
      return res.json({
        success: true,
        ...result,
        statusCounts,
        data: result.items || [],
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          statusCounts,
        },
        submissions: submissions.filter(Boolean),
      });
    } catch (error) {
      // Keep work-order approvals available if a legacy shared workflow
      // registration or scope policy is unavailable in the current database.
      try {
        const fallbackStage = normalizeText(req.params.stage).toLowerCase();
        const fallbackScope = fallbackStage === 'level1' && !actor.isSuperAdmin
          ? await workorderModel.getWorkOrderHodScope(
            actor.userId,
            req.user?.department_id ?? req.user?.departmentId,
            req.user?.department ?? req.user?.department_name ?? req.user?.departmentName,
          )
          : { forceAll: true, forceEmpty: false, scopeType: 'global' };
        const fallbackResult = await workorderModel.listWorkOrderQueueRecords(
          fallbackStage,
          {
            ...req.query,
            workflowStatus: normalizeText(req.query.workflowStatus).toLowerCase() || 'in_progress',
            scopeFilters: fallbackScope,
          },
        );
        const fallbackSubmissions = await Promise.all(
          (fallbackResult.items || []).map((item) => workorderModel.getWorkOrderById(item.id)),
        );
        return res.json({
          success: true,
          ...fallbackResult,
          data: fallbackResult.items || [],
          pagination: {
            total: fallbackResult.total,
            page: fallbackResult.page,
            limit: fallbackResult.limit,
          },
          submissions: fallbackSubmissions.filter(Boolean),
        });
      } catch (fallbackError) {
        console.error('Workorder queue fallback failed', fallbackError);
      }
      return handleWorkflowError(res, error, 'Error in getWorkOrderQueue');
    }
  },

  // GET /api/workorders/:id
  async getWorkOrder(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid work order ID' });
      }

      const wo = await workorderModel.getWorkOrderById(id);
      if (!wo) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      const userId = toPositiveInt(req.user?.id);
      const isOwner = isWorkOrderOwner(userId, wo);
      const isWorkflowEditor = hasWorkOrderWorkflowEditorAccess(req);

      if (!isOwner && !isWorkflowEditor) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      return res.json({ success: true, data: wo });
    } catch (error) {
      console.error('Error fetching work order', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch work order' });
    }
  },

  // PATCH /api/workorders/:id/approval
  async approveWorkOrderWorkflow(req, res) {
    try {
      const workOrderId = toPositiveInt(req.params.id);
      if (!workOrderId) {
        return res.status(400).json({ success: false, message: 'Invalid work order ID' });
      }

      const actor = normalizeActor(req);
      const { decision, feedback } = req.body || {};

      if (!decision) {
        return res.status(400).json({ success: false, message: 'Decision is required' });
      }

      // Initialize legacy records that were submitted before workflow_state
      // was added, then process the HOD decision normally.
      const existingContext = await workorderModel.getWorkOrderRecordContext(workOrderId);
      if (existingContext && !existingContext.workflowState) {
        await workflowService.startWorkflow({
          moduleKey: 'workorder',
          recordId: workOrderId,
        });
      }

      const result = await workflowService.actOnWorkflow({
        moduleKey: 'workorder',
        recordId: workOrderId,
        decision: normalizeText(decision).toLowerCase(),
        feedback: normalizeText(feedback) || null,
        actor,
      });

      const updatedWo = await workorderModel.getWorkOrderById(workOrderId);

      return res.json({
        success: true,
        message: 'Work order decision applied',
        data: {
          workflowResult: result,
          workOrder: updatedWo,
        },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in approveWorkOrderWorkflow');
    }
  },

  // GET /api/workorders/workflow/meta
  async getWorkflowMeta(req, res) {
    try {
      const actor = normalizeActor(req);
      const meta = await workflowService.getWorkflowMetadata({
        moduleKey: 'workorder',
        actor,
      });
      meta.stages = [...WORK_ORDER_FLOW];
      meta.permittedStages = meta.stages.filter((stage) =>
        actor.isSuperAdmin ||
        actor.permissions.includes(`${WORK_ORDER_WORKFLOW_PERMISSION}${stage}`),
      );
      return res.json({ success: true, data: meta });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getWorkflowMeta');
    }
  },

  // GET /api/workorders/:id/timeline
  async getWorkOrderTimeline(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid work order ID' });
      }

      const owner = await workorderModel.getWorkOrderOwner(id);
      if (!owner) return res.status(404).json({ success: false, message: 'Work order not found' });
      if (toPositiveInt(owner.created_by) !== toPositiveInt(req.user?.id) && !hasWorkOrderWorkflowEditorAccess(req)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      const timeline = await workorderModel.getWorkOrderTimeline(id);
      return res.json({ success: true, data: timeline });
    } catch (error) {
      console.error('Error fetching work order timeline', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch timeline' });
    }
  },

  // PATCH /api/workorders/items/:itemId/dashboard
  async updateWorkOrderItemDashboard(req, res) {
    try {
      const itemId = toPositiveInt(req.params.itemId);
      if (!itemId) {
        return res.status(400).json({ success: false, message: 'Invalid item ID' });
      }

      const body = { ...(req.body || {}) };
      // Accept both frontend camelCase and API snake_case payloads.
      if (body.assignedTo !== undefined && body.assigned_to === undefined) body.assigned_to = body.assignedTo;
      if (body.assignedToRole !== undefined && body.assigned_to_role === undefined) body.assigned_to_role = body.assignedToRole;
      if (body.reminderDate !== undefined && body.reminder_date === undefined) body.reminder_date = body.reminderDate;
      const itemContext = await workorderModel.getWorkOrderItemContext(itemId);
      if (!itemContext) return res.status(404).json({ success: false, message: 'Work order item not found' });
      const isOwner = toPositiveInt(itemContext.created_by) === toPositiveInt(req.user?.id);
      if (!isOwner && !hasWorkOrderAdminAccess(req) && !hasWorkOrderWorkflowEditorAccess(req)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      if ((body.status !== undefined || body.assignedTo !== undefined || body.assigned_to !== undefined || body.assignedToRole !== undefined || body.assigned_to_role !== undefined) && !hasWorkOrderAdminAccess(req)) {
        return res.status(403).json({ success: false, message: 'Only Work Order Admin can assign or update work status' });
      }

      const updated = await workorderModel.updateWorkOrderItemDashboard(itemId, body);
      if (!updated) {
        return res.status(400).json({ success: false, message: 'No changes applied' });
      }

      return res.json({ success: true, message: 'Item updated successfully' });
    } catch (error) {
      console.error('Error updating work order item', error);
      return res.status(500).json({ success: false, message: 'Failed to update item' });
    }
  },

  // POST /api/workorders/upload (multipart, field: file)
  async uploadPhoto(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const workOrderItemId = toPositiveInt(req.body?.work_order_item_id);
      const userId = toPositiveInt(req.user?.id ?? req.user?.userId);
      if (workOrderItemId) {
        const item = await workorderModel.getWorkOrderItemContext(workOrderItemId);
        if (!item) return res.status(404).json({ success: false, message: 'Work order item not found' });
        if (toPositiveInt(item.created_by) !== userId && !hasWorkOrderAdminAccess(req)) {
          return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
      }
      const publicPath = `${WORKORDER_PHOTO_PUBLIC_PREFIX}${req.file.filename}`;
      if (!workOrderItemId) pendingWorkorderUploads.set(req.file.filename, { uploadedAt: Date.now(), userId });

      // A new work-order form uploads files before item IDs exist. In that
      // case, return the public URL now; createWorkOrder persists it after
      // inserting the corresponding work_order_item.
      const photoId = workOrderItemId
        ? await workorderModel.saveItemPhoto(
          workOrderItemId,
          {
            originalName: req.file.originalname,
            storageName: req.file.filename,
            filePath: publicPath,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
          },
          userId,
        )
        : null;
      if (workOrderItemId) pendingWorkorderUploads.delete(req.file.filename);

      return res.status(201).json({
        success: true,
        message: 'Photo uploaded successfully',
        data: {
          id: photoId,
          url: publicPath,
          file_path: publicPath,
          file_name: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });
    } catch (error) {
      console.error('Error uploading photo', error);
      return res.status(500).json({ success: false, message: 'Failed to upload photo' });
    }
  },

  async getPhoto(req, res) {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename === '.') return res.status(400).json({ message: 'Invalid photo name' });
    const photo = await workorderModel.getWorkOrderPhotoContext(filename);
    const pending = pendingWorkorderUploads.get(filename);
    const userId = toPositiveInt(req.user?.id ?? req.user?.userId);
    const canManage = hasWorkOrderAdminAccess(req) || hasWorkOrderWorkflowEditorAccess(req);
    if (photo && !canManage && toPositiveInt(photo.created_by) !== userId) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    if (!photo && (!pending || (pending.userId !== userId && !canManage))) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    const filePath = path.join(WORKORDER_PHOTO_DIR, filename);
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ message: 'Photo not found' });
    });
  },

  // DELETE /api/workorders/:id
  async deleteWorkOrder(req, res) {
    try {
      const id = toPositiveInt(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid work order ID' });
      }

      const userId = toPositiveInt(req.user?.id);
      const wo = await workorderModel.getWorkOrderOwner(id);

      if (!wo) {
        return res.status(404).json({ success: false, message: 'Work order not found' });
      }

      const isOwner = toPositiveInt(wo.created_by) === userId;
      if (!isOwner && !isSuperAdminRequest(req) && !hasWorkOrderWorkflowEditorAccess(req)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      const lifecycle = await workorderModel.getWorkOrderDeletionContext(id);
      const lockedStatuses = new Set(['approved', 'completed', 'rejected', 'deleted', 'in_progress']);
      if (lockedStatuses.has(String(lifecycle?.overall_status || '').toLowerCase())
        || String(lifecycle?.workflow_status || '').toLowerCase() === 'in_progress'
        || String(lifecycle?.workflow_stage || '').trim()) {
        return res.status(409).json({ success: false, message: 'Work order cannot be deleted after workflow processing has started' });
      }

      await workorderModel.deleteWorkOrder(id);
      return res.json({ success: true, message: 'Work order deleted successfully' });
    } catch (error) {
      console.error('Error deleting work order', error);
      return res.status(500).json({ success: false, message: 'Failed to delete work order' });
    }
  },
};

export default workorderController;
