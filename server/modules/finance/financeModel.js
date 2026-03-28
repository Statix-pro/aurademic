import db from '../../config/connection.js';

const safeParseJSON = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeBeneficiaryType = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType);

  if (normalized === 'Individual Faculty' || normalized === 'Faculty_Team') {
    return 'Faculty';
  }

  if (normalized === 'Student_Team') {
    return 'Department';
  }

  return normalized || 'Institution';
};

const FINANCE_SELECT_SQL = `
  SELECT
    fr.id,
    fr.employee_id,
    fr.created_by,
    COALESCE(
      TRIM(CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))),
      fr.applicant_name
    ) AS applicant_name,
    COALESCE(e.designation, fr.designation) AS designation,
    COALESCE(d.name, fr.department) AS department,
    COALESCE(e.email, fr.email) AS email,
    COALESCE(e.mobile, fr.mobile) AS mobile,
    e.erp_id,
    CASE WHEN fr.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
    fr.request_date,
    fr.description,
    fr.beneficiary_type,
    fr.beneficiary_value,
    fr.department_id,
    fr.beneficiary_entity_id,
    fr.primary_head,
    fr.event_sub_head,
    fr.is_budget_proposed,
    fr.proposed_amount,
    fr.balance_amount,
    fr.total_budget,
    fr.income_type,
    fr.income_status,
    fr.income_amount_type,
    fr.credit_status,
    fr.debit_status,
    fr.partial_amount,
    fr.enclosures,
    fr.director_status,
    fr.director_comment,
    fr.principal_status,
    fr.principal_comment,
    fr.principal_priority,
    fr.chairman_status,
    fr.chairman_comment,
    fr.overall_status,
    fr.workflow_state,
    fr.workflow_status,
    fr.workflow_stage,
    fr.created_at,
    fr.updated_at
  FROM finance_requests fr
  LEFT JOIN master_employees e ON fr.employee_id = e.id
  LEFT JOIN master_departments d ON e.department_id = d.id
`;

const mapWorkflowStatusToOverallStatus = (workflowState) => {
  const status = normalizeText(workflowState?.status).toLowerCase();

  if (status === 'completed') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'archived') return 'archived';
  return 'pending';
};

const normalizeWorkflowState = (workflowState) => {
  const parsed = safeParseJSON(workflowState, workflowState);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return {
    ...parsed,
    flow: Array.isArray(parsed.flow) ? parsed.flow : [],
    currentStage: normalizeText(parsed.currentStage).toLowerCase() || null,
    status: normalizeText(parsed.status).toLowerCase() || null,
    isEditableByApplicant: Boolean(parsed.isEditableByApplicant),
  };
};

const resolveEntityTypeCodeFromBeneficiaryType = (beneficiaryType) => {
  const normalizedType = normalizeBeneficiaryType(beneficiaryType);

  const map = {
    Centre: 'CENTRE',
    Cell: 'CELL',
    Club: 'CLUB',
    'Professional Body': 'PROFESSIONAL_BODY',
    ProfessionalBodies: 'PROFESSIONAL_BODY',
    'Professional Bodies': 'PROFESSIONAL_BODY',
  };

  return map[normalizedType] || null;
};

const resolveFinanceWorkflowContext = async (conn, financeData = {}) => {
  const beneficiaryType = normalizeBeneficiaryType(financeData.beneficiary_type);
  const entityTypeCode = resolveEntityTypeCodeFromBeneficiaryType(beneficiaryType);

  let departmentId = null;
  let beneficiaryEntityId = null;

  const employeeId = toPositiveInt(financeData.employee_id);

  if (employeeId) {
    const [employeeRows] = await conn.query(
      `SELECT department_id, entity_id
         FROM master_employees
         WHERE id = ?
           AND status = 'Active'
         LIMIT 1`,
      [employeeId]
    );

    if (employeeRows.length) {
      departmentId = toPositiveInt(employeeRows[0].department_id);
      beneficiaryEntityId = toPositiveInt(employeeRows[0].entity_id);
    }
  }

  if (!departmentId && beneficiaryType === 'Department' && normalizeText(financeData.beneficiary_value)) {
    const [departmentRows] = await conn.query(
      `SELECT id
         FROM master_departments
         WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         LIMIT 1`,
      [financeData.beneficiary_value]
    );

    if (departmentRows.length) {
      departmentId = toPositiveInt(departmentRows[0].id);
    }
  }

  if (!beneficiaryEntityId && entityTypeCode && normalizeText(financeData.beneficiary_value)) {
    const [entityRows] = await conn.query(
      `SELECT me.id
         FROM master_entities me
         JOIN master_entity_types met ON met.id = me.entity_type_id
         WHERE me.is_active = 1
           AND UPPER(TRIM(met.code)) = ?
           AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
         LIMIT 1`,
      [entityTypeCode, financeData.beneficiary_value]
    );

    if (entityRows.length) {
      beneficiaryEntityId = toPositiveInt(entityRows[0].id);
    }
  }

  return {
    beneficiaryType,
    entityTypeCode,
    departmentId,
    beneficiaryEntityId,
  };
};

const financeModel = {
  async createFinanceRequest(financeData, userId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const workflowContext = await resolveFinanceWorkflowContext(connection, financeData);

      const financeEntry = {
        employee_id: financeData.employee_id || null,
        applicant_name: financeData.employee_id ? null : financeData.applicant_name || null,
        designation: financeData.employee_id ? null : financeData.designation || null,
        department: financeData.employee_id ? null : financeData.department || null,
        email: financeData.employee_id ? null : financeData.email || null,
        mobile: financeData.employee_id ? null : financeData.mobile || null,

        request_date: financeData.request_date,
        description: financeData.description || null,

        beneficiary_type: financeData.beneficiary_type,
        beneficiary_value: financeData.beneficiary_value || null,
        department_id: workflowContext.departmentId,
        beneficiary_entity_id: workflowContext.beneficiaryEntityId,

        primary_head: financeData.primary_head,
        event_sub_head: financeData.event_sub_head || null,

        is_budget_proposed: financeData.is_budget_proposed || 'No',
        proposed_amount: financeData.proposed_amount || null,
        balance_amount: financeData.balance_amount || null,

        income_type: financeData.income_type || null,
        income_status: financeData.income_status || null,
        income_amount_type: financeData.income_amount_type || null,
        credit_status: financeData.credit_status || null,
        debit_status: financeData.debit_status || null,
        partial_amount: financeData.partial_amount || null,

        enclosures: financeData.enclosures ? JSON.stringify(financeData.enclosures) : null,

        total_budget: financeData.total_budget || 0,
        created_by: userId,
      };

      const [result] = await connection.query('INSERT INTO finance_requests SET ?', [financeEntry]);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async updateFinanceRequest(id, financeData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.query(
        `SELECT id, employee_id, beneficiary_type, beneficiary_value
           FROM finance_requests
           WHERE id = ?
           LIMIT 1`,
        [id]
      );

      if (!existingRows.length) {
        await connection.rollback();
        return { affectedRows: 0 };
      }

      const existingRecord = existingRows[0];
      const updateData = Object.fromEntries(
        Object.entries(financeData).filter(([_, value]) => value !== undefined && value !== null)
      );

      if (updateData.enclosures) {
        updateData.enclosures = JSON.stringify(updateData.enclosures);
      }

      const mergedRecordForContext = {
        employee_id: updateData.employee_id ?? existingRecord.employee_id,
        beneficiary_type: updateData.beneficiary_type ?? existingRecord.beneficiary_type,
        beneficiary_value: updateData.beneficiary_value ?? existingRecord.beneficiary_value,
      };

      const workflowContext = await resolveFinanceWorkflowContext(connection, mergedRecordForContext);
      updateData.department_id = workflowContext.departmentId;
      updateData.beneficiary_entity_id = workflowContext.beneficiaryEntityId;

      const [result] = await connection.query('UPDATE finance_requests SET ? WHERE id = ?', [updateData, id]);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error updating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getFinanceRequestById(id) {
    try {
      const [rows] = await db.query(`${FINANCE_SELECT_SQL} WHERE fr.id = ? LIMIT 1`, [id]);

      if (!rows.length) return null;

      const finance = rows[0];
      finance.enclosures = safeParseJSON(finance.enclosures, []);
      finance.workflow_state = normalizeWorkflowState(finance.workflow_state);

      return finance;
    } catch (error) {
      throw new Error(`Error fetching finance request: ${error.message}`);
    }
  },

  async listFinanceRequests({ userId, mine, status }) {
    try {
      let query = `${FINANCE_SELECT_SQL} WHERE 1 = 1`;
      const params = [];

      if (mine) {
        query += ' AND fr.created_by = ?';
        params.push(userId);
      }

      if (status) {
        query += ' AND fr.overall_status = ?';
        params.push(status);
      }

      query += ' ORDER BY fr.created_at DESC';

      const [rows] = await db.query(query, params);

      return rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
      }));
    } catch (error) {
      throw new Error(`Error listing finance requests: ${error.message}`);
    }
  },

  async addBudgetBreakup(financeId, budgetRows) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      let total = 0;

      for (const row of budgetRows) {
        const amount = Number(row.amount) || 0;
        total += amount;

        await connection.query(
          `INSERT INTO finance_budget_breakup
           (finance_id, budget_head, sub_head, amount)
           VALUES (?, ?, ?, ?)`,
          [financeId, row.budget_head, row.sub_head, amount]
        );
      }

      await connection.query('UPDATE finance_requests SET total_budget = ? WHERE id = ?', [total, financeId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error adding budget breakup: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  async getBudgetBreakup(financeId) {
    try {
      const [rows] = await db.query('SELECT * FROM finance_budget_breakup WHERE finance_id = ?', [financeId]);
      return rows;
    } catch (error) {
      throw new Error(`Error fetching budget breakup: ${error.message}`);
    }
  },

  async getStatusUpdates(financeId) {
    try {
      const [rows] = await db.query(
        `SELECT
           wa.id,
           wa.record_id AS finance_id,
           wa.actor_user_id AS user_id,
           wa.stage AS role,
           wa.stage,
           wa.decision AS status,
           wa.decision,
           wa.feedback AS comment,
           wa.feedback,
           wa.decided_at AS created_at,
           wa.decided_at,
           u.name AS user_name,
           wa.actor_email,
           wa.actor_role,
           wa.snapshot_before,
           wa.meta
         FROM workflow_actions wa
         LEFT JOIN users u ON u.id = wa.actor_user_id
         WHERE wa.module_key = 'finance'
           AND wa.record_id = ?
         ORDER BY wa.decided_at ASC, wa.id ASC`,
        [financeId]
      );

      return rows.map((row) => ({
        ...row,
        snapshot_before: safeParseJSON(row.snapshot_before, null),
        meta: safeParseJSON(row.meta, null),
      }));
    } catch (error) {
      throw new Error(`Error fetching status updates: ${error.message}`);
    }
  },

  async doesFinanceExist(id) {
    const [rows] = await db.query('SELECT 1 FROM finance_requests WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0;
  },

  async getEmployeeByEmail(email) {
    try {
      const [rows] = await db.query(
        `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.orcid_id,
          e.scopus_id
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.email = ?
          AND e.status = 'Active'
        LIMIT 1`,
        [email]
      );

      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      throw new Error(`Error fetching employee: ${error.message}`);
    }
  },

  async searchApplicant(query) {
    try {
      const queryStr = normalizeText(query);
      let sql = '';
      let params = [];

      if (!queryStr) {
        sql = `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;
      } else {
        sql = `SELECT
          e.id AS employee_id,
          e.erp_id,
          CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
          e.designation,
          d.name AS department,
          e.email,
          e.mobile,
          e.employee_type
        FROM master_employees e
        LEFT JOIN master_departments d ON e.department_id = d.id
        WHERE e.status = 'Active'
          AND (
            e.first_name LIKE ?
            OR e.last_name LIKE ?
            OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
            OR e.erp_id LIKE ?
            OR e.email LIKE ?
            OR d.name LIKE ?
          )
        ORDER BY e.first_name, e.last_name
        LIMIT 20`;

        params = [
          `%${queryStr}%`,
          `%${queryStr}%`,
          `%${queryStr}%`,
          `${queryStr}%`,
          `%${queryStr}%`,
          `%${queryStr}%`,
        ];
      }

      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      throw new Error(`Error searching applicant: ${error.message}`);
    }
  },

  async getFinanceRecordContext(recordId, { tx = db, forUpdate = false } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return null;
    }

    const lockClause = forUpdate ? ' FOR UPDATE' : '';

    const [rows] = await tx.query(
      `SELECT
         fr.id,
         fr.created_by,
         fr.beneficiary_type,
         fr.beneficiary_entity_id,
         fr.department_id
       FROM finance_requests fr
       WHERE fr.id = ?${lockClause}`,
      [normalizedRecordId]
    );

    if (!rows.length) {
      return null;
    }

    const row = rows[0];

    return {
      beneficiaryType: normalizeBeneficiaryType(row.beneficiary_type),
      beneficiaryEntityId: toPositiveInt(row.beneficiary_entity_id),
      departmentId: toPositiveInt(row.department_id),
      applicantUserId: toPositiveInt(row.created_by),
    };
  },

  async updateFinanceWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);

    if (!normalizedRecordId) {
      return false;
    }

    const workflowStatePayload = JSON.stringify(newState || null);
    const overallStatus = mapWorkflowStatusToOverallStatus(newState);

    const [result] = await tx.query(
      `UPDATE finance_requests
          SET workflow_state = ?,
              overall_status = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [workflowStatePayload, overallStatus, normalizedRecordId]
    );

    return result.affectedRows > 0;
  },

  async listFinanceQueueRecords(stage, filters = {}, { tx = db } = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';

    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const whereParts = ['fr.workflow_stage = ?', 'fr.workflow_status = ?'];
    const whereParams = [normalizedStage, workflowStatus];

    const scopeFilters = filters.scopeFilters || {};

    if (!scopeFilters.forceAll) {
      if (scopeFilters.scopeType === 'department') {
        const departmentIds = Array.from(scopeFilters.departmentIds || []).map((id) => toPositiveInt(id)).filter(Boolean);
        if (scopeFilters.forceEmpty || departmentIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push('fr.department_id IN (?)');
        whereParams.push(departmentIds);
      }

      if (scopeFilters.scopeType === 'entity') {
        const entityIds = Array.from(scopeFilters.entityIds || []).map((id) => toPositiveInt(id)).filter(Boolean);
        if (scopeFilters.forceEmpty || entityIds.length === 0) {
          return { items: [], total: 0, page, limit };
        }
        whereParts.push('fr.beneficiary_entity_id IN (?)');
        whereParams.push(entityIds);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [countRows] = await tx.query(
      `SELECT COUNT(*) AS total
         FROM finance_requests fr
         ${whereClause}`,
      whereParams
    );

    const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await tx.query(
      `${FINANCE_SELECT_SQL}
       ${whereClause}
       ORDER BY fr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    return {
      items: rows.map((row) => ({
        ...row,
        enclosures: safeParseJSON(row.enclosures, []),
        workflow_state: normalizeWorkflowState(row.workflow_state),
      })),
      total,
      page,
      limit,
    };
  },

  async getFinanceOwner(recordId) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) {
      return null;
    }

    const [rows] = await db.query(
      `SELECT id, created_by
         FROM finance_requests
         WHERE id = ?
         LIMIT 1`,
      [normalizedRecordId]
    );

    return rows.length ? rows[0] : null;
  },
};

export default financeModel;
