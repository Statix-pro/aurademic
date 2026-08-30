import eventsModel from './eventsModel.js';
import { searchApplicant } from '../shared/budget/userResolvers.js';

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
      for (const sub of orphans) {
        const parent = parentMap.get(sub._parentId);
        if (parent) {
          parent.subEvents.push(sub);
        }
      }

      // Clean internal fields
      const events = [...parentMap.values()].map((ev) => {
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
  const regSettings = parseJsonColumn(row.registrationSettings);
  const accSettings = parseJsonColumn(row.accommodationSettings);
  const coordinators = parseJsonColumn(row.coordinators);

  // Fee range from fee_rows
  const feeRows = regSettings.fee_rows || [];
  const allFees = feeRows
    .flatMap((f) => [parseFloat(f.individual) || 0, parseFloat(f.team) || 0])
    .filter((v) => v > 0);
  const minFee = allFees.length ? Math.min(...allFees) : 0;
  const maxFee = allFees.length ? Math.max(...allFees) : 0;

  // Registration close date
  const closesAt = row.ersId
    ? row.ersExtensionEnabled && row.ersExtendedDate
      ? row.ersExtendedDate
      : row.ersLastDate
    : regSettings.closes_at || regSettings.registrationDeadline || null;

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
    documentName: row.ersDocumentName || regSettings.document_name || null,
    documentType: row.ersDocumentType || regSettings.document_type || null,
    documentSize: row.ersDocumentSize || regSettings.document_size || null,
    participation,
    minTeamSize: isTeam ? minTeamSize : null,
    maxTeamSize: isTeam ? maxTeamSize : null,
    hasRegistrationFee: maxFee > 0,
    feeRange: { min: minFee, max: maxFee },
    hasAccommodation: Boolean(accSettings.enabled),
    accommodationFee: parseFloat(accSettings.fee) || 0,
    registrationClosesAt: closesAt,
    registrationOpen: status !== 'Closed',
    status,
    coordinators: Array.isArray(coordinators) ? coordinators : [],
    feedbackEnabled: Boolean(row.feedbackEnabled),
    certificateEnabled: Boolean(row.certificateEnabled),
    registeredCount: row.registeredCount || 0,
    _parentId: row.parentId || null,
  };
}

export default eventsController;
