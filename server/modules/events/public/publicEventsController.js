import publicEventsModel from './publicEventsModel.js';

const OPEN_REGISTRATION_STATUSES = new Set(['Ongoing', 'Extended']);

const toBool = (value) => Boolean(Number(value));

// Shapes a DB row into the contract the event site consumes.
const presentEvent = (row) => {
  const closesAt = row.registrationClosesAt ? new Date(row.registrationClosesAt) : null;
  const deadlinePassed = closesAt ? closesAt.getTime() < Date.now() : false;
  const capacityReached =
    row.maxParticipants != null && Number(row.registeredCount) >= Number(row.maxParticipants);

  const registrationOpen =
    OPEN_REGISTRATION_STATUSES.has(row.registrationStatus) && !deadlinePassed && !capacityReached;

  const minFee = row.minFee == null ? 0 : Number(row.minFee);
  const maxFee = row.maxFee == null ? 0 : Number(row.maxFee);

  return {
    id: String(row.id),
    refNo: row.refNo,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? row.eventType ?? null,
    categoryCode: row.categoryCode ?? null,
    eventType: row.eventType ?? null,
    level: row.level ?? null,
    startDate: row.startDate,
    endDate: row.endDate,
    venue: row.venue ?? null,
    isMultiEvent: toBool(row.isMultiEvent),
    parentId: row.parentId ? String(row.parentId) : null,

    participation: toBool(row.teamEnabled) ? 'Team' : 'Individual',
    minTeamSize: row.minTeamSize,
    maxTeamSize: row.maxTeamSize,

    // A range, not a single number: fees vary by participant type and a visitor
    // browsing events has no type yet.
    hasRegistrationFee: maxFee > 0,
    feeRange: { min: minFee, max: maxFee },

    hasAccommodation: toBool(row.hasAccommodation),
    accommodationType: row.accommodationType ?? null,
    accommodationFee: row.accommodationFee == null ? 0 : Number(row.accommodationFee),

    registrationStatus: row.registrationStatus ?? null,
    registrationClosesAt: row.registrationClosesAt,
    registrationOpen,
    status: registrationOpen ? 'Open' : 'Closed',
    capacityReached,
    maxParticipants: row.maxParticipants,
    registeredCount: Number(row.registeredCount ?? 0),

    eligibleParticipants: row.eligibleParticipants ?? null,
    openTo: row.openTo ?? 'Any',
    feedbackEnabled: toBool(row.feedbackEnabled),
    certificateEnabled: toBool(row.certificateEnabled),
  };
};

const publicEventsController = {
  async listEvents(req, res) {
    try {
      const rows = await publicEventsModel.listPublicEvents();
      const events = rows.map(presentEvent);

      // Nest sub-events under their parent so the site renders multi-events as
      // one card, matching how admins model them via parent_id.
      const byId = new Map(events.map((event) => [event.id, { ...event, subEvents: [] }]));
      const roots = [];

      // fk_events_parent permits parent_id = id, and nothing forbids a two-row
      // cycle. Nesting one of those would build a self-referencing object, and
      // res.json's JSON.stringify throws on it — turning one bad row into a 500
      // for the whole public catalogue. Treat any event that cannot reach a root
      // by walking parents as a root itself.
      const nestsUnderARoot = (event) => {
        const seen = new Set([event.id]);
        let parentId = event.parentId;

        while (parentId && byId.has(parentId)) {
          if (seen.has(parentId)) return false;
          seen.add(parentId);
          parentId = byId.get(parentId).parentId;
        }

        return true;
      };

      for (const event of byId.values()) {
        if (event.parentId && byId.has(event.parentId) && nestsUnderARoot(event)) {
          byId.get(event.parentId).subEvents.push(event);
        } else {
          roots.push(event);
        }
      }

      return res.json({ success: true, data: { events: roots } });
    } catch (error) {
      console.error('Failed to list public events:', error);
      return res.status(500).json({ success: false, message: 'Could not load events' });
    }
  },

  async getEvent(req, res) {
    try {
      const eventId = Number(req.params.id);

      if (!Number.isInteger(eventId) || eventId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid event id' });
      }

      const row = await publicEventsModel.findPublicEventById(eventId);

      if (!row) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      const [fees, roomTypes, subEvents] = await Promise.all([
        publicEventsModel.listEventFees(eventId),
        publicEventsModel.listAccommodationRoomTypes(eventId),
        publicEventsModel.listSubEvents(eventId),
      ]);

      return res.json({
        success: true,
        data: {
          event: {
            ...presentEvent(row),
            fees,
            accommodationRoomTypes: roomTypes,
            subEvents: subEvents.map(presentEvent),
          },
        },
      });
    } catch (error) {
      console.error('Failed to load public event:', error);
      return res.status(500).json({ success: false, message: 'Could not load event' });
    }
  },
};

export default publicEventsController;
