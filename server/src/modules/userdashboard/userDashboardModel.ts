import db from '../../config/connection.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const userDashboardModel = {
  async getDashboardStats(userId: number | string) {
    const query = `
            SELECT 
                (SELECT COUNT(*) FROM research_projects WHERE user_id = ?) as project_count,
                (SELECT COUNT(*) FROM publications WHERE user_id = ?) as publication_count,
                (SELECT COUNT(*) FROM research_collaborations WHERE user_id = ?) as collaboration_count
        `;
    // Note: 'publications' and 'research_collaborations' tables might not exist or be named differently in schema.
    // 'research_projects' doesn't have user_id.
    const [result] = await db.query<RowDataPacket[]>(query, [userId, userId, userId]);
    return result[0];
  },

  async getUserProfile(userId: number | string) {
    const query = `
            SELECT 
                u.id,
                u.employee_id,
                u.name,
                u.email,
                u.department,
                u.designation,
                u.research_area,
                u.google_scholar_id,
                u.scopus_id,
                u.researcher_id,
                u.orcid_id,
                u.profile_image
            FROM users u
            WHERE u.id = ?
        `;
    const [result] = await db.query<RowDataPacket[]>(query, [userId]);
    return result[0];
  },

  // Update your getUserProjects model function to properly extract the rows:
  // Updated model function to correctly extract the rows
  async getUserProjects(userId: number | string, page = 1, perPage = 10) {
    const offset = (page - 1) * perPage;
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [userResult] = await db.query<RowDataPacket[]>(userQuery, [userId]);
      const user = userResult[0];

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return { projects: [], total: 0 };
      }

      const query = `
            SELECT 
                rp.*,
                pd.sanction_order_amount,
                pd.project_duration_start_date,
                pd.project_duration_end_date,
                pao.name as agency_name,
                GROUP_CONCAT(
                    DISTINCT 
                    CONCAT(a.name,
                        CASE 
                            WHEN ap.is_principal THEN ' (Principal Investigator)'
                            WHEN ap.is_primary THEN ' (Co-Principal Investigator)'
                            ELSE ''
                        END
                    ) ORDER BY ap.is_principal DESC, ap.is_primary DESC SEPARATOR ', '
                ) as team_members
            FROM research_projects rp
            LEFT JOIN project_details pd ON rp.id = pd.project_id
            LEFT JOIN project_agency_options pao ON rp.agency_id = pao.id
            LEFT JOIN author_project ap ON rp.id = ap.project_id
            LEFT JOIN authors a ON ap.author_id = a.id
            WHERE EXISTS (
                SELECT 1 FROM authors a2 
                INNER JOIN author_project ap2 ON a2.id = ap2.author_id 
                WHERE ap2.project_id = rp.id AND a2.email = ?
            )
            GROUP BY rp.id, pd.sanction_order_amount, pd.project_duration_start_date, 
                     pd.project_duration_end_date, pao.name
            ORDER BY rp.date_of_submission DESC
            LIMIT ? OFFSET ?
        `;

      const countQuery = `
            SELECT COUNT(DISTINCT rp.id) as total 
            FROM research_projects rp
            INNER JOIN author_project ap ON rp.id = ap.project_id
            INNER JOIN authors a ON ap.author_id = a.id
            WHERE a.email = ?
        `;

      // Execute both queries
      const [countResult, projectsResult] = await Promise.all([
        db.query<RowDataPacket[]>(countQuery, [user.email]),
        db.query<RowDataPacket[]>(query, [user.email, perPage, offset]),
      ]);

      // Extract the actual rows from each query result
      const total = countResult[0][0].total;
      const projects = projectsResult[0]; // This gets just the rows, not the metadata

      return { projects, total };
    } catch (error) {
      console.error('Database error in getUserProjects:', error);
      throw error;
    }
  },

  async getUserJournals(userId: number | string, page = 1, perPage = 10) {
    const offset = (page - 1) * perPage;
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [userResult] = await db.query<RowDataPacket[]>(userQuery, [userId]);
      const user = userResult[0];

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return { journals: [], total: 0 };
      }

      // Modified query to ensure proper joins and data retrieval
      const query = `
                SELECT 
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    GROUP_CONCAT(
                        DISTINCT 
                        CONCAT(a.name,
                            CASE 
                                WHEN aj.is_first_author THEN ' (First Author)'
                                WHEN aj.is_primary THEN ' (Primary Author)'
                                ELSE ''
                            END
                        ) ORDER BY aj.is_first_author DESC, aj.is_primary DESC SEPARATOR ', '
                    ) as authors
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN authors a ON aj.author_id = a.id
                WHERE EXISTS (
                    SELECT 1 FROM authors a2 
                    INNER JOIN author_journal aj2 ON a2.id = aj2.author_id 
                    WHERE aj2.journal_id = j.id AND a2.email = ?
                )
                GROUP BY j.id, jo.journal_name, jo.publisher
                ORDER BY j.updated_at DESC
                LIMIT ? OFFSET ?
            `;

      const [journals] = await db.query<RowDataPacket[]>(query, [user.email, perPage, offset]);

      // Get total count
      const countQuery = `
                SELECT COUNT(DISTINCT j.id) as total 
                FROM journals j
                INNER JOIN author_journal aj ON j.id = aj.journal_id
                INNER JOIN authors a ON aj.author_id = a.id
                WHERE a.email = ?
            `;

      const [countResult] = await db.query<RowDataPacket[]>(countQuery, [user.email]);

      return {
        journals: journals,
        total: countResult[0].total || 0,
      };
    } catch (error) {
      console.error('Database error in getUserJournals:', error);
      throw error;
    }
  },

  async getProjectDetails(userId: number | string, projectId: number | string) {
    try {
      // First verify the user exists and get their email
      const userQuery = 'SELECT email FROM users WHERE id = ?';
      const [userResult] = await db.query<RowDataPacket[]>(userQuery, [userId]);
      const user = userResult[0];

      if (!user?.email) {
        console.error('No user found with ID:', userId);
        return null;
      }

      const query = `
                SELECT 
                    rp.*,
                    pd.*,
                    pao.name as agency_name,
                    pso.name as scheme_name,
                    
                    # Get investigators
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'author_id', a.author_id,
                                'name', a.name,
                                'designation', a.designation,
                                'department', a.department,
                                'organization', a.organization,
                                'country', a.country,
                                'is_principal', IF(ap.is_principal, true, false),
                                'is_primary', IF(ap.is_primary, true, false)
                            )
                        ), '[]'
                    ) FROM author_project ap 
                    JOIN authors a ON ap.author_id = a.id 
                    WHERE ap.project_id = rp.id) as investigators,

                    # Get financial contributions
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'agency_type', pato.name,
                                'agency', pfc.agency,
                                'amount', pfc.amount
                            )
                        ), '[]'
                    ) FROM project_financial_contributions pfc
                    LEFT JOIN project_agency_type_options pato ON pfc.agency_type_id = pato.id
                    WHERE pfc.project_id = rp.id) as financial_contributions,

                    # Get collaborations
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'partner', pc.partner,
                                'address', pc.address,
                                'support', pc.support
                            )
                        ), '[]'
                    ) FROM project_collaborations pc
                    WHERE pc.project_id = rp.id) as collaborations,

                    # Get documents
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'document_type', pdoc.document_type,
                                'file_path', pdoc.file_path
                            )
                        ), '[]'
                    ) FROM project_documents pdoc
                    WHERE pdoc.project_id = rp.id) as documents,

                    # Get grant disbursements
                    (SELECT COALESCE(
                        JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'fiscal_year', pgd.fiscal_year,
                                'agency', pgd.agency,
                                'amount', pgd.amount,
                                'disbursement_date', DATE_FORMAT(pgd.disbursement_date, '%Y-%m-%d'),
                                'sanction_letter_path', pgd.sanction_letter_path,
                                'uc_and_soe_path', pgd.uc_and_soe_path
                            )
                        ), '[]'
                    ) FROM project_grant_disbursements pgd
                    WHERE pgd.project_id = rp.id) as grant_disbursements

                FROM research_projects rp
                LEFT JOIN project_details pd ON rp.id = pd.project_id 
                LEFT JOIN project_agency_options pao ON rp.agency_id = pao.id
                LEFT JOIN project_scheme_options pso ON rp.scheme_id = pso.id
                WHERE rp.id = ? 
                AND EXISTS (
                    SELECT 1 FROM authors a2 
                    INNER JOIN author_project ap2 ON a2.id = ap2.author_id 
                    WHERE ap2.project_id = rp.id AND a2.email = ?
                )
                GROUP BY rp.id, pd.id, pao.name, pso.name
            `;

      const [result] = await db.query<RowDataPacket[]>(query, [projectId, user.email]);

      if (!result[0]) {
        return null;
      }

      // Format dates
      if (result[0].date_of_submission) {
        result[0].date_of_submission = new Date(result[0].date_of_submission)
          .toISOString()
          .split('T')[0];
      }
      if (result[0].project_duration_start_date) {
        result[0].project_duration_start_date = new Date(
          result[0].project_duration_start_date
        )
          .toISOString()
          .split('T')[0];
      }
      if (result[0].project_duration_end_date) {
        result[0].project_duration_end_date = new Date(
          result[0].project_duration_end_date
        )
          .toISOString()
          .split('T')[0];
      }

      // Parse JSON fields
      const jsonFields = [
        'investigators',
        'financial_contributions',
        'collaborations',
        'documents',
        'grant_disbursements',
      ];
      jsonFields.forEach((field) => {
        try {
          if (result[0][field]) {
            // MySQL's JSON_ARRAYAGG already returns a JSON string, just parse it
            result[0][field] = JSON.parse(result[0][field]);
          } else {
            result[0][field] = [];
          }
        } catch (e) {
          console.error(`Error parsing ${field}:`, e);
          result[0][field] = [];
        }
      });

      return result[0];
    } catch (error) {
      console.error('Database error in getProjectDetails:', error);
      throw error;
    }
  },

  async getJournalDetails(userId: number | string, journalId: number | string) {
    const query = `
            SELECT *
            FROM publications
            WHERE id = ? AND user_id = ?
        `;
    const [result] = await db.query<RowDataPacket[]>(query, [journalId, userId]);
    return result[0];
  },

  async deleteJournal(userId: number | string, journalId: number | string) {
      try {
          const userQuery = 'SELECT email FROM users WHERE id = ?';
          const [userResult] = await db.query<RowDataPacket[]>(userQuery, [userId]);
          if (!userResult[0]?.email) return false;

          const query = `
            DELETE j FROM journals j
            JOIN author_journal aj ON j.id = aj.journal_id
            JOIN authors a ON aj.author_id = a.id
            WHERE j.id = ? AND a.email = ?
          `;
          const [result] = await db.query<ResultSetHeader>(query, [journalId, userResult[0].email]);
          return result.affectedRows > 0;
      } catch (error) {
          console.error("Error in deleteJournal", error);
          throw error;
      }
  },
};

export default userDashboardModel;
