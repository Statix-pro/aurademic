import fs from 'fs';
import path from 'path';

import express from 'express';
import multer from 'multer';

import expenditureController from './expenditureController.js';
import * as expenditureModel from './expenditureModel.js';
import { authMiddleware, permissionMiddleware } from '../../middleware/authMiddleware.js';
import { sanitizeUploadFilename } from '../shared/uploadPaths.js';

const router = express.Router();
const expenditureUploadRoot = path.join(process.cwd(), 'uploads', 'expenditure');

const ensureUploadDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

// LEGACY: `bulk_neft_file` is the pre-"Bulk Transaction" field name. Remove once no
// deployed client still posts it (renamed to bulk_transaction_file).
const BULK_TRANSACTION_FILE_FIELDS = new Set(['bulk_transaction_file', 'bulk_neft_file']);

// Widest set any bulk transaction mode accepts: the Excel modes (NEFT/RTGS/UPI) take
// only .xlsx/.xls, DD additionally takes a scan of the instrument. Everything here is
// served back by express.static from /uploads, so formats the browser renders as an
// active document (.html, .svg, .xml, scripts) are deliberately excluded — a stored
// one would be a same-origin XSS URL for whoever opens the request. The per-mode
// narrowing happens in expenditureController.js, which can see the selected mode.
const BULK_TRANSACTION_ALLOWED_EXTENSIONS = [
  '.xlsx',
  '.xls',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tif',
  '.tiff',
  '.doc',
  '.docx',
];

const rejectedUploadError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const expenditureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const directoryPath = BULK_TRANSACTION_FILE_FIELDS.has(file.fieldname)
        ? path.join(expenditureUploadRoot, 'bulk-neft')
        : file.fieldname === 'payment_proof_files'
          ? path.join(expenditureUploadRoot, 'payment-proofs')
          : path.join(expenditureUploadRoot, 'bills');

      ensureUploadDirectory(directoryPath);
      cb(null, directoryPath);
    },
    filename: (req, file, cb) => {
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniquePrefix}-${sanitizeUploadFilename(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (BULK_TRANSACTION_FILE_FIELDS.has(file.fieldname)) {
      if (BULK_TRANSACTION_ALLOWED_EXTENSIONS.includes(extension)) {
        return cb(null, true);
      }

      return cb(
        rejectedUploadError(
          `Bulk transaction upload accepts only ${BULK_TRANSACTION_ALLOWED_EXTENSIONS.join(', ')} files`,
        ),
      );
    }
    if (file.fieldname === 'bill_files') {
      if (extension === '.pdf') {
        return cb(null, true);
      }

      return cb(rejectedUploadError('Bill files only accept .pdf'));
    }
    if (file.fieldname === 'payment_proof_files') {
      if (['.pdf', '.png', '.jpg', '.jpeg'].includes(extension)) {
        return cb(null, true);
      }

      return cb(rejectedUploadError('Payment proof only accepts .pdf, .png, .jpg, or .jpeg files'));
    }
    return cb(rejectedUploadError('Invalid file field'));
  },
});

/**
 * Runs a multer middleware and answers a rejected upload with 400 in the shape every other
 * endpoint returns. Without this the bare fileFilter error reaches the global handler,
 * which defaults to `err.status || 500` — the client then shows a generic failure and the
 * user loses the whole form.
 */
const handleUploadErrors = (uploadMiddleware) => (req, res, next) =>
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();

    const isRejectedUpload = err.status === 400 || err instanceof multer.MulterError;
    if (!isRejectedUpload) return next(err);

    const message =
      err.code === 'LIMIT_UNEXPECTED_FILE'
        ? `Unexpected upload field: ${err.field}`
        : err.message || 'Upload rejected';

    return res.status(400).json({ success: false, message, error: message });
  });

const EXPENDITURE_WORKFLOW_PERMISSIONS = ['expenditure.workflow.*'];

const canAccessExpenditureWorkflow = permissionMiddleware(EXPENDITURE_WORKFLOW_PERMISSIONS);
const refreshExpenditureAuthorization = permissionMiddleware([]);
const canAccessExpenditureWorkflowForAdmins = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : req.user?.roles
      ? [req.user.roles]
      : req.user?.role
        ? [req.user.role]
        : [];
  const normalizedRoles = roles.map((role) =>
    String(role || '')
      .trim()
      .toLowerCase(),
  );
  const isWorkflowRole = normalizedRoles.some((role) =>
    ['admin', 'hod', 'coordinator', 'dof', 'principal', 'entity_approver'].includes(role),
  );

  if (
    Boolean(
      req.user?.isAdmin || req.user?.is_admin || req.user?.is_super_admin || req.user?.isSuperAdmin,
    ) ||
    isWorkflowRole
  ) {
    return next();
  }

  return canAccessExpenditureWorkflow(req, res, next);
};

const canDelete = async (req, res, next) => {
  try {
    const isSuperAdmin = Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin);

    if (isSuperAdmin) return next();

    const id = Number.parseInt(req.params.id, 10);
    const userId = Number.parseInt(req.user?.id, 10);

    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return next(); // revert to old behavior (not fail-closed)
    }

    const owner = await expenditureModel.getExpenditureOwner(id);

    if (!owner) return next(); // revert

    if (Number.parseInt(owner.created_by, 10) === userId) {
      return next();
    }

    return res.status(403).json({
      status: 'error',
      message: 'Insufficient permissions',
    });
  } catch {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to validate permissions',
    });
  }
};

router.use(authMiddleware);

router.get('/dashboard', expenditureController.getExpenditureDashboard);

router.get('/templates/bulk-transaction', expenditureController.downloadBulkTransactionTemplate);
// LEGACY: pre-rename template route. Remove once no deployed client calls it.
router.get('/templates/bulk-neft', expenditureController.downloadBulkTransactionTemplate);
router.get('/finance-context/:financeId', expenditureController.getFinanceRequestContext);

router.get('/me', expenditureController.getCurrentEmployeeInfo);
router.get('/search-applicant', expenditureController.searchApplicant);

router.get('/budget/approved', expenditureController.getApprovedBudgets);
router.get('/advance-summary', expenditureController.getAdvanceSummary);

router.get('/payees', expenditureController.listPayees);
router.post('/payees', expenditureController.createPayee);
router.get('/payees/:id', expenditureController.getPayee);
router.patch(
  '/payees/:id',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.updatePayee,
);
router.patch(
  '/payees/:id/approval',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.updatePayeeApproval,
);
router.delete(
  '/payees/:id',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.deletePayee,
);

router.get('/', expenditureController.listExpenditures);
router.get(
  '/workflow/meta',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.getWorkflowMeta,
);
router.get(
  '/queue/:stage/export',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.getExpenditureQueueExport,
);
router.get(
  '/queue/:stage',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.getExpenditureQueue,
);
router.patch(
  '/:id/approval',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.approveExpenditureWorkflow,
);
router.patch(
  '/:id/archive-toggle',
  canAccessExpenditureWorkflowForAdmins,
  expenditureController.toggleArchiveStatus,
);
router.post('/:id/resubmit', expenditureController.resubmitExpenditureRequest);
router.get('/:id/status-updates', expenditureController.getStatusUpdates);

router.get('/:id', refreshExpenditureAuthorization, expenditureController.getExpenditure);
router.get(
  '/:id/timeline',
  refreshExpenditureAuthorization,
  expenditureController.getExpenditureWorkflowTimeline,
);

router.post(
  '/',
  handleUploadErrors(
    expenditureUpload.fields([
      { name: 'bulk_transaction_file', maxCount: 1 },
      // LEGACY: pre-rename field name, kept so older clients keep working.
      { name: 'bulk_neft_file', maxCount: 1 },
      { name: 'bill_files', maxCount: 1 },
      { name: 'payment_proof_files', maxCount: 5 },
    ]),
  ),
  expenditureController.createExpenditureRequest,
);

router.post('/advance', expenditureController.createAdvance);
router.put(
  '/:id',
  refreshExpenditureAuthorization,
  handleUploadErrors(
    expenditureUpload.fields([
      { name: 'bulk_transaction_file', maxCount: 1 },
      // LEGACY: pre-rename field name, kept so older clients keep working.
      { name: 'bulk_neft_file', maxCount: 1 },
      { name: 'bill_files', maxCount: 1 },
      { name: 'payment_proof_files', maxCount: 5 },
    ]),
  ),
  expenditureController.updateExpenditure,
);
router.delete('/:id', canDelete, expenditureController.deleteExpenditure);

export default router;
