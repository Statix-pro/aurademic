import eventDb from '../../../config/connection.js';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Helper query function
async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

// === Controllers ===

// Get full event details (Updated for frontend compatibility)
export const getEventDetails = async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    const [event] = await query('SELECT * FROM events WHERE id=?', [eventId]);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Fetch publicity data
    const publicity =
      (await query('SELECT * FROM publicity WHERE event_id=?', [eventId]))[0] ||
      null;

    // Fetch resource persons with location field
    const resourcePersons = await query(
      'SELECT id, name, designation, organization, email, linkedin, location FROM resource_persons WHERE event_id=?',
      [eventId]
    );

    // Fetch letters organized by sections
    const letters = await query('SELECT * FROM letters WHERE event_id=?', [
      eventId,
    ]);

    // Organize letters by sections for frontend compatibility
    const predefinedSections = [
      'Security Division',
      'Guest House',
      'Transport',
      'Food/ Refreshment',
      'Photography',
      'Video Recording',
    ];

    const lettersData = {};
    predefinedSections.forEach((section) => {
      const letterData = letters.find((l) => l.section_name === section);
      lettersData[section] = letterData
        ? {
          id: letterData.id,
          active: Boolean(letterData.active),
          mode: letterData.mode || 'Letter/ Email',
          date: letterData.letter_date,
          upload_id: letterData.upload_id,
          file: null, // Will be populated if upload_id exists
        }
        : {
          active: false,
          mode: 'Letter/ Email',
          date: null,
          upload_id: null,
          file: null,
        };
    });

    // Fetch uploads/files
    const uploads = await query(
      'SELECT * FROM events_uploads WHERE event_id=?',
      [eventId]
    );

    // Map uploads to letters data
    uploads.forEach((upload) => {
      Object.keys(lettersData).forEach((section) => {
        if (lettersData[section].upload_id === upload.id) {
          lettersData[section].file = {
            id: upload.id,
            filename: upload.filename,
            original_name: upload.original_name,
            mime: upload.mime,
            size: upload.size,
          };
        }
      });
    });

    // Fetch documents
    const documents = await query(
      `SELECT d.*, u.filename, u.original_name, u.mime, u.size
             FROM documents d
             LEFT JOIN events_uploads u ON d.upload_id = u.id
             WHERE d.event_id=?`,
      [eventId]
    );

    // Fetch participants
    const participants = await query(
      'SELECT * FROM participants WHERE event_id=?',
      [eventId]
    );

    // Fetch important links
    const importantLinks =
      (
        await query('SELECT * FROM important_links WHERE event_id=?', [eventId])
      )[0] || null;

    // Fetch YouTube links
    const youtubeLinks = await query(
      'SELECT * FROM youtube_links WHERE event_id=? ORDER BY sort_order',
      [eventId]
    );

    // Format response for frontend compatibility
    const response = {
      event,
      publicity,
      resourcePersons: resourcePersons.map((rp) => ({
        id: rp.id,
        name: rp.name || '',
        designation: rp.designation || '',
        organization: rp.organization || '',
        email: rp.email || '',
        linkedin: rp.linkedin || '',
        location: rp.location || '',
      })),
      letters: lettersData,
      uploads,
      documents: documents.map((doc) => ({
        id: doc.id,
        doc_name: doc.doc_name,
        active: Boolean(doc.active),
        file: doc.filename
          ? {
            id: doc.upload_id,
            filename: doc.filename,
            original_name: doc.original_name,
            mime: doc.mime,
            size: doc.size,
          }
          : null,
      })),
      participants: participants.map((p) => ({
        id: p.id,
        type: p.type,
        count: p.count || 0,
        count_verified: Boolean(p.count_verified),
      })),
      importantLinks: importantLinks
        ? {
          registration_enabled: Boolean(importantLinks.registration_enabled),
          registration_url: importantLinks.registration_url,
          feedback_enabled: Boolean(importantLinks.feedback_enabled),
          feedback_url: importantLinks.feedback_url,
          youtube_enabled: Boolean(importantLinks.youtube_enabled),
        }
        : null,
      youtubeLinks,
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Error in getEventDetails:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Update publicity info with upsert (Enhanced)
export const updatePublicity = async (req, res) => {
  try {
    const eventId = Number(req.params.id);

    const allowed = [
      'website_enabled',
      'website_date',
      'newspaper_enabled',
      'newspaper_date',
      'newspaper_upload_id',
      'press_enabled',
      'press_date',
      'press_upload_id',
      'facebook_link',
      'x_link',
      'instagram_link',
      'linkedin_link',
    ];

    const updates = [],
      values = [];
    for (const k of allowed) {
      if (req.body.hasOwnProperty(k)) {
        updates.push(`${k}=?`);
        values.push(req.body[k]);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    const existing = await query('SELECT id FROM publicity WHERE event_id=?', [
      eventId,
    ]);

    if (existing.length) {
      values.push(eventId);
      await query(
        `UPDATE publicity SET ${updates.join(',')} WHERE event_id=?`,
        values
      );
    } else {
      const cols = [
        'event_id',
        ...allowed.filter((k) => req.body.hasOwnProperty(k)),
      ];
      const vals = [eventId, ...values];
      await query(
        `INSERT INTO publicity (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        vals
      );
    }

    const updated = (
      await query('SELECT * FROM publicity WHERE event_id=?', [eventId])
    )[0];

    res.json({
      success: true,
      publicity: updated,
    });
  } catch (err) {
    console.error('❌ Error in updatePublicity:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Resource Persons (Updated for frontend compatibility)
export const addResourcePerson = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const {
      name = '',
      designation = '',
      organization = '',
      email = '',
      linkedin = '',
      location = '',
    } = req.body;

    const r = await query(
      `INSERT INTO resource_persons (event_id, name, designation, organization, email, linkedin, location)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, name, designation, organization, email, linkedin, location]
    );

    const inserted = (
      await query('SELECT * FROM resource_persons WHERE id=?', [r.insertId])
    )[0];

    res.status(201).json({
      success: true,
      resourcePerson: {
        id: inserted.id,
        name: inserted.name || '',
        designation: inserted.designation || '',
        organization: inserted.organization || '',
        email: inserted.email || '',
        linkedin: inserted.linkedin || '',
        location: inserted.location || '',
      },
    });
  } catch (err) {
    console.error('❌ Error in addResourcePerson:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const updateResourcePerson = async (req, res) => {
  try {
    const pid = Number(req.params.pid);

    const fields = [],
      vals = [];
    [
      'name',
      'designation',
      'organization',
      'email',
      'linkedin',
      'location',
    ].forEach((k) => {
      if (k in req.body) {
        fields.push(`${k}=?`);
        vals.push(req.body[k]);
      }
    });

    if (!fields.length) {
      return res.status(400).json({ error: 'No fields provided' });
    }

    vals.push(pid);
    await query(
      `UPDATE resource_persons SET ${fields.join(',')} WHERE id=?`,
      vals
    );

    const updated = (
      await query('SELECT * FROM resource_persons WHERE id=?', [pid])
    )[0];

    res.json({
      success: true,
      resourcePerson: {
        id: updated.id,
        name: updated.name || '',
        designation: updated.designation || '',
        organization: updated.organization || '',
        email: updated.email || '',
        linkedin: updated.linkedin || '',
        location: updated.location || '',
      },
    });
  } catch (err) {
    console.error('❌ Error in updateResourcePerson:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const deleteResourcePerson = async (req, res) => {
  try {
    const pid = Number(req.params.pid);

    const result = await query('DELETE FROM resource_persons WHERE id=?', [
      pid,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Resource person not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in deleteResourcePerson:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Letters (Enhanced for frontend compatibility)
export const upsertLetter = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { section_name, active, mode, letter_date, upload_id } = req.body;

    if (!section_name) {
      return res.status(400).json({ error: 'section_name required' });
    }

    const existing = await query(
      'SELECT * FROM letters WHERE event_id=? AND section_name=?',
      [eventId, section_name]
    );

    if (existing.length) {
      await query(
        `UPDATE letters SET active=?, mode=?, letter_date=?, upload_id=? WHERE id=?`,
        [
          active ? 1 : 0,
          mode || 'Letter/ Email',
          letter_date || null,
          upload_id || null,
          existing[0].id,
        ]
      );

      const updated = (
        await query('SELECT * FROM letters WHERE id=?', [existing[0].id])
      )[0];

      res.json({
        success: true,
        letter: {
          id: updated.id,
          section_name: updated.section_name,
          active: Boolean(updated.active),
          mode: updated.mode,
          letter_date: updated.letter_date,
          upload_id: updated.upload_id,
        },
      });
    } else {
      const r = await query(
        `INSERT INTO letters (event_id, section_name, active, mode, letter_date, upload_id)
                 VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          section_name,
          active ? 1 : 0,
          mode || 'Letter/ Email',
          letter_date || null,
          upload_id || null,
        ]
      );

      const inserted = (
        await query('SELECT * FROM letters WHERE id=?', [r.insertId])
      )[0];

      res.status(201).json({
        success: true,
        letter: {
          id: inserted.id,
          section_name: inserted.section_name,
          active: Boolean(inserted.active),
          mode: inserted.mode,
          letter_date: inserted.letter_date,
          upload_id: inserted.upload_id,
        },
      });
    }
  } catch (err) {
    console.error('❌ Error in upsertLetter:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Documents Management
export const upsertDocument = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { doc_name, active, upload_id } = req.body;

    if (!doc_name) {
      return res.status(400).json({ error: 'doc_name required' });
    }

    const existing = await query(
      'SELECT * FROM documents WHERE event_id=? AND doc_name=?',
      [eventId, doc_name]
    );

    if (existing.length) {
      await query('UPDATE documents SET active=?, upload_id=? WHERE id=?', [
        active ? 1 : 0,
        upload_id || null,
        existing[0].id,
      ]);

      const updated = (
        await query('SELECT * FROM documents WHERE id=?', [existing[0].id])
      )[0];
      res.json({ success: true, document: updated });
    } else {
      const r = await query(
        'INSERT INTO documents (event_id, doc_name, active, upload_id) VALUES (?, ?, ?, ?)',
        [eventId, doc_name, active ? 1 : 0, upload_id || null]
      );

      const inserted = (
        await query('SELECT * FROM documents WHERE id=?', [r.insertId])
      )[0];
      res.status(201).json({ success: true, document: inserted });
    }
  } catch (err) {
    console.error('❌ Error in upsertDocument:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Participants Management
export const upsertParticipant = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { type, count, count_verified } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'type required' });
    }

    const existing = await query(
      'SELECT * FROM participants WHERE event_id=? AND type=?',
      [eventId, type]
    );

    if (existing.length) {
      await query(
        'UPDATE participants SET count=?, count_verified=? WHERE id=?',
        [parseInt(count) || 0, count_verified ? 1 : 0, existing[0].id]
      );

      const updated = (
        await query('SELECT * FROM participants WHERE id=?', [existing[0].id])
      )[0];
      res.json({ success: true, participant: updated });
    } else {
      const r = await query(
        'INSERT INTO participants (event_id, type, count, count_verified) VALUES (?, ?, ?, ?)',
        [eventId, type, parseInt(count) || 0, count_verified ? 1 : 0]
      );

      const inserted = (
        await query('SELECT * FROM participants WHERE id=?', [r.insertId])
      )[0];
      res.status(201).json({ success: true, participant: inserted });
    }
  } catch (err) {
    console.error('❌ Error in upsertParticipant:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Important Links Management
export const upsertImportantLinks = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const {
      registration_enabled,
      registration_url,
      feedback_enabled,
      feedback_url,
      youtube_enabled,
    } = req.body;

    const existing = await query(
      'SELECT id FROM important_links WHERE event_id=?',
      [eventId]
    );

    if (existing.length) {
      await query(
        `UPDATE important_links SET registration_enabled=?, registration_url=?, 
                 feedback_enabled=?, feedback_url=?, youtube_enabled=? WHERE event_id=?`,
        [
          registration_enabled ? 1 : 0,
          registration_url || null,
          feedback_enabled ? 1 : 0,
          feedback_url || null,
          youtube_enabled ? 1 : 0,
          eventId,
        ]
      );
    } else {
      await query(
        `INSERT INTO important_links (event_id, registration_enabled, registration_url, 
                 feedback_enabled, feedback_url, youtube_enabled) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          registration_enabled ? 1 : 0,
          registration_url || null,
          feedback_enabled ? 1 : 0,
          feedback_url || null,
          youtube_enabled ? 1 : 0,
        ]
      );
    }

    const updated = (
      await query('SELECT * FROM important_links WHERE event_id=?', [eventId])
    )[0];
    res.json({ success: true, importantLinks: updated });
  } catch (err) {
    console.error('❌ Error in upsertImportantLinks:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// YouTube Links Management
export const addYouTubeLink = async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { url, enabled = true, sort_order = 0 } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url required' });
    }

    const r = await query(
      'INSERT INTO youtube_links (event_id, url, enabled, sort_order) VALUES (?, ?, ?, ?)',
      [eventId, url, enabled ? 1 : 0, parseInt(sort_order) || 0]
    );

    const inserted = (
      await query('SELECT * FROM youtube_links WHERE id=?', [r.insertId])
    )[0];
    res.status(201).json({ success: true, youtubeLink: inserted });
  } catch (err) {
    console.error('❌ Error in addYouTubeLink:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Uploads (Enhanced)
export const handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const eventId = Number(req.params.id);
    const { filename, originalname, mimetype, size } = req.file;

    const r = await query(
      `INSERT INTO events_uploads (event_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)`,
      [eventId, filename, originalname, mimetype, size]
    );

    const inserted = (
      await query('SELECT * FROM events_uploads WHERE id=?', [r.insertId])
    )[0];

    res.status(201).json({
      success: true,
      upload: inserted,
      url: `/uploads/${inserted.filename}`,
    });
  } catch (err) {
    console.error('❌ Error in handleUpload:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const deleteUpload = async (req, res) => {
  try {
    const uid = Number(req.params.uid);

    const rows = await query('SELECT * FROM events_uploads WHERE id=?', [uid]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const filepath = path.join(UPLOAD_DIR, rows[0].filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    await query('DELETE FROM events_uploads WHERE id=?', [uid]);

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error in deleteUpload:', err.message);
    res.status(500).json({ error: err.message });
  }
};
