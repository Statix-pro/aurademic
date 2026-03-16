/**
 * Shared User / Department / Employee Resolution Queries
 *
 * Database queries to resolve user departments, employee info,
 * and contextual RBAC assignments. Shared between budget and admin budget.
 */

import db from '../../../config/connection.js';
import { normalizeText } from './budgetUtils.js';

// =====================================================
// USER DEPARTMENT RESOLUTION
// =====================================================

export async function getUserDepartmentByUserId(userId) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT 
            e.id AS employee_id,
            d.id, 
            d.name, 
            d.code,
            COALESCE(pd_emp.name, pd_dept.name) AS parent_department_name,
            e.designation,
            e.mobile,
            TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))) AS full_name
        FROM master_employees e
        JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
        LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
        WHERE e.user_id = ? AND e.status = 'Active'
        ORDER BY e.id ASC
        LIMIT 1`,
        [parsedUserId]
    );

    return rows[0] || null;
}

export async function getUserDepartmentByEmail(userEmail) {
    const normalizedEmail = normalizeText(userEmail).toLowerCase();

    if (!normalizedEmail) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT
    e.id AS employee_id,
      d.id,
      d.name,
      d.code,
      COALESCE(pd_emp.name, pd_dept.name) AS parent_department_name,
        e.designation,
        e.mobile,
        TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))) AS full_name
        FROM master_employees e
        JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
        LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
        WHERE LOWER(TRIM(e.email)) = ?
      AND e.status = 'Active'
        ORDER BY e.id ASC
        LIMIT 1`,
        [normalizedEmail]
    );

    return rows[0] || null;
}

// =====================================================
// EMPLOYEE HELPERS
// =====================================================

export async function getEmployeeDepartmentByEmployeeId(employeeId) {
    const parsedEmployeeId = Number(employeeId);

    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        return null;
    }

    const [rows] = await db.execute(
        `SELECT
    e.id AS employee_id,
      d.id AS department_id,
        d.name,
        d.code,
        COALESCE(pd_emp.name, pd_dept.name, d.name) AS parent_department_name,
        e.entity_id,
        me.name AS entity_name,
        met.code AS entity_type_code
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_entities me ON e.entity_id = me.id
        LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
        LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
        LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
        WHERE e.id = ?
      AND e.status = 'Active'
        LIMIT 1`,
        [parsedEmployeeId]
    );

    return rows[0] || null;
}

export async function checkEmployeeUserMatch(employeeId, userId) {
    const parsedEmployeeId = Number(employeeId);
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0 || !Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return false;
    }

    const [rows] = await db.execute(
        'SELECT id FROM master_employees WHERE id = ? AND user_id = ? AND status = "Active" LIMIT 1',
        [parsedEmployeeId, parsedUserId]
    );

    return rows.length > 0;
}

// =====================================================
// RBAC CONTEXTUAL ASSIGNMENTS
// =====================================================

export async function getUserAssignments(userId) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return [];
    }

    const [rows] = await db.execute(`
    SELECT 
      uer.entity_id, 
      uer.entity_type, 
      r.role_code, 
      p.permission_key AS permission_code,
      COALESCE(d.name, me.name) as entity_name
    FROM user_entity_roles uer
    JOIN roles r ON uer.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    LEFT JOIN master_departments d ON uer.entity_id = d.id AND uer.entity_type = 'DEPARTMENT'
    LEFT JOIN master_entities me ON uer.entity_id = me.id AND uer.entity_type != 'DEPARTMENT'
    WHERE uer.user_id = ?
  `, [parsedUserId]);

    const assignmentsMap = new Map();

    for (const row of rows) {
        const key = `${row.entity_type}-${row.entity_id}`;
        if (!assignmentsMap.has(key)) {
            assignmentsMap.set(key, {
                entity_id: row.entity_id,
                entity_type: row.entity_type,
                entity_name: row.entity_name || 'Unknown',
                role: row.role_code,
                permissions: []
            });
        }
        assignmentsMap.get(key).permissions.push(row.permission_code);
    }

    return Array.from(assignmentsMap.values());
}

// =====================================================
// APPLICANT SEARCH
// =====================================================

export async function searchApplicant(query = '', employeeType = null) {
    const queryStr = normalizeText(query);
    let sql;
    let params = [];

    let typeFilter = '';
    if (employeeType) {
        typeFilter = ' AND e.employee_type = ?';
    }

    if (!queryStr) {
        sql = `SELECT
    e.id AS employee_id,
      e.erp_id,
      TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))) AS name,
        COALESCE(NULLIF(TRIM(e.designation), ''), e.employee_type) AS designation,
          COALESCE(mentity.name, pd_emp.name, pd_dept.name, d.name) AS department,
      e.email,
      e.mobile,
      e.employee_type,
      mentity.name AS entity
    FROM master_employees e
    LEFT JOIN master_departments d ON e.department_id = d.id
    LEFT JOIN master_entities mentity ON e.entity_id = mentity.id
    LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
    LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
    WHERE e.status = 'Active' ${typeFilter}
    ORDER BY e.first_name, e.last_name
    LIMIT 20`;
        if (employeeType) params.push(employeeType);
    } else {
        sql = `SELECT
    e.id AS employee_id,
      e.erp_id,
      TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))) AS name,
        COALESCE(NULLIF(TRIM(e.designation), ''), e.employee_type) AS designation,
          COALESCE(mentity.name, pd_emp.name, pd_dept.name, d.name) AS department,
      e.email,
      e.mobile,
      e.employee_type,
      mentity.name AS entity
    FROM master_employees e
    LEFT JOIN master_departments d ON e.department_id = d.id
    LEFT JOIN master_entities mentity ON e.entity_id = mentity.id
    LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
    LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
    WHERE e.status = 'Active' ${typeFilter}
    AND (
      LOWER(e.first_name) LIKE ?
      OR LOWER(e.last_name) LIKE ?
      OR LOWER(TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')))) LIKE ?
      OR LOWER(e.erp_id) LIKE ?
      OR LOWER(e.email) LIKE ?
      )
    ORDER BY e.first_name, e.last_name
    LIMIT 20`;

        const searchPattern = `%${queryStr.toLowerCase()}%`;

        if (employeeType) params.push(employeeType);
        params.push(
            searchPattern,
            searchPattern,
            searchPattern,
            `${queryStr.toLowerCase()}%`,
            searchPattern
        );
    }

    const [rows] = await db.query(sql, params);
    return rows;
}
