import guesthouseModel from './guesthouseModel.js';
import './guesthouseWorkflowAdapter.js';
import { actOnWorkflow, startWorkflow, listQueue, getTimeline, getWorkflowMetadata } from '../shared/workflow/workflowService.js';
import fs from 'fs';
import path from 'path';
import { safeResolvePath } from '../../utils/pathSecurity.js';

const normalizeText = (value) => String(value ?? '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isSuperAdminRequest = (req) => Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin);

const normalizeActor = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  return {
    id: req.user?.id,
    userId: req.user?.id,
    email: req.user?.email,
    role: normalizeText(req.user?.role) || roles[0] || null,
    roles,
    permissions,
    isSuperAdmin: isSuperAdminRequest(req),
  };
};

const hasAnyGuesthouseWorkflowPermission = (req) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  return permissions.some((permission) =>
    normalizeText(permission).startsWith('guesthouse.workflow.'),
  );
};

const hasGuesthouseStagePermission = (req, stage) => {
  const normalizedStage = normalizeText(stage).toLowerCase();
  if (!normalizedStage) return false;
  if (isSuperAdminRequest(req)) return true;
  if (req.user?.is_admin || req.user?.isAdmin) return true;

  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const normalizedPermissions = permissions.map((p) => normalizeText(p).toLowerCase());
  if (
    normalizedPermissions.includes('guesthouse.workflow.*') ||
    normalizedPermissions.includes(`guesthouse.workflow.${normalizedStage}`)
  ) {
    return true;
  }

  // Access Control assigns the HOD as a role for a department.  A role-based
  // HOD must be allowed through to the shared workflow service, which then
  // restricts the queue to that HOD's assigned department(s).
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const normalizedRoles = roles.map((role) => {
    if (typeof role === 'string') return normalizeText(role).toLowerCase();
    return normalizeText(
      role?.role_code || role?.roleCode || role?.code || role?.role,
    ).toLowerCase();
  });

  if (normalizedStage === 'guesthouse_admin') {
    return normalizedRoles.includes('guesthouse_admin') || normalizedRoles.includes('admin');
  }

  return normalizedRoles.includes(normalizedStage);
};

const canAccessGuesthouseRecord = (req, booking) => {
  if (!booking) return false;
  if (isSuperAdminRequest(req)) return true;
  const actorUserId = toPositiveInt(req.user?.id);
  if (actorUserId && actorUserId === toPositiveInt(booking.created_by)) return true;
  const currentStage = normalizeText(booking.workflow_state?.currentStage || booking.workflow_stage).toLowerCase();
  return currentStage && hasGuesthouseStagePermission(req, currentStage);
};

const isApplicantEditable = (booking) => {
  const status = normalizeText(booking?.workflow_state?.status || booking?.workflow_status || booking?.overall_status).toLowerCase();
  const stage = normalizeText(booking?.workflow_state?.currentStage || booking?.workflow_stage).toLowerCase();
  return stage === 'hod' && ['in_progress', 'pending', 'submitted', ''].includes(status);
};

const isRoomAllotmentActionable = (booking) => {
  const status = normalizeText(booking?.workflow_state?.status || booking?.workflow_status).toLowerCase();
  const stage = normalizeText(booking?.workflow_state?.currentStage || booking?.workflow_stage).toLowerCase();
  return stage === 'guesthouse_admin' && ['in_progress', 'returned'].includes(status);
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
};

const GUESTHOUSE_PRINCIPAL_DOC_DIR = path.resolve(
  process.cwd(),
  'uploads',
  'guesthouse-principal-documents',
);
const GUESTHOUSE_PRINCIPAL_DOC_PUBLIC_PREFIX = '/uploads/guesthouse-principal-documents/';

const TEMP_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'temp');

const resolveSafeTempUploadPath = (unsafePath) => {
  const normalized = String(unsafePath || '').trim();
  if (!normalized) return null;

  const resolved = path.resolve(normalized);
  const safeBase = `${TEMP_UPLOAD_DIR}${path.sep}`;
  if (!resolved.startsWith(safeBase)) {
    return null;
  }
  return resolved;
};

const isEligibleForPrincipalDocument = (booking) => {
  const workflowStatus = normalizeText(
    booking.workflow_state?.status || booking.workflow_status || booking.overall_status,
  ).toLowerCase();
  const currentStage = normalizeText(
    booking.workflow_state?.currentStage || booking.workflow_stage,
  ).toLowerCase();

  return (
    workflowStatus === 'principal_approved' ||
    workflowStatus === 'completed' ||
    workflowStatus === 'approved' ||
    currentStage === 'principal' ||
    currentStage === 'guesthouse_admin'
  );
};

const canManagePrincipalDocumentsRequest = (req) => {
  if (isSuperAdminRequest(req)) return true;
  return hasGuesthouseStagePermission(req, 'principal') || hasGuesthouseStagePermission(req, 'guesthouse_admin');
};

const guesthouseController = {
  // ============================================
  // Booking CRUD
  // ============================================

  async createGuesthouseBooking(req, res) {
    let bookingId = null;
    try {
      const payload = req.body || {};
      if (!normalizeText(payload.applicant?.name) || !normalizeText(payload.beneficiary?.beneficiaryType) || !normalizeText(payload.beneficiary?.staffName)) {
        return res.status(400).json({ success: false, message: 'Applicant and beneficiary details are required' });
      }
      if (!Array.isArray(payload.guests) || !payload.guests.length) {
        return res.status(400).json({ success: false, message: 'At least one guest is required' });
      }
      const guests = payload.guests.map((guest) => ({
        ...guest,
        travel: guest?.travel || payload.travelDetails || {},
      }));
      const invalidGuest = guests.some((guest) => {
        const travel = guest.travel;
        const start = new Date(`${travel.checkInDate || ''}T00:00:00`);
        const end = new Date(`${travel.checkOutDate || ''}T00:00:00`);
        return !normalizeText(guest?.name) || !travel.checkInTime || !travel.checkOutTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start;
      });
      if (invalidGuest) {
        return res.status(400).json({ success: false, message: 'Every guest needs a valid check-in and check-out stay' });
      }
      bookingId = await guesthouseModel.createGuesthouseBooking(
        { ...payload, guests },
        req.user?.id,
      );

      const { state } = await startWorkflow({
        moduleKey: 'guesthouse',
        recordId: bookingId,
        metadata: {
          origin: 'api',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: { route: 'POST /api/guesthouse-bookings' },
        },
      });

      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      return res.status(201).json({ success: true, data: { ...booking, workflow_state: state } });
    } catch (error) {
      if (bookingId) {
        try {
          await guesthouseModel.deleteGuesthouseBooking(bookingId);
        } catch (cleanupError) {
          console.error('Unable to remove incomplete guesthouse booking', cleanupError);
        }
      }
      return handleError(res, error, 'Error in createGuesthouseBooking');
    }
  },

  async listGuesthouseBookings(req, res) {
    try {
      const mineOnly = normalizeText(req.query.mine).toLowerCase() === 'true';
      const isOwnerOnly =
        mineOnly || (!hasAnyGuesthouseWorkflowPermission(req) && !isSuperAdminRequest(req));
      const result = await guesthouseModel.listGuesthouseBookings({
        createdByUserId: isOwnerOnly ? req.user?.id : undefined,
        search: req.query.q || req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, 'Error in listGuesthouseBookings');
    }
  },

  async updateGuesthouseBooking(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      const owner = await guesthouseModel.getGuesthouseOwner(bookingId);
      if (!owner) return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      if (!isSuperAdminRequest(req) && toPositiveInt(owner.created_by) !== toPositiveInt(req.user?.id)) {
        return res.status(403).json({ success: false, message: 'Only the booking owner can edit this request' });
      }
      const currentBooking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!currentBooking) return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      if (!isSuperAdminRequest(req) && !isApplicantEditable(currentBooking)) {
        return res.status(409).json({ success: false, message: 'This booking can only be edited before HOD approval' });
      }

      const payload = req.body || {};
      if (!normalizeText(payload.applicant?.name) || !normalizeText(payload.beneficiary?.beneficiaryType) || !normalizeText(payload.beneficiary?.staffName || payload.beneficiary?.value)) {
        return res.status(400).json({ success: false, message: 'Applicant and beneficiary details are required' });
      }
      if (!Array.isArray(payload.guests) || !payload.guests.length) {
        return res.status(400).json({ success: false, message: 'At least one guest is required' });
      }
      const guests = payload.guests.map((guest) => ({ ...guest, travel: guest?.travel || payload.travelDetails || {} }));
      const invalidGuest = guests.some((guest) => {
        const travel = guest.travel;
        const start = new Date(`${travel.checkInDate || ''}T00:00:00`);
        const end = new Date(`${travel.checkOutDate || ''}T00:00:00`);
        return !normalizeText(guest?.name) || !travel.checkInTime || !travel.checkOutTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start;
      });
      if (invalidGuest) return res.status(400).json({ success: false, message: 'Every guest needs a valid check-in and check-out stay' });

      await guesthouseModel.updateGuesthouseBooking(bookingId, { ...payload, guests });
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      return res.json({ success: true, message: 'Guest house booking updated', data: booking });
    } catch (error) {
      return handleError(res, error, 'Error in updateGuesthouseBooking');
    }
  },

  async getGuesthouseBooking(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Invalid booking ID' });
      }

      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      }
      if (!canAccessGuesthouseRecord(req, booking)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      return res.json({ success: true, data: booking });
    } catch (error) {
      return handleError(res, error, 'Error in getGuesthouseBooking');
    }
  },

  async deleteGuesthouseBooking(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      const owner = await guesthouseModel.getGuesthouseOwner(bookingId);
      if (!owner) {
        return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      }
      if (!isSuperAdminRequest(req) && toPositiveInt(owner.created_by) !== toPositiveInt(req.user?.id)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      const state = booking?.workflow_state || {};
      const status = normalizeText(state.status || booking?.workflow_status || booking?.overall_status).toLowerCase();
      const stage = normalizeText(state.currentStage || booking?.workflow_stage).toLowerCase();
      if (!isSuperAdminRequest(req) && ((stage && stage !== 'hod') || ['approved', 'rejected', 'archived', 'completed', 'returned'].includes(status))) {
        return res.status(409).json({ success: false, message: 'This booking can no longer be deleted after approval has started' });
      }
      await guesthouseModel.deleteGuesthouseBooking(bookingId);
      return res.json({ success: true, message: 'Guest house booking deleted' });
    } catch (error) {
      return handleError(res, error, 'Error in deleteGuesthouseBooking');
    }
  },

  // ============================================
  // Workflow — approvals + queue
  // ============================================

  async approveGuesthouseWorkflow(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      const { decision, feedback } = req.body || {};
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Invalid booking ID' });
      }

      const result = await actOnWorkflow({
        moduleKey: 'guesthouse',
        recordId: bookingId,
        decision,
        feedback,
        actor: normalizeActor(req),
        metadata: {
          origin: 'api',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: { route: 'PATCH /api/guesthouse-bookings/:id/approval' },
        },
      });

      return res.json({
        success: true,
        message: `Workflow ${result.decision} at stage ${result.stage}`,
        data: { previousState: result.previousState, currentState: result.currentState },
      });
    } catch (error) {
      return handleError(res, error, 'Error in approveGuesthouseWorkflow');
    }
  },


  async getGuesthouseKpiStats(req, res) {
    try {
      const stage = normalizeText(req.query.scope || req.params.stage).toLowerCase();
      if (!hasGuesthouseStagePermission(req, stage)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      const stats = await guesthouseModel.getGuesthouseKpiStats(stage);

      return res.json({ success: true, data: stats });
    } catch (error) {
      return handleError(res, error, 'Error in getGuesthouseKpiStats');
    }
  },

  async getGuesthouseQueue(req, res) {
    try {
      const stage = normalizeText(req.params.stage).toLowerCase();
      if (!hasGuesthouseStagePermission(req, stage)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      const result = await listQueue({ moduleKey: 'guesthouse', stage, actor: normalizeActor(req), filters: {
        q: req.query.q,
        search: req.query.search,
        page: req.query.page,
        limit: req.query.limit,
      }});

      return res.json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, 'Error in getGuesthouseQueue');
    }
  },

  async getWorkflowMeta(req, res) {
    try {
      const meta = await getWorkflowMetadata({
        moduleKey: 'guesthouse',
        actor: normalizeActor(req),
      });
      return res.json({ success: true, data: meta });
    } catch (error) {
      return handleError(res, error, 'Error in getWorkflowMeta');
    }
  },

  // ============================================
  // Room allotment — admin only, unlocked once
  // workflow_stage === 'guesthouse_admin'
  // ============================================

  async upsertRoomAllotment(req, res) {
    try {
      if (!hasGuesthouseStagePermission(req, 'guesthouse_admin')) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      const bookingId = toPositiveInt(req.params.id);
      const guestId = toPositiveInt(req.params.guestId);
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      if (!isRoomAllotmentActionable(booking)) return res.status(409).json({ success: false, message: 'Room allocation is not available at this workflow stage' });
      const allotmentId = await guesthouseModel.upsertRoomAllotment(bookingId, guestId, req.body || {});
      return res.json({ success: true, data: { allotmentId } });
    } catch (error) {
      return handleError(res, error, 'Error in upsertRoomAllotment');
    }
  },

  async addRoomAllotmentRow(req, res) {
    try {
      if (!hasGuesthouseStagePermission(req, 'guesthouse_admin')) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      const allotmentId = toPositiveInt(req.params.allotmentId);
      const bookingId = await guesthouseModel.getAllotmentBookingId(allotmentId);
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Room allotment not found' });
      if (!isRoomAllotmentActionable(booking)) return res.status(409).json({ success: false, message: 'Room allocation is not available at this workflow stage' });
      const rowId = await guesthouseModel.addRoomAllotmentRow(allotmentId, req.body || {});
      return res.status(201).json({ success: true, data: { rowId } });
    } catch (error) {
      return handleError(res, error, 'Error in addRoomAllotmentRow');
    }
  },

  async deleteRoomAllotmentRow(req, res) {
    try {
      if (!hasGuesthouseStagePermission(req, 'guesthouse_admin')) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }
      const bookingId = await guesthouseModel.getAllotmentRowBookingId(req.params.rowId);
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Room allotment row not found' });
      if (!isRoomAllotmentActionable(booking)) return res.status(409).json({ success: false, message: 'Room allocation is not available at this workflow stage' });
      await guesthouseModel.deleteRoomAllotmentRow(req.params.rowId);
      return res.json({ success: true, message: 'Room allotment row deleted' });
    } catch (error) {
      return handleError(res, error, 'Error in deleteRoomAllotmentRow');
    }
  },

  async saveRoomAllotments(req, res) {
    try {
      if (!hasGuesthouseStagePermission(req, 'guesthouse_admin')) {
        return res.status(403).json({ success: false, message: 'Guest House Admin access is required' });
      }
      const bookingId = toPositiveInt(req.params.id);
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      if (!isRoomAllotmentActionable(booking)) return res.status(409).json({ success: false, message: 'Room allocation is not available at this workflow stage' });
      await guesthouseModel.saveGuesthouseRoomAllotments(bookingId, req.body?.allotments || []);
      return res.json({ success: true, message: 'Room allocation saved successfully' });
    } catch (error) {
      return handleError(res, error, 'Error in saveRoomAllotments');
    }
  },

  async updateTravelSchedule(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      const schedule = req.body || {};
      if (!bookingId || !/^\d{4}-\d{2}-\d{2}$/.test(normalizeText(schedule.checkInDate || schedule.check_in_date)) || !/^\d{4}-\d{2}-\d{2}$/.test(normalizeText(schedule.checkOutDate || schedule.check_out_date)) || !/^\d{2}:\d{2}$/.test(normalizeText(schedule.checkInTime || schedule.check_in_time)) || !/^\d{2}:\d{2}$/.test(normalizeText(schedule.checkOutTime || schedule.check_out_time))) {
        return res.status(400).json({ success: false, message: 'A valid check-in and check-out date and time are required' });
      }
      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      if (!isSuperAdminRequest(req) && toPositiveInt(booking.created_by) !== toPositiveInt(req.user?.id)) {
        return res.status(403).json({ success: false, message: 'Only the booking owner can update travel details' });
      }
      if (!isSuperAdminRequest(req) && !isApplicantEditable(booking)) {
        return res.status(409).json({ success: false, message: 'Travel schedule can only be changed before HOD approval' });
      }
      await guesthouseModel.updateGuesthouseTravelSchedule(bookingId, schedule);
      return res.json({ success: true, message: 'Travel schedule updated' });
    } catch (error) {
      return handleError(res, error, 'Error in updateTravelSchedule');
    }
  },

  // ============================================
  // Aliases for GuestHouseBooking.tsx's existing dropdown fetches.
  // The tsx already calls GET /guesthouse/room-options and
  // GET /guesthouse/spocs (see its useEffect hooks) — these were 404ing
  // because no matching route existed. Reusing the same master-data
  // model calls under the URL shape the frontend already expects, rather
  // than changing working frontend code.
  // ============================================

  async getRoomOptions(req, res) {
    try {
      const rooms = await guesthouseModel.listGuesthouseRooms({ status: 'Active' });
      return res.json({ success: true, data: rooms });
    } catch (error) {
      return handleError(res, error, 'Error in getRoomOptions');
    }
  },

  async getSpocOptions(req, res) {
    try {
      const caretakers = await guesthouseModel.listGuesthouseCaretakers({ status: 'Active' });
      return res.json({ success: true, data: caretakers });
    } catch (error) {
      return handleError(res, error, 'Error in getSpocOptions');
    }
  },

  // ============================================
  // Master data — rooms
  // ============================================

  async listGuesthouseRooms(req, res) {
    try {
      const rooms = await guesthouseModel.listGuesthouseRooms({ status: req.query.status });
      return res.json({ success: true, data: rooms });
    } catch (error) {
      return handleError(res, error, 'Error in listGuesthouseRooms');
    }
  },

  async createGuesthouseRoom(req, res) {
    try {
      const roomId = await guesthouseModel.createGuesthouseRoom(req.body || {}, req.user?.id);
      return res.status(201).json({ success: true, data: { id: roomId } });
    } catch (error) {
      return handleError(res, error, 'Error in createGuesthouseRoom');
    }
  },

  async bulkImportResources(req, res) {
    try {
      const result = await guesthouseModel.bulkImportResources(
        req.body?.type,
        req.body?.rows,
        req.user?.id,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Bulk import failed' });
    }
  },

  async updateGuesthouseRoom(req, res) {
    try {
      const updated = await guesthouseModel.updateGuesthouseRoom(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ success: false, message: 'Room not found' });
      return res.json({ success: true, message: 'Room updated' });
    } catch (error) {
      return handleError(res, error, 'Error in updateGuesthouseRoom');
    }
  },

  async deleteGuesthouseRoom(req, res) {
    try {
      const deleted = await guesthouseModel.deleteGuesthouseRoom(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Room not found' });
      return res.json({ success: true, message: 'Room deleted' });
    } catch (error) {
      return handleError(res, error, 'Error in deleteGuesthouseRoom');
    }
  },

  // ============================================
  // Master data — care takers
  // ============================================

  async listGuesthouseCaretakers(req, res) {
    try {
      const caretakers = await guesthouseModel.listGuesthouseCaretakers({
        status: req.query.status,
      });
      return res.json({ success: true, data: caretakers });
    } catch (error) {
      return handleError(res, error, 'Error in listGuesthouseCaretakers');
    }
  },

  async createGuesthouseCaretaker(req, res) {
    try {
      const caretakerId = await guesthouseModel.createGuesthouseCaretaker(
        req.body || {},
        req.user?.id,
      );
      return res.status(201).json({ success: true, data: { id: caretakerId } });
    } catch (error) {
      return handleError(res, error, 'Error in createGuesthouseCaretaker');
    }
  },

  async updateGuesthouseCaretaker(req, res) {
    try {
      const updated = await guesthouseModel.updateGuesthouseCaretaker(
        req.params.id,
        req.body || {},
      );
      if (!updated) return res.status(404).json({ success: false, message: 'Care taker not found' });
      return res.json({ success: true, message: 'Care taker updated' });
    } catch (error) {
      return handleError(res, error, 'Error in updateGuesthouseCaretaker');
    }
  },

  async deleteGuesthouseCaretaker(req, res) {
    try {
      const deleted = await guesthouseModel.deleteGuesthouseCaretaker(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Care taker not found' });
      return res.json({ success: true, message: 'Care taker deleted' });
    } catch (error) {
      return handleError(res, error, 'Error in deleteGuesthouseCaretaker');
    }
  },

  async uploadPrincipalDocument(req, res) {
    const uploadedFilePath = resolveSafeTempUploadPath(req.file?.path);
    let savedFilePath = null;

    try {
      const bookingId = toPositiveInt(req.params.id);
      if (!bookingId) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID',
        });
      }

      if (!req.file) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const file = req.file;
      const originalName = normalizeText(file.originalname);
      const isPdf =
        normalizeText(file.mimetype).toLowerCase() === 'application/pdf' &&
        originalName.toLowerCase().endsWith('.pdf');

      if (!isPdf || file.size >= 2 * 1024 * 1024) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          success: false,
          message: 'Only PDF files with a size less than 2MB are allowed.',
        });
      }

      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(404).json({
          success: false,
          message: 'Guest house booking not found',
        });
      }

      if (!canManagePrincipalDocumentsRequest(req)) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(403).json({
          success: false,
          message: 'You do not have access to upload this document',
        });
      }

      if (!isEligibleForPrincipalDocument(booking)) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(409).json({
          success: false,
          message:
            'Principal document is available at the principal stage or after principal approval',
        });
      }

      await fs.promises.mkdir(GUESTHOUSE_PRINCIPAL_DOC_DIR, { recursive: true });

      const extension = '.pdf';
      const storedName = `guesthouse-principal-${bookingId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      const finalPath = path.resolve(GUESTHOUSE_PRINCIPAL_DOC_DIR, storedName);
      const safeBase = `${GUESTHOUSE_PRINCIPAL_DOC_DIR}${path.sep}`;
      if (!finalPath.startsWith(safeBase)) {
        throw new Error('Invalid principal document path');
      }

      if (!uploadedFilePath) {
        throw new Error('Invalid upload source path');
      }

      await fs.promises.rename(uploadedFilePath, finalPath);
      savedFilePath = finalPath;

      const previousDocument = booking.principal_document;

      await guesthouseModel.updateGuesthousePrincipalDocument(bookingId, {
        original_name: originalName || file.originalname || null,
        stored_name: storedName,
        file_path: `${GUESTHOUSE_PRINCIPAL_DOC_PUBLIC_PREFIX}${storedName}`,
        mime_type: 'application/pdf',
        file_size: file.size,
      });

      if (previousDocument?.file_path) {
        const previousPath = safeResolvePath(GUESTHOUSE_PRINCIPAL_DOC_DIR, previousDocument.stored_name);
        if (previousPath && previousPath !== savedFilePath) {
          await fs.promises.unlink(previousPath).catch(() => {});
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Principal document uploaded successfully',
        data: {
          originalName: originalName || file.originalname || null,
          storedName,
          filePath: `${GUESTHOUSE_PRINCIPAL_DOC_PUBLIC_PREFIX}${storedName}`,
          mimeType: 'application/pdf',
          size: file.size,
        },
      });
    } catch (error) {
      try {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        if (savedFilePath) {
          await fs.promises.unlink(savedFilePath).catch(() => {});
        }
      } catch {
        // ignore cleanup errors
      }
      return handleError(res, error, 'Error in uploadPrincipalDocument');
    }
  },

  async deletePrincipalDocument(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID',
        });
      }

      if (!canManagePrincipalDocumentsRequest(req)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to delete this document',
        });
      }

      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Guest house booking not found',
        });
      }

      if (!isEligibleForPrincipalDocument(booking)) {
        return res.status(409).json({
          success: false,
          message:
            'Principal document is available at the principal stage or after principal approval',
        });
      }

      const document = booking.principal_document;
      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Principal document not found',
        });
      }

      await guesthouseModel.updateGuesthousePrincipalDocument(bookingId, null);

      const resolvedPath = safeResolvePath(GUESTHOUSE_PRINCIPAL_DOC_DIR, document.stored_name);
      if (resolvedPath) await fs.promises.unlink(resolvedPath).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Principal document deleted successfully',
      });
    } catch (error) {
      return handleError(res, error, 'Error in deletePrincipalDocument');
    }
  },

  async getStatusUpdates(req, res) {
    try {
      const bookingId = toPositiveInt(req.params.id);
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Invalid booking ID' });
      }

      const booking = await guesthouseModel.getGuesthouseBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Guest house booking not found' });
      }

      if (!canAccessGuesthouseRecord(req, booking)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      const timeline = await getTimeline({ moduleKey: 'guesthouse', recordId: bookingId });
      return res.json({ success: true, data: timeline });
    } catch (error) {
      return handleError(res, error, 'Error in getStatusUpdates');
    }
  },
};

export default guesthouseController;
