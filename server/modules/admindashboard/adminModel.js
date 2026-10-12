// adminModel.js
import db from '../../config/connection.js';
import { formatProjectDateRows } from '../project/projectDates.js';
import projectModel from '../project/projectModel.js';
import { safeStoredWebsite } from '../shared/webUrl.js';

const adminModel = {
  async getAllProjects(page, perPage) {
    try {
      const [countResult] = await db.query('SELECT COUNT(*) as total FROM research_projects');
      const total = countResult[0].total;

      const offset = (page - 1) * perPage;

      const [rows] = await db.query(
        `
                SELECT
                    rp.*,
                    (SELECT er.status
                       FROM edit_requests er
                      WHERE er.entity_id = rp.id
                        AND er.entity_type = 'research_projects'
                      ORDER BY er.created_at DESC
                      LIMIT 1) as edit_request_status,
                    (SELECT er.user_id
                       FROM edit_requests er
                      WHERE er.entity_id = rp.id
                        AND er.entity_type = 'research_projects'
                      ORDER BY er.created_at DESC
                      LIMIT 1) as edit_request_user_id,
                    org.name as agency_name,
                    sch.name as scheme_name,
                    sch.category as scheme_category,
                    (SELECT SUM(pgd.amount)
                       FROM project_grant_disbursements pgd
                      WHERE pgd.project_id = rp.id) as disbursed_amount,
                    GROUP_CONCAT(DISTINCT
                        CONCAT(
                            COALESCE(NULLIF(pin.name, ''), va.author_name),
                            CASE WHEN va.erp_id IS NOT NULL
                                 THEN CONCAT(' [', va.erp_id, ']')
                                 ELSE ''
                            END
                        )
                        ORDER BY pin.is_principal DESC, pin.display_order
                    ) as team_members_names
                FROM research_projects rp
                LEFT JOIN project_organizations org ON rp.funding_organization_id = org.id
                LEFT JOIN project_schemes sch ON rp.scheme_id = sch.id
                LEFT JOIN project_investigators pin ON rp.id = pin.project_id
                LEFT JOIN v_authors va ON pin.author_id = va.author_id
                GROUP BY rp.id, org.name, sch.name, sch.category
                ORDER BY rp.id DESC
                LIMIT ? OFFSET ?
            `,
        [perPage, offset],
      );

      const transformedRows = formatProjectDateRows(rows).map((row) => ({
        ...row,
        agency: row.agency_name,
        scheme: row.scheme_name,
        team_members: row.team_members_names
          ? row.team_members_names.split(',').map((name) => ({ name: name.trim() }))
          : [],
      }));

      return { projects: transformedRows, total };
    } catch (error) {
      throw new Error(`Error retrieving projects: ${error.message}`);
    }
  },

  /**
   * Admin view of one project. The aggregate itself is loaded by the project
   * module so the admin screen and the form never disagree about its shape;
   * only the admin-only edit-request status is added here.
   */
  async getProjectById(id) {
    const project = await projectModel.getProjectById(id);

    // The controller turns a null into a 404; throwing here would report a
    // deleted or unknown id as a server fault instead.
    if (!project) {
      return null;
    }

    const [[editRequest]] = await db.query(
      `SELECT status, created_at
         FROM edit_requests
        WHERE entity_id = ? AND entity_type = 'research_projects'
        ORDER BY created_at DESC
        LIMIT 1`,
      [id],
    );

    return {
      ...project,
      agency: project.funding_organization_name,
      scheme: project.scheme_name,
      team_members: project.investigators,
      principal_investigators: project.investigators
        .filter((investigator) => investigator.is_principal)
        .map((investigator) => investigator.name),
      edit_request_status: editRequest?.status ?? null,
      edit_request_date: editRequest?.created_at ?? null,
    };
  },

  async getAllJournals(page, perPage) {
    try {
      // Get total count of journals
      const [countResult] = await db.query('SELECT COUNT(*) as total FROM journals');
      const total = countResult[0].total;

      // Calculate offset for pagination
      const offset = (page - 1) * perPage;

      // Get paginated results with related data, including journal_name from journal_options
      const [rows] = await db.query(
        `
                SELECT 
                    j.*,
                    COALESCE(j.admin_approval_status, 'pending') as admin_approval_status,
                    jo.journal_name,
                    jo.publisher,
                    jo.print_issn,
                    jo.online_issn,
                    jo.website,
                    COALESCE(er.status, 'none') as edit_request_status,
                    er.created_at as edit_request_date,
                    er.user_id as edit_request_user_id,
                    GROUP_CONCAT(DISTINCT 
                        CONCAT(
                            va.author_name,
                            CASE WHEN aj.is_first_author THEN '*' ELSE '' END,
                            CASE WHEN va.erp_id IS NOT NULL 
                                 THEN CONCAT(' [', va.erp_id, ']') 
                                 ELSE '' 
                            END
                        ) ORDER BY aj.is_first_author DESC, va.author_id
                    ) as author_names,
                    GROUP_CONCAT(DISTINCT ji.index_name ORDER BY ji.id) as index_names
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN v_authors va ON aj.author_id = va.author_id
                LEFT JOIN (
                    SELECT er1.entity_id, er1.user_id, er1.status, er1.created_at
                    FROM edit_requests er1
                    INNER JOIN (
                        SELECT entity_id, MAX(id) AS latest_id
                        FROM edit_requests
                        WHERE entity_type = 'journals'
                        GROUP BY entity_id
                    ) latest_er ON latest_er.latest_id = er1.id
                    WHERE er1.entity_type = 'journals'
                ) er ON er.entity_id = j.id
                LEFT JOIN journal_indexes ji ON j.id = ji.journal_id
                GROUP BY j.id, jo.journal_name, jo.publisher, jo.print_issn, 
                         jo.online_issn, jo.website, j.status, er.status, er.created_at, er.user_id
                ORDER BY j.id DESC
                LIMIT ? OFFSET ?
            `,
        [perPage, offset],
      );

      return {
        journals: rows.map((row) => ({
          ...row,
          author_names: row.author_names ? row.author_names.split(',') : [],
          index_names: row.index_names ? row.index_names.split(',') : [],
        })),
        total,
      };
    } catch (error) {
      throw new Error(`Error retrieving journals: ${error.message}`);
    }
  },

  async getJournalById(id) {
    try {
      // Get journal details along with related data
      const [rows] = await db.query(
        `
                SELECT 
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    jo.print_issn,
                    jo.online_issn,
                    jo.website,
                    GROUP_CONCAT(DISTINCT 
                        CONCAT(
                            va.author_name,
                            CASE WHEN aj.is_first_author THEN '*' ELSE '' END,
                            CASE WHEN va.erp_id IS NOT NULL 
                                 THEN CONCAT(' [', va.erp_id, ']') 
                                 ELSE '' 
                            END
                        ) ORDER BY aj.is_first_author DESC, va.author_id
                    ) as author_names,
                    GROUP_CONCAT(DISTINCT ji.index_name ORDER BY ji.id) as index_names,
                    er.status as edit_request_status,
                    er.created_at as edit_request_date
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN v_authors va ON aj.author_id = va.author_id
                LEFT JOIN journal_indexes ji ON j.id = ji.journal_id
                LEFT JOIN (
                    SELECT er1.entity_id, er1.status, er1.created_at
                    FROM edit_requests er1
                    INNER JOIN (
                        SELECT entity_id, MAX(id) AS latest_id
                        FROM edit_requests
                        WHERE entity_type = 'journals'
                        GROUP BY entity_id
                    ) latest_er ON latest_er.latest_id = er1.id
                    WHERE er1.entity_type = 'journals'
                ) er ON j.id = er.entity_id
                WHERE j.id = ?
                GROUP BY j.id, jo.journal_name, jo.publisher, jo.print_issn, 
                         jo.online_issn, jo.website, j.status, er.status, er.created_at
            `,
        [id],
      );

      if (rows.length === 0) {
        return null;
      }

      const journal = rows[0];
      return {
        ...journal,
        author_names: journal.author_names ? journal.author_names.split(',') : [],
        index_names: journal.index_names ? journal.index_names.split(',') : [],
      };
    } catch (error) {
      throw new Error(`Error retrieving journal: ${error.message}`);
    }
  },

  async getDashboardStats() {
    try {
      const [projectStats] = await db.query(`
                SELECT
                    COUNT(*) as total_projects,
                    COUNT(CASE WHEN final_result = 'selected' THEN 1 END) as approved_projects,
                    COUNT(CASE WHEN proposal_status <> 'result_announced' THEN 1 END) as pending_projects
                FROM research_projects
            `);

      const [journalStats] = await db.query(`
                SELECT
                    COUNT(*) as total_journals,
                    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_journals
                FROM journals
            `);

      return {
        projects: projectStats[0],
        journals: journalStats[0],
      };
    } catch (error) {
      throw new Error(`Error retrieving dashboard stats: ${error.message}`);
    }
  },

  // Journal Request Management methods
  async getAllJournalRequests() {
    try {
      const [rows] = await db.query(`
                    SELECT 
                        jr.*,
                        u.name as user_name,
                        u.email as user_email
                    FROM journal_requests jr
                    JOIN users u ON jr.user_id = u.id
                    ORDER BY jr.created_at DESC
                `);
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving journal requests: ${error.message}`);
    }
  },

  async approveJournalRequest(requestId, adminComment) {
    try {
      // Get the journal request
      const [requestRows] = await db.query('SELECT * FROM journal_requests WHERE id = ?', [
        requestId,
      ]);

      if (requestRows.length === 0) {
        return null;
      }

      const request = requestRows[0];

      // Reuse an entry that already carries this journal name rather than adding a second
      // one: duplicates make the publication form's journal picker ambiguous, and each copy
      // can hold a different National/International value.
      const [existingOptions] = await db.query(
        'SELECT id FROM journal_options WHERE journal_name = ? ORDER BY id LIMIT 1',
        [request.journal_name],
      );

      let journalOptionId;

      if (existingOptions.length > 0) {
        journalOptionId = existingOptions[0].id;

        // Fill registry gaps from the request, but never blank a value an admin already
        // curated: journal_requests defaults these columns to '' when the requester left
        // them out, and this row is shared by every publication citing the journal, so an
        // empty string means "not supplied", not "clear it". Same rule as
        // journalModel.create's fillIfProvided.
        const registryUpdate = {};
        for (const field of ['publisher', 'website', 'print_issn', 'online_issn']) {
          const value = request[field];
          if (typeof value === 'string' && value.trim() !== '') {
            registryUpdate[field] = value.trim();
          } else if (value != null && typeof value !== 'string') {
            registryUpdate[field] = value;
          }
        }
        if (request.impact_factor != null && request.impact_factor !== '') {
          registryUpdate.impact_factor = request.impact_factor;
        }
        if (request.cite_score != null && request.cite_score !== '') {
          registryUpdate.cite_score = request.cite_score;
        }
        // The level is a decision the approval itself carries, so it is always written.
        registryUpdate.category = request.category || 'National';

        await db.query('UPDATE journal_options SET ? WHERE id = ?', [
          registryUpdate,
          journalOptionId,
        ]);
      } else {
        // `category` must be carried over: leaving it out meant every approved request
        // landed on the column default and an International journal came back as National.
        const [result] = await db.query(
          `INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn, impact_factor, cite_score, category)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            request.journal_name,
            request.publisher,
            request.website,
            request.print_issn,
            request.online_issn,
            request.impact_factor || null,
            request.cite_score || null,
            request.category || 'National',
          ],
        );
        journalOptionId = result.insertId;
      }

      // Update the request status
      await db.query(
        `UPDATE journal_requests 
                     SET status = 'approved', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
        [adminComment || 'Journal approved and added to options', requestId],
      );

      return {
        id: journalOptionId,
        journal_name: request.journal_name,
        category: request.category || 'National',
        status: 'approved',
      };
    } catch (error) {
      throw new Error(`Error approving journal request: ${error.message}`);
    }
  },

  /**
   * Who asked for this journal, and what they called it.
   *
   * The approve/reject methods return the created master-data row rather than
   * the request, so this exists to address the notification back to the
   * requester without changing those return shapes — other callers depend on
   * them.
   */
  async getJournalRequestOwner(requestId) {
    const [rows] = await db.query(
      `SELECT id, user_id, journal_name FROM journal_requests WHERE id = ? LIMIT 1`,
      [requestId],
    );
    return rows[0] || null;
  },

  /** The project-option equivalent of getJournalRequestOwner. */
  async getProjectRequestOwner(requestId) {
    const [rows] = await db.query(
      `SELECT id, user_id, name, request_type FROM project_requests WHERE id = ? LIMIT 1`,
      [requestId],
    );
    return rows[0] || null;
  },

  async rejectJournalRequest(requestId, adminComment) {
    try {
      const [result] = await db.query(
        `UPDATE journal_requests 
                     SET status = 'rejected', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
        [adminComment || 'Journal request rejected', requestId],
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return { id: requestId, status: 'rejected' };
    } catch (error) {
      throw new Error(`Error rejecting journal request: ${error.message}`);
    }
  },

  // Project Request Management methods
  async getAllProjectRequests() {
    try {
      const [rows] = await db.query(`
                SELECT 
                    pr.*,
                    u.name as user_name,
                    u.email as user_email
                FROM project_requests pr
                JOIN users u ON pr.user_id = u.id
                ORDER BY pr.created_at DESC
            `);
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving project requests: ${error.message}`);
    }
  },

  /**
   * Approving a request copies it into the master table the form reads. Both
   * writes share a transaction so a request is never marked approved without
   * the master row existing.
   */
  async approveProjectRequest(requestId, adminComment, adminUserId = null) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [[request]] = await connection.query(
        "SELECT * FROM project_requests WHERE id = ? AND status = 'pending'",
        [requestId],
      );

      if (!request) {
        await connection.rollback();
        return null;
      }

      let createdId;

      if (request.request_type === 'organization') {
        const [result] = await connection.query(
          `INSERT INTO project_organizations (name, category, website)
           VALUES (?, ?, ?)`,
          // Requests created before the website check are copied defensively:
          // anything that is not an http(s) address is dropped, not stored.
          [request.name, request.category, safeStoredWebsite(request.website)],
        );
        createdId = result.insertId;
      } else if (request.request_type === 'scheme') {
        let organizationId = request.organization_id;

        // A requester may name an agency that is not in the master yet; create
        // it alongside the scheme so the approval does not need a second pass.
        if (!organizationId) {
          if (!request.organization_name) {
            throw new Error('The scheme request does not name a funding agency');
          }

          const [[existing]] = await connection.query(
            'SELECT id FROM project_organizations WHERE name = ? LIMIT 1',
            [request.organization_name],
          );

          if (existing) {
            organizationId = existing.id;
          } else {
            const [created] = await connection.query(
              'INSERT INTO project_organizations (name) VALUES (?)',
              [request.organization_name],
            );
            organizationId = created.insertId;
          }
        }

        const [result] = await connection.query(
          `INSERT INTO project_schemes (organization_id, name, domain, category, website)
           VALUES (?, ?, ?, ?, ?)`,
          [
            organizationId,
            request.name,
            request.domain,
            request.category,
            safeStoredWebsite(request.website),
          ],
        );
        createdId = result.insertId;
      } else {
        throw new Error('Invalid request type');
      }

      await connection.query(
        `UPDATE project_requests
            SET status = 'approved',
                admin_comment = ?,
                approved_record_id = ?,
                reviewed_by = ?,
                reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [
          adminComment || `${request.request_type} approved and added to the master list`,
          createdId,
          adminUserId,
          requestId,
        ],
      );

      await connection.commit();

      return {
        id: createdId,
        name: request.name,
        request_type: request.request_type,
        status: 'approved',
      };
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error approving project request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async rejectProjectRequest(requestId, adminComment) {
    try {
      const [result] = await db.query(
        `UPDATE project_requests 
                     SET status = 'rejected', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
        [adminComment || 'Project request rejected', requestId],
      );

      if (result.affectedRows === 0) {
        return null;
      }

      return { id: requestId, status: 'rejected' };
    } catch (error) {
      throw new Error(`Error rejecting project request: ${error.message}`);
    }
  },

  async updateJournalSubmissionApproval(journalId, status, adminComment, adminUserId) {
    try {
      const commentValue = adminComment?.trim() || null;

      let updateQuery = '';
      let params = [];

      if (status === 'approved') {
        updateQuery = `
          UPDATE journals
          SET
            admin_approval_status = 'approved',
            admin_approval_comment = ?,
            admin_approved_by = ?,
            admin_approved_at = CURRENT_TIMESTAMP,
            admin_rejected_by = NULL,
            admin_rejected_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        params = [commentValue, adminUserId, journalId];
      } else {
        updateQuery = `
          UPDATE journals
          SET
            admin_approval_status = 'rejected',
            admin_approval_comment = ?,
            admin_rejected_by = ?,
            admin_rejected_at = CURRENT_TIMESTAMP,
            admin_approved_by = NULL,
            admin_approved_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        params = [commentValue, adminUserId, journalId];
      }

      const [updateResult] = await db.query(updateQuery, params);

      if (updateResult.affectedRows === 0) {
        return null;
      }

      const [rows] = await db.query(
        `
          SELECT
            id,
            title,
            status,
            created_by,
            admin_approval_status,
            admin_approval_comment,
            admin_approved_by,
            admin_approved_at,
            admin_rejected_by,
            admin_rejected_at
          FROM journals
          WHERE id = ?
        `,
        [journalId],
      );

      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating journal submission approval: ${error.message}`);
    }
  },

  // Journal Status Update Management methods
  async getAllJournalStatusUpdates(page, perPage, statusFilter) {
    try {
      // Get total count
      let countQuery = `
                SELECT COUNT(*) as total 
                FROM journal_status_updates jsu
                JOIN journals j ON jsu.journal_id = j.id
                JOIN users u ON jsu.user_id = u.id
            `;
      let countParams = [];

      if (statusFilter) {
        countQuery += ' WHERE jsu.status = ?';
        countParams.push(statusFilter);
      }

      const [countResult] = await db.query(countQuery, countParams);
      const total = countResult[0].total;

      // Calculate offset
      const offset = (page - 1) * perPage;

      // Get paginated results
      let query = `
                SELECT 
                    jsu.*,
                    j.title as journal_title,
                    j.status as journal_status,
                    u.name as user_name,
                    u.email as user_email,
                    jo.journal_name
                FROM journal_status_updates jsu
                JOIN journals j ON jsu.journal_id = j.id
                JOIN users u ON jsu.user_id = u.id
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
            `;
      let params = [];

      if (statusFilter) {
        query += ' WHERE jsu.status = ?';
        params.push(statusFilter);
      }

      query += ' ORDER BY jsu.created_at DESC LIMIT ? OFFSET ?';
      params.push(perPage, offset);

      const [rows] = await db.query(query, params);

      return { statusUpdates: rows, total };
    } catch (error) {
      throw new Error(`Error retrieving journal status updates: ${error.message}`);
    }
  },

  async getJournalStatusUpdates(journalId) {
    try {
      const [rows] = await db.query(
        `SELECT 
                    jsu.*,
                    u.name as user_name,
                    u.email as user_email
                 FROM journal_status_updates jsu
                 JOIN users u ON jsu.user_id = u.id
                 WHERE jsu.journal_id = ? 
                 ORDER BY jsu.created_at ASC`,
        [journalId],
      );
      return rows;
    } catch (error) {
      throw new Error(`Error retrieving journal status updates: ${error.message}`);
    }
  },

  async updateStatusUpdateAdminReply(statusUpdateId, adminReply) {
    try {
      const [result] = await db.query(
        'UPDATE journal_status_updates SET admin_reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [adminReply, statusUpdateId],
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating admin reply: ${error.message}`);
    }
  },

  async getAllBudgets(page, perPage, filters = {}) {
    const offset = (page - 1) * perPage;
    const { fiscalYear, status, beneficiaryType } = filters;

    const whereParts = [`LOWER(TRIM(bp.status)) <> 'deleted'`];
    const params = [];

    if (fiscalYear) {
      whereParts.push('bp.fiscal_year = ?');
      params.push(fiscalYear);
    }

    if (status) {
      whereParts.push('bp.status = ?');
      params.push(status);
    }

    if (beneficiaryType) {
      whereParts.push('bp.beneficiary_type = ?');
      params.push(beneficiaryType);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const [rows] = await db.query(
      `
    SELECT 
      bp.*,
      md.name as department,
      md.code as department_code,
      me.name as org_unit_name,
      met.name as org_unit_type,
      met.code as org_unit_type_code,
      COUNT(DISTINCT bpl.id) as line_count,
      COALESCE(SUM(bpl.line_total), bp.total_amount) as total_amount
    FROM budget_proposals bp
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
    LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
    ${whereClause}
    GROUP BY bp.id, md.name, md.code, me.name, met.name, met.code
    ORDER BY bp.created_at DESC
    LIMIT ? OFFSET ?
  `,
      [...params, perPage, offset],
    );

    const [count] = await db.query(
      `
    SELECT COUNT(DISTINCT bp.id) as total 
    FROM budget_proposals bp
    ${whereClause}
  `,
      params,
    );

    return { budgets: rows, total: count[0].total };
  },

  async getBudgetStats(fiscalYear = null) {
    const fyClause = fiscalYear ? ' AND fiscal_year = ?' : '';
    const params = fiscalYear ? [fiscalYear] : [];

    const [approved] = await db.query(
      `
      SELECT COUNT(*) as approved 
      FROM budget_proposals 
      WHERE LOWER(TRIM(status)) <> 'deleted'
        AND status IN ('principal_approved', 'completed')${fyClause}
    `,
      params,
    );

    const [pending] = await db.query(
      `
      SELECT COUNT(*) as pending 
      FROM budget_proposals 
      WHERE LOWER(TRIM(status)) <> 'deleted'
        AND status IN ('submitted', 'hod_approved', 'dof_approved')${fyClause}
    `,
      params,
    );

    const [rejected] = await db.query(
      `
      SELECT COUNT(*) as rejected 
      FROM budget_proposals 
      WHERE LOWER(TRIM(status)) <> 'deleted'
        AND status IN ('hod_rejected', 'dof_rejected', 'principal_rejected')${fyClause}
    `,
      params,
    );

    return {
      approved: approved[0].approved,
      pending: pending[0].pending,
      rejected: rejected[0].rejected,
    };
  },
};

export default adminModel;
