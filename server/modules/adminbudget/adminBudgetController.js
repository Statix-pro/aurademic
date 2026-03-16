import * as AdminBudgetModel from './adminBudgetModel.js';
import {
  VALID_BENEFICIARY_TYPES,
  MUTABLE_ENTITY_TYPES,
  normalizeText,
  normalizeBeneficiaryType,
} from '../shared/budget/budgetUtils.js';
import {
  BUDGET_PERMISSIONS,
  WORKFLOW_STAGE_PERMISSION,
  getUserId,
  isSuperAdmin as hasSuperAdminAccess,
  getPermissionSet,
  hasPermission,
  resolveAccessRoleFromPermissions,
  getAuthorizedRole,
} from '../shared/budget/controllerPermissions.js';

function isValidDateOnlyString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isFebFirst(date = new Date()) {
  return date.getMonth() === 1 && date.getDate() === 1;
}

export function normalizeEntityTypeParam(typeParam) {
  const normalized = AdminBudgetModel.normalizeEntityTypeCode(typeParam);

  if (normalized === 'PROF_BODY') {
    return 'PROFESSIONAL_BODY';
  }

  return normalized;
}

export async function resolveUserDepartment(req) {
  const requestDepartment = normalizeText(req.user?.department);

  if (requestDepartment) {
    return requestDepartment;
  }

  const userId = getUserId(req);
  const userEmail = normalizeText(req.user?.email);

  if (userId) {
    const departmentByUserId = await AdminBudgetModel.getUserDepartmentByUserId(userId);
    if (departmentByUserId?.name) {
      return departmentByUserId.name;
    }

    // Check Multi-Context RBAC Assignments
    const assignments = await AdminBudgetModel.getUserAssignments(userId);
    const safeAssignments = Array.isArray(assignments) ? assignments : [];
    const deptAssignment = safeAssignments.find((a) => a.entity_type === 'DEPARTMENT');
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

export async function resolveUserDepartmentId(req) {
  const departmentName = await resolveUserDepartment(req);

  if (!departmentName) {
    return null;
  }

  const department = await AdminBudgetModel.getDepartmentByName(departmentName);
  return department ? Number(department.id) : null;
}

export async function resolveSubmissionDepartment(req, beneficiaryType, payload = {}) {
  const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
  const userDepartment = await resolveUserDepartment(req);
  const parsedBeneficiaryEmployeeId = Number.parseInt(payload?.beneficiary_employee_id, 10);

  if (['Faculty', 'Staff'].includes(normalizedBeneficiaryType)) {
    if (Number.isInteger(parsedBeneficiaryEmployeeId) && parsedBeneficiaryEmployeeId > 0) {
      const employeeDepartment = await AdminBudgetModel.getEmployeeDepartmentByEmployeeId(parsedBeneficiaryEmployeeId);
      const resolvedFacultyDepartment = normalizeText(
        employeeDepartment?.parent_department_name || employeeDepartment?.name
      );

      if (resolvedFacultyDepartment) {
        return resolvedFacultyDepartment;
      }
    }

    if (!userDepartment) {
      throw new Error(`Department not set for ${normalizedBeneficiaryType.toLowerCase()} beneficiary`);
    }

    return userDepartment;
  }

  if (normalizedBeneficiaryType === 'Department') {
    return normalizeText(payload?.beneficiary_value) || null;
  }

  return userDepartment || null;
}

export async function getFacultyDetails(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const empData = await AdminBudgetModel.getUserDepartmentByUserId(userId);
    const assignments = await AdminBudgetModel.getUserAssignments(userId);
    const department =
      empData?.parent_department_name
      || empData?.name
      || await resolveUserDepartment(req);
    const role = resolveAccessRoleFromPermissions(req);

    return res.json({
      success: true,
      data: {
        employee_id: empData?.employee_id || userId,
        user_id: userId,
        name: empData?.full_name || req.user?.name || '',
        email: req.user?.email || '',
        department,
        assignments,
        designation: empData?.designation || '',
        mobile: empData?.mobile || '',
        role,
        roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      },
    });
  } catch (error) {
    console.error('Admin budget faculty details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch faculty details',
    });
  }
}

export async function searchApplicant(req, res) {
  try {
    const { q, type } = req.query;
    const results = await AdminBudgetModel.searchApplicant(q || '', type);

    return res.status(200).json({
      success: true,
      status: 'success',
      data: results,
    });
  } catch (error) {
    console.error('Admin budget applicant search error:', error);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: error.message || 'Failed to search applicants',
    });
  }
}

export async function getBudgetTags(req, res) {
  try {
    const tags = await AdminBudgetModel.getBudgetTags();
    return res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Admin get budget tags error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget tags',
    });
  }
}

export async function getOrgUnits(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);

    if (!['DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY'].includes(mappedType)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid type. Must be: DEPARTMENT, CENTRE, CELL, CLUB, PROFESSIONAL_BODY (or PROF_BODY)',
      });
    }

    const units = await AdminBudgetModel.getOrgUnitsByType(mappedType);

    return res.json({
      success: true,
      data: units,
      count: units.length,
    });
  } catch (error) {
    console.error('Admin get org units error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch org units',
    });
  }
}

export async function getAllOrgUnits(req, res) {
  try {
    const units = await AdminBudgetModel.getAllOrgUnits();

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
    console.error('Admin get all org units error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch all org units',
    });
  }
}

export async function getAllDepartments(req, res) {
  try {
    const { beneficiaryType } = req.query;
    const departments = await AdminBudgetModel.getAllDepartments(beneficiaryType);
    const deptNames = departments
      .map((d) => d.name)
      .filter((name, idx, self) => name && self.indexOf(name) === idx)
      .sort();

    return res.json({
      success: true,
      data: deptNames,
    });
  } catch (error) {
    console.error('Admin get all departments error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch departments',
    });
  }
}

export async function get(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const budget = await AdminBudgetModel.getFull(proposalId);

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await AdminBudgetModel.validateUserAccess(
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
    console.error('Admin get budget error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch proposal',
    });
  }
}

export async function getHodBudgets(req, res) {
  try {
    const department = await resolveUserDepartment(req);
    const departmentId = await resolveUserDepartmentId(req);
    const userEmail = normalizeText(req.user?.email);
    const isSuperAdmin = hasSuperAdminAccess(req);

    if (!isSuperAdmin && !department && !departmentId && !userEmail) {
      return res.status(400).json({
        success: false,
        message: 'HOD queue context unavailable',
      });
    }

    const { page = 1, limit = 10, status, fiscalYear, q, departmentFilter, beneficiaryType } = req.query;

    const budgets = await AdminBudgetModel.listBudgets({
      department,
      departmentId,
      userEmail,
      role: 'hod',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      department,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Admin budget HOD queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch HOD budgets',
    });
  }
}

export async function getCoordinatorBudgets(req, res) {
  try {
    const userEmail = normalizeText(req.user?.email);
    const isSuperAdmin = hasSuperAdminAccess(req);
    const userId = getUserId(req);

    if (!isSuperAdmin && !userEmail && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Coordinator queue context unavailable',
      });
    }

    const { page = 1, limit = 10, status, fiscalYear, q, departmentFilter, beneficiaryType } = req.query;

    const budgets = await AdminBudgetModel.listBudgets({
      userId,
      userEmail,
      role: 'coordinator',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Admin budget coordinator queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coordinator budgets',
    });
  }
}

export async function getItheadBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, q, departmentFilter, beneficiaryType } = req.query;
    const isSuperAdminUser = hasSuperAdminAccess(req);

    const budgets = await AdminBudgetModel.listBudgets({
      role: 'ithead',
      superAdminQueueView: isSuperAdminUser,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Admin budget IT Head queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch IT Head budgets',
    });
  }
}

export async function getDofBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, q, departmentFilter, beneficiaryType } = req.query;
    const isSuperAdmin = hasSuperAdminAccess(req);

    const budgets = await AdminBudgetModel.listBudgets({
      role: 'dof',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Admin budget DoF queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DoF budgets',
    });
  }
}

export async function getPrincipalBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, q, departmentFilter, beneficiaryType } = req.query;
    const isSuperAdmin = hasSuperAdminAccess(req);

    const budgets = await AdminBudgetModel.listBudgets({
      role: 'principal',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Admin budget principal queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Principal budgets',
    });
  }
}

export async function approve(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const { decision = 'approved', feedback } = req.body || {};
    const normalizedDecision = normalizeText(decision).toLowerCase();

    if (!['approved', 'rejected', 'returned', 'archived'].includes(normalizedDecision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision must be: approved, rejected, returned, archived',
      });
    }

    const proposal = await AdminBudgetModel.getBudgetById(proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    const currentStage = normalizeText(proposal.current_stage).toLowerCase();
    const requiredPermission = WORKFLOW_STAGE_PERMISSION[currentStage];
    const isSuperAdmin = hasSuperAdminAccess(req);
    const level1Route = AdminBudgetModel.resolveLevel1Route(proposal);

    if (normalizedDecision !== 'archived' && !requiredPermission) {
      return res.status(400).json({
        success: false,
        message: `Proposal is not in an approvable stage: ${proposal.current_stage}`,
      });
    }

    if (
      normalizedDecision !== 'archived'
      && !isSuperAdmin
      && !hasPermission(req, requiredPermission)
    ) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permission for ${currentStage.toUpperCase()} approval stage`,
      });
    }

    if (
      normalizedDecision !== 'archived'
      && currentStage === 'level1'
      && level1Route.routeType === 'entity_contact'
    ) {
      const entityAssignee = await AdminBudgetModel.resolveEntityLevel1Assignee(level1Route.entityId);

      if (!entityAssignee?.email && !isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Entity Level-1 contact is not configured. Super Admin approval required.',
        });
      }
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await AdminBudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      normalizedDecision === 'archived' ? 'admin' : isSuperAdmin ? 'super_admin' : currentStage,
      userDepartment,
      userDepartmentId
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - proposal not in your queue',
      });
    }

    await AdminBudgetModel.processApproval(proposalId, {
      role: currentStage,
      decision: normalizedDecision,
      feedback: ['rejected', 'returned', 'archived'].includes(normalizedDecision) ? feedback : undefined,
      approverUserId: userId,
      approverEmail: userEmail,
    });

    return res.json({
      success: true,
      message: `Proposal ${normalizedDecision} successfully`,
      data: {
        decision: normalizedDecision,
        role: currentStage,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin budget approval error:', error);

    if (
      error.message.includes('Stage mismatch')
      || error.message.includes('Feedback required')
      || error.message.includes('expected')
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

export async function updateApprovedAmounts(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const payload = req.body || {};
    if (!Array.isArray(payload.lines) || !payload.lines.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one budget line required',
      });
    }

    const proposal = await AdminBudgetModel.getBudgetById(proposalId);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    const currentStage = normalizeText(proposal.current_stage).toLowerCase();
    const requiredPermission = WORKFLOW_STAGE_PERMISSION[currentStage];
    const isSuperAdmin = hasSuperAdminAccess(req);

    if (!requiredPermission && !isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: `Proposal is not in an editable approval stage: ${proposal.current_stage}`,
      });
    }

    if (!isSuperAdmin && !hasPermission(req, requiredPermission)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permission for ${currentStage.toUpperCase()} stage`,
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await AdminBudgetModel.validateUserAccess(
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

    await AdminBudgetModel.updateApprovedAmounts(proposalId, payload, {
      editorRole: currentStage,
      editorUserId: userId,
      editorEmail: userEmail,
    });

    return res.json({
      success: true,
      message: 'Approved amounts updated successfully',
    });
  } catch (error) {
    console.error('Admin approved amount update error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update approved amounts',
    });
  }
}

export async function deleteProposal(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({ success: false, message: 'Invalid proposal ID' });
    }

    const userId = getUserId(req);
    const isSuperAdmin = hasSuperAdminAccess(req);
    const proposal = await AdminBudgetModel.getBudgetById(proposalId);

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

    const deleted = await AdminBudgetModel.delete(proposalId);

    if (!deleted) {
      throw new Error('Database delete failed');
    }

    return res.json({
      success: true,
      message: 'Budget proposal deleted successfully',
    });
  } catch (error) {
    console.error('Admin budget delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete proposal',
    });
  }
}






export async function getEntitiesByType(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);

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

export async function createEntity(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);

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

export async function updateEntity(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);
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

export async function deleteEntity(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);
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

export async function getEntityContacts(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);
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

export async function updateEntityContacts(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);
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

export async function getApprovalFlows(req, res) {
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

export async function getFreezeConfig(req, res) {
  try {
    const { fiscalYear } = req.query;
    const fy = fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear();
    const config = await AdminBudgetModel.getFreezeConfig(fy);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get freeze config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch freeze config',
    });
  }
}

export async function upsertFreezeConfig(req, res) {
  try {
    const isSuperAdminUser = hasSuperAdminAccess(req);
    const hasDofPermission = hasPermission(req, BUDGET_PERMISSIONS.workflowDof);

    if (!isSuperAdminUser && !hasDofPermission) {
      return res.status(403).json({
        success: false,
        message: 'Only DoF or Super Admin can update freeze configuration',
      });
    }

    const fiscalYear = Number.parseInt(req.body?.fiscalYear, 10) || AdminBudgetModel.getCurrentFinancialYear();
    const cutoffDate = normalizeText(req.body?.cutoffDate) || AdminBudgetModel.getDefaultFreezeCutoffDate(fiscalYear);
    const requestedFreezeState = req.body?.isFrozen === false ? 0 : 1;
    const isFrozen = isSuperAdminUser ? requestedFreezeState : 1;

    const existingConfig = await AdminBudgetModel.getFreezeConfig(fiscalYear);
    if (existingConfig?.isFrozen && !isSuperAdminUser) {
      return res.status(403).json({
        success: false,
        message: 'Freeze already applied. Only Super Admin can update deadline and freeze again.',
      });
    }

    if (!isSuperAdminUser) {
      if (!isFebFirst()) {
        return res.status(403).json({
          success: false,
          message: 'DoF can freeze budget only on February 1 of the fiscal year.',
        });
      }
    }

    if (!isValidDateOnlyString(cutoffDate)) {
      return res.status(400).json({
        success: false,
        message: 'cutoffDate must be YYYY-MM-DD',
      });
    }

    const config = await AdminBudgetModel.upsertFreezeConfig({
      fiscalYear,
      cutoffDate,
      isFrozen,
      updatedByUserId: getUserId(req),
      updatedByEmail: normalizeText(req.user?.email),
    });

    return res.json({
      success: true,
      message: isFrozen ? 'Budget time frozen successfully' : 'Budget freeze updated successfully',
      data: config,
    });
  } catch (error) {
    console.error('Upsert freeze config error:', error);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Freeze config table is missing. Run migration: 20260308_add_budget_time_freeze_config.sql',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update freeze config',
    });
  }
}

export async function getAggregates(req, res) {
  try {
    const { fiscalYear } = req.query;
    const department = await resolveUserDepartment(req);
    const departmentId = await resolveUserDepartmentId(req);

    const aggregates = await AdminBudgetModel.dashboardAggregates({
      role: getAuthorizedRole(req, req.query.scope),
      department,
      departmentId,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
    });

    return res.json({
      success: true,
      data: aggregates,
      currentFiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Aggregates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch aggregates',
    });
  }
}

export async function toggleArchive(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId) || proposalId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const proposal = await AdminBudgetModel.getProposalForArchiveToggle(proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    const isArchived = ['archive', 'archived'].includes(normalizeText(proposal.status).toLowerCase())
      || ['archive', 'archived'].includes(normalizeText(proposal.current_stage).toLowerCase());
    const currentStage = normalizeText(proposal.current_stage).toLowerCase();
    const requiredPermission = WORKFLOW_STAGE_PERMISSION[currentStage];
    const isSuperAdmin = hasSuperAdminAccess(req);

    if (!isArchived) {
      if (!requiredPermission) {
        return res.status(400).json({
          success: false,
          message: `Proposal is not in an approvable stage: ${proposal.current_stage}`,
        });
      }

      const permissionSet = getPermissionSet(req);
      if (!isSuperAdmin && !permissionSet.has(requiredPermission)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permission for ${currentStage.toUpperCase()} stage`,
        });
      }
    }

    const result = await AdminBudgetModel.toggleArchiveState(proposalId, {
      role: isArchived ? 'admin' : currentStage,
      feedback: normalizeText(req.body?.feedback),
      approverUserId: getUserId(req),
      approverEmail: normalizeText(req.user?.email),
      isSuperAdmin,
    });

    if (result && result.error) {
      return res.status(403).json({
        success: false,
        message: result.error,
      });
    }

    return res.json({
      success: true,
      message: result.action === 'unarchived' ? 'Proposal unarchived successfully' : 'Proposal archived successfully',
      data: {
        action: result.action,
        proposalId,
      },
    });
  } catch (error) {
    console.error('Admin archive toggle error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update archive state',
    });
  }
}

export async function adminList(req, res) {
  try {
    const { page = 1, limit = 20, status, fiscalYear, q, departmentFilter, beneficiaryType, scope: scopeParam } = req.query;

    const budgets = await AdminBudgetModel.listBudgets({
      role: getAuthorizedRole(req, scopeParam),
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      filters: {
        role: 'admin',
        fiscalYear: fiscalYear || AdminBudgetModel.getCurrentFinancialYear(),
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

export async function getSuperAdminFlowDashboard(req, res) {
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
        fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear(),
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

export async function search(req, res) {
  try {
    const { q, status, fiscalYear } = req.query;

    const budgets = await AdminBudgetModel.listBudgets({
      userId: getUserId(req),
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

async function exportBudgets(req, res) {
  try {
    const { fiscalYear, status, format = 'csv' } = req.query;

    const budgets = await AdminBudgetModel.listBudgets({
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
        `attachment; filename=budget-export-FY${fiscalYear || AdminBudgetModel.getCurrentFinancialYear()}-${Date.now()}.csv`
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

export { exportBudgets as export };

export async function getStats(req, res) {
  try {
    const { fiscalYear, scope: scopeParam } = req.query;
    const fy = fiscalYear ? Number.parseInt(fiscalYear, 10) : AdminBudgetModel.getCurrentFinancialYear();
    const role = getAuthorizedRole(req, scopeParam);
    const stats = await AdminBudgetModel.getBudgetStatsByFY(fy, { role });

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

export async function getKpiStats(req, res) {
  try {
    const department = await resolveUserDepartment(req);
    const departmentId = await resolveUserDepartmentId(req);
    const userEmail = normalizeText(req.user?.email);
    const userId = getUserId(req);
    const isSuperAdmin = hasSuperAdminAccess(req);
    const { fiscalYear, q, scope: scopeParam, departmentFilter, beneficiaryType } = req.query;
    const role = getAuthorizedRole(req, scopeParam);

    const stats = await AdminBudgetModel.getKpiStats({
      userId,
      userEmail,
      department,
      departmentId,
      role,
      superAdminQueueView: isSuperAdmin,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
      departmentFilter,
      beneficiaryType,
    });

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('KPI stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch KPI stats',
    });
  }
}

export async function updateFlowConfig(req, res) {
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

export async function getBatch(req, res) {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({
        success: false,
        message: 'Missing proposal IDs',
      });
    }

    const proposalIds = ids.split(',').map((id) => Number.parseInt(id.trim(), 10)).filter(Boolean);
    if (!proposalIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal IDs',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const authorizedProposalIds = [];
    for (const proposalId of proposalIds) {
      const hasAccess = await AdminBudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId
      );
      if (hasAccess) {
        authorizedProposalIds.push(proposalId);
      }
    }

    if (!authorizedProposalIds.length) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const batchData = await AdminBudgetModel.getManyFull(authorizedProposalIds);

    return res.json({
      success: true,
      data: batchData,
    });
  } catch (error) {
    console.error('Batch fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch batch details',
    });
  }
}

export async function getConsolidation(req, res) {
  try {
    const department = await resolveUserDepartment(req);
    const departmentId = await resolveUserDepartmentId(req);
    const userEmail = normalizeText(req.user?.email);
    const userId = getUserId(req);
    const { fiscalYear, scope: scopeParam, beneficiaryType, q } = req.query;
    const role = getAuthorizedRole(req, scopeParam);

    const consolidatedData = await AdminBudgetModel.getConsolidatedData({
      userId,
      userEmail,
      department,
      departmentId,
      role,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      beneficiaryType,
      q,
    });

    return res.json({
      success: true,
      data: consolidatedData,
    });
  } catch (error) {
    console.error('Consolidation fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch consolidated data',
    });
  }
}
