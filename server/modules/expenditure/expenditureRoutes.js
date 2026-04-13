/**
 * expenditureRoutes.js
 *
 * Express router for the Expenditure (Advance) module.
 * All routes require authentication via authMiddleware.
 * Includes Dashboard, Form Auto-fill, Budget, Payee, and CRUD operations.
 */

import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import expenditureController from './expenditureController.js';
import * as expenditureModel from './expenditureModel.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';

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

// ─── Delete guard ─────────────────────────────────────────────────────────────
const canDelete = async (req, res, next) => {
  try {
    if (Boolean(req.user?.is_super_admin || req.user?.isSuperAdmin)) return next();

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

// ─── Apply auth to every route ────────────────────────────────────────────────
router.use(authMiddleware);

// ─── Dashboard ────────────────────────────────────────────────────────────────
/**
 * GET /expenditure/dashboard
 * Returns summary statistics for the expenditure module.
 */
router.get('/dashboard', expenditureController.getExpenditureDashboard);

// ─── Utility & Context ────────────────────────────────────────────────────────
router.get('/templates/bulk-neft', expenditureController.downloadBulkNeftTemplate);
router.get('/finance-context/:financeId', expenditureController.getFinanceRequestContext);

// ─── Applicant auto-fill ──────────────────────────────────────────────────────
router.get('/me', expenditureController.getCurrentEmployeeInfo);
router.get('/search-applicant', expenditureController.searchApplicant);

// ─── Budget & Advances ────────────────────────────────────────────────────────
router.get('/budget/approved', expenditureController.getApprovedBudgets);
router.get('/advance-summary', expenditureController.getAdvanceSummary);

// ─── Payee master ─────────────────────────────────────────────────────────────
router.get('/payees', expenditureController.listPayees);
router.post('/payees', expenditureController.createPayee);
router.get('/payees/:id', expenditureController.getPayee);

// ─── Expenditure Requests (CRUD) ──────────────────────────────────────────────
router.get('/', expenditureController.listExpenditures);
router.get('/:id', expenditureController.getExpenditure);
router.get('/:id/timeline', expenditureController.getTimeline);

router.post(
  '/',
  expenditureUpload.fields([
    { name: 'bulk_neft_file', maxCount: 1 },
    { name: 'bill_files', maxCount: 20 },
  ]),
  expenditureController.createExpenditureRequest,
);

router.post('/advance', expenditureController.createAdvance);
router.put('/:id', expenditureController.updateExpenditure);
router.delete('/:id', canDelete, expenditureController.deleteExpenditure);

export default router;