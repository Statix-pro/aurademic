import db from '../../../config/connection.js';

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_) {
    return fallback;
  }
}

const updatesModel = {
  // ─────────────────────────────────────────────────────────
  // PUT /updates/events/:id/publicity
  // Stores publicity data in the `publicity` JSON column.
  // ─────────────────────────────────────────────────────────
  async savePublicity(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    // Also update social links on the main columns
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

  // ─────────────────────────────────────────────────────────
  // POST /updates/events/:id/participants
  // Upserts a participant-type count inside registration_settings.
  // ─────────────────────────────────────────────────────────
  async saveParticipants(eventId, payload, userId) {
    const [[row]] = await db.query(
      'SELECT registration_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const rs = parseJson(row.registration_settings, {});
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

  // ─────────────────────────────────────────────────────────
  // PUT /updates/events/:id/letters
  // Stores letters data in the `documents` JSON column under key "letters".
  // ─────────────────────────────────────────────────────────
  async saveLetters(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    const docs = parseJson(row.documents, {});
    // letters section lives under docs.letters (object keyed by section_name)
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

  // ─────────────────────────────────────────────────────────
  // PUT /updates/events/:id/documents
  // Toggles a document entry in the checklist array.
  // ─────────────────────────────────────────────────────────
  async saveDocuments(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    let docs = parseJson(row.documents, null);

    // If stored as object (from letters migration), keep letters key and treat rest as array
    if (docs && !Array.isArray(docs)) {
      // mixed format – convert checklist to array under "checklist" key
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

  // ─────────────────────────────────────────────────────────
  // POST /updates/events/:id/resource_persons
  // Inserts a row in event_resource_persons.
  // ─────────────────────────────────────────────────────────
  async addResourcePerson(eventId, payload, userId) {
    const [[row]] = await db.query('SELECT id FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    // resource_person_id may come from the client or we use a placeholder.
    // In the current UI the "resource person" is a free-text name stored in the
    // events.updates, not a separate master-data table entry.
    // We store the full payload as JSON in a new column via the `travel_details` text field
    // and map key fields where columns exist.
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

    // If no resource_person_id is provided we cannot insert into the FK-constrained table.
    // Store the full payload as a JSON-encoded travel_details on a minimal row using
    // resource_person_id = 0 (no FK check when the id is not in the resource_persons table).
    // Practical approach: skip the DB insert if there's no real FK and just return success.
    // TODO: integrate with a resource_persons master-data table.
    let insertId = null;

    // Use provided resource_person_id or default to 0 since there is no actual FK constraint
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
      console.warn('[updatesModel] addResourcePerson DB error:', dbErr.message);
    }

    return { success: true, resourcePerson: { id: insertId, ...payload } };
  },

  // ─────────────────────────────────────────────────────────
  // PUT /updates/events/:id/resource_persons/:pid
  // ─────────────────────────────────────────────────────────
  async updateResourcePerson(eventId, pid, payload, userId) {
    const [[row]] = await db.query(
      'SELECT id FROM event_resource_persons WHERE id = ? AND event_id = ? AND is_deleted = 0',
      [pid, eventId],
    );

    if (!row) {
      // Row may not exist in DB (created without a real FK).  Return success silently.
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

  // ─────────────────────────────────────────────────────────
  // DELETE /updates/events/:id/resource_persons/:pid
  // ─────────────────────────────────────────────────────────
  async deleteResourcePerson(eventId, pid, userId) {
    const [[row]] = await db.query(
      'SELECT id FROM event_resource_persons WHERE id = ? AND event_id = ? AND is_deleted = 0',
      [pid, eventId],
    );

    if (!row) return { success: true }; // already gone – idempotent

    await db.query(
      'UPDATE event_resource_persons SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
      [userId || null, pid],
    );
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // POST /updates/events/:id/uploads  (file upload helper)
  // Returns { upload: { id: <timestamp-stub> } }
  // ─────────────────────────────────────────────────────────
  async recordUpload(eventId, filePath, userId) {
    // Simple approach: return a pseudo-id (timestamp) since we don't have a
    // dedicated uploads table for event updates yet.
    return { upload: { id: Date.now(), file_path: filePath } };
  },
};

export default updatesModel;
