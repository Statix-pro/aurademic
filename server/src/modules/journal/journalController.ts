import { Request, Response } from 'express';
import journalModel from './journalModel.js';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rename = util.promisify(fs.rename);

const journalController = {
  async createJournal(req: Request, res: Response) {
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

      // Create the journal entry
      const journal = await journalModel.create(journalData);

      // Handle file upload if present
      // Using 'any' cast as this seems to expect express-fileupload structure which might differ from Multer types
      if ((req as any).files && (req as any).files.file) {
        const file = (req as any).files.file;
        const uploadPath = path.join(__dirname, '../../uploads/', file.name);

        await file.mv(uploadPath);
        const filePath = `/uploads/${file.name}`;
        await journalModel.update(journal.id, { file_path: filePath } as any);
      }

      res.status(201).json({
        status: 'success',
        message: 'Journal created successfully',
        data: journal,
      });
    } catch (error: any) {
      console.error('Error in createJournal:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getJournal(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in getJournal:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error retrieving journal',
        error: error.message,
      });
    }
  },

  async updateJournal(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const journalData = req.body;

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

      // Define the fields that exist in the "journals" table only.
      const journalFields = [
        'category',
        'title',
        'book_chapter_title',
        'type',
        'quartile',
        'impact_factor',
        'cite_score',
        'anna_university_listed',
        'anna_university_annexure_no',
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
      ];

      const journalOptionsFields = [
        'journal_name',
        'publisher',
        'website',
        'print_issn',
        'online_issn',
      ];

      // Handle potential ISBN fields for non-Journal types
      if (journalData.print_isbn !== undefined) {
        journalData.print_issn = journalData.print_isbn;
      }
      if (journalData.online_isbn !== undefined) {
        journalData.online_issn = journalData.online_isbn;
      }

      // Filter data for each table
      const journalUpdateData: any = Object.fromEntries(
        Object.entries(journalData).filter(
          ([key, value]) =>
            journalFields.includes(key) && value !== null && value !== undefined
        )
      );

      const journalOptionsUpdateData: any = Object.fromEntries(
        Object.entries(journalData).filter(
          ([key, value]) =>
            journalOptionsFields.includes(key) &&
            value !== null &&
            value !== undefined
        )
      );

      // Handle JSON fields
      if (journalUpdateData.acknowledgement) {
        journalUpdateData.acknowledgement = JSON.stringify(
          journalUpdateData.acknowledgement
        );
      }
      if (journalUpdateData.author_affiliation) {
        journalUpdateData.author_affiliation = JSON.stringify(
          journalUpdateData.author_affiliation
        );
      }
      if (journalUpdateData.sdgs) {
        journalUpdateData.sdgs = JSON.stringify(journalUpdateData.sdgs);
      }
      if (journalUpdateData.publication_details) {
        journalUpdateData.publication_details = JSON.stringify(
          journalUpdateData.publication_details
        );
      }
      if (journalUpdateData.external_details) {
        journalUpdateData.external_details = JSON.stringify(
          journalUpdateData.external_details
        );
      }

      // Update both tables
      const result = await journalModel.updateJournalAndOptions(
        id,
        journalUpdateData,
        journalOptionsUpdateData
      );

      // Handle file upload if present
      if ((req as any).files && (req as any).files.file) {
        const file = (req as any).files.file;
        const uploadPath = path.join(__dirname, '../uploads/', file.name);
        await file.mv(uploadPath);
        const filePath = `/uploads/${file.name}`;
        await journalModel.update(id, { file_path: filePath } as any);
      }

      if (result.success) {
        res.status(200).json({ message: 'Journal updated successfully' });
      } else {
        res.status(404).json({ message: 'Journal not found' });
      }
    } catch (error: any) {
      console.error('Update error:', error);
      res.status(500).json({
        message: 'Error updating journal',
        error: error.message,
      });
    }
  },

  async updateAuthor(req: Request, res: Response) {
    try {
      const journalId = req.params.id;
      const dbAuthorId = req.params.dbAuthorId;
      const { is_first_author, is_primary } = req.body;

      const result = await journalModel.updateAuthorInJournal(
        journalId,
        dbAuthorId,
        { is_first_author, is_primary }
      );

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Author updated successfully' });
      } else {
        res.status(404).json({ message: 'Author not found' });
      }
    } catch (error: any) {
      console.error('Error in updateAuthor:', error);
      res
        .status(500)
        .json({ message: 'Error updating author', error: error.message });
    }
  },

  async deleteJournal(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const result = await journalModel.delete(id);
      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Journal deleted successfully' });
      } else {
        res.status(404).json({ message: 'Journal not found' });
      }
    } catch (error: any) {
      res
        .status(500)
        .json({ message: 'Error deleting journal', error: error.message });
    }
  },

  async addAuthor(req: Request, res: Response) {
    try {
      const journalId = parseInt(req.params.id);
      const authorData = req.body;

      if (authorData.designation === 'faculty') {
        if (!authorData.author_id) {
          return res
            .status(400)
            .json({ status: 'error', message: 'Faculty ID is required' });
        }
      } else if (authorData.designation === 'student') {
        if (
          !authorData.author_id ||
          !authorData.name ||
          !authorData.department ||
          !authorData.organization
        ) {
          return res
            .status(400)
            .json({
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
          return res
            .status(400)
            .json({
              status: 'error',
              message:
                'Name, Department, Organization, and Country are required for external authors',
            });
        }
      } else {
        return res
          .status(400)
          .json({
            status: 'error',
            message: 'Valid designation (student/faculty/external) is required',
          });
      }

      const result = await journalModel.addAuthor(journalId, authorData);

      res
        .status(201)
        .json({
          status: 'success',
          message: 'Author added successfully',
          data: result,
        });
    } catch (error: any) {
      console.error('Error adding author:', error);
      res
        .status(500)
        .json({
          status: 'error',
          message: error.message || 'An internal server error occurred.',
        });
    }
  },

  async getAuthors(req: Request, res: Response) {
    try {
      const { id: journalId } = req.params;
      const authors = await journalModel.getAuthors(journalId);
      res.status(200).json(authors);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: 'Error retrieving authors', error: error.message });
    }
  },

  async searchAuthor(req: Request, res: Response) {
    try {
      const { query, designation } = req.query;
      if (!query || (query as string).trim().length === 0) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      const authors = await journalModel.searchAuthor(query as string, designation as string);

      if (authors && authors.length > 0) {
        res.status(200).json(authors);
      } else {
        res.status(404).json({ message: 'No authors found' });
      }
    } catch (error: any) {
      console.error('Controller error:', error);
      res
        .status(500)
        .json({ message: 'Error searching for author', error: error.message });
    }
  },

  async addIndex(req: Request, res: Response) {
    try {
      const { id: journalId } = req.params;
      const { indexName } = req.body;
      const result = await journalModel.addIndex(journalId, indexName);
      res
        .status(201)
        .json({ message: 'Index added successfully', id: result.insertId });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: 'Error adding index', error: error.message });
    }
  },

  async getIndexes(req: Request, res: Response) {
    try {
      const { id: journalId } = req.params;
      const indexes = await journalModel.getIndexes(journalId);
      res.status(200).json(indexes);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: 'Error retrieving indexes', error: error.message });
    }
  },

  async uploadFile(req: Request, res: Response) {
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

      const file = req.file;
      const uploadDir = path.join(
        process.cwd(),
        'uploads',
        'journalform-articles'
      );

      // Ensure the final upload directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Create unique filename
      const uniqueFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const finalPath = path.join(uploadDir, uniqueFilename);

      try {
        // Move file from temp to final location
        await fs.promises.rename(file.path, finalPath);
      } catch (moveError) {
        // Fallback to copy if rename fails (might happen across devices)
        await fs.promises.copyFile(file.path, finalPath);
        await fs.promises.unlink(file.path);
      }

      // Save the file path in the database (use forward slashes for consistency)
      const dbFilePath = `/uploads/journalform-articles/${uniqueFilename}`;
      await journalModel.update(journalId, { file_path: dbFilePath } as any);

      res.json({
        success: true,
        message: 'File uploaded successfully!',
        filePath: dbFilePath,
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false, // Not nested
        message: 'Error uploading file',
        error: error.message,
      });
    }
  },

  async searchJournals(req: Request, res: Response) {
    try {
      const { query } = req.query;

      if (!query || (query as string).trim().length === 0) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      const journals = await journalModel.searchJournals(query as string);

      res.json({
        status: 'success',
        data: journals,
      });
    } catch (error: any) {
      console.error('Error in searchJournals:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  // Journal Request methods
  async createJournalRequest(req: Request, res: Response) {
    try {
      const {
        journal_name,
        publisher,
        website,
        print_issn,
        online_issn,
        category,
      } = req.body;
      const userId = req.user?.id;
      if (!userId) throw new Error("User ID missing");

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
        category: category || 'National',
      });

      res.status(201).json({
        status: 'success',
        message:
          'Journal request submitted successfully. It will be reviewed by an administrator.',
        data: request,
      });
    } catch (error: any) {
      console.error('Error in createJournalRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getUserJournalRequests(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) throw new Error("User ID missing");
      const requests = await journalModel.getUserJournalRequests(userId);

      res.json({
        status: 'success',
        data: requests,
      });
    } catch (error: any) {
      console.error('Error in getUserJournalRequests:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getJournalRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      if (!userId) throw new Error("User ID missing");

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
    } catch (error: any) {
      console.error('Error in getJournalRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async createStatusUpdate(req: Request, res: Response) {
    try {
      const journalId = req.params.id;
      const userId = req.user?.id;
      if (!userId) throw new Error("User ID missing");
      const { status, user_comment } = req.body;

      // Validate required fields
      if (!status || !status.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Status is required',
        });
      }

      // Check if journal exists and user has access
      const journalExists = await journalModel.doesJournalExist(journalId);
      if (!journalExists) {
        return res.status(404).json({
          status: 'error',
          message: 'Journal not found',
        });
      }

      const statusUpdateId = await journalModel.createStatusUpdate(
        journalId,
        userId,
        {
          status: status.trim(),
          user_comment: user_comment?.trim() || null,
        }
      );

      res.status(201).json({
        status: 'success',
        message: 'Status update created successfully',
        data: { id: statusUpdateId },
      });
    } catch (error: any) {
      console.error('Error in createStatusUpdate:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async getStatusUpdates(req: Request, res: Response) {
    try {
      const journalId = req.params.id;
      const userId = req.user?.id;
      if (!userId) throw new Error("User ID missing");

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
    } catch (error: any) {
      console.error('Error in getStatusUpdates:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async updateStatusUpdateAdminReply(req: Request, res: Response) {
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
        admin_reply.trim()
      );

      if (result.affectedRows > 0) {
        res.status(200).json({ message: 'Admin reply updated successfully' });
      } else {
        res.status(404).json({ message: 'Status update not found' });
      }
    } catch (error: any) {
      console.error('Error in updateStatusUpdateAdminReply:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },
};

export default journalController;
