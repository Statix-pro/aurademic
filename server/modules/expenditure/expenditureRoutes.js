import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import expenditureController from './expenditureController.js';
import * as expenditureModel from './expenditureModel.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';

const router = express.Router();
const expenditureUploadRoot = path.join(process.cwd(), 'uploads', 'expenditure');

const ensureUploadDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

const sanitizeFilename = (filename = '') => {
  const extension = path.extname(filename);
  const basename = path
    .basename(filename, extension)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 80);

  return `${basename || 'file'}${extension}`;
};

const expenditureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const directoryPath = file.fieldname === 'bulk_neft_file'
        ? path.join(expenditureUploadRoot, 'bulk-neft')
        : path.join(expenditureUploadRoot, 'bills');

      ensureUploadDirectory(directoryPath);
      cb(null, directoryPath);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${sanitizeFilename(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'bulk_neft_file') {
      cb(null, true);
      return;
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    if (extension === '.xlsx' || extension === '.xls') {
      cb(null, true);
      return;
    }

    cb(new Error('Bulk NEFT upload only accepts .xlsx or .xls files'));
  },
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 21,
  },
});

const EXPENDITURE_WORKFLOW_PERMISSIONS = [
  'expenditure.workflow.*',
];

const canAccessExpenditureWorkflow = permissionMiddleware(EXPENDITURE_WORKFLOW_PERMISSIONS);

const canDelete = async (req, res, next) => {
  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const hasWorkflowPermission = permissions.some((permission) =>
      String(permission || '').trim().startsWith('expenditure.workflow.')
    );

    if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin) || hasWorkflowPermission) return next();

    const id = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.user?.id, 10);

    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return next();
    }

    const owner = await expenditureModel.getExpenditureOwner(id);
    if (!owner) return next();

    if (Number.parseInt(owner.created_by, 10) === userId) return next();

    return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
  } catch {
    return res.status(500).json({ status: 'error', message: 'Failed to validate permissions' });
  }
};

router.use(authMiddleware);

router.get('/dashboard', expenditureController.getExpenditureDashboard);

router.get('/templates/bulk-neft', expenditureController.downloadBulkNeftTemplate);
router.get('/finance-context/:financeId', expenditureController.getFinanceRequestContext);

router.get('/me', expenditureController.getCurrentEmployeeInfo);
router.get('/search-applicant', expenditureController.searchApplicant);

router.get('/budget/approved', expenditureController.getApprovedBudgets);
router.get('/advance-summary', expenditureController.getAdvanceSummary);

router.get('/payees', expenditureController.listPayees);
router.post('/payees', expenditureController.createPayee);
router.get('/payees/:id', expenditureController.getPayee);

router.get('/', expenditureController.listExpenditures);
router.get('/workflow/meta', canAccessExpenditureWorkflow, expenditureController.getWorkflowMeta);
router.get('/queue/:stage', canAccessExpenditureWorkflow, expenditureController.getExpenditureQueue);
router.patch('/:id/approval', canAccessExpenditureWorkflow, expenditureController.approveExpenditureWorkflow);
router.patch('/:id/archive-toggle', canAccessExpenditureWorkflow, expenditureController.toggleArchiveStatus);
router.post('/:id/resubmit', expenditureController.resubmitExpenditureRequest);
router.get('/:id/status-updates', expenditureController.getStatusUpdates);

router.get('/:id', expenditureController.getExpenditure);
router.get('/:id/timeline', expenditureController.getExpenditureWorkflowTimeline);

router.post(
  '/',
  expenditureUpload.fields([
    { name: 'bulkneftfile', maxCount: 1 },
    { name: 'billfiles', maxCount: 20 },
  ]),
  expenditureController.createExpenditureRequest,
);

router.post('/advance', expenditureController.createAdvance);
router.put('/:id', expenditureController.updateExpenditure);
router.delete('/:id', canDelete, expenditureController.deleteExpenditure);

export default router;
