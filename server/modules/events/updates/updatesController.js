import path from 'path';

import multer from 'multer';

import updatesModel from './updatesModel.js';

// File storage for publicity / update uploads
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'event-updates'));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `evt-update-${Date.now()}${ext}`);
  },
});

export const updateUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const updatesController = {
  // POST /api/updates/events/:id/uploads
  async uploadFile(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = `/uploads/event-updates/${req.file.filename}`;
      const result = await updatesModel.recordUpload(Number(id), filePath, userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] uploadFile error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to upload file', details: err.message });
    }
  },

  // PUT /api/updates/events/:id/publicity
  async savePublicity(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.savePublicity(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] savePublicity error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save publicity', details: err.message });
    }
  },

  // POST /api/updates/events/:id/participants
  async saveParticipants(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.saveParticipants(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] saveParticipants error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save participants', details: err.message });
    }
  },

  // PUT /api/updates/events/:id/letters
  async saveLetters(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.saveLetters(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] saveLetters error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save letters', details: err.message });
    }
  },

  // PUT /api/updates/events/:id/documents
  async saveDocuments(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.saveDocuments(Number(id), req.body, userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] saveDocuments error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to save documents', details: err.message });
    }
  },

  // POST /api/updates/events/:id/resource_persons
  async addResourcePerson(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.addResourcePerson(Number(id), req.body, userId);
      return res.status(201).json(result);
    } catch (err) {
      console.error('[updatesController] addResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to add resource person', details: err.message });
    }
  },

  // PUT /api/updates/events/:id/resource_persons/:pid
  async updateResourcePerson(req, res) {
    try {
      const { id, pid } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.updateResourcePerson(
        Number(id),
        Number(pid),
        req.body,
        userId,
      );
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] updateResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to update resource person', details: err.message });
    }
  },

  // DELETE /api/updates/events/:id/resource_persons/:pid
  async deleteResourcePerson(req, res) {
    try {
      const { id, pid } = req.params;
      const userId = req.user?.id;
      const result = await updatesModel.deleteResourcePerson(Number(id), Number(pid), userId);
      return res.json(result);
    } catch (err) {
      console.error('[updatesController] deleteResourcePerson error:', err);
      return res
        .status(err.status || 500)
        .json({ error: 'Failed to delete resource person', details: err.message });
    }
  },
};

export default updatesController;
