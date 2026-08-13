import db from '../../../config/connection.js';

// An event is public once its workflow reaches the terminal 'completed' status.
// Casing matters: workflowService writes lowercase statuses (in_progress,
// completed, rejected, archived); 'Draft' is only the pre-submission default of
// the generated column.
const PUBLIC_WORKFLOW_STATUS = 'completed';

// Selects the columns the event site needs. Category is two hops away
// (events -> m_event_type -> m_category) and venue lives on sessions, not events.
const PUBLIC_EVENT_SELECT = `
  SELECT
    e.id,
    e.event_ref_no                             AS refNo,
    e.event_title                              AS title,
    e.description,
    e.start_date                               AS startDate,
    e.end_date                                 AS endDate,
    e.is_multi_event                           AS isMultiEvent,
    e.parent_id                                AS parentId,
    e.feedback_enabled                         AS feedbackEnabled,
    e.certificate_enabled                      AS certificateEnabled,
    et.event_type_name                         AS eventType,
    mc.category_name                           AS category,
    mc.category_code                           AS categoryCode,
    ml.level_name                              AS level,
    s.team_enabled                             AS teamEnabled,
    s.minimum_team_size                        AS minTeamSize,
    s.maximum_team_size                        AS maxTeamSize,
    s.max_participants                         AS maxParticipants,
    s.registration_status                      AS registrationStatus,
    s.eligible_participants                    AS eligibleParticipants,
    s.open_to                                  AS openTo,
    COALESCE(s.extended_date, s.last_date, s.registration_deadline) AS registrationClosesAt,
    acc.id IS NOT NULL                         AS hasAccommodation,
    acc.accommodation_type                     AS accommodationType,
    acc.fee_amount                             AS accommodationFee,
    fees.min_fee                               AS minFee,
    fees.max_fee                               AS maxFee,
    venues.venue_names                         AS venue,
    (SELECT COUNT(*) FROM event_registrations r
      WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
  FROM events e
  LEFT JOIN m_event_type et ON et.id = e.event_type_id
  LEFT JOIN m_category   mc ON mc.id = et.category_id
  LEFT JOIN m_level      ml ON ml.id = e.level_id
  LEFT JOIN event_registration_settings s
         ON s.event_id = e.id AND s.is_deleted = 0
  LEFT JOIN event_accommodation acc
         ON acc.event_id = e.id AND acc.is_deleted = 0 AND acc.is_active = 1
  LEFT JOIN (
    SELECT event_id,
           MIN(NULLIF(LEAST(individual_fee, team_fee), 0)) AS min_fee,
           MAX(GREATEST(individual_fee, team_fee))         AS max_fee
      FROM event_registration_fees
     WHERE is_deleted = 0
     GROUP BY event_id
  ) fees ON fees.event_id = e.id
  LEFT JOIN (
    SELECT es.event_id, GROUP_CONCAT(DISTINCT v.venue_name ORDER BY v.venue_name SEPARATOR ', ') AS venue_names
      FROM event_sessions es
      JOIN m_venue v ON v.id = es.venue_id
     WHERE es.is_deleted = 0
     GROUP BY es.event_id
  ) venues ON venues.event_id = e.id
`;

const PUBLIC_EVENT_WHERE = `
  WHERE e.is_active = 1
    AND e.is_deleted = 0
    AND e.workflow_status = ?
`;

const publicEventsModel = {
  async listPublicEvents() {
    const [rows] = await db.query(
      `${PUBLIC_EVENT_SELECT} ${PUBLIC_EVENT_WHERE} ORDER BY e.start_date IS NULL, e.start_date ASC, e.id DESC`,
      [PUBLIC_WORKFLOW_STATUS],
    );

    return rows;
  },

  async findPublicEventById(eventId) {
    const [rows] = await db.query(
      `${PUBLIC_EVENT_SELECT} ${PUBLIC_EVENT_WHERE} AND e.id = ? LIMIT 1`,
      [PUBLIC_WORKFLOW_STATUS, eventId],
    );

    return rows[0] ?? null;
  },

  // Fee rows are per participant type, so the exact fee is only knowable once we
  // know who is asking. The list endpoint exposes the range instead.
  async listEventFees(eventId) {
    const [rows] = await db.query(
      `SELECT f.id,
              f.participant_type_id  AS participantTypeId,
              pt.participant_type    AS participantType,
              f.individual_fee       AS individualFee,
              f.team_fee             AS teamFee,
              f.member_fee           AS memberFee,
              f.additional_member_fee AS additionalMemberFee
         FROM event_registration_fees f
         LEFT JOIN m_participant_type pt ON pt.id = f.participant_type_id
        WHERE f.event_id = ? AND f.is_deleted = 0`,
      [eventId],
    );

    return rows;
  },

  async listAccommodationRoomTypes(eventId) {
    const [rows] = await db.query(
      `SELECT id,
              room_type       AS roomType,
              price_per_night AS pricePerNight,
              max_occupants   AS maxOccupants,
              total_rooms     AS totalRooms
         FROM event_accommodation_room_types
        WHERE event_id = ? AND is_active = 1 AND is_deleted = 0
        ORDER BY display_order ASC, room_type ASC`,
      [eventId],
    );

    return rows;
  },

  async listSubEvents(parentEventId) {
    const [rows] = await db.query(
      `${PUBLIC_EVENT_SELECT} ${PUBLIC_EVENT_WHERE} AND e.parent_id = ? ORDER BY e.event_title ASC`,
      [PUBLIC_WORKFLOW_STATUS, parentEventId],
    );

    return rows;
  },
};

export default publicEventsModel;
