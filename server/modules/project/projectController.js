/**
 * HTTP layer for the research-project module.
 *
 * The redesigned form posts the whole project as one request: a `payload` JSON
 * part plus one file part per document slot. Handlers here parse and authorize
 * that request, move accepted files out of `uploads/temp`, hand the normalized
 * aggregate to the model, and clean up files on every exit path — a rejected
 * save must not leave an orphan in `uploads/`.
 */

import fs from 'fs';
import path from 'path';

import projectModel, { ProjectValidationError } from './projectModel.js';
import {
  DOCUMENT_UPLOAD_DIRS,
  normalizeProjectPayload,
  parseDocumentFieldName,
} from './projectPayload.js';
import { deleteUploadedFile } from '../shared/uploadPaths.js';
import { toStoredWebsite } from '../shared/webUrl.js';

/** The form advertises "PDF (Maximum 5 MB)" on every upload control. */
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'];

/** Every PDF starts with these bytes; the declared mime type is client-supplied. */
const PDF_SIGNATURE = Buffer.from('%PDF-');

/**
 * Reads the first bytes off disk and reports whether they are a PDF header.
 * `uploads/` is served statically, so a file that is really HTML or SVG would
 * run as a page in a reader's browser however it was declared.
 */
async function hasPdfSignature(filePath) {
  let handle;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(PDF_SIGNATURE.length);
    const { bytesRead } = await handle.read(buffer, 0, PDF_SIGNATURE.length, 0);
    return bytesRead === PDF_SIGNATURE.length && buffer.equals(PDF_SIGNATURE);
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

/**
 * Storage name for an accepted document. The client's own name is kept only in
 * `original_name` for display: the stored file always ends in `.pdf`, so a
 * `.html` or `.svg` extension can never reach the static handler.
 */
let documentSequence = 0;
function storedDocumentName(documentType) {
  documentSequence = (documentSequence + 1) % 1_000_000;
  return `${documentType}-${Date.now()}-${process.pid}-${documentSequence}.pdf`;
}

const isAdmin = (user = {}) => Boolean(user.isAdmin ?? user.is_admin);

const uploadsRoot = () => path.join(process.cwd(), 'uploads');

const respondWithValidationErrors = (res, errors) =>
  res.status(400).json({
    success: false,
    message: 'Please correct the highlighted fields.',
    errors,
  });

/**
 * Reads the aggregate out of the request. Multipart requests carry it as a
 * `payload` JSON string (a form cannot nest objects in field names); JSON
 * requests are the body itself.
 */
function readPayload(req) {
  const raw = req.body?.payload;
  if (typeof raw !== 'string') return req.body ?? {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new ProjectValidationError([
      { field: 'payload', message: 'The submitted form data could not be read.' },
    ]);
  }
}

/** Removes every multipart part still sitting in `uploads/temp`. */
function discardUploads(files = []) {
  files.forEach((file) => deleteUploadedFile(file.path));
}

function removeStoredFiles(relativePaths = []) {
  relativePaths.filter(Boolean).forEach((relativePath) => {
    deleteUploadedFile(path.join(process.cwd(), relativePath));
  });
}

/**
 * Maps the multipart parts onto document slots and moves each accepted file
 * into its category directory. Returns the slot descriptors the model stores,
 * the paths that were written (so they can be rolled back), and any rejections.
 */
async function stageDocumentUploads(files = []) {
  const documents = [];
  const writtenPaths = [];
  const errors = [];

  for (const file of files) {
    const slot = parseDocumentFieldName(file.fieldname);

    if (!slot) {
      errors.push({ field: file.fieldname, message: 'Unexpected file upload.' });
      continue;
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      errors.push({ field: file.fieldname, message: 'Upload a PDF file.' });
      continue;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      errors.push({ field: file.fieldname, message: 'The file must be 5 MB or smaller.' });
      continue;
    }
    // The declared mime type comes from the client, so the bytes decide.
    if (!(await hasPdfSignature(file.path))) {
      errors.push({ field: file.fieldname, message: 'Upload a PDF file.' });
      continue;
    }

    const directory = DOCUMENT_UPLOAD_DIRS[slot.documentType];
    const targetDirectory = path.join(uploadsRoot(), directory);
    await fs.promises.mkdir(targetDirectory, { recursive: true });

    const storedName = storedDocumentName(slot.documentType);
    const targetPath = path.join(targetDirectory, storedName);
    await fs.promises.rename(file.path, targetPath).catch(async (renameError) => {
      // A rename across devices fails on some deployments; fall back to a copy.
      if (renameError?.code !== 'EXDEV') throw renameError;
      await fs.promises.copyFile(file.path, targetPath);
      await fs.promises.unlink(file.path);
    });

    const relativePath = path.posix.join('uploads', directory, storedName);
    writtenPaths.push(relativePath);

    documents.push({
      scope: slot.scope,
      documentType: slot.documentType,
      rowKey: slot.rowKey ?? null,
      file_path: relativePath,
      original_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
    });
  }

  return { documents, writtenPaths, errors };
}

/**
 * Writes are limited to the people responsible for the project: an admin, the
 * creator, or the principal investigator. Co-investigators can read it but not
 * change it, which matches how the form has always presented itself.
 */
async function authorizeWrite(req, res, projectId) {
  const access = await projectModel.getProjectAccess(projectId, {
    userId: req.user.id,
    email: req.user.email,
  });

  if (!access) {
    res.status(404).json({ success: false, message: 'Project not found.' });
    return null;
  }

  if (!isAdmin(req.user) && !access.isOwner && !access.isPrincipalInvestigator) {
    res.status(403).json({
      success: false,
      message: 'Only the principal investigator or an administrator can change this project.',
    });
    return null;
  }

  return access;
}

const projectController = {
  /** GET /project-lookups — dropdown data for the form, in one round trip. */
  async getFormLookups(req, res) {
    try {
      const lookups = await projectModel.getFormLookups();
      res.json({ success: true, data: lookups });
    } catch (error) {
      console.error('Error loading project form lookups:', error);
      res.status(500).json({ success: false, message: 'Failed to load form options.' });
    }
  },

  /** GET /project-options/organizations */
  async searchOrganizations(req, res) {
    try {
      const organizations = await projectModel.searchOrganizations(
        String(req.query.query ?? '').trim(),
        {
          fundingOnly: String(req.query.fundingOnly ?? '').toLowerCase() === 'true',
        },
      );
      res.json({ success: true, data: organizations });
    } catch (error) {
      console.error('Error searching project organizations:', error);
      res.status(500).json({ success: false, message: 'Failed to search organizations.' });
    }
  },

  /** GET /project-options/schemes */
  async listSchemes(req, res) {
    try {
      const schemes = await projectModel.listSchemes({
        organizationId: Number(req.query.organizationId) || null,
        query: String(req.query.query ?? '').trim(),
      });
      res.json({ success: true, data: schemes });
    } catch (error) {
      console.error('Error listing project schemes:', error);
      res.status(500).json({ success: false, message: 'Failed to load schemes.' });
    }
  },

  /** POST /projects */
  async createProject(req, res) {
    await projectController.saveProject(req, res, { projectId: null });
  },

  /** PUT /projects/:id */
  async updateProject(req, res) {
    const projectId = Number(req.params.id);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      discardUploads(req.files);
      return res.status(400).json({ success: false, message: 'Invalid project id.' });
    }

    let access;
    try {
      access = await authorizeWrite(req, res, projectId);
    } catch (error) {
      // Express 4 does not catch a rejected async handler, so an access-check
      // failure would otherwise hang the request and strand the staged uploads.
      discardUploads(req.files);
      console.error('Error authorizing research project update:', error);
      return res.status(500).json({ success: false, message: 'Failed to save the project.' });
    }

    if (!access) {
      discardUploads(req.files);
      return undefined;
    }

    return projectController.saveProject(req, res, { projectId });
  },

  /**
   * Shared create/update path. Files are moved before the transaction opens and
   * removed again if anything downstream fails, so `uploads/` never holds a file
   * the database does not know about.
   */
  async saveProject(req, res, { projectId }) {
    let stagedPaths = [];

    try {
      const payload = readPayload(req);

      // Files are staged first so the normalizer knows which disbursement rows
      // carry one: a tranche whose only content is an uploaded document is a
      // real row, and dropping it as blank would strand the file.
      const staged = await stageDocumentUploads(req.files);
      stagedPaths = staged.writtenPaths;

      const { aggregate, errors } = normalizeProjectPayload(payload, {
        rowKeysWithDocuments: staged.documents
          .filter((document) => document.scope === 'disbursement' && document.rowKey)
          .map((document) => document.rowKey),
      });

      const allErrors = [...errors, ...staged.errors];
      if (allErrors.length > 0) {
        discardUploads(req.files);
        removeStoredFiles(stagedPaths);
        return respondWithValidationErrors(res, allErrors);
      }

      const { projectId: savedId, staleFilePaths } = await projectModel.saveProject({
        projectId,
        aggregate,
        documents: staged.documents,
        userId: req.user.id,
      });

      // Only now that the transaction has committed are the replaced files
      // genuinely unreferenced.
      removeStoredFiles(staleFilePaths);

      // The staged files are referenced by committed rows from here on, so the
      // rollback below must not delete them if reading the project back fails.
      stagedPaths = [];

      const project = await projectModel.getProjectById(savedId);
      return res.status(projectId ? 200 : 201).json({ success: true, data: project });
    } catch (error) {
      discardUploads(req.files);
      removeStoredFiles(stagedPaths);

      if (error instanceof ProjectValidationError) {
        return respondWithValidationErrors(res, error.errors);
      }
      if (error?.statusCode === 404) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }

      console.error('Error saving research project:', error);
      return res.status(500).json({ success: false, message: 'Failed to save the project.' });
    }
  },

  /** GET /projects/:id */
  async getProject(req, res) {
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid project id.' });
      }

      const project = await projectModel.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }

      const access = await projectModel.getProjectAccess(projectId, {
        userId: req.user.id,
        email: req.user.email,
      });

      // A project carries agency references, budgets and contact details, so it
      // is readable only by the people on it (co-investigators included, who
      // then get the read-only layout) plus whoever filed it and admins.
      if (!isAdmin(req.user) && !access.isOwner && !access.isInvestigator) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this project.',
        });
      }

      return res.json({
        success: true,
        data: {
          ...project,
          access: {
            ...access,
            // The form uses this to decide between the read-only and editable
            // layouts without a second request.
            canEdit: isAdmin(req.user) || access.isOwner || access.isPrincipalInvestigator,
          },
        },
      });
    } catch (error) {
      console.error('Error loading research project:', error);
      return res.status(500).json({ success: false, message: 'Failed to load the project.' });
    }
  },

  /** DELETE /projects/:id */
  async deleteProject(req, res) {
    try {
      const projectId = Number(req.params.id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid project id.' });
      }

      const access = await authorizeWrite(req, res, projectId);
      if (!access) return undefined;

      const { deleted, staleFilePaths } = await projectModel.deleteProject(projectId);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Project not found.' });
      }

      removeStoredFiles(staleFilePaths);
      return res.json({ success: true, message: 'Project deleted.' });
    } catch (error) {
      console.error('Error deleting research project:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete the project.' });
    }
  },

  /** POST /project-requests — "Add Scheme" / new funding agency. */
  async createProjectRequest(req, res) {
    try {
      const requestType = String(req.body?.request_type ?? '').trim();
      const name = String(req.body?.name ?? '').trim();

      if (!['organization', 'scheme'].includes(requestType)) {
        return res
          .status(400)
          .json({ success: false, message: 'Request type must be organization or scheme.' });
      }
      if (!name) {
        return res.status(400).json({ success: false, message: 'A name is required.' });
      }

      const organizationId = Number(req.body?.organization_id) || null;
      if (
        requestType === 'scheme' &&
        !organizationId &&
        !String(req.body?.organization_name ?? '').trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Tell us which funding agency offers the scheme.',
        });
      }

      const request = await projectModel.createRequest(req.user.id, {
        request_type: requestType,
        name: name.slice(0, 255),
        organization_id: organizationId,
        organization_name:
          String(req.body?.organization_name ?? '')
            .trim()
            .slice(0, 255) || null,
        domain:
          String(req.body?.domain ?? '')
            .trim()
            .slice(0, 255) || null,
        category:
          String(req.body?.category ?? '')
            .trim()
            .slice(0, 150) || null,
        // Rejected here rather than at approval time: the requester is the one
        // who can fix a mistyped address.
        website: toStoredWebsite(req.body?.website),
        description: String(req.body?.description ?? '').trim() || null,
      });

      return res.status(201).json({
        success: true,
        message: 'Request submitted. An administrator will review it shortly.',
        data: request,
      });
    } catch (error) {
      if (error?.statusCode === 400) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('Error creating project request:', error);
      return res.status(500).json({ success: false, message: 'Failed to submit the request.' });
    }
  },

  /** GET /project-requests */
  async getUserProjectRequests(req, res) {
    try {
      const requests = await projectModel.listUserRequests(req.user.id);
      res.json({ success: true, data: requests });
    } catch (error) {
      console.error('Error listing project requests:', error);
      res.status(500).json({ success: false, message: 'Failed to load your requests.' });
    }
  },

  /** GET /project-requests/:id */
  async getProjectRequest(req, res) {
    try {
      const request = await projectModel.getRequest(Number(req.params.id));

      if (!request || (!isAdmin(req.user) && request.user_id !== req.user.id)) {
        return res.status(404).json({ success: false, message: 'Request not found.' });
      }

      return res.json({ success: true, data: request });
    } catch (error) {
      console.error('Error loading project request:', error);
      return res.status(500).json({ success: false, message: 'Failed to load the request.' });
    }
  },
};

export default projectController;
