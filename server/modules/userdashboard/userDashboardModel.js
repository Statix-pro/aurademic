// userDashboardModel.js
import db from '../../config/connection.js';
import { formatProjectDateRows } from '../project/projectDates.js';
import projectModel from '../project/projectModel.js';

const userDashboardModel = {
  async getDashboardStats(userId) {
    // Get user email first
    const userQuery = 'SELECT email FROM users WHERE id = ?';
    const [[user]] = await db.query(userQuery, [userId]);

    if (!user?.email) {
      return { project_count: 0, publication_count: 0, collaboration_count: 0 };
    }

    // derived from getUserProjects count logic
    // Use v_authors view to get email from master_employees for faculty
    // A project belongs to the user when they are one of its investigators or
    // when they filed it (CFRD staff record projects on behalf of faculty, and
    // those must not disappear from the recorder's dashboard).
    const projectQuery = `
        SELECT COUNT(DISTINCT rp.id) as count
        FROM research_projects rp
        LEFT JOIN project_investigators pin ON rp.id = pin.project_id
        LEFT JOIN v_authors va ON pin.author_id = va.author_id
        WHERE va.email = ? OR rp.created_by = ?
    `;

    // derived from getUserJournals count logic
    // Use v_authors view to get email from master_employees for faculty
    // Only count PUBLISHED journals for the dashboard stats
    const journalQuery = `
        SELECT COUNT(DISTINCT j.id) as count
        FROM journals j
        INNER JOIN author_journal aj ON j.id = aj.journal_id
        INNER JOIN v_authors va ON aj.author_id = va.author_id
        WHERE va.email = ? AND j.status = 'published'
    `;

    // Check if research_collaborations exists or use placeholder
    // Assuming it follows similar pattern or might be a simple table.
    // For now, returning 0 if we are unsure, but let's try a simple query if it exists.
    // If table doesn't exist, we should just return 0 to avoid crash.
    // Safe approach:

    const [projectRes, journalRes] = await Promise.all([
      db.query(projectQuery, [user.email, userId]),
      db.query(journalQuery, [user.email]),
    ]);

    return {
      project_count: projectRes[0][0].count || 0,
      publication_count: journalRes[0][0].count || 0,
      collaboration_count: 0, // Placeholder until collaboration schema is verified
    };
  },

  async getUserProfile(userId) {
    const query = `
            SELECT 
                u.id as user_id,
                u.picture as profile_image,
                v.full_name as name,
                v.erp_id as employee_id,
                v.designation,
                v.department_name as department,
                v.email,
                v.orcid_id,
                v.scopus_id,
                me.google_scholar_id,
                me.wos_researcher_id as researcher_id
            FROM users u
            LEFT JOIN master_employees me ON u.email = me.email
            LEFT JOIN v_employees v ON u.email = v.email
            WHERE u.id = ?
        `;
    const [result] = await db.query(query, [userId]);
    return result[0];
  },

  // Update your getUserProjects model function to properly extract the rows:
  // Updated model function to correctly extract the rows
  async getUserProjects(userId, page = 1, perPage = 10) {
    const offset = (page - 1) * perPage;
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [[user]] = await db.query(userQuery, [userId]);

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return { projects: [], total: 0 };
      }

      const query = `
            SELECT
                rp.*,
                org.name as agency_name,
                sch.name as scheme_name,
                sch.category as scheme_category,
                GROUP_CONCAT(
                    DISTINCT
                    CONCAT(COALESCE(NULLIF(pin.name, ''), va.author_name),
                        CASE WHEN pin.is_principal THEN ' (Principal Investigator)' ELSE '' END
                    ) ORDER BY pin.is_principal DESC, pin.display_order SEPARATOR ', '
                ) as team_members
            FROM research_projects rp
            LEFT JOIN project_organizations org ON rp.funding_organization_id = org.id
            LEFT JOIN project_schemes sch ON rp.scheme_id = sch.id
            LEFT JOIN project_investigators pin ON rp.id = pin.project_id
            LEFT JOIN v_authors va ON pin.author_id = va.author_id
            WHERE rp.created_by = ?
               OR EXISTS (
                SELECT 1 FROM v_authors va2
                INNER JOIN project_investigators pin2 ON va2.author_id = pin2.author_id
                WHERE pin2.project_id = rp.id AND va2.email = ?
            )
            GROUP BY rp.id, org.name, sch.name, sch.category
            ORDER BY COALESCE(rp.submitted_on, rp.created_at) DESC
            LIMIT ? OFFSET ?
        `;

      const countQuery = `
            SELECT COUNT(DISTINCT rp.id) as total
            FROM research_projects rp
            LEFT JOIN project_investigators pin ON rp.id = pin.project_id
            LEFT JOIN v_authors va ON pin.author_id = va.author_id
            WHERE va.email = ? OR rp.created_by = ?
        `;

      // Execute both queries
      const [countResult, projectsResult] = await Promise.all([
        db.query(countQuery, [user.email, userId]),
        db.query(query, [userId, user.email, perPage, offset]),
      ]);

      // Extract the actual rows from each query result
      const total = countResult[0][0].total;
      const projects = formatProjectDateRows(projectsResult[0]);

      return { projects, total };
    } catch (error) {
      console.error('Database error in getUserProjects:', error);
      throw error;
    }
  },

  async getUserJournals(userId, page = 1, perPage = 10, status = null, sortBy = 'updated_at') {
    const offset = (page - 1) * perPage;
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [[user]] = await db.query(userQuery, [userId]);

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return { journals: [], total: 0 };
      }

      // Build status filter condition
      const statusCondition = status ? 'AND j.status = ?' : '';
      const queryParams = status
        ? [userId, userId, user.email, status, perPage, offset]
        : [userId, userId, user.email, perPage, offset];

      // Validate and sanitize sortBy to prevent SQL injection
      const allowedSortColumns = [
        'updated_at',
        'date_of_submission',
        'available_online_date',
        'created_at',
      ];
      const orderByColumn = allowedSortColumns.includes(sortBy) ? `j.${sortBy}` : 'j.updated_at';

      // Modified query to ensure proper joins and data retrieval
      // Use v_authors to get author names (handles internal employees correctly)
      const query = `
                SELECT 
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    COALESCE(j.admin_approval_status, 'pending') as admin_approval_status,
                    j.admin_approval_comment,
                    COALESCE(uer.status, 'none') as edit_request_status,
                    CASE
                        WHEN COALESCE(j.admin_approval_status, 'pending') IN ('pending', 'rejected') THEN 1
                        WHEN COALESCE(j.admin_approval_status, 'pending') = 'approved'
                             AND COALESCE(uer.status, 'none') = 'approved' THEN 1
                        ELSE 0
                    END as can_direct_edit,
                    CASE
                        WHEN COALESCE(j.admin_approval_status, 'pending') = 'approved'
                             AND COALESCE(uer.status, 'none') IN ('none', 'rejected') THEN 1
                        ELSE 0
                    END as can_request_edit,
                    CASE
                        WHEN j.status = 'published' AND COALESCE(j.admin_approval_status, 'pending') = 'approved' THEN 0
                        ELSE 1
                    END as can_delete,
                    GROUP_CONCAT(
                        DISTINCT 
                        CONCAT(va.author_name,
                            CASE 
                                WHEN aj.is_primary THEN '*'
                                ELSE ''
                            END
                        ) ORDER BY aj.is_first_author DESC, aj.is_primary DESC SEPARATOR ', '
                    ) as authors
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN v_authors va ON aj.author_id = va.author_id
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
                WHERE EXISTS (
                    SELECT 1 FROM v_authors va2 
                    INNER JOIN author_journal aj2 ON va2.author_id = aj2.author_id 
                    WHERE aj2.journal_id = j.id AND va2.email = ?
                ) ${statusCondition}
                GROUP BY j.id, jo.journal_name, jo.publisher, j.admin_approval_status, j.admin_approval_comment, uer.status
                ORDER BY ${orderByColumn} DESC
                LIMIT ? OFFSET ?
            `;

      const [journals] = await db.query(query, queryParams);

      // Get total count with status filter
      const countParams = status ? [user.email, status] : [user.email];
      const countQuery = `
                SELECT COUNT(DISTINCT j.id) as total 
                FROM journals j
                INNER JOIN author_journal aj ON j.id = aj.journal_id
                INNER JOIN v_authors va ON aj.author_id = va.author_id
                WHERE va.email = ? ${statusCondition}
            `;

      const [[countResult]] = await db.query(countQuery, countParams);

      const normalizedJournals = journals.map((journal) => ({
        ...journal,
        admin_approval_status: journal.admin_approval_status || 'pending',
        edit_request_status: journal.edit_request_status || 'none',
        can_direct_edit: Boolean(journal.can_direct_edit),
        can_request_edit: Boolean(journal.can_request_edit),
        can_delete: Boolean(journal.can_delete),
      }));

      return {
        journals: normalizedJournals,
        total: countResult.total || 0,
      };
    } catch (error) {
      console.error('Database error in getUserJournals:', error);
      throw error;
    }
  },

  /**
   * Project detail for the dashboard popup. The project module owns the
   * aggregate shape, so this only enforces that the viewer is on the project
   * and reuses that loader — two copies of the query drifted apart before.
   */
  async getProjectDetails(userId, projectId) {
    try {
      const [[user]] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return null;
      }

      const access = await projectModel.getProjectAccess(projectId, {
        userId,
        email: user.email,
      });

      if (!access || !(access.isInvestigator || access.isOwner)) {
        return null;
      }

      return projectModel.getProjectById(projectId);
    } catch (error) {
      console.error('Database error in getProjectDetails:', error);
      throw error;
    }
  },

  async getJournalDetails(userId, journalId) {
    try {
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [[user]] = await db.query(userQuery, [userId]);

      if (!user?.email) {
        return null;
      }

      const [rows] = await db.query(
        `
          SELECT
            j.*,
            jo.journal_name,
            jo.publisher,
            jo.website,
            jo.print_issn,
            jo.online_issn,
            COALESCE(j.admin_approval_status, 'pending') as admin_approval_status,
            j.admin_approval_comment,
            COALESCE(uer.status, 'none') as edit_request_status,
            CASE
              WHEN COALESCE(j.admin_approval_status, 'pending') IN ('pending', 'rejected') THEN 1
              WHEN COALESCE(j.admin_approval_status, 'pending') = 'approved'
                   AND COALESCE(uer.status, 'none') = 'approved' THEN 1
              ELSE 0
            END as can_direct_edit,
            CASE
              WHEN COALESCE(j.admin_approval_status, 'pending') = 'approved'
                   AND COALESCE(uer.status, 'none') IN ('none', 'rejected') THEN 1
              ELSE 0
            END as can_request_edit,
            CASE
              WHEN j.status = 'published' AND COALESCE(j.admin_approval_status, 'pending') = 'approved' THEN 0
              ELSE 1
            END as can_delete,
            GROUP_CONCAT(
              DISTINCT CONCAT(
                va.author_name,
                CASE
                  WHEN aj.is_primary THEN '*'
                  ELSE ''
                END
              ) ORDER BY aj.is_first_author DESC, aj.is_primary DESC SEPARATOR ', '
            ) as authors
          FROM journals j
          LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
          LEFT JOIN author_journal aj ON j.id = aj.journal_id
          LEFT JOIN v_authors va ON aj.author_id = va.author_id
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
            AND EXISTS (
              SELECT 1
              FROM v_authors va2
              INNER JOIN author_journal aj2 ON va2.author_id = aj2.author_id
              WHERE aj2.journal_id = j.id
                AND va2.email = ?
            )
          GROUP BY j.id, jo.journal_name, jo.publisher, jo.website, jo.print_issn, jo.online_issn, j.admin_approval_status, j.admin_approval_comment, uer.status
        `,
        [userId, userId, journalId, user.email],
      );

      if (!rows[0]) {
        return null;
      }

      return {
        ...rows[0],
        admin_approval_status: rows[0].admin_approval_status || 'pending',
        edit_request_status: rows[0].edit_request_status || 'none',
        can_direct_edit: Boolean(rows[0].can_direct_edit),
        can_request_edit: Boolean(rows[0].can_request_edit),
        can_delete: Boolean(rows[0].can_delete),
      };
    } catch (error) {
      console.error('Database error in getJournalDetails:', error);
      throw error;
    }
  },

  async deleteJournal(userId, journalId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [[user]] = await connection.query(userQuery, [userId]);

      if (!user?.email) {
        await connection.rollback();
        return false;
      }

      const [journalRows] = await connection.query(
        `
          SELECT
            j.id,
            j.status,
            COALESCE(j.admin_approval_status, 'pending') AS admin_approval_status
          FROM journals j
          WHERE j.id = ?
            AND EXISTS (
              SELECT 1
              FROM v_authors va2
              INNER JOIN author_journal aj2 ON va2.author_id = aj2.author_id
              WHERE aj2.journal_id = j.id
                AND va2.email = ?
            )
          LIMIT 1
          FOR UPDATE
        `,
        [journalId, user.email],
      );

      if (!journalRows.length) {
        await connection.rollback();
        return false;
      }

      const journal = journalRows[0];

      if (journal.status === 'published' && journal.admin_approval_status === 'approved') {
        const lockedError = new Error(
          'Delete is disabled once publication is approved and published.',
        );
        lockedError.statusCode = 403;
        throw lockedError;
      }

      const [deleteResult] = await connection.query('DELETE FROM journals WHERE id = ?', [
        journalId,
      ]);

      await connection.commit();
      return deleteResult.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default userDashboardModel;
