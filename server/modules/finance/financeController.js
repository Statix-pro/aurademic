import financeModel from './financeModel.js';
import './financeWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';
import fs from 'fs';
import path from 'path';
import db from '../../config/connection.js';

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const SAFE_ANNEXURE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
]);

const sanitizeAnnexureExtension = (originalName) => {
  const rawExt = String(path.extname(String(originalName || '')) || '').toLowerCase();
  const normalizedExt = rawExt.replace(/[^a-z0-9.]/g, '');
  return SAFE_ANNEXURE_EXTENSIONS.has(normalizedExt) ? normalizedExt : '';
};

const FINANCE_PRINCIPAL_DOC_DIR = path.resolve(process.cwd(), 'uploads', 'finance-principal-documents');
const FINANCE_PRINCIPAL_DOC_PUBLIC_PREFIX = '/uploads/finance-principal-documents/';

const TEMP_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'temp');

const resolveSafeTempUploadPath = (unsafePath) => {
  const normalized = normalizeText(unsafePath);
  if (!normalized) return null;

  const resolved = path.resolve(normalized);
  const safeBase = `${TEMP_UPLOAD_DIR}${path.sep}`;
  if (!resolved.startsWith(safeBase)) {
    return null;
  }

  return resolved;
};

const isPrincipalRoleRequest = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return roles.some((role) => normalizeText(role).toLowerCase() === 'principal');
};

const hasFinanceWorkflowPermission = (req) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  return permissions.some((permission) =>
    normalizeText(permission).toLowerCase().startsWith('finance.workflow.')
  );
};

const canManagePrincipalDocumentsRequest = (req) => (
  Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) ||
  isPrincipalRoleRequest(req)
);

const isEligibleForPrincipalDocument = (finance) => {
  const totalBudget = Number(finance?.total_budget || finance?.proposed_amount || 0);
  const workflowStatus = normalizeText(
    finance?.workflow_state?.status || finance?.workflow_status || finance?.overall_status
  ).toLowerCase();
  const currentStage = normalizeText(
    finance?.workflow_state?.currentStage || finance?.workflow_stage
  ).toLowerCase();

  if (!(totalBudget > 10000)) {
    return false;
  }

  return (
    workflowStatus === 'principal_approved' ||
    workflowStatus === 'completed' ||
    workflowStatus === 'approved' ||
    currentStage === 'principal' ||
    currentStage === 'chairman'
  );
};

const parseDateMs = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

const resolveCurrentCycleStartMs = (financeRecord, entries = []) => {
  const workflowState = financeRecord?.workflow_state || {};
  const resubmittedAtMs = parseDateMs(workflowState.resubmittedAt);

  if (resubmittedAtMs) {
    // Include the latest return action that led to resubmission so edit/resubmit logs are visible.
    let latestReturnMs = null;
    for (const entry of entries) {
      const decisionToken = normalizeText(entry?.decision || entry?.status).toLowerCase();
      if (decisionToken !== 'returned' && decisionToken !== 'return') {
        continue;
      }

      const actionMs =
        parseDateMs(entry?.decidedAt) ||
        parseDateMs(entry?.decided_at) ||
        parseDateMs(entry?.createdAt) ||
        parseDateMs(entry?.created_at);

      if (!actionMs) {
        continue;
      }

      if (actionMs <= resubmittedAtMs && (!latestReturnMs || actionMs > latestReturnMs)) {
        latestReturnMs = actionMs;
      }
    }

    if (latestReturnMs) {
      return latestReturnMs;
    }

    return resubmittedAtMs;
  }

  return (
    parseDateMs(workflowState.startedAt) ||
    parseDateMs(financeRecord?.created_at) ||
    null
  );
};

const filterEntriesForCurrentCycle = (entries, financeRecord) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const cycleStartMs = resolveCurrentCycleStartMs(financeRecord, entries);
  if (!cycleStartMs) {
    return entries;
  }

  return entries.filter((entry) => {
    const actionMs =
      parseDateMs(entry?.decidedAt) ||
      parseDateMs(entry?.decided_at) ||
      parseDateMs(entry?.createdAt) ||
      parseDateMs(entry?.created_at);

    // Keep rows that don't have a timestamp rather than dropping potentially valid logs.
    if (!actionMs) {
      return true;
    }

    return actionMs >= cycleStartMs;
  });
};

const isSuperAdminRequest = (req) => {
  if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)) {
    return true;
  }

  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return roles.some((role) => normalizeText(role).toLowerCase() === 'super_admin');
};

const normalizeActor = (req) => {
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : normalizeText(req.user?.roles)
      ? [normalizeText(req.user?.roles)]
      : normalizeText(req.user?.role)
        ? [normalizeText(req.user?.role)]
        : [];

  const role = normalizeText(req.user?.role) || roles[0] || null;

  const permissions = Array.isArray(req.user?.permissions)
    ? req.user.permissions
    : normalizeText(req.user?.permissions)
      ? [normalizeText(req.user?.permissions)]
      : [];

  return {
    id: req.user?.id,
    userId: req.user?.id,
    email: req.user?.email,
    role,
    roles,
    permissions,
    isSuperAdmin: isSuperAdminRequest(req),
  };
};

const resolveFinanceLevel1QueueRole = (req) => {
  const normalizedRoles = Array.isArray(req.user?.roles)
    ? req.user.roles.map((role) => normalizeText(role).toLowerCase())
    : [];

  const hasCoordinatorRole = normalizedRoles.includes('coordinator') || normalizedRoles.includes('entity_approver');
  const hasHodRole = normalizedRoles.includes('hod');

  if (hasCoordinatorRole && !hasHodRole) return 'coordinator';
  if (hasHodRole && !hasCoordinatorRole) return 'hod';

  return null;
};

const hasAnyFinanceWorkflowPermission = (req) => {
  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  return permissions.some((permission) => normalizeText(permission).startsWith('finance.workflow.'));
};

const hasFinanceStagePermission = (req, stage) => {
  const normalizedStage = normalizeText(stage).toLowerCase();
  if (!normalizedStage) {
    return false;
  }

  if (isSuperAdminRequest(req)) {
    return true;
  }

  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const normalizedPermissions = permissions.map((permission) => normalizeText(permission).toLowerCase());
  if (
    normalizedPermissions.includes('finance.workflow.*') ||
    normalizedPermissions.includes(`finance.workflow.${normalizedStage}`)
  ) {
    return true;
  }

  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles.map((role) => normalizeText(role).toLowerCase())
    : [];
  const stageRoleMap = {
    dof: ['dof'],
    principal: ['principal'],
    chairman: ['chairman'],
  };

  return (stageRoleMap[normalizedStage] || []).some((role) => roles.includes(role));
};

const hasFinanceWorkflowEditorAccess = (req) =>
  isSuperAdminRequest(req) || hasAnyFinanceWorkflowPermission(req);

const canAccessFinanceRecord = (req, financeRecord) => {
  const actorUserId = toPositiveInt(req.user?.id);

  if (!financeRecord) {
    return false;
  }

  if (isSuperAdminRequest(req)) {
    return true;
  }

  if (actorUserId && actorUserId === toPositiveInt(financeRecord.created_by)) {
    return true;
  }

  return hasAnyFinanceWorkflowPermission(req);
};

const isHandledFinanceDomainError = (error) => {
  const message = normalizeText(error?.message).toLowerCase();
  if (!message) return false;

  return [
    'insufficient budget balance',
    'requested amount',
    'budget line not found/approved',
    'budget line mapping is missing',
    'no approved budget allocation found',
  ].some((token) => message.includes(token));
};

const unwrapFinanceModelError = (message = '') =>
  normalizeText(message).replace(/^Error (creating|updating) finance request:\s*/i, '');

const handleWorkflowError = (res, error, fallbackMessage) => {
  if (error instanceof WorkflowError) {
    return res.status(error.statusCode || 400).json({
      status: 'error',
      message: error.message,
      code: error.code,
    });
  }

  if (isHandledFinanceDomainError(error)) {
    const message = unwrapFinanceModelError(error?.message);
    return res.status(409).json({
      status: 'error',
      message: message || 'Finance request cannot be processed due to budget validation',
      code: 'FINANCE_BUDGET_VALIDATION_FAILED',
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    status: 'error',
    message: error.message || fallbackMessage,
  });
};

const sanitizeFinanceRecordForUser = (req, financeRecord) => {
  if (!financeRecord) return financeRecord;
  
  if (!canManagePrincipalDocumentsRequest(req)) {
    return {
      ...financeRecord,
      principal_document: null,
    };
  }

  return financeRecord;
};

const financeController = {
  async createFinanceRequest(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const data = req.body || {};

      const hasApplicant = data.employee_id || data.applicant_name;
      if (!hasApplicant || !data.request_date || !data.beneficiary_type || !data.primary_head) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields (employee_id or applicant_name, request_date, beneficiary_type, primary_head)',
        });
      }

      if (!Array.isArray(data.budget_rows) || data.budget_rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one budget row is required',
        });
      }

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid user context',
        });
      }

      const financeId = await financeModel.createFinanceRequest(data, userId, normalizeText(req.user?.email) || null);
      const budgetRows = Array.isArray(data.budget_rows) ? data.budget_rows : [];
      const plannedBudgetAmount = budgetRows.length
        ? budgetRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)
        : Number(data.total_budget || 0);
      const unplannedBudgetEnabled = Boolean(data.unplanned_budget_enabled);
      const unplannedBudgetAmount = unplannedBudgetEnabled
        ? Math.max(0, Number(data.unplanned_budget_amount || 0))
        : 0;
      const totalBudgetAmount = plannedBudgetAmount + (Number.isFinite(unplannedBudgetAmount) ? unplannedBudgetAmount : 0);
      const amountBand = Number(totalBudgetAmount) > 10000 ? 'gt_10k' : 'lte_10k';
      const financeMeta = {
        unplannedBudgetEnabled,
        unplannedBudgetAmount:
          data.unplanned_budget_amount !== undefined && data.unplanned_budget_amount !== null
            ? Number(data.unplanned_budget_amount)
            : null,
        unplannedBudgetDescription: normalizeText(data.unplanned_budget_description) || null,
      };

      try {
        await workflowService.startWorkflow({
          moduleKey: 'finance',
          recordId: financeId,
          metadata: {
            origin: 'system',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              trigger: 'create_finance_request',
              amountBand,
              beneficiaryType: normalizeText(data.beneficiary_type) || null,
              financeMeta,
            },
          },
        });
      } catch (workflowError) {
        try {
          await financeModel.hardDeleteFinanceRequest(financeId);
        } catch (cleanupError) {
          console.error('Failed to clean up finance request after workflow start failure', cleanupError);
        }
        throw workflowError;
      }

      return res.status(201).json({
        status: 'success',
        message: 'Finance request created successfully',
        data: { id: financeId },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in createFinanceRequest');
    }
  },

  async updateFinanceRequest(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      const isCreator = Boolean(userId && toPositiveInt(finance.created_by) === userId);
      const isWorkflowEditor = hasFinanceWorkflowEditorAccess(req);
      const workflowStatus = normalizeText(finance.workflow_state?.status).toLowerCase();
      const isTerminalWorkflow = ['approved', 'rejected', 'archived', 'completed'].includes(workflowStatus);

      if (!isCreator && !isWorkflowEditor) {
        return res.status(403).json({
          status: 'error',
          message: 'You are not allowed to update this request',
        });
      }

      const currentStage = normalizeText(finance.workflow_state?.currentStage).toLowerCase();
      const isApplicantEditable =
        Boolean(finance.workflow_state?.isEditableByApplicant) ||
        workflowStatus === 'returned' ||
        workflowStatus === 'submitted' ||
        currentStage === 'level1';

      if (isCreator && !isWorkflowEditor && !isApplicantEditable) {
        return res.status(403).json({
          status: 'error',
          message: 'This request is not editable in current workflow state',
        });
      }

      if (isWorkflowEditor && isTerminalWorkflow && !isSuperAdminRequest(req)) {
        return res.status(403).json({
          status: 'error',
          message: 'This request is not editable in current workflow state',
        });
      }

      const result = await financeModel.updateFinanceRequest(financeId, req.body || {}, normalizeActor(req));

      if (result.affectedRows > 0) {
        return res.status(200).json({
          status: 'success',
          message: 'Finance request updated successfully',
        });
      }

      return res.status(400).json({
        status: 'error',
        message: 'No changes applied',
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in updateFinanceRequest');
    }
  },

  async resubmitFinanceRequest(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!userId || toPositiveInt(finance.created_by) !== userId) {
        return res.status(403).json({
          status: 'error',
          message: 'Only applicant can resubmit this request',
        });
      }

      const workflowState = finance.workflow_state || null;
      if (!workflowState || normalizeText(workflowState.status).toLowerCase() !== 'returned') {
        return res.status(409).json({
          status: 'error',
          message: 'Only returned requests can be resubmitted',
        });
      }

      const resubmissionComment = normalizeText(req.body?.feedback || req.body?.comment || req.body?.remarks);
      if (!resubmissionComment) {
        return res.status(400).json({
          status: 'error',
          message: 'Resubmission comments are required',
        });
      }

      const financeMeta = {
        unplannedBudgetEnabled: Boolean(finance.unplanned_budget_enabled),
        unplannedBudgetAmount:
          finance.unplanned_budget_amount !== undefined && finance.unplanned_budget_amount !== null
            ? Number(finance.unplanned_budget_amount)
            : null,
        unplannedBudgetDescription: normalizeText(finance.unplanned_budget_description) || null,
      };

      const resubmitMetadata = {
        origin: 'resubmit',
        requestId: null,
        moduleMetaVersion: 1,
        moduleMeta: {
          trigger: 'applicant_resubmit',
          amountBand: Number(finance.total_budget || 0) > 10000 ? 'gt_10k' : 'lte_10k',
          beneficiaryType: normalizeText(finance.beneficiary_type) || null,
          financeMeta,
        },
      };

      const restartResult = await workflowService.startWorkflow({
        moduleKey: 'finance',
        recordId: financeId,
        metadata: resubmitMetadata,
      });

      const resubmittedAt = new Date().toISOString();
      await financeModel.updateFinanceWorkflowSnapshot(financeId, {
        ...(restartResult.state || {}),
        status: 'in_progress',
        currentStage: restartResult.state?.currentStage || 'level1',
        isEditableByApplicant: false,
        lastDecision: 'resubmitted',
        lastFeedback: null,
        resubmittedAt,
        updatedAt: resubmittedAt,
        resolvedAt: null,
      });
      await workflowService.logWorkflowResubmission({
        moduleKey: 'finance',
        recordId: financeId,
        stage: restartResult.state?.currentStage || workflowState.currentStage || 'level1',
        feedback: resubmissionComment,
        actor: normalizeActor(req),
        snapshotBefore: workflowState,
        metadata: {
          ...resubmitMetadata,
          moduleMeta: {
            ...resubmitMetadata.moduleMeta,
            route: 'POST /api/finance-requests/:id/resubmit',
          },
        },
      });

      return res.status(200).json({
        status: 'success',
        message: 'Finance request resubmitted successfully',
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in resubmitFinanceRequest');
    }
  },

  async deleteFinanceRequest(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      const userId = toPositiveInt(req.user?.id);
      const isSuperAdmin = isSuperAdminRequest(req);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!isSuperAdmin && (!userId || toPositiveInt(finance.created_by) !== userId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Only applicant can delete this request',
        });
      }

      const workflowState = finance.workflow_state || null;
      const workflowStatus = normalizeText(workflowState?.status).toLowerCase();
      const currentStage = normalizeText(workflowState?.currentStage).toLowerCase();
      const hasStartedApproval = Boolean(workflowState) && currentStage && currentStage !== 'level1';

      if (
        !isSuperAdmin &&
        workflowStatus &&
        ['approved', 'rejected', 'archived', 'completed', 'returned'].includes(workflowStatus)
      ) {
        return res.status(409).json({
          status: 'error',
          message: 'This request can no longer be deleted',
        });
      }

      if (!isSuperAdmin && hasStartedApproval) {
        return res.status(409).json({
          status: 'error',
          message: 'This request can only be deleted before Level-1 approval',
        });
      }

      await financeModel.deleteFinanceRequest(financeId, normalizeActor(req));

      return res.status(200).json({
        status: 'success',
        message: 'Finance request deleted successfully',
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in deleteFinanceRequest');
    }
  },

  async getFinanceRequest(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!canAccessFinanceRecord(req, finance)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied',
        });
      }

      const budget = await financeModel.getBudgetBreakup(financeId);
      const incomeRows = await financeModel.getIncomeRows(financeId);

      let statusUpdates = [];
      try {
        const rawStatusUpdates = await financeModel.getStatusUpdates(financeId);
        statusUpdates = filterEntriesForCurrentCycle(rawStatusUpdates, finance);
      } catch (statusError) {
        console.error('Failed to fetch finance status updates:', statusError);
      }
      return res.status(200).json({
        status: 'success',
        data: sanitizeFinanceRecordForUser(req, {
          ...finance,
          budget,
          income_rows: incomeRows,
          status_updates: statusUpdates,
        }),
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getFinanceRequest');
    }
  },

  async listFinanceRequests(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const { mine, status } = req.query;

      const rows = await financeModel.listFinanceRequests({
        userId,
        mine: mine === 'true',
        status,
      });

      return res.json({
        status: 'success',
        data: rows.map(row => sanitizeFinanceRecordForUser(req, row)),
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in listFinanceRequests');
    }
  },

  async addBudgetBreakup(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      const rows = req.body;

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Budget breakup data is required',
        });
      }

      const exists = await financeModel.doesFinanceExist(financeId);
      if (!exists) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      await financeModel.addBudgetBreakup(financeId, rows);

      return res.status(201).json({
        status: 'success',
        message: 'Budget breakup added successfully',
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in addBudgetBreakup');
    }
  },

  async getBudgetBreakup(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const budget = await financeModel.getBudgetBreakup(financeId);

      return res.status(200).json({
        status: 'success',
        data: budget,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getBudgetBreakup');
    }
  },

  async getBudgetTags(req, res) {
    try {
      const tags = await financeModel.getBudgetTags();
      return res.status(200).json({
        success: true,
        status: 'success',
        data: tags,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getBudgetTags');
    }
  },

  async getOrgUnits(req, res) {
    try {
      const type = req.params.type;
      const units = await financeModel.getOrgUnitsByType(type);
      return res.status(200).json({
        success: true,
        status: 'success',
        data: units,
        count: units.length,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getOrgUnits');
    }
  },

  async getAllOrgUnits(req, res) {
    try {
      const units = await financeModel.getAllOrgUnits();
      const grouped = units.reduce((acc, unit) => {
        const key = unit.type_code;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(unit);
        return acc;
      }, {});

      return res.status(200).json({
        success: true,
        status: 'success',
        data: {
          all: units,
          grouped,
        },
        count: units.length,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getAllOrgUnits');
    }
  },

  async getBudgetAvailability(req, res) {
    try {
      const userId = toPositiveInt(req.user?.id);
      const budgetHead = normalizeText(req.query?.budget_head || req.query?.head);
      const subHead = normalizeText(req.query?.sub_head || req.query?.subHead);
      const preferredBudgetLineId = toPositiveInt(req.query?.budget_line_id);
      const excludeFinanceId = toPositiveInt(req.query?.finance_id);
      const beneficiaryType = normalizeText(req.query?.beneficiary_type || req.query?.beneficiaryType) || null;
      const beneficiaryValue = normalizeText(req.query?.beneficiary_value || req.query?.beneficiaryValue) || null;
      const departmentId = toPositiveInt(req.query?.department_id || req.query?.departmentId);
      const beneficiaryEntityId = toPositiveInt(
        req.query?.beneficiary_entity_id || req.query?.beneficiaryEntityId
      );
      const headOnlyMatch = ['1', 'true', 'yes', 'on'].includes(
        normalizeText(req.query?.head_only_match).toLowerCase()
      );

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid user context',
        });
      }

      if (!budgetHead || (!headOnlyMatch && !subHead)) {
        return res.status(400).json({
          status: 'error',
          message: headOnlyMatch
            ? 'budget_head is required'
            : 'budget_head and sub_head are required',
        });
      }

      const availability = await financeModel.getBudgetAvailabilityForUser({
        userId,
        userEmail: normalizeText(req.user?.email) || null,
        budgetHead,
        subHead,
        preferredBudgetLineId,
        headOnlyMatch,
        excludeFinanceId,
        beneficiaryType,
        beneficiaryValue,
        departmentId,
        beneficiaryEntityId,
      });

      return res.status(200).json({
        status: 'success',
        data: availability,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getBudgetAvailability');
    }
  },

  async approveFinanceWorkflow(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      const { decision, feedback, stageRemark } = req.body || {};
      const normalizedDecision = normalizeText(decision).toLowerCase();
      const normalizedStageRemark = normalizeText(stageRemark);
      const actor = normalizeActor(req);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      let result;
      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      const workflowStatus = normalizeText(
        finance.workflow_state?.status || finance.workflow_status || finance.overall_status
      ).toLowerCase();
      const currentStage = normalizeText(
        finance.workflow_state?.currentStage || finance.workflow_stage
      ).toLowerCase();
      const isTerminalWorkflow = ['completed', 'rejected', 'archived'].includes(workflowStatus);
      const canPersistStageRemark =
        ['dof', 'principal', 'chairman'].includes(currentStage) &&
        hasFinanceStagePermission(req, currentStage);

      if (normalizedStageRemark && canPersistStageRemark) {
        await financeModel.updateWorkflowStageRemark(financeId, currentStage, normalizedStageRemark);
      }

      if (actor.isSuperAdmin && normalizedDecision === 'returned' && isTerminalWorkflow) {
        result = await financeModel.forceWorkflowTransition(
          financeId,
          {
            decision: 'returned',
            feedback,
            actor,
            stageHint:
              normalizeText(finance.workflow_stage).toLowerCase() ||
              normalizeText(
                Array.isArray(finance.workflow_state?.flow)
                  ? finance.workflow_state.flow[finance.workflow_state.flow.length - 1]
                  : ''
              ).toLowerCase() ||
              'principal',
          }
        );
      } else {
        result = await workflowService.actOnWorkflow({
          moduleKey: 'finance',
          recordId: financeId,
          decision,
          feedback,
          actor,
          metadata: {
            origin: 'api',
            requestId: null,
            moduleMetaVersion: 1,
            moduleMeta: {
              route: 'PATCH /api/finance-requests/:id/approval',
            },
          },
        });
      }

      return res.status(200).json({
        status: 'success',
        message: `Workflow ${result.decision} at stage ${result.stage}`,
        data: {
          previousState: result.previousState,
          currentState: result.currentState,
        },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in approveFinanceWorkflow');
    }
  },

  async toggleArchiveStatus(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!canAccessFinanceRecord(req, finance)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied',
        });
      }

      const workflowStatus = normalizeText(
        finance.workflow_state?.status || finance.workflow_status || finance.overall_status
      ).toLowerCase();
      const isArchived = workflowStatus === 'archived' || workflowStatus === 'archive';
      const actor = normalizeActor(req);

      if (isArchived) {
        const latestArchive = await financeModel.getLatestArchiveAction(financeId);
        const archivedStage = normalizeText(latestArchive?.stage).toLowerCase();

        if (!hasFinanceStagePermission(req, archivedStage)) {
          return res.status(403).json({
            status: 'error',
            message: archivedStage
              ? `Only ${archivedStage.toUpperCase()} stage users (or super admin) can unarchive this request`
              : 'You are not allowed to unarchive this request',
          });
        }

        const restoreResult = await financeModel.restoreWorkflowSnapshotFromLatestArchive(financeId);
        if (!restoreResult.restored) {
          return res.status(409).json({
            status: 'error',
            message: restoreResult.reason || 'Unable to unarchive this request',
          });
        }

        return res.status(200).json({
          status: 'success',
          message: 'Finance request unarchived successfully',
          data: {
            workflow_state: restoreResult.restoredState,
          },
        });
      }

      const isTerminalWorkflow = ['completed', 'rejected'].includes(workflowStatus);
      if (actor.isSuperAdmin && isTerminalWorkflow) {
        const forcedArchiveResult = await financeModel.forceWorkflowTransition(
          financeId,
          {
            decision: 'archived',
            feedback: normalizeText(req.body?.feedback) || null,
            actor,
            stageHint:
              normalizeText(finance.workflow_stage).toLowerCase() ||
              normalizeText(
                Array.isArray(finance.workflow_state?.flow)
                  ? finance.workflow_state.flow[finance.workflow_state.flow.length - 1]
                  : ''
              ).toLowerCase() ||
              'principal',
          }
        );

        return res.status(200).json({
          status: 'success',
          message: 'Finance request archived successfully',
          data: {
            previousState: forcedArchiveResult.previousState,
            currentState: forcedArchiveResult.currentState,
          },
        });
      }

      const archiveResult = await workflowService.actOnWorkflow({
        moduleKey: 'finance',
        recordId: financeId,
        decision: 'archived',
        feedback: normalizeText(req.body?.feedback) || undefined,
        actor,
        metadata: {
          origin: 'api',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: {
            route: 'PATCH /api/finance-requests/:id/archive-toggle',
          },
        },
      });

      return res.status(200).json({
        status: 'success',
        message: 'Finance request archived successfully',
        data: {
          previousState: archiveResult.previousState,
          currentState: archiveResult.currentState,
        },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in toggleArchiveStatus');
    }
  },

  async getFinanceQueue(req, res) {
    try {
      const stage = normalizeText(req.params.stage).toLowerCase();
      const { page, limit, workflowStatus, statusCategory, level1Role, q, allProposals } = req.query;
      const normalizedLevel1Role = normalizeText(level1Role).toLowerCase();
      const effectiveLevel1Role = stage === 'level1'
        ? (['hod', 'coordinator'].includes(normalizedLevel1Role)
          ? normalizedLevel1Role
          : resolveFinanceLevel1QueueRole(req))
        : null;

      const queue = await workflowService.listQueue({
        moduleKey: 'finance',
        stage,
        actor: normalizeActor(req),
        filters: {
          page,
          limit,
          workflowStatus,
          statusCategory,
          level1Role: effectiveLevel1Role,
          q,
          allProposals: String(allProposals || '').toLowerCase() === 'true' || allProposals === '1',
        },
      });

      return res.status(200).json({
        status: 'success',
        data: queue.items.map((row) => sanitizeFinanceRecordForUser(req, row)),
        pagination: {
          total: queue.total,
          page: queue.page,
          limit: queue.limit,
          statusCounts: queue.statusCounts,
        },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getFinanceQueue');
    }
  },

  async getFinanceTimeline(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!canAccessFinanceRecord(req, finance)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied',
        });
      }

      const rawTimeline = await workflowService.getTimeline({
        moduleKey: 'finance',
        recordId: financeId,
      });
      const timeline = filterEntriesForCurrentCycle(rawTimeline, finance);

      return res.status(200).json({
        status: 'success',
        data: timeline,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getFinanceTimeline');
    }
  },

  async getWorkflowMeta(req, res) {
    try {
      const [metadata, availableBeneficiaryTypes] = await Promise.all([
        workflowService.getWorkflowMetadata({
          moduleKey: 'finance',
          actor: normalizeActor(req),
        }),
        financeModel.listAvailableBeneficiaryTypes(),
      ]);

      return res.status(200).json({
        status: 'success',
        data: {
          ...metadata,
          availableBeneficiaryTypes,
        },
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getWorkflowMeta');
    }
  },

  async getStatusUpdates(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!canAccessFinanceRecord(req, finance)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied',
        });
      }

      const updates = await financeModel.getStatusUpdates(financeId);
      const cycleScopedUpdates = filterEntriesForCurrentCycle(updates, finance);
      const timelineCompatible = cycleScopedUpdates.map((row) => ({
        id: row.id,
        moduleKey: 'finance',
        recordId: row.finance_id,
        stage: row.stage || row.role || null,
        decision: row.decision || row.status || null,
        feedback: row.feedback ?? row.comment ?? null,
        actorUserId: row.user_id || null,
        actorEmail: row.actor_email || null,
        actorRole: row.actor_role || null,
        decidedAt: row.decided_at || row.created_at || null,
        snapshotBefore: row.snapshot_before || null,
        meta: row.meta || null,
        summary: row.summary ?? row.comment ?? row.feedback ?? null,
        details: row.details ?? null,
        isAdmin: row.is_admin ?? null,
        role: row.role || null,
        status: row.status || null,
        comment: row.comment ?? row.feedback ?? null,
        createdAt: row.created_at || null,
        userName: row.user_name || null,
      }));

      return res.status(200).json({
        status: 'success',
        data: timelineCompatible,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getStatusUpdates');
    }
  },

  async getCurrentEmployeeInfo(req, res) {
    try {
      const userEmail = req.user?.email;

      if (!userEmail) {
        return res.status(400).json({
          status: 'error',
          message: 'User email not found',
        });
      }

      const employee = await financeModel.getEmployeeByEmail(userEmail);

      if (!employee) {
        return res.status(200).json({
          status: 'success',
          data: {
            name: req.user?.name || '',
            email: userEmail,
            employee_id: null,
          },
        });
      }

      return res.status(200).json({
        status: 'success',
        data: employee,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in getCurrentEmployeeInfo');
    }
  },

  async uploadAnnexureFile(req, res) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
      }

      if (file.mimetype !== 'application/pdf' || file.size >= 2 * 1024 * 1024) {
        if (file.path) {
          fs.promises.unlink(file.path).catch(() => {});
        }
        return res.status(400).json({
          status: 'error',
          message: 'Only PDF files with a size less than 2MB are allowed.',
        });
      }

      const annexureDir = path.resolve(process.cwd(), 'uploads', 'finance-annexures');
      await fs.promises.mkdir(annexureDir, { recursive: true });

      const extension = sanitizeAnnexureExtension(file.originalname);
      const storedName = `finance-annexure-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      const finalPath = path.resolve(annexureDir, storedName);
      const safeBase = `${annexureDir}${path.sep}`;
      if (!finalPath.startsWith(safeBase)) {
        throw new Error('Invalid annexure path');
      }

      const sourcePath = resolveSafeTempUploadPath(file.path);
      if (!sourcePath) {
        throw new Error('Invalid upload source path');
      }

      try {
        await fs.promises.access(sourcePath, fs.constants.F_OK);
      } catch {
        throw new Error('Invalid upload source path');
      }

      await fs.promises.rename(sourcePath, finalPath);

      return res.status(200).json({
        status: 'success',
        message: 'Annexure uploaded successfully',
        data: {
          originalName: file.originalname,
          storedName,
          filePath: `/uploads/finance-annexures/${storedName}`,
          mimeType: file.mimetype,
          size: file.size,
        },
      });
    } catch (error) {
      try {
        const cleanupPath = resolveSafeTempUploadPath(req.file?.path);
        if (cleanupPath) {
          await fs.promises.unlink(cleanupPath).catch((cleanupError) => {
            if (cleanupError?.code !== 'ENOENT') {
              throw cleanupError;
            }
          });
        }
      } catch {
        // Ignore cleanup errors
      }
      return handleWorkflowError(res, error, 'Error in uploadAnnexureFile');
    }
  },

  async uploadPrincipalDocument(req, res) {
    const uploadedFilePath = resolveSafeTempUploadPath(req.file?.path);
    let savedFilePath = null;

    try {
      const financeId = toPositiveInt(req.params.id);
      if (!financeId) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      if (!req.file) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded',
        });
      }

      const file = req.file;
      const originalName = normalizeText(file.originalname);
      const isPdf =
        normalizeText(file.mimetype).toLowerCase() === 'application/pdf' &&
        originalName.toLowerCase().endsWith('.pdf');

      if (!isPdf || file.size >= 2 * 1024 * 1024) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(400).json({
          status: 'error',
          message: 'Only PDF files with a size less than 2MB are allowed.',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!canManagePrincipalDocumentsRequest(req)) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(403).json({
          status: 'error',
          message: 'You do not have access to upload this document',
        });
      }

      if (!isEligibleForPrincipalDocument(finance)) {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        return res.status(409).json({
          status: 'error',
          message: 'Principal document is only available for proposals above 10000 at principal stage or after principal approval',
        });
      }

      await fs.promises.mkdir(FINANCE_PRINCIPAL_DOC_DIR, { recursive: true });

      const extension = '.pdf';
      const storedName = `finance-principal-${financeId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      const finalPath = path.resolve(FINANCE_PRINCIPAL_DOC_DIR, storedName);
      const safeBase = `${FINANCE_PRINCIPAL_DOC_DIR}${path.sep}`;
      if (!finalPath.startsWith(safeBase)) {
        throw new Error('Invalid principal document path');
      }

      if (!uploadedFilePath) {
        throw new Error('Invalid upload source path');
      }

      await fs.promises.rename(uploadedFilePath, finalPath);
      savedFilePath = finalPath;

      const previousDocument = await financeModel.getPrincipalDocument(financeId);

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await financeModel.setPrincipalDocument(financeId, {
          original_name: originalName || file.originalname || null,
          stored_name: storedName,
          file_path: `${FINANCE_PRINCIPAL_DOC_PUBLIC_PREFIX}${storedName}`,
          mime_type: 'application/pdf',
          file_size: file.size,
        }, { tx: connection });
        await connection.commit();
      } catch (dbError) {
        await connection.rollback();
        throw dbError;
      } finally {
        connection.release();
      }

      if (previousDocument?.file_path) {
        const previousPath = path.resolve(process.cwd(), `.${String(previousDocument.file_path || '').trim()}`);
        if (previousPath !== savedFilePath) {
          await fs.promises.unlink(previousPath).catch(() => {});
        }
      }

      return res.status(200).json({
        status: 'success',
        message: 'Principal document uploaded successfully',
        data: {
          originalName: originalName || file.originalname || null,
          storedName,
          filePath: `${FINANCE_PRINCIPAL_DOC_PUBLIC_PREFIX}${storedName}`,
          mimeType: 'application/pdf',
          size: file.size,
        },
      });
    } catch (error) {
      try {
        if (uploadedFilePath) {
          await fs.promises.unlink(uploadedFilePath).catch(() => {});
        }
        if (savedFilePath) {
          await fs.promises.unlink(savedFilePath).catch(() => {});
        }
      } catch {
        // ignore cleanup errors
      }
      return handleWorkflowError(res, error, 'Error in uploadPrincipalDocument');
    }
  },

  async deletePrincipalDocument(req, res) {
    try {
      const financeId = toPositiveInt(req.params.id);
      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      if (!canManagePrincipalDocumentsRequest(req)) {
        return res.status(403).json({
          status: 'error',
          message: 'You do not have access to delete this document',
        });
      }

      const finance = await financeModel.getFinanceRequestById(financeId);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (!isEligibleForPrincipalDocument(finance)) {
        return res.status(409).json({
          status: 'error',
          message: 'Principal document is only available for proposals above 10000 at principal stage or after principal approval',
        });
      }

      const document = await financeModel.getPrincipalDocument(financeId);
      if (!document) {
        return res.status(404).json({
          status: 'error',
          message: 'Principal document not found',
        });
      }

      await financeModel.deletePrincipalDocument(financeId);

      const resolvedPath = path.resolve(process.cwd(), `.${String(document.file_path || '').trim()}`);
      await fs.promises.unlink(resolvedPath).catch(() => {});

      return res.status(200).json({
        status: 'success',
        message: 'Principal document deleted successfully',
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in deletePrincipalDocument');
    }
  },

  async searchApplicant(req, res) {
    try {
      const query = req.query?.q;
      const rows = await financeModel.searchApplicant(query);

      return res.status(200).json({
        status: 'success',
        data: rows,
      });
    } catch (error) {
      return handleWorkflowError(res, error, 'Error in searchApplicant');
    }
  },
};

export default financeController;
