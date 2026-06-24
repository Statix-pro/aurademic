import express from 'express';
import financeController from './financeController.js';
import financeModel from './financeModel.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

const FINANCE_WORKFLOW_PERMISSIONS = [
  'finance.workflow.*',
];

const canAccessFinanceWorkflow = permissionMiddleware(FINANCE_WORKFLOW_PERMISSIONS);

const canDeleteFinanceRequest = async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const hasWorkflowPermission = permissions.some((permission) =>
      String(permission || '').trim().startsWith('finance.workflow.')
    );

    if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || hasWorkflowPermission) {
      return next();
    }

    const financeId = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.user?.id, 10);

    if (!Number.isInteger(financeId) || financeId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return next();
    }

    const owner = await financeModel.getFinanceOwner(financeId);

    if (!owner) {
      return next();
    }

    if (Number.parseInt(owner.created_by, 10) === userId) {
      return next();
    }

    return res.status(403).json({
      message: 'Insufficient permissions',
      requiredPermissions: FINANCE_WORKFLOW_PERMISSIONS,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to validate permissions',
    });
  }
};

router.use(authMiddleware);

// Core request APIs
router.post('/', financeController.createFinanceRequest);
router.get('/', financeController.listFinanceRequests);
router.get('/tags', financeController.getBudgetTags);
router.get('/org-units', financeController.getAllOrgUnits);
router.get('/org-units/:type', financeController.getOrgUnits);
router.get('/budget-availability', financeController.getBudgetAvailability);
router.get('/search-applicant', financeController.searchApplicant);
router.get('/me', financeController.getCurrentEmployeeInfo);
router.post('/annexure/upload', upload.single('file'), financeController.uploadAnnexureFile);
router.post('/:id/principal-document', upload.single('file'), financeController.uploadPrincipalDocument);
router.delete('/:id/principal-document', financeController.deletePrincipalDocument);

// Workflow metadata + queues
router.get('/workflow/meta', canAccessFinanceWorkflow, financeController.getWorkflowMeta);
router.get('/queue/:stage', canAccessFinanceWorkflow, financeController.getFinanceQueue);

// Workflow actions
router.patch('/:id/approval', canAccessFinanceWorkflow, financeController.approveFinanceWorkflow);
router.patch('/:id/archive-toggle', canAccessFinanceWorkflow, financeController.toggleArchiveStatus);
router.post('/:id/resubmit', financeController.resubmitFinanceRequest);
router.delete('/:id', canDeleteFinanceRequest, financeController.deleteFinanceRequest);

// Timeline / compatibility endpoint
router.get('/:id/timeline', financeController.getFinanceTimeline);
router.get('/:id/status-updates', financeController.getStatusUpdates);

// Budget breakup
router.post('/:id/budget', financeController.addBudgetBreakup);
router.get('/:id/budget', financeController.getBudgetBreakup);

// Request CRUD
router.get('/:id', financeController.getFinanceRequest);
router.put('/:id', financeController.updateFinanceRequest);

export default router;
