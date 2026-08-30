import db from '../../config/connection.js';

let isErsTableChecked = false;
async function ensureErsTable() {
  if (isErsTableChecked) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_registration_settings\` (
        \`id\`                          int          NOT NULL AUTO_INCREMENT,
        \`event_id\`                    int          NOT NULL,
        \`enabled\`                     tinyint(1)   NOT NULL DEFAULT '0',
        \`eligible_participants\`       varchar(255) DEFAULT NULL,
        \`open_to\`                     varchar(50)  NOT NULL DEFAULT 'Any',
        \`gender_restriction\`          varchar(50)  NOT NULL DEFAULT 'Any',
        \`min_age\`                     int          DEFAULT NULL,
        \`max_age\`                     int          DEFAULT NULL,
        \`registration_status\`         varchar(50)  NOT NULL DEFAULT 'Open',
        \`last_date\`                   datetime     DEFAULT NULL,
        \`extension_enabled\`           tinyint(1)   NOT NULL DEFAULT '0',
        \`extended_date\`               datetime     DEFAULT NULL,
        \`shortlisting_required\`       tinyint(1)   NOT NULL DEFAULT '0',
        \`selection_intimation\`        varchar(255) DEFAULT NULL,
        \`team_enabled\`                tinyint(1)   NOT NULL DEFAULT '0',
        \`min_team_size\`               int          DEFAULT NULL,
        \`max_team_size\`               int          DEFAULT NULL,
        \`document_enabled\`            tinyint(1)   NOT NULL DEFAULT '0',
        \`document_name\`               varchar(255) DEFAULT NULL,
        \`document_type\`               varchar(100) DEFAULT NULL,
        \`document_size\`               varchar(50)  DEFAULT NULL,
        \`document_text_field_enabled\` tinyint(1)   NOT NULL DEFAULT '0',
        \`created_by\`                  int          DEFAULT NULL,
        \`updated_by\`                  int          DEFAULT NULL,
        \`created_at\`                  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\`                  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_ers_event\` (\`event_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    isErsTableChecked = true;
  } catch (err) {
    console.warn('[eventsModel] ensureErsTable warning:', err.message);
  }
}

const eventsModel = {
  // ─────────────────────────────────────────────────────────
  // LIST – GET /events
  // Returns all non-deleted top-level events with their
  // sub-events nested under a `sub_events` array.
  // ─────────────────────────────────────────────────────────
  async listAll() {
    const [rows] = await db.query(
      `SELECT
         e.id,
         e.event_title   AS title,
         e.category_name AS category,
         e.event_type_name AS eventType,
         e.level_name    AS level,
         e.start_date    AS date,
         e.end_date,
         e.workflow_status AS status,
         e.is_multi_event  AS isMultiEvent,
         e.parent_id,
         e.created_at    AS createdAt,
         e.updated_at    AS updatedAt,
         e.registration_settings,
         COALESCE(u.name, u.email, 'N/A') AS proposedBy,
         COALESCE(
           JSON_UNQUOTE(JSON_EXTRACT(e.registration_settings, '$.venue')),
           'TBD'
         )               AS venue
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.is_deleted = 0
         AND e.is_active  = 1
       ORDER BY e.created_at DESC`,
    );

    // Nest sub-events under their parent
    const mainMap = new Map();
    const subRows = [];

    for (const row of rows) {
      if (!row.parent_id) {
        mainMap.set(row.id, { ...row, sub_events: [] });
      } else {
        subRows.push(row);
      }
    }

    for (const sub of subRows) {
      const parent = mainMap.get(sub.parent_id);
      if (parent) {
        parent.sub_events.push(sub);
      } else {
        // orphan sub-event – surface it as a standalone entry
        mainMap.set(sub.id, { ...sub, sub_events: [] });
      }
    }

    return [...mainMap.values()];
  },

  // ─────────────────────────────────────────────────────────
  // CREATE – POST /events
  // ─────────────────────────────────────────────────────────
  async create(payload, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const {
        title,
        description = '',
        category,
        event_type,
        level,
        start_date,
        end_date,
        venue,
        mode,
        meeting_link,
        is_multi_event = false,
        parent_id = null,
        coordinators,
        themes,
        sdgs,
        registrationSettings,
        documentSettings,
        feedbackEnabled = true,
        certificateEnabled = true,
        feeRows,
        accommodation,
        sponsoringAgencies,
        expected_participants,
        collaboration_data,
        inaugural_enabled,
        inaugural_date,
        inaugural_time,
        inaugural_venue,
        valedictory_enabled,
        valedictory_date,
        valedictory_time,
        valedictory_venue,
        session,
      } = payload;

      // Build registration_settings JSON (includes venue, mode, meeting link etc.)
      const registrationSettingsJson = JSON.stringify({
        ...(registrationSettings || {}),
        venue: venue || null,
        mode: mode || 'Physical',
        meeting_link: meeting_link || null,
        session: session || null,
        expected_participants: expected_participants || null,
        collaboration: collaboration_data || [],
        fee_rows: feeRows || [],
        sponsoring_agencies: sponsoringAgencies || [],
        document_settings: documentSettings || {},
        inaugural_enabled: Boolean(inaugural_enabled),
        inaugural_date: inaugural_date || null,
        inaugural_time: inaugural_time || null,
        inaugural_venue: inaugural_venue || null,
        valedictory_enabled: Boolean(valedictory_enabled),
        valedictory_date: valedictory_date || null,
        valedictory_time: valedictory_time || null,
        valedictory_venue: valedictory_venue || null,
      });

      const accommodationSettingsJson = JSON.stringify(accommodation || {});
      const coordinatorsJson = JSON.stringify(coordinators || []);
      const themesJson = JSON.stringify(themes || []);
      const sdgsJson = JSON.stringify(sdgs || []);

      // Initial workflow state
      const workflowStateJson = JSON.stringify({ status: 'draft', currentStage: '' });

      const [result] = await connection.query(
        `INSERT INTO events
           (event_title, description, category_name, event_type_name, level_name,
            start_date, end_date, is_multi_event, parent_id,
            workflow_state, feedback_enabled, certificate_enabled,
            registration_settings, accommodation_settings,
            coordinators, themes, sdgs,
            created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description,
          category || null,
          Array.isArray(event_type) ? event_type.join(', ') : event_type || null,
          level || null,
          start_date || null,
          end_date || null,
          is_multi_event ? 1 : 0,
          parent_id || null,
          workflowStateJson,
          feedbackEnabled ? 1 : 0,
          certificateEnabled ? 1 : 0,
          registrationSettingsJson,
          accommodationSettingsJson,
          coordinatorsJson,
          themesJson,
          sdgsJson,
          userId || null,
          userId || null,
        ],
      );

      const eventId = result.insertId;

      // Insert feeRows into event_registration_fees
      if (feeRows && Array.isArray(feeRows)) {
        for (const fee of feeRows) {
          await connection.query(
            `INSERT INTO event_registration_fees 
             (event_id, participant_type, individual_fee, team_fee, member_fee, additional_member_fee, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              eventId,
              fee.participantCategory || null,
              parseFloat(fee.individual) || 0,
              parseFloat(fee.team) || 0,
              parseFloat(fee.members) || 0,
              parseFloat(fee.additionalMember) || 0,
              userId || null,
              userId || null,
            ],
          );
        }
      }

      // Insert session into event_sessions
      if (session) {
        await connection.query(
          `INSERT INTO event_sessions 
           (event_id, session_title, session_date, venue_name, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, session, start_date || null, venue || null, userId || null, userId || null],
        );
      }

      // Insert registration settings into dedicated table
      const rs = registrationSettings || {};
      const ds = documentSettings || {};
      await connection.query(
        `INSERT INTO event_registration_settings
           (event_id, enabled, eligible_participants, open_to, gender_restriction,
            min_age, max_age, registration_status, last_date, extension_enabled,
            extended_date, shortlisting_required, selection_intimation,
            team_enabled, min_team_size, max_team_size,
            document_enabled, document_name, document_type, document_size,
            document_text_field_enabled, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          rs.enabled ? 1 : 0,
          Array.isArray(rs.eligibleParticipants)
            ? rs.eligibleParticipants.join(', ')
            : rs.eligibleParticipants || null,
          rs.openTo || 'Any',
          rs.genderRestriction || 'Any',
          rs.minAge ? parseInt(rs.minAge) : null,
          rs.maxAge ? parseInt(rs.maxAge) : null,
          rs.registrationStatus || 'Open',
          rs.lastDate || null,
          rs.extension ? 1 : 0,
          rs.extendedDate || null,
          rs.shortlistingRequired ? 1 : 0,
          rs.selectionIntimation || null,
          rs.teamEnabled ? 1 : 0,
          rs.minTeamSize ? parseInt(rs.minTeamSize) : null,
          rs.maxTeamSize ? parseInt(rs.maxTeamSize) : null,
          ds.enabled ? 1 : 0,
          ds.documentName || null,
          ds.documentType || null,
          ds.documentSize || null,
          ds.textFieldEnabled ? 1 : 0,
          userId || null,
          userId || null,
        ],
      );

      await connection.commit();
      return { id: eventId, title, status: 'draft' };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const numId = Number(id);
    if (!id || isNaN(numId) || numId <= 0) return null;
    await ensureErsTable();
    try {
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no AS refNo,
           e.event_title AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS event_type,
           e.level_name AS level,
           e.start_date,
           e.end_date,
           e.is_multi_event,
           e.parent_id,
           e.feedback_enabled,
           e.certificate_enabled,
           e.registration_settings,
           e.accommodation_settings,
           e.coordinators,
           e.themes,
           e.sdgs,
           ers.id            AS reg_settings_id,
           ers.enabled       AS reg_enabled,
           ers.eligible_participants,
           ers.open_to,
           ers.gender_restriction,
           ers.min_age,
           ers.max_age,
           ers.registration_status AS reg_status,
           ers.last_date,
           ers.extension_enabled,
           ers.extended_date,
           ers.shortlisting_required,
           ers.selection_intimation,
           ers.team_enabled,
           ers.min_team_size,
           ers.max_team_size,
           ers.document_enabled,
           ers.document_name,
           ers.document_type,
           ers.document_size,
           ers.document_text_field_enabled
         FROM events e
         LEFT JOIN event_registration_settings ers ON ers.event_id = e.id
         WHERE e.id = ? AND e.is_deleted = 0`,
        [numId],
      );
      return rows[0] || null;
    } catch (err) {
      console.warn('[eventsModel] Fallback query for findById:', err.message);
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no AS refNo,
           e.event_title AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS event_type,
           e.level_name AS level,
           e.start_date,
           e.end_date,
           e.is_multi_event,
           e.parent_id,
           e.feedback_enabled,
           e.certificate_enabled,
           e.registration_settings,
           e.accommodation_settings,
           e.coordinators,
           e.themes,
           e.sdgs
         FROM events e
         WHERE e.id = ? AND e.is_deleted = 0`,
        [numId],
      );
      return rows[0] || null;
    }
  },

  // ─────────────────────────────────────────────────────────
  // UPDATE – PUT /events/:id
  // ─────────────────────────────────────────────────────────
  async update(id, payload, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Verify the event exists and is not deleted
      const [existing] = await connection.query(
        'SELECT id FROM events WHERE id = ? AND is_deleted = 0',
        [id],
      );
      if (existing.length === 0) {
        throw { status: 404, message: 'Event not found' };
      }

      const {
        title,
        description,
        category,
        event_type,
        level,
        start_date,
        end_date,
        venue,
        mode,
        meeting_link,
        is_multi_event,
        coordinators,
        themes,
        sdgs,
        registrationSettings,
        documentSettings,
        feedbackEnabled,
        certificateEnabled,
        feeRows,
        accommodation,
        sponsoringAgencies,
        expected_participants,
        collaboration_data,
        session,
      } = payload;

      const updates = { updated_by: userId || null };

      if (title !== undefined) updates.event_title = title;
      if (description !== undefined) updates.description = description;
      if (category !== undefined) updates.category_name = category;
      if (event_type !== undefined)
        updates.event_type_name = Array.isArray(event_type) ? event_type.join(', ') : event_type;
      if (level !== undefined) updates.level_name = level;
      if (start_date !== undefined) updates.start_date = start_date || null;
      if (end_date !== undefined) updates.end_date = end_date || null;
      if (is_multi_event !== undefined) updates.is_multi_event = is_multi_event ? 1 : 0;
      if (feedbackEnabled !== undefined) updates.feedback_enabled = feedbackEnabled ? 1 : 0;
      if (certificateEnabled !== undefined)
        updates.certificate_enabled = certificateEnabled ? 1 : 0;

      // Merge registration_settings (fetch existing first)
      if (
        registrationSettings !== undefined ||
        venue !== undefined ||
        mode !== undefined ||
        meeting_link !== undefined ||
        expected_participants !== undefined ||
        feeRows !== undefined ||
        sponsoringAgencies !== undefined ||
        documentSettings !== undefined ||
        collaboration_data !== undefined
      ) {
        const [[currentRow]] = await connection.query(
          'SELECT registration_settings FROM events WHERE id = ?',
          [id],
        );
        let existing_rs = {};
        try {
          existing_rs =
            typeof currentRow.registration_settings === 'string'
              ? JSON.parse(currentRow.registration_settings)
              : currentRow.registration_settings || {};
        } catch (_) {
          // ignore parse error
        }

        const mergedRs = {
          ...existing_rs,
          ...(registrationSettings || {}),
          ...(venue !== undefined ? { venue } : {}),
          ...(mode !== undefined ? { mode } : {}),
          ...(session !== undefined ? { session } : {}),
          ...(expected_participants !== undefined ? { expected_participants } : {}),
          ...(feeRows !== undefined ? { fee_rows: feeRows } : {}),
          ...(sponsoringAgencies !== undefined ? { sponsoring_agencies: sponsoringAgencies } : {}),
          ...(documentSettings !== undefined ? { document_settings: documentSettings } : {}),
          ...(collaboration_data !== undefined ? { collaboration: collaboration_data } : {}),
        };
        updates.registration_settings = JSON.stringify(mergedRs);
      }

      if (accommodation !== undefined)
        updates.accommodation_settings = JSON.stringify(accommodation);
      if (coordinators !== undefined) updates.coordinators = JSON.stringify(coordinators);
      if (themes !== undefined) updates.themes = JSON.stringify(themes);
      if (sdgs !== undefined) updates.sdgs = JSON.stringify(sdgs);

      await connection.query('UPDATE events SET ? WHERE id = ?', [updates, id]);

      // Update feeRows in event_registration_fees if provided
      if (feeRows !== undefined) {
        // Delete existing
        await connection.query('DELETE FROM event_registration_fees WHERE event_id = ?', [id]);
        // Insert new
        if (Array.isArray(feeRows) && feeRows.length > 0) {
          for (const fee of feeRows) {
            await connection.query(
              `INSERT INTO event_registration_fees 
               (event_id, participant_type, individual_fee, team_fee, member_fee, additional_member_fee, created_by, updated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                fee.participantCategory || null,
                parseFloat(fee.individual) || 0,
                parseFloat(fee.team) || 0,
                parseFloat(fee.members) || 0,
                parseFloat(fee.additionalMember) || 0,
                userId || null,
                userId || null,
              ],
            );
          }
        }
      }

      // Update session in event_sessions if provided
      if (session !== undefined) {
        // Since we are only supporting a single primary session in this form
        await connection.query('DELETE FROM event_sessions WHERE event_id = ?', [id]);
        if (session) {
          await connection.query(
            `INSERT INTO event_sessions 
             (event_id, session_title, session_date, venue_name, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, session, start_date || null, venue || null, userId || null, userId || null],
          );
        }
      }

      // Upsert registration settings into dedicated table
      if (registrationSettings !== undefined || documentSettings !== undefined) {
        const rs = registrationSettings || {};
        const ds = documentSettings || {};
        await connection.query(
          `INSERT INTO event_registration_settings
             (event_id, enabled, eligible_participants, open_to, gender_restriction,
              min_age, max_age, registration_status, last_date, extension_enabled,
              extended_date, shortlisting_required, selection_intimation,
              team_enabled, min_team_size, max_team_size,
              document_enabled, document_name, document_type, document_size,
              document_text_field_enabled, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             enabled                    = VALUES(enabled),
             eligible_participants      = VALUES(eligible_participants),
             open_to                    = VALUES(open_to),
             gender_restriction         = VALUES(gender_restriction),
             min_age                    = VALUES(min_age),
             max_age                    = VALUES(max_age),
             registration_status        = VALUES(registration_status),
             last_date                  = VALUES(last_date),
             extension_enabled          = VALUES(extension_enabled),
             extended_date              = VALUES(extended_date),
             shortlisting_required      = VALUES(shortlisting_required),
             selection_intimation       = VALUES(selection_intimation),
             team_enabled               = VALUES(team_enabled),
             min_team_size              = VALUES(min_team_size),
             max_team_size              = VALUES(max_team_size),
             document_enabled           = VALUES(document_enabled),
             document_name              = VALUES(document_name),
             document_type              = VALUES(document_type),
             document_size              = VALUES(document_size),
             document_text_field_enabled = VALUES(document_text_field_enabled),
             updated_by                 = VALUES(updated_by)`,
          [
            id,
            rs.enabled ? 1 : 0,
            rs.eligibleParticipants || null,
            rs.openTo || 'Any',
            rs.genderRestriction || 'Any',
            rs.minAge ? parseInt(rs.minAge) : null,
            rs.maxAge ? parseInt(rs.maxAge) : null,
            rs.registrationStatus || 'Open',
            rs.lastDate || null,
            rs.extension ? 1 : 0,
            rs.extendedDate || null,
            rs.shortlistingRequired ? 1 : 0,
            rs.selectionIntimation || null,
            rs.teamEnabled ? 1 : 0,
            rs.minTeamSize ? parseInt(rs.minTeamSize) : null,
            rs.maxTeamSize ? parseInt(rs.maxTeamSize) : null,
            ds.enabled ? 1 : 0,
            ds.documentName || null,
            ds.documentType || null,
            ds.documentSize || null,
            ds.textFieldEnabled ? 1 : 0,
            userId || null,
            userId || null,
          ],
        );
      }

      await connection.commit();
      return { id, ...payload };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // ─────────────────────────────────────────────────────────
  // SOFT DELETE – DELETE /events/:id
  // ─────────────────────────────────────────────────────────
  async softDelete(id, userId) {
    const [existing] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      id,
    ]);
    if (existing.length === 0) throw { status: 404, message: 'Event not found' };

    await db.query(
      'UPDATE events SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
      [userId || null, id],
    );

    // Soft-delete sub-events too
    await db.query(
      'UPDATE events SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE parent_id = ? AND is_deleted = 0',
      [userId || null, id],
    );

    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // SUMMARY – GET /events/:id/summary
  // ─────────────────────────────────────────────────────────
  async getSummary(id) {
    const [[row]] = await db.query(
      `SELECT id, event_title AS title, workflow_status AS status,
              start_date AS date, created_at AS createdAt, updated_at AS updatedAt
       FROM events
       WHERE id = ? AND is_deleted = 0`,
      [id],
    );
    if (!row) throw { status: 404, message: 'Event not found' };
    return row;
  },

  // ─────────────────────────────────────────────────────────
  // PARTICIPANTS – GET /events/:id/participants
  // Returns registrations joined with participant profile
  // ─────────────────────────────────────────────────────────
  async getParticipants(eventId) {
    const numId = Number(eventId);
    if (!eventId || isNaN(numId) || numId <= 0) {
      return [];
    }
    const [rows] = await db.query(
      `SELECT
         er.id,
         COALESCE(NULLIF(epp.first_name, ''), ep.name, ep.email, 'Participant') AS name,
         COALESCE(NULLIF(epp.institution, ''), 'N/A')             AS institution,
         COALESCE(NULLIF(epp.participant_type, ''), 'N/A')        AS category,
         COALESCE(er.registration_status, 'Registered')             AS status,
         (er.team_members IS NOT NULL
          AND JSON_LENGTH(er.team_members) > 0)       AS hasTeam,
         COALESCE(JSON_UNQUOTE(JSON_EXTRACT(er.team_members, '$[0].name')), 'N/A') AS \`group\`,
         (er.documents IS NOT NULL
          AND JSON_LENGTH(er.documents) > 0)          AS hasDoc,
         NULL                                         AS documentUrl,
         CASE WHEN er.accommodation_details IS NOT NULL AND JSON_EXTRACT(er.accommodation_details, '$.required') = true THEN 1 ELSE 0 END AS accommodation_required,
         CASE WHEN er.accommodation_details IS NOT NULL AND JSON_EXTRACT(er.accommodation_details, '$.required') = true THEN 'YES' ELSE 'NO' END AS hostel,
         COALESCE((SELECT amount FROM event_payments WHERE registration_id = er.id LIMIT 1), 0) AS fees,
         COALESCE((SELECT payment_status FROM event_payments WHERE registration_id = er.id LIMIT 1), 'Pending') AS fee_status,
         FALSE                                        AS action1,
         FALSE                                        AS action2,
         JSON_OBJECT('active', false)                 AS action3
       FROM event_registrations er
       LEFT JOIN event_participants ep ON ep.id = er.participant_id
       LEFT JOIN event_participant_profiles epp ON epp.participant_id = ep.id
       WHERE er.event_id = ?
         AND er.is_deleted = 0
       ORDER BY er.created_at DESC`,
      [numId],
    );
    return rows;
  },

  // ─────────────────────────────────────────────────────────
  // UPDATE PARTICIPANT – PUT /events/:id/participants/:pid
  // ─────────────────────────────────────────────────────────
  async updateParticipant(eventId, participantId, payload) {
    // Verify the registration belongs to this event
    const [[reg]] = await db.query(
      'SELECT id FROM event_registrations WHERE id = ? AND event_id = ? AND is_deleted = 0',
      [participantId, eventId],
    );
    if (!reg) throw { status: 404, message: 'Participant registration not found' };

    const allowed = ['registration_status', 'review_status', 'is_waitlisted'];
    const updates = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) updates[key] = payload[key];
    }
    // Map client shorthand fields
    if (payload.status !== undefined) updates.registration_status = payload.status;
    if (payload.hostel !== undefined) {
      // hostel is not a separate column; store in accommodation_details JSON
      const [[current]] = await db.query(
        'SELECT accommodation_details FROM event_registrations WHERE id = ?',
        [participantId],
      );
      let acc = {};
      try {
        acc =
          typeof current.accommodation_details === 'string'
            ? JSON.parse(current.accommodation_details)
            : current.accommodation_details || {};
      } catch (_) {
        // ignore parse error
      }
      acc.hostel = payload.hostel;
      updates.accommodation_details = JSON.stringify(acc);
    }

    if (Object.keys(updates).length === 0) return { success: true };

    await db.query('UPDATE event_registrations SET ? WHERE id = ?', [updates, participantId]);
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // SUBMIT FEEDBACK – POST /events/:id/feedback
  // ─────────────────────────────────────────────────────────
  async submitFeedback(eventId, userId, payload) {
    // Store feedback answers on the existing registration row if any, otherwise just ack.
    const [[reg]] = await db.query(
      'SELECT id FROM event_registrations WHERE event_id = ? AND participant_id = ? AND is_deleted = 0 LIMIT 1',
      [eventId, userId || 0],
    );
    if (reg) {
      await db.query('UPDATE event_registrations SET feedback_answers = ? WHERE id = ?', [
        JSON.stringify(payload),
        reg.id,
      ]);
    }
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS METHODS
  // ─────────────────────────────────────────────────────────
  async listPublicEvents() {
    await ensureErsTable();
    try {
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no   AS refNo,
           e.event_title   AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS eventType,
           e.level_name    AS level,
           e.start_date    AS startDate,
           e.end_date      AS endDate,
           e.is_multi_event  AS isMultiEvent,
           e.parent_id     AS parentId,
           e.feedback_enabled AS feedbackEnabled,
           e.certificate_enabled AS certificateEnabled,
           e.registration_settings AS registrationSettings,
           e.accommodation_settings AS accommodationSettings,
           e.coordinators,
           ers.id          AS ersId,
           ers.enabled     AS ersEnabled,
           ers.team_enabled AS ersTeamEnabled,
           ers.min_team_size AS ersMinTeamSize,
           ers.max_team_size AS ersMaxTeamSize,
           ers.document_enabled AS ersDocumentEnabled,
           ers.document_name AS ersDocumentName,
           ers.document_type AS ersDocumentType,
           ers.document_size AS ersDocumentSize,
           ers.registration_status AS ersRegistrationStatus,
           ers.last_date   AS ersLastDate,
           ers.extension_enabled AS ersExtensionEnabled,
           ers.extended_date AS ersExtendedDate,
           (SELECT COUNT(*) FROM event_registrations r
             WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
         FROM events e
         LEFT JOIN event_registration_settings ers ON ers.event_id = e.id
         WHERE e.is_deleted = 0
           AND e.is_active  = 1
           AND (
             (ers.id IS NOT NULL AND ers.enabled = 1)
             OR (ers.id IS NULL AND (
               JSON_EXTRACT(e.registration_settings, '$.enabled') = true
               OR JSON_EXTRACT(e.registration_settings, '$.enabled') = 1
               OR JSON_UNQUOTE(JSON_EXTRACT(e.registration_settings, '$.enabled')) = 'true'
             ))
             OR e.parent_id IS NOT NULL
           )
         ORDER BY e.start_date IS NULL, e.start_date ASC, e.id DESC`,
      );
      return rows;
    } catch (err) {
      console.warn('[eventsModel] Fallback query for listPublicEvents:', err.message);
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no   AS refNo,
           e.event_title   AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS eventType,
           e.level_name    AS level,
           e.start_date    AS startDate,
           e.end_date      AS endDate,
           e.is_multi_event  AS isMultiEvent,
           e.parent_id     AS parentId,
           e.feedback_enabled AS feedbackEnabled,
           e.certificate_enabled AS certificateEnabled,
           e.registration_settings AS registrationSettings,
           e.accommodation_settings AS accommodationSettings,
           e.coordinators,
           (SELECT COUNT(*) FROM event_registrations r
             WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
         FROM events e
         WHERE e.is_deleted = 0
           AND e.is_active  = 1
         ORDER BY e.start_date IS NULL, e.start_date ASC, e.id DESC`,
      );
      return rows;
    }
  },

  async findPublicEventById(eventId) {
    const numId = Number(eventId);
    if (!eventId || isNaN(numId) || numId <= 0) return null;
    await ensureErsTable();
    try {
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no   AS refNo,
           e.event_title   AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS eventType,
           e.level_name    AS level,
           e.start_date    AS startDate,
           e.end_date      AS endDate,
           e.is_multi_event  AS isMultiEvent,
           e.parent_id     AS parentId,
           e.feedback_enabled AS feedbackEnabled,
           e.certificate_enabled AS certificateEnabled,
           e.registration_settings AS registrationSettings,
           e.accommodation_settings AS accommodationSettings,
           e.coordinators,
           ers.id          AS ersId,
           ers.enabled     AS ersEnabled,
           ers.team_enabled AS ersTeamEnabled,
           ers.min_team_size AS ersMinTeamSize,
           ers.max_team_size AS ersMaxTeamSize,
           ers.document_enabled AS ersDocumentEnabled,
           ers.document_name AS ersDocumentName,
           ers.document_type AS ersDocumentType,
           ers.document_size AS ersDocumentSize,
           ers.registration_status AS ersRegistrationStatus,
           ers.last_date   AS ersLastDate,
           ers.extension_enabled AS ersExtensionEnabled,
           ers.extended_date AS ersExtendedDate,
           (SELECT COUNT(*) FROM event_registrations r
             WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
         FROM events e
         LEFT JOIN event_registration_settings ers ON ers.event_id = e.id
         WHERE e.id = ? AND e.is_deleted = 0 AND e.is_active = 1
         LIMIT 1`,
        [numId],
      );
      return rows[0] ?? null;
    } catch (err) {
      console.warn('[eventsModel] Fallback query for findPublicEventById:', err.message);
      const [rows] = await db.query(
        `SELECT
           e.id,
           e.event_ref_no   AS refNo,
           e.event_title   AS title,
           e.description,
           e.category_name AS category,
           e.event_type_name AS eventType,
           e.level_name    AS level,
           e.start_date    AS startDate,
           e.end_date      AS endDate,
           e.is_multi_event  AS isMultiEvent,
           e.parent_id     AS parentId,
           e.feedback_enabled AS feedbackEnabled,
           e.certificate_enabled AS certificateEnabled,
           e.registration_settings AS registrationSettings,
           e.accommodation_settings AS accommodationSettings,
           e.coordinators,
           (SELECT COUNT(*) FROM event_registrations r
             WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
         FROM events e
         WHERE e.id = ? AND e.is_deleted = 0 AND e.is_active = 1
         LIMIT 1`,
        [numId],
      );
      return rows[0] ?? null;
    }
  },

  async listEventFees(eventId) {
    const [[row]] = await db.query(
      'SELECT registration_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) return [];
    try {
      const settings =
        typeof row.registration_settings === 'string'
          ? JSON.parse(row.registration_settings)
          : row.registration_settings || {};
      const feeRows = settings.fee_rows || [];
      return feeRows.map((f, index) => ({
        id: f.id || String(index + 1),
        participantTypeId: null,
        participantType: f.participantCategory,
        individualFee: parseFloat(f.individual) || 0,
        teamFee: parseFloat(f.team) || 0,
        memberFee: parseFloat(f.members) || 0,
        additionalMemberFee: parseFloat(f.additionalMember) || 0,
      }));
    } catch (_) {
      return [];
    }
  },

  async listAccommodationRoomTypes(eventId) {
    const [[row]] = await db.query(
      'SELECT accommodation_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) return [];
    try {
      const acc =
        typeof row.accommodation_settings === 'string'
          ? JSON.parse(row.accommodation_settings)
          : row.accommodation_settings || {};
      if (!acc.enabled) return [];
      return [
        {
          id: 1,
          roomType: acc.type || 'Standard',
          pricePerNight: 0,
          maxOccupants: 4,
          totalRooms: 100,
        },
      ];
    } catch (_) {
      return [];
    }
  },

  async listSubEvents(parentEventId) {
    const [rows] = await db.query(
      `SELECT
         e.id,
         e.event_ref_no   AS refNo,
         e.event_title   AS title,
         e.description,
         e.category_name AS category,
         e.event_type_name AS eventType,
         e.level_name    AS level,
         e.start_date    AS startDate,
         e.end_date      AS endDate,
         e.is_multi_event  AS isMultiEvent,
         e.parent_id     AS parentId,
         e.feedback_enabled AS feedbackEnabled,
         e.certificate_enabled AS certificateEnabled,
         e.registration_settings AS registrationSettings,
         e.accommodation_settings AS accommodationSettings,
         e.coordinators,
         (SELECT COUNT(*) FROM event_registrations r
           WHERE r.event_id = e.id AND r.is_cancelled = 0 AND r.is_deleted = 0) AS registeredCount
       FROM events e
       WHERE e.parent_id = ? AND e.is_deleted = 0 AND e.is_active = 1
       ORDER BY e.event_title ASC`,
      [parentEventId],
    );
    return rows;
  },

  // ─────────────────────────────────────────────────────────
  // GET /events/:id/registration-settings
  // Returns the event_registration_settings row for this event.
  // ─────────────────────────────────────────────────────────
  async getRegistrationSettings(eventId) {
    const [[row]] = await db.query(
      `SELECT ers.*
       FROM event_registration_settings ers
       WHERE ers.event_id = ?`,
      [eventId],
    );
    return row || null;
  },

  // ─────────────────────────────────────────────────────────
  // PUT /events/:id/registration-settings
  // Upserts the event_registration_settings row.
  // ─────────────────────────────────────────────────────────
  async saveRegistrationSettings(eventId, payload, userId) {
    // Verify the event exists
    const [[evt]] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!evt) throw { status: 404, message: 'Event not found' };

    const {
      enabled,
      eligibleParticipants,
      openTo,
      genderRestriction,
      minAge,
      maxAge,
      registrationStatus,
      lastDate,
      extension,
      extendedDate,
      shortlistingRequired,
      selectionIntimation,
      teamEnabled,
      minTeamSize,
      maxTeamSize,
      documentEnabled,
      documentName,
      documentType,
      documentSize,
      documentTextFieldEnabled,
    } = payload;

    await db.query(
      `INSERT INTO event_registration_settings
         (event_id, enabled, eligible_participants, open_to, gender_restriction,
          min_age, max_age, registration_status, last_date, extension_enabled,
          extended_date, shortlisting_required, selection_intimation,
          team_enabled, min_team_size, max_team_size,
          document_enabled, document_name, document_type, document_size,
          document_text_field_enabled, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         enabled                    = VALUES(enabled),
         eligible_participants      = VALUES(eligible_participants),
         open_to                    = VALUES(open_to),
         gender_restriction         = VALUES(gender_restriction),
         min_age                    = VALUES(min_age),
         max_age                    = VALUES(max_age),
         registration_status        = VALUES(registration_status),
         last_date                  = VALUES(last_date),
         extension_enabled          = VALUES(extension_enabled),
         extended_date              = VALUES(extended_date),
         shortlisting_required      = VALUES(shortlisting_required),
         selection_intimation       = VALUES(selection_intimation),
         team_enabled               = VALUES(team_enabled),
         min_team_size              = VALUES(min_team_size),
         max_team_size              = VALUES(max_team_size),
         document_enabled           = VALUES(document_enabled),
         document_name              = VALUES(document_name),
         document_type              = VALUES(document_type),
         document_size              = VALUES(document_size),
         document_text_field_enabled = VALUES(document_text_field_enabled),
         updated_by                 = VALUES(updated_by)`,
      [
        eventId,
        enabled ? 1 : 0,
        Array.isArray(eligibleParticipants)
          ? eligibleParticipants.join(', ')
          : eligibleParticipants || null,
        openTo || 'Any',
        genderRestriction || 'Any',
        minAge ? parseInt(minAge) : null,
        maxAge ? parseInt(maxAge) : null,
        registrationStatus || 'Open',
        lastDate || null,
        extension ? 1 : 0,
        extendedDate || null,
        shortlistingRequired ? 1 : 0,
        selectionIntimation || null,
        teamEnabled ? 1 : 0,
        minTeamSize ? parseInt(minTeamSize) : null,
        maxTeamSize ? parseInt(maxTeamSize) : null,
        documentEnabled ? 1 : 0,
        documentName || null,
        documentType || null,
        documentSize || null,
        documentTextFieldEnabled ? 1 : 0,
        userId || null,
        userId || null,
      ],
    );

    return { success: true };
  },
};

export default eventsModel;
