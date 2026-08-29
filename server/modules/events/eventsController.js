import eventsModel from './eventsModel.js';

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

  // PUT /api/events/:id
  async updateEvent(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const result = await eventsModel.update(Number(id), req.body, userId);
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
      const result = await eventsModel.softDelete(Number(id), userId);
      return res.json(result);
    } catch (err) {
      console.error('[eventsController] deleteEvent error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to delete event', details: err.message });
    }
  },

  // GET /api/events/:id/summary
  async getEventSummary(req, res) {
    try {
      const { id } = req.params;
      const summary = await eventsModel.getSummary(Number(id));
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
      const participants = await eventsModel.getParticipants(Number(id));
      return res.json({ participants });
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
      const result = await eventsModel.updateParticipant(Number(id), Number(pid), req.body);
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
      const userId = req.user?.id;
      const result = await eventsModel.submitFeedback(Number(id), userId, req.body);
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
      const row = await eventsModel.findPublicEventById(Number(id));
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
      const settings = await eventsModel.getRegistrationSettings(Number(id));
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
      const userId = req.user?.id;
      const result = await eventsModel.saveRegistrationSettings(Number(id), req.body, userId);
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
  const closesAt = regSettings.closes_at || regSettings.registrationDeadline || null;

  // Determine status
  const now = new Date();
  let status = 'Open';
  if (closesAt && new Date(closesAt) < now) {
    status = 'Closed';
  } else if (row.startDate && new Date(row.startDate) > now && !closesAt) {
    status = 'Upcoming';
  }

  // Participation type
  const participation =
    regSettings.participation_type || regSettings.participationType || 'Individual';

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
    documentEnabled: Boolean(regSettings.document_required),
    participation,
    minTeamSize: parseInt(regSettings.min_team_size || regSettings.minTeamSize) || null,
    maxTeamSize: parseInt(regSettings.max_team_size || regSettings.maxTeamSize) || null,
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
