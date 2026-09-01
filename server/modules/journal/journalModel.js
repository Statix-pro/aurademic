import db from '../../config/connection.js';

/**
 * National/International is a property of the journal itself, curated by admins in
 * Journal Management (`journal_options.category`). `journals.category` is only a
 * snapshot of it, so it is always derived from the linked option rather than trusted
 * from the submitted form — otherwise a publication keeps reporting the default
 * 'National' after an admin has set the journal to 'International'.
 */
const VALID_CATEGORIES = ['National', 'International'];

const normalizeCategory = (value, fallback = 'National') => {
  const match = VALID_CATEGORIES.find(
    (category) =>
      category.toLowerCase() ===
      String(value || '')
        .trim()
        .toLowerCase(),
  );
  return match || fallback;
};

/** Types that have no journal and therefore stand in with a placeholder registry row. */
const PLACEHOLDER_OPTION_TYPES = ['Conference paper', 'Book Chapter', 'Book'];

const usesPlaceholderOption = (type) => PLACEHOLDER_OPTION_TYPES.includes(type);

/**
 * Finds or creates the stand-in registry row for a book/chapter/conference. The lookup is
 * confined to placeholder rows so a book never latches onto a real journal that happens
 * to share its title (and vice versa).
 */
const resolvePlaceholderOptionId = async (executor, name) => {
  const placeholderName = String(name || '').trim() || 'Placeholder';

  const [existing] = await executor.query(
    'SELECT id FROM journal_options WHERE journal_name = ? AND is_placeholder = 1 ORDER BY id LIMIT 1',
    [placeholderName],
  );
  if (existing.length > 0) {
    return existing[0].id;
  }

  const [inserted] = await executor.query(
    `INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn, is_placeholder)
     VALUES (?, '', '', '', '', 1)`,
    [placeholderName],
  );
  return inserted.insertId;
};

const resolveOptionCategory = async (executor, journalOptionsId, submittedCategory) => {
  if (!journalOptionsId) {
    return normalizeCategory(submittedCategory);
  }

  const [rows] = await executor.query('SELECT category FROM journal_options WHERE id = ?', [
    journalOptionsId,
  ]);

  // A placeholder option (Conference/Book/Book Chapter) carries no curated category,
  // so those publications fall back to whatever the form reported.
  return normalizeCategory(rows[0]?.category, normalizeCategory(submittedCategory));
};

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
      const usesPublicationDetails = usesPlaceholderOption(journalData.type);

      // The picker knows exactly which registry entry the user chose, so trust its id.
      // Resolving by name alone silently swapped in a different entry whenever two share
      // a name — and since each copy carries its own National/International value, the
      // publication came out on the wrong level.
      const requestedOptionId = Number(journalData.journal_options_id);
      if (Number.isInteger(requestedOptionId) && requestedOptionId > 0) {
        const [requestedOption] = await connection.query(
          'SELECT id FROM journal_options WHERE id = ?',
          [requestedOptionId],
        );
        if (requestedOption.length > 0) {
          journalOptionsId = requestedOption[0].id;
        }
      }

      if (journalOptionsId) {
        // Already resolved by id; nothing to look up by name.
      } else if (usesPublicationDetails) {
        // Books, chapters and conference papers have no journal, but
        // journals.journal_options_id is NOT NULL, so they get a stand-in row named after
        // themselves. The type decides this, not whether a name happens to be present:
        // a conference paper submits its conference title as the "journal name", which
        // used to take the branch below and publish the conference into the picker as a
        // selectable journal.
        journalOptionsId = await resolvePlaceholderOptionId(
          connection,
          journalData.journal_name || journalData.title,
        );
      } else {
        // For Journal type, use the normal logic
        // Deterministic fallback for submissions that carry no option id (older clients).
        const [existingOptions] = await connection.query(
          'SELECT id FROM journal_options WHERE journal_name = ? ORDER BY id LIMIT 1',
          [journalData.journal_name],
        );

        if (existingOptions.length > 0) {
          journalOptionsId = existingOptions[0].id;

          // Fill in registry gaps from the submission, but never blank a value the admin
          // already curated: the publication form mirrors these fields read-only, so an
          // empty string here means "not captured", not "clear it".
          const updateData = {};
          const fillIfProvided = (field) => {
            const value = journalData[field];
            if (typeof value === 'string' && value.trim() !== '') {
              updateData[field] = value.trim();
            }
          };
          fillIfProvided('publisher');
          fillIfProvided('website');
          fillIfProvided('print_issn');
          fillIfProvided('online_issn');

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
            ],
          );
          journalOptionsId = result.insertId;
        }
      }

      // Prepare journal data
      const journalEntry = {
        category: await resolveOptionCategory(connection, journalOptionsId, journalData.category),
        title: journalData.title,
        book_chapter_title: journalData.book_chapter_title || null,
        type: journalData.type,
        journal_options_id: journalOptionsId,
        quartile: journalData.quartile,
        impact_factor: journalData.impact_factor,
        cite_score: journalData.cite_score,
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
        // Who filed the submission. Access used to be inferred from authorship alone, so
        // a submitter who did not credit themselves lost the record immediately.
        created_by: journalData.created_by || null,
        accepted_date: journalData.accepted_date,
        available_online_date: journalData.available_online_date,
        publication_details: journalData.publication_details
          ? JSON.stringify(journalData.publication_details)
          : null,
        scopus_id: journalData.scopus_id,
        scie_id: journalData.scie_id,
        open_access: journalData.open_access,
        year: journalData.year,
        wos_id: journalData.wos_id,
        pubmed_pmid: journalData.pubmed_pmid,
      };

      // Insert journal
      const [journalResult] = await connection.query('INSERT INTO journals SET ?', [journalEntry]);

      await connection.commit();

      // Return created journal with full details
      const [journal] = await connection.query(
        `
                SELECT j.*, jo.journal_name, jo.publisher, jo.website, jo.print_issn, jo.online_issn
                FROM journals j
                JOIN journal_options jo ON j.journal_options_id = jo.id
                WHERE j.id = ?
            `,
        [journalResult.insertId],
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
        Object.entries(journalData).filter(([_, value]) => value !== null && value !== undefined),
      );

      // Handle publication_details JSON field
      if (
        filteredData.publication_details &&
        typeof filteredData.publication_details === 'object'
      ) {
        filteredData.publication_details = JSON.stringify(filteredData.publication_details);
      }
      // Handle external_details JSON field
      if (filteredData.external_details && typeof filteredData.external_details === 'object') {
        filteredData.external_details = JSON.stringify(filteredData.external_details);
      }

      const [result] = await db.query('UPDATE journals SET ? WHERE id = ?', [filteredData, id]);
      return result;
    } catch (error) {
      throw new Error(`Error updating journal: ${error.message}`);
    }
  },

  async updateAuthorInJournal(journalId, dbAuthorId, authorData) {
    try {
      const [result] = await db.query(
        'UPDATE author_journal SET is_first_author = ?, is_primary = ? WHERE id = ? AND journal_id = ?',
        [authorData.is_first_author ? 1 : 0, authorData.is_primary ? 1 : 0, dbAuthorId, journalId],
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating author in model: ${error.message}`);
    }
  },

  /**
   * Saves an edit to one publication.
   *
   * `journal_options` is a registry shared by every publication that cites the journal,
   * so an edit here never writes to it: renaming it from one publication's form used to
   * rename the journal for all of them (and a Book, which submits an empty name, blanked
   * the row outright). Instead a changed name re-points this publication at the matching
   * registry entry, and `journals.category` is re-derived from whatever entry it ends up on.
   */
  async updateJournalAndOptions(journalId, journalData, journalOptionsData = {}) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [journalRows] = await connection.query(
        `SELECT j.journal_options_id, j.type, jo.journal_name
           FROM journals j
           LEFT JOIN journal_options jo ON jo.id = j.journal_options_id
          WHERE j.id = ?`,
        [journalId],
      );
      if (!journalRows || journalRows.length === 0) {
        throw new Error('Journal not found');
      }

      let journalOptionsId = journalRows[0].journal_options_id;
      const currentName = journalRows[0].journal_name || '';
      const submittedName =
        typeof journalOptionsData.journal_name === 'string'
          ? journalOptionsData.journal_name.trim()
          : '';

      // Prefer the id the picker sent, for the same reason create() does: two entries can
      // share a name but carry different National/International values.
      const requestedOptionId = Number(journalOptionsData.journal_options_id);
      let resolvedById = false;
      if (Number.isInteger(requestedOptionId) && requestedOptionId > 0) {
        const [requestedOption] = await connection.query(
          'SELECT id FROM journal_options WHERE id = ?',
          [requestedOptionId],
        );
        if (requestedOption.length > 0) {
          journalOptionsId = requestedOption[0].id;
          resolvedById = true;
        }
      }

      // An empty name means the form had nothing to say about the journal (Book and
      // Book Chapter always do), not that the link should be dropped.
      // The type on the record wins over anything the form claims, so a rename cannot
      // turn a book's stand-in row into a real journal or vice versa.
      const publicationType = journalData.type || journalRows[0].type;

      if (!resolvedById && submittedName && submittedName !== currentName) {
        if (usesPlaceholderOption(publicationType)) {
          journalOptionsId = await resolvePlaceholderOptionId(connection, submittedName);
        } else {
          const [matchingOptions] = await connection.query(
            'SELECT id FROM journal_options WHERE journal_name = ? AND is_placeholder = 0 ORDER BY id LIMIT 1',
            [submittedName],
          );

          if (matchingOptions.length > 0) {
            journalOptionsId = matchingOptions[0].id;
          } else {
            const [inserted] = await connection.query(
              'INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn) VALUES (?, ?, ?, ?, ?)',
              [
                submittedName,
                journalOptionsData.publisher || '',
                journalOptionsData.website || '',
                journalOptionsData.print_issn || '',
                journalOptionsData.online_issn || '',
              ],
            );
            journalOptionsId = inserted.insertId;
          }
        }
      }

      const updateData = {
        ...journalData,
        journal_options_id: journalOptionsId,
        category: await resolveOptionCategory(connection, journalOptionsId, journalData.category),
      };

      await connection.query('UPDATE journals SET ? WHERE id = ?', [updateData, journalId]);

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error updating journal: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async delete(id) {
    try {
      const [result] = await db.query('DELETE FROM journals WHERE id = ?', [id]);
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
      const { designation, author_id, name, department, organization, country, state, email } =
        authorData;

      if (designation === 'faculty') {
        if (!author_id) throw new Error('Faculty ERP ID is required.');

        // Look up in master_employees using erp_id
        const [employeeRows] = await connection.query(
          'SELECT id, email, first_name, last_name FROM master_employees WHERE erp_id = ?',
          [author_id],
        );

        if (employeeRows.length === 0) {
          throw new Error(`Faculty not found with ERP ID: ${author_id}`);
        }

        const employee = employeeRows[0];

        // Check if an author entry already exists for this employee
        const [existingAuthorRows] = await connection.query(
          'SELECT id FROM authors WHERE employee_id = ?',
          [employee.id],
        );

        if (existingAuthorRows.length > 0) {
          // Reuse existing author entry
          authorId = existingAuthorRows[0].id;
        } else {
          // Create new author entry linked to employee
          const [authorInsert] = await connection.query(
            `INSERT INTO authors (employee_id, name, email, designation) VALUES (?, ?, ?, 'faculty')`,
            [employee.id, null, null], // name and email come from master_employees via view
          );
          authorId = authorInsert.insertId;
        }
      } else if (designation === 'student') {
        if (!author_id) throw new Error('Student Register Number is required.');

        // Ensure student exists in author_students table
        let studentId;
        const [existingStudentRows] = await connection.query(
          'SELECT id FROM author_students WHERE student_unique_id = ?',
          [author_id],
        );

        if (existingStudentRows.length > 0) {
          studentId = existingStudentRows[0].id;
        } else {
          // author_students has no country column; the country lives on the `authors` row
          // created below. Including it here made every new student author fail with
          // "Unknown column 'country' in 'field list'".
          const [studentInsert] = await connection.query(
            'INSERT INTO author_students (student_unique_id, name, department, organization) VALUES (?, ?, ?, ?)',
            [author_id, name, department, organization],
          );
          studentId = studentInsert.insertId;
        }

        // Reuse or create corresponding author row that references this student
        const [existingAuthorRows] = await connection.query(
          'SELECT id FROM authors WHERE student_ref = ?',
          [studentId],
        );

        if (existingAuthorRows.length > 0) {
          authorId = existingAuthorRows[0].id;
          // Optionally keep author details in sync with latest student info
          await connection.query(
            'UPDATE authors SET name = ?, department = ?, organization = ?, country = ?, email = ? WHERE id = ?',
            [name, department, organization, country, email || null, authorId],
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

          const [result] = await connection.query('INSERT INTO authors SET ?', studentAuthorData);
          authorId = result.insertId;
        }
      } else if (designation === 'external') {
        // External authors are stored in journals.external_details JSON, not in authors table
        if (!name || !department || !organization || !country) {
          throw new Error(
            'Name, Department, Organization, and Country are required for external authors.',
          );
        }

        // Fetch existing external_details for this journal
        const [journalRows] = await connection.query(
          'SELECT external_details FROM journals WHERE id = ? FOR UPDATE',
          [journalId],
        );
        if (!journalRows || journalRows.length === 0) {
          throw new Error('Journal not found while adding external author.');
        }

        let externalDetails = [];
        const rawExternal = journalRows[0].external_details;
        if (rawExternal) {
          try {
            externalDetails =
              typeof rawExternal === 'string' ? JSON.parse(rawExternal) : rawExternal;
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

        await connection.query('UPDATE journals SET external_details = ? WHERE id = ?', [
          JSON.stringify(externalDetails),
          journalId,
        ]);
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
          [authorId, journalId, authorData.is_first_author ? 1 : 0, authorData.is_primary ? 1 : 0],
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
          v.student_ref,
          -- For a student, v_authors puts the register number in erp_id. The form keeps
          -- register numbers in their own field, and without this the row came back
          -- looking like a faculty member whose ERP id was a register number.
          CASE WHEN v.student_ref IS NOT NULL THEN v.erp_id END AS student_id,
          v.orcid_id,
          v.scopus_id,
          a.country,
          a.state,
          aj.id AS dbAuthorId,
          aj.is_first_author,
          aj.is_primary
        FROM v_authors v
        JOIN author_journal aj ON v.author_id = aj.author_id
        LEFT JOIN authors a ON a.id = v.author_id
        WHERE aj.journal_id = ?`,
        [journalId],
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
        params = [
          `%${queryStr}%`,
          `%${queryStr}%`,
          `%${queryStr}%`,
          `${queryStr}%`,
          `%${queryStr}%`,
        ];
      }

      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Database error in searchAuthor:', error);
      throw new Error(`Error searching for author: ${error.message} `);
    }
  },

  /**
   * Removes one faculty/student author from a publication. External authors live in
   * `journals.external_details` and are rewritten wholesale on save, so only the
   * `author_journal` link needs deleting here; the shared `authors` row is left alone
   * because other publications may still cite it.
   */
  async deleteAuthorFromJournal(journalId, dbAuthorId) {
    try {
      const [result] = await db.query(
        'DELETE FROM author_journal WHERE id = ? AND journal_id = ?',
        [dbAuthorId, journalId],
      );
      return result;
    } catch (error) {
      throw new Error(`Error removing author from journal: ${error.message}`);
    }
  },

  /**
   * Replaces the whole index set for a publication. The edit flow used to re-POST every
   * selected index on each save, which duplicated rows and left de-selected indexes behind.
   */
  async replaceIndexes(journalId, indexNames) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM journal_indexes WHERE journal_id = ?', [journalId]);

      const seen = new Set();
      const cleanNames = [];
      (Array.isArray(indexNames) ? indexNames : []).forEach((name) => {
        const trimmed = String(name || '').trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !seen.has(key)) {
          seen.add(key);
          cleanNames.push(trimmed);
        }
      });

      if (cleanNames.length > 0) {
        await connection.query('INSERT INTO journal_indexes (journal_id, index_name) VALUES ?', [
          cleanNames.map((name) => [journalId, name]),
        ]);
      }

      await connection.commit();
      return cleanNames;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error replacing indexes: ${error.message}`);
    } finally {
      connection.release();
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
      const [rows] = await db.query('SELECT * FROM journal_indexes WHERE journal_id = ?', [
        journalId,
      ]);
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
            jo.cite_score as citeScore,
            jo.category
          FROM journal_options jo
          WHERE jo.is_placeholder = 0
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
            jo.cite_score as citeScore,
            jo.category
          FROM journal_options jo
          WHERE jo.journal_name LIKE ?
            AND jo.is_placeholder = 0
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
    const [rows] = await db.query('SELECT 1 FROM journals WHERE id = ?', [journalId]);
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
            ) AS is_author,
            (j.created_by IS NOT NULL AND j.created_by = ?) AS is_creator
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
        [userEmail, userId, userId, userId, journalId],
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
        is_creator: Boolean(row.is_creator),
        // The submitter may correct their own record even when the paper credits
        // other people; being credited is not what grants access.
        can_manage: Boolean(row.is_author) || Boolean(row.is_creator),
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
        [id],
      );

      if (!journal[0]) return null;

      // Get authors using v_authors view (pulls faculty data from master_employees).
      // country/state are not part of the view, so they come from the authors row itself —
      // without them the form reopened with a blank country and wrote that blank back.
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
          v.student_ref,
          CASE WHEN v.student_ref IS NOT NULL THEN v.erp_id END AS student_id,
          v.orcid_id,
          v.scopus_id,
          a.country,
          a.state,
          aj.id AS dbAuthorId,
          aj.is_first_author,
          aj.is_primary
        FROM v_authors v
        JOIN author_journal aj ON v.author_id = aj.author_id
        LEFT JOIN authors a ON a.id = v.author_id
        WHERE aj.journal_id = ?`,
        [id],
      );

      // Get indexes
      const [indexes] = await db.query(
        'SELECT index_name FROM journal_indexes WHERE journal_id = ?',
        [id],
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
      journalResult.external_details = safeParseJSON(journalResult.external_details, []);

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
        ],
      );

      // Return the created request
      const [request] = await db.query('SELECT * FROM journal_requests WHERE id = ?', [
        result.insertId,
      ]);

      return request[0];
    } catch (error) {
      throw new Error(`Error creating journal request: ${error.message} `);
    }
  },

  async getUserJournalRequests(userId) {
    try {
      const [requests] = await db.query(
        'SELECT * FROM journal_requests WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
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
        [id, userId],
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
        [journalId, userId, statusData.status, statusData.user_comment || null],
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
        [journalId],
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
        [adminReply, statusUpdateId],
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating admin reply: ${error.message} `);
    }
  },
};

export default journalModel;
