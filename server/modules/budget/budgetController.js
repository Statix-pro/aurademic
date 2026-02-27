import BudgetModel from './budgetModel.js';

const VALID_BENEFICIARY_TYPES = [
  'Faculty',
  'Department',
  'Centre',
  'Cell',
  'Club',
  'Institution',
  'Professional Body',
  'Professional Bodies',
  'ProfessionalBodies',
];

const MUTABLE_ENTITY_TYPES = new Set(['CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY']);
const BUDGET_PERMISSIONS = Object.freeze({
  proposalManage: 'budget.proposal.manage',
  workflowLevel1: 'budget.workflow.level1',
  workflowDof: 'budget.workflow.dof',
  workflowPrincipal: 'budget.workflow.principal',
  adminView: 'budget.admin.view',
  adminManage: 'budget.admin.manage',
});

const WORKFLOW_STAGE_PERMISSION = Object.freeze({
  level1: BUDGET_PERMISSIONS.workflowLevel1,
  dof: BUDGET_PERMISSIONS.workflowDof,
  principal: BUDGET_PERMISSIONS.workflowPrincipal,
});

const BUDGET_SCOPE_PERMISSIONS = Object.freeze([
  { permission: BUDGET_PERMISSIONS.adminManage, role: 'admin' },
  { permission: BUDGET_PERMISSIONS.adminView, role: 'admin' },
  { permission: BUDGET_PERMISSIONS.workflowPrincipal, role: 'principal' },
  { permission: BUDGET_PERMISSIONS.workflowDof, role: 'dof' },
  { permission: BUDGET_PERMISSIONS.workflowLevel1, role: 'hod' },
  { permission: BUDGET_PERMISSIONS.proposalManage, role: 'user' },
]);

const normalizeText = (value) => String(value || '').trim();

const normalizeBeneficiaryType = (beneficiaryType) => {
  const normalized = normalizeText(beneficiaryType);
  if (normalized === 'ProfessionalBodies' || normalized === 'Professional Bodies') {
    return 'Professional Body';
  }
  return normalized;
};

class BudgetController {
  static getUserId(req) {
    return req.user?.id || req.user?.userId || null;
  }

  static isSuperAdmin(req) {
    if (!req?.user) {
      return false;
    }

    if (req.user.is_super_admin || req.user.isSuperAdmin) {
      return true;
    }

    const roleTokens = Array.isArray(req.user.roles) ? req.user.roles : [];
    return roleTokens.some((role) => normalizeText(role).toLowerCase() === 'super_admin');
  }

  static getPermissionSet(req) {
    const permissionTokens = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    return new Set(permissionTokens.map((token) => normalizeText(token)).filter(Boolean));
  }

  static hasPermission(req, permissionKey) {
    if (!permissionKey) return false;
    if (BudgetController.isSuperAdmin(req)) return true;
    return BudgetController.getPermissionSet(req).has(permissionKey);
  }

  static hasAnyPermission(req, permissionKeys = []) {
    const permissionSet = BudgetController.getPermissionSet(req);
    return permissionKeys.some((permissionKey) => permissionSet.has(permissionKey));
  }

  static resolveAccessRoleFromPermissions(req) {
    if (BudgetController.isSuperAdmin(req)) {
      return 'super_admin';
    }

    const permissionSet = BudgetController.getPermissionSet(req);

    for (const mapping of BUDGET_SCOPE_PERMISSIONS) {
      if (permissionSet.has(mapping.permission)) {
        return mapping.role;
      }
    }

    return 'user';
  }

  static normalizeEntityTypeParam(typeParam) {
    const normalized = BudgetModel.normalizeEntityTypeCode(typeParam);

    if (normalized === 'PROF_BODY') {
      return 'PROFESSIONAL_BODY';
    }

    return normalized;
  }

  static async resolveUserDepartment(req) {
    const requestDepartment = normalizeText(req.user?.department);

    if (requestDepartment) {
      return requestDepartment;
    }

    const userId = BudgetController.getUserId(req);
    const userEmail = normalizeText(req.user?.email);

    if (userId) {
      const departmentByUserId = await BudgetModel.getUserDepartmentByUserId(userId);
      if (departmentByUserId?.name) {
        return departmentByUserId.name;
      }
    }

    if (userEmail) {
      const departmentByEmail = await BudgetModel.getUserDepartmentByEmail(userEmail);
      if (departmentByEmail?.name) {
        return departmentByEmail.name;
      }
    }

    return null;
  }

  static async resolveUserDepartmentId(req) {
    const departmentName = await BudgetController.resolveUserDepartment(req);

    if (!departmentName) {
      return null;
    }

    const department = await BudgetModel.getDepartmentByName(departmentName);
    return department ? Number(department.id) : null;
  }

  static async resolveSubmissionDepartment(req, beneficiaryType, payload = {}) {
    const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
    const userDepartment = await BudgetController.resolveUserDepartment(req);
    const parsedEmployeeId = Number.parseInt(payload?.employee_id, 10);

    if (normalizedBeneficiaryType === 'Faculty') {
      if (Number.isInteger(parsedEmployeeId) && parsedEmployeeId > 0) {
        const employeeDepartment = await BudgetModel.getEmployeeDepartmentByEmployeeId(parsedEmployeeId);
        const resolvedFacultyDepartment = normalizeText(
          employeeDepartment?.parent_department_name || employeeDepartment?.name
        );

        if (resolvedFacultyDepartment) {
          return resolvedFacultyDepartment;
        }
      }

      if (!userDepartment) {
        throw new Error('Department not set for faculty user');
      }

      return userDepartment;
    }

    if (normalizedBeneficiaryType === 'Department') {
      return normalizeText(payload?.beneficiary_value) || null;
    }

    return userDepartment || null;
  }


  static async getFacultyDetails(req, res) {
    try {
      const userId = BudgetController.getUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // 1. Get rich employee data from DB (includes designation, mobile, full_name)
      const empData = await BudgetModel.getUserDepartmentByUserId(userId);

      // 2. Fallback to token data if DB data is missing
      const department =
        empData?.parent_department_name ||
        empData?.name ||
        await BudgetController.resolveUserDepartment(req);
      const role = BudgetController.resolveAccessRoleFromPermissions(req);

      return res.json({
        success: true,
        data: {
          employee_id: empData?.employee_id || userId,
          user_id: userId,
          // Use DB full_name if available, else token name
          name: empData?.full_name || req.user?.name || '',
          email: req.user?.email || '',
          department,
          // Pass these new fields to frontend
          designation: empData?.designation || '',
          mobile: empData?.mobile || '',
          role,
          roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
        },
      });
    } catch (error) {
      console.error('Faculty details error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch faculty details',
      });
    }
  }

  static async searchApplicant(req, res) {
    try {
      const { q } = req.query;
      const results = await BudgetModel.searchApplicant(q || '');

      return res.status(200).json({
        success: true,
        status: 'success',
        data: results,
      });
    } catch (error) {
      console.error('Budget applicant search error:', error);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: error.message || 'Failed to search applicants',
      });
    }
  }

  static async getOrgUnits(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);

      if (!['DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(mappedType)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid type. Must be: DEPARTMENT, CENTRE, CELL, CLUB, PROFESSIONAL_BODY (or PROF_BODY)',
        });
      }

      const units = await BudgetModel.getOrgUnitsByType(mappedType);

      return res.json({
        success: true,
        data: units,
        count: units.length,
      });
    } catch (error) {
      console.error('Get org units error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch org units',
      });
    }
  }

  static async getAllOrgUnits(req, res) {
    try {
      const units = await BudgetModel.getAllOrgUnits();

      const grouped = units.reduce((acc, unit) => {
        const key = unit.type_code;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(unit);
        return acc;
      }, {});

      return res.json({
        success: true,
        data: {
          all: units,
          grouped,
        },
        count: units.length,
      });
    } catch (error) {
      console.error('Get all org units error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch all org units',
      });
    }
  }

  static async getEntitiesByType(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);

      if (!['DEPARTMENT', ...MUTABLE_ENTITY_TYPES].includes(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type',
        });
      }

      const data = mappedType === 'DEPARTMENT'
        ? await BudgetModel.getDepartments()
        : await BudgetModel.getEntitiesByType(mappedType);

      return res.json({
        success: true,
        data,
        count: data.length,
      });
    } catch (error) {
      console.error('Get entities by type error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch entities',
      });
    }
  }

  static async createEntity(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);

      if (!MUTABLE_ENTITY_TYPES.has(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Only CENTRE, CELL, CLUB, and PROFESSIONAL_BODY are mutable via this API',
        });
      }

      const entity = await BudgetModel.createEntity(mappedType, req.body || {});

      return res.status(201).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error('Create entity error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create entity',
      });
    }
  }

  static async updateEntity(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);
      const entityId = Number.parseInt(req.params.id, 10);

      if (!MUTABLE_ENTITY_TYPES.has(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Only CENTRE, CELL, CLUB, and PROFESSIONAL_BODY are mutable via this API',
        });
      }

      if (!Number.isInteger(entityId) || entityId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity id',
        });
      }

      const entity = await BudgetModel.updateEntity(mappedType, entityId, req.body || {});

      return res.json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error('Update entity error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update entity',
      });
    }
  }

  static async deleteEntity(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);
      const entityId = Number.parseInt(req.params.id, 10);

      if (!MUTABLE_ENTITY_TYPES.has(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Only CENTRE, CELL, CLUB, and PROFESSIONAL_BODY are mutable via this API',
        });
      }

      if (!Number.isInteger(entityId) || entityId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity id',
        });
      }

      const deleted = await BudgetModel.deleteEntity(mappedType, entityId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Entity not found',
        });
      }

      return res.json({
        success: true,
        message: 'Entity deleted successfully',
      });
    } catch (error) {
      console.error('Delete entity error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete entity',
      });
    }
  }

  static async getEntityContacts(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);
      const entityId = Number.parseInt(req.params.id, 10);

      if (!MUTABLE_ENTITY_TYPES.has(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Contacts are available only for CENTRE, CELL, CLUB, and PROFESSIONAL_BODY',
        });
      }

      if (!Number.isInteger(entityId) || entityId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity id',
        });
      }

      const contacts = await BudgetModel.getEntityContacts(mappedType, entityId);

      return res.json({
        success: true,
        data: contacts,
      });
    } catch (error) {
      console.error('Get entity contacts error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch entity contacts',
      });
    }
  }

  static async updateEntityContacts(req, res) {
    try {
      const mappedType = BudgetController.normalizeEntityTypeParam(req.params.type);
      const entityId = Number.parseInt(req.params.id, 10);
      const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];

      if (!MUTABLE_ENTITY_TYPES.has(mappedType)) {
        return res.status(400).json({
          success: false,
          message: 'Contacts are editable only for CENTRE, CELL, CLUB, and PROFESSIONAL_BODY',
        });
      }

      if (!Number.isInteger(entityId) || entityId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity id',
        });
      }

      const updatedContacts = await BudgetModel.updateEntityContacts(mappedType, entityId, contacts);

      return res.json({
        success: true,
        data: updatedContacts,
      });
    } catch (error) {
      console.error('Update entity contacts error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to update contacts',
      });
    }
  }

  static async getApprovalFlows(req, res) {
    try {
      const configs = await BudgetModel.getApprovalFlowConfigs();

      return res.json({
        success: true,
        data: configs,
      });
    } catch (error) {
      console.error('Get approval flows error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch approval flow configs',
      });
    }
  }

  static async create(req, res) {
    try {
      const payload = req.body || {};
      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);

      if (!userId || !userEmail) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (!payload.fiscal_year || Number.isNaN(Number.parseInt(payload.fiscal_year, 10))) {
        return res.status(400).json({
          success: false,
          message: 'fiscal_year is required and must be a valid integer (e.g., 2026)',
        });
      }

      if (!payload.request_date || !payload.beneficiary_type) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: request_date, beneficiary_type',
        });
      }

      const normalizedBeneficiaryType = normalizeBeneficiaryType(payload.beneficiary_type);

      if (!VALID_BENEFICIARY_TYPES.includes(payload.beneficiary_type) && !VALID_BENEFICIARY_TYPES.includes(normalizedBeneficiaryType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid beneficiary_type: ${payload.beneficiary_type}. Valid: ${VALID_BENEFICIARY_TYPES.join(', ')}`,
        });
      }

      if (!payload.lines?.length) {
        return res.status(400).json({
          success: false,
          message: 'At least one budget line required',
        });
      }

      if (!['Faculty', 'Institution'].includes(normalizedBeneficiaryType) && !normalizeText(payload.beneficiary_value)) {
        return res.status(400).json({
          success: false,
          message: `beneficiary_value required for ${normalizedBeneficiaryType}`,
        });
      }

      for (let i = 0; i < payload.lines.length; i += 1) {
        const line = payload.lines[i];

        if (!line.budget_head || !line.unit_amount || !line.line_description) {
          return res.status(400).json({
            success: false,
            message: `Line ${i + 1}: budget_head, unit_amount, line_description required`,
          });
        }

        if (!line.month_allocations || Object.keys(line.month_allocations).length === 0) {
          return res.status(400).json({
            success: false,
            message: `Line ${i + 1}: month_allocations required`,
          });
        }
      }

      const resolvedDepartment = await BudgetController.resolveSubmissionDepartment(
        req,
        normalizedBeneficiaryType,
        payload
      );

      const result = await BudgetModel.create({
        ...payload,
        beneficiary_type: normalizedBeneficiaryType,
        fiscal_year: Number.parseInt(payload.fiscal_year, 10),
        user_id: userId,
        user_email: userEmail,
        employee_id: payload.employee_id || userId,
        department: resolvedDepartment,
      });

      return res.status(201).json({
        success: true,
        message: 'Budget proposal created successfully',
        data: {
          proposalId: result.proposalId,
          proposalRef: result.proposalRef,
          fiscalYear: result.fyYear,
          approvalFlow: result.approvalFlow,
          initialStage: result.initialStage,
          requiresLevel1: result.requiresLevel1,
          departmentId: result.departmentId,
          beneficiaryEntityId: result.beneficiaryEntityId,
        },
      });
    } catch (error) {
      console.error('Create budget error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to create budget proposal',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  static async update(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);
      const userRole = BudgetController.resolveAccessRoleFromPermissions(req);
      const isPrivileged = ['super_admin', 'admin', 'dof', 'principal'].includes(userRole);

      if (!isPrivileged) {
        const hasAccess = await BudgetModel.validateUserAccess(
          proposalId,
          userId,
          userEmail,
          userRole,
          userDepartment,
          userDepartmentId
        );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Access denied - cannot update this proposal',
          });
        }
      }

      const payload = req.body || {};
      const normalizedBeneficiaryType = payload.beneficiary_type
        ? normalizeBeneficiaryType(payload.beneficiary_type)
        : payload.beneficiary_type;
      const resolvedDepartment = await BudgetController.resolveSubmissionDepartment(
        req,
        normalizedBeneficiaryType,
        payload
      );

      if (!payload.lines?.length) {
        return res.status(400).json({
          success: false,
          message: 'At least one budget line required',
        });
      }

      await BudgetModel.update(proposalId, {
        ...payload,
        beneficiary_type: normalizedBeneficiaryType,
        department: resolvedDepartment,
      }, { skipEditStateValidation: isPrivileged });

      return res.json({
        success: true,
        message: 'Budget proposal updated successfully',
      });
    } catch (error) {
      console.error('Update budget error:', error);

      if (error.message.includes('Cannot edit')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.message.includes('required') ||
        error.message.includes('Invalid') ||
        error.message.includes('not set')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update budget',
      });
    }
  }

  static async deleteProposal(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({ success: false, message: 'Invalid proposal ID' });
      }

      const userId = BudgetController.getUserId(req);
      const isSuperAdmin = BudgetController.isSuperAdmin(req);
      const proposal = await BudgetModel.getBudgetById(proposalId);

      if (!proposal) {
        return res.status(404).json({ success: false, message: 'Proposal not found' });
      }

      if (!isSuperAdmin && Number(proposal.user_id) !== Number(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Only the creator can delete this proposal',
        });
      }

      const deletableStatuses = ['submitted', 'draft', 'level1_returned', 'dof_returned'];

      if (!isSuperAdmin && !deletableStatuses.includes(proposal.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete proposal in '${proposal.status}' status`,
        });
      }

      const deleted = await BudgetModel.delete(proposalId);

      if (!deleted) {
        throw new Error('Database delete failed');
      }

      return res.json({
        success: true,
        message: 'Budget proposal deleted successfully',
      });
    } catch (error) {
      console.error('Delete budget error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete proposal',
      });
    }
  }

  static async get(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const budget = await BudgetModel.getFull(proposalId);

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userRole = BudgetController.resolveAccessRoleFromPermissions(req);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - cannot view this proposal',
        });
      }

      return res.json({
        success: true,
        data: budget,
      });
    } catch (error) {
      console.error('Get budget error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch proposal',
      });
    }
  }

  static async getMyBudgets(req, res) {
    try {
      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);

      const budgets = await BudgetModel.listBudgets({
        userId,
        userEmail,
        role: 'user',
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: status || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('My budgets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch your budgets',
      });
    }
  }

  static async getHodBudgets(req, res) {
    try {
      const department = await BudgetController.resolveUserDepartment(req);
      const departmentId = await BudgetController.resolveUserDepartmentId(req);
      const userEmail = normalizeText(req.user?.email);
      const isSuperAdmin = BudgetController.isSuperAdmin(req);

      if (!isSuperAdmin && !department && !departmentId && !userEmail) {
        return res.status(400).json({
          success: false,
          message: 'HOD queue context unavailable',
        });
      }

      const { page = 1, limit = 10, status, fiscalYear } = req.query;

      const budgets = await BudgetModel.listBudgets({
        department,
        departmentId,
        userEmail,
        role: 'hod',
        superAdminQueueView: isSuperAdmin,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: status || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        department,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('HOD budgets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch HOD budgets',
      });
    }
  }

  static async getCoordinatorBudgets(req, res) {
    try {
      const userEmail = normalizeText(req.user?.email);
      const isSuperAdmin = BudgetController.isSuperAdmin(req);

      if (!isSuperAdmin && !userEmail) {
        return res.status(400).json({
          success: false,
          message: 'Coordinator queue context unavailable',
        });
      }

      const { page = 1, limit = 10, status, fiscalYear } = req.query;

      const budgets = await BudgetModel.listBudgets({
        userEmail,
        role: 'coordinator',
        superAdminQueueView: isSuperAdmin,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: status || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('Coordinator budgets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch coordinator budgets',
      });
    }
  }

  static async getDofBudgets(req, res) {
    try {
      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      const isSuperAdmin = BudgetController.isSuperAdmin(req);

      const budgets = await BudgetModel.listBudgets({
        role: 'dof',
        superAdminQueueView: isSuperAdmin,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: status || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('DoF budgets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch DoF budgets',
      });
    }
  }

  static async getPrincipalBudgets(req, res) {
    try {
      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      const isSuperAdmin = BudgetController.isSuperAdmin(req);

      const budgets = await BudgetModel.listBudgets({
        role: 'principal',
        superAdminQueueView: isSuperAdmin,
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: status || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('Principal budgets error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch Principal budgets',
      });
    }
  }

  static async getAggregates(req, res) {
    try {
      const { fiscalYear } = req.query;

      const aggregates = await BudgetModel.dashboardAggregates({
        role: 'admin',
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: aggregates,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('Aggregates error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch aggregates',
      });
    }
  }

  static async approve(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const { decision = 'approved', feedback } = req.body || {};

      if (!['approved', 'rejected', 'returned'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Decision must be: approved, rejected, returned',
        });
      }

      const proposal = await BudgetModel.getBudgetById(proposalId);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found',
        });
      }

      const currentStage = normalizeText(proposal.current_stage).toLowerCase();
      const requiredPermission = WORKFLOW_STAGE_PERMISSION[currentStage];
      const isSuperAdmin = BudgetController.isSuperAdmin(req);
      const level1Route = BudgetModel.resolveLevel1Route(proposal);

      if (!requiredPermission) {
        return res.status(400).json({
          success: false,
          message: `Proposal is not in an approvable stage: ${proposal.current_stage}`,
        });
      }

      if (!BudgetController.hasPermission(req, requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permission for ${currentStage.toUpperCase()} approval stage`,
        });
      }

      if (currentStage === 'level1' && level1Route.routeType === 'entity_contact') {
        const entityAssignee = await BudgetModel.resolveEntityLevel1Assignee(level1Route.entityId);

        if (!entityAssignee?.email && !isSuperAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Entity Level-1 contact is not configured. Super Admin approval required.',
          });
        }
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        isSuperAdmin ? 'super_admin' : currentStage,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - proposal not in your queue',
        });
      }

      await BudgetModel.processApproval(proposalId, {
        role: currentStage,
        decision,
        feedback: decision !== 'approved' ? feedback : undefined,
        approverUserId: userId,
        approverEmail: userEmail,
      });

      return res.json({
        success: true,
        message: `Proposal ${decision} successfully`,
        data: {
          decision,
          role: currentStage,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Approval error:', error);

      if (
        error.message.includes('Stage mismatch') ||
        error.message.includes('Feedback required') ||
        error.message.includes('expected')
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Approval processing failed',
      });
    }
  }

  static async adminList(req, res) {
    try {
      const { page = 1, limit = 20, status, fiscalYear } = req.query;

      const budgets = await BudgetModel.listBudgets({
        role: 'admin',
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        filters: {
          role: 'admin',
          fiscalYear: fiscalYear || BudgetModel.getCurrentFinancialYear(),
        },
      });
    } catch (error) {
      console.error('Admin list error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch admin budgets',
      });
    }
  }

  static async getSuperAdminFlowDashboard(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        fiscalYear,
        q,
        department,
      } = req.query;

      const result = await BudgetModel.listSuperAdminFlowBudgets({
        page: Number.parseInt(page, 10),
        limit: Number.parseInt(limit, 10),
        status: normalizeText(status) || undefined,
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
        q: normalizeText(q) || undefined,
        department: normalizeText(department) || undefined,
      });

      return res.json({
        success: true,
        data: result.rows,
        pagination: result.pagination,
        filters: {
          status: normalizeText(status) || undefined,
          fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : BudgetModel.getCurrentFinancialYear(),
          q: normalizeText(q) || undefined,
          department: normalizeText(department) || undefined,
        },
      });
    } catch (error) {
      console.error('Super admin flow dashboard error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch super admin budget flow dashboard',
      });
    }
  }

  static async search(req, res) {
    try {
      const { q, status, fiscalYear } = req.query;

      const budgets = await BudgetModel.listBudgets({
        userId: BudgetController.getUserId(req),
        userEmail: req.user?.email || '',
        role: 'admin',
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
        status,
        page: 1,
        limit: 100,
      });

      let results = budgets.budgets;

      if (q) {
        const query = String(q).toLowerCase();
        results = results.filter(
          (budget) =>
            budget.proposal_ref?.toLowerCase().includes(query) ||
            budget.beneficiary_value?.toLowerCase().includes(query) ||
            budget.department?.toLowerCase().includes(query) ||
            budget.org_unit_name?.toLowerCase().includes(query)
        );
      }

      return res.json({
        success: true,
        data: results,
        count: results.length,
        filters: req.query,
      });
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({
        success: false,
        message: 'Search failed',
      });
    }
  }

  static async uploadFiles(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);
      const accessRole = BudgetController.isSuperAdmin(req) ? 'super_admin' : 'user';

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        accessRole,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      return res.json({
        success: true,
        message: 'Files uploaded successfully',
        data: {
          proposalId,
          sanctionLetter: req.files?.sanctionLetter?.[0]
            ? {
              filename: req.files.sanctionLetter[0].originalname,
              path: req.files.sanctionLetter[0].path,
              size: req.files.sanctionLetter[0].size,
            }
            : null,
          attachments:
            req.files?.attachments?.map((file) => ({
              filename: file.originalname,
              path: file.path,
              size: file.size,
              mimetype: file.mimetype,
            })) || [],
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  static async getHistory(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userRole = BudgetController.resolveAccessRoleFromPermissions(req);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - cannot view history',
        });
      }

      const budget = await BudgetModel.getFull(proposalId);

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found',
        });
      }

      return res.json({
        success: true,
        data: {
          proposal: budget.master,
          approvals: budget.approvals,
          timeline: budget.approvals.map((approval) => ({
            stage: approval.role,
            decision: approval.decision,
            feedback: approval.feedback,
            timestamp: approval.decided_at_formatted || approval.decided_at,
            approver: approval.approver_email,
            allowsEdit: approval.allows_edit,
          })),
        },
      });
    } catch (error) {
      console.error('Get history error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch proposal history',
      });
    }
  }

  static async getMonthAllocations(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userRole = BudgetController.resolveAccessRoleFromPermissions(req);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - cannot view allocations',
        });
      }

      const allocations = await BudgetModel.getMonthlyAllocations(proposalId);

      return res.json({
        success: true,
        data: allocations,
      });
    } catch (error) {
      console.error('Get allocations error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch month allocations',
      });
    }
  }

  static async export(req, res) {
    try {
      const { fiscalYear, status, format = 'csv' } = req.query;

      const budgets = await BudgetModel.listBudgets({
        role: 'admin',
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
        status,
        page: 1,
        limit: 10000,
      });

      if (format === 'csv') {
        const csvHeader = 'Ref,FY,Type,Value,Department,Amount,Status,Stage,Created\n';
        const csvRows = budgets.budgets
          .map(
            (budget) =>
              `${budget.proposal_ref},${budget.fiscal_year},${budget.beneficiary_type},"${budget.beneficiary_value || ''
              }",${budget.department || ''},${budget.total_amount},${budget.status},${budget.current_stage},${budget.created_date
              }`
          )
          .join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=budget-export-FY${fiscalYear || BudgetModel.getCurrentFinancialYear()}-${Date.now()}.csv`
        );

        return res.send(csvHeader + csvRows);
      }

      return res.json({
        success: true,
        data: budgets.budgets,
        exportedAt: new Date().toISOString(),
        filters: { fiscalYear, status },
      });
    } catch (error) {
      console.error('Export error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export budgets',
      });
    }
  }

  static async getStats(req, res) {
    try {
      const { fiscalYear } = req.query;
      const fy = fiscalYear ? Number.parseInt(fiscalYear, 10) : BudgetModel.getCurrentFinancialYear();
      const stats = await BudgetModel.getBudgetStatsByFY(fy);

      return res.json({
        success: true,
        data: stats,
        fiscalYear: fy,
      });
    } catch (error) {
      console.error('Stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch stats',
      });
    }
  }

  static async getStatus(req, res) {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID',
        });
      }

      const proposal = await BudgetModel.getBudgetById(proposalId);

      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found',
        });
      }

      const userId = BudgetController.getUserId(req);
      const userEmail = normalizeText(req.user?.email);
      const userRole = BudgetController.resolveAccessRoleFromPermissions(req);
      const userDepartment = await BudgetController.resolveUserDepartment(req);
      const userDepartmentId = await BudgetController.resolveUserDepartmentId(req);

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - cannot view status',
        });
      }

      return res.json({
        success: true,
        data: {
          id: proposal.id,
          proposalRef: proposal.proposal_ref,
          status: proposal.status,
          currentStage: proposal.current_stage,
          approvalFlow: proposal.approval_flow,
          totalAmount: proposal.total_amount,
          createdAt: proposal.created_at,
        },
      });
    } catch (error) {
      console.error('Get status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch status',
      });
    }
  }

  static async updateFlowConfig(req, res) {
    try {
      const configId = Number.parseInt(req.params.id, 10);

      if (!Number.isInteger(configId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid config ID',
        });
      }

      const requiresLevel1 = Number(req.body?.requiresLevel1);
      const requiresDof = Number(req.body?.requiresDof);
      const requiresPrincipal = Number(req.body?.requiresPrincipal);

      if (![0, 1].includes(requiresLevel1) || ![0, 1].includes(requiresDof) || ![0, 1].includes(requiresPrincipal)) {
        return res.status(400).json({
          success: false,
          message: 'requiresLevel1, requiresDof, requiresPrincipal must be 0 or 1',
        });
      }

      const updated = await BudgetModel.updateApprovalFlowConfig(configId, {
        requiresLevel1,
        requiresDof,
        requiresPrincipal,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Config not found',
        });
      }

      return res.json({
        success: true,
        message: 'Approval flow config updated successfully',
      });
    } catch (error) {
      console.error('Update flow config error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update approval flow config',
      });
    }
  }
}

export default BudgetController;
