import path from 'path';
import { fileURLToPath } from 'url';

import multer from 'multer';

import documentsModel from './documentsModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File storage – event documents go to uploads/event-documents/
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'event-documents'));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `evt-doc-${Date.now()}${ext}`);
  },
});

export const documentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const documentsController = {
  // GET /api/documents/:eventId
  async getDocuments(req, res) {
    try {
      const { eventId } = req.params;
      const data = await documentsModel.getDocuments(Number(eventId));
      return res.json(data);
    } catch (err) {
      console.error('[documentsController] getDocuments error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to fetch documents', details: err.message });
    }
  },

  // PUT /api/documents/:eventId/doc/:docname
  async toggleDocument(req, res) {
    try {
      const { eventId, docname } = req.params;
      const { active } = req.body;
      const userId = req.user?.id;
      const result = await documentsModel.toggleDocument(
        Number(eventId),
        decodeURIComponent(docname),
        active,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[documentsController] toggleDocument error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update document', details: err.message });
    }
  },

  // POST /api/documents/:eventId/doc/:docname/upload
  async uploadDocument(req, res) {
    try {
      const { eventId, docname } = req.params;
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = `/uploads/event-documents/${req.file.filename}`;
      const result = await documentsModel.attachDocumentFile(
        Number(eventId),
        decodeURIComponent(docname),
        filePath,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[documentsController] uploadDocument error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to upload document', details: err.message });
    }
  },

  // POST /api/documents/:eventId/edit-request
  async requestEdit(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;
      const result = await documentsModel.requestEdit(Number(eventId), userId);
      return res.json(result);
    } catch (err) {
      console.error('[documentsController] requestEdit error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to request edit', details: err.message });
    }
  },

  // POST /api/documents/:eventId/submit
  async submitForApproval(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;
      const result = await documentsModel.submitForApproval(Number(eventId), userId);
      return res.json(result);
    } catch (err) {
      console.error('[documentsController] submitForApproval error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to submit for approval', details: err.message });
    }
  },
};

export default documentsController;
