import financeModel from './financeModel.js';
import './financeWorkflowAdapter.js';
import workflowService from '../shared/workflow/workflowService.js';
import { WorkflowError } from '../shared/workflow/workflowValidators.js';

const normalizeText = (value) => String(value || '').trim();

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeActor = (req) => ({
  id: req.user?.id,
  userId: req.user?.id,
  email: req.user?.email,
  role: Array.isArray(req.user?.roles) ? req.user.roles[0] : null,
  roles: Array.isArray(req.user?.roles) ? req.user.roles : [],
  permissions: Array.isArray(req.user?.permissions) ? req.user.permissions : [],
  isSuperAdmin: Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin),
});

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

  if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)) {
    return true;
  }

  const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
  const normalizedPermissions = permissions.map((permission) => normalizeText(permission).toLowerCase());

  return normalizedPermissions.includes(`finance.workflow.${normalizedStage}`);
};

const hasFinanceWorkflowEditorAccess = (req) =>
  Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || hasAnyFinanceWorkflowPermission(req);

const canAccessFinanceRecord = (req, financeRecord) => {
  const actorUserId = toPositiveInt(req.user?.id);

  if (!financeRecord) {
    return false;
  }

  if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)) {
    return true;
  }

  if (actorUserId && actorUserId === toPositiveInt(financeRecord.created_by)) {
    return true;
  }

  return hasAnyFinanceWorkflowPermission(req);
};

const handleWorkflowError = (res, error, fallbackMessage) => {
  if (error instanceof WorkflowError) {
    return res.status(error.statusCode || 400).json({
      status: 'error',
      message: error.message,
      code: error.code,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    status: 'error',
    message: error.message || fallbackMessage,
  });
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
      const totalBudgetAmount = budgetRows.length
        ? budgetRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)
        : Number(data.total_budget || 0);
      const amountBand = Number(totalBudgetAmount) > 10000 ? 'gt_10k' : 'lte_10k';

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
            },
          },
        });
      } catch (workflowError) {
        try {
          await financeModel.deleteFinanceRequest(financeId);
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

      if (isCreator && !isApplicantEditable) {
        return res.status(403).json({
          status: 'error',
          message: 'This request is not editable in current workflow state',
        });
      }

      if (isWorkflowEditor && isTerminalWorkflow && !Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)) {
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

      const restartResult = await workflowService.startWorkflow({
        moduleKey: 'finance',
        recordId: financeId,
        metadata: {
          origin: 'resubmit',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: {
            trigger: 'applicant_resubmit',
            amountBand: Number(finance.total_budget || 0) > 10000 ? 'gt_10k' : 'lte_10k',
          },
        },
      });

      const resubmittedAt = new Date().toISOString();
      await financeModel.updateFinanceWorkflowSnapshot(financeId, {
        ...(restartResult.state || {}),
        status: 'in_progress',
        currentStage: 'level1',
        isEditableByApplicant: false,
        lastDecision: 'resubmitted',
        lastFeedback: null,
        resubmittedAt,
        updatedAt: resubmittedAt,
        resolvedAt: null,
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
          message: 'Only applicant can delete this request',
        });
      }

      const workflowState = finance.workflow_state || null;
      const workflowStatus = normalizeText(workflowState?.status).toLowerCase();
      const currentStage = normalizeText(workflowState?.currentStage).toLowerCase();
      const hasStartedApproval = Boolean(workflowState) && currentStage && currentStage !== 'level1';

      if (workflowStatus && ['approved', 'rejected', 'archived', 'completed', 'returned'].includes(workflowStatus)) {
        return res.status(409).json({
          status: 'error',
          message: 'This request can no longer be deleted',
        });
      }

      if (hasStartedApproval) {
        return res.status(409).json({
          status: 'error',
          message: 'This request can only be deleted before Level-1 approval',
        });
      }

      await financeModel.deleteFinanceRequest(financeId);

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
      const statusUpdates = await financeModel.getStatusUpdates(financeId);

      return res.status(200).json({
        status: 'success',
        data: {
          ...finance,
          budget,
          income_rows: incomeRows,
          status_updates: statusUpdates,
        },
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
        data: rows,
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

      if (!userId) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid user context',
        });
      }

      if (!budgetHead || !subHead) {
        return res.status(400).json({
          status: 'error',
          message: 'budget_head and sub_head are required',
        });
      }

      const availability = await financeModel.getBudgetAvailabilityForUser({
        userId,
        userEmail: normalizeText(req.user?.email) || null,
        budgetHead,
        subHead,
        preferredBudgetLineId,
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
      const { decision, feedback } = req.body || {};

      if (!financeId) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid finance request ID',
        });
      }

      const result = await workflowService.actOnWorkflow({
        moduleKey: 'finance',
        recordId: financeId,
        decision,
        feedback,
        actor: normalizeActor(req),
        metadata: {
          origin: 'api',
          requestId: null,
          moduleMetaVersion: 1,
          moduleMeta: {
            route: 'PATCH /api/finance-requests/:id/approval',
          },
        },
      });

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

      const archiveResult = await workflowService.actOnWorkflow({
        moduleKey: 'finance',
        recordId: financeId,
        decision: 'archived',
        feedback: normalizeText(req.body?.feedback) || undefined,
        actor: normalizeActor(req),
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
      const { page, limit, workflowStatus, level1Role } = req.query;
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
          level1Role: effectiveLevel1Role,
        },
      });

      return res.status(200).json({
        status: 'success',
        data: queue.items,
        pagination: {
          total: queue.total,
          page: queue.page,
          limit: queue.limit,
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

      const timeline = await workflowService.getTimeline({
        moduleKey: 'finance',
        recordId: financeId,
      });

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
      const metadata = await workflowService.getWorkflowMetadata({
        moduleKey: 'finance',
        actor: normalizeActor(req),
      });

      return res.status(200).json({
        status: 'success',
        data: metadata,
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
      const timelineCompatible = updates.map((row) => ({
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
