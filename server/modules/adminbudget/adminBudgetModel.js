import db from '../../config/connection.js';

const VALID_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const APPROVAL_FLOW = {
  level1: { approve: 'level1_approved', reject: 'level1_rejected', returned: 'level1_returned', next: 'dof' },
  dof: { approve: 'dof_approved', reject: 'dof_rejected', returned: 'dof_returned', next: 'principal' },
  principal: { approve: 'principal_approved', reject: 'principal_rejected', next: 'completed' },
};

const EDITABLE_STATES = ['draft', 'submitted', 'level1_returned', 'dof_returned', 'principal_returned'];

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
const WORKFLOW_STAGES = Object.freeze(['level1', 'dof', 'principal']);

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

const formatApprovalFlowString = ({ requiresLevel1, requiresDof, requiresPrincipal }) => {
  const stages = [];

  if (requiresLevel1) stages.push('level1');
  if (requiresDof) stages.push('dof');
  if (requiresPrincipal) stages.push('principal');

  return stages.length > 0 ? stages.join('_') : 'dof_principal';
};

class AdminBudgetModel {

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
      return { requiresLevel1: 0, requiresDof: 1, requiresPrincipal: 1 };
    }

    const [rows] = entityTypeCode
      ? await conn.execute(
        `SELECT requires_level1, requires_dof, requires_principal
           FROM approval_flow_config
           WHERE beneficiary_type = ?
             AND entity_type_code = ?
             AND module IN ('BUDGET', 'BOTH')
             AND is_active = 1
           LIMIT 1`,
        [normalizedBeneficiaryType, entityTypeCode]
      )
      : await conn.execute(
        `SELECT requires_level1, requires_dof, requires_principal
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
        requiresLevel1: Number(rows[0].requires_level1) ? 1 : 0,
        requiresDof: Number(rows[0].requires_dof) ? 1 : 0,
        requiresPrincipal: Number(rows[0].requires_principal) ? 1 : 0,
      }
      : ['Faculty', 'Department'].includes(normalizedBeneficiaryType)
        ? { requiresLevel1: 1, requiresDof: 1, requiresPrincipal: 1 }
        : { requiresLevel1: 0, requiresDof: 1, requiresPrincipal: 1 };

    // Entity beneficiaries must always pass through Level 1 before DoF/Principal.
    if (this.isEntityBeneficiaryType(normalizedBeneficiaryType)) {
      resolvedFlow.requiresLevel1 = 1;
    }

    return resolvedFlow;
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
          stageKey === 'level1' &&
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

        if (!approval && stageKey === 'level1' && budget.level1_assignee_email) {
          approverEmail = normalizeText(budget.level1_assignee_email).toLowerCase();
          approverName = level1AssigneeNameMap.get(approverEmail) || null;
        }

        return {
          state,
          decision: approval?.decision || null,
          approverName,
          approverEmail,
          label: this.resolveStageLabel(stageKey, budget),
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
        level1: buildStage('level1'),
        financeAdmin: buildStage('dof'),
        principal: buildStage('principal'),
      };
    });

    return {
      rows,
      pagination: budgetsResult.pagination,
    };
  }


  static resolveStageLabel(stageKey, proposal = {}) {
    const key = normalizeText(stageKey).toLowerCase();
    const beneficiaryType = normalizeText(proposal?.beneficiary_type);

    if (key === 'level1') {
      if (['Faculty', 'Department'].includes(beneficiaryType)) {
        return 'HOD';
      }
      if (this.isEntityBeneficiaryType(beneficiaryType)) {
        return 'Coordinator';
      }
      return 'Level-1';
    }

    if (key === 'dof') return 'Finance';
    if (key === 'principal') return 'Principal';
    if (key === 'completed') return 'Completed';

    return stageKey;
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
        AND bp.status IN ('level1_approved', 'dof_approved', 'principal_approved', 'completed')
      GROUP BY bpl.budget_head
    `;

    const pendingSql = `
      SELECT bpl.budget_head, SUM(bpl.line_total) AS amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
      ${whereClause}
        AND bp.status IN ('submitted', 'level1_approved')
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

  static async updateApprovalFlowConfig(id, { requiresLevel1, requiresDof, requiresPrincipal }) {
    const [result] = await db.execute(
      `UPDATE approval_flow_config
       SET requires_level1 = ?,
           requires_dof = ?,
           requires_principal = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [requiresLevel1, requiresDof, requiresPrincipal, id]
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

export default AdminBudgetModel;
