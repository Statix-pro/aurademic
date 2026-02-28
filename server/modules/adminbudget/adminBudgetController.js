import BudgetModel from '../budget/budgetModel.js';
import AdminBudgetModel from './adminBudgetModel.js';

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

class AdminBudgetController {
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
    const normalized = AdminBudgetModel.normalizeEntityTypeCode(typeParam);

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
      const departmentByUserId = await AdminBudgetModel.getUserDepartmentByUserId(userId);
      if (departmentByUserId?.name) {
        return departmentByUserId.name;
      }

      // Check Multi-Context RBAC Assignments
      const assignments = await BudgetModel.getUserAssignments(userId);
      const deptAssignment = assignments.find((a) => a.entity_type === 'DEPARTMENT');
      if (deptAssignment?.entity_name) {
        return deptAssignment.entity_name;
      }
    }

    if (userEmail) {
      const departmentByEmail = await AdminBudgetModel.getUserDepartmentByEmail(userEmail);
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

    const department = await AdminBudgetModel.getDepartmentByName(departmentName);
    return department ? Number(department.id) : null;
  }

  static async resolveSubmissionDepartment(req, beneficiaryType, payload = {}) {
    const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
    const userDepartment = await BudgetController.resolveUserDepartment(req);
    const parsedEmployeeId = Number.parseInt(payload?.employee_id, 10);

    if (normalizedBeneficiaryType === 'Faculty') {
      if (Number.isInteger(parsedEmployeeId) && parsedEmployeeId > 0) {
        const employeeDepartment = await AdminBudgetModel.getEmployeeDepartmentByEmployeeId(parsedEmployeeId);
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
        ? await AdminBudgetModel.getDepartments()
        : await AdminBudgetModel.getEntitiesByType(mappedType);

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

      const entity = await AdminBudgetModel.createEntity(mappedType, req.body || {});

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

      const entity = await AdminBudgetModel.updateEntity(mappedType, entityId, req.body || {});

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

      const deleted = await AdminBudgetModel.deleteEntity(mappedType, entityId);

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

      const contacts = await AdminBudgetModel.getEntityContacts(mappedType, entityId);

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

      const updatedContacts = await AdminBudgetModel.updateEntityContacts(mappedType, entityId, contacts);

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
      const configs = await AdminBudgetModel.getApprovalFlowConfigs();

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










  static async getAggregates(req, res) {
    try {
      const { fiscalYear } = req.query;

      const aggregates = await AdminBudgetModel.dashboardAggregates({
        role: 'admin',
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      });

      return res.json({
        success: true,
        data: aggregates,
        currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : BudgetModel.getCurrentFinancialYear(),
      });
    } catch (error) {
      console.error('Aggregates error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch aggregates',
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

      const result = await AdminBudgetModel.listSuperAdminFlowBudgets({
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
      const stats = await AdminBudgetModel.getBudgetStatsByFY(fy);

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

      const updated = await AdminBudgetModel.updateApprovalFlowConfig(configId, {
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

export default AdminBudgetController;
