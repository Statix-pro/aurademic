import eventDb from '../../../config/connection.js';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Helper query function
async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

// 🔹 Get all documents + participants for an event (Enhanced for frontend compatibility)
export const getDocumentsAndParticipants = async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    const documents = await query(
      `SELECT d.id, d.doc_name as docName, d.active, 
              u.id as upload_id, u.filename, u.original_name as originalName,
              u.mime, u.size, u.uploaded_at as uploadedAt
       FROM documents d 
       LEFT JOIN events_uploads u ON d.upload_id = u.id 
       WHERE d.event_id=?
       ORDER BY d.doc_name`,
      [eventId]
    );
    const participants = await query(
      `SELECT id, type, count, count_verified 
       FROM participants 
       WHERE event_id=?
       ORDER BY type`,
      [eventId]
    );

    // Transform documents for frontend compatibility
    const transformedDocuments = documents.map((doc) => ({
      id: doc.id,
      docName: doc.docName,
      active: Boolean(doc.active),
      upload: doc.upload_id
        ? {
          id: doc.upload_id,
          filename: doc.filename,
          originalName: doc.originalName,
          mime: doc.mime,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
        }
        : null,
    }));

    // Transform participants for frontend compatibility
    const participantTypeMap = {
      'internal-students': 'Internal Students',
      'external-students': 'External Students',
      faculty: 'Faculty Members',
      'research-scholars': 'Research Scholars',
      'industry-experts': 'Industry Experts',
      alumni: 'Alumni',
      'general-public': 'General Public',
    };

    const transformedParticipants = participants.map((p) => ({
      id: p.id,
      type: p.type,
      label: participantTypeMap[p.type] || p.type,
      count: p.count || 0,
      count_verified: Boolean(p.count_verified),
    }));

    res.status(200).json({
      documents: transformedDocuments,
      participants: transformedParticipants,
    });
  } catch (err) {
    console.error('❌ Error in getDocumentsAndParticipants:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Toggle or update a document entry (Enhanced for frontend compatibility)
export const updateDocument = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const docName = decodeURIComponent(req.params.docName);
  const { active, upload_id } = req.body;

  try {
    const existing = await query(
      'SELECT id, active, upload_id FROM documents WHERE doc_name=? AND event_id=?',
      [docName, eventId]
    );

    let documentId;
    let wasUpdated = false;

    if (existing.length === 0) {
      const [result] = await eventDb.query(
        'INSERT INTO documents (doc_name, active, upload_id, event_id) VALUES (?, ?, ?, ?)',
        [docName, active ? 1 : 0, upload_id || null, eventId]
      );
      documentId = result.insertId;
    } else {
      documentId = existing[0].id;
      // Check if update is actually needed
      const currentActive = Boolean(existing[0].active);
      const currentUploadId = existing[0].upload_id;

      if (
        currentActive !== Boolean(active) ||
        currentUploadId !== (upload_id || null)
      ) {
        await query('UPDATE documents SET active=?, upload_id=? WHERE id=?', [
          active ? 1 : 0,
          upload_id || null,
          documentId,
        ]);
        wasUpdated = true;
      }
    }

    // Fetch the updated/created document with upload details
    const [updated] = await query(
      `SELECT d.id, d.doc_name as docName, d.active,
              u.id as upload_id, u.filename, u.original_name as originalName,
              u.mime, u.size, u.uploaded_at as uploadedAt
       FROM documents d
       LEFT JOIN events_uploads u ON d.upload_id = u.id 
       WHERE d.id=?`,
      [documentId]
    );

    const response = {
      id: updated.id,
      docName: updated.docName,
      active: Boolean(updated.active),
      upload: updated.upload_id
        ? {
          id: updated.upload_id,
          filename: updated.filename,
          originalName: updated.originalName,
          mime: updated.mime,
          size: updated.size,
          uploadedAt: updated.uploadedAt,
        }
        : null,
      wasCreated: existing.length === 0,
      wasUpdated,
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Error in updateDocument:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Add / update participant (Enhanced for frontend compatibility)
export const upsertParticipant = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const { type, count, count_verified = false } = req.body;

  try {
    // Check if event exists
    const eventCheck = await query('SELECT id FROM events WHERE id=?', [
      eventId,
    ]);
    if (!eventCheck.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Participant type is required' });
    }

    const participantCount = parseInt(count) || 0;
    if (participantCount < 0) {
      return res
        .status(400)
        .json({ error: 'Participant count must be non-negative' });
    }

    const existing = await query(
      'SELECT id, count, count_verified FROM participants WHERE event_id=? AND type=?',
      [eventId, type]
    );

    let participantId;
    let wasCreated = false;

    if (existing.length === 0) {
      const [result] = await eventDb.query(
        'INSERT INTO participants (event_id, type, count, count_verified) VALUES (?, ?, ?, ?)',
        [eventId, type, participantCount, count_verified ? 1 : 0]
      );
      participantId = result.insertId;
      wasCreated = true;
    } else {
      participantId = existing[0].id;
      await query(
        'UPDATE participants SET count=?, count_verified=? WHERE id=?',
        [participantCount, count_verified ? 1 : 0, participantId]
      );
    }

    // Fetch all updated participants for the event
    const allParticipants = await query(
      'SELECT id, type, count, count_verified FROM participants WHERE event_id=? ORDER BY type',
      [eventId]
    );

    // Transform for frontend compatibility
    const participantTypeMap = {
      'internal-students': 'Internal Students',
      'external-students': 'External Students',
      faculty: 'Faculty Members',
      'research-scholars': 'Research Scholars',
      'industry-experts': 'Industry Experts',
      alumni: 'Alumni',
      'general-public': 'General Public',
    };

    const transformedParticipants = allParticipants.map((p) => ({
      id: p.id,
      type: p.type,
      label: participantTypeMap[p.type] || p.type,
      count: p.count || 0,
      count_verified: Boolean(p.count_verified),
    }));

    res.json({
      success: true,
      participants: transformedParticipants,
      updatedParticipant: {
        id: participantId,
        type,
        label: participantTypeMap[type] || type,
        count: participantCount,
        count_verified: Boolean(count_verified),
        wasCreated,
      },
    });
  } catch (err) {
    console.error('❌ Error in upsertParticipant:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Delete a participant (Enhanced with better error handling)
export const deleteParticipant = async (req, res) => {
  const participantId = Number(req.params.participantId);

  try {
    // First check if participant exists and get event_id for response
    const [existing] = await query(
      'SELECT event_id, type FROM participants WHERE id=?',
      [participantId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const eventId = existing.event_id;

    const result = await query('DELETE FROM participants WHERE id=?', [
      participantId,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: 'Participant not found or already deleted' });
    }

    // Fetch remaining participants for the event
    const remainingParticipants = await query(
      'SELECT id, type, count, count_verified FROM participants WHERE event_id=? ORDER BY type',
      [eventId]
    );

    // Transform for frontend compatibility
    const participantTypeMap = {
      'internal-students': 'Internal Students',
      'external-students': 'External Students',
      faculty: 'Faculty Members',
      'research-scholars': 'Research Scholars',
      'industry-experts': 'Industry Experts',
      alumni: 'Alumni',
      'general-public': 'General Public',
    };

    const transformedParticipants = remainingParticipants.map((p) => ({
      id: p.id,
      type: p.type,
      label: participantTypeMap[p.type] || p.type,
      count: p.count || 0,
      count_verified: Boolean(p.count_verified),
    }));

    res.json({
      success: true,
      message: 'Participant deleted successfully',
      deletedParticipantId: participantId,
      remainingParticipants: transformedParticipants,
    });
  } catch (err) {
    console.error('❌ Error in deleteParticipant:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Upload document file (Enhanced with better error handling and validation)
export const uploadDocumentFile = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const docName = decodeURIComponent(req.params.docName);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, originalname, mimetype, size } = req.file;

    // Validate file size (example: 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (size > maxSize) {
      // Clean up uploaded file
      const filepath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      return res.status(400).json({ error: 'File size exceeds 10MB limit' });
    }

    // Insert upload record
    const [uploadResult] = await eventDb.query(
      `INSERT INTO events_uploads (event_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)`,
      [eventId, filename, originalname, mimetype, size]
    );

    // Update or create document with upload_id
    const existing = await query(
      'SELECT id, active FROM documents WHERE doc_name=? AND event_id=?',
      [docName, eventId]
    );

    let documentId;
    if (existing.length === 0) {
      const [docResult] = await db.query(
        'INSERT INTO documents (doc_name, active, upload_id, event_id) VALUES (?, ?, ?, ?)',
        [docName, 1, uploadResult.insertId, eventId]
      );
      documentId = docResult.insertId;
    } else {
      documentId = existing[0].id;
      await query('UPDATE documents SET upload_id=?, active=1 WHERE id=?', [
        uploadResult.insertId,
        documentId,
      ]);
    }

    // Fetch the complete upload record
    const [inserted] = await query(
      'SELECT id, event_id, filename, original_name as originalName, mime, size, uploaded_at as uploadedAt FROM events_uploads WHERE id=?',
      [uploadResult.insertId]
    );

    const response = {
      success: true,
      upload: {
        id: inserted.id,
        filename: inserted.filename,
        originalName: inserted.originalName,
        mime: inserted.mime,
        size: inserted.size,
        uploadedAt: inserted.uploadedAt,
      },
      document: {
        id: documentId,
        docName,
        active: true,
        upload_id: uploadResult.insertId,
      },
      url: `/uploads/${inserted.filename}`,
      message: 'File uploaded successfully',
    };

    res.status(201).json(response);
  } catch (err) {
    console.error('❌ Error in uploadDocumentFile:', err.message);
    console.error('❌ Full error details:', err);

    // Clean up uploaded file in case of error
    if (req.file && req.file.filename) {
      const filepath = path.join(UPLOAD_DIR, req.file.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    res.status(500).json({ error: err.message });
  }
};

// 🔹 Important Links Management - UPGRADED WITH FULL DB INTEGRATION
export const getImportantLinks = async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    const mainLinks = await query(
      `SELECT registration_enabled, registration_url, feedback_enabled, feedback_url, youtube_enabled
        FROM important_links WHERE event_id=?`,
      [eventId]
    );

    const links = mainLinks.length > 0 ? mainLinks[0] : {};

    const youtubeLinks = await query(
      'SELECT id, url, enabled, sort_order FROM youtube_links WHERE event_id=? ORDER BY sort_order',
      [eventId]
    );

    const result = {
      registration: {
        enabled: Boolean(links.registration_enabled),
        url: links.registration_url || '',
      },
      feedback: {
        enabled: Boolean(links.feedback_enabled),
        url: links.feedback_url || '',
      },
      youtube:
        youtubeLinks.length > 0
          ? youtubeLinks.map((yt) => ({
            id: yt.id,
            enabled: Boolean(yt.enabled),
            url: yt.url || '',
            sort_order: yt.sort_order,
          }))
          : [{ enabled: false, url: '' }],
    };

    res.json(result);
  } catch (err) {
    console.error('❌ Error in getImportantLinks:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updateImportantLinks = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const { registration, feedback, youtube } = req.body;

  const conn = await eventDb.getConnection();
  try {
    await conn.beginTransaction();

    const existing = await query(
      'SELECT id FROM important_links WHERE event_id=?',
      [eventId]
    );

    if (existing.length) {
      await conn.query(
        `UPDATE important_links SET
          registration_enabled=?, registration_url=?,
          feedback_enabled=?, feedback_url=?,
          youtube_enabled=?, updated_at=CURRENT_TIMESTAMP
          WHERE event_id=?`,
        [
          registration?.enabled ? 1 : 0,
          registration?.url || null,
          feedback?.enabled ? 1 : 0,
          feedback?.url || null,
          youtube?.length > 0 && youtube[0]?.enabled ? 1 : 0,
          eventId,
        ]
      );
    } else {
      await conn.query(
        `INSERT INTO important_links
          (event_id, registration_enabled, registration_url, feedback_enabled, feedback_url, youtube_enabled)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          registration?.enabled ? 1 : 0,
          registration?.url || null,
          feedback?.enabled ? 1 : 0,
          feedback?.url || null,
          youtube?.length > 0 && youtube[0]?.enabled ? 1 : 0,
        ]
      );
    }

    await conn.query('DELETE FROM youtube_links WHERE event_id=?', [eventId]);

    if (youtube && youtube.length > 0) {
      for (let i = 0; i < youtube.length; i++) {
        const yt = youtube[i];
        if (yt.url && yt.url.trim()) {
          await conn.query(
            'INSERT INTO youtube_links (event_id, url, enabled, sort_order) VALUES (?, ?, ?, ?)',
            [eventId, yt.url.trim(), yt.enabled ? 1 : 0, i]
          );
        }
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: 'Important links updated successfully',
      updated: {
        registration: Boolean(registration?.enabled),
        feedback: Boolean(feedback?.enabled),
        youtube_count: youtube?.length || 0,
      },
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// 🔹 Submit for approval - ENHANCED WITH DUPLICATE PREVENTION
export const submitForApproval = async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    const eventCheck = await query(
      'SELECT id, title, status FROM events WHERE id=?',
      [eventId]
    );

    if (!eventCheck.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck[0];

    if (event.status === 'submitted') {
      return res.status(400).json({
        error: 'Event has already been submitted for approval',
        currentStatus: event.status,
        eventTitle: event.title,
      });
    }

    if (event.status === 'approved') {
      return res.status(400).json({
        error: 'Event has already been approved',
        currentStatus: event.status,
        eventTitle: event.title,
      });
    }

    const updateResult = await query(
      "UPDATE events SET status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [eventId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Failed to update event status' });
    }

    res.json({
      success: true,
      message: 'Event submitted for approval successfully',
      eventId,
      eventTitle: event.title,
      previousStatus: event.status,
      newStatus: 'submitted',
      submittedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Error in submitForApproval:', err.message);
    console.error('❌ Full error details:', err);

    // Handle case where status column doesn't exist yet
    if (
      err.message.includes('Unknown column') ||
      err.message.includes('status')
    ) {
      try {
        const updateResult = await query(
          'UPDATE events SET updated_at=CURRENT_TIMESTAMP WHERE id=?',
          [eventId]
        );

        if (updateResult.affectedRows > 0) {
          res.json({
            success: true,
            message: 'Event submitted for approval successfully (legacy mode)',
            eventId,
            submittedAt: new Date().toISOString(),
          });
        } else {
          res.status(404).json({ error: 'Event not found' });
        }
      } catch (fallbackErr) {
        res.status(500).json({ error: fallbackErr.message });
      }
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// 🔹 Request edit - ENHANCED WITH STATUS TRACKING
export const requestEdit = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const { reason } = req.body;

  try {
    const eventCheck = await query(
      'SELECT id, title, status FROM events WHERE id=?',
      [eventId]
    );

    if (!eventCheck.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck[0];

    const updateResult = await query(
      "UPDATE events SET status='draft', updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [eventId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: 'Failed to process edit request' });
    }

    res.json({
      success: true,
      message: 'Edit request sent successfully',
      eventId,
      eventTitle: event.title,
      previousStatus: event.status,
      newStatus: 'draft',
      reason: reason || 'No reason provided',
      requestedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Error in requestEdit:', err.message);
    console.error('❌ Full error details:', err);

    // Handle case where status column doesn't exist yet
    if (
      err.message.includes('Unknown column') ||
      err.message.includes('status')
    ) {
      try {
        const updateResult = await query(
          'UPDATE events SET updated_at=CURRENT_TIMESTAMP WHERE id=?',
          [eventId]
        );

        if (updateResult.affectedRows > 0) {
          res.json({
            success: true,
            message: 'Edit request sent successfully (legacy mode)',
            eventId,
            reason: reason || 'No reason provided',
            requestedAt: new Date().toISOString(),
          });
        } else {
          res.status(404).json({ error: 'Event not found' });
        }
      } catch (fallbackErr) {
        res.status(500).json({ error: fallbackErr.message });
      }
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// 🔹 Get event status (Enhanced with comprehensive event info)
export const getEventStatus = async (req, res) => {
  const eventId = Number(req.params.eventId);

  try {
    const eventData = await query(
      'SELECT id, title, status, created_at, updated_at FROM events WHERE id=?',
      [eventId]
    );

    if (!eventData.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventData[0];

    // Get additional statistics
    const [docCount] = await query(
      'SELECT COUNT(*) as count FROM documents WHERE event_id=? AND active=1',
      [eventId]
    );

    const [participantCount] = await query(
      'SELECT COALESCE(SUM(count), 0) as total FROM participants WHERE event_id=?',
      [eventId]
    );

    const response = {
      event: {
        id: event.id,
        title: event.title,
        status: event.status || 'draft',
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      },
      statistics: {
        activeDocuments: docCount?.count || 0,
        totalParticipants: participantCount?.total || 0,
      },
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Error in getEventStatus:', err.message);
    console.error('❌ Full error details:', err);

    // Handle case where status column doesn't exist yet
    if (
      err.message.includes('Unknown column') ||
      err.message.includes('status')
    ) {
      try {
        const eventData = await query(
          'SELECT id, title, created_at, updated_at FROM events WHERE id=?',
          [eventId]
        );

        if (eventData.length) {
          const event = eventData[0];
          res.json({
            event: {
              id: event.id,
              title: event.title,
              status: 'draft',
              createdAt: event.created_at,
              updatedAt: event.updated_at,
            },
            statistics: {
              activeDocuments: 0,
              totalParticipants: 0,
            },
          });
        } else {
          res.status(404).json({ error: 'Event not found' });
        }
      } catch (fallbackErr) {
        res.status(500).json({ error: fallbackErr.message });
      }
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

// 🔹 Delete upload (Enhanced with comprehensive cleanup)
export const deleteUpload = async (req, res) => {
  const uploadId = Number(req.params.uploadId);

  try {
    const uploadData = await query('SELECT * FROM events_uploads WHERE id=?', [
      uploadId,
    ]);

    if (!uploadData.length) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const uploadRecord = uploadData[0];

    // Check if upload is referenced by documents
    const referencingDocs = await query(
      'SELECT id, doc_name FROM documents WHERE upload_id=?',
      [uploadId]
    );

    if (referencingDocs.length > 0) {
      // Clear references before deletion
      await query('UPDATE documents SET upload_id=NULL WHERE upload_id=?', [
        uploadId,
      ]);
    }

    // Remove physical file
    const filepath = path.join(UPLOAD_DIR, uploadRecord.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Remove database record
    const deleteResult = await query('DELETE FROM events_uploads WHERE id=?', [
      uploadId,
    ]);

    res.json({
      success: true,
      message: 'Upload deleted successfully',
      deletedUpload: {
        id: uploadRecord.id,
        filename: uploadRecord.filename,
        originalName: uploadRecord.original_name,
      },
      clearedDocumentReferences: referencingDocs.length,
    });
  } catch (err) {
    console.error('❌ Error in deleteUpload:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get upload file details (Enhanced with comprehensive info)
export const getUploadDetails = async (req, res) => {
  const uploadId = Number(req.params.uploadId);

  try {
    const uploadData = await query(
      `SELECT id, event_id, filename, original_name, mime, size, uploaded_at
        FROM events_uploads WHERE id=?`,
      [uploadId]
    );

    if (!uploadData.length) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const upload = uploadData[0];

    // Check if upload is used by documents
    const referencingDocs = await query(
      'SELECT id, doc_name FROM documents WHERE upload_id=?',
      [uploadId]
    );

    const response = {
      upload: {
        id: upload.id,
        eventId: upload.event_id,
        filename: upload.filename,
        originalName: upload.original_name,
        mime: upload.mime,
        size: upload.size,
        uploadedAt: upload.uploaded_at,
      },
      url: `/uploads/${upload.filename}`,
      referencedBy: referencingDocs.map((doc) => ({
        documentId: doc.id,
        documentName: doc.doc_name,
        active: Boolean(doc.active),
      })),
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Error in getUploadDetails:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get document by name (NEW - for frontend convenience)
export const getDocumentByName = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const docName = decodeURIComponent(req.params.docName);

  try {
    const docData = await query(
      `SELECT d.id, d.doc_name as docName, d.active,
               u.id as upload_id, u.filename, u.original_name as originalName,
               u.mime, u.size, u.uploaded_at as uploadedAt
        FROM documents d
        LEFT JOIN events_uploads u ON d.upload_id = u.id
        WHERE d.event_id=? AND d.doc_name=?`,
      [eventId, docName]
    );

    if (!docData.length) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docData[0];
    const response = {
      id: doc.id,
      docName: doc.docName,
      active: Boolean(doc.active),
      upload: doc.upload_id
        ? {
          id: doc.upload_id,
          filename: doc.filename,
          originalName: doc.originalName,
          mime: doc.mime,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
        }
        : null,
    };

    res.json(response);
  } catch (err) {
    console.error('❌ Error in getDocumentByName:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Bulk update documents (NEW - for frontend efficiency)
export const bulkUpdateDocuments = async (req, res) => {
  const eventId = Number(req.params.eventId);
  const { documents } = req.body;

  if (!documents || !Array.isArray(documents)) {
    return res.status(400).json({ error: 'Documents array is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const results = [];

    for (const doc of documents) {
      const { docName, active, upload_id } = doc;

      if (!docName) {
        continue;
      }

      const existing = await query(
        'SELECT id, active FROM documents WHERE doc_name=? AND event_id=?',
        [docName, eventId]
      );

      if (existing.length) {
        await conn.query(
          'UPDATE documents SET active=?, upload_id=? WHERE id=?',
          [active ? 1 : 0, upload_id || null, existing[0].id]
        );
        results.push({ docName, action: 'updated', id: existing[0].id });
      } else {
        const [result] = await conn.query(
          'INSERT INTO documents (doc_name, active, upload_id, event_id) VALUES (?, ?, ?, ?)',
          [docName, active ? 1 : 0, upload_id || null, eventId]
        );
        results.push({ docName, action: 'created', id: result.insertId });
      }
    }

    await conn.commit();

    res.json({
      success: true,
      message: `Successfully processed ${results.length} documents`,
      results,
    });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error in bulkUpdateDocuments:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};
