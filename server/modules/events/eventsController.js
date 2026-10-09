import path from 'path';

import multer from 'multer';

import eventsModel from './eventsModel.js';
import { searchApplicant } from '../shared/budget/userResolvers.js';

const documentStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'event-documents'));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `evt-doc-${Date.now()}${ext}`);
  },
});

export const documentUpload = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const updateStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'event-updates'));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `evt-update-${Date.now()}${ext}`);
  },
});

export const updateUpload = multer({
  storage: updateStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

function getEventCategory(evt) {
  let evtState = evt.workflow_state;
  if (typeof evtState === 'string') {
    try {
      evtState = JSON.parse(evtState);
    } catch (_e) {
      evtState = {};
    }
  }
  evtState = evtState || {};

  const currentStage = String(evtState.currentStage || '').toLowerCase();
  const stateStatus = String(evtState.status || '').toLowerCase();
  const workflowStatus = String(evt.workflow_status || evt.status || '').toLowerCase();

  // 1. Archive
  if (workflowStatus.includes('archive') || stateStatus.includes('archive')) {
    return 'archived';
  }

  // 2. Rejected
  if (
    currentStage === 'rejected' ||
    stateStatus === 'rejected' ||
    workflowStatus === 'rejected' ||
    workflowStatus.includes('reject')
  ) {
    return 'rejected';
  }

  // 3. Returned (handles 'return' and 'returned')
  if (
    currentStage === 'return' ||
    currentStage === 'returned' ||
    stateStatus === 'return' ||
    stateStatus === 'returned' ||
    workflowStatus === 'return' ||
    workflowStatus === 'returned' ||
    workflowStatus.includes('return')
  ) {
    return 'returned';
  }

  // 4. Approved
  if (
    currentStage === 'approved' ||
    currentStage === 'published' ||
    stateStatus === 'approved' ||
    stateStatus === 'published' ||
    workflowStatus === 'approved' ||
    workflowStatus === 'published' ||
    workflowStatus.includes('approved')
  ) {
    return 'approved';
  }

  // 5. Draft (pure unsubmitted draft)
  if (
    (currentStage === 'draft' || currentStage === '') &&
    (workflowStatus === 'draft' || stateStatus === 'draft')
  ) {
    return 'draft';
  }

  // 6. Pending
  return 'pending';
}

function getPermittedStagesForUser(user) {
  if (!user) return ['hod_pending', 'level1'];

  const rawUserRoles = [];
  if (user.role) rawUserRoles.push(user.role);
  if (Array.isArray(user.roles)) rawUserRoles.push(...user.roles);
  if (Array.isArray(user.user_roles)) rawUserRoles.push(...user.user_roles);
  if (Array.isArray(user.user_entity_roles)) rawUserRoles.push(...user.user_entity_roles);
  if (Array.isArray(user.permissions)) rawUserRoles.push(...user.permissions);

  const normalizedUserRoles = rawUserRoles.map((r) =>
    String(typeof r === 'object' ? r.role_code || r.code || r.name || r.role || r : r || '')
      .trim()
      .toLowerCase(),
  );

  const designation = String(user.designation || user.designation_name || '').toLowerCase();
  const title = String(user.title || user.job_title || '').toLowerCase();
  const userRole = String(user.role || '')
    .trim()
    .toLowerCase();

  const isSuperAdmin =
    userRole === 'super_admin' ||
    normalizedUserRoles.includes('super_admin') ||
    Boolean(user.isAdmin || user.isSuperAdmin || user.is_admin || user.is_super_admin);

  if (isSuperAdmin) {
    return ['hod_pending', 'iqac_pending', 'principal_pending', 'level1'];
  }

  const stages = [];

  const isHod =
    Boolean(user.is_hod || user.isHod || Number(user.is_hod) === 1) ||
    normalizedUserRoles.some(
      (r) => r === 'hod' || r === 'head_of_department' || r.includes('hod'),
    ) ||
    userRole.includes('hod') ||
    designation.includes('hod') ||
    title.includes('hod');

  if (isHod) {
    stages.push('hod_pending', 'level1');
  }

  const isIqac =
    Boolean(user.is_iqac || user.isIqac || Number(user.is_iqac) === 1) ||
    normalizedUserRoles.some((r) => r.includes('iqac')) ||
    userRole.includes('iqac') ||
    designation.includes('iqac') ||
    title.includes('iqac');

  if (isIqac) {
    stages.push('iqac_pending');
  }

  const isPrincipal =
    Boolean(user.is_principal || user.isPrincipal || Number(user.is_principal) === 1) ||
    normalizedUserRoles.some((r) => r.includes('principal')) ||
    userRole.includes('principal') ||
    designation.includes('principal') ||
    title.includes('principal');

  if (isPrincipal) {
    stages.push('principal_pending');
  }

  return stages.length > 0 ? stages : ['hod_pending', 'level1'];
}

const eventsController = {
  // GET /api/events
  async listEvents(req, res) {
    try {
      const events = await eventsModel.listAll();
      return res.json(events);
    } catch (err) {
      console.error('[eventsController] listEvents error:', err);
      return res.status(500).json({ error: 'Failed to fetch events', details: err.message });
    }
  },

  // POST /api/events
  async createEvent(req, res) {
    try {
      const userId = req.user?.id;
      if (!req.body.title) {
        return res.status(400).json({ error: 'Event title is required' });
      }
      const event = await eventsModel.create(req.body, userId);
      return res.status(201).json(event);
    } catch (err) {
      console.error('[eventsController] createEvent error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to create event', details: err.message });
    }
  },

  // GET /api/events/:id
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const event = await eventsModel.findById(numericId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      return res.json(event);
    } catch (err) {
      console.error('[eventsController] getEventById error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch event details', details: err.message });
    }
  },

  // PUT /api/events/:id
  async updateEvent(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const result = await eventsModel.update(numericId, req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] updateEvent error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update event', details: err.message });
    }
  },

  // DELETE /api/events/:id
  async deleteEvent(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const result = await eventsModel.softDelete(numericId, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] deleteEvent error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to delete event', details: err.message });
    }
  },

  // GET /api/events/search-employee
  async searchEmployee(req, res) {
    try {
      const { q } = req.query;
      const results = await searchApplicant(q || '');
      return res.json({ success: true, status: 'success', data: results });
    } catch (err) {
      console.error('[eventsController] searchEmployee error:', err);
      return res.status(500).json({ error: 'Failed to search employee' });
    }
  },

  // GET /api/events/:id/summary
  async getEventSummary(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const summary = await eventsModel.getSummary(numericId);
      return res.json(summary);
    } catch (err) {
      console.error('[eventsController] getEventSummary error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch event summary', details: err.message });
    }
  },

  // GET /api/events/:id/participants
  async getParticipants(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.json({ participants: [] });
      }
      const participants = await eventsModel.getParticipants(numericId);
      return res.json({ participants: participants || [] });
    } catch (err) {
      console.error('[eventsController] getParticipants error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch participants', details: err.message });
    }
  },

  // PUT /api/events/:id/participants/:pid
  async updateParticipant(req, res) {
    try {
      const { id, pid } = req.params;
      const numericId = Number(id);
      const numericPid = Number(pid);
      if (!id || isNaN(numericId) || numericId <= 0 || isNaN(numericPid) || numericPid <= 0) {
        return res.status(400).json({ error: 'Invalid parameters' });
      }
      const result = await eventsModel.updateParticipant(numericId, numericPid, req.body);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] updateParticipant error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update participant', details: err.message });
    }
  },

  // GET /api/events/:id/feedback
  async getEventFeedback(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const data = await eventsModel.getEventFeedback(numericId);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('[eventsController] getEventFeedback error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch event feedback', details: err.message });
    }
  },

  // POST /api/events/:id/feedback
  async submitFeedback(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const userId = req.user?.id;
      const result = await eventsModel.submitFeedback(numericId, userId, req.body);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] submitFeedback error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to submit feedback', details: err.message });
    }
  },

  // POST /api/events/:id/certificates/publish
  async publishCertificates(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const userId = req.user?.id;
      const result = await eventsModel.publishCertificates(numericId, userId);
      return res.json({ success: true, result });
    } catch (err) {
      console.error('[eventsController] publishCertificates error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to publish certificates', details: err.message });
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC (no auth required)
  // ─────────────────────────────────────────────────────────

  // GET /api/events/public
  async listPublicEvents(_req, res) {
    try {
      const rows = await eventsModel.listPublicEvents();
      const formatted = rows.map(formatPublicEvent);

      // Nest sub-events under parents
      const parentMap = new Map();
      const orphans = [];
      for (const ev of formatted) {
        if (!ev._parentId) {
          parentMap.set(ev.id, { ...ev, subEvents: [] });
        } else {
          orphans.push(ev);
        }
      }
      const roots = [...parentMap.values()];
      for (const sub of orphans) {
        const parent = parentMap.get(sub._parentId);
        if (parent) {
          parent.subEvents.push(sub);
        } else {
          roots.push({ ...sub, subEvents: [] });
        }
      }

      // Clean internal fields
      const events = roots.map((ev) => {
        delete ev._parentId;
        if (ev.subEvents) {
          ev.subEvents = ev.subEvents.map((s) => {
            delete s._parentId;
            return s;
          });
        }
        return ev;
      });

      return res.json({ success: true, data: { events } });
    } catch (err) {
      console.error('[eventsController] listPublicEvents error:', err);
      return res.status(500).json({ error: 'Failed to fetch public events', details: err.message });
    }
  },

  // GET /api/events/public/:id
  async getPublicEvent(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const row = await eventsModel.findPublicEventById(numericId);
      if (!row) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const event = formatPublicEvent(row);
      delete event._parentId;

      // Attach sub-events if multi-event
      if (row.isMultiEvent) {
        const subRows = await eventsModel.listSubEvents(row.id);
        event.subEvents = subRows.map((s) => {
          const formatted = formatPublicEvent(s);
          delete formatted._parentId;
          return formatted;
        });
      }

      return res.json({ success: true, data: { event } });
    } catch (err) {
      console.error('[eventsController] getPublicEvent error:', err);
      return res.status(500).json({ error: 'Failed to fetch public event', details: err.message });
    }
  },

  // GET /api/events/:id/registration-settings
  async getRegistrationSettings(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.json({ success: true, data: null });
      }
      const settings = await eventsModel.getRegistrationSettings(numericId);
      return res.json({ success: true, data: settings });
    } catch (err) {
      console.error('[eventsController] getRegistrationSettings error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch registration settings', details: err.message });
    }
  },

  // PUT /api/events/:id/registration-settings
  async saveRegistrationSettings(req, res) {
    try {
      const { id } = req.params;
      const numericId = Number(id);
      if (!id || isNaN(numericId) || numericId <= 0) {
        return res.status(400).json({ error: 'Invalid event ID' });
      }
      const userId = req.user?.id;
      const result = await eventsModel.saveRegistrationSettings(numericId, req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] saveRegistrationSettings error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save registration settings', details: err.message });
    }
  },

  // ── Document Checklist Handlers ────────────────────────────
  async getDocuments(req, res) {
    try {
      const { eventId } = req.params;
      const data = await eventsModel.getDocuments(Number(eventId));
      return res.json(data);
    } catch (err) {
      console.error('[eventsController] getDocuments error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch documents', details: err.message });
    }
  },

  async toggleDocument(req, res) {
    try {
      const { eventId, docname } = req.params;
      const { active } = req.body;
      const userId = req.user?.id;
      const result = await eventsModel.toggleDocument(
        Number(eventId),
        decodeURIComponent(docname),
        active,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] toggleDocument error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update document', details: err.message });
    }
  },

  async uploadDocument(req, res) {
    try {
      const { eventId, docname } = req.params;
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = `/uploads/event-documents/${req.file.filename}`;
      const result = await eventsModel.attachDocumentFile(
        Number(eventId),
        decodeURIComponent(docname),
        filePath,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] uploadDocument error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to upload document', details: err.message });
    }
  },

  async requestEdit(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.requestEdit(Number(eventId), userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] requestEdit error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to request edit', details: err.message });
    }
  },

  async submitForApproval(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.submitForApproval(Number(eventId), userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] submitForApproval error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to submit for approval', details: err.message });
    }
  },

  // ── Event Updates Handlers ──────────────────────────────────
  async uploadFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = `/uploads/event-updates/${req.file.filename}`;
      const result = await eventsModel.recordUpload(Number(id), filePath, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] uploadFile error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to upload file', details: err.message });
    }
  },

  async savePublicity(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.savePublicity(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] savePublicity error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save publicity', details: err.message });
    }
  },

  async saveParticipants(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.saveParticipants(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] saveParticipants error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save participants', details: err.message });
    }
  },

  async saveLetters(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.saveLetters(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] saveLetters error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save letters', details: err.message });
    }
  },

  async updateMailStatus(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.updateMailStatus(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] updateMailStatus error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update mail status', details: err.message });
    }
  },

  async saveDocuments(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.saveDocuments(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] saveDocuments error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save documents', details: err.message });
    }
  },

  async addResourcePerson(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.addResourcePerson(Number(id), req.body, userId);
      return res.status(201).json(result);
    } catch (err) {
      console.error('[eventsController] addResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to add resource person', details: err.message });
    }
  },

  async updateResourcePerson(req, res) {
    try {
      const { id, pid } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.updateResourcePerson(
        Number(id),
        Number(pid),
        req.body,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] updateResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update resource person', details: err.message });
    }
  },

  async deleteResourcePerson(req, res) {
    try {
      const { id, pid } = req.params;
      const userId = req.user?.id;
      const result = await eventsModel.deleteResourcePerson(Number(id), Number(pid), userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] deleteResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to delete resource person', details: err.message });
    }
  },

  // ── Event Approval Workflow Controllers ───────────────────
  async submitWorkflow(req, res) {
    try {
      const id = Number(req.params.id || req.params.eventId);
      const userId = req.user?.id;
      const userName = req.user?.name || req.user?.email || 'User';
      const comments = req.body?.comments;
      const result = await eventsModel.submitWorkflow(id, userId, userName, comments);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] submitWorkflow error:', err);
      return res
        .status(err.status || 500)
        .json({
          error: err.message || 'Failed to submit event for approval',
          details: err.message,
        });
    }
  },

  async approveWorkflow(req, res) {
    try {
      const id = Number(req.params.id || req.params.eventId);
      const comments = req.body?.comments || req.body?.feedback;
      const decision = String(req.body?.decision || req.body?.action || '').toLowerCase();

      if (decision === 'rejected' || decision === 'reject') {
        const result = await eventsModel.rejectWorkflow(id, req.user, comments);
        return res.json({ success: true, status: 'success', ...result });
      }

      if (decision === 'returned' || decision === 'return') {
        const result = await eventsModel.rejectWorkflow(id, req.user, comments);
        return res.json({ success: true, status: 'success', ...result });
      }

      const result = await eventsModel.approveWorkflow(id, req.user, comments);
      return res.json({ success: true, status: 'success', ...result });
    } catch (err) {
      console.error('[eventsController] approveWorkflow error:', err);
      const msg = err.message || err.error || 'Failed to approve event';
      return res
        .status(err.status || 500)
        .json({ success: false, status: 'error', error: msg, message: msg, details: msg });
    }
  },

  async rejectWorkflow(req, res) {
    try {
      const id = Number(req.params.id || req.params.eventId);
      const comments = req.body?.comments || req.body?.feedback;
      const result = await eventsModel.rejectWorkflow(id, req.user, comments);
      return res.json({ success: true, status: 'success', ...result });
    } catch (err) {
      console.error('[eventsController] rejectWorkflow error:', err);
      const msg = err.message || err.error || 'Failed to reject event';
      return res
        .status(err.status || 500)
        .json({ success: false, status: 'error', error: msg, message: msg, details: msg });
    }
  },

  async getApprovalHistory(req, res) {
    try {
      const id = Number(req.params.id || req.params.eventId);
      const history = await eventsModel.getApprovalHistory(id);
      return res.json({ success: true, history });
    } catch (err) {
      console.error('[eventsController] getApprovalHistory error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch approval history', details: err.message });
    }
  },

  async getWorkflowMeta(req, res) {
    try {
      const events = await eventsModel.listAll();
      const user = req.user;
      const permittedStages = getPermittedStagesForUser(user);

      const counts = {
        hod_pending: 0,
        iqac_pending: 0,
        principal_pending: 0,
        level1: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        returned: 0,
        archived: 0,
        total: 0,
      };

      for (const evt of events) {
        const cat = getEventCategory(evt);
        if (cat === 'returned') {
          counts.returned++;
        } else if (cat === 'rejected') {
          counts.rejected++;
        } else if (cat === 'approved') {
          counts.approved++;
        } else if (cat === 'archived') {
          counts.archived = (counts.archived || 0) + 1;
        } else if (cat === 'pending') {
          counts.pending++;

          let evtState = evt.workflow_state;
          if (typeof evtState === 'string') {
            try {
              evtState = JSON.parse(evtState);
            } catch (_e) {
              evtState = {};
            }
          }
          const currentStage = String(evtState?.currentStage || '').toLowerCase();
          if (currentStage === 'iqac_pending') counts.iqac_pending++;
          else if (currentStage === 'principal_pending') counts.principal_pending++;
          else counts.hod_pending++;
        }
      }

      counts.total =
        counts.pending +
        counts.approved +
        counts.returned +
        counts.rejected +
        (counts.archived || 0);

      const userRole = String(user?.role || '')
        .trim()
        .toLowerCase();
      const isSingleStageUser = Array.isArray(permittedStages) && permittedStages.length === 1;
      const isSuperAdmin =
        !isSingleStageUser &&
        (userRole === 'super_admin' ||
          (Array.isArray(user?.roles) && user.roles.includes('super_admin')) ||
          Boolean(user?.isAdmin || user?.isSuperAdmin || user?.is_admin || user?.is_super_admin));

      const currentYear = new Date().getFullYear();
      const availableFiscalYears = [currentYear + 1, currentYear, currentYear - 1];
      const stages = ['hod_pending', 'iqac_pending', 'principal_pending'];
      const availableBeneficiaryTypes = [
        'All Beneficiary',
        'Faculty',
        'Staff',
        'Department',
        'Centre',
        'Cell',
        'Club',
        'Professional Body',
        'Institution',
      ];

      return res.json({
        success: true,
        moduleKey: 'event',
        stages,
        permittedStages,
        isSuperAdmin,
        availableFiscalYears,
        availableBeneficiaryTypes,
        counts,
        data: {
          moduleKey: 'event',
          stages,
          permittedStages,
          isSuperAdmin,
          availableFiscalYears,
          availableBeneficiaryTypes,
          counts,
        },
      });
    } catch (err) {
      console.error('[eventsController] getWorkflowMeta error:', err);
      return res
        .status(500)
        .json({ error: 'Failed to fetch event workflow metadata', details: err.message });
    }
  },

  async getEventQueue(req, res) {
    try {
      const statusCategoryFilter = String(
        req.query.statusCategory || req.query.workflowStatus || '',
      ).toLowerCase();
      const events = await eventsModel.listAll();

      const allEvents = events.map((evt) => {
        let workflowState = evt.workflow_state;
        if (typeof workflowState === 'string') {
          try {
            workflowState = JSON.parse(workflowState);
          } catch (_e) {
            // ignore parse error
          }
        }
        return {
          ...evt,
          workflow_state: workflowState || {},
        };
      });

      // Filter out pure unsubmitted drafts from workflow queue list
      const stageItems = allEvents.filter((evt) => getEventCategory(evt) !== 'draft');

      let pendingCount = 0;
      let approvedCount = 0;
      let returnedCount = 0;
      let rejectedCount = 0;
      let archivedCount = 0;

      for (const evt of stageItems) {
        const cat = getEventCategory(evt);
        if (cat === 'archived') archivedCount++;
        else if (cat === 'rejected') rejectedCount++;
        else if (cat === 'returned') returnedCount++;
        else if (cat === 'approved') approvedCount++;
        else if (cat === 'pending') pendingCount++;
      }

      const totalCount = stageItems.length;
      const statusCounts = {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        returned: returnedCount,
        rejected: rejectedCount,
        archived: archivedCount,
      };

      let filteredItems = stageItems;
      if (
        statusCategoryFilter &&
        statusCategoryFilter !== 'total' &&
        statusCategoryFilter !== 'all'
      ) {
        filteredItems = stageItems.filter((evt) => {
          const cat = getEventCategory(evt);
          if (statusCategoryFilter === 'pending') return cat === 'pending';
          if (statusCategoryFilter === 'approved') return cat === 'approved';
          if (statusCategoryFilter === 'returned' || statusCategoryFilter === 'return')
            return cat === 'returned';
          if (statusCategoryFilter === 'rejected' || statusCategoryFilter === 'reject')
            return cat === 'rejected';
          if (statusCategoryFilter === 'archived' || statusCategoryFilter === 'archive')
            return cat === 'archived';
          return true;
        });
      }

      const filteredTotal =
        statusCategoryFilter && statusCategoryFilter !== 'total' && statusCategoryFilter !== 'all'
          ? Number(statusCounts[statusCategoryFilter] ?? filteredItems.length)
          : totalCount;

      return res.json({
        success: true,
        data: filteredItems,
        items: filteredItems,
        pagination: {
          total: filteredTotal,
          page: Number(req.query.page || 1),
          limit: Number(req.query.limit || 20),
          statusCounts,
        },
        statusCounts,
        total: filteredTotal,
        totalCount: filteredTotal,
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
      });
    } catch (err) {
      console.error('[eventsController] getEventQueue error:', err);
      return res.status(500).json({ error: 'Failed to fetch event queue', details: err.message });
    }
  },
};

// ─────────────────────────────────────────────────────────
// Helper: transform a DB row into the PublicApiEvent shape
// expected by the event-client.
// ─────────────────────────────────────────────────────────
function parseJsonColumn(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function formatPublicEvent(row) {
  const regSettings = parseJsonColumn(row.registrationSettings || row.registration_settings);
  const accSettings = parseJsonColumn(row.accommodationSettings || row.accommodation_settings);
  const coordinators = parseJsonColumn(row.coordinators);

  // Fee range from fee_rows
  const feeRows = regSettings.fee_rows || regSettings.feeRows || [];
  const allFees = feeRows
    .flatMap((f) => [parseFloat(f.individual) || 0, parseFloat(f.team) || 0])
    .filter((v) => v > 0);
  const minFee = allFees.length ? Math.min(...allFees) : 0;
  const maxFee = allFees.length ? Math.max(...allFees) : 0;

  const explicitFeeSetting =
    regSettings.registrationFeeEnabled !== undefined
      ? Boolean(regSettings.registrationFeeEnabled)
      : regSettings.registration_fee_enabled !== undefined
        ? Boolean(regSettings.registration_fee_enabled)
        : row.registration_fee_enabled !== undefined
          ? Boolean(row.registration_fee_enabled)
          : null;

  const hasRegistrationFee = explicitFeeSetting !== null ? explicitFeeSetting : maxFee > 0;

  const explicitAccSetting =
    accSettings.enabled !== undefined
      ? Boolean(accSettings.enabled)
      : accSettings.accommodationEnabled !== undefined
        ? Boolean(accSettings.accommodationEnabled)
        : row.accommodation_enabled !== undefined
          ? Boolean(row.accommodation_enabled)
          : false;

  const hasAccommodation = explicitAccSetting;

  // Registration close date
  const closesAt = row.ersId
    ? row.ersExtensionEnabled && row.ersExtendedDate
      ? row.ersExtendedDate
      : row.ersLastDate
    : regSettings.closes_at || regSettings.registrationDeadline || regSettings.lastDate || null;

  // Determine status
  const now = new Date();
  let status = 'Open';
  if (closesAt && new Date(closesAt) < now) {
    status = 'Closed';
  } else if (row.startDate && new Date(row.startDate) > now && !closesAt) {
    status = 'Upcoming';
  }

  // Participation type & Team bounds
  const isTeam = row.ersId
    ? Boolean(row.ersTeamEnabled)
    : Boolean(
        regSettings.team_enabled ||
        regSettings.teamEnabled ||
        regSettings.participation_type === 'Team' ||
        regSettings.participationType === 'Team',
      );
  const participation = isTeam ? 'Team' : 'Individual';
  const minTeamSize = row.ersId
    ? row.ersMinTeamSize
    : parseInt(regSettings.min_team_size || regSettings.minTeamSize) || null;
  const maxTeamSize = row.ersId
    ? row.ersMaxTeamSize
    : parseInt(regSettings.max_team_size || regSettings.maxTeamSize) || null;

  // Document requirement
  const documentEnabled = row.ersId
    ? Boolean(row.ersDocumentEnabled)
    : Boolean(
        regSettings.document_enabled ||
        regSettings.document_required ||
        regSettings.documentEnabled,
      );

  const shortlistingRequired = row.ersId
    ? Boolean(row.ersShortlistingRequired)
    : Boolean(
        regSettings.shortlisting_required ||
        regSettings.shortlistingRequired ||
        regSettings.shortlisting_enabled,
      );

  const selectionIntimation = row.ersId
    ? row.ersSelectionIntimation
    : regSettings.selection_intimation || regSettings.selectionIntimation || null;

  return {
    id: String(row.id),
    title: row.title || 'Untitled Event',
    description: row.description || '',
    category: row.category || null,
    categoryCode: null,
    eventType: row.eventType || null,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
    venue: regSettings.venue || null,
    isMultiEvent: Boolean(row.isMultiEvent),
    documentEnabled,
    documentName:
      row.ersDocumentName || regSettings.document_name || regSettings.documentName || null,
    documentType:
      row.ersDocumentType || regSettings.document_type || regSettings.documentType || null,
    documentSize:
      row.ersDocumentSize || regSettings.document_size || regSettings.documentSize || null,
    documentTextFieldEnabled:
      row.ersDocumentTextFieldEnabled !== undefined
        ? Boolean(row.ersDocumentTextFieldEnabled)
        : Boolean(regSettings.document_text_field_enabled || regSettings.documentTextFieldEnabled),
    shortlistingRequired,
    selectionIntimation,
    participation,
    minTeamSize: isTeam ? minTeamSize : null,
    maxTeamSize: isTeam ? maxTeamSize : null,
    hasRegistrationFee,
    feeRange: { min: minFee, max: maxFee },
    hasAccommodation,
    accommodationFee: parseFloat(accSettings.fee) || 0,
    registrationClosesAt: closesAt,
    registrationOpen: status !== 'Closed',
    status,
    coordinators: Array.isArray(coordinators) ? coordinators : [],
    feedbackEnabled: Boolean(row.feedbackEnabled),
    certificateEnabled: Boolean(row.certificateEnabled),
    registeredCount: row.registeredCount || 0,
    fees: minFee || 0,
    _parentId: row.parentId ? String(row.parentId) : null,
  };
}

export default eventsController;
