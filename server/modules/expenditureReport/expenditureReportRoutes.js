import express from 'express';

import * as ExpenditureReportController from './expenditureReportController.js';
import {
  authMiddleware,
  authorizationSnapshotMiddleware,
} from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * No permission middleware beyond authentication: the model's scope resolver is the gate.
 * It grants institution-wide figures only to Super Admin / Admin / DOF / Principal, narrows
 * HODs to their departments and coordinators to their entities, and falls back to the
 * caller's own requests for every other role — so an unlisted role degrades to the least
 * privilege rather than being locked out or over-served.
 *
 * authorizationSnapshotMiddleware is required, not optional: authMiddleware fills req.user
 * from the JWT claims alone, so a token minted before a role was granted would carry stale
 * roles and quietly scope a DOF down to their own requests. The snapshot re-reads roles from
 * access_control on every call, which is what the scope resolver reads.
 */
router.use(authMiddleware);
router.use(authorizationSnapshotMiddleware);

// Fiscal-year and beneficiary-type dropdown options come from the existing
// GET /api/expenditure/workflow/meta — no duplicate options endpoint here.
router.get('/consolidation', ExpenditureReportController.getConsolidation);
router.get('/beneficiary-summary', ExpenditureReportController.getBeneficiarySummary);
router.get('/monthly', ExpenditureReportController.getMonthlyBreakdown);

export default router;
