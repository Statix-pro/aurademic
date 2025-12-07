import db from '../../config/connection.js';
const adminModel = {
    async getAllProjects(page, perPage) {
        try {
            // Get total count
            const [countResult] = await db.query('SELECT COUNT(*) as total FROM research_projects');
            const total = countResult[0].total;
            // Calculate offset
            const offset = (page - 1) * perPage;
            // Get paginated results with related data
            const [rows] = await db.query(`
                SELECT
                    rp.*,
                    er.status as edit_request_status,
                    pao.name as agency_name,
                    pso.name as scheme_name,
                    pd.sanction_order_amount,
                    pd.project_duration_start_date,
                    pd.project_duration_end_date,
                    GROUP_CONCAT(DISTINCT CONCAT(a.name)) as team_members_names,
                    GROUP_CONCAT(DISTINCT
                        CONCAT(
                            pgd.fiscal_year, ':',
                            pgd.agency, ':',
                            pgd.amount, ':',
                            pgd.disbursement_date
                        )
                    ) as grant_disbursements_data
                FROM research_projects rp
                LEFT JOIN project_agency_options pao ON rp.agency_id = pao.id
                LEFT JOIN project_scheme_options pso ON rp.scheme_id = pso.id
                LEFT JOIN project_details pd ON rp.id = pd.project_id
                LEFT JOIN author_project ap ON rp.id = ap.project_id
                LEFT JOIN authors a ON ap.author_id = a.id
                LEFT JOIN edit_requests er ON
                    er.entity_id = rp.id AND
                    er.entity_type = 'research_projects'
                LEFT JOIN project_grant_disbursements pgd ON rp.id = pgd.project_id
                GROUP BY rp.id, rp.project_category, rp.title, pao.name, pso.name,
                         rp.duration_years, rp.duration_months, rp.duration_days,
                         rp.category, rp.is_collaboration_enabled, rp.date_of_submission,
                         rp.submission_status,
                         pd.sanction_order_amount, pd.project_duration_start_date,
                         pd.project_duration_end_date, er.status
                ORDER BY rp.id DESC
                LIMIT ? OFFSET ?
            `, [perPage, offset]);
            // Transform the results to include team_members array and grant_disbursements
            const transformedRows = rows.map((row) => ({
                ...row,
                agency: row.agency_name, // Map agency_name to agency for backwards compatibility
                scheme: row.scheme_name, // Map scheme_name to scheme for backwards compatibility
                team_members: row.team_members_names
                    ? row.team_members_names
                        .split(',')
                        .map((name) => ({ name: name.trim() }))
                    : [],
                grant_disbursements: row.grant_disbursements_data
                    ? row.grant_disbursements_data.split(',').map((gd) => {
                        const [fiscal_year, agency, amount, disbursement_date] = gd.split(':');
                        return {
                            fiscal_year,
                            agency,
                            amount: parseFloat(amount),
                            disbursement_date,
                        };
                    })
                    : [],
            }));
            return { projects: transformedRows, total };
        }
        catch (error) {
            throw new Error(`Error retrieving projects: ${error.message}`);
        }
    },
    async getProjectById(id) {
        try {
            // Updated query to include agency and scheme names
            const [projectDetails] = await db.query(`
            SELECT
                rp.*,
                pd.date_of_presentation,
                pd.date_of_result_announcement,
                pd.sanction_order_amount,
                pd.sanction_order_date,
                pd.project_duration_start_date,
                pd.project_duration_end_date,
                pd.outcome_type,
                pao.name as agency,
                pso.name as scheme,
                  er.status as edit_request_status,
                  er.created_at as edit_request_date
            FROM research_projects rp
            LEFT JOIN project_details pd ON rp.id = pd.project_id
            LEFT JOIN project_agency_options pao ON rp.agency_id = pao.id
            LEFT JOIN project_scheme_options pso ON rp.scheme_id = pso.id
            LEFT JOIN edit_requests er ON rp.id = er.entity_id AND er.entity_type = 'research_projects'
            WHERE rp.id = ?
        `, [id]);
            if (!projectDetails[0]) {
                throw new Error('Project not found');
            }
            // Get team members with their roles
            const [teamMembers] = await db.query(`
            SELECT
                a.id,
                a.name,
                ap.is_principal,
                ap.is_primary
            FROM authors a
            JOIN author_project ap ON a.id = ap.author_id
            WHERE ap.project_id = ?
            ORDER BY ap.is_principal DESC, ap.is_primary DESC, a.name
        `, [id]);
            // Get grant disbursements
            const [grantDisbursements] = await db.query(`
            SELECT
                fiscal_year,
                agency,
                amount,
                disbursement_date,
                sanction_letter_path,
                uc_and_soe_path
            FROM project_grant_disbursements
            WHERE project_id = ?
            ORDER BY disbursement_date DESC
        `, [id]);
            // Get collaborating partners
            const [partners] = await db.query(`
            SELECT
                partner,
                address,
                support
            FROM project_collaborations
            WHERE project_id = ?
        `, [id]);
            // Get project documents
            const [projectDocuments] = await db.query(`
            SELECT
                document_type,
                file_path
            FROM project_documents
            WHERE project_id = ?
        `, [id]);
            // Get financial contributions with agency type names
            const [financialContributions] = await db.query(`
            SELECT
                pfc.agency_type_id,
                pato.name as agency_type,
                pfc.agency,
                pfc.amount
            FROM project_financial_contributions pfc
            LEFT JOIN project_agency_type_options pato ON pfc.agency_type_id = pato.id
            WHERE pfc.project_id = ?
        `, [id]);
            // Combine all the data
            const result = {
                ...projectDetails[0],
                team_members: teamMembers.map((member) => ({
                    id: member.id,
                    name: member.name,
                    is_principal: member.is_principal,
                    is_primary: member.is_primary,
                })),
                principal_investigators: teamMembers
                    .filter((member) => member.is_principal)
                    .map((pi) => pi.name),
                collaborating_partners: partners.map((p) => ({
                    partner: p.partner,
                    address: p.address,
                    support: p.support,
                })),
                grant_disbursements: grantDisbursements.map((gd) => ({
                    fiscal_year: gd.fiscal_year,
                    agency: gd.agency,
                    amount: gd.amount,
                    disbursement_date: gd.disbursement_date,
                    sanction_letter_path: gd.sanction_letter_path,
                    uc_and_soe_path: gd.uc_and_soe_path,
                })),
                documents: projectDocuments.map((doc) => ({
                    document_type: doc.document_type,
                    file_path: doc.file_path,
                })),
                financial_contributions: financialContributions.map((fc) => ({
                    agency_type: fc.agency_type,
                    agency: fc.agency,
                    amount: fc.amount,
                })),
            };
            return result;
        }
        catch (error) {
            throw new Error(`Error retrieving project details: ${error.message}`);
        }
    },
    async getAllJournals(page, perPage) {
        try {
            // Get total count of journals
            const [countResult] = await db.query('SELECT COUNT(*) as total FROM journals');
            const total = countResult[0].total;
            // Calculate offset for pagination
            const offset = (page - 1) * perPage;
            // Get paginated results with related data, including journal_name from journal_options
            const [rows] = await db.query(`
                SELECT
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    jo.print_issn,
                    jo.online_issn,
                    jo.website,
                    er.status as edit_request_status,
                    GROUP_CONCAT(DISTINCT a.name ORDER BY a.id) as author_names,
                    GROUP_CONCAT(DISTINCT ji.index_name ORDER BY ji.id) as index_names
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN authors a ON aj.author_id = a.id
                LEFT JOIN edit_requests er ON
                    er.entity_id = j.id AND
                    er.entity_type = 'journals'
                LEFT JOIN journal_indexes ji ON j.id = ji.journal_id
                GROUP BY j.id, jo.journal_name, jo.publisher, jo.print_issn,
                         jo.online_issn, jo.website, j.status, er.status
                ORDER BY j.id DESC
                LIMIT ? OFFSET ?
            `, [perPage, offset]);
            return {
                journals: rows.map((row) => ({
                    ...row,
                    author_names: row.author_names ? row.author_names.split(',') : [],
                    index_names: row.index_names ? row.index_names.split(',') : [],
                })),
                total,
            };
        }
        catch (error) {
            throw new Error(`Error retrieving journals: ${error.message}`);
        }
    },
    async getJournalById(id) {
        try {
            // Get journal details along with related data
            const [rows] = await db.query(`
                SELECT
                    j.*,
                    jo.journal_name,
                    jo.publisher,
                    jo.print_issn,
                    jo.online_issn,
                    jo.website,
                    GROUP_CONCAT(DISTINCT a.name ORDER BY a.id) as author_names,
                    GROUP_CONCAT(DISTINCT ji.index_name ORDER BY ji.id) as index_names,
                    er.status as edit_request_status,
                    er.created_at as edit_request_date
                FROM journals j
                LEFT JOIN journal_options jo ON j.journal_options_id = jo.id
                LEFT JOIN author_journal aj ON j.id = aj.journal_id
                LEFT JOIN authors a ON aj.author_id = a.id
                LEFT JOIN journal_indexes ji ON j.id = ji.journal_id
                 LEFT JOIN edit_requests er ON j.id = er.entity_id AND er.entity_type = 'journals'
                WHERE j.id = ?
                GROUP BY j.id, jo.journal_name, jo.publisher, jo.print_issn,
                         jo.online_issn, jo.website, j.status, er.status, er.created_at
            `, [id]);
            if (rows.length === 0) {
                return null;
            }
            const journal = rows[0];
            return {
                ...journal,
                author_names: journal.author_names
                    ? journal.author_names.split(',')
                    : [],
                index_names: journal.index_names ? journal.index_names.split(',') : [],
            };
        }
        catch (error) {
            throw new Error(`Error retrieving journal: ${error.message}`);
        }
    },
    async getDashboardStats() {
        try {
            const [projectStats] = await db.query(`
                SELECT
                    COUNT(*) as total_projects,
                    COUNT(CASE WHEN submission_status = 'approved' THEN 1 END) as approved_projects,
                    COUNT(CASE WHEN submission_status = 'pending' THEN 1 END) as pending_projects
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
        }
        catch (error) {
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
        }
        catch (error) {
            throw new Error(`Error retrieving journal requests: ${error.message}`);
        }
    },
    async approveJournalRequest(requestId, adminComment) {
        try {
            // Get the journal request
            const [requestRows] = await db.query('SELECT * FROM journal_requests WHERE id = ?', [requestId]);
            if (requestRows.length === 0) {
                return null;
            }
            const request = requestRows[0];
            // Add to journal_options table
            const [result] = await db.query(`INSERT INTO journal_options (journal_name, publisher, website, print_issn, online_issn)
                     VALUES (?, ?, ?, ?, ?)`, [
                request.journal_name,
                request.publisher,
                request.website,
                request.print_issn,
                request.online_issn,
            ]);
            // Update the request status
            await db.query(`UPDATE journal_requests
                     SET status = 'approved', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`, [adminComment || 'Journal approved and added to options', requestId]);
            return {
                id: result.insertId,
                journal_name: request.journal_name,
                status: 'approved',
            };
        }
        catch (error) {
            throw new Error(`Error approving journal request: ${error.message}`);
        }
    },
    async rejectJournalRequest(requestId, adminComment) {
        try {
            const [result] = await db.query(`UPDATE journal_requests
                     SET status = 'rejected', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`, [adminComment || 'Journal request rejected', requestId]);
            if (result.affectedRows === 0) {
                return null;
            }
            return { id: requestId, status: 'rejected' };
        }
        catch (error) {
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
        }
        catch (error) {
            throw new Error(`Error retrieving project requests: ${error.message}`);
        }
    },
    async approveProjectRequest(requestId, adminComment) {
        try {
            // Get the project request
            const [requestRows] = await db.query('SELECT * FROM project_requests WHERE id = ?', [requestId]);
            if (requestRows.length === 0) {
                return null;
            }
            const request = requestRows[0];
            let result;
            // Add to appropriate options table based on request type
            switch (request.request_type) {
                case 'agency':
                    [result] = await db.query('INSERT INTO project_agency_options (name) VALUES (?)', [request.name]);
                    break;
                case 'scheme':
                    [result] = await db.query('INSERT INTO project_scheme_options (name) VALUES (?)', [request.name]);
                    break;
                case 'agency_type':
                    [result] = await db.query('INSERT INTO project_agency_type_options (name) VALUES (?)', [request.name]);
                    break;
                default:
                    throw new Error('Invalid request type');
            }
            // Update the request status
            await db.query(`UPDATE project_requests
                     SET status = 'approved', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`, [
                adminComment ||
                    `${request.request_type.replace('_', ' ')} approved and added to options`,
                requestId,
            ]);
            return {
                id: result.insertId,
                name: request.name,
                request_type: request.request_type,
                status: 'approved',
            };
        }
        catch (error) {
            throw new Error(`Error approving project request: ${error.message}`);
        }
    },
    async rejectProjectRequest(requestId, adminComment) {
        try {
            const [result] = await db.query(`UPDATE project_requests
                     SET status = 'rejected', admin_comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`, [adminComment || 'Project request rejected', requestId]);
            if (result.affectedRows === 0) {
                return null;
            }
            return { id: requestId, status: 'rejected' };
        }
        catch (error) {
            throw new Error(`Error rejecting project request: ${error.message}`);
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
        }
        catch (error) {
            throw new Error(`Error retrieving journal status updates: ${error.message}`);
        }
    },
    async getJournalStatusUpdates(journalId) {
        try {
            const [rows] = await db.query(`SELECT
                    jsu.*,
                    u.name as user_name,
                    u.email as user_email
                 FROM journal_status_updates jsu
                 JOIN users u ON jsu.user_id = u.id
                 WHERE jsu.journal_id = ?
                 ORDER BY jsu.created_at ASC`, [journalId]);
            return rows;
        }
        catch (error) {
            throw new Error(`Error retrieving journal status updates: ${error.message}`);
        }
    },
    async updateStatusUpdateAdminReply(statusUpdateId, adminReply) {
        try {
            const [result] = await db.query('UPDATE journal_status_updates SET admin_reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [adminReply, statusUpdateId]);
            return result;
        }
        catch (error) {
            throw new Error(`Error updating admin reply: ${error.message}`);
        }
    },
};
export default adminModel;
