import db from '../../config/connection.js';

const journalModel = {
  async create(journalData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // First, get or create journal option with upsert logic
      // For Conference, Book Chapter, and Book, journal_name might be empty
      // In that case, we'll create a placeholder entry or use a default
      let journalOptionsId;
      
      // Check if this is a type that uses publication_details instead of journal_options
      const usesPublicationDetails = 
        journalData.type === 'Conference paper' ||
        journalData.type === 'Book Chapter' ||
        journalData.type === 'Book';
      
      if (usesPublicationDetails && !journalData.journal_name) {
        // For these types, create a minimal journal_option entry with a placeholder name
        // or use a default entry. We'll use the title as a placeholder.
        const placeholderName = journalData.title || 'Placeholder';
        const [existingOptions] = await connection.query(
          'SELECT id FROM journal_options WHERE journal_name = ?',
          [placeholderName]
        );
        
        if (existingOptions.length > 0) {
          journalOptionsId = existingOptions[0].id;
        } else {
          const [result] = await connection.query(
            'INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn) VALUES (?, ?, ?, ?, ?)',
            [
              placeholderName,
              '',
              '',
              '',
              '',
            ]
          );
          journalOptionsId = result.insertId;
        }
      } else {
        // For Journal type, use the normal logic
      const [existingOptions] = await connection.query(
        'SELECT id FROM journal_options WHERE journal_name = ?',
        [journalData.journal_name]
      );

      if (existingOptions.length > 0) {
        journalOptionsId = existingOptions[0].id;

        // Update existing journal_options with new data if provided
        const updateData = {};
        if (journalData.publisher !== undefined)
          updateData.publisher = journalData.publisher;
        if (journalData.website !== undefined)
          updateData.website = journalData.website;
        if (journalData.print_issn !== undefined)
          updateData.print_issn = journalData.print_issn;
        if (journalData.online_issn !== undefined)
          updateData.online_issn = journalData.online_issn;

        if (Object.keys(updateData).length > 0) {
          await connection.query('UPDATE journal_options SET ? WHERE id = ?', [
            updateData,
            journalOptionsId,
          ]);
        }
      } else {
        // Create new journal option
        const [result] = await connection.query(
          'INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn) VALUES (?, ?, ?, ?, ?)',
          [
            journalData.journal_name,
            journalData.publisher || '',
            journalData.website || '',
            journalData.print_issn || '',
            journalData.online_issn || '',
          ]
        );
        journalOptionsId = result.insertId;
        }
      }

      // Prepare journal data
      const journalEntry = {
        category: journalData.category,
        title: journalData.title,
        book_chapter_title: journalData.book_chapter_title || null,
        type: journalData.type,
        journal_options_id: journalOptionsId,
        quartile: journalData.quartile,
        impact_factor: journalData.impact_factor,
        cite_score: journalData.cite_score,
        anna_university_listed: journalData.anna_university_listed,
        anna_university_annexure_no: journalData.anna_university_annexure_no,
        acknowledgement: JSON.stringify(journalData.acknowledgement),
        author_affiliation: JSON.stringify(journalData.author_affiliation),
        driven_by: journalData.driven_by,
        date_of_submission: journalData.date_of_submission,
        status: journalData.status || 'waiting',
        volume: journalData.volume,
        issue: journalData.issue,
        issue_type: journalData.issue_type,
        pages_from: journalData.pages_from,
        pages_to: journalData.pages_to,
        article_number: journalData.article_number,
        abstract: journalData.abstract,
        keywords: journalData.keywords,
        sdgs: journalData.sdgs ? JSON.stringify(journalData.sdgs) : null,
        doi: journalData.doi,
        credit_to: journalData.credit_to ? JSON.stringify(journalData.credit_to) : null,
        reference_number: journalData.reference_number,
        accepted_date: journalData.accepted_date,
        available_online_date: journalData.available_online_date,
        publication_details: journalData.publication_details ? JSON.stringify(journalData.publication_details) : null,
      };

      // Insert journal
      const [journalResult] = await connection.query(
        'INSERT INTO journals SET ?',
        [journalEntry]
      );

      await connection.commit();

      // Return created journal with full details
      const [journal] = await connection.query(
        `
                SELECT j.*, jo.journal_name, jo.publisher, jo.website, jo.print_issn, jo.online_issn
                FROM journals j
                JOIN journal_options jo ON j.journal_options_id = jo.id
                WHERE j.id = ?
            `,
        [journalResult.insertId]
      );

      return journal[0];
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creating journal: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async update(id, journalData) {
    try {
      const filteredData = Object.fromEntries(
        Object.entries(journalData).filter(
          ([_, value]) => value !== null && value !== undefined
        )
      );
      
      // Handle publication_details JSON field
      if (filteredData.publication_details && typeof filteredData.publication_details === 'object') {
        filteredData.publication_details = JSON.stringify(filteredData.publication_details);
      }
      
      const [result] = await db.query('UPDATE journals SET ? WHERE id = ?', [
        filteredData,
        id,
      ]);
      return result;
    } catch (error) {
      throw new Error(`Error updating journal: ${error.message}`);
    }
  },

  async updateAuthorInJournal(journalId, dbAuthorId, authorData) {
    try {
      const [result] = await db.query(
        'UPDATE author_journal SET is_first_author = ?, is_primary = ? WHERE id = ? AND journal_id = ?',
        [
          authorData.is_first_author ? 1 : 0,
          authorData.is_primary ? 1 : 0,
          dbAuthorId,
          journalId,
        ]
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating author in model: ${error.message}`);
    }
  },

  async updateJournalAndOptions(journalId, journalData, journalOptionsData) {
    try {
      // Retrieve the journal_options_id from the journals table using the journalId directly
      const [journalRows] = await db.query(
        'SELECT journal_options_id FROM journals WHERE id = ?',
        [journalId]
      );
      if (!journalRows || journalRows.length === 0) {
        throw new Error('Journal not found');
      }
      const journalOptionsId = journalRows[0].journal_options_id;

      // Update the journal_options table if there is data to update
      if (Object.keys(journalOptionsData).length > 0) {
        await db.query('UPDATE journal_options SET ? WHERE id = ?', [
          journalOptionsData,
          journalOptionsId,
        ]);
      }

      // Update the journals table if there is data to update
      if (Object.keys(journalData).length > 0) {
        await db.query('UPDATE journals SET ? WHERE id = ?', [
          journalData,
          journalId,
        ]);
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Error updating journal: ${error.message}`);
    }
  },

  async delete(id) {
    try {
      const [result] = await db.query('DELETE FROM journals WHERE id = ?', [
        id,
      ]);
      return result;
    } catch (error) {
      throw new Error(`Error deleting journal: ${error.message}`);
    }
  },

  async addAuthor(journalId, authorData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let authorId;
      const {
        designation,
        author_id,
        name,
        department,
        organization,
        country,
        state,
        email,
      } = authorData;

      if (designation === 'faculty') {
        if (!author_id) throw new Error('Faculty ID is required.');
        const [existingFaculty] = await connection.query(
          'SELECT id FROM authors WHERE author_id = ?',
          [author_id] // author_id from request is the faculty author_id
        );

        if (existingFaculty.length === 0) {
          throw new Error(`Faculty not found with ID: ${author_id}`);
        }
        authorId = existingFaculty[0].id;
      } else if (designation === 'student') {
        if (!author_id) throw new Error('Student Register Number is required.');
        const [existingStudent] = await connection.query(
          'SELECT id FROM authors WHERE student_id = ?',
          [author_id] // author_id from request is the student_id
        );

        if (existingStudent.length > 0) {
          throw new Error(
            `A student with Register Number '${author_id}' already exists.`
          );
        }

        const studentAuthorData = {
          student_id: author_id, // Use the new student_id column
          designation: 'student',
          name,
          department,
          organization,
          country,
          email: email || null,
        };

        const [result] = await connection.query(
          'INSERT INTO authors SET ?',
          studentAuthorData
        );
        authorId = result.insertId;
      } else if (designation === 'external') {
        // External: No author_id, create new author row with designation external
        if (!name || !department || !organization || !country || !state) {
          throw new Error(
            'Name, Department, Organization, Country, and State are required for external authors.'
          );
        }
        const externalAuthorData = {
          designation: 'external',
          name,
          department,
          organization,
          country,
          state,
          email: email || null,
        };
        const [result] = await connection.query(
          'INSERT INTO authors SET ?',
          externalAuthorData
        );
        authorId = result.insertId;
      } else {
        throw new Error('Invalid designation provided.');
      }

      const [authorJournalResult] = await connection.query(
        `INSERT INTO author_journal (author_id, journal_id, is_first_author, is_primary) 
                 VALUES (?, ?, ?, ?)`,
        [
          authorId,
          journalId,
          authorData.is_first_author ? 1 : 0,
          authorData.is_primary ? 1 : 0,
        ]
      );

      await connection.commit();
      return { authorId, authorJournalId: authorJournalResult.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getAuthors(journalId) {
    try {
      const [rows] = await db.query(
        `
                SELECT a.*, aj.id AS dbAuthorId, aj.is_first_author, aj.is_primary
                FROM authors a
                JOIN author_journal aj ON a.id = aj.author_id
                WHERE aj.journal_id = ?
            `,
        [journalId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving authors: ${error.message}`);
    }
  },

  async searchAuthor(query, designation = null) {
    try {
      let queryStr = `SELECT id, name, email, designation, author_id, student_id, organization, department, country
                            FROM authors
                            WHERE name LIKE ? OR author_id LIKE ? OR student_id LIKE ?`;
      let params = [`%${query}%`, `${query}%`, `${query}%`];

      if (designation) {
        queryStr += ` AND designation = ?`;
        params.push(designation);
      }

      const [rows] = await db.query(queryStr, params);
      return rows;
    } catch (error) {
      console.error('Database error in searchAuthor:', error);
      throw new Error(`Error searching for author: ${error.message}`);
    }
  },

  async addIndex(journalId, indexName) {
    try {
      const [result] = await db.query('INSERT INTO journal_indexes SET ?', {
        journal_id: journalId,
        index_name: indexName,
      });
      return result;
    } catch (error) {
      throw new Error(`Error adding index: ${error.message}`);
    }
  },

  async getIndexes(journalId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM journal_indexes WHERE journal_id = ?',
        [journalId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving indexes: ${error.message}`);
    }
  },

  async searchJournals(query) {
    try {
      const searchTerm = `%${query}%`;
      const [rows] = await db.query(
        `
                SELECT 
                    jo.id,
                    jo.journal_name as name,
                    jo.publisher,
                    jo.website,
                    jo.print_issn as printISSN,
                    jo.online_issn as onlineISSN,
                    j.category
                FROM journal_options jo
                LEFT JOIN journals j ON j.journal_options_id = jo.id
                WHERE jo.journal_name LIKE ?
                
                UNION
                
                SELECT 
                    jr.id + 1000000 as id, -- Use offset to avoid conflicts
                    jr.journal_name as name,
                    jr.publisher,
                    jr.website,
                    jr.print_issn as printISSN,
                    jr.online_issn as onlineISSN,
                    jr.category
                FROM journal_requests jr
                WHERE jr.status = 'approved' 
                AND jr.journal_name LIKE ?
                
                ORDER BY name
                LIMIT 10
            `,
        [searchTerm, searchTerm]
      );

      return rows;
    } catch (error) {
      throw new Error(`Error searching journals: ${error.message}`);
    }
  },

  async doesJournalExist(journalId) {
    const [rows] = await db.query('SELECT 1 FROM journals WHERE id = ?', [
      journalId,
    ]);
    return rows.length > 0;
  },

  async getCompleteJournalDetails(id) {
    try {
      const [journal] = await db.query(
        `
                SELECT
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    jo.website,
                    jo.print_issn,
                    jo.online_issn
                FROM journals j
                JOIN journal_options jo ON j.journal_options_id = jo.id
                WHERE j.id = ?
            `,
        [id]
      );

      if (!journal[0]) return null;

      // Get authors, aliasing aj.id as dbAuthorId
      const [authors] = await db.query(
        `
                SELECT a.*, aj.id AS dbAuthorId, aj.is_first_author, aj.is_primary
                FROM authors a
                JOIN author_journal aj ON a.id = aj.author_id
                WHERE aj.journal_id = ?
            `,
        [id]
      );

      // Get indexes
      const [indexes] = await db.query(
        'SELECT index_name FROM journal_indexes WHERE journal_id = ?',
        [id]
      );

      // Helper function to safely parse JSON fields
      const safeParseJSON = (value, fallback = null) => {
        if (!value) return fallback;
        if (typeof value !== 'string') return value; // Already parsed
        try {
          return JSON.parse(value);
        } catch (e) {
          // If parsing fails, check if it's a plain string that should be wrapped in array
          if (fallback !== null && Array.isArray(fallback)) {
            return [value]; // Wrap plain string in array
          }
          return fallback;
        }
      };

      // Parse JSON fields before returning
      const journalResult = journal[0];
      journalResult.acknowledgement = safeParseJSON(journalResult.acknowledgement, {});
      journalResult.author_affiliation = safeParseJSON(journalResult.author_affiliation, []);
      journalResult.sdgs = safeParseJSON(journalResult.sdgs, []);
      journalResult.credit_to = safeParseJSON(journalResult.credit_to, []);
      journalResult.publication_details = safeParseJSON(journalResult.publication_details, null);

      return {
        ...journalResult,
        authors: authors,
        indexes: indexes.map((i) => i.index_name),
      };
    } catch (error) {
      throw new Error(`Error retrieving journal details: ${error.message}`);
    }
  },

  // Journal Request methods
  async createJournalRequest(requestData) {
    try {
      const [result] = await db.query(
        'INSERT INTO journal_requests (user_id, journal_name, publisher, website, print_issn, online_issn, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          requestData.user_id,
          requestData.journal_name,
          requestData.publisher,
          requestData.website,
          requestData.print_issn,
          requestData.online_issn,
          requestData.category || 'National',
          'pending', // Default status
        ]
      );

      // Return the created request
      const [request] = await db.query(
        'SELECT * FROM journal_requests WHERE id = ?',
        [result.insertId]
      );

      return request[0];
    } catch (error) {
      throw new Error(`Error creating journal request: ${error.message}`);
    }
  },

  async getUserJournalRequests(userId) {
    try {
      const [requests] = await db.query(
        'SELECT * FROM journal_requests WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return requests;
    } catch (error) {
      throw new Error(`Error getting user journal requests: ${error.message}`);
    }
  },

  async getJournalRequest(id, userId) {
    try {
      const [requests] = await db.query(
        'SELECT * FROM journal_requests WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return requests[0] || null;
    } catch (error) {
      throw new Error(`Error getting journal request: ${error.message}`);
    }
  },

  // Status Update methods
  async createStatusUpdate(journalId, userId, statusData) {
    try {
      const [result] = await db.query(
        'INSERT INTO journal_status_updates (journal_id, user_id, status, user_comment) VALUES (?, ?, ?, ?)',
        [journalId, userId, statusData.status, statusData.user_comment || null]
      );
      return result.insertId;
    } catch (error) {
      throw new Error(`Error creating status update: ${error.message}`);
    }
  },

  async getStatusUpdates(journalId) {
    try {
      const [rows] = await db.query(
        `SELECT jsu.*, u.name as user_name 
                 FROM journal_status_updates jsu
                 JOIN users u ON jsu.user_id = u.id
                 WHERE jsu.journal_id = ? 
                 ORDER BY jsu.created_at ASC`,
        [journalId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving status updates: ${error.message}`);
    }
  },

  async updateStatusUpdateAdminReply(statusUpdateId, adminReply) {
    try {
      const [result] = await db.query(
        'UPDATE journal_status_updates SET admin_reply = ? WHERE id = ?',
        [adminReply, statusUpdateId]
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating admin reply: ${error.message}`);
    }
  },
};

export default journalModel;
