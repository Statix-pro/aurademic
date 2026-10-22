import fs from 'fs';
import path from 'path';

import journalModel from './journalModel.js';
import { reviewerAudience, userAudience } from '../notification/audiences.js';
import notificationService from '../notification/notificationService.js';
import { assertValidPublisherName, normalizePublisherName } from '../shared/publishers.js';

/**
 * Multer writes uploads into uploads/temp under a sanitized name, but `req.file.path`
 * still traces back to client-supplied input as far as static analysis is concerned.
 * Every filesystem call below goes through this, so a path that does not resolve inside
 * the temp directory is refused rather than acted on.
 */
const TEMP_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'temp');

const resolveTempUploadPath = (candidate) => {
  const resolved = path.resolve(String(candidate || ''));
  return resolved.startsWith(TEMP_UPLOAD_DIR + path.sep) ? resolved : null;
};

const isRequesterAdmin = (requestUser = {}) => Boolean(requestUser.isAdmin ?? requestUser.is_admin);

const isRequesterSuperAdmin = (requestUser = {}) => {
  if (requestUser.isSuperAdmin ?? requestUser.is_super_admin) {
    return true;
  }

  const roleTokens = Array.isArray(requestUser.roles) ? requestUser.roles : [];
  return roleTokens.some(
    (role) =>
      String(role || '')
        .trim()
        .toLowerCase() === 'super_admin',
  );
};

const hasAdminOverride = (requestUser = {}) =>
  isRequesterAdmin(requestUser) || isRequesterSuperAdmin(requestUser);

/**
 * Resolves the requester's access to one publication. Every mutation route shares this so
 * an authenticated user cannot reach another owner's publication through a route that
 * happens to check less than `updateJournal` does.
 *
 * Returns `{ workflowAccess }`, or `{ error }` describing the response to send.
 */
const resolveJournalAccess = async (req, journalId) => {
  const workflowAccess = await journalModel.getJournalWorkflowAccess(
    journalId,
    req.user.id,
    req.user.email,
  );

  if (!workflowAccess) {
    return { error: { status: 404, body: { status: 'error', message: 'Journal not found' } } };
  }

  if (!hasAdminOverride(req.user) && !workflowAccess.can_manage) {
    return {
      error: {
        status: 403,
        body: { status: 'error', message: 'You are not authorized to edit this journal' },
      },
    };
  }

  return { workflowAccess };
};

/**
 * An approved publication is frozen until an edit request is granted. Content routes
 * (authors, indexes, the article file) enforce this alongside `updateJournal` — editing
 * the parts was otherwise a way around the freeze on the whole.
 */
const journalEditIsFrozen = (req, workflowAccess) => {
  if (hasAdminOverride(req.user)) {
    return false;
  }

  const approvalStatus = workflowAccess.admin_approval_status || 'pending';
  const editRequestStatus = workflowAccess.edit_request_status || 'none';
  const canDirectEdit =
    approvalStatus === 'pending' ||
    approvalStatus === 'rejected' ||
    (approvalStatus === 'approved' && editRequestStatus === 'approved');

  return !canDirectEdit;
};

/**
 * A Conference, Book or Book Chapter picked from the publisher master sends the row's id
 * in publication_details. The name stored beside it is taken from the master, never from
 * the request, so a record cannot carry an id that says one publisher and a name that
 * says another. Records without an id (filed before the master existed) pass through.
 *
 * A rejected publisher cannot be newly linked — an admin has said it should not be used,
 * and a picker opened before the rejection would otherwise still submit it. A record that
 * already links to it keeps it when saved again (`currentPublisherId`), so a rejection
 * never blocks editing an older record's other fields.
 *
 * Returns an error message for an id that does not exist or is rejected, otherwise null.
 */
const applyLinkedPublisher = async (journalData, { currentPublisherId = null } = {}) => {
  const details = journalData.publication_details;
  if (!details || typeof details !== 'object' || details.publisher_id == null) {
    return null;
  }

  const publisherId = Number(details.publisher_id);
  const publisher = Number.isInteger(publisherId)
    ? await journalModel.getPublisherById(publisherId)
    : null;
  if (!publisher) {
    return 'The selected publisher no longer exists. Please pick it again.';
  }
  if (publisher.status === 'rejected' && publisher.id !== currentPublisherId) {
    return `"${publisher.name}" was rejected by an administrator. Please pick another publisher.`;
  }

  journalData.publication_details = {
    ...details,
    publisher_id: publisher.id,
    publisher: publisher.name,
  };
  return null;
};

const FROZEN_EDIT_RESPONSE = {
  status: 'error',
  message: 'Direct edit is disabled for approved publications. Please request edit access.',
};

const journalController = {
  async createJournal(req, res) {
    try {
      const journalData = req.body;

      // Validate required fields
      // For Conference, Book Chapter, and Book, journal_name may not be required if publication_details is provided
      const isConferenceOrBook =
        journalData.type === 'Conference paper' ||
        journalData.type === 'Book Chapter' ||
        journalData.type === 'Book';

      if (!journalData.title || !journalData.type) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields: title or type',
        });
      }

      // For Journal type, require journal_name
      if (!isConferenceOrBook && !journalData.journal_name) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required field: journal name',
        });
      }

      // For Conference, Book Chapter, and Book, require publication_details
      if (isConferenceOrBook && !journalData.publication_details) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required field: publication_details',
        });
      }

      // Validate publication type-specific requirements
      const isJournalType =
        journalData.type === 'Article' ||
        journalData.type === 'Journal Article' ||
        journalData.type === 'Research Article' ||
        journalData.type === 'Erratum' ||
        journalData.type === 'Editorial' ||
        journalData.type === 'Note' ||
        journalData.type === 'Review' ||
        journalData.type === 'Retraction';

      if (isJournalType && !journalData.quartile) {
        return res.status(400).json({
          status: 'error',
          message: 'Quartile is required for Journal articles',
        });
      }

      // For non-Journal types, make these fields optional instead of required
      // (they can still be provided but won't cause validation errors if missing)

      const publisherError = await applyLinkedPublisher(journalData);
      if (publisherError) {
        return res.status(400).json({ status: 'error', message: publisherError });
      }

      // Create the journal entry, recording who filed it so they keep access to it
      // even when the paper credits other people.
      const journal = await journalModel.create({
        ...journalData,
        created_by: req.user?.id || null,
      });

      // Handle file upload if present
      if (req.files && req.files.file) {
        const file = req.files.file;
        const sanitizedFileName = `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const uploadDir = path.join(process.cwd(), 'uploads');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uploadPath = path.join(uploadDir, sanitizedFileName);

        await file.mv(uploadPath);
        const filePath = `/uploads/${sanitizedFileName}`;
        await journalModel.update(journal.id, { file_path: filePath });
      }

      // Fires after the record and its upload are settled, and outside any
      // transaction — a publication is created without one, so there is nothing
      // for the emit to join.
      await notificationService.emit({
        type: 'journal.submitted',
        actorUserId: req.user?.id || null,
        subject: { moduleKey: 'journal', recordId: journal.id, title: journal.title },
        audience: [reviewerAudience()],
        data: { applicantName: req.user?.name || null },
        dedupeKey: `journal:${journal.id}:submitted`,
      });

      res.status(201).json({
        status: 'success',
        message: 'Journal created successfully',
        data: journal,
      });
    } catch (error) {
      console.error('Error in createJournal:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getJournal(req, res) {
    try {
      const id = req.params.id;
      // console.log('Fetching journal with ID:', id);
      const journal = await journalModel.getCompleteJournalDetails(id);

      if (journal) {
        // console.log('Found journal:', journal);
        res.status(200).json({
          status: 'success',
          data: journal,
        });
      } else {
        // console.log('No journal found with ID:', id);
        res.status(404).json({
          status: 'error',
          message: 'Journal not found',
        });
      }
    } catch (error) {
      console.error('Error in getJournal:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error retrieving journal',
        error: error.message,
      });
    }
  },

  async updateJournal(req, res) {
    try {
      const id = req.params.id;
      const journalData = req.body;
      const requesterHasAdminOverride = hasAdminOverride(req.user);

      const workflowAccess = await journalModel.getJournalWorkflowAccess(
        id,
        req.user.id,
        req.user.email,
      );

      if (!workflowAccess) {
        return res.status(404).json({ message: 'Journal not found' });
      }

      if (!requesterHasAdminOverride && !workflowAccess.can_manage) {
        return res.status(403).json({
          message: 'You are not authorized to edit this journal',
        });
      }

      const approvalStatus = workflowAccess.admin_approval_status || 'pending';
      const editRequestStatus = workflowAccess.edit_request_status || 'none';
      const canDirectEdit =
        approvalStatus === 'pending' ||
        approvalStatus === 'rejected' ||
        (approvalStatus === 'approved' && editRequestStatus === 'approved');

      if (!requesterHasAdminOverride && !canDirectEdit) {
        return res.status(403).json({
          message: 'Direct edit is disabled for approved publications. Please request edit access.',
        });
      }

      // Validate publication type-specific requirements
      const isJournalType =
        journalData.type === 'Article' ||
        journalData.type === 'Journal Article' ||
        journalData.type === 'Research Article' ||
        journalData.type === 'Erratum' ||
        journalData.type === 'Editorial' ||
        journalData.type === 'Note' ||
        journalData.type === 'Review' ||
        journalData.type === 'Retraction';

      if (isJournalType && !journalData.quartile) {
        return res.status(400).json({
          status: 'error',
          message: 'Quartile is required for Journal articles',
        });
      }

      const publisherError = await applyLinkedPublisher(journalData, {
        currentPublisherId: await journalModel.getLinkedPublisherId(id),
      });
      if (publisherError) {
        return res.status(400).json({ status: 'error', message: publisherError });
      }

      // Define the fields that exist in the "journals" table only.
      const journalFields = [
        'category',
        'title',
        'book_chapter_title',
        'type',
        'quartile',
        'impact_factor',
        'cite_score',
        'acknowledgement',
        'author_affiliation',
        'external_details',
        'driven_by',
        'date_of_submission',
        'status',
        'volume',
        'issue',
        'issue_type',
        'pages_from',
        'pages_to',
        'article_number',
        'abstract',
        'keywords',
        'sdgs',
        'doi',
        'credit_to',
        'reference_number',
        'accepted_date',
        'available_online_date',
        'file_path',
        'publication_details',
        'scopus_id',
        'scie_id',
        'open_access',
        'year',
        'wos_id',
        'pubmed_pmid',
      ];

      // Only the journal name is read from the submission, and only to decide which
      // registry entry this publication points at. Publisher/website/ISSN belong to the
      // admin-curated registry (or to publication_details for books and conferences), so
      // the publication form must not write them back.
      const journalOptionsFields = ['journal_name', 'journal_options_id'];

      // ISBNs for Conference/Book/Book Chapter are persisted inside publication_details,
      // so they need no mapping onto the journal_options ISSN columns here.

      // Filter data for each table
      const journalUpdateData = Object.fromEntries(
        Object.entries(journalData).filter(
          ([key, value]) => journalFields.includes(key) && value !== undefined,
        ),
      );

      const journalOptionsUpdateData = Object.fromEntries(
        Object.entries(journalData).filter(
          ([key, value]) => journalOptionsFields.includes(key) && value !== undefined,
        ),
      );

      // Handle JSON fields
      if (journalUpdateData.acknowledgement) {
        journalUpdateData.acknowledgement = JSON.stringify(journalUpdateData.acknowledgement);
      }
      if (journalUpdateData.author_affiliation) {
        journalUpdateData.author_affiliation = JSON.stringify(journalUpdateData.author_affiliation);
      }
      if (journalUpdateData.sdgs) {
        journalUpdateData.sdgs = JSON.stringify(journalUpdateData.sdgs);
      }
      if (journalUpdateData.credit_to) {
        journalUpdateData.credit_to = JSON.stringify(journalUpdateData.credit_to);
      }
      if (journalUpdateData.publication_details) {
        journalUpdateData.publication_details = JSON.stringify(
          journalUpdateData.publication_details,
        );
      }
      if (journalUpdateData.external_details) {
        journalUpdateData.external_details = JSON.stringify(journalUpdateData.external_details);
      }

      // Editing a rejected paper, or one unlocked by an approved edit request,
      // sends it back to 'pending' — an implicit resubmission that the
      // reviewers need to hear about, since nothing else announces it.
      const isImplicitResubmission =
        !requesterHasAdminOverride &&
        (approvalStatus === 'rejected' ||
          (approvalStatus === 'approved' && editRequestStatus === 'approved'));

      if (isImplicitResubmission) {
        Object.assign(journalUpdateData, {
          admin_approval_status: 'pending',
          admin_approval_comment: null,
          admin_approved_by: null,
          admin_approved_at: null,
          admin_rejected_by: null,
          admin_rejected_at: null,
        });
      }

      // Update both tables
      const result = await journalModel.updateJournalAndOptions(
        id,
        journalUpdateData,
        journalOptionsUpdateData,
      );

      // Handle file upload if present
      if (req.files && req.files.file) {
        const file = req.files.file;
        const sanitizedFileName = `${Date.now()}-${path.basename(file.name).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const uploadDir = path.join(process.cwd(), 'uploads');

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uploadPath = path.join(uploadDir, sanitizedFileName);

        await file.mv(uploadPath);
        const filePath = `/uploads/${sanitizedFileName}`;
        await journalModel.update(id, { file_path: filePath });
      }

      if (result.success && isImplicitResubmission) {
        await notificationService.emit({
          type: 'journal.resubmitted',
          actorUserId: req.user?.id || null,
          subject: {
            moduleKey: 'journal',
            recordId: Number(id),
            title: journalUpdateData.title || null,
          },
          audience: [reviewerAudience()],
          data: { actorName: req.user?.name || null },
          // A paper can go round the review loop more than once, so each pass
          // is its own notification.
          dedupeKey: `journal:${id}:resubmitted:${Date.now()}`,
        });
      }

      if (result.success) {
        res.status(200).json({ message: 'Journal updated successfully' });
      } else {
        res.status(404).json({ message: 'Journal not found' });
      }
    } catch (error) {
      console.error('Update error:', error);
      res.status(500).json({
        message: 'Error updating journal',
        error: error.message,
      });
    }
  },

  async updateAuthor(req, res) {
    try {
      const journalId = req.params.id;
      const dbAuthorId = req.params.dbAuthorId;
      const { is_first_author, is_primary } = req.body;

      const result = await journalModel.updateAuthorInJournal(journalId, dbAuthorId, {
        is_first_author,
        is_primary,
      });

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Author updated successfully' });
      } else {
        res.status(404).json({ message: 'Author not found' });
      }
    } catch (error) {
      console.error('Error in updateAuthor:', error);
      res.status(500).json({ message: 'Error updating author', error: error.message });
    }
  },

  async deleteAuthor(req, res) {
    try {
      const journalId = req.params.id;
      const dbAuthorId = req.params.dbAuthorId;

      const { workflowAccess, error } = await resolveJournalAccess(req, journalId);
      if (error) {
        return res.status(error.status).json(error.body);
      }

      if (journalEditIsFrozen(req, workflowAccess)) {
        return res.status(403).json(FROZEN_EDIT_RESPONSE);
      }

      const result = await journalModel.deleteAuthorFromJournal(journalId, dbAuthorId);

      if (result.affectedRows > 0) {
        res.status(200).json({ status: 'success', message: 'Author removed successfully' });
      } else {
        res.status(404).json({ status: 'error', message: 'Author not found on this journal' });
      }
    } catch (error) {
      console.error('Error in deleteAuthor:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async replaceIndexes(req, res) {
    try {
      const journalId = req.params.id;
      const { indexes } = req.body;

      if (!Array.isArray(indexes)) {
        return res.status(400).json({
          status: 'error',
          message: 'indexes must be an array of index names',
        });
      }

      const { workflowAccess, error } = await resolveJournalAccess(req, journalId);
      if (error) {
        return res.status(error.status).json(error.body);
      }

      if (journalEditIsFrozen(req, workflowAccess)) {
        return res.status(403).json(FROZEN_EDIT_RESPONSE);
      }

      const savedIndexes = await journalModel.replaceIndexes(journalId, indexes);

      res.status(200).json({
        status: 'success',
        message: 'Indexes updated successfully',
        data: savedIndexes,
      });
    } catch (error) {
      console.error('Error in replaceIndexes:', error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async deleteJournal(req, res) {
    try {
      const id = req.params.id;
      const requesterHasAdminOverride = hasAdminOverride(req.user);

      const workflowAccess = await journalModel.getJournalWorkflowAccess(
        id,
        req.user.id,
        req.user.email,
      );

      if (!workflowAccess) {
        return res.status(404).json({ message: 'Journal not found' });
      }

      if (!requesterHasAdminOverride && !workflowAccess.can_manage) {
        return res.status(403).json({
          message: 'You are not authorized to delete this journal',
        });
      }

      if (
        !requesterHasAdminOverride &&
        workflowAccess.status === 'published' &&
        workflowAccess.admin_approval_status === 'approved'
      ) {
        return res.status(403).json({
          message: 'Delete is disabled once publication is approved and published.',
        });
      }

      const result = await journalModel.delete(id);
      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Journal deleted successfully' });
      } else {
        res.status(404).json({ message: 'Journal not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error deleting journal', error: error.message });
    }
  },

  async addAuthor(req, res) {
    try {
      const journalId = parseInt(req.params.id);
      const authorData = req.body;

      if (authorData.designation === 'faculty') {
        if (!authorData.author_id) {
          return res.status(400).json({ status: 'error', message: 'Faculty ID is required' });
        }
      } else if (authorData.designation === 'student') {
        if (
          !authorData.author_id ||
          !authorData.name ||
          !authorData.department ||
          !authorData.organization
        ) {
          return res.status(400).json({
            status: 'error',
            message:
              'Register Number, Name, Department, and Organization are required for students',
          });
        }
      } else if (authorData.designation === 'external') {
        if (
          !authorData.name ||
          !authorData.department ||
          !authorData.organization ||
          !authorData.country
        ) {
          return res.status(400).json({
            status: 'error',
            message:
              'Name, Department, Organization, and Country are required for external authors',
          });
        }
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Valid designation (student/faculty/external) is required',
        });
      }

      const result = await journalModel.addAuthor(journalId, authorData);

      res.status(201).json({
        status: 'success',
        message: 'Author added successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error adding author:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'An internal server error occurred.',
      });
    }
  },

  async getAuthors(req, res) {
    try {
      const { id: journalId } = req.params;
      const authors = await journalModel.getAuthors(journalId);
      res.status(200).json(authors);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving authors', error: error.message });
    }
  },

  async searchAuthor(req, res) {
    try {
      const { query, designation } = req.query;

      // Allow empty query to fetch default list (top 20)
      const authors = await journalModel.searchAuthor(query || '', designation);

      if (authors && authors.length > 0) {
        res.status(200).json(authors);
      } else {
        res.status(200).json([]); // Return empty array instead of 404
      }
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({ message: 'Error searching for author', error: error.message });
    }
  },

  async addIndex(req, res) {
    try {
      const { id: journalId } = req.params;
      const { indexName } = req.body;
      const result = await journalModel.addIndex(journalId, indexName);
      res.status(201).json({ message: 'Index added successfully', id: result.insertId });
    } catch (error) {
      res.status(500).json({ message: 'Error adding index', error: error.message });
    }
  },

  async getIndexes(req, res) {
    try {
      const { id: journalId } = req.params;
      const indexes = await journalModel.getIndexes(journalId);
      res.status(200).json(indexes);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving indexes', error: error.message });
    }
  },

  async uploadFile(req, res) {
    try {
      const { id: journalId } = req.params;
      if (!req.file) {
        return res.status(400).json({
          data: {
            // Add this nested data property
            success: false,
            message: 'No file was uploaded.',
          },
        });
      }

      const { workflowAccess, error } = await resolveJournalAccess(req, journalId);
      if (error) {
        await fs.promises.unlink(resolveTempUploadPath(req.file.path) || '').catch(() => {});
        return res.status(error.status).json(error.body);
      }

      if (journalEditIsFrozen(req, workflowAccess)) {
        await fs.promises.unlink(resolveTempUploadPath(req.file.path) || '').catch(() => {});
        return res.status(403).json(FROZEN_EDIT_RESPONSE);
      }

      const file = req.file;
      const tempPath = resolveTempUploadPath(file.path);
      if (!tempPath) {
        return res.status(400).json({
          success: false,
          message: 'Upload could not be processed.',
        });
      }

      // The published article is PDF-only and capped at 5 MB. The shared upload
      // middleware is deliberately looser (it serves every module), so the stricter
      // rule this endpoint advertises is enforced here and the temp file discarded.
      const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname || '');
      const maxArticleBytes = 5 * 1024 * 1024;
      if (!isPdf || file.size > maxArticleBytes) {
        await fs.promises.unlink(tempPath).catch(() => {});
        return res.status(400).json({
          success: false,
          message: !isPdf
            ? 'Only PDF files are allowed for the published article.'
            : 'The published article must be 5 MB or smaller.',
        });
      }

      const uploadDir = path.join(process.cwd(), 'uploads', 'journalform-articles');

      await fs.promises.mkdir(uploadDir, { recursive: true });

      // Create unique filename
      const uniqueFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const finalPath = path.join(uploadDir, uniqueFilename);

      try {
        // Move file from temp to final location
        await fs.promises.rename(tempPath, finalPath);
      } catch (moveError) {
        // Fallback to copy if rename fails (might happen across devices)
        await fs.promises.copyFile(tempPath, finalPath);
        await fs.promises.unlink(tempPath);
      }

      // Save the file path in the database (use forward slashes for consistency)
      const dbFilePath = `/uploads/journalform-articles/${uniqueFilename}`;
      await journalModel.update(journalId, { file_path: dbFilePath });

      res.json({
        success: true,
        message: 'File uploaded successfully!',
        filePath: dbFilePath,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false, // Not nested
        message: 'Error uploading file',
        error: error.message,
      });
    }
  },

  async searchJournals(req, res) {
    try {
      const { query } = req.query;

      // Allow empty query to return default list
      const journals = await journalModel.searchJournals(query || '');

      res.json({
        status: 'success',
        data: journals,
      });
    } catch (error) {
      console.error('Error in searchJournals:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /** GET /publishers?query= — the publication form's publisher picker. */
  async searchPublishers(req, res) {
    try {
      const publishers = await journalModel.searchPublishers(
        normalizePublisherName(req.query.query),
        req.user.id,
      );
      res.json({ success: true, data: publishers });
    } catch (error) {
      console.error('Error searching publishers:', error);
      res.status(500).json({ success: false, message: 'Failed to search publishers.' });
    }
  },

  /** POST /publishers — Add Publisher from the publication form. */
  async requestPublisher(req, res) {
    try {
      const name = assertValidPublisherName(req.body?.name);
      const { publisher, created } = await journalModel.requestPublisher(name, req.user.id);

      // Only a new row needs a review; picking an existing name adds nothing to check.
      if (created) {
        await notificationService.emit({
          type: 'journal.publisher_requested',
          actorUserId: req.user.id,
          subject: { moduleKey: 'journal', recordId: publisher.id, name: publisher.name },
          audience: [reviewerAudience()],
          data: { applicantName: req.user?.name || null },
          dedupeKey: `publisher:${publisher.id}:requested`,
        });
      }

      res.status(created ? 201 : 200).json({
        success: true,
        data: publisher,
        message: created
          ? 'Publisher added. You can use it now; an administrator will review it.'
          : 'This publisher already exists, so it has been selected.',
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      console.error('Error adding publisher:', error);
      return res.status(500).json({ success: false, message: 'Failed to add publisher.' });
    }
  },

  // Journal Request methods
  async createJournalRequest(req, res) {
    try {
      const {
        journal_name,
        publisher,
        website,
        print_issn,
        online_issn,
        impact_factor,
        cite_score,
        category,
      } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!journal_name || journal_name.trim().length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Journal name is required',
        });
      }

      const request = await journalModel.createJournalRequest({
        user_id: userId,
        journal_name: journal_name.trim(),
        publisher: publisher?.trim() || '',
        website: website?.trim() || '',
        print_issn: print_issn?.trim() || '',
        online_issn: online_issn?.trim() || '',
        impact_factor: impact_factor || null,
        cite_score: cite_score || null,
        category: category || 'National',
      });

      await notificationService.emit({
        type: 'journal.request_submitted',
        actorUserId: userId,
        subject: { moduleKey: 'journal', recordId: request?.id ?? null, name: journal_name.trim() },
        audience: [reviewerAudience()],
        data: { applicantName: req.user?.name || null },
        dedupeKey: request?.id ? `journal_request:${request.id}:submitted` : null,
      });

      res.status(201).json({
        status: 'success',
        message: 'Journal request submitted successfully. It will be reviewed by an administrator.',
        data: request,
      });
    } catch (error) {
      console.error('Error in createJournalRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getUserJournalRequests(req, res) {
    try {
      const userId = req.user.id;
      const requests = await journalModel.getUserJournalRequests(userId);

      res.json({
        status: 'success',
        data: requests,
      });
    } catch (error) {
      console.error('Error in getUserJournalRequests:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getJournalRequest(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const request = await journalModel.getJournalRequest(id, userId);

      if (!request) {
        return res.status(404).json({
          status: 'error',
          message: 'Journal request not found',
        });
      }

      res.json({
        status: 'success',
        data: request,
      });
    } catch (error) {
      console.error('Error in getJournalRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async createStatusUpdate(req, res) {
    try {
      const journalId = req.params.id;
      const userId = req.user.id;
      const { status, user_comment } = req.body;

      // Validate required fields
      if (!status || !status.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Status is required',
        });
      }

      // Posting a progress update is only for people who manage this publication — the
      // route previously checked that the journal existed and nothing else. The approval
      // freeze deliberately does not apply here: status updates exist to report on a
      // publication after it has been approved.
      const { error } = await resolveJournalAccess(req, journalId);
      if (error) {
        return res.status(error.status).json(error.body);
      }

      const statusUpdateId = await journalModel.createStatusUpdate(journalId, userId, {
        status: status.trim(),
        user_comment: user_comment?.trim() || null,
      });

      const updateContext = await journalModel.getStatusUpdateContext(statusUpdateId);

      await notificationService.emit({
        type: 'journal.status_update_posted',
        actorUserId: userId,
        subject: {
          moduleKey: 'journal',
          recordId: Number(journalId),
          title: updateContext?.title || null,
        },
        audience: [reviewerAudience()],
        data: {
          applicantName: req.user?.name || null,
          comment: updateContext?.user_comment || status.trim(),
        },
        dedupeKey: `journal_status_update:${statusUpdateId}:posted`,
      });

      res.status(201).json({
        status: 'success',
        message: 'Status update created successfully',
        data: { id: statusUpdateId },
      });
    } catch (error) {
      console.error('Error in createStatusUpdate:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getStatusUpdates(req, res) {
    try {
      const journalId = req.params.id;
      const userId = req.user.id;

      // Check if journal exists and user has access
      const journalExists = await journalModel.doesJournalExist(journalId);
      if (!journalExists) {
        return res.status(404).json({
          status: 'error',
          message: 'Journal not found',
        });
      }

      const statusUpdates = await journalModel.getStatusUpdates(journalId);

      res.json({
        status: 'success',
        data: statusUpdates,
      });
    } catch (error) {
      console.error('Error in getStatusUpdates:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async updateStatusUpdateAdminReply(req, res) {
    try {
      const statusUpdateId = req.params.statusUpdateId;
      const { admin_reply } = req.body;

      if (!admin_reply || !admin_reply.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Admin reply is required',
        });
      }

      const result = await journalModel.updateStatusUpdateAdminReply(
        statusUpdateId,
        admin_reply.trim(),
      );

      if (result.affectedRows > 0) {
        const updateContext = await journalModel.getStatusUpdateContext(statusUpdateId);

        await notificationService.emit({
          type: 'journal.status_update_replied',
          actorUserId: req.user?.id || null,
          subject: {
            moduleKey: 'journal',
            recordId: updateContext?.journal_id ?? null,
            title: updateContext?.title || null,
          },
          audience: userAudience(updateContext?.user_id, 'applicant'),
          data: { comment: admin_reply.trim() },
          // A thread can be replied to more than once and each reply matters.
          dedupeKey: `journal_status_update:${statusUpdateId}:replied:${Date.now()}`,
        });
      }

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Admin reply updated successfully' });
      } else {
        res.status(404).json({ message: 'Status update not found' });
      }
    } catch (error) {
      console.error('Error in updateStatusUpdateAdminReply:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },
};

export default journalController;
