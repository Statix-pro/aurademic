import db from '../../../config/connection.js';

// The event document checklist is stored in the `documents` JSON column on the
// events row.  Each entry looks like: { docname: "Proposal", active: true }.
// Participant-type counts are stored in registration_settings.participant_types.

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

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_) {
    return fallback;
  }
}

const documentsModel = {
  // ─────────────────────────────────────────────────────────
  // GET /documents/:eventId
  // Returns the current checklist and participant type counts.
  // ─────────────────────────────────────────────────────────
  async getDocuments(eventId) {
    const [[row]] = await db.query(
      'SELECT documents, registration_settings FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    // Hydrate checklist – seed defaults when null
    const stored = parseJson(row.documents, null);
    const docs =
      stored && Array.isArray(stored)
        ? stored
        : DEFAULT_DOCUMENTS.map((d) => ({ docname: d, active: false }));

    // Participant types are stored inside registration_settings
    const rs = parseJson(row.registration_settings, {});
    const participants = Array.isArray(rs.participant_types) ? rs.participant_types : [];

    return { documents: docs, participants };
  },

  // ─────────────────────────────────────────────────────────
  // PUT /documents/:eventId/doc/:docname
  // Toggle a single document's active state.
  // ─────────────────────────────────────────────────────────
  async toggleDocument(eventId, docname, active, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    let docs = parseJson(row.documents, null);
    if (!docs || !Array.isArray(docs)) {
      docs = DEFAULT_DOCUMENTS.map((d) => ({ docname: d, active: false }));
    }

    const idx = docs.findIndex((d) => d.docname === docname);
    if (idx !== -1) {
      docs[idx] = { ...docs[idx], active: Boolean(active) };
    } else {
      // New document name – add it
      docs.push({ docname, active: Boolean(active) });
    }

    await db.query('UPDATE events SET documents = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(docs),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // POST /documents/:eventId/doc/:docname/upload
  // Stores the file path reference in the document entry.
  // ─────────────────────────────────────────────────────────
  async attachDocumentFile(eventId, docname, filePath, userId) {
    const [[row]] = await db.query('SELECT documents FROM events WHERE id = ? AND is_deleted = 0', [
      eventId,
    ]);
    if (!row) throw { status: 404, message: 'Event not found' };

    let docs = parseJson(row.documents, null);
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

  // ─────────────────────────────────────────────────────────
  // POST /documents/:eventId/edit-request
  // Sets workflow_state.status = 'return' to signal an edit.
  // ─────────────────────────────────────────────────────────
  async requestEdit(eventId, userId) {
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const ws = parseJson(row.workflow_state, { status: 'draft', currentStage: '' });
    ws.status = 'return';

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(ws),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },

  // ─────────────────────────────────────────────────────────
  // POST /documents/:eventId/submit
  // Sets workflow_state.status = 'pending' (awaiting approval).
  // ─────────────────────────────────────────────────────────
  async submitForApproval(eventId, userId) {
    const [[row]] = await db.query(
      'SELECT workflow_state FROM events WHERE id = ? AND is_deleted = 0',
      [eventId],
    );
    if (!row) throw { status: 404, message: 'Event not found' };

    const ws = parseJson(row.workflow_state, { status: 'draft', currentStage: '' });
    ws.status = 'pending';

    await db.query('UPDATE events SET workflow_state = ?, updated_by = ? WHERE id = ?', [
      JSON.stringify(ws),
      userId || null,
      eventId,
    ]);
    return { success: true };
  },
};

export default documentsModel;
