import express from 'express';
import {
  getFinanceRecords,
  getFinanceById,
  createFinance,
  updateFinance,
  deleteFinance,
} from './financeController.js';
import asyncHandler from '../../../middleware/asyncHandler.js';

const router = express.Router();

// Finance APIs
router.get('/', asyncHandler(getFinanceRecords)); // GET all finance records
router.get('/:id', asyncHandler(getFinanceById)); // GET finance record by ID (with details)
router.post('/', asyncHandler(createFinance)); // CREATE new finance record
router.put('/:id', asyncHandler(updateFinance)); // UPDATE finance record (and related items)
router.delete('/:id', asyncHandler(deleteFinance)); // DELETE finance record (cascade cleans related rows)

export default router;
