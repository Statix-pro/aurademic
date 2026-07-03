import express from 'express';

import {
  getFinanceRecords,
  getFinanceById,
  createFinance,
  updateFinance,
  deleteFinance,
} from './financeController.js';
import { authMiddleware } from '../../../middleware/authMiddleware.js';

const router = express.Router();

// All event-finance endpoints require authentication.
router.use(authMiddleware);

// Finance APIs
router.get('/', getFinanceRecords); // GET all finance records
router.get('/:id', getFinanceById); // GET finance record by ID (with details)
router.post('/', createFinance); // CREATE new finance record
router.put('/:id', updateFinance); // UPDATE finance record (and related items)
router.delete('/:id', deleteFinance); // DELETE finance record (cascade cleans related rows)

export default router;
