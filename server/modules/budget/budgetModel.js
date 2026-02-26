import db from '../../config/connection.js';

const VALID_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const APPROVAL_FLOW = {
  hod: { approve: 'hod_approved', reject: 'hod_rejected', returned: 'hod_returned', next: 'dof' },
  dof: { approve: 'dof_approved', reject: 'dof_rejected', returned: 'dof_returned', next: 'principal' },
  principal: { approve: 'principal_approved', reject: 'principal_rejected', next: 'completed' },
};

const EDITABLE_STATES = ['draft', 'submitted', 'hod_returned', 'dof_returned', 'principal_returned'];

const ENTITY_TYPE_BY_BENEFICIARY = Object.freeze({
  Centre: 'CENTRE',
  Cell: 'CELL',
  Club: 'CLUB',
  'Professional Body': 'PROFESSIONAL_BODY',
  ProfessionalBodies: 'PROFESSIONAL_BODY',
  'Professional Bodies': 'PROFESSIONAL_BODY',
});

const normalizeText = (value) => String(value || '').trim();

const normalizeBeneficiaryType = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType);

  if (normalized === 'Professional Bodies' || normalized === 'ProfessionalBodies') {
    return 'Professional Body';
  }

  return normalized;
};

const ENTITY_BENEFICIARY_TYPES = Object.freeze(['Centre', 'Cell', 'Club', 'Professional Body']);
const LEVEL1_ROUTE_TYPE = Object.freeze({
  departmentHod: 'department_hod',
  entityContact: 'entity_contact',
});
const LEVEL1_ASSIGNMENT_STATUS = Object.freeze({
  assigned: 'assigned',
  unassigned: 'unassigned',
});
const WORKFLOW_STAGES = Object.freeze(['hod', 'dof', 'principal']);

const normalizeEntityTypeCode = (value) => {
  const raw = normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z_]/g, '');

  if (!raw) {
    return '';
  }

  if (raw === 'PROF_BODY' || raw === 'PROFESSIONALBODIES' || raw === 'PROFESSIONAL_BODYS') {
    return 'PROFESSIONAL_BODY';
  }

  return raw;
};

const normalizeBudgetRole = (value) => {
  const role = normalizeText(value).toLowerCase();

  if (role === 'faculty' || role === '') {
    return 'user';
  }

  return role;
};

const formatApprovalFlowString = ({ requiresHod, requiresDof, requiresPrincipal }) => {
  const stages = [];

  if (requiresHod) stages.push('hod');
  if (requiresDof) stages.push('dof');
  if (requiresPrincipal) stages.push('principal');

  return stages.length > 0 ? stages.join('_') : 'dof_principal';
};

class BudgetModel {

  static getCurrentFinancialYear() {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  }

  static normalizeEntityTypeCode(typeCode) {
    return normalizeEntityTypeCode(typeCode);
  }

  static normalizeBudgetRole(role) {
    return normalizeBudgetRole(role);
  }

  static beneficiaryTypeToEntityTypeCode(beneficiaryType) {
    return ENTITY_TYPE_BY_BENEFICIARY[normalizeBeneficiaryType(beneficiaryType)] || null;
  }

  static normalizeBeneficiaryType(beneficiaryType) {
    return normalizeBeneficiaryType(beneficiaryType);
  }

  static isEntityBeneficiaryType(beneficiaryType) {
    return ENTITY_BENEFICIARY_TYPES.includes(normalizeBeneficiaryType(beneficiaryType));
  }

  static resolveLevel1Route(proposalOrPayload = {}) {
    const beneficiaryType = normalizeBeneficiaryType(proposalOrPayload?.beneficiary_type);
    const parsedDepartmentId = Number(proposalOrPayload?.department_id);
    const parsedEntityId = Number(proposalOrPayload?.beneficiary_entity_id);
    const departmentId =
      Number.isInteger(parsedDepartmentId) && parsedDepartmentId > 0 ? parsedDepartmentId : null;
    const entityId = Number.isInteger(parsedEntityId) && parsedEntityId > 0 ? parsedEntityId : null;

    if (this.isEntityBeneficiaryType(beneficiaryType)) {
      return {
        routeType: LEVEL1_ROUTE_TYPE.entityContact,
        departmentId: null,
        entityId,
      };
    }

    if (['Faculty', 'Department'].includes(beneficiaryType)) {
      return {
        routeType: LEVEL1_ROUTE_TYPE.departmentHod,
        departmentId,
        entityId: null,
      };
    }

    return {
      routeType: null,
      departmentId,
      entityId,
    };
  }

  static #pickEntityLevel1Contact(contacts = []) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return null;
    }

    const normalizedContacts = contacts
      .map((contact) => ({
        id: Number(contact.id),
        role: normalizeText(contact.role).toLowerCase(),
        email: normalizeText(contact.email).toLowerCase(),
        is_primary: Number(contact.is_primary) === 1,
      }))
      .filter((contact) => contact.email.length > 0);

    if (!normalizedContacts.length) {
      return null;
    }

    const byRoleHod = normalizedContacts.find((contact) => contact.role === 'hod');
    if (byRoleHod) {
      return byRoleHod;
    }

    const byRoleOffice = normalizedContacts.find((contact) => contact.role === 'office');
    if (byRoleOffice) {
      return byRoleOffice;
    }

    const primaryContact = normalizedContacts.find((contact) => contact.is_primary);
    if (primaryContact) {
      return primaryContact;
    }

    return normalizedContacts[0];
  }

  static async resolveEntityLevel1Assignee(entityId, conn = db) {
    const parsedEntityId = Number(entityId);

    if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      return null;
    }

    const [rows] = await conn.execute(
      `SELECT id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id = ?
       ORDER BY id ASC`,
      [parsedEntityId]
    );

    const selectedContact = this.#pickEntityLevel1Contact(rows);

    if (!selectedContact) {
      return null;
    }

    return {
      id: selectedContact.id,
      role: selectedContact.role,
      email: selectedContact.email,
      is_primary: selectedContact.is_primary,
    };
  }

  static resolveLevel1AssignmentStatus({ routeType, assigneeEmail } = {}) {
    if (routeType === LEVEL1_ROUTE_TYPE.entityContact && !normalizeText(assigneeEmail)) {
      return LEVEL1_ASSIGNMENT_STATUS.unassigned;
    }

    return LEVEL1_ASSIGNMENT_STATUS.assigned;
  }

  static async #resolveEntityAssigneeMap(entityIds = [], conn = db) {
    const uniqueEntityIds = [
      ...new Set(
        entityIds
          .map((entityId) => Number(entityId))
          .filter((entityId) => Number.isInteger(entityId) && entityId > 0)
      ),
    ];

    const assigneeMap = new Map();

    if (!uniqueEntityIds.length) {
      return assigneeMap;
    }

    const [rows] = await conn.query(
      `SELECT entity_id, id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id IN (?)
       ORDER BY entity_id ASC, id ASC`,
      [uniqueEntityIds]
    );

    const groupedContacts = new Map();

    for (const row of rows) {
      const entityId = Number(row.entity_id);
      if (!groupedContacts.has(entityId)) {
        groupedContacts.set(entityId, []);
      }
      groupedContacts.get(entityId).push(row);
    }

    for (const [entityId, contacts] of groupedContacts.entries()) {
      const selectedContact = this.#pickEntityLevel1Contact(contacts);
      if (selectedContact) {
        assigneeMap.set(entityId, selectedContact);
      }
    }

    return assigneeMap;
  }

  static async #attachLevel1AssignmentMetadata(rows = [], conn = db) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const entityIds = rows
      .filter((row) => this.isEntityBeneficiaryType(row?.beneficiary_type))
      .map((row) => Number(row?.beneficiary_entity_id))
      .filter((entityId) => Number.isInteger(entityId) && entityId > 0);
    const entityAssigneeMap = await this.#resolveEntityAssigneeMap(entityIds, conn);

    return rows.map((row) => {
      const level1Route = this.resolveLevel1Route(row);
      const entityAssignee =
        level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact
          ? entityAssigneeMap.get(level1Route.entityId) || null
          : null;
      const assigneeEmail = entityAssignee?.email || null;

      return {
        ...row,
        level1_route_type: level1Route.routeType,
        level1_assignee_email: assigneeEmail,
        level1_assignment_status: this.resolveLevel1AssignmentStatus({
          routeType: level1Route.routeType,
          assigneeEmail,
        }),
      };
    });
  }

  static groupAllocationsByLine(allocations) {
    const grouped = {};

    for (const allocation of allocations) {
      if (!grouped[allocation.line_id]) {
        grouped[allocation.line_id] = {};
      }

      grouped[allocation.line_id][allocation.month] = Number(allocation.amount);
    }

    return grouped;
  }


  static async withTransaction(callback) {
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw new Error(`Transaction failed: ${error.message}`);
    } finally {
      conn.release();
    }
  }

  static async getUserDepartmentByUserId(userId) {
    const parsedUserId = Number(userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return null;
    }

    // FIXED: Select designation, mobile, and construct full name
    const [rows] = await db.execute(
      `SELECT 
              e.id AS employee_id,
              d.id, 
              d.name, 
              d.code,
              COALESCE(pd_emp.name, pd_dept.name) AS parent_department_name,
              e.designation,
              e.mobile,
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name
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

  static async getEmployeeDepartmentByEmployeeId(employeeId) {
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
              COALESCE(pd_emp.name, pd_dept.name, d.name) AS parent_department_name
          FROM master_employees e
          LEFT JOIN master_departments d ON e.department_id = d.id
          LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
          LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
          WHERE e.id = ?
            AND e.status = 'Active'
          LIMIT 1`,
      [parsedEmployeeId]
    );

    return rows[0] || null;
  }

  static async getUserDepartmentByEmail(userEmail) {
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
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name
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

  static async searchApplicant(query = '') {
    const queryStr = normalizeText(query);
    let sql;
    let params = [];

    if (!queryStr) {
      sql = `SELECT
        e.id AS employee_id,
        e.erp_id,
        CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
        COALESCE(NULLIF(TRIM(e.designation), ''), e.employee_type) AS designation,
        COALESCE(pd_emp.name, pd_dept.name, d.name) AS department,
        e.email,
        e.mobile,
        e.employee_type
      FROM master_employees e
      LEFT JOIN master_departments d ON e.department_id = d.id
      LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
      LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
      WHERE e.status = 'Active'
      ORDER BY e.first_name, e.last_name
      LIMIT 20`;
    } else {
      sql = `SELECT
        e.id AS employee_id,
        e.erp_id,
        CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS name,
        COALESCE(NULLIF(TRIM(e.designation), ''), e.employee_type) AS designation,
        COALESCE(pd_emp.name, pd_dept.name, d.name) AS department,
        e.email,
        e.mobile,
        e.employee_type
      FROM master_employees e
      LEFT JOIN master_departments d ON e.department_id = d.id
      LEFT JOIN master_departments pd_emp ON e.parent_department_id = pd_emp.id
      LEFT JOIN master_departments pd_dept ON d.parent_id = pd_dept.id
      WHERE e.status = 'Active'
        AND (
          e.first_name LIKE ?
          OR e.last_name LIKE ?
          OR CONCAT(e.first_name, ' ', e.last_name) LIKE ?
          OR e.erp_id LIKE ?
          OR e.email LIKE ?
          OR d.name LIKE ?
          OR pd_emp.name LIKE ?
          OR pd_dept.name LIKE ?
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
        `%${queryStr}%`,
        `%${queryStr}%`,
      ];
    }

    const [rows] = await db.query(sql, params);
    return rows;
  }

  static async getDepartmentByName(name, conn = db) {
    const normalized = normalizeText(name);

    if (!normalized) {
      return null;
    }

    const [rows] = await conn.execute(
      `SELECT id, name, code
       FROM master_departments
       WHERE is_active = 1 AND type = 'Academic'
         AND (
           LOWER(TRIM(name)) = LOWER(TRIM(?))
           OR LOWER(TRIM(code)) = LOWER(TRIM(?))
         )
       ORDER BY CASE WHEN LOWER(TRIM(name)) = LOWER(TRIM(?)) THEN 0 ELSE 1 END
       LIMIT 1`,
      [normalized, normalized, normalized]
    );

    return rows[0] || null;
  }

  static async #resolveDepartmentId(conn, payload) {
    const beneficiaryType = normalizeText(payload?.beneficiary_type);
    const beneficiaryValue = normalizeText(payload?.beneficiary_value);
    const requestDepartment = normalizeText(payload?.department);

    if (beneficiaryType === 'Department' && beneficiaryValue) {
      const department = await this.getDepartmentByName(beneficiaryValue, conn);

      if (!department) {
        throw new Error(`Invalid department beneficiary: ${beneficiaryValue}`);
      }

      return Number(department.id);
    }

    if (!requestDepartment) {
      return null;
    }

    const department = await this.getDepartmentByName(requestDepartment, conn);
    return department ? Number(department.id) : null;
  }

  static async #resolveBeneficiaryEntity(conn, beneficiaryType, beneficiaryValue) {
    const entityTypeCode = this.beneficiaryTypeToEntityTypeCode(beneficiaryType);

    if (!entityTypeCode) {
      return { entityTypeCode: null, beneficiaryEntityId: null };
    }

    const normalizedBeneficiaryValue = normalizeText(beneficiaryValue);

    if (!normalizedBeneficiaryValue) {
      throw new Error(`beneficiary_value required for ${beneficiaryType}`);
    }

    const [rows] = await conn.execute(
      `SELECT me.id
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.is_active = 1
         AND met.code = ?
         AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
       LIMIT 1`,
      [entityTypeCode, normalizedBeneficiaryValue]
    );

    if (!rows.length) {
      throw new Error(`Invalid beneficiary_value for ${beneficiaryType}: ${normalizedBeneficiaryValue}`);
    }

    return {
      entityTypeCode,
      beneficiaryEntityId: Number(rows[0].id),
    };
  }


  static async resolveApprovalFlow(beneficiaryType, entityTypeCode = null, conn = db) {
    const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);

    if (!normalizedBeneficiaryType) {
      return { requiresHod: 0, requiresDof: 1, requiresPrincipal: 1 };
    }

    const [rows] = entityTypeCode
      ? await conn.execute(
        `SELECT requires_hod, requires_dof, requires_principal
           FROM approval_flow_config
           WHERE beneficiary_type = ?
             AND entity_type_code = ?
             AND module IN ('BUDGET', 'BOTH')
             AND is_active = 1
           LIMIT 1`,
        [normalizedBeneficiaryType, entityTypeCode]
      )
      : await conn.execute(
        `SELECT requires_hod, requires_dof, requires_principal
           FROM approval_flow_config
           WHERE beneficiary_type = ?
             AND entity_type_code IS NULL
             AND module IN ('BUDGET', 'BOTH')
             AND is_active = 1
           LIMIT 1`,
        [normalizedBeneficiaryType]
      );

    const resolvedFlow = rows.length > 0
      ? {
        requiresHod: Number(rows[0].requires_hod) ? 1 : 0,
        requiresDof: Number(rows[0].requires_dof) ? 1 : 0,
        requiresPrincipal: Number(rows[0].requires_principal) ? 1 : 0,
      }
      : ['Faculty', 'Department'].includes(normalizedBeneficiaryType)
        ? { requiresHod: 1, requiresDof: 1, requiresPrincipal: 1 }
        : { requiresHod: 0, requiresDof: 1, requiresPrincipal: 1 };

    // Entity beneficiaries must always pass through Level 1 before DoF/Principal.
    if (this.isEntityBeneficiaryType(normalizedBeneficiaryType)) {
      resolvedFlow.requiresHod = 1;
    }

    return resolvedFlow;
  }


  static async create(payload) {
    return this.withTransaction(async (conn) => {
      const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
        const amount = Number(line.unit_amount) || 0;
        const qty = Number(line.quantity) || 1;
        return sum + amount * qty;
      }, 0);

      const fyYear = payload.fiscal_year || this.getCurrentFinancialYear();

      await conn.execute(
        'INSERT IGNORE INTO budget_proposal_refs (ref_year, ref_sequence, proposal_id, proposal_ref) VALUES (?, 0, NULL, NULL)',
        [fyYear]
      );

      const [seqRows] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) + 1 AS next_seq
         FROM budget_proposal_refs
         WHERE ref_year = ?`,
        [fyYear]
      );

      const sequence = Number(seqRows[0].next_seq);
      const proposalRef = `#B-${fyYear}-${String(sequence).padStart(4, '0')}`;

      const departmentId = await this.#resolveDepartmentId(conn, payload);
      const { entityTypeCode, beneficiaryEntityId } = await this.#resolveBeneficiaryEntity(
        conn,
        payload.beneficiary_type,
        payload.beneficiary_value
      );

      const flow = await this.resolveApprovalFlow(payload.beneficiary_type, entityTypeCode, conn);
      const initialStage = flow.requiresHod ? 'hod' : flow.requiresDof ? 'dof' : 'principal';
      const approvalFlowString = formatApprovalFlowString(flow);
      const level1Route = this.resolveLevel1Route({
        ...payload,
        department_id: departmentId,
        beneficiary_entity_id: beneficiaryEntityId,
      });
      const level1EntityAssignee =
        level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact
          ? await this.resolveEntityLevel1Assignee(level1Route.entityId, conn)
          : null;
      const level1AssignmentStatus = this.resolveLevel1AssignmentStatus({
        routeType: level1Route.routeType,
        assigneeEmail: level1EntityAssignee?.email || null,
      });

      const [proposalResult] = await conn.execute(
        `INSERT INTO budget_proposals (
          proposal_ref,
          fiscal_year,
          employee_id,
          user_id,
          user_email,
          request_date,
          beneficiary_type,
          beneficiary_value,
          beneficiary_entity_id,
          department_id,
          proposal_description,
          total_amount,
          approval_flow,
          status,
          current_stage,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, NOW())`,
        [
          proposalRef,
          fyYear,
          payload.employee_id || payload.user_id,
          payload.user_id,
          payload.user_email || '',
          payload.request_date,
          payload.beneficiary_type,
          payload.beneficiary_value || null,
          beneficiaryEntityId,
          departmentId,
          payload.proposal_description || null,
          calculatedTotal,
          approvalFlowString,
          initialStage,
        ]
      );

      const proposalId = proposalResult.insertId;

      await conn.execute(
        `INSERT INTO budget_proposal_refs (proposal_id, ref_year, ref_sequence, proposal_ref)
         VALUES (?, ?, ?, ?)`,
        [proposalId, fyYear, sequence, proposalRef]
      );

      if (Array.isArray(payload.lines)) {
        for (const line of payload.lines) {
          const lineId = await this.#insertBudgetLine(proposalId, line, conn);

          if (line.month_allocations) {
            for (const [month, amount] of Object.entries(line.month_allocations)) {
              if (VALID_MONTHS.includes(month)) {
                await this.#insertMonthAllocation(lineId, month, amount, conn);
              }
            }
          }
        }
      }

      return {
        proposalId,
        proposalRef,
        fyYear,
        requiresHod: flow.requiresHod,
        initialStage,
        approvalFlow: approvalFlowString,
        departmentId,
        beneficiaryEntityId,
        level1RouteType: level1Route.routeType,
        level1AssigneeEmail: level1EntityAssignee?.email || null,
        level1AssignmentStatus,
      };
    });
  }


  static async getFull(proposalId) {
    const master = await this.getBudgetById(proposalId);

    if (!master) {
      return null;
    }

    const [lines] = await db.execute(
      `SELECT *
       FROM budget_proposal_lines
       WHERE budget_proposal_id = ?
       ORDER BY id`,
      [proposalId]
    );

    const [allocations] = await db.execute(
      `SELECT l.id AS line_id, m.month, m.amount, l.budget_head, l.sub_head
       FROM budget_proposal_lines l
       JOIN budget_line_month_allocations m ON l.id = m.budget_line_id
       WHERE l.budget_proposal_id = ?
       ORDER BY l.id, FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
      [proposalId]
    );

    const [approvals] = await db.execute(
      `SELECT *, DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i') AS decided_at_formatted
       FROM budget_proposal_approvals
       WHERE budget_proposal_id = ?
       ORDER BY decided_at`,
      [proposalId]
    );

    return {
      master,
      lines,
      allocations: this.groupAllocationsByLine(allocations),
      approvals,
    };
  }


  static async update(proposalId, payload, { skipEditStateValidation = false } = {}) {
    const proposal = await this.getBudgetById(proposalId);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (!skipEditStateValidation && !EDITABLE_STATES.includes(proposal.status)) {
      throw new Error(`Cannot edit ${proposal.status} proposals`);
    }

    return this.withTransaction(async (conn) => {
      const departmentId = await this.#resolveDepartmentId(conn, payload);
      const { entityTypeCode, beneficiaryEntityId } = await this.#resolveBeneficiaryEntity(
        conn,
        payload.beneficiary_type,
        payload.beneficiary_value
      );
      const flow = await this.resolveApprovalFlow(payload.beneficiary_type, entityTypeCode, conn);
      const approvalFlowString = formatApprovalFlowString(flow);
      const initialStage = flow.requiresHod ? 'hod' : flow.requiresDof ? 'dof' : 'principal';
      const nextCurrentStage =
        ['draft', 'submitted'].includes(proposal.status) ? initialStage : proposal.current_stage;

      const calculatedTotal = (payload.lines || []).reduce((sum, line) => {
        const amount = Number(line.unit_amount) || 0;
        const qty = Number(line.quantity) || 1;
        return sum + amount * qty;
      }, 0);

      await conn.execute(
        `UPDATE budget_proposals
         SET beneficiary_type = ?,
             beneficiary_value = ?,
             beneficiary_entity_id = ?,
             department_id = ?,
             approval_flow = ?,
             current_stage = ?,
             proposal_description = ?,
             total_amount = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          payload.beneficiary_type,
          payload.beneficiary_value || null,
          beneficiaryEntityId,
          departmentId,
          approvalFlowString,
          nextCurrentStage,
          payload.proposal_description || null,
          calculatedTotal,
          proposalId,
        ]
      );

      await conn.execute(
        `DELETE m
         FROM budget_line_month_allocations m
         JOIN budget_proposal_lines l ON m.budget_line_id = l.id
         WHERE l.budget_proposal_id = ?`,
        [proposalId]
      );

      await conn.execute('DELETE FROM budget_proposal_lines WHERE budget_proposal_id = ?', [proposalId]);

      if (Array.isArray(payload.lines)) {
        for (const line of payload.lines) {
          const lineId = await this.#insertBudgetLine(proposalId, line, conn);

          if (line.month_allocations) {
            for (const [month, amount] of Object.entries(line.month_allocations)) {
              if (VALID_MONTHS.includes(month)) {
                await this.#insertMonthAllocation(lineId, month, amount, conn);
              }
            }
          }
        }
      }
    });
  }


  static async delete(proposalId) {
    return this.withTransaction(async (conn) => {
      await conn.execute(
        `DELETE m
         FROM budget_line_month_allocations m
         JOIN budget_proposal_lines l ON m.budget_line_id = l.id
         WHERE l.budget_proposal_id = ?`,
        [proposalId]
      );

      await conn.execute('DELETE FROM budget_proposal_lines WHERE budget_proposal_id = ?', [proposalId]);
      await conn.execute('DELETE FROM budget_proposal_approvals WHERE budget_proposal_id = ?', [proposalId]);
      await conn.execute('DELETE FROM budget_proposal_refs WHERE proposal_id = ?', [proposalId]);

      const [result] = await conn.execute('DELETE FROM budget_proposals WHERE id = ?', [proposalId]);
      return result.affectedRows > 0;
    });
  }


  static async processApproval(proposalId, { role, decision, feedback, approverUserId, approverEmail }) {
    if (!['hod', 'dof', 'principal'].includes(role)) {
      throw new Error('Invalid role');
    }
    if (!['approved', 'rejected', 'returned'].includes(decision)) {
      throw new Error('Invalid decision');
    }

    const proposal = await this.getBudgetById(proposalId);
    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.current_stage !== role) {
      throw new Error(`Stage mismatch: expected ${role}, got ${proposal.current_stage}`);
    }

    // Determine next state
    let newStatus = decision;
    let nextStage = role;

    const flowStages = normalizeText(proposal.approval_flow).split('_');
    const requiresPrincipalStage = flowStages.includes('principal');
    const flow = APPROVAL_FLOW[role];

    if (decision === 'approved') {
      newStatus = flow.approve;
      nextStage = flow.next;

      // AUTO-APPROVAL LOGIC
      if (role === 'dof') {
        if (requiresPrincipalStage) {
          // If Principal is required, AUTO-APPROVE and finish
          newStatus = 'completed';
          nextStage = 'completed';
        } else {
          // If Principal is NOT required, just finish
          newStatus = 'completed';
          nextStage = 'completed';
        }
      }
      // Logic for final manual principal approval (if auto-approve fails/disabled)
      else if (role === 'principal') {
        newStatus = 'completed';
        nextStage = 'completed';
      }
    } else if (decision === 'rejected') {
      newStatus = flow.reject;
    } else {
      newStatus = flow.returned;
      nextStage = role; // Stay on current stage if returned
    }

    // Database Update
    return this.withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE budget_proposals 
             SET status = ?, current_stage = ?, updated_at = NOW() 
             WHERE id = ?`,
        [newStatus, nextStage, proposalId]
      );

      if (decision !== 'approved' && !normalizeText(feedback)) {
        throw new Error('Feedback required for reject/return');
      }

      // 1. Insert the ACTUAL approval (DoF/HOD/Principal)
      await conn.execute(
        `INSERT INTO budget_proposal_approvals (
                budget_proposal_id, role, approver_user_id, approver_email, 
                decision, feedback, allows_edit
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          proposalId,
          role,
          approverUserId,
          approverEmail || '',
          decision,
          feedback || '',
          decision === 'returned' ? 1 : 0,
        ]
      );

      // 2. Insert AUTO-APPROVAL for Principal (Only if DoF Approved + Principal Required)
      if (role === 'dof' && decision === 'approved' && requiresPrincipalStage) {
        await conn.execute(
          `INSERT INTO budget_proposal_approvals (
                    budget_proposal_id, role, approver_user_id, approver_email, 
                    decision, feedback, allows_edit, decided_at
                ) VALUES (?, 'principal', ?, ?, 'approved', 'Auto-approved after DoF clearance', 0, NOW())`,
          [proposalId, approverUserId, 'system-auto@ksrct.ac.in']
        );
      }
    });
  }


  static async listBudgets({
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
  }) {
    const pPage = Number.parseInt(page, 10) || 1;
    const pLimit = Number.parseInt(limit, 10) || 10;
    const pOffset = (pPage - 1) * pLimit;
    const currentFY = Number.parseInt(fiscalYear, 10) || this.getCurrentFinancialYear();

    let sql = `
      SELECT SQL_CALC_FOUND_ROWS
        bp.id,
        bp.proposal_ref,
        bp.fiscal_year,
        bp.employee_id,
        bp.user_id,
        MAX(bp.user_email) AS user_email,
        COALESCE(
          NULLIF(TRIM(MAX(CONCAT(req_emp.first_name, ' ', COALESCE(req_emp.last_name, '')))), ''),
          NULLIF(TRIM(MAX(u.name)), ''),
          NULLIF(TRIM(MAX(bp.user_email)), '')
        ) AS applicant_name,
        MAX(CONCAT(req_emp.first_name, ' ', COALESCE(req_emp.last_name, ''))) AS faculty_name,
        MAX(u.name) AS user_name,
        DATE_FORMAT(bp.request_date, '%Y-%m-%d') AS request_date,
        bp.beneficiary_type,
        bp.beneficiary_value,
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
        bp.status,
        bp.current_stage,
        bp.approval_flow,
        DATE_FORMAT(bp.created_at, '%Y-%m-%d %H:%i') AS created_date,
        COUNT(DISTINCT bpl.id) AS line_count,
        COUNT(DISTINCT bpa.id) AS approval_count
      FROM budget_proposals bp
      LEFT JOIN master_departments md ON bp.department_id = md.id
      LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
      LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
      LEFT JOIN master_employees req_emp ON bp.user_id = req_emp.user_id AND req_emp.status = 'Active'
      LEFT JOIN users u ON bp.user_id = u.id
      LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      LEFT JOIN budget_proposal_approvals bpa ON bp.id = bpa.budget_proposal_id
      LEFT JOIN master_entity_contacts mec ON me.id = mec.entity_id
    `;

    const where = ['bp.fiscal_year = ?'];
    const params = [Number(currentFY)];
    const safeRole = this.normalizeBudgetRole(role);
    const isQueueSuperAdminView = Boolean(superAdminQueueView) && ['hod', 'coordinator', 'dof', 'principal'].includes(safeRole);

    switch (safeRole) {
      case 'hod': {
        const departmentBeneficiaryPredicate = "LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'department')";
        where.push(departmentBeneficiaryPredicate);

        if (!isQueueSuperAdminView) {
          where.push('md.type = "Academic"');
          // Action Queue Filter for regular HODs
          where.push('(bp.current_stage = "hod" OR (bp.status LIKE "hod_%" AND bp.status != "completed"))');

          const normalizedDepartment = normalizeText(department);
          const hodScope = [];

          if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
            hodScope.push('bp.department_id = ?');
            params.push(Number(departmentId));
          }

          if (normalizedDepartment) {
            hodScope.push(`(
              LOWER(TRIM(md.name)) = LOWER(TRIM(?))
              OR LOWER(TRIM(md.code)) = LOWER(TRIM(?))
              OR LOWER(TRIM(bp.beneficiary_value)) = LOWER(TRIM(?))
            )`);
            params.push(normalizedDepartment, normalizedDepartment, normalizedDepartment);
          }

          if (!hodScope.length) {
            where.push('1 = 0');
          } else {
            where.push(`(${hodScope.join(' OR ')})`);
          }
        }
        break;
      }
      case 'coordinator': {
        // Coordinator Tab: Centres, Cells, Clubs, etc.
        const entityBeneficiaryPredicate = "LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'professional body')";
        where.push(entityBeneficiaryPredicate);

        if (!isQueueSuperAdminView) {
          // Action Queue Filter for regular Coordinators
          where.push('(bp.current_stage = "hod" OR (bp.status LIKE "hod_%" AND bp.status != "completed"))');

          if (userEmail) {
            where.push('LOWER(TRIM(mec.email)) = LOWER(TRIM(?))');
            params.push(userEmail);
          } else {
            where.push('1 = 0');
          }
        }
        break;
      }
      case 'dof': {
        if (isQueueSuperAdminView) {
          where.push('bp.current_stage = "dof"');
        } else {
          // Finance Queue: Needs action OR I already acted on it
          where.push('(bp.current_stage = "dof" OR (bp.status LIKE "dof_%" AND bp.status != "completed"))');
        }
        break;
      }
      case 'principal': {
        if (isQueueSuperAdminView) {
          where.push('bp.current_stage = "principal"');
        } else {
          // Principal Queue: Needs action OR I already acted on it
          where.push('(bp.current_stage = "principal" OR (bp.status LIKE "principal_%" AND bp.status != "completed"))');
        }
        break;
      }
      case 'admin':
      case 'super_admin': {
        // Audit Queue: Big Picture (Show everything)
        break;
      }
      case 'user':
      default: {
        where.push('(bp.user_id = ? OR bp.user_email = ?)');
        params.push(Number(userId), normalizeText(userEmail));
        break;
      }
    }

    if (normalizeText(status)) {
      where.push('bp.status = ?');
      params.push(normalizeText(status));
    }

    if (normalizeText(departmentFilter)) {
      where.push('md.name = ?');
      params.push(normalizeText(departmentFilter));
    }

    if (normalizeText(q)) {
      const searchPattern = `%${normalizeText(q)}%`;
      where.push(`(
        bp.proposal_ref LIKE ?
        OR bp.beneficiary_value LIKE ?
        OR md.name LIKE ?
        OR me.name LIKE ?
        OR req_emp.first_name LIKE ?
        OR req_emp.last_name LIKE ?
      )`);
      params.push(
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
             LIMIT ? OFFSET ?`;

    params.push(Number(pLimit), Number(pOffset));

    const [rows] = await db.query(sql, params);
    const enrichedRows = await this.#attachLevel1AssignmentMetadata(rows);
    const [totalRows] = await db.query('SELECT FOUND_ROWS() AS total');

    return {
      budgets: enrichedRows,
      pagination: {
        total: Number(totalRows[0].total),
        page: pPage,
        limit: pLimit,
        pages: Math.ceil(Number(totalRows[0].total) / pLimit),
      },
    };
  }

  static #mapDecisionToStageState(decision) {
    const normalizedDecision = normalizeText(decision).toLowerCase();

    if (normalizedDecision === 'approved') {
      return 'approved';
    }

    if (normalizedDecision === 'rejected') {
      return 'rejected';
    }

    if (normalizedDecision === 'returned') {
      return 'returned';
    }

    return 'pending';
  }

  static async listSuperAdminFlowBudgets({
    page = 1,
    limit = 20,
    status,
    fiscalYear,
    q,
    department,
  }) {
    const budgetsResult = await this.listBudgets({
      role: 'super_admin',
      page,
      limit,
      status,
      fiscalYear,
      q,
      departmentFilter: department,
    });

    const budgets = Array.isArray(budgetsResult.budgets) ? budgetsResult.budgets : [];

    if (!budgets.length) {
      return {
        rows: [],
        pagination: budgetsResult.pagination,
      };
    }

    const proposalIds = budgets
      .map((budget) => Number(budget.id))
      .filter((proposalId) => Number.isInteger(proposalId) && proposalId > 0);

    let approvalRows = [];

    if (proposalIds.length > 0) {
      const [rows] = await db.query(
        `SELECT
           bpa.id,
           bpa.budget_proposal_id,
           bpa.role,
           bpa.decision,
           bpa.feedback,
           bpa.approver_email,
           bpa.approver_user_id,
           bpa.allows_edit,
           bpa.decided_at,
           DATE_FORMAT(bpa.decided_at, '%Y-%m-%d %H:%i') AS decided_at_formatted,
           CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS approver_name
         FROM budget_proposal_approvals bpa
         LEFT JOIN master_employees emp ON bpa.approver_user_id = emp.user_id AND emp.status = 'Active'
         WHERE bpa.budget_proposal_id IN (?)
         ORDER BY bpa.decided_at ASC, bpa.id ASC`,
        [proposalIds]
      );
      approvalRows = rows;
    }

    const approvalsByProposal = new Map();

    for (const approval of approvalRows) {
      const proposalId = Number(approval.budget_proposal_id);
      if (!approvalsByProposal.has(proposalId)) {
        approvalsByProposal.set(proposalId, []);
      }
      approvalsByProposal.get(proposalId).push(approval);
    }

    const level1AssigneeEmails = [
      ...new Set(
        budgets
          .map((budget) => normalizeText(budget.level1_assignee_email).toLowerCase())
          .filter((email) => email.length > 0)
      ),
    ];

    const level1AssigneeNameMap = new Map();

    if (level1AssigneeEmails.length > 0) {
      const [assigneeRows] = await db.query(
        `SELECT
           LOWER(TRIM(email)) AS email_key,
           CONCAT(first_name, ' ', COALESCE(last_name, '')) AS full_name
         FROM master_employees
         WHERE status = 'Active'
           AND LOWER(TRIM(email)) IN (?)`,
        [level1AssigneeEmails]
      );

      for (const assignee of assigneeRows) {
        const emailKey = normalizeText(assignee.email_key).toLowerCase();
        if (emailKey) {
          level1AssigneeNameMap.set(emailKey, normalizeText(assignee.full_name) || null);
        }
      }
    }

    const rows = budgets.map((budget) => {
      const proposalId = Number(budget.id);
      const proposalApprovals = approvalsByProposal.get(proposalId) || [];
      const approvalByRole = new Map();

      for (const approval of proposalApprovals) {
        const roleKey = normalizeText(approval.role).toLowerCase();
        if (roleKey) {
          approvalByRole.set(roleKey, approval);
        }
      }

      const flowStages = new Set(
        normalizeText(budget.approval_flow)
          .split('_')
          .map((stage) => normalizeText(stage).toLowerCase())
          .filter(Boolean)
      );
      const currentStage = normalizeText(budget.current_stage).toLowerCase();
      const currentStageIndex = WORKFLOW_STAGES.indexOf(currentStage);

      const buildStage = (stageKey) => {
        const stageIndex = WORKFLOW_STAGES.indexOf(stageKey);
        const requiresStage = flowStages.has(stageKey);
        const approval = approvalByRole.get(stageKey) || null;
        const stageStatusToken = `${stageKey}_approved`;

        let state = 'pending';

        if (!requiresStage) {
          state = 'not_required';
        } else if (approval) {
          state = this.#mapDecisionToStageState(approval.decision);
        } else if (
          stageKey === 'hod' &&
          budget.level1_assignment_status === LEVEL1_ASSIGNMENT_STATUS.unassigned
        ) {
          state = 'unassigned';
        } else if (currentStage === stageKey) {
          state = 'pending';
        } else if (
          currentStage === 'completed' ||
          (currentStageIndex >= 0 && stageIndex >= 0 && currentStageIndex > stageIndex) ||
          normalizeText(budget.status).toLowerCase().includes(stageStatusToken)
        ) {
          state = 'approved';
        }

        let approverEmail = approval?.approver_email
          ? normalizeText(approval.approver_email).toLowerCase()
          : null;
        let approverName = normalizeText(approval?.approver_name) || null;

        if (!approval && stageKey === 'hod' && budget.level1_assignee_email) {
          approverEmail = normalizeText(budget.level1_assignee_email).toLowerCase();
          approverName = level1AssigneeNameMap.get(approverEmail) || null;
        }

        return {
          state,
          decision: approval?.decision || null,
          approverName,
          approverEmail,
          decidedAt: approval?.decided_at_formatted || approval?.decided_at || null,
          isAuto: stageKey === 'principal' && approverEmail === 'system-auto@ksrct.ac.in',
        };
      };

      return {
        proposalId,
        proposalRef: budget.proposal_ref,
        fiscalYear: budget.fiscal_year,
        facultyName: normalizeText(budget.faculty_name) || null,
        requesterEmail: normalizeText(budget.user_email).toLowerCase() || null,
        beneficiaryType: budget.beneficiary_type,
        beneficiaryValue: budget.beneficiary_value,
        department: budget.department,
        totalAmount: Number(budget.total_amount || 0),
        status: budget.status,
        currentStage: budget.current_stage,
        approvalFlow: budget.approval_flow,
        createdDate: budget.created_date,
        level1_route_type: budget.level1_route_type || null,
        level1_assignee_email: budget.level1_assignee_email || null,
        level1_assignment_status: budget.level1_assignment_status || LEVEL1_ASSIGNMENT_STATUS.assigned,
        hod: buildStage('hod'),
        financeAdmin: buildStage('dof'),
        principal: buildStage('principal'),
      };
    });

    return {
      rows,
      pagination: budgetsResult.pagination,
    };
  }


  static async dashboardAggregates({ department, departmentId, role, fiscalYear }) {
    const currentFY = Number.parseInt(fiscalYear, 10) || this.getCurrentFinancialYear();
    const params = [currentFY];
    const where = ['bp.fiscal_year = ?'];

    if (this.normalizeBudgetRole(role) === 'hod') {
      if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0) {
        where.push('bp.department_id = ?');
        params.push(Number(departmentId));
      } else if (normalizeText(department)) {
        const departmentRow = await this.getDepartmentByName(department);
        if (departmentRow) {
          where.push('bp.department_id = ?');
          params.push(Number(departmentRow.id));
        } else {
          where.push('1 = 0');
        }
      } else {
        where.push('1 = 0');
      }
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const approvedSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) AS amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
        AND bp.status IN ('dof_approved', 'principal_approved', 'completed')
      GROUP BY bpl.budget_head
    `;

    const pendingSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) AS amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
        AND bp.status IN ('submitted', 'hod_approved')
      GROUP BY bpl.budget_head
    `;

    const [[approvedRows], [pendingRows]] = await Promise.all([
      db.execute(approvedSql, params),
      db.execute(pendingSql, params),
    ]);

    return {
      approved: approvedRows,
      pending: pendingRows,
      summary: {
        totalApproved: approvedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        totalPending: pendingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      },
    };
  }

  /* =====================================================
     8. ORG UNIT / ENTITY HELPERS
  ===================================================== */
  static async getDepartments() {
    const [rows] = await db.execute(
      `SELECT id, code, name, is_active, sort_order
       FROM master_departments
       WHERE is_active = 1 AND type = 'Academic'
       ORDER BY sort_order ASC, name ASC`
    );

    return rows;
  }

  static async getEntitiesByType(typeCode) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!normalizedTypeCode || normalizedTypeCode === 'DEPARTMENT') {
      return [];
    }

    const [rows] = await db.execute(
      `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              me.sort_order,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE met.code = ?
         AND me.is_active = 1
       ORDER BY me.sort_order ASC, me.name ASC`,
      [normalizedTypeCode]
    );

    return rows;
  }

  static async getOrgUnitsByType(typeCode) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (normalizedTypeCode === 'DEPARTMENT') {
      const departments = await this.getDepartments();

      return departments.map((department) => ({
        id: department.id,
        name: department.name,
        short_code: department.code,
        is_active: department.is_active,
        type_code: 'DEPARTMENT',
        type_name: 'Department',
      }));
    }

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const entities = await this.getEntitiesByType(normalizedTypeCode);

    return entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      short_code: entity.code,
      is_active: entity.is_active,
      type_code: entity.type_code,
      type_name: entity.type_name,
    }));
  }

  static async getAllOrgUnits() {
    const departments = await this.getDepartments();

    const [entityRows] = await db.execute(
      `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.is_active = 1
       ORDER BY met.name ASC, me.sort_order ASC, me.name ASC`
    );

    const departmentRows = departments.map((department) => ({
      id: department.id,
      name: department.name,
      short_code: department.code,
      is_active: department.is_active,
      type_code: 'DEPARTMENT',
      type_name: 'Department',
    }));

    const mappedEntities = entityRows.map((entity) => ({
      id: entity.id,
      name: entity.name,
      short_code: entity.code,
      is_active: entity.is_active,
      type_code: entity.type_code,
      type_name: entity.type_name,
    }));

    return [...departmentRows, ...mappedEntities];
  }

  static async getOrgUnitEmails(orgUnitId) {
    const [rows] = await db.execute(
      `SELECT id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id = ?
       ORDER BY is_primary DESC, role ASC`,
      [orgUnitId]
    );

    return rows;
  }

  static async #getEntityById(conn, entityId) {
    const [rows] = await conn.execute(
      `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              me.sort_order,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.id = ?
       LIMIT 1`,
      [entityId]
    );

    return rows[0] || null;
  }

  static async #assertEntityInType(conn, typeCode, entityId) {
    const [rows] = await conn.execute(
      `SELECT me.id,
              me.code,
              me.name,
              me.is_active,
              me.sort_order,
              met.code AS type_code,
              met.name AS type_name
       FROM master_entities me
       JOIN master_entity_types met ON me.entity_type_id = met.id
       WHERE me.id = ? AND met.code = ?
       LIMIT 1`,
      [entityId, typeCode]
    );

    if (!rows.length) {
      throw new Error('Entity not found for the requested type');
    }

    return rows[0];
  }

  static async createEntity(typeCode, payload) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const name = normalizeText(payload?.name);

    if (!name) {
      throw new Error('name is required');
    }

    const code = normalizeText(payload?.code) || null;
    const sortOrder = Number.isFinite(Number(payload?.sort_order)) ? Number(payload.sort_order) : 0;
    const isActive = payload?.is_active === undefined ? 1 : payload.is_active ? 1 : 0;

    return this.withTransaction(async (conn) => {
      const [typeRows] = await conn.execute(
        'SELECT id FROM master_entity_types WHERE code = ? LIMIT 1',
        [normalizedTypeCode]
      );

      if (!typeRows.length) {
        throw new Error('Entity type not found');
      }

      const [insertResult] = await conn.execute(
        `INSERT INTO master_entities (entity_type_id, code, name, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [typeRows[0].id, code, name, isActive, sortOrder]
      );

      return this.#getEntityById(conn, insertResult.insertId);
    });
  }

  static async updateEntity(typeCode, entityId, payload) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const parsedEntityId = Number(entityId);

    if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw new Error('Invalid entity id');
    }

    return this.withTransaction(async (conn) => {
      const existing = await this.#assertEntityInType(conn, normalizedTypeCode, parsedEntityId);

      const nextName =
        payload?.name !== undefined ? normalizeText(payload.name) : normalizeText(existing.name);
      const nextCode =
        payload?.code !== undefined ? normalizeText(payload.code) || null : existing.code || null;
      const nextSortOrder =
        payload?.sort_order !== undefined && Number.isFinite(Number(payload.sort_order))
          ? Number(payload.sort_order)
          : Number(existing.sort_order || 0);
      const nextIsActive =
        payload?.is_active !== undefined ? (payload.is_active ? 1 : 0) : existing.is_active ? 1 : 0;

      if (!nextName) {
        throw new Error('name is required');
      }

      await conn.execute(
        `UPDATE master_entities
         SET code = ?,
             name = ?,
             is_active = ?,
             sort_order = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [nextCode, nextName, nextIsActive, nextSortOrder, parsedEntityId]
      );

      return this.#getEntityById(conn, parsedEntityId);
    });
  }

  static async deleteEntity(typeCode, entityId) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const parsedEntityId = Number(entityId);

    if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw new Error('Invalid entity id');
    }

    return this.withTransaction(async (conn) => {
      await this.#assertEntityInType(conn, normalizedTypeCode, parsedEntityId);
      const [result] = await conn.execute('DELETE FROM master_entities WHERE id = ?', [parsedEntityId]);
      return result.affectedRows > 0;
    });
  }

  static async getEntityContacts(typeCode, entityId) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const parsedEntityId = Number(entityId);

    if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw new Error('Invalid entity id');
    }

    await this.#assertEntityInType(db, normalizedTypeCode, parsedEntityId);

    const [rows] = await db.execute(
      `SELECT id, role, email, is_primary
       FROM master_entity_contacts
       WHERE entity_id = ?
       ORDER BY is_primary DESC, role ASC, email ASC`,
      [parsedEntityId]
    );

    return rows;
  }

  static async updateEntityContacts(typeCode, entityId, contacts = []) {
    const normalizedTypeCode = this.normalizeEntityTypeCode(typeCode);

    if (!['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(normalizedTypeCode)) {
      throw new Error('Invalid entity type code');
    }

    const parsedEntityId = Number(entityId);

    if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw new Error('Invalid entity id');
    }

    const normalizedContacts = (Array.isArray(contacts) ? contacts : [])
      .map((contact) => ({
        role: ['office', 'hod', 'finance', 'generic'].includes(normalizeText(contact?.role).toLowerCase())
          ? normalizeText(contact.role).toLowerCase()
          : 'office',
        email: normalizeText(contact?.email).toLowerCase(),
        is_primary: contact?.is_primary ? 1 : 0,
      }))
      .filter((contact) => contact.email.length > 0);

    return this.withTransaction(async (conn) => {
      await this.#assertEntityInType(conn, normalizedTypeCode, parsedEntityId);

      await conn.execute('DELETE FROM master_entity_contacts WHERE entity_id = ?', [parsedEntityId]);

      for (const contact of normalizedContacts) {
        await conn.execute(
          `INSERT INTO master_entity_contacts (entity_id, role, email, is_primary)
           VALUES (?, ?, ?, ?)`,
          [parsedEntityId, contact.role, contact.email, contact.is_primary]
        );
      }

      const [rows] = await conn.execute(
        `SELECT id, role, email, is_primary
         FROM master_entity_contacts
         WHERE entity_id = ?
         ORDER BY is_primary DESC, role ASC, email ASC`,
        [parsedEntityId]
      );

      return rows;
    });
  }

  static async #insertBudgetLine(proposalId, line, conn) {
    const [result] = await conn.execute(
      `INSERT INTO budget_proposal_lines (
        budget_proposal_id,
        budget_head,
        sub_head,
        unit_amount,
        quantity,
        line_total,
        line_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        line.budget_head,
        line.sub_head || '',
        Number(line.unit_amount) || 0,
        Number(line.quantity) || 1,
        (Number(line.unit_amount) || 0) * (Number(line.quantity) || 1),
        line.line_description || '',
      ]
    );

    return result.insertId;
  }

  static async #insertMonthAllocation(lineId, month, amount, conn) {
    await conn.execute(
      'INSERT INTO budget_line_month_allocations (budget_line_id, month, amount) VALUES (?, ?, ?)',
      [lineId, month, Number(amount) || 0]
    );
  }

  static async getBudgetById(proposalId) {
    const [rows] = await db.execute(
      `SELECT 
              bp.*, 
              DATE_FORMAT(bp.request_date, '%Y-%m-%d') AS request_date,
              md.name AS department, 
              md.code AS department_code,
              me.name AS org_unit_name, 
              me.code AS org_unit_code,
              met.name AS org_unit_type,
              met.code AS org_unit_type_code,
              -- ✅ FETCH MISSING FIELDS FROM EMPLOYEE TABLE
              emp.designation,
              emp.designation AS user_designation,
              emp.mobile,
              emp.mobile AS user_mobile,
              COALESCE(emp_parent_dept.name, emp_parent_dept_fallback.name, emp_dept.name) AS user_department,
              COALESCE(emp_parent_dept.name, emp_parent_dept_fallback.name, emp_dept.name) AS applicant_department,
              CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS user_name,
              CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, '')) AS name
          FROM budget_proposals bp
          LEFT JOIN master_departments md ON bp.department_id = md.id
          LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
          LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
          -- ✅ ADD THIS JOIN TO GET THE DATA
          LEFT JOIN master_employees emp ON bp.user_id = emp.user_id 
          LEFT JOIN master_departments emp_dept ON emp.department_id = emp_dept.id
          LEFT JOIN master_departments emp_parent_dept ON emp.parent_department_id = emp_parent_dept.id
          LEFT JOIN master_departments emp_parent_dept_fallback ON emp_dept.parent_id = emp_parent_dept_fallback.id
          WHERE bp.id = ?`,
      [proposalId]
    );

    return rows[0] || null;
  }

  static async validateUserAccess(proposalId, userId, userEmail, role, department, departmentId) {
    const proposal = await this.getBudgetById(proposalId);

    if (!proposal) {
      return false;
    }

    const uid = Number(userId);
    const pid = Number(proposal.user_id);
    const normalizedRole = this.normalizeBudgetRole(role);

    const emailMatch =
      proposal.user_email &&
      userEmail &&
      normalizeText(proposal.user_email).toLowerCase() === normalizeText(userEmail).toLowerCase();

    switch (normalizedRole) {
      case 'user':
        return pid === uid || emailMatch;

      case 'hod': {
        const level1Route = this.resolveLevel1Route(proposal);

        if (level1Route.routeType === LEVEL1_ROUTE_TYPE.entityContact) {
          return false;
        }

        const normalizedDepartment = normalizeText(department).toLowerCase();

        if (Number.isInteger(Number(departmentId)) && Number(departmentId) > 0 && proposal.department_id) {
          return Number(proposal.department_id) === Number(departmentId);
        }

        if (normalizedDepartment) {
          const proposalDepartmentName = normalizeText(proposal.department).toLowerCase();
          const proposalDepartmentCode = normalizeText(proposal.department_code).toLowerCase();
          const proposalBeneficiaryValue = normalizeText(proposal.beneficiary_value).toLowerCase();
          const proposalBeneficiaryType = normalizeBeneficiaryType(proposal.beneficiary_type).toLowerCase();

          if (
            proposalDepartmentName === normalizedDepartment ||
            proposalDepartmentCode === normalizedDepartment
          ) {
            return true;
          }

          if (
            proposalBeneficiaryType === 'department' &&
            proposalBeneficiaryValue === normalizedDepartment
          ) {
            return true;
          }
        }

        return false;
      }

      case 'dof':
      case 'principal':
      case 'admin':
      case 'super_admin':
        return true;

      default:
        return pid === uid || emailMatch;
    }
  }

  static async getApprovalFlowConfigs() {
    const [rows] = await db.execute(
      `SELECT afc.*, met.name AS entity_type_name
       FROM approval_flow_config afc
       LEFT JOIN master_entity_types met ON afc.entity_type_code = met.code
       WHERE afc.is_active = 1
       ORDER BY afc.beneficiary_type, met.name`
    );

    return rows;
  }

  static async updateApprovalFlowConfig(id, { requiresHod, requiresDof, requiresPrincipal }) {
    const [result] = await db.execute(
      `UPDATE approval_flow_config
       SET requires_hod = ?,
           requires_dof = ?,
           requires_principal = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [requiresHod, requiresDof, requiresPrincipal, id]
    );

    return result.affectedRows > 0;
  }

  static async getBudgetStatsByFY(fiscalYear) {
    const fy = Number.parseInt(fiscalYear, 10) || this.getCurrentFinancialYear();

    const [stats] = await db.execute(
      `SELECT
         COUNT(DISTINCT bp.id) AS total_proposals,
         SUM(bp.total_amount) AS total_amount,
         COUNT(DISTINCT CASE WHEN bp.status LIKE '%_approved' THEN bp.id END) AS approved_count,
         SUM(CASE WHEN bp.status LIKE '%_approved' THEN bp.total_amount ELSE 0 END) AS approved_amount,
         COUNT(DISTINCT CASE WHEN bp.status = 'submitted' THEN bp.id END) AS pending_count,
         SUM(CASE WHEN bp.status = 'submitted' THEN bp.total_amount ELSE 0 END) AS pending_amount,
         COUNT(DISTINCT CASE WHEN bp.status LIKE '%_rejected' THEN bp.id END) AS rejected_count
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ?`,
      [fy]
    );

    const [byDepartment] = await db.execute(
      `SELECT
         md.name AS department,
         COUNT(*) AS proposal_count,
         SUM(bp.total_amount) AS total_amount
       FROM budget_proposals bp
       LEFT JOIN master_departments md ON bp.department_id = md.id
       WHERE bp.fiscal_year = ? AND bp.department_id IS NOT NULL
       GROUP BY md.name
       ORDER BY total_amount DESC`,
      [fy]
    );

    const [byBeneficiary] = await db.execute(
      `SELECT
         bp.beneficiary_type,
         COUNT(*) AS proposal_count,
         SUM(bp.total_amount) AS total_amount
       FROM budget_proposals bp
       WHERE bp.fiscal_year = ?
       GROUP BY bp.beneficiary_type
       ORDER BY proposal_count DESC`,
      [fy]
    );

    return {
      overall: stats[0],
      byDepartment,
      byBeneficiaryType: byBeneficiary,
    };
  }

  static async getMonthlyAllocations(proposalId) {
    const [rows] = await db.execute(
      `SELECT
         m.month,
         SUM(m.amount) AS total_amount,
         COUNT(DISTINCT l.id) AS line_count
       FROM budget_line_month_allocations m
       JOIN budget_proposal_lines l ON m.budget_line_id = l.id
       WHERE l.budget_proposal_id = ?
       GROUP BY m.month
       ORDER BY FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})`,
      [proposalId]
    );

    return rows;
  }

  static async getProposalDataForExport(proposalId) {
    const master = await this.getBudgetById(proposalId);

    if (!master) {
      return null;
    }

    const [lines] = await db.execute(
      `SELECT bpl.*,
              GROUP_CONCAT(
                CONCAT(m.month, ':', m.amount)
                ORDER BY FIELD(m.month, ${VALID_MONTHS.map((month) => `'${month}'`).join(',')})
                SEPARATOR '|'
              ) AS month_allocations_str
       FROM budget_proposal_lines bpl
       LEFT JOIN budget_line_month_allocations m ON bpl.id = m.budget_line_id
       WHERE bpl.budget_proposal_id = ?
       GROUP BY bpl.id`,
      [proposalId]
    );

    const [approvals] = await db.execute(
      `SELECT role,
              decision,
              feedback,
              approver_email,
              DATE_FORMAT(decided_at, '%Y-%m-%d %H:%i:%s') AS decided_at
       FROM budget_proposal_approvals
       WHERE budget_proposal_id = ?
       ORDER BY decided_at`,
      [proposalId]
    );

    return {
      master,
      lines,
      approvals,
    };
  }
}

export default BudgetModel;
