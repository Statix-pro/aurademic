import db from '../../config/connection.js';

const masterDataModel = {
    // ============================================
    // DEPARTMENTS
    // ============================================

    async getDepartments(filters = {}) {
        try {
            let query = `
        SELECT d.*, pd.name AS parent_name, pd.code AS parent_code
        FROM master_departments d
        LEFT JOIN master_departments pd ON d.parent_id = pd.id
        WHERE 1=1
      `;
            const params = [];

            if (filters.type) {
                query += ' AND d.type = ?';
                params.push(filters.type);
            }
            if (filters.is_active !== undefined) {
                query += ' AND d.is_active = ?';
                params.push(filters.is_active);
            }
            if (filters.search) {
                query += ' AND (d.name LIKE ? OR d.code LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            query += ' ORDER BY d.sort_order, d.name';

            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Error fetching departments: ${error.message}`);
        }
    },

    async getDepartmentById(id) {
        try {
            const [rows] = await db.query(
                `SELECT d.*, pd.name AS parent_name, pd.code AS parent_code
         FROM master_departments d
         LEFT JOIN master_departments pd ON d.parent_id = pd.id
         WHERE d.id = ?`,
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            throw new Error(`Error fetching department: ${error.message}`);
        }
    },

    async createDepartment(data) {
        try {
            const [result] = await db.query(
                `INSERT INTO master_departments (code, name, type, parent_id, hod_name, email, phone, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.code || null,
                    data.name,
                    data.type || 'Academic',
                    data.parent_id || null,
                    data.hod_name || null,
                    data.email || null,
                    data.phone || null,
                    data.sort_order ?? 0,
                ]
            );
            return { id: result.insertId, ...data };
        } catch (error) {
            throw new Error(`Error creating department: ${error.message}`);
        }
    },

    async updateDepartment(id, data) {
        try {
            const fields = [];
            const params = [];

            const allowedFields = [
                'code',
                'name',
                'type',
                'parent_id',
                'hod_name',
                'email',
                'phone',
                'sort_order',
                'is_active',
            ];

            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    params.push(data[field]);
                }
            }

            if (fields.length === 0) {
                return false;
            }

            params.push(id);
            const [result] = await db.query(
                `UPDATE master_departments SET ${fields.join(', ')} WHERE id = ?`,
                params
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error updating department: ${error.message}`);
        }
    },

    async deleteDepartment(id) {
        try {
            const [result] = await db.query(
                'UPDATE master_departments SET is_active = 0 WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error deleting department: ${error.message}`);
        }
    },

    // ============================================
    // ENTITY TYPES
    // ============================================

    async getEntityTypes() {
        try {
            const [rows] = await db.query(
                'SELECT * FROM master_entity_types WHERE is_active = 1 ORDER BY sort_order, name'
            );
            return rows;
        } catch (error) {
            throw new Error(`Error fetching entity types: ${error.message}`);
        }
    },

    // ============================================
    // ENTITIES
    // ============================================

    async getEntities(filters = {}) {
        try {
            let query = `
        SELECT me.*, met.code AS type_code, met.name AS type_name,
          GROUP_CONCAT(
            DISTINCT CONCAT(mec.role, ':', mec.email)
            ORDER BY mec.is_primary DESC
            SEPARATOR '|'
          ) AS contacts_raw
        FROM master_entities me
        JOIN master_entity_types met ON me.entity_type_id = met.id
        LEFT JOIN master_entity_contacts mec ON me.id = mec.entity_id
        WHERE 1=1
      `;
            const params = [];

            if (filters.entity_type_id) {
                query += ' AND me.entity_type_id = ?';
                params.push(filters.entity_type_id);
            }
            if (filters.is_active !== undefined) {
                query += ' AND me.is_active = ?';
                params.push(filters.is_active);
            }
            if (filters.search) {
                query += ' AND (me.name LIKE ? OR me.code LIKE ?)';
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            query += ' GROUP BY me.id ORDER BY met.sort_order, me.sort_order, me.name';

            const [rows] = await db.query(query, params);

            // Parse contacts_raw into structured array
            return rows.map((row) => {
                const contacts = row.contacts_raw
                    ? row.contacts_raw.split('|').map((c) => {
                        const [role, email] = c.split(':');
                        return { role, email };
                    })
                    : [];
                const { contacts_raw, ...rest } = row;
                return { ...rest, contacts };
            });
        } catch (error) {
            throw new Error(`Error fetching entities: ${error.message}`);
        }
    },

    async getEntityById(id) {
        try {
            const [entityRows] = await db.query(
                `SELECT me.*, met.code AS type_code, met.name AS type_name
         FROM master_entities me
         JOIN master_entity_types met ON me.entity_type_id = met.id
         WHERE me.id = ?`,
                [id]
            );
            if (!entityRows[0]) return null;

            const [contacts] = await db.query(
                'SELECT * FROM master_entity_contacts WHERE entity_id = ? ORDER BY is_primary DESC',
                [id]
            );

            return { ...entityRows[0], contacts };
        } catch (error) {
            throw new Error(`Error fetching entity: ${error.message}`);
        }
    },

    async createEntity(data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO master_entities (entity_type_id, code, name, sort_order)
         VALUES (?, ?, ?, ?)`,
                [
                    data.entity_type_id,
                    data.code || null,
                    data.name,
                    data.sort_order ?? 0,
                ]
            );

            const entityId = result.insertId;

            // Insert contact if provided
            if (data.contact_email) {
                await connection.query(
                    `INSERT INTO master_entity_contacts (entity_id, role, email, is_primary)
           VALUES (?, ?, ?, 1)`,
                    [entityId, data.contact_role || 'office', data.contact_email]
                );
            }

            await connection.commit();
            return { id: entityId, ...data };
        } catch (error) {
            await connection.rollback();
            throw new Error(`Error creating entity: ${error.message}`);
        } finally {
            connection.release();
        }
    },

    async updateEntity(id, data) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const fields = [];
            const params = [];
            const allowedFields = [
                'entity_type_id',
                'code',
                'name',
                'sort_order',
                'is_active',
            ];

            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    params.push(data[field]);
                }
            }

            if (fields.length > 0) {
                params.push(id);
                await connection.query(
                    `UPDATE master_entities SET ${fields.join(', ')} WHERE id = ?`,
                    params
                );
            }

            // Sync contact if provided
            if (data.contact_email !== undefined) {
                // Remove old primary contact
                await connection.query(
                    'DELETE FROM master_entity_contacts WHERE entity_id = ? AND is_primary = 1',
                    [id]
                );
                if (data.contact_email) {
                    await connection.query(
                        `INSERT INTO master_entity_contacts (entity_id, role, email, is_primary)
             VALUES (?, ?, ?, 1)`,
                        [id, data.contact_role || 'office', data.contact_email]
                    );
                }
            }

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw new Error(`Error updating entity: ${error.message}`);
        } finally {
            connection.release();
        }
    },

    async deleteEntity(id) {
        try {
            const [result] = await db.query(
                'UPDATE master_entities SET is_active = 0 WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error deleting entity: ${error.message}`);
        }
    },

    // ============================================
    // EMPLOYEES
    // ============================================

    async getEmployees(filters = {}) {
        try {
            let query = `
        SELECT
          e.id, e.erp_id,
          e.title, e.first_name, e.last_name,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
          e.email, e.mobile,
          e.designation, e.department_id,
          d.name AS department_name, d.code AS department_code,
          e.entity_id, me.name AS entity_name, me.code AS entity_code,
          e.employee_type, e.status,
          e.dob, e.doj, e.dor,
          e.gender,
          e.orcid_id, e.wos_researcher_id, e.scopus_id, e.google_scholar_id
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        LEFT JOIN master_entities me ON e.entity_id = me.id
        WHERE 1=1
      `;
            const params = [];

            if (filters.search) {
                query +=
                    ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.erp_id LIKE ? OR e.email LIKE ?)';
                params.push(
                    `%${filters.search}%`,
                    `%${filters.search}%`,
                    `%${filters.search}%`,
                    `%${filters.search}%`
                );
            }
            if (filters.department_id) {
                query += ' AND e.department_id = ?';
                params.push(filters.department_id);
            }
            if (filters.status) {
                query += ' AND e.status = ?';
                params.push(filters.status);
            }
            if (filters.employee_type) {
                query += ' AND e.employee_type = ?';
                params.push(filters.employee_type);
            }

            query += ' ORDER BY e.first_name, e.last_name';

            // Pagination
            const page = parseInt(filters.page, 10) || 1;
            const limit = parseInt(filters.limit, 10) || 50;
            const offset = (page - 1) * limit;
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [rows] = await db.query(query, params);

            // Count total for pagination
            let countQuery = 'SELECT COUNT(*) AS total FROM master_employees e WHERE 1=1';
            const countParams = [];

            if (filters.search) {
                countQuery +=
                    ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.erp_id LIKE ? OR e.email LIKE ?)';
                countParams.push(
                    `%${filters.search}%`,
                    `%${filters.search}%`,
                    `%${filters.search}%`,
                    `%${filters.search}%`
                );
            }
            if (filters.department_id) {
                countQuery += ' AND e.department_id = ?';
                countParams.push(filters.department_id);
            }
            if (filters.status) {
                countQuery += ' AND e.status = ?';
                countParams.push(filters.status);
            }
            if (filters.employee_type) {
                countQuery += ' AND e.employee_type = ?';
                countParams.push(filters.employee_type);
            }

            const [countRows] = await db.query(countQuery, countParams);
            const total = countRows[0].total;

            return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
        } catch (error) {
            throw new Error(`Error fetching employees: ${error.message}`);
        }
    },

    async getEmployeeById(id) {
        try {
            const [rows] = await db.query(
                `SELECT e.*, d.name AS department_name, d.code AS department_code,
                 me.name AS entity_name, me.code AS entity_code
                 FROM master_employees e
                 LEFT JOIN master_departments d ON e.department_id = d.id
                 LEFT JOIN master_entities me ON e.entity_id = me.id
                 WHERE e.id = ?`,
                [id]
            );
            return rows[0] || null;
        } catch (error) {
            throw new Error(`Error fetching employee: ${error.message}`);
        }
    },

    async createEmployee(data) {
        try {
            const [result] = await db.query(
                `INSERT INTO master_employees
          (erp_id, title, first_name, last_name, gender, email, mobile,
           designation, department_id, parent_department_id, entity_id, employee_type,
           dob, doj, dor, status,
           orcid_id, wos_researcher_id, scopus_id, google_scholar_id, research_gate_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.erp_id,
                    data.title || null,
                    data.first_name,
                    data.last_name || null,
                    data.gender || null,
                    data.email,
                    data.mobile || null,
                    data.designation || null,
                    data.department_id || null,
                    data.parent_department_id || null,
                    data.entity_id || null,
                    data.employee_type || 'Teaching',
                    data.dob || null,
                    data.doj || null,
                    data.dor || null,
                    data.status || 'Active',
                    data.orcid_id || null,
                    data.wos_researcher_id || null,
                    data.scopus_id || null,
                    data.google_scholar_id || null,
                    data.research_gate_id || null,
                ]
            );
            return { id: result.insertId, ...data };
        } catch (error) {
            throw new Error(`Error creating employee: ${error.message}`);
        }
    },

    async updateEmployee(id, data) {
        try {
            const fields = [];
            const params = [];
            const allowedFields = [
                'erp_id',
                'title',
                'first_name',
                'last_name',
                'gender',
                'email',
                'mobile',
                'alternate_email',
                'designation',
                'department_id',
                'parent_department_id',
                'entity_id',
                'employee_type',
                'dob',
                'doj',
                'dor',
                'status',
                'orcid_id',
                'wos_researcher_id',
                'scopus_id',
                'google_scholar_id',
                'research_gate_id',
            ];

            for (const field of allowedFields) {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    params.push(data[field]);
                }
            }

            if (fields.length === 0) {
                return false;
            }

            params.push(id);
            const [result] = await db.query(
                `UPDATE master_employees SET ${fields.join(', ')} WHERE id = ?`,
                params
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error updating employee: ${error.message}`);
        }
    },

    async deleteEmployee(id) {
        try {
            const [result] = await db.query(
                "UPDATE master_employees SET status = 'Relieved' WHERE id = ?",
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw new Error(`Error deleting employee: ${error.message}`);
        }
    },

    // Lightweight search for employee lookup dropdowns
    async searchEmployeesForLookup(search = '') {
        try {
            let query = `
        SELECT id, erp_id, title, first_name, last_name, email, mobile,
          CONCAT(COALESCE(title, ''), ' ', first_name, ' ', COALESCE(last_name, '')) AS full_name
        FROM master_employees
        WHERE status != 'Relieved'
      `;
            const params = [];

            if (search) {
                query += ` AND (first_name LIKE ? OR last_name LIKE ? OR erp_id LIKE ? OR email LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }

            query += ' ORDER BY first_name, last_name LIMIT 20';

            const [rows] = await db.query(query, params);
            return rows;
        } catch (error) {
            throw new Error(`Error searching employees for lookup: ${error.message}`);
        }
    },
};

export default masterDataModel;
