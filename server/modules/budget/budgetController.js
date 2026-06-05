import * as BudgetModel from './budgetModel.js';
import {
  VALID_BENEFICIARY_TYPES,
  normalizeText,
  normalizeBeneficiaryType,
} from '../shared/budget/budgetUtils.js';
import {
  WORKFLOW_STAGE_PERMISSION,
  getUserId,
  isSuperAdmin as hasSuperAdminAccess,
  hasPermission,
  resolveAccessRoleFromPermissions,
} from '../shared/budget/controllerPermissions.js';

export function normalizeEntityTypeParam(typeParam) {
  const normalized = BudgetModel.normalizeEntityTypeCode(typeParam);

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
    const departmentByUserId = await BudgetModel.getUserDepartmentByUserId(userId);
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
    const departmentByEmail = await BudgetModel.getUserDepartmentByEmail(userEmail);
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

  const department = await BudgetModel.getDepartmentByName(departmentName);
  return department ? Number(department.id) : null;
}

export async function resolveSubmissionDepartment(req, beneficiaryType, payload = {}) {
  const normalizedBeneficiaryType = normalizeBeneficiaryType(beneficiaryType);
  const userDepartment = await resolveUserDepartment(req);
  const parsedBeneficiaryEmployeeId = Number.parseInt(payload?.beneficiary_employee_id, 10);

  if (['Faculty', 'Staff'].includes(normalizedBeneficiaryType)) {
    if (Number.isInteger(parsedBeneficiaryEmployeeId) && parsedBeneficiaryEmployeeId > 0) {
      const employeeDepartment = await BudgetModel.getEmployeeDepartmentByEmployeeId(
        parsedBeneficiaryEmployeeId,
      );
      const resolvedFacultyDepartment = normalizeText(
        employeeDepartment?.parent_department_name ||
          employeeDepartment?.name ||
          employeeDepartment?.entity_name,
      );

      if (resolvedFacultyDepartment) {
        return resolvedFacultyDepartment;
      }
    }

    if (!userDepartment) {
      throw new Error(
        `Department not set for ${normalizedBeneficiaryType.toLowerCase()} beneficiary`,
      );
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

    // 1. Get rich employee data from DB (includes designation, mobile, full_name)
    const empData = await BudgetModel.getUserDepartmentByUserId(userId);

    // 2. Fetch Multi-Context RBAC Assignments
    const assignments = await BudgetModel.getUserAssignments(userId);

    // 3. Fallback to token data if DB data is missing
    const department =
      empData?.parent_department_name || empData?.name || (await resolveUserDepartment(req));
    const role = resolveAccessRoleFromPermissions(req);

    return res.json({
      success: true,
      data: {
        employee_id: empData?.employee_id || userId,
        user_id: userId,
        // Use DB full_name if available, else token name
        name: empData?.full_name || req.user?.name || '',
        email: req.user?.email || '',
        department,
        // Pass the new assignments to the frontend
        assignments,
        // Additional fallback fields
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

export async function getFreezeConfig(req, res) {
  try {
    const { fiscalYear } = req.query;
    const fy = fiscalYear ? Number.parseInt(fiscalYear, 10) : BudgetModel.getCurrentFinancialYear();
    const config = await BudgetModel.getFreezeConfig(fy);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get budget freeze config error:', error);
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message:
          'Freeze config table is missing. Run migration: 20260308_add_budget_time_freeze_config.sql',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch freeze config',
    });
  }
}

export async function searchApplicant(req, res) {
  try {
    const { q, type } = req.query;
    const results = await BudgetModel.searchApplicant(q || '', type);

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

export async function getBudgetTags(req, res) {
  try {
    const tags = await BudgetModel.getBudgetTags();
    return res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    console.error('Get budget tags error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget tags',
    });
  }
}

export async function getOrgUnits(req, res) {
  try {
    const mappedType = normalizeEntityTypeParam(req.params.type);

    if (
      !['DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY', 'SECTION'].includes(mappedType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid type. Must be: DEPARTMENT, CENTRE, CELL, CLUB, SECTION, PROFESSIONAL_BODY (or PROF_BODY)',
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

export async function getAllOrgUnits(req, res) {
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

export async function create(req, res) {
  try {
    const payload = req.body || {};
    const userId = getUserId(req);
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

    if (
      !VALID_BENEFICIARY_TYPES.includes(payload.beneficiary_type) &&
      !VALID_BENEFICIARY_TYPES.includes(normalizedBeneficiaryType)
    ) {
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

    if (
      !['Faculty', 'Institution'].includes(normalizedBeneficiaryType) &&
      !normalizeText(payload.beneficiary_value)
    ) {
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

    const resolvedDepartment = await resolveSubmissionDepartment(
      req,
      normalizedBeneficiaryType,
      payload,
    );

    const result = await BudgetModel.create(
      {
        ...payload,
        beneficiary_type: normalizedBeneficiaryType,
        fiscal_year: Number.parseInt(payload.fiscal_year, 10),
        user_id: userId,
        user_email: userEmail,
        applicant_name: normalizeText(payload.applicant_name),
        budget_tag: normalizeText(payload.budget_tag),
        employee_id: payload.employee_id || userId,
        department: resolvedDepartment,
      },
      {
        submitterRole: resolveAccessRoleFromPermissions(req),
      },
    );

    return res.status(201).json({
      success: true,
      message: 'Budget proposal created successfully',
      data: {
        proposalId: result.proposalId,
        proposalRef: result.proposalRef,
        fiscalYear: result.fyYear,
        approvalFlow: result.approvalFlow,
        initialStage: result.initialStage,
        currentStage: result.currentStage,
        requiresLevel1: result.requiresLevel1,
        isDirectDoFSubmission: result.isDirectDoFSubmission,
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

export async function update(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);
    const userRole = resolveAccessRoleFromPermissions(req);
    const isSuperAdmin = hasSuperAdminAccess(req);

    const canBypassAccessCheck =
      isSuperAdmin || ['super_admin', 'admin', 'dof', 'principal'].includes(userRole);
    const canBypassEditStateValidation =
      isSuperAdmin || canBypassAccessCheck || ['hod', 'ithead'].includes(userRole);

    if (!canBypassAccessCheck) {
      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDepartment,
        userDepartmentId,
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
    const resolvedDepartment = await resolveSubmissionDepartment(
      req,
      normalizedBeneficiaryType,
      payload,
    );

    if (!payload.lines?.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one budget line required',
      });
    }

    await BudgetModel.update(
      proposalId,
      {
        ...payload,
        beneficiary_type: normalizedBeneficiaryType,
        applicant_name: normalizeText(payload.applicant_name),
        budget_tag: normalizeText(payload.budget_tag),
        department: resolvedDepartment,
      },
      {
        skipEditStateValidation: canBypassEditStateValidation,
        editedByUserId: userId,
        editedByEmail: userEmail,
        editedByRole: userRole,
        resubmissionRemarks: normalizeText(
          payload.resubmission_remarks ||
            payload.resubmissionRemarks ||
            payload.feedback ||
            payload.remarks,
        ),
      },
    );

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

export async function deleteProposal(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({ success: false, message: 'Invalid proposal ID' });
    }

    const userId = getUserId(req);
    const isSuperAdmin = hasSuperAdminAccess(req);
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

    const deleted = await BudgetModel.delete(proposalId, {
      userId,
      email: normalizeText(req.user?.email),
      role: isSuperAdmin ? 'super_admin' : resolveAccessRoleFromPermissions(req),
      feedback: 'Deleted by user',
    });

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

export async function get(req, res) {
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

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      userRole,
      userDepartment,
      userDepartmentId,
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - cannot view this proposal',
      });
    }

    // Determine access type: owner, applicant, beneficiary, or approver
    let accessType = 'approver';
    const uid = Number(userId);
    const proposalUserId = Number(budget.master?.user_id || budget.user_id);

    if (uid === proposalUserId) {
      accessType = 'owner';
    } else {
      const proposalEmployeeId = budget.master?.employee_id || budget.employee_id;
      if (proposalEmployeeId && uid > 0) {
        const isMatch = await BudgetModel.checkEmployeeUserMatch(proposalEmployeeId, uid);
        if (isMatch) {
          accessType = 'applicant';
        }
      }

      if (accessType === 'approver') {
        const isBeneficiary = await BudgetModel.isFacultyBeneficiaryForUser(
          budget.master || budget,
          uid,
        );
        if (isBeneficiary) {
          accessType = 'beneficiary';
        }
      }
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

export async function getMyBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear } = req.query;
    const userId = getUserId(req);
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
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('My budgets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your budgets',
    });
  }
}

export async function getMyBudgetsFull(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear } = req.query;
    const userId = getUserId(req);
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

    const proposalIds = (budgets?.budgets || [])
      .map((proposal) => Number(proposal?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    const detailMap = await BudgetModel.getProposalDetailsByIds(proposalIds);
    const fullData = (budgets?.budgets || []).map((proposal) => {
      const detail = detailMap.get(Number(proposal?.id)) || {};
      return {
        master: proposal,
        lines: detail.lines || [],
        allocations: detail.allocations || {},
        approved_allocations: detail.approved_allocations || null,
        approvals: detail.approvals || [],
        edits: detail.edits || [],
      };
    });

    return res.json({
      success: true,
      data: fullData,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('My full budgets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your budget details',
    });
  }
}

export async function getKpiStats(req, res) {
  try {
    const { fiscalYear, q } = req.query;
    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);

    const stats = await BudgetModel.getKpiStats({
      userId,
      userEmail,
      role: 'user',
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      q,
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

export async function getHodBudgets(req, res) {
  try {
    const userId = getUserId(req);
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

    const { page = 1, limit = 10, status, fiscalYear, departmentFilter } = req.query;

    const budgets = await BudgetModel.listBudgets({
      userId,
      department,
      departmentId,
      userEmail,
      role: 'hod',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      departmentFilter: departmentFilter || undefined,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      department,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('HOD budgets error:', error);
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

    const { page = 1, limit = 10, status, fiscalYear, departmentFilter } = req.query;

    const budgets = await BudgetModel.listBudgets({
      userId,
      userEmail,
      role: 'coordinator',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      departmentFilter: departmentFilter || undefined,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Coordinator budgets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coordinator budgets',
    });
  }
}

export async function getItheadBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, departmentFilter } = req.query;
    const isSuperAdminUser = hasSuperAdminAccess(req);

    const budgets = await BudgetModel.listBudgets({
      role: 'ithead',
      superAdminQueueView: isSuperAdminUser,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      departmentFilter: departmentFilter || undefined,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('IT Head budgets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch IT Head budgets',
    });
  }
}

export async function getDofBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, departmentFilter } = req.query;
    const isSuperAdmin = hasSuperAdminAccess(req);

    const budgets = await BudgetModel.listBudgets({
      role: 'dof',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      departmentFilter: departmentFilter || undefined,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('DoF budgets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch DoF budgets',
    });
  }
}

export async function getPrincipalBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear, departmentFilter } = req.query;
    const isSuperAdmin = hasSuperAdminAccess(req);

    const budgets = await BudgetModel.listBudgets({
      role: 'principal',
      superAdminQueueView: isSuperAdmin,
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      status: status || undefined,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear, 10) : undefined,
      departmentFilter: departmentFilter || undefined,
    });

    return res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: fiscalYear
        ? Number.parseInt(fiscalYear, 10)
        : BudgetModel.getCurrentFinancialYear(),
    });
  } catch (error) {
    console.error('Principal budgets error:', error);
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

    const proposal = await BudgetModel.getBudgetById(proposalId);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    const currentStage = normalizeText(proposal.current_stage).toLowerCase();
    const requiredPermission = WORKFLOW_STAGE_PERMISSION[currentStage];
    const isSuperAdmin = hasSuperAdminAccess(req);
    const level1Route = BudgetModel.resolveLevel1Route(proposal);

    if (normalizedDecision !== 'archived' && !requiredPermission) {
      return res.status(400).json({
        success: false,
        message: `Proposal is not in an approvable stage: ${proposal.current_stage}`,
      });
    }

    if (
      normalizedDecision !== 'archived' &&
      !isSuperAdmin &&
      !hasPermission(req, requiredPermission)
    ) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permission for ${currentStage.toUpperCase()} approval stage`,
      });
    }

    if (
      normalizedDecision !== 'archived' &&
      currentStage === 'level1' &&
      level1Route.routeType === 'entity_contact'
    ) {
      const entityAssignee = await BudgetModel.resolveEntityLevel1Assignee(level1Route.entityId);

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

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      normalizedDecision === 'archived' ? 'admin' : isSuperAdmin ? 'super_admin' : currentStage,
      userDepartment,
      userDepartmentId,
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - proposal not in your queue',
      });
    }

    await BudgetModel.processApproval(proposalId, {
      role: currentStage,
      decision: normalizedDecision,
      feedback: ['rejected', 'returned', 'archived'].includes(normalizedDecision)
        ? feedback
        : undefined,
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

export async function uploadFiles(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);
    const accessRole = hasSuperAdminAccess(req) ? 'super_admin' : 'user';

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      accessRole,
      userDepartment,
      userDepartmentId,
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

export async function getHistory(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      userRole,
      userDepartment,
      userDepartmentId,
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

export async function getMonthAllocations(req, res) {
  try {
    const proposalId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(proposalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid proposal ID',
      });
    }

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      userRole,
      userDepartment,
      userDepartmentId,
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

export async function getStatus(req, res) {
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

    const userId = getUserId(req);
    const userEmail = normalizeText(req.user?.email);
    const userRole = resolveAccessRoleFromPermissions(req);
    const userDepartment = await resolveUserDepartment(req);
    const userDepartmentId = await resolveUserDepartmentId(req);

    const hasAccess = await BudgetModel.validateUserAccess(
      proposalId,
      userId,
      userEmail,
      userRole,
      userDepartment,
      userDepartmentId,
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
