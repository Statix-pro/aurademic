import eventDb from '../../../config/connection.js';

// Staff-facing registration list used by the Participants tab. Public event
// accounts are stored in event_participants (rather than users), so the legacy
// participants table cannot be used for registrations made on the event site.
export const getEventParticipants = async (req, res) => {
  const eventId = Number(req.params.id);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'A valid event id is required.' });
  }

  try {
    const [participants] = await eventDb.query(
      `SELECT
         r.id,
         COALESCE(NULLIF(CONCAT_WS(' ', profile.first_name, profile.last_name), ''), p.name, p.email) AS name,
         COALESCE(profile.institution, '') AS institution,
         COALESCE(profile.profession_type, 'Participant') AS category,
         CASE WHEN r.review_status = 'Pending' THEN 'Registered' ELSE r.review_status END AS status,
         EXISTS(SELECT 1 FROM event_registration_team_members tm
                 WHERE tm.registration_id = r.id AND tm.is_deleted = 0) AS hasTeam,
         EXISTS(SELECT 1 FROM event_registration_documents rd
                 WHERE rd.registration_id = r.id AND rd.is_deleted = 0) AS hasDoc,
         (SELECT rd.file_path FROM event_registration_documents rd
           WHERE rd.registration_id = r.id AND rd.is_deleted = 0
           ORDER BY rd.created_at DESC LIMIT 1) AS documentUrl,
         COALESCE(acc.accommodation_required, 0) AS accommodation_required,
         COALESCE(acc.hostel_status, 'Pending') AS hostel,
         COALESCE((SELECT SUM(pay.amount) FROM event_payments pay
                   WHERE pay.registration_id = r.id AND pay.is_deleted = 0
                     AND pay.bill_type = 'Registration'), 0) AS fees,
         COALESCE((SELECT pay.payment_status FROM event_payments pay
                   WHERE pay.registration_id = r.id AND pay.is_deleted = 0
                     AND pay.bill_type = 'Registration'
                   ORDER BY pay.created_at DESC LIMIT 1), 'Pending') AS fee_status
       FROM event_registrations r
       JOIN event_participants p ON p.id = r.participant_id
       LEFT JOIN event_participant_profiles profile ON profile.participant_id = p.id
       LEFT JOIN event_registration_accommodation acc
         ON acc.registration_id = r.id AND acc.is_deleted = 0
       WHERE r.event_id = ? AND r.is_deleted = 0 AND r.is_cancelled = 0
       ORDER BY r.created_at DESC`,
      [eventId],
    );

    // A newly completed public registration must be visible to staff immediately.
    // Do not let a browser/proxy reuse an earlier error or empty participant list.
    res.set('Cache-Control', 'no-store').json({ participants });
  } catch (err) {
    console.error('Failed to load event participants:', err);
    res.status(500).json({ error: 'Unable to load event participants.' });
  }
};

// Helper query function (pool-level, no transaction)
async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

async function syncDocumentUploadSetting(conn, eventId, settings) {
  await conn.query(
    'UPDATE event_document_upload SET is_active = 0, is_deleted = 1, deleted_at = NOW() WHERE event_id = ? AND is_deleted = 0',
    [eventId],
  );
  if (!settings?.enabled) return;

  const documentName = settings.documentName || settings.documentType;
  if (!documentName) return;

  const [types] = await conn.query(
    'SELECT id FROM m_document_type WHERE document_name = ? AND is_active = 1 AND is_deleted = 0 LIMIT 1',
    [documentName],
  );
  if (!types[0]) return;

  await conn.query(
    'INSERT INTO event_document_upload (event_id, document_type_id, is_required, is_active, is_deleted, created_at, updated_at) VALUES (?, ?, 1, 1, 0, NOW(), NOW())',
    [eventId, types[0].id],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Get all events — shaped for the Admin Event Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export const getEvents = async (req, res) => {
  try {
    const events = await query(
      `SELECT
         e.id,
         e.event_title                                                   AS title,
         e.workflow_status                                               AS status,
         e.start_date                                                    AS date,
         e.created_at                                                    AS createdAt,
         e.updated_at                                                    AS updatedAt,
         e.parent_id,
         e.is_multi_event                                                AS isMultiEvent,
         COALESCE(et.event_type_name, '')                               AS category,
         COALESCE(ml.level_name, '')                                    AS level,
         (SELECT GROUP_CONCAT(DISTINCT mv.venue_name ORDER BY mv.venue_name SEPARATOR ', ')
            FROM event_sessions es
            JOIN m_venue mv ON mv.id = es.venue_id
           WHERE es.event_id = e.id AND es.is_deleted = 0)              AS venue,
         (SELECT CONCAT(me.first_name, ' ', me.last_name)
            FROM event_coordinators ec
            JOIN master_employees me ON me.id = ec.employee_id
           WHERE ec.event_id = e.id
           ORDER BY ec.id ASC LIMIT 1)                                  AS proposedBy,
         (SELECT COALESCE(
             (SELECT md.name
                FROM event_hosts eh2
                JOIN master_departments md ON md.id = eh2.department_id
               WHERE eh2.event_id = e.id AND eh2.entity_type = 'DEPARTMENT'
               LIMIT 1),
             (SELECT me2.name
                FROM event_hosts eh3
                JOIN master_entities me2 ON me2.id = eh3.entity_id
               WHERE eh3.event_id = e.id AND eh3.entity_type = 'ENTITY'
               LIMIT 1),
             ''
           ))                                                             AS department
       FROM events e
       LEFT JOIN m_event_type et ON et.id = e.event_type_id
       LEFT JOIN m_level      ml ON ml.id = e.level_id
       WHERE e.is_deleted = 0
       ORDER BY e.created_at DESC`,
    );

    // Separate main events and sub-events, nest sub-events under parent
    const mainEvents = events.filter((e) => !e.parent_id);
    const subEvents = events.filter((e) => e.parent_id);

    mainEvents.forEach((main) => {
      main.sub_events = subEvents.filter((sub) => sub.parent_id === main.id);
    });

    res.status(200).json(mainEvents);
  } catch (err) {
    console.error('❌ getEvents error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Get single event (full row)
// ─────────────────────────────────────────────────────────────────────────────
export const getEventById = async (req, res) => {
  const { id } = req.params;
  try {
    const [event] = await query('SELECT * FROM events WHERE id = ? AND is_deleted = 0', [id]);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Get event summary for EventPage tab
// ─────────────────────────────────────────────────────────────────────────────
export const getEventSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const [event] = await query(
      `SELECT id, event_title AS title, workflow_status AS status,
              created_at AS createdAt, updated_at AS updatedAt, start_date AS date
         FROM events
        WHERE id = ? AND is_deleted = 0`,
      [id],
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Create new event — full transactional persistence
//
//  Accepts the rich payload that PreEvent.tsx sends:
//    title, description, category, event_type (array|string), level,
//    start_date, end_date, mode, meeting_link, venue,
//    parent_id, is_multi_event,
//    feedbackEnabled, certificateEnabled,
//    registrationSettings { eligibleParticipants, openTo, genderRestriction,
//      minAge, maxAge, registrationStatus, lastDate, extendedDate,
//      shortlistingRequired, selectionIntimation, teamEnabled,
//      minTeamSize, maxTeamSize, extension },
//    coordinators [ { name, email, department, institution, employee_id? } ],
//    hosts        [ { entity_type, department_id, entity_id } ],
//    accommodation { enabled, type, gentsLimit, ladiesLimit, feeAmount },
//    feeRows      [ { individual, team, member, additionalMember,
//                     participant_type_id? } ],
//    sessions     [ { session_title, description, session_date, start_time,
//                     end_time, venue_id, max_capacity } ]
// ─────────────────────────────────────────────────────────────────────────────
export const createEvent = async (req, res) => {
  const {
    title,
    description = null,
    // category is a name — we resolve it to event_type_id via m_event_type.
    // The frontend sends both `category` (category name) and `event_type` (type names array).
    category,
    event_type,
    level,
    start_date,
    end_date,
    mode,
    meeting_link = null,
    venue, // venue name string (for reference, sessions carry venue_id)
    parent_id = null,
    is_multi_event = false,
    feedbackEnabled = true,
    certificateEnabled = true,
    // Social links
    facebook_link = null,
    x_link = null,
    instagram_link = null,
    linkedin_link = null,
    // Related sub-objects
    registrationSettings = null,
    documentSettings = null,
    coordinators = [],
    hosts = [],
    accommodation = null,
    feeRows = [],
    sessions = [],
  } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Event title is required' });
  }

  const conn = await eventDb.getConnection();

  try {
    await conn.beginTransaction();

    if (parent_id) {
      const [parentRows] = await conn.query(
        'SELECT id FROM events WHERE id = ? AND parent_id IS NULL AND is_multi_event = 1 AND is_deleted = 0 LIMIT 1',
        [parent_id],
      );
      if (!parentRows[0]) {
        await conn.rollback();
        return res.status(400).json({
          error: 'Sub events can only be created under a Main Event with Multi-Event enabled.',
        });
      }
    }

    // ── 1. Resolve event_type_id ─────────────────────────────────────────────
    let eventTypeId = null;
    const typeNames = Array.isArray(event_type) ? event_type : event_type ? [event_type] : [];
    if (typeNames.length > 0) {
      // Pick the first recognised event type
      const [typeRow] = await conn.query(
        `SELECT id FROM m_event_type WHERE event_type_name = ? LIMIT 1`,
        [typeNames[0]],
      );
      if (typeRow && typeRow[0]) {
        eventTypeId = typeRow[0].id;
      } else {
        // Try to find by category name if the payload uses category as type
        const [byCategory] = await conn.query(
          `SELECT et.id FROM m_event_type et
             JOIN m_category mc ON mc.id = et.category_id
            WHERE mc.category_name = ? LIMIT 1`,
          [category || typeNames[0]],
        );
        if (byCategory && byCategory[0]) eventTypeId = byCategory[0].id;
      }
    }

    // ── 2. Resolve level_id ──────────────────────────────────────────────────
    let levelId = null;
    if (level) {
      const [levelRow] = await conn.query(`SELECT id FROM m_level WHERE level_name = ? LIMIT 1`, [
        level,
      ]);
      if (levelRow && levelRow[0]) levelId = levelRow[0].id;
    }

    // ── 3. Build initial workflow_state (Draft) ───────────────────────────────
    const workflowState = JSON.stringify({ status: 'Draft', currentStage: '' });

    // ── 4. Insert main event row ──────────────────────────────────────────────
    const [insertResult] = await conn.query(
      `INSERT INTO events
         (event_title, description, event_type_id, level_id,
          start_date, end_date,
          feedback_enabled, certificate_enabled,
          facebook_link, x_link, instagram_link, linkedin_link,
          parent_id, is_multi_event, workflow_state,
          is_active, is_deleted, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, NOW(), NOW())`,
      [
        title,
        description,
        eventTypeId,
        levelId,
        start_date || null,
        end_date || null,
        feedbackEnabled ? 1 : 0,
        certificateEnabled ? 1 : 0,
        facebook_link,
        x_link,
        instagram_link,
        linkedin_link,
        parent_id || null,
        is_multi_event ? 1 : 0,
        workflowState,
      ],
    );

    const eventId = insertResult.insertId;

    // ── 5. Registration settings ──────────────────────────────────────────────
    if (registrationSettings && registrationSettings.enabled !== false) {
      const rs = registrationSettings;
      await conn.query(
        `INSERT INTO event_registration_settings
           (event_id, eligible_participants, open_to, gender_restriction,
            min_age, max_age, registration_status, last_date,
            extension_required, extended_date,
            shortlisting_required, selection_intimation_date,
            team_enabled, minimum_team_size, maximum_team_size,
            is_active, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
        [
          eventId,
          rs.eligibleParticipants || null,
          rs.openTo || 'Any',
          rs.genderRestriction || 'Any',
          rs.minAge || null,
          rs.maxAge || null,
          rs.registrationStatus || 'Ongoing',
          rs.lastDate || null,
          rs.extension ? 1 : 0,
          rs.extendedDate || null,
          rs.shortlistingRequired ? 1 : 0,
          rs.selectionIntimation || null,
          rs.teamEnabled ? 1 : 0,
          rs.minTeamSize || null,
          rs.maxTeamSize || null,
        ],
      );
    }

    // ── 6. Coordinators ──────────────────────────────────────────────────────
    await syncDocumentUploadSetting(conn, eventId, documentSettings);

    //  The payload may carry employee_id directly (admin flow) or just a name.
    //  We only insert rows we can FK into master_employees; others are skipped.
    if (Array.isArray(coordinators) && coordinators.length > 0) {
      for (const coord of coordinators) {
        let employeeId = coord.employee_id || null;

        if (!employeeId && (coord.name || coord.email)) {
          // Try to resolve by email or name
          const lookup = coord.email
            ? `SELECT id FROM master_employees WHERE email = ? LIMIT 1`
            : `SELECT id FROM master_employees WHERE CONCAT(first_name,' ',last_name) = ? LIMIT 1`;
          const lookupParam = coord.email || coord.name;
          const [empRow] = await conn.query(lookup, [lookupParam]);
          if (empRow && empRow[0]) employeeId = empRow[0].id;
        }

        if (employeeId) {
          await conn.query(
            `INSERT IGNORE INTO event_coordinators (event_id, employee_id, role, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [eventId, employeeId, coord.role || 'Coordinator'],
          );
        }
      }
    }

    // ── 7. Hosts ─────────────────────────────────────────────────────────────
    if (Array.isArray(hosts) && hosts.length > 0) {
      for (const host of hosts) {
        if (!host.entity_type) continue;
        if (host.entity_type === 'DEPARTMENT' && host.department_id) {
          await conn.query(
            `INSERT INTO event_hosts (event_id, entity_type, department_id, entity_id, created_at)
             VALUES (?, 'DEPARTMENT', ?, NULL, NOW())`,
            [eventId, host.department_id],
          );
        } else if (host.entity_type === 'ENTITY' && host.entity_id) {
          await conn.query(
            `INSERT INTO event_hosts (event_id, entity_type, department_id, entity_id, created_at)
             VALUES (?, 'ENTITY', NULL, ?, NOW())`,
            [eventId, host.entity_id],
          );
        }
      }
    }

    // ── 8. Accommodation ──────────────────────────────────────────────────────
    if (accommodation && accommodation.enabled !== false) {
      const acc = accommodation;
      await conn.query(
        `INSERT INTO event_accommodation
           (event_id, accommodation_type, gents_limit, ladies_limit, fee_amount,
            is_active, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
        [
          eventId,
          acc.type || 'Free',
          acc.gentsLimit || 0,
          acc.ladiesLimit || 0,
          acc.feeAmount || 0,
        ],
      );
    }

    // ── 9. Registration fees (feeRows) ────────────────────────────────────────
    if (Array.isArray(feeRows) && feeRows.length > 0) {
      for (const fee of feeRows) {
        // Skip rows that are entirely zero / empty
        const individualFee = parseFloat(fee.individual || fee.individual_fee) || 0;
        const teamFee = parseFloat(fee.team || fee.team_fee) || 0;
        const memberFee = parseFloat(fee.member || fee.member_fee) || 0;
        const additionalFee = parseFloat(fee.additionalMember || fee.additional_member_fee) || 0;

        if (individualFee === 0 && teamFee === 0 && memberFee === 0 && additionalFee === 0)
          continue;

        await conn.query(
          `INSERT INTO event_registration_fees
             (event_id, participant_type_id, individual_fee, team_fee, member_fee,
              additional_member_fee, is_active, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
          [
            eventId,
            fee.participant_type_id || null,
            individualFee,
            teamFee,
            memberFee,
            additionalFee,
          ],
        );
      }
    }

    // ── 10. Sessions ──────────────────────────────────────────────────────────
    if (Array.isArray(sessions) && sessions.length > 0) {
      for (const session of sessions) {
        if (!session.session_title && !session.title) continue;
        await conn.query(
          `INSERT INTO event_sessions
             (event_id, session_title, description, session_date,
              start_time, end_time, venue_id, max_capacity,
              is_active, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
          [
            eventId,
            session.session_title || session.title,
            session.description || null,
            session.session_date || session.date || null,
            session.start_time || null,
            session.end_time || null,
            session.venue_id || null,
            session.max_capacity || null,
          ],
        );
      }
    }

    await conn.commit();

    // ── 11. Return the created event shaped for the dashboard ─────────────────
    const [created] = await query(
      `SELECT
         e.id,
         e.event_title    AS title,
         e.workflow_status AS status,
         e.start_date     AS date,
         e.created_at     AS createdAt,
         e.updated_at     AS updatedAt,
         e.parent_id,
         e.is_multi_event AS isMultiEvent,
         COALESCE(et.event_type_name, '') AS category
       FROM events e
       LEFT JOIN m_event_type et ON et.id = e.event_type_id
      WHERE e.id = ?`,
      [eventId],
    );

    return res.status(201).json(created || { id: eventId });
  } catch (err) {
    await conn.rollback();
    console.error('❌ createEvent transaction rolled back:', err);
    res.status(500).json({
      error: err.message,
      details: 'Event creation failed. All changes have been rolled back.',
    });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Update event title (lightweight — for simple edits)
// ─────────────────────────────────────────────────────────────────────────────
export const updateEvent = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description = null,
    category,
    event_type,
    level,
    start_date,
    end_date,
    feedbackEnabled,
    certificateEnabled,
    parent_id = null,
    is_multi_event = false,
    registrationSettings = null,
    documentSettings = null,
    accommodation = null,
    feeRows = [],
    registration_fee_enabled = false,
  } = req.body;

  const conn = await eventDb.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Resolve event_type_id
    let eventTypeId = null;
    const typeNames = Array.isArray(event_type) ? event_type : event_type ? [event_type] : [];
    if (typeNames.length > 0) {
      const [typeRow] = await conn.query(
        `SELECT id FROM m_event_type WHERE event_type_name = ? LIMIT 1`,
        [typeNames[0]],
      );
      if (typeRow && typeRow[0]) {
        eventTypeId = typeRow[0].id;
      } else {
        const [byCategory] = await conn.query(
          `SELECT et.id FROM m_event_type et
             JOIN m_category mc ON mc.id = et.category_id
            WHERE mc.category_name = ? LIMIT 1`,
          [category || typeNames[0]],
        );
        if (byCategory && byCategory[0]) eventTypeId = byCategory[0].id;
      }
    }

    // 2. Resolve level_id
    let levelId = null;
    if (level) {
      const [levelRow] = await conn.query(`SELECT id FROM m_level WHERE level_name = ? LIMIT 1`, [
        level,
      ]);
      if (levelRow && levelRow[0]) levelId = levelRow[0].id;
    }

    // 3. Update main event record
    await conn.query(
      `UPDATE events 
       SET event_title = ?, description = ?, 
           event_type_id = COALESCE(?, event_type_id),
           level_id = COALESCE(?, level_id),
           start_date = ?, end_date = ?, 
           feedback_enabled = ?, certificate_enabled = ?, 
           parent_id = ?, is_multi_event = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [
        title,
        description,
        eventTypeId,
        levelId,
        start_date || null,
        end_date || null,
        feedbackEnabled ? 1 : 0,
        certificateEnabled ? 1 : 0,
        parent_id || null,
        is_multi_event ? 1 : 0,
        id,
      ],
    );

    // 4. Update Registration Settings
    if (registrationSettings && registrationSettings.enabled !== false) {
      const rs = registrationSettings;
      const [existingSettings] = await conn.query(
        `SELECT id FROM event_registration_settings WHERE event_id = ? AND is_deleted = 0 LIMIT 1`,
        [id],
      );

      if (existingSettings && existingSettings[0]) {
        await conn.query(
          `UPDATE event_registration_settings
           SET eligible_participants = ?, open_to = ?, gender_restriction = ?,
               min_age = ?, max_age = ?, registration_status = ?, last_date = ?,
               extension_required = ?, extended_date = ?,
               shortlisting_required = ?, selection_intimation_date = ?,
               team_enabled = ?, minimum_team_size = ?, maximum_team_size = ?,
               is_active = 1, updated_at = NOW()
           WHERE id = ?`,
          [
            rs.eligibleParticipants || null,
            rs.openTo || 'Any',
            rs.genderRestriction || 'Any',
            rs.minAge || null,
            rs.maxAge || null,
            rs.registrationStatus || 'Ongoing',
            rs.lastDate || null,
            rs.extension ? 1 : 0,
            rs.extendedDate || null,
            rs.shortlistingRequired ? 1 : 0,
            rs.selectionIntimation || null,
            rs.teamEnabled ? 1 : 0,
            rs.minTeamSize || null,
            rs.maxTeamSize || null,
            existingSettings[0].id,
          ],
        );
      } else {
        await conn.query(
          `INSERT INTO event_registration_settings
             (event_id, eligible_participants, open_to, gender_restriction,
              min_age, max_age, registration_status, last_date,
              extension_required, extended_date,
              shortlisting_required, selection_intimation_date,
              team_enabled, minimum_team_size, maximum_team_size,
              is_active, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
          [
            id,
            rs.eligibleParticipants || null,
            rs.openTo || 'Any',
            rs.genderRestriction || 'Any',
            rs.minAge || null,
            rs.maxAge || null,
            rs.registrationStatus || 'Ongoing',
            rs.lastDate || null,
            rs.extension ? 1 : 0,
            rs.extendedDate || null,
            rs.shortlistingRequired ? 1 : 0,
            rs.selectionIntimation || null,
            rs.teamEnabled ? 1 : 0,
            rs.minTeamSize || null,
            rs.maxTeamSize || null,
          ],
        );
      }
    } else {
      await conn.query(
        `UPDATE event_registration_settings
         SET is_active = 0, is_deleted = 1, deleted_at = NOW()
         WHERE event_id = ? AND is_deleted = 0`,
        [id],
      );
    }

    await syncDocumentUploadSetting(conn, id, documentSettings);

    // 5. Update Accommodation
    if (accommodation && accommodation.enabled !== false) {
      const acc = accommodation;
      const [existingAcc] = await conn.query(
        `SELECT id FROM event_accommodation WHERE event_id = ? AND is_deleted = 0 LIMIT 1`,
        [id],
      );

      if (existingAcc && existingAcc[0]) {
        await conn.query(
          `UPDATE event_accommodation
           SET accommodation_type = ?, gents_limit = ?, ladies_limit = ?, fee_amount = ?,
               is_active = 1, updated_at = NOW()
           WHERE id = ?`,
          [
            acc.type || 'Free',
            acc.gentsLimit || 0,
            acc.ladiesLimit || 0,
            acc.feeAmount || 0,
            existingAcc[0].id,
          ],
        );
      } else {
        await conn.query(
          `INSERT INTO event_accommodation
             (event_id, accommodation_type, gents_limit, ladies_limit, fee_amount,
              is_active, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
          [id, acc.type || 'Free', acc.gentsLimit || 0, acc.ladiesLimit || 0, acc.feeAmount || 0],
        );
      }
    } else {
      await conn.query(
        `UPDATE event_accommodation
         SET is_active = 0, is_deleted = 1, deleted_at = NOW()
         WHERE event_id = ? AND is_deleted = 0`,
        [id],
      );
    }

    // 6. Update Registration Fees
    await conn.query(`DELETE FROM event_registration_fees WHERE event_id = ?`, [id]);

    if (registration_fee_enabled !== false && Array.isArray(feeRows) && feeRows.length > 0) {
      for (const fee of feeRows) {
        const individualFee = parseFloat(fee.individual || fee.individual_fee) || 0;
        const teamFee = parseFloat(fee.team || fee.team_fee) || 0;
        const memberFee = parseFloat(fee.member || fee.member_fee) || 0;
        const additionalFee = parseFloat(fee.additionalMember || fee.additional_member_fee) || 0;

        if (individualFee === 0 && teamFee === 0 && memberFee === 0 && additionalFee === 0)
          continue;

        await conn.query(
          `INSERT INTO event_registration_fees
             (event_id, participant_type_id, individual_fee, team_fee, member_fee,
              additional_member_fee, is_active, is_deleted, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
          [
            id,
            fee.participant_type_id || fee.participantTypeId || null,
            individualFee,
            teamFee,
            memberFee,
            additionalFee,
          ],
        );
      }
    }

    await conn.commit();
    const [updated] = await query('SELECT * FROM events WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    await conn.rollback();
    console.error('❌ updateEvent error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 Delete event (soft delete)
// ─────────────────────────────────────────────────────────────────────────────
export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      'UPDATE events SET is_deleted = 1, deleted_at = NOW(), is_active = 0 WHERE id = ? AND is_deleted = 0',
      [id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
