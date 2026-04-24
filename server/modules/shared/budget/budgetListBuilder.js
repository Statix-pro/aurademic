/**
 * Shared Budget List Builder
 *
 * Centralizes the complex SQL building logic for listBudgets
 * used by both BudgetModel and AdminBudgetModel.
 */

import db from '../../../config/connection.js';
import { normalizeText, normalizeBudgetRole, getCurrentFinancialYear, isEntityBeneficiaryType, normalizeBeneficiaryType } from './budgetUtils.js';

/**
 * Builds and executes the budget list query.
 *
 * @param {object} options - Query options
 * @returns {Promise<object>} Enrichment-ready rows and pagination
 */
export async function buildBudgetList(options) {
    const {
        userId,
        userEmail,
        department,
        departmentId,
        role,
        superAdminQueueView = false,
        page = 1,
        limit = 10,
        status,
        fiscalYear,
        q,
        departmentFilter,
        beneficiaryType,
        isAdminView = false, // Set to true for admin-specific fields/logic
        hasColumnCache = { applicant_name: true, budget_tag: true }
    } = options;

    const pPage = Number.parseInt(page, 10) || 1;
    const pLimit = Number.parseInt(limit, 10) || 10;
    const pOffset = (pPage - 1) * pLimit;
    const currentFY = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
    const requestedStatus = normalizeText(status).toLowerCase();
    const safeUserId = Number(userId) > 0 ? Number(userId) : -1;
    const safeRole = normalizeBudgetRole(role);
    const normalizedUserEmail = normalizeText(userEmail).toLowerCase();

    const applicantNameColumnExpr = hasColumnCache.applicant_name
        ? "NULLIF(TRIM(MAX(bp.applicant_name)), ''),"
        : '';
    const budgetTagColumnExpr = hasColumnCache.budget_tag
        ? 'MAX(bp.budget_tag) AS budget_tag,'
        : 'NULL AS budget_tag,';
    const budgetWindowTypeColumnExpr = hasColumnCache.budget_window_type
        ? "COALESCE(NULLIF(TRIM(MAX(bp.budget_window_type)), ''), 'additional') AS budget_window_type,"
        : "'additional' AS budget_window_type,";

    // Admin-specific field: has_approved_override
    const adminFields = isAdminView
        ? `, MAX(
        CASE
          WHEN COALESCE(bpl.approved_unit_amount, bpl.unit_amount, 0) <> COALESCE(bpl.unit_amount, 0)
            OR COALESCE(bpl.approved_line_total, bpl.line_total, 0) <> COALESCE(bpl.line_total, 0)
          THEN 1 ELSE 0
        END
      ) AS has_approved_override`
        : '';

    let sql = `
    SELECT SQL_CALC_FOUND_ROWS
      bp.id,
      bp.proposal_ref,
      bp.fiscal_year,
      bp.employee_id,
      bp.user_id,
      MAX(bp.user_email) AS user_email,
      COALESCE(
        ${applicantNameColumnExpr}
        NULLIF(TRIM(MAX(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, '')))), ''),
        NULLIF(TRIM(MAX(applicant_user.name)), ''),
        NULLIF(TRIM(MAX(bp.user_email)), '')
      ) AS applicant_name,
      ${budgetTagColumnExpr}
      ${budgetWindowTypeColumnExpr}
      MAX(CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, ''))) AS faculty_name,
      MAX(applicant_user.name) AS user_name,
      DATE_FORMAT(bp.request_date, '%Y-%m-%d') AS request_date,
      bp.beneficiary_type,
      CASE
        WHEN LOWER(TRIM(bp.beneficiary_type)) = 'department'
          THEN COALESCE(NULLIF(TRIM(md.name), ''), bp.beneficiary_value)
        ELSE bp.beneficiary_value
      END AS beneficiary_value,
      bp.department_id,
      md.name AS department,
      md.code AS department_code,
      bp.beneficiary_entity_id,
      me.name AS org_unit_name,
      me.code AS org_unit_code,
      met.name AS org_unit_type,
      met.code AS org_unit_type_code,
      bp.proposal_description,
      bp.total_amount,
      bp.approved_total_amount,
      bp.status,
      bp.current_stage,
      bp.approval_flow,
      MAX(bp.created_at) AS created_at,
      MAX(bp.updated_at) AS updated_at,
      DATE_FORMAT(MAX(bp.created_at), '%Y-%m-%d %H:%i') AS created_date,
      DATE_FORMAT(MAX(bp.updated_at), '%Y-%m-%d %H:%i') AS updated_date,
      COUNT(DISTINCT bpl.id) AS line_count,
      COUNT(DISTINCT bpa.id) AS approval_count
      ${adminFields}
    FROM budget_proposals bp
    LEFT JOIN master_departments md ON bp.department_id = md.id
    LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
    LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
    LEFT JOIN master_employees applicant_emp ON bp.user_id = applicant_emp.user_id AND applicant_emp.status = 'Active'
    LEFT JOIN users applicant_user ON bp.user_id = applicant_user.id
    LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
    LEFT JOIN budget_proposal_approvals bpa ON bp.id = bpa.budget_proposal_id
    LEFT JOIN master_entity_contacts mec ON me.id = mec.entity_id
  `;

    const where = ['bp.fiscal_year = ?', "LOWER(TRIM(bp.status)) <> 'deleted'"];
    const params = [Number(currentFY)];
    const isQueueSuperAdminView = Boolean(superAdminQueueView) && ['hod', 'coordinator', 'ithead', 'dof', 'principal'].includes(safeRole);

    // Admin Archived Predicates
    const archivedStatusPredicate = `LOWER(TRIM(bp.status)) IN ('archived', 'archive')`;
    const archivedByLevel1Predicate = `(
    ${archivedStatusPredicate}
    AND EXISTS (
      SELECT 1 FROM budget_proposal_approvals bpa_archive
      WHERE bpa_archive.budget_proposal_id = bp.id
        AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive')
        AND LOWER(TRIM(bpa_archive.role)) IN ('level1', 'hod', 'coordinator')
    )
  )`;
    const archivedByDofPredicate = `(
    ${archivedStatusPredicate}
    AND EXISTS (
      SELECT 1 FROM budget_proposal_approvals bpa_archive
      WHERE bpa_archive.budget_proposal_id = bp.id
        AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive')
        AND LOWER(TRIM(bpa_archive.role)) = 'dof'
    )
  )`;
    const archivedByPrincipalPredicate = `(
    ${archivedStatusPredicate}
    AND EXISTS (
      SELECT 1 FROM budget_proposal_approvals bpa_archive
      WHERE bpa_archive.budget_proposal_id = bp.id
        AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive')
        AND LOWER(TRIM(bpa_archive.role)) = 'principal'
    )
  )`;
    const archivedByItheadPredicate = `(
    ${archivedStatusPredicate}
    AND EXISTS (
      SELECT 1 FROM budget_proposal_approvals bpa_archive
      WHERE bpa_archive.budget_proposal_id = bp.id
        AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive')
        AND LOWER(TRIM(bpa_archive.role)) = 'ithead'
    )
  )`;
    const level1ProgressionPredicate = `(bp.current_stage = "level1" OR (bp.status LIKE "level1_%" AND bp.status != "completed"))`;
    const level1ApprovedHistoryPredicate = `EXISTS (
      SELECT 1
      FROM budget_proposal_approvals bpa_level1
      WHERE bpa_level1.budget_proposal_id = bp.id
        AND LOWER(TRIM(bpa_level1.decision)) = 'approved'
        AND LOWER(TRIM(bpa_level1.role)) IN ('level1', 'hod', 'coordinator')
    )`;
    const includeLevel1ApprovedHistoryInList =
        requestedStatus === 'approved' || requestedStatus === '' || requestedStatus === 'all' || requestedStatus === 'total';

    switch (safeRole) {
        case 'hod': {
            where.push(`(
                (LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NULL)
                OR LOWER(TRIM(bp.beneficiary_type)) = 'department'
            )`);
            if (!isQueueSuperAdminView) {
                where.push('md.type = "Academic"');
                const actionQueueExpr = isAdminView
                    ? `(${level1ProgressionPredicate}${includeLevel1ApprovedHistoryInList ? ` OR ${level1ApprovedHistoryPredicate}` : ''} OR ${archivedStatusPredicate})`
                    : `(${level1ProgressionPredicate}${includeLevel1ApprovedHistoryInList ? ` OR ${level1ApprovedHistoryPredicate}` : ''})`;
                where.push(actionQueueExpr);

                const normalizedDepartment = normalizeText(department);
                const hodScope = [];
                if (safeUserId > 0) {
                    hodScope.push(`bp.department_id IN (
                        SELECT entity_id
                        FROM user_entity_roles
                        WHERE user_id = ?
                          AND entity_type = 'DEPARTMENT'
                    )`);
                    params.push(safeUserId);
                }
                if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
                    hodScope.push('bp.department_id = ?');
                    params.push(Number(departmentId));
                }
                if (normalizedDepartment) {
                    hodScope.push(`(LOWER(TRIM(md.name)) = LOWER(TRIM(?)) OR LOWER(TRIM(md.code)) = LOWER(TRIM(?)) OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(?)))`);
                    params.push(normalizedDepartment, normalizedDepartment, normalizedDepartment);
                }
                where.push(hodScope.length ? `(${hodScope.join(' OR ')})` : '1 = 0');
            }
            break;
        }
        case 'coordinator': {
            where.push(`(
                LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body', 'section')
                OR (
                    LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff')
                    AND bp.beneficiary_entity_id IS NOT NULL
                )
            )`);
            if (!isQueueSuperAdminView) {
                const actionQueueExpr = isAdminView
                    ? `(${level1ProgressionPredicate}${includeLevel1ApprovedHistoryInList ? ` OR ${level1ApprovedHistoryPredicate}` : ''} OR ${archivedStatusPredicate})`
                    : `(${level1ProgressionPredicate}${includeLevel1ApprovedHistoryInList ? ` OR ${level1ApprovedHistoryPredicate}` : ''})`;
                where.push(actionQueueExpr);

                const filterConditions = [];
                if (safeUserId > 0) {
                    filterConditions.push(`me.id IN (SELECT entity_id FROM user_entity_roles WHERE user_id = ? AND entity_type IN ('CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'))`);
                    params.push(safeUserId);
                }
                if (userEmail) {
                    filterConditions.push('LOWER(TRIM(mec.email)) = LOWER(TRIM(?))');
                    params.push(userEmail);
                }
                where.push(filterConditions.length ? `(${filterConditions.join(' OR ')})` : '1 = 0');
            }
            break;
        }
        case 'dof':
            where.push(isAdminView
                ? `(bp.current_stage = "dof" OR bp.status LIKE "dof_%" OR bp.status = "completed" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "dof" OR bp.status LIKE "dof_%" OR bp.status LIKE "principal_%" OR bp.status = "completed")`
            );
            break;
        case 'ithead':
            where.push('LOWER(TRIM(bp.budget_tag)) = LOWER(TRIM(?))');
            params.push('IT Infrastructure');
            where.push(isAdminView
                ? `(bp.current_stage = "ithead" OR bp.status LIKE "ithead_%" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "ithead" OR bp.status LIKE "ithead_%")`
            );
            break;
        case 'principal':
            where.push(isAdminView
                ? `(bp.current_stage = "principal" OR bp.status LIKE "principal_%" OR bp.status = "completed" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "principal" OR bp.status LIKE "principal_%" OR bp.status = "completed")`
            );
            break;
        case 'admin':
        case 'super_admin':
            break;
        case 'user':
        default: {
            if (!isAdminView) {
                where.push(`(
          bp.user_id = ?
          OR bp.user_email = ?
          OR bp.employee_id IN (SELECT id FROM master_employees WHERE user_id = ? AND status = "Active")
          OR (
            LOWER(TRIM(bp.beneficiary_type)) = 'faculty'
            AND EXISTS (
              SELECT 1 FROM master_employees be WHERE be.user_id = ? AND be.status = 'Active'
              AND (
                LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(CONCAT(COALESCE(be.title, ''), ' ', be.first_name, ' ', COALESCE(be.last_name, ''))))
                OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(CONCAT(be.first_name, ' ', COALESCE(be.last_name, ''))))
                OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(be.email))
                OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(be.erp_id))
              )
            )
          )
        )`);
                params.push(safeUserId, normalizeText(userEmail), safeUserId, safeUserId);
            } else {
                where.push('(bp.user_id = ? OR bp.user_email = ?)');
                params.push(safeUserId, normalizeText(userEmail));
            }
            break;
        }
    }

    const normalizedStatus = normalizeText(status).toLowerCase();
    if (normalizedStatus) {
        let approvedCondition = "1=0";
        if (safeRole === 'hod' || safeRole === 'coordinator') {
            approvedCondition = "bp.status IN ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
        } else if (safeRole === 'ithead') {
            approvedCondition = "bp.status IN ('ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
        } else if (safeRole === 'dof') {
            approvedCondition = "bp.status IN ('dof_approved', 'principal_approved', 'completed')";
        } else if (safeRole === 'principal') {
            approvedCondition = "bp.status IN ('principal_approved', 'completed')";
        } else {
            approvedCondition = "bp.status IN ('principal_approved', 'completed')";
        }

        if (normalizedStatus === 'archived') {
            where.push("LOWER(TRIM(bp.status)) IN ('archived', 'archive')");
            if (!isQueueSuperAdminView && safeRole !== 'admin' && safeRole !== 'super_admin') {
                const ownerChecks = [];
                if (safeUserId > 0) {
                    ownerChecks.push(`COALESCE(bpa_archive_owner.approver_user_id, 0) = ?`);
                    params.push(safeUserId);
                }
                if (normalizedUserEmail) {
                    ownerChecks.push(`LOWER(TRIM(COALESCE(bpa_archive_owner.approver_email, ''))) = LOWER(TRIM(?))`);
                    params.push(normalizedUserEmail);
                }

                if (ownerChecks.length > 0) {
                    where.push(`EXISTS (
                        SELECT 1
                        FROM budget_proposal_approvals bpa_archive_owner
                        WHERE bpa_archive_owner.budget_proposal_id = bp.id
                          AND LOWER(TRIM(bpa_archive_owner.decision)) IN ('archive', 'archived')
                          AND (
                            ${ownerChecks.join(' OR ')}
                            OR (
                              COALESCE(bpa_archive_owner.approver_user_id, 0) = 0
                              AND LENGTH(TRIM(COALESCE(bpa_archive_owner.approver_email, ''))) = 0
                            )
                          )
                    )`);
                } else {
                    where.push('1 = 0');
                }
            }
        } else if (normalizedStatus === 'returned') {
            where.push("LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) LIKE '%returned%'");
        } else if (normalizedStatus === 'rejected') {
            where.push("LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) LIKE '%rejected%'");
        } else if (normalizedStatus === 'approved') {
            where.push(`LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) NOT LIKE '%rejected%' AND LOWER(TRIM(bp.status)) NOT LIKE '%returned%' AND ${approvedCondition}`);
        } else if (normalizedStatus === 'pending') {
            where.push(`LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) NOT LIKE '%rejected%' AND LOWER(TRIM(bp.status)) NOT LIKE '%returned%' AND NOT ${approvedCondition}`);
        } else if (normalizedStatus !== 'all' && normalizedStatus !== 'total') {
            where.push('bp.status = ?');
            params.push(normalizeText(status));
        }
    }
    if (normalizeText(departmentFilter)) {
        const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
        if (isEntityBeneficiaryType(normalizedBeneficiaryType)) {
            where.push('me.name = ?');
            params.push(normalizeText(departmentFilter));
        } else if (['Faculty', 'Staff', 'Department'].includes(normalizedBeneficiaryType)) {
            where.push('md.name = ?');
            params.push(normalizeText(departmentFilter));
        } else {
            where.push('(md.name = ? OR me.name = ?)');
            params.push(normalizeText(departmentFilter), normalizeText(departmentFilter));
        }
    }
    if (normalizeText(beneficiaryType)) {
        where.push('LOWER(TRIM(bp.beneficiary_type)) = LOWER(TRIM(?))');
        params.push(normalizeText(beneficiaryType));
    }
    if (normalizeText(q)) {
        const searchPattern = `%${normalizeText(q)}%`;
        where.push(`(
        bp.proposal_ref LIKE ?
        OR bp.beneficiary_value LIKE ?
        OR md.name LIKE ?
        OR me.name LIKE ?
        OR ${hasColumnCache.applicant_name ? "bp.applicant_name LIKE ?" : "1=0"}
        OR applicant_emp.first_name LIKE ?
        OR applicant_emp.last_name LIKE ?
        OR CONCAT(applicant_emp.first_name, ' ', COALESCE(applicant_emp.last_name, '')) LIKE ?
        OR applicant_user.name LIKE ?
    )`);
        params.push(
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern
        );
    }

    sql += ` WHERE ${where.join(' AND ')}
           GROUP BY bp.id, md.name, md.code, me.name, me.code, met.name, met.code
           ORDER BY bp.created_at DESC
           LIMIT ? OFFSET ? `;

    params.push(Number(pLimit), Number(pOffset));

    const [rows] = await db.query(sql, params);
    const [totalRows] = await db.query('SELECT FOUND_ROWS() AS total');

    return {
        rows,
        pagination: {
            total: Number(totalRows[0].total),
            page: pPage,
            limit: pLimit,
            pages: Math.ceil(Number(totalRows[0].total) / pLimit),
        },
    };
}

/**
 * Builds and executes a query to get KPI counts (Total, Pending, Approved, etc.)
 * using the same context/where-clause logic as buildBudgetList.
 *
 * @param {object} options - Query options
 * @returns {Promise<object>} Counts for various categories
 */
export async function buildBudgetKpiStats(options) {
    const {
        userId,
        userEmail,
        department,
        departmentId,
        role,
        superAdminQueueView = false,
        fiscalYear,
        q,
        departmentFilter,
        beneficiaryType,
        isAdminView = false
    } = options;

    const currentFY = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
    const safeUserId = Number(userId) > 0 ? Number(userId) : -1;
    const safeRole = normalizeBudgetRole(role);
    const normalizedUserEmail = normalizeText(userEmail).toLowerCase();

    const where = ['bp.fiscal_year = ?', "LOWER(TRIM(bp.status)) <> 'deleted'"];
    const params = [Number(currentFY)];
    const isQueueSuperAdminView = Boolean(superAdminQueueView) && ['hod', 'coordinator', 'ithead', 'dof', 'principal'].includes(safeRole);

    // Archival predicates (replicated from buildBudgetList)
    const archivedStatusPredicate = `LOWER(TRIM(bp.status)) IN ('archived', 'archive')`;
    const archivedByLevel1Predicate = `(${archivedStatusPredicate} AND EXISTS (SELECT 1 FROM budget_proposal_approvals bpa_archive WHERE bpa_archive.budget_proposal_id = bp.id AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive') AND LOWER(TRIM(bpa_archive.role)) IN ('level1', 'hod', 'coordinator')))`;
    const archivedByDofPredicate = `(${archivedStatusPredicate} AND EXISTS (SELECT 1 FROM budget_proposal_approvals bpa_archive WHERE bpa_archive.budget_proposal_id = bp.id AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive') AND LOWER(TRIM(bpa_archive.role)) = 'dof'))`;
    const archivedByPrincipalPredicate = `(${archivedStatusPredicate} AND EXISTS (SELECT 1 FROM budget_proposal_approvals bpa_archive WHERE bpa_archive.budget_proposal_id = bp.id AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive') AND LOWER(TRIM(bpa_archive.role)) = 'principal'))`;
    const archivedByItheadPredicate = `(${archivedStatusPredicate} AND EXISTS (SELECT 1 FROM budget_proposal_approvals bpa_archive WHERE bpa_archive.budget_proposal_id = bp.id AND LOWER(TRIM(bpa_archive.decision)) IN ('archived', 'archive') AND LOWER(TRIM(bpa_archive.role)) = 'ithead'))`;
    const level1ProgressionPredicate = `(bp.current_stage = "level1" OR (bp.status LIKE "level1_%" AND bp.status != "completed"))`;
    const level1ApprovedHistoryPredicate = `EXISTS (
        SELECT 1
        FROM budget_proposal_approvals bpa_level1
        WHERE bpa_level1.budget_proposal_id = bp.id
          AND LOWER(TRIM(bpa_level1.decision)) = 'approved'
          AND LOWER(TRIM(bpa_level1.role)) IN ('level1', 'hod', 'coordinator')
    )`;

    switch (safeRole) {
        case 'hod': {
            where.push(`((LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NULL) OR LOWER(TRIM(bp.beneficiary_type)) = 'department')`);
            if (!isQueueSuperAdminView) {
                where.push('md.type = "Academic"');
                const actionQueueExpr = isAdminView
                    ? `(${level1ProgressionPredicate} OR ${level1ApprovedHistoryPredicate} OR ${archivedStatusPredicate})`
                    : `(${level1ProgressionPredicate} OR ${level1ApprovedHistoryPredicate})`;
                where.push(actionQueueExpr);
                const normalizedDepartment = normalizeText(department);
                const hodScope = [];
                if (safeUserId > 0) {
                    hodScope.push(`bp.department_id IN (
                        SELECT entity_id
                        FROM user_entity_roles
                        WHERE user_id = ?
                          AND entity_type = 'DEPARTMENT'
                    )`);
                    params.push(safeUserId);
                }
                if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) { hodScope.push('bp.department_id = ?'); params.push(Number(departmentId)); }
                if (normalizedDepartment) { hodScope.push(`(LOWER(TRIM(md.name)) = LOWER(TRIM(?)) OR LOWER(TRIM(md.code)) = LOWER(TRIM(?)) OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(?)))`); params.push(normalizedDepartment, normalizedDepartment, normalizedDepartment); }
                where.push(hodScope.length ? `(${hodScope.join(' OR ')})` : '1 = 0');
            }
            break;
        }
        case 'coordinator': {
            where.push(`(LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body', 'section') OR (LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff') AND bp.beneficiary_entity_id IS NOT NULL))`);
            if (!isQueueSuperAdminView) {
                const actionQueueExpr = isAdminView
                    ? `(${level1ProgressionPredicate} OR ${level1ApprovedHistoryPredicate} OR ${archivedStatusPredicate})`
                    : `(${level1ProgressionPredicate} OR ${level1ApprovedHistoryPredicate})`;
                where.push(actionQueueExpr);
                const filterConditions = [];
                if (safeUserId > 0) { filterConditions.push(`me.id IN (SELECT entity_id FROM user_entity_roles WHERE user_id = ? AND entity_type IN ('CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'))`); params.push(safeUserId); }
                if (userEmail) { filterConditions.push('LOWER(TRIM(mec.email)) = LOWER(TRIM(?))'); params.push(userEmail); }
                where.push(filterConditions.length ? `(${filterConditions.join(' OR ')})` : '1 = 0');
            }
            break;
        }
        case 'dof':
            where.push(isAdminView
                ? `(bp.current_stage = "dof" OR bp.status LIKE "dof_%" OR bp.status = "completed" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "dof" OR bp.status LIKE "dof_%" OR bp.status LIKE "principal_%" OR bp.status = "completed")`
            );
            break;
        case 'ithead':
            where.push('LOWER(TRIM(bp.budget_tag)) = LOWER(TRIM(?))');
            params.push('IT Infrastructure');
            where.push(isAdminView
                ? `(bp.current_stage = "ithead" OR bp.status LIKE "ithead_%" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "ithead" OR bp.status LIKE "ithead_%")`
            );
            break;
        case 'principal':
            where.push(isAdminView
                ? `(bp.current_stage = "principal" OR bp.status LIKE "principal_%" OR bp.status = "completed" OR ${archivedStatusPredicate})`
                : `(bp.current_stage = "principal" OR bp.status LIKE "principal_%" OR bp.status = "completed")`
            );
            break;
        case 'admin':
        case 'super_admin':
            break;
        default:
            if (isAdminView) {
                where.push('(bp.user_id = ? OR bp.user_email = ?)');
                params.push(safeUserId, normalizeText(userEmail));
            }
            break;
    }

    if (normalizeText(departmentFilter)) {
        const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
        if (isEntityBeneficiaryType(normalizedBeneficiaryType)) {
            where.push('me.name = ?');
            params.push(normalizeText(departmentFilter));
        } else if (['Faculty', 'Staff', 'Department'].includes(normalizedBeneficiaryType)) {
            where.push('md.name = ?');
            params.push(normalizeText(departmentFilter));
        } else {
            where.push('(md.name = ? OR me.name = ?)');
            params.push(normalizeText(departmentFilter), normalizeText(departmentFilter));
        }
    }
    if (normalizeText(beneficiaryType)) {
        where.push('LOWER(TRIM(bp.beneficiary_type)) = LOWER(TRIM(?))');
        params.push(normalizeText(beneficiaryType));
    }
    if (normalizeText(q)) {
        const searchPattern = `%${normalizeText(q)}%`;
        where.push(`(bp.proposal_ref LIKE ? OR bp.beneficiary_value LIKE ? OR md.name LIKE ? OR me.name LIKE ? OR applicant_emp.first_name LIKE ? OR applicant_emp.last_name LIKE ?)`);
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    let archivedOwnerConditionForSql = '';
    const archivedOwnerParams = [];
    if (!isQueueSuperAdminView && safeRole !== 'admin' && safeRole !== 'super_admin') {
        const ownerChecks = [];
        if (safeUserId > 0) {
            ownerChecks.push(`COALESCE(bpa_archive_owner.approver_user_id, 0) = ?`);
            archivedOwnerParams.push(safeUserId);
        }
        if (normalizedUserEmail) {
            ownerChecks.push(`LOWER(TRIM(COALESCE(bpa_archive_owner.approver_email, ''))) = LOWER(TRIM(?))`);
            archivedOwnerParams.push(normalizedUserEmail);
        }
        if (ownerChecks.length > 0) {
            archivedOwnerConditionForSql = ` AND EXISTS (
                SELECT 1
                FROM budget_proposal_approvals bpa_archive_owner
                WHERE bpa_archive_owner.budget_proposal_id = bp.id
                  AND LOWER(TRIM(bpa_archive_owner.decision)) IN ('archive', 'archived')
                  AND (
                    ${ownerChecks.join(' OR ')}
                    OR (
                      COALESCE(bpa_archive_owner.approver_user_id, 0) = 0
                      AND LENGTH(TRIM(COALESCE(bpa_archive_owner.approver_email, ''))) = 0
                    )
                  )
            )`;
        } else {
            archivedOwnerConditionForSql = ' AND 1 = 0';
        }
    }

    // Status category mapping logic replicated from frontend (isApprovedForActiveTab + getStatusCategory)
    // but in SQL for performance.
    let approvedCondition = "1=0"; // Default
    if (safeRole === 'hod' || safeRole === 'coordinator') {
        approvedCondition = "bp.status IN ('level1_approved', 'hod_approved', 'ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
    } else if (safeRole === 'ithead') {
        approvedCondition = "bp.status IN ('ithead_approved', 'dof_approved', 'principal_approved', 'completed')";
    } else if (safeRole === 'dof') {
        approvedCondition = "bp.status IN ('dof_approved', 'principal_approved', 'completed')";
    } else if (safeRole === 'principal') {
        approvedCondition = "bp.status IN ('principal_approved', 'completed')";
    } else {
        // Admin/SuperAdmin/General view
        approvedCondition = "bp.status IN ('principal_approved', 'completed')";
    }

    const sql = `
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN LOWER(TRIM(bp.status)) IN ('archived', 'archive') ${archivedOwnerConditionForSql} THEN 1 ELSE 0 END) AS archived,
            SUM(CASE WHEN (LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) LIKE '%returned%') THEN 1 ELSE 0 END) AS returned,
            SUM(CASE WHEN (LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) LIKE '%rejected%') THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN (LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) NOT LIKE '%rejected%' AND LOWER(TRIM(bp.status)) NOT LIKE '%returned%' AND ${approvedCondition}) THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN (LOWER(TRIM(bp.status)) NOT IN ('archived', 'archive') AND LOWER(TRIM(bp.status)) NOT LIKE '%rejected%' AND LOWER(TRIM(bp.status)) NOT LIKE '%returned%' AND NOT ${approvedCondition}) THEN 1 ELSE 0 END) AS pending
        FROM budget_proposals bp
        LEFT JOIN master_departments md ON bp.department_id = md.id
        LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
        LEFT JOIN master_employees applicant_emp ON bp.user_id = applicant_emp.user_id AND applicant_emp.status = 'Active'
        LEFT JOIN master_entity_contacts mec ON me.id = mec.entity_id
        ${whereClause}
    `;

    const [rows] = await db.query(sql, [...archivedOwnerParams, ...params]);
    const result = rows[0] || { total: 0, archived: 0, returned: 0, rejected: 0, approved: 0, pending: 0 };

    return {
        total: Number(result.total || 0),
        archived: Number(result.archived || 0),
        returned: Number(result.returned || 0),
        rejected: Number(result.rejected || 0),
        approved: Number(result.approved || 0),
        pending: Number(result.pending || 0)
    };
}
