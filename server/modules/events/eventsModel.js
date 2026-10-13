import {
  WORKFLOW_STAGES,
  getRequiredApproverRole,
  getNextStage,
  canUserApproveStage,
  parseWorkflowState,
} from './eventWorkflowEngine.js';
import db from '../../config/connection.js';

let isHistoryTableChecked = false;
async function ensureHistoryTable() {
  if (isHistoryTableChecked) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_approval_history\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`event_id\` INT NOT NULL,
        \`role\` VARCHAR(50) NOT NULL,
        \`user_id\` INT DEFAULT NULL,
        \`user_name\` VARCHAR(255) DEFAULT NULL,
        \`action\` VARCHAR(50) NOT NULL,
        \`comments\` TEXT DEFAULT NULL,
        \`action_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_eah_event\` (\`event_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    isHistoryTableChecked = true;
  } catch (err) {
    console.warn('[eventsModel] ensureHistoryTable warning:', err.message);
  }
}

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

let isFeedbackTableChecked = false;
async function ensureFeedbackTable() {
  if (isFeedbackTableChecked) return;
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM events LIKE 'feedback_settings'");
    if (cols.length === 0) {
      await db.query('ALTER TABLE events ADD COLUMN feedback_settings JSON DEFAULT NULL');
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_feedback_questions\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`event_id\` int NOT NULL,
        \`question_text\` text COLLATE utf8mb4_unicode_ci NOT NULL,
        \`question_type\` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`section_name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        \`display_order\` int NOT NULL DEFAULT 1,
        \`is_required\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_by\` int DEFAULT NULL,
        \`updated_by\` int DEFAULT NULL,
        \`deleted_by\` int DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` timestamp NULL DEFAULT NULL,
        \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        KEY \`fk_efq_event\` (\`event_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_feedback_question_options\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`question_id\` int NOT NULL,
        \`option_text\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
        \`display_order\` int NOT NULL DEFAULT 1,
        \`created_by\` int DEFAULT NULL,
        \`updated_by\` int DEFAULT NULL,
        \`deleted_by\` int DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` timestamp NULL DEFAULT NULL,
        \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        KEY \`fk_efqo_question\` (\`question_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_feedbacks\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`event_id\` int NOT NULL,
        \`registration_id\` int NOT NULL,
        \`submitted_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`created_by\` int DEFAULT NULL,
        \`updated_by\` int DEFAULT NULL,
        \`deleted_by\` int DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` timestamp NULL DEFAULT NULL,
        \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_event_feedback_registration\` (\`event_id\`, \`registration_id\`),
        KEY \`fk_ef_event\` (\`event_id\`),
        KEY \`fk_ef_registration\` (\`registration_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS \`event_feedback_answers\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`feedback_id\` int NOT NULL,
        \`question_id\` int NOT NULL,
        \`answer_text\` text COLLATE utf8mb4_unicode_ci,
        \`rating_value\` int DEFAULT NULL,
        \`created_by\` int DEFAULT NULL,
        \`updated_by\` int DEFAULT NULL,
        \`deleted_by\` int DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` timestamp NULL DEFAULT NULL,
        \`is_deleted\` tinyint(1) NOT NULL DEFAULT 0,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_feedback_question_answer\` (\`feedback_id\`, \`question_id\`),
        KEY \`fk_efa_feedback\` (\`feedback_id\`),
        KEY \`fk_efa_question\` (\`question_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    isFeedbackTableChecked = true;
  } catch (err) {
    console.warn('[eventsModel] ensureFeedbackTable warning:', err.message);
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
         e.workflow_state,
         e.is_multi_event  AS isMultiEvent,
         e.parent_id,
         e.created_at    AS createdAt,
         e.updated_at    AS updatedAt,
         e.registration_settings,
         COALESCE(u.name, u.email, 'N/A') AS proposedBy,
         COALESCE(md.name, md.code, 'N/A') AS department,
         COALESCE(
           JSON_UNQUOTE(JSON_EXTRACT(e.registration_settings, '$.venue')),
           'TBD'
         )               AS venue
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN master_employees me ON me.user_id = u.id AND me.status = 'Active'
       LEFT JOIN master_departments md ON md.id = me.department_id
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
        multi_events_list: payload.multiEventsList || payload.sub_events || [],
        inaugural_enabled: Boolean(inaugural_enabled),
        inaugural_date: inaugural_date || null,
        inaugural_time: inaugural_time || null,
        inaugural_venue: inaugural_venue || null,
        valedictory_enabled: Boolean(valedictory_enabled),
        valedictory_date: valedictory_date || null,
        valedictory_time: valedictory_time || null,
        valedictory_venue: valedictory_venue || null,
        host_collaborator:
          payload.host_collaborator ||
          payload.hostCollaborator ||
          (registrationSettings &&
            (registrationSettings.host_collaborator || registrationSettings.hostCollaborator)) ||
          null,
      });

      const accommodationSettingsJson = JSON.stringify(accommodation || {});
      const coordinatorsJson = JSON.stringify(coordinators || []);
      const themesJson = JSON.stringify(themes || []);
      const sdgsJson = JSON.stringify(sdgs || []);

      // Initial workflow state - direct to approval (HOD pending)
      const initialWorkflowState = {
        status: 'hod_pending',
        currentStage: 'hod_pending',
        currentApproverRole: 'HOD',
        submittedAt: new Date().toISOString(),
      };
      const workflowStateJson = JSON.stringify(initialWorkflowState);

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

      try {
        await connection.query(
          'INSERT INTO event_approval_history (event_id, role, user_id, user_name, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
          [
            eventId,
            'Creator',
            userId || null,
            'Creator',
            'SUBMITTED',
            'Submitted for HOD approval',
          ],
        );
      } catch (hErr) {
        console.error('[eventsModel] Error writing initial approval history:', hErr);
      }

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
      return { id: eventId, title, status: 'hod_pending' };
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
      const event = rows[0] || null;
      if (event && event.is_multi_event) {
        const [subRows] = await db.query(
          `SELECT id, event_title AS title, event_type_name AS eventType, coordinators FROM events WHERE parent_id = ? AND is_deleted = 0`,
          [numId],
        );
        event.subEvents = subRows.map((sub) => {
          let coordinatorName = '';
          try {
            if (sub.coordinators) {
              const coords = JSON.parse(sub.coordinators);
              if (coords.length > 0) coordinatorName = coords[0].name;
            }
          } catch (_e) {
            // ignore parse error
          }
          return {
            id: sub.id,
            title: sub.title,
            eventType: sub.eventType,
            coordinatorName,
          };
        });
      }
      return event;
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
      const event = rows[0] || null;
      if (event && event.is_multi_event) {
        const [subRows] = await db.query(
          `SELECT id, event_title AS title, event_type_name AS eventType, coordinators FROM events WHERE parent_id = ? AND is_deleted = 0`,
          [numId],
        );
        event.subEvents = subRows.map((sub) => {
          let coordinatorName = '';
          try {
            if (sub.coordinators) {
              const coords = JSON.parse(sub.coordinators);
              if (coords.length > 0) coordinatorName = coords[0].name;
            }
          } catch (_e) {
            // ignore parse error
          }
          return {
            id: sub.id,
            title: sub.title,
            eventType: sub.eventType,
            coordinatorName,
          };
        });
      }
      return event;
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
          ...(payload.multiEventsList !== undefined || payload.sub_events !== undefined
            ? { multi_events_list: payload.multiEventsList || payload.sub_events }
            : {}),
          ...(payload.host_collaborator !== undefined || payload.hostCollaborator !== undefined
            ? { host_collaborator: payload.host_collaborator || payload.hostCollaborator }
            : {}),
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
         er.event_id,
         er.created_at                                AS registration_date,
         COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.team_members, '$[0].name')), ''),
           CONCAT_WS(' ', NULLIF(epp.first_name, ''), NULLIF(epp.last_name, '')),
           NULLIF(ep.name, ''),
           NULLIF(ep.email, ''),
           'Participant'
         )                                            AS name,
         COALESCE(ep.email, 'N/A')                     AS email,
         COALESCE(NULLIF(epp.mobile_number, ''), NULLIF(epp.whatsapp_number, ''), 'N/A') AS phone,
         COALESCE(
           NULLIF(epp.institution, ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(epp.profession_details, '$.school')), ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(epp.profession_details, '$.organization')), ''),
           'K.S.Rangasamy College of Technology'
         )                                            AS institution,
         COALESCE(
           NULLIF(epp.profession_type, ''),
           NULLIF(epp.participant_type, ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(epp.profession_details, '$.professionType')), ''),
           'Student'
         )                                            AS category,
         COALESCE(er.review_status, er.registration_status, 'Pending') AS status,
         (er.team_members IS NOT NULL AND JSON_LENGTH(er.team_members) > 0) AS hasTeam,
         CASE
           WHEN er.team_members IS NOT NULL AND JSON_LENGTH(er.team_members) > 0
           THEN JSON_LENGTH(er.team_members)
           ELSE 1
         END                                          AS \`group\`,
         CASE
           WHEN (er.documents IS NOT NULL AND er.documents != 'null' AND er.documents != '') OR epp.id_card_path IS NOT NULL
           THEN 1
           ELSE 0
         END                                          AS hasDoc,
         COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.documents, '$.documentPath')), ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.documents, '$.filePath')), ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.documents, '$[0].documentPath')), ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.documents, '$[0].filePath')), ''),
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.documents, '$.url')), ''),
           epp.id_card_path,
           NULL
         )                                            AS documentUrl,
         CASE
           WHEN er.accommodation_details IS NOT NULL AND (
             JSON_EXTRACT(er.accommodation_details, '$.required') = true
             OR JSON_UNQUOTE(JSON_EXTRACT(er.accommodation_details, '$.hostel')) = 'YES'
           ) THEN 1
           ELSE 0
         END                                          AS accommodation_required,
         CASE
           WHEN er.accommodation_details IS NOT NULL AND (
             JSON_EXTRACT(er.accommodation_details, '$.required') = true
             OR JSON_UNQUOTE(JSON_EXTRACT(er.accommodation_details, '$.hostel')) = 'YES'
           ) THEN 'YES'
           ELSE 'NO'
         END                                          AS hostel,
         COALESCE(
           (SELECT epay.amount FROM event_payments epay WHERE epay.registration_id = er.id AND epay.is_deleted = 0 ORDER BY epay.id DESC LIMIT 1),
           0
         )                                            AS fees,
         COALESCE(
           (SELECT epay.payment_status FROM event_payments epay WHERE epay.registration_id = er.id AND epay.is_deleted = 0 ORDER BY epay.id DESC LIMIT 1),
           'Pending'
         )                                            AS fee_status,
         COALESCE(
           (SELECT epay.proof_file_path FROM event_payments epay WHERE epay.registration_id = er.id AND epay.is_deleted = 0 ORDER BY epay.id DESC LIMIT 1),
           NULL
         )                                            AS receiptUrl,
         JSON_UNQUOTE(JSON_EXTRACT(er.feedback_answers, '$.attendance')) AS attendance,
         JSON_EXTRACT(er.feedback_answers, '$.adminFeedback') AS adminFeedback,
         IFNULL(JSON_EXTRACT(er.feedback_answers, '$.action1'), false) = true AS action1,
         IFNULL(JSON_EXTRACT(er.feedback_answers, '$.action2'), false) = true AS action2,
         EXISTS(SELECT 1 FROM event_feedbacks ef WHERE ef.registration_id = er.id AND ef.is_deleted = 0) AS hasFeedback,
         JSON_OBJECT('active', false)                 AS action3,
         epp.first_name, epp.last_name, epp.gender, epp.date_of_birth,
         epp.contact_email, epp.mobile_number, epp.whatsapp_number,
         epp.address, epp.city, epp.state, epp.country, epp.pin,
         epp.profession_type, epp.institution AS prof_institution, epp.department, epp.designation,
         epp.register_number, epp.profession_details,
         er.documents AS registration_documents,
         epp.id_card_path AS profile_id_card,
         er.accommodation_details,
         er.team_members AS team_members,
         (
           SELECT JSON_ARRAYAGG(JSON_OBJECT('amount', epay.amount, 'status', epay.payment_status, 'proof_file_path', epay.proof_file_path, 'transaction_reference', epay.transaction_reference, 'date', epay.payment_date, 'bill_type', epay.bill_type))
           FROM event_payments epay
           WHERE epay.registration_id = er.id AND epay.is_deleted = 0
         ) AS payments
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
    if (payload.status !== undefined) {
      const regStatuses = ['Pending', 'Submitted', 'Registered', 'Cancelled'];
      const revStatuses = ['Pending', 'Shortlisted', 'Selected', 'Rejected', 'Not Selected'];
      if (regStatuses.includes(payload.status)) updates.registration_status = payload.status;
      if (revStatuses.includes(payload.status)) updates.review_status = payload.status;
    }
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

    if (
      payload.attendance !== undefined ||
      payload.adminFeedback !== undefined ||
      payload.action1 !== undefined ||
      payload.action2 !== undefined
    ) {
      const [[current]] = await db.query(
        'SELECT feedback_answers FROM event_registrations WHERE id = ?',
        [participantId],
      );
      let fb = {};
      try {
        fb =
          typeof current.feedback_answers === 'string'
            ? JSON.parse(current.feedback_answers)
            : current.feedback_answers || {};
      } catch (_) {
        // ignore parse error
      }
      if (payload.attendance !== undefined) fb.attendance = payload.attendance;
      if (payload.adminFeedback !== undefined) fb.adminFeedback = payload.adminFeedback;
      if (payload.action1 !== undefined) fb.action1 = payload.action1;
      if (payload.action2 !== undefined) fb.action2 = payload.action2;
      updates.feedback_answers = JSON.stringify(fb);
    }

    if (Object.keys(updates).length === 0) return { success: true };

    await db.query('UPDATE event_registrations SET ? WHERE id = ?', [updates, participantId]);
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // GET EVENT FEEDBACK – GET /events/:id/feedback
  // ─────────────────────────────────────────────────────────
  async getEventFeedback(eventId) {
    const numId = Number(eventId);
    if (!eventId || isNaN(numId) || numId <= 0) {
      return {
        questions: [],
        responses: [],
        summary: { totalSubmissions: 0, questionSummaries: [] },
      };
    }

    // 1. Fetch questions
    const [questions] = await db.query(
      `SELECT id, question_text, question_type, section_name, display_order, is_required
         FROM event_feedback_questions
        WHERE event_id = ? AND is_deleted = 0 AND is_active = 1
        ORDER BY display_order ASC, id ASC`,
      [numId],
    );

    // 2. Fetch options
    let options = [];
    if (questions.length > 0) {
      const qIds = questions.map((q) => q.id);
      const placeholders = qIds.map(() => '?').join(',');
      const [optRows] = await db.query(
        `SELECT id, question_id, option_text, display_order
           FROM event_feedback_question_options
          WHERE question_id IN (${placeholders}) AND is_deleted = 0 AND is_active = 1
          ORDER BY display_order ASC`,
        qIds,
      );
      options = optRows;
    }

    const questionsWithOptions = questions.map((q) => ({
      ...q,
      options: options.filter((o) => o.question_id === q.id),
    }));

    // 3. Fetch submissions
    const [submissions] = await db.query(
      `SELECT 
         ef.id AS feedback_id,
         ef.registration_id,
         ef.submitted_at,
         er.registration_ref_no,
         COALESCE(
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(er.team_members, '$[0].name')), ''),
           CONCAT_WS(' ', NULLIF(epp.first_name, ''), NULLIF(epp.last_name, '')),
           NULLIF(ep.name, ''),
           NULLIF(ep.email, ''),
           'Participant'
         ) AS participant_name,
         COALESCE(ep.email, 'N/A') AS participant_email
       FROM event_feedbacks ef
       JOIN event_registrations er ON er.id = ef.registration_id
       LEFT JOIN event_participants ep ON ep.id = er.participant_id
       LEFT JOIN event_participant_profiles epp ON epp.participant_id = ep.id
       WHERE ef.event_id = ? AND ef.is_deleted = 0 AND er.is_deleted = 0
       ORDER BY ef.submitted_at DESC`,
      [numId],
    );

    // 4. Fetch all answers for these submissions
    let answers = [];
    if (submissions.length > 0) {
      const feedbackIds = submissions.map((s) => s.feedback_id);
      const placeholders = feedbackIds.map(() => '?').join(',');
      const [ansRows] = await db.query(
        `SELECT efa.feedback_id, efa.question_id, efa.rating_value, efa.answer_text
           FROM event_feedback_answers efa
          WHERE efa.feedback_id IN (${placeholders}) AND efa.is_deleted = 0`,
        feedbackIds,
      );
      answers = ansRows;
    }

    // Format responses array
    const formattedResponses = submissions.map((s) => {
      const sAnswers = answers.filter((a) => a.feedback_id === s.feedback_id);
      const answersMap = {};
      sAnswers.forEach((a) => {
        answersMap[a.question_id] = {
          rating_value: a.rating_value,
          answer_text: a.answer_text,
        };
      });
      return {
        feedbackId: s.feedback_id,
        registrationId: s.registration_id,
        submittedAt: s.submitted_at,
        registrationRefNo: s.registration_ref_no,
        participantName: s.participant_name,
        participantEmail: s.participant_email,
        answers: answersMap,
      };
    });

    // Calculate summary metrics
    const totalSubmissions = submissions.length;
    const questionSummaries = questionsWithOptions.map((q) => {
      const qAnswers = answers.filter((a) => a.question_id === q.id);
      if (q.question_type === 'rating') {
        const ratings = qAnswers.map((a) => a.rating_value).filter((r) => r !== null && r > 0);
        const avgRating =
          ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0;
        return {
          questionId: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          sectionName: q.section_name,
          totalAnswers: ratings.length,
          averageRating: Number(avgRating),
        };
      } else {
        const optionCounts = {};
        qAnswers.forEach((a) => {
          if (a.answer_text) {
            optionCounts[a.answer_text] = (optionCounts[a.answer_text] || 0) + 1;
          }
        });
        return {
          questionId: q.id,
          questionText: q.question_text,
          questionType: q.question_type,
          sectionName: q.section_name,
          totalAnswers: qAnswers.length,
          optionCounts,
        };
      }
    });

    const [[evt]] = await db.query('SELECT feedback_settings FROM events WHERE id = ?', [numId]);
    let settings = {};
    if (evt?.feedback_settings) {
      try {
        settings =
          typeof evt.feedback_settings === 'string'
            ? JSON.parse(evt.feedback_settings)
            : evt.feedback_settings;
      } catch (_) {
        // ignore parse error
      }
    }

    return {
      questions: questionsWithOptions,
      responses: formattedResponses,
      summary: {
        totalSubmissions,
        questionSummaries,
      },
      eventFeedback: settings.eventFeedback || {
        toggles: settings.eventToggles || {},
        ratings: settings.eventRatings || {},
        awareness: settings.awarenessChannel || '',
        suggestion: settings.eventSuggestion || '',
      },
      resourcePersonsFeedback: settings.resourcePersonsFeedback || settings.resourcePersons || [],
      accommodationFeedback: settings.accommodationFeedback || {
        ratings: settings.accommodationRatings || {},
        suggestion: settings.accommodationSuggestion || '',
      },
      ...settings,
    };
  },

  // ─────────────────────────────────────────────────────────
  // SAVE FEEDBACK CONFIGURATION – POST /events/:id/feedback
  // ─────────────────────────────────────────────────────────
  async submitFeedback(eventId, userId, payload) {
    await ensureFeedbackTable();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let validUserId = null;
      if (userId) {
        const [[u]] = await connection.query('SELECT id FROM users WHERE id = ?', [userId]);
        if (u) validUserId = u.id;
      }

      // 1. Update feedback_settings in events table
      await connection.query(
        'UPDATE events SET feedback_settings = ?, updated_by = ? WHERE id = ?',
        [JSON.stringify(payload), validUserId, eventId],
      );

      // 2. Build configured questions list from payload
      const toggles = payload.eventFeedback?.toggles || payload.eventToggles || {};
      const configuredQuestions = [];

      // Add ONLY enabled toggles questions
      const toggleList = ['food', 'refreshment', 'presentation', 'evaluation', 'enjoyment'];
      for (const t of toggleList) {
        if (toggles[t]) {
          const title = t.charAt(0).toUpperCase() + t.slice(1);
          configuredQuestions.push({
            text: title,
            type: 'radio',
            section: 'Event Feedback',
            required: 0,
            options: ['Yes', 'No'],
          });
        }
      }

      // Ratings questions
      configuredQuestions.push({
        text: 'How would you rate the overall quality of the event?',
        type: 'rating',
        section: 'Event Feedback',
        required: 1,
        options: [],
      });
      configuredQuestions.push({
        text: 'How would you rate the planning, coordination and execution of the event?',
        type: 'rating',
        section: 'Event Feedback',
        required: 0,
        options: [],
      });
      configuredQuestions.push({
        text: 'How effectively was the event managed within the scheduled time?',
        type: 'rating',
        section: 'Event Feedback',
        required: 0,
        options: [],
      });

      if (toggles.food || toggles.refreshment) {
        let label = 'catering';
        if (toggles.food && toggles.refreshment) label = 'food and refreshment';
        else if (toggles.food) label = 'food';
        else if (toggles.refreshment) label = 'refreshment';
        configuredQuestions.push({
          text: `How would you rate the quality of the ${label} provided?`,
          type: 'rating',
          section: 'Event Feedback',
          required: 0,
          options: [],
        });
      }

      configuredQuestions.push({
        text: 'How would you rate the venue, facilities, and overall event arrangements?',
        type: 'rating',
        section: 'Event Feedback',
        required: 0,
        options: [],
      });

      if (toggles.presentation) {
        configuredQuestions.push({
          text: 'How satisfied were you with the opportunity provided to present your work?',
          type: 'rating',
          section: 'Event Feedback',
          required: 0,
          options: [],
        });
      }

      if (toggles.evaluation) {
        configuredQuestions.push({
          text: 'How would you rate the fairness and transparency of the evaluation/judging process?',
          type: 'rating',
          section: 'Event Feedback',
          required: 0,
          options: [],
        });
      }

      if (toggles.enjoyment) {
        configuredQuestions.push({
          text: 'How engaging and enjoyable was the event?',
          type: 'rating',
          section: 'Event Feedback',
          required: 0,
          options: [],
        });
      }

      configuredQuestions.push({
        text: 'How did you come to know about this event?',
        type: 'radio',
        section: 'Event Feedback',
        required: 0,
        options: [
          'Circular',
          'Social Media',
          'Email',
          'Friends',
          'Website',
          'Colleagues',
          'Others',
        ],
      });

      configuredQuestions.push({
        text: 'Your Suggestions or Comments or Recommendations',
        type: 'textarea',
        section: 'Event Feedback',
        required: 0,
        options: [],
      });

      // Resource Persons questions
      const rpList = payload.resourcePersonsFeedback || payload.resourcePersons || [];
      if (Array.isArray(rpList)) {
        for (const rp of rpList) {
          if (rp.name || rp.feedbackEnabled) {
            const rpName = rp.name ? ` (${rp.name})` : '';
            const rpSection = `Resource Person: ${rp.name || 'Speaker'}`;

            configuredQuestions.push({
              text: `How would you rate the speaker's subject knowledge and expertise?${rpName}`,
              type: 'rating',
              section: rpSection,
              required: 0,
              options: [],
            });
            configuredQuestions.push({
              text: `How effectively did the speaker engage the audience throughout the session?${rpName}`,
              type: 'rating',
              section: rpSection,
              required: 0,
              options: [],
            });
            configuredQuestions.push({
              text: `How relevant and useful was the content of the lecture to your learning or professional needs?${rpName}`,
              type: 'rating',
              section: rpSection,
              required: 0,
              options: [],
            });
            configuredQuestions.push({
              text: `How well did the speaker manage the allotted time while covering the topics?${rpName}`,
              type: 'rating',
              section: rpSection,
              required: 0,
              options: [],
            });
            if (rp.isOnline) {
              configuredQuestions.push({
                text: `How would you rate the audio and video quality of the online session?${rpName}`,
                type: 'rating',
                section: rpSection,
                required: 0,
                options: [],
              });
            }
            configuredQuestions.push({
              text: `Your key takeaway from this lecture session${rpName}`,
              type: 'textarea',
              section: rpSection,
              required: 0,
              options: [],
            });
            configuredQuestions.push({
              text: `Suggestions or Comments for ${rp.name || 'Speaker'}`,
              type: 'textarea',
              section: rpSection,
              required: 0,
              options: [],
            });
          }
        }
      }

      // Accommodation questions
      configuredQuestions.push({
        text: 'How would you rate the cleanliness and maintenance of the room?',
        type: 'rating',
        section: 'Accommodation Feedback',
        required: 0,
        options: [],
      });
      configuredQuestions.push({
        text: 'How would you rate the comfort and amenities provided in the hostel?',
        type: 'rating',
        section: 'Accommodation Feedback',
        required: 0,
        options: [],
      });
      configuredQuestions.push({
        text: 'How would you rate the quality of the food and refreshments provided?',
        type: 'rating',
        section: 'Accommodation Feedback',
        required: 0,
        options: [],
      });
      configuredQuestions.push({
        text: 'Accommodation Suggestions or Comments',
        type: 'textarea',
        section: 'Accommodation Feedback',
        required: 0,
        options: [],
      });

      // 3. Clear existing questions for event_id that don't have answers yet
      await connection.query(
        `DELETE FROM event_feedback_questions WHERE event_id = ? AND id NOT IN (SELECT DISTINCT question_id FROM event_feedback_answers)`,
        [eventId],
      );

      // 4. Insert newly configured questions
      for (let i = 0; i < configuredQuestions.length; i++) {
        const q = configuredQuestions[i];

        // Check if question text already exists for this event
        const [existingQ] = await connection.query(
          `SELECT id FROM event_feedback_questions WHERE event_id = ? AND question_text = ? AND is_deleted = 0 LIMIT 1`,
          [eventId, q.text],
        );

        let questionId;
        if (existingQ[0]) {
          questionId = existingQ[0].id;
          await connection.query(
            `UPDATE event_feedback_questions SET display_order = ?, is_required = ?, is_active = 1 WHERE id = ?`,
            [i + 1, q.required, questionId],
          );
        } else {
          const [res] = await connection.query(
            `INSERT INTO event_feedback_questions (event_id, question_text, question_type, section_name, display_order, is_required, is_active, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
            [eventId, q.text, q.type, q.section, i + 1, q.required],
          );
          questionId = res.insertId;
        }

        // Insert options if any
        if (q.options && q.options.length > 0) {
          for (let j = 0; j < q.options.length; j++) {
            const optText = q.options[j];
            const [existingOpt] = await connection.query(
              `SELECT id FROM event_feedback_question_options WHERE question_id = ? AND option_text = ? AND is_deleted = 0 LIMIT 1`,
              [questionId, optText],
            );
            if (!existingOpt[0]) {
              await connection.query(
                `INSERT INTO event_feedback_question_options (question_id, option_text, display_order, is_active, is_deleted)
                 VALUES (?, ?, ?, 1, 0)`,
                [questionId, optText, j + 1],
              );
            }
          }
        }
      }

      await connection.commit();
      return { success: true };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
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
           ers.document_text_field_enabled AS ersDocumentTextFieldEnabled,
           ers.registration_status AS ersRegistrationStatus,
           ers.last_date   AS ersLastDate,
           ers.extension_enabled AS ersExtensionEnabled,
           ers.extended_date AS ersExtendedDate,
           ers.shortlisting_required AS ersShortlistingRequired,
           ers.selection_intimation AS ersSelectionIntimation,
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
           ers.document_text_field_enabled AS ersDocumentTextFieldEnabled,
           ers.registration_status AS ersRegistrationStatus,
           ers.last_date   AS ersLastDate,
           ers.extension_enabled AS ersExtensionEnabled,
           ers.extended_date AS ersExtendedDate,
           ers.shortlisting_required AS ersShortlistingRequired,
           ers.selection_intimation AS ersSelectionIntimation,
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

  async publishCertificates(eventId, userId) {
    const [result] = await db.query(
      `UPDATE event_certificates 
       SET is_published = 1 
       WHERE event_id = ?`,
      [eventId],
    );
    return { affectedRows: result.affectedRows };
  },

  // ── Document checklist methods ──────────────────────────────
  async getDocuments(eventId) {
    const [[row]] = await db.query(
      'SELECT documents, registration_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const DEFAULT_DOCUMENTS = [
      'Proposal',
      'Budget',
      'Brochure',
      'Resource Persons',
      'Participants',
      'Feedback',
      'Photos',
      'Report',
    ];
    const stored = parseJsonHelper(row.documents, null);
    const docs =
      stored && Array.isArray(stored)
        ? stored
        : DEFAULT_DOCUMENTS.map((d) => ({ docname: d, active: false }));

    const rs = parseJsonHelper(row.registration_settings, {});
    const participants = Array.isArray(rs.participant_types) ? rs.participant_types : [];

    return { documents: docs, participants };
  },

  async toggleDocument(eventId, docname, active, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const DEFAULT_DOCUMENTS = [
      'Proposal',
      'Budget',
      'Brochure',
      'Resource Persons',
      'Participants',
      'Feedback',
      'Photos',
      'Report',
    ];
    let docs = parseJsonHelper(row.documents, null);
    if (!docs || !Array.isArray(docs)) {
      docs = DEFAULT_DOCUMENTS.map((d) => ({ docname: d, active: false }));
    }

    const idx = docs.findIndex((d) => d.docname === docname);
    if (idx !== -1) {
      docs[idx] = { ...docs[idx], active: Boolean(active) };
    } else {
      docs.push({ docname, active: Boolean(active) });
    }

    await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(docs),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  async attachDocumentFile(eventId, docname, filePath, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const DEFAULT_DOCUMENTS = [
      'Proposal',
      'Budget',
      'Brochure',
      'Resource Persons',
      'Participants',
      'Feedback',
      'Photos',
      'Report',
    ];
    let docs = parseJsonHelper(row.documents, null);
    if (!docs || !Array.isArray(docs)) {
      docs = DEFAULT_DOCUMENTS.map((d) => ({ docname: d, active: false }));
    }

    const idx = docs.findIndex((d) => d.docname === docname);
    if (idx !== -1) {
      docs[idx] = { ...docs[idx], file_path: filePath };
    } else {
      docs.push({ docname, active: false, file_path: filePath });
    }

    await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(docs),
      userId || null,
      eventId,
    ]);
    return { success: true, file_path: filePath };
  },

  async requestEdit(eventId, userId) {
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const ws = parseJsonHelper(row.workflow_state, { status: 'draft', currentStage: '' });
    ws.status = 'return';

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(ws),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  async submitForApproval(eventId, userId) {
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const ws = parseJsonHelper(row.workflow_state, { status: 'draft', currentStage: '' });
    ws.status = 'pending';

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(ws),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  // ── Event updates methods ──────────────────────────────────
  async savePublicity(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const fieldUpdates = {
      publicity: JSON.stringify(payload),
      updated_by: userId || null,
    };

    if (payload.facebook_link !== undefined) fieldUpdates.facebook_link = payload.facebook_link;
    if (payload.x_link !== undefined) fieldUpdates.x_link = payload.x_link;
    if (payload.instagram_link !== undefined) fieldUpdates.instagram_link = payload.instagram_link;
    if (payload.linkedin_link !== undefined) fieldUpdates.linkedin_link = payload.linkedin_link;

    await db.query('UPDATE events SET ? WHERE id = ?', [fieldUpdates, eventId]);
    return { success: true };
  },

  async saveParticipants(eventId, payload, userId) {
    const [[row]] = await db.query(
      'SELECT registration_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const rs = parseJsonHelper(row.registration_settings, {});
    const types = Array.isArray(rs.participant_types) ? rs.participant_types : [];

    const { type, count } = payload;
    const idx = types.findIndex((t) => t.type === type);
    if (idx !== -1) {
      types[idx] = { ...types[idx], count };
    } else {
      types.push({ type, count });
    }

    rs.participant_types = types;

    await db.query('UPDATE events SET registration_settings = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(rs),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  async saveLetters(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const docs = parseJsonHelper(row.documents, {});
    if (!docs.letters || typeof docs.letters !== 'object') docs.letters = {};

    const { section_name, active, mode, letter_date } = payload;
    if (section_name) {
      docs.letters[section_name] = { active, mode, letter_date };
    }

    await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(docs),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  async updateMailStatus(eventId, payload, userId) {
    const [[row]] = await db.query(
      'SELECT publicity, documents FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const { section } = payload;
    if (!section) return { success: false, message: 'No section provided' };

    if (['Website Scrolling', 'Newspaper Engagement', 'Press Report'].includes(section)) {
      const pub = parseJsonHelper(row.publicity, {});
      if (!pub.mail_sent_status) pub.mail_sent_status = {};
      pub.mail_sent_status[section] = true;

      await db.query('UPDATE events SET publicity = ?, updated_by = ? WHERE id = ?', [
        JSON.stringify(pub),
        userId || null,
        eventId,
      ]);
    } else {
      const docs = parseJsonHelper(row.documents, {});
      if (!docs.letters || typeof docs.letters !== 'object') docs.letters = {};
      if (!docs.letters[section]) docs.letters[section] = {};

      docs.letters[section].mail_sent = true;

      await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
        JSON.stringify(docs),
        userId || null,
        eventId,
      ]);
    }

    return { success: true };
  },

  async saveDocuments(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    let docs = parseJsonHelper(row.documents, null);

    if (docs && !Array.isArray(docs)) {
      const letters = docs.letters || {};
      const checklist = Array.isArray(docs.checklist) ? docs.checklist : [];
      const { docname, active } = payload;
      const idx = checklist.findIndex((d) => d.docname === docname);
      if (idx !== -1) {
        checklist[idx] = { ...checklist[idx], active: Boolean(active) };
      } else if (docname) {
        checklist.push({ docname, active: Boolean(active) });
      }
      docs = { letters, checklist };
    } else {
      if (!Array.isArray(docs)) docs = [];
      const { docname, active } = payload;
      const idx = docs.findIndex((d) => d.docname === docname);
      if (idx !== -1) {
        docs[idx] = { ...docs[idx], active: Boolean(active) };
      } else if (docname) {
        docs.push({ docname, active: Boolean(active) });
      }
    }

    await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(docs),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  async addResourcePerson(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const {
      resource_person_id,
      purpose,
      mode,
      session_datetime,
      topic_title,
      honorarium_amount = 0,
      travel_details,
      accommodation_required = false,
      accommodation_details,
    } = payload;

    let insertId = null;
    const safe_rp_id = resource_person_id ? resource_person_id : 0;

    try {
      const [result] = await db.query(
        `INSERT INTO event_resource_persons
           (event_id, resource_person_id, purpose, mode, session_datetime, topic_title,
            honorarium_amount, travel_details, accommodation_required, accommodation_details,
            created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          safe_rp_id,
          purpose || null,
          mode || null,
          session_datetime || null,
          topic_title || null,
          honorarium_amount || 0,
          typeof travel_details === 'string' ? travel_details : JSON.stringify(payload),
          accommodation_required ? 1 : 0,
          typeof accommodation_details === 'string'
            ? accommodation_details
            : JSON.stringify(accommodation_details || null),
          userId || null,
          userId || null,
        ],
      );
      insertId = result.insertId;
    } catch (dbErr) {
      console.warn('[eventsModel] addResourcePerson DB error:', dbErr.message);
    }

    return { success: true, resourcePerson: { id: insertId, ...payload } };
  },

  async updateResourcePerson(eventId, pid, payload, userId) {
    const [[row]] = await db.query(
      'SELECT id FROM event_resource_persons WHERE id = ? AND event_id = ? AND is_deleted = 0',
      [pid, eventId],
    );

    if (!row) {
      return { success: true };
    }

    const allowed = [
      'purpose',
      'mode',
      'session_datetime',
      'topic_title',
      'honorarium_amount',
      'travel_details',
      'accommodation_required',
      'accommodation_details',
      'invitation_sent',
      'thanks_sent',
    ];
    const updates = { updated_by: userId || null };
    for (const key of allowed) {
      if (payload[key] !== undefined) updates[key] = payload[key];
    }

    await db.query('UPDATE event_resource_persons SET ? WHERE id = ?', [updates, pid]);
    return { success: true };
  },

  async deleteResourcePerson(eventId, pid, userId) {
    const [[row]] = await db.query(
      'SELECT id FROM event_resource_persons WHERE id = ? AND event_id = ? AND is_deleted = 0',
      [pid, eventId],
    );

    if (!row) return { success: true };

    await db.query(
      'UPDATE event_resource_persons SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
      [userId || null, pid],
    );
    return { success: true };
  },

  async recordUpload(eventId, filePath, userId) {
    return { upload: { id: Date.now(), file_path: filePath } };
  },

  // ── Event Approval Workflow Engine Methods ──────────────────
  async getApprovalHistory(eventId) {
    await ensureHistoryTable();
    const [rows] = await db.query(
      'SELECT id, event_id, role, user_id, user_name, action, comments, action_at FROM event_approval_history WHERE event_id = ? ORDER BY id ASC',
      [eventId],
    );
    return rows || [];
  },

  async submitWorkflow(eventId, userId, userName, comments) {
    await ensureHistoryTable();
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const currentState = parseWorkflowState(row.workflow_state);
    if (
      currentState.status !== WORKFLOW_STAGES.DRAFT &&
      currentState.status !== WORKFLOW_STAGES.RETURN
    ) {
      throw { status: 400, message: 'Event is already submitted or in approval process' };
    }

    const nextState = {
      status: WORKFLOW_STAGES.HOD_PENDING,
      currentStage: WORKFLOW_STAGES.HOD_PENDING,
      currentApproverRole: 'HOD',
      submittedAt: new Date().toISOString(),
    };

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(nextState),
      userId || null,
      eventId,
    ]);

    await db.query(
      'INSERT INTO event_approval_history (event_id, role, user_id, user_name, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
      [
        eventId,
        'Creator',
        userId || null,
        userName || 'User',
        'SUBMITTED',
        comments || 'Submitted for HOD approval',
      ],
    );

    return { success: true, workflow_state: nextState };
  },

  async approveWorkflow(eventId, user, comments) {
    await ensureHistoryTable();
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const currentState = parseWorkflowState(row.workflow_state);
    const stage = currentState.status;

    if (
      ![
        WORKFLOW_STAGES.HOD_PENDING,
        WORKFLOW_STAGES.IQAC_PENDING,
        WORKFLOW_STAGES.PRINCIPAL_PENDING,
      ].includes(stage)
    ) {
      throw {
        status: 400,
        message: `Event is not pending approval at this stage (current status: ${stage})`,
      };
    }

    if (!canUserApproveStage(user, stage)) {
      const requiredRole = getRequiredApproverRole(stage);
      throw {
        status: 403,
        message: `Access denied. Current approval step requires ${requiredRole} role.`,
      };
    }

    const nextStage = getNextStage(stage);
    const isFinalApproval = nextStage === WORKFLOW_STAGES.APPROVED;

    const nextState = {
      status: nextStage,
      currentStage: nextStage,
      currentApproverRole: getRequiredApproverRole(nextStage),
      submittedAt: currentState.submittedAt,
      ...(isFinalApproval ? { approvedAt: new Date().toISOString() } : {}),
    };

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(nextState),
      user.id || null,
      eventId,
    ]);

    const actionMap = {
      [WORKFLOW_STAGES.HOD_PENDING]: 'HOD_APPROVED',
      [WORKFLOW_STAGES.IQAC_PENDING]: 'IQAC_APPROVED',
      [WORKFLOW_STAGES.PRINCIPAL_PENDING]: 'PRINCIPAL_APPROVED',
    };

    const action = actionMap[stage] || 'APPROVED';
    const roleUsed = getRequiredApproverRole(stage);

    await db.query(
      'INSERT INTO event_approval_history (event_id, role, user_id, user_name, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
      [
        eventId,
        roleUsed,
        user.id || null,
        user.name || user.email || 'Approver',
        action,
        comments || `${roleUsed} approved event`,
      ],
    );

    return { success: true, workflow_state: nextState };
  },

  async rejectWorkflow(eventId, user, comments) {
    await ensureHistoryTable();
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const currentState = parseWorkflowState(row.workflow_state);
    const stage = currentState.status;

    if (
      ![
        WORKFLOW_STAGES.HOD_PENDING,
        WORKFLOW_STAGES.IQAC_PENDING,
        WORKFLOW_STAGES.PRINCIPAL_PENDING,
      ].includes(stage)
    ) {
      throw { status: 400, message: `Event cannot be rejected in current state (${stage})` };
    }

    if (!canUserApproveStage(user, stage)) {
      const requiredRole = getRequiredApproverRole(stage);
      throw {
        status: 403,
        message: `Access denied. Current rejection step requires ${requiredRole} role.`,
      };
    }

    const nextState = {
      status: WORKFLOW_STAGES.RETURN,
      currentStage: WORKFLOW_STAGES.DRAFT,
      currentApproverRole: 'Creator',
      returnedFrom: stage,
      rejectedAt: new Date().toISOString(),
    };

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(nextState),
      user.id || null,
      eventId,
    ]);

    const roleUsed = getRequiredApproverRole(stage);

    await db.query(
      'INSERT INTO event_approval_history (event_id, role, user_id, user_name, action, comments) VALUES (?, ?, ?, ?, ?, ?)',
      [
        eventId,
        roleUsed,
        user.id || null,
        user.name || user.email || 'Approver',
        'REJECTED',
        comments || `Rejected by ${roleUsed} for correction`,
      ],
    );

    return { success: true, workflow_state: nextState };
  },
};

function parseJsonHelper(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_) {
    return fallback;
  }
}

export default eventsModel;
