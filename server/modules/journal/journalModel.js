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
        external_details: journalData.external_details
          ? JSON.stringify(journalData.external_details)
          : null,
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
        scopus_id: journalData.scopus_id,
        scie_id: journalData.scie_id,
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
      if (
        filteredData.publication_details &&
        typeof filteredData.publication_details === 'object'
      ) {
        filteredData.publication_details = JSON.stringify(filteredData.publication_details);
      }
      // Handle external_details JSON field
      if (
        filteredData.external_details &&
        typeof filteredData.external_details === 'object'
      ) {
        filteredData.external_details = JSON.stringify(filteredData.external_details);
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
      let isExternalAuthor = false;
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
        if (!author_id) throw new Error('Faculty ERP ID is required.');

        // Look up in master_employees using erp_id
        const [employeeRows] = await connection.query(
          'SELECT id, email, first_name, last_name FROM master_employees WHERE erp_id = ?',
          [author_id]
        );

        if (employeeRows.length === 0) {
          throw new Error(`Faculty not found with ERP ID: ${author_id}`);
        }

        const employee = employeeRows[0];

        // Check if an author entry already exists for this employee
        const [existingAuthorRows] = await connection.query(
          'SELECT id FROM authors WHERE employee_id = ?',
          [employee.id]
        );

        if (existingAuthorRows.length > 0) {
          // Reuse existing author entry
          authorId = existingAuthorRows[0].id;
        } else {
          // Create new author entry linked to employee
          const [authorInsert] = await connection.query(
            `INSERT INTO authors (employee_id, name, email, designation) VALUES (?, ?, ?, 'faculty')`,
            [employee.id, null, null]  // name and email come from master_employees via view
          );
          authorId = authorInsert.insertId;
        }
      } else if (designation === 'student') {
        if (!author_id) throw new Error('Student Register Number is required.');

        // Ensure student exists in author_students table
        let studentId;
        const [existingStudentRows] = await connection.query(
          'SELECT id FROM author_students WHERE student_unique_id = ?',
          [author_id]
        );

        if (existingStudentRows.length > 0) {
          studentId = existingStudentRows[0].id;
        } else {
          const [studentInsert] = await connection.query(
            'INSERT INTO author_students (student_unique_id, name, department, organization, country) VALUES (?, ?, ?, ?, ?)',
            [author_id, name, department, organization, country]
          );
          studentId = studentInsert.insertId;
        }

        // Reuse or create corresponding author row that references this student
        const [existingAuthorRows] = await connection.query(
          'SELECT id FROM authors WHERE student_ref = ?',
          [studentId]
        );

        if (existingAuthorRows.length > 0) {
          authorId = existingAuthorRows[0].id;
          // Optionally keep author details in sync with latest student info
          await connection.query(
            'UPDATE authors SET name = ?, department = ?, organization = ?, country = ?, email = ? WHERE id = ?',
            [name, department, organization, country, email || null, authorId]
          );
        } else {
          const studentAuthorData = {
            student_ref: studentId,
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
        }
      } else if (designation === 'external') {
        // External authors are stored in journals.external_details JSON, not in authors table
        if (!name || !department || !organization || !country) {
          throw new Error(
            'Name, Department, Organization, and Country are required for external authors.'
          );
        }

        // Fetch existing external_details for this journal
        const [journalRows] = await connection.query(
          'SELECT external_details FROM journals WHERE id = ? FOR UPDATE',
          [journalId]
        );
        if (!journalRows || journalRows.length === 0) {
          throw new Error('Journal not found while adding external author.');
        }

        let externalDetails = [];
        const rawExternal = journalRows[0].external_details;
        if (rawExternal) {
          try {
            externalDetails =
              typeof rawExternal === 'string'
                ? JSON.parse(rawExternal)
                : rawExternal;
            if (!Array.isArray(externalDetails)) externalDetails = [];
          } catch (e) {
            externalDetails = [];
          }
        }

        externalDetails.push({
          name,
          department,
          organization,
          country,
          state: state || '',
          email: email || null,
          is_first_author: !!authorData.is_first_author,
          is_primary: !!authorData.is_primary,
        });

        await connection.query(
          'UPDATE journals SET external_details = ? WHERE id = ?',
          [JSON.stringify(externalDetails), journalId]
        );
        // Mark as external-only so we skip author_journal insert
        isExternalAuthor = true;
      } else {
        throw new Error('Invalid designation provided.');
      }
      let authorJournalResult = { insertId: null };

      if (!isExternalAuthor) {
        const [insertResult] = await connection.query(
          `INSERT INTO author_journal (author_id, journal_id, is_first_author, is_primary) 
                 VALUES (?, ?, ?, ?)`,
          [
            authorId,
            journalId,
            authorData.is_first_author ? 1 : 0,
            authorData.is_primary ? 1 : 0,
          ]
        );
        authorJournalResult = insertResult;
      }

      await connection.commit();
      return {
        authorId: isExternalAuthor ? null : authorId,
        authorJournalId: authorJournalResult.insertId,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async getAuthors(journalId) {
    try {
      // Use v_authors view which pulls faculty data from master_employees
      const [rows] = await db.query(
        `SELECT
          v.author_id AS id,
          v.author_name AS name,
          v.email,
          v.designation,
          v.department,
          v.organization,
          v.author_type,
          v.erp_id AS author_id,
          v.orcid_id,
          v.scopus_id,
          aj.id AS dbAuthorId,
          aj.is_first_author,
          aj.is_primary
        FROM v_authors v
        JOIN author_journal aj ON v.author_id = aj.author_id
        WHERE aj.journal_id = ?`,
        [journalId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving authors: ${error.message}`);
    }
  },

  async searchAuthor(query, designation = null) {
    try {
      // Only search faculty in master_employees
      // Students are added manually, no search needed

      let queryStr = query ? query.trim() : '';
      let sql = '';
      let params = [];

      if (!queryStr) {
        // Return top 20 active faculty if query is empty
        sql = `SELECT 
          e.id,
          TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS name,
          e.email,
          e.designation,
          e.erp_id AS author_id,
          'K.S.Rangasamy College of Technology' AS organization,
          d.name AS department,
          'India' AS country,
          e.orcid_id,
          e.scopus_id,
          e.google_scholar_id
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;
      } else {
        // Search by query
        sql = `SELECT 
          e.id,
          TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) AS name,
          e.email,
          e.designation,
          e.erp_id AS author_id,
          'K.S.Rangasamy College of Technology' AS organization,
          d.name AS department,
          'India' AS country,
          e.orcid_id,
          e.scopus_id,
          e.google_scholar_id
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
          AND (
            e.first_name LIKE ? 
            OR e.last_name LIKE ? 
            OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
            OR e.erp_id LIKE ?
            OR e.email LIKE ?
          )
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;
        params = [`%${queryStr}%`, `%${queryStr}%`, `%${queryStr}%`, `${queryStr}%`, `%${queryStr}%`];
      }

      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Database error in searchAuthor:', error);
      throw new Error(`Error searching for author: ${error.message} `);
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
      throw new Error(`Error adding index: ${error.message} `);
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
      throw new Error(`Error retrieving indexes: ${error.message} `);
    }
  },

  async searchJournals(query) {
    try {
      const queryStr = query ? query.trim() : '';
      let sql = '';
      let params = [];

      if (!queryStr) {
        // Return all journals when query is empty
        sql = `
          SELECT
            jo.id,
            jo.journal_name as name,
            jo.publisher,
            jo.website,
            jo.print_issn as printISSN,
            jo.online_issn as onlineISSN,
            jo.impact_factor as impactFactor,
            jo.cite_score as citeScore
          FROM journal_options jo
          ORDER BY jo.journal_name
          LIMIT 20
        `;
      } else {
        const searchTerm = `%${queryStr}%`;
        sql = `
          SELECT
            jo.id,
            jo.journal_name as name,
            jo.publisher,
            jo.website,
            jo.print_issn as printISSN,
            jo.online_issn as onlineISSN,
            jo.impact_factor as impactFactor,
            jo.cite_score as citeScore
          FROM journal_options jo
          WHERE jo.journal_name LIKE ?
          ORDER BY jo.journal_name
          LIMIT 20
        `;
        params = [searchTerm];
      }

      const [rows] = await db.query(sql, params);
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

  async getJournalWorkflowAccess(journalId, userId, userEmail) {
    try {
      const [rows] = await db.query(
        `
          SELECT
            j.id,
            j.status,
            COALESCE(j.admin_approval_status, 'pending') AS admin_approval_status,
            j.admin_approval_comment,
            COALESCE(uer.status, 'none') AS edit_request_status,
            EXISTS (
              SELECT 1
              FROM author_journal aj2
              INNER JOIN v_authors va2 ON va2.author_id = aj2.author_id
              WHERE aj2.journal_id = j.id
                AND va2.email = ?
            ) AS is_author
          FROM journals j
          LEFT JOIN (
            SELECT er1.entity_id, er1.status
            FROM edit_requests er1
            INNER JOIN (
              SELECT entity_id, MAX(id) AS latest_id
              FROM edit_requests
              WHERE entity_type = 'journals'
                AND user_id = ?
              GROUP BY entity_id
            ) latest_er ON latest_er.latest_id = er1.id
            WHERE er1.entity_type = 'journals'
              AND er1.user_id = ?
          ) uer ON uer.entity_id = j.id
          WHERE j.id = ?
          LIMIT 1
        `,
        [userEmail, userId, userId, journalId]
      );

      if (!rows.length) {
        return null;
      }

      const row = rows[0];
      return {
        ...row,
        admin_approval_status: row.admin_approval_status || 'pending',
        edit_request_status: row.edit_request_status || 'none',
        is_author: Boolean(row.is_author),
      };
    } catch (error) {
      throw new Error(`Error retrieving journal workflow access: ${error.message}`);
    }
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

      // Get authors using v_authors view (pulls faculty data from master_employees)
      const [authors] = await db.query(
        `SELECT
v.author_id AS id,
  v.author_name AS name,
    v.email,
    v.designation,
    v.department,
    v.organization,
    v.author_type,
    v.erp_id AS author_id,
      v.orcid_id,
      v.scopus_id,
      aj.id AS dbAuthorId,
        aj.is_first_author,
        aj.is_primary
        FROM v_authors v
        JOIN author_journal aj ON v.author_id = aj.author_id
        WHERE aj.journal_id = ? `,
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
      journalResult.external_details = safeParseJSON(
        journalResult.external_details,
        []
      );

      return {
        ...journalResult,
        authors: authors,
        indexes: indexes.map((i) => i.index_name),
      };
    } catch (error) {
      throw new Error(`Error retrieving journal details: ${error.message} `);
    }
  },

  // Journal Request methods
  async createJournalRequest(requestData) {
    try {
      const [result] = await db.query(
        'INSERT INTO journal_requests (user_id, journal_name, publisher, website, print_issn, online_issn, impact_factor, cite_score, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          requestData.user_id,
          requestData.journal_name,
          requestData.publisher,
          requestData.website,
          requestData.print_issn,
          requestData.online_issn,
          requestData.impact_factor || null,
          requestData.cite_score || null,
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
      throw new Error(`Error creating journal request: ${error.message} `);
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
      throw new Error(`Error getting user journal requests: ${error.message} `);
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
      throw new Error(`Error getting journal request: ${error.message} `);
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
      throw new Error(`Error creating status update: ${error.message} `);
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
      throw new Error(`Error retrieving status updates: ${error.message} `);
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
      throw new Error(`Error updating admin reply: ${error.message} `);
    }
  },
};

export default journalModel;
