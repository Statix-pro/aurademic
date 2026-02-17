// modules/budget/budgetRoutes.js

import express from 'express';
import BudgetController from './budgetController.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import upload from '../../middleware/uploadMiddleware.js';
import BudgetModel from './budgetModel.js';

const router = express.Router();

/* =====================================================
   GLOBAL AUTH (All budget routes require login)
===================================================== */
router.use(authMiddleware);

/* =====================================================
   LIGHT ROLE GUARD MIDDLEWARE
===================================================== */
const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user?.role || !roles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: `Access denied. Required roles: ${roles.join(', ')}` 
    });
  }
  next();
};

/* =====================================================
   CRITICAL: ROUTE ORDER MATTERS!
   
   Express matches routes in registration order:
   1. Health/utility
   2. Static paths (/faculty, /my, /hod, /export, etc.)
   3. Dynamic ID paths (/:id/history, /:id/approval)
   4. Generic /:id (ALWAYS LAST)
   
   Static paths MUST come before /:id to prevent conflicts
===================================================== */

/* =====================================================
   0. HEALTH CHECK & UTILITIES
===================================================== */
/**
 * Budget module health check
 * GET /api/budget/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    module: 'budget',
    version: 'v8.0',
    schema: 'org_units_integrated_production',
    timestamp: new Date().toISOString(),
    user: req.user ? { 
      id: req.user.id,
      role: req.user.role, 
      department: req.user.department 
    } : null
  });
});

/* =====================================================
   1. FORM SUPPORT & METADATA (STATIC PATHS)
===================================================== */
/**
 * Faculty auto-fill (JWT → employee_id, name, email)
 * GET /api/budget/faculty
 */
router.get('/faculty', BudgetController.getFacultyDetails);

/**
 * GET Approval flow configs (admin/form reference)
 * GET /api/budget/approval-flows
 */
router.get('/approval-flows', BudgetController.getApprovalFlows);

/**
 * GET Org Units by type (for dropdowns)
 * GET /api/budget/org-units/:type
 * Examples: /api/budget/org-units/DEPARTMENT
 */
router.get('/org-units/:type', BudgetController.getOrgUnits);

/* =====================================================
   2. DASHBOARDS (STATIC PATHS - BEFORE /:id)
===================================================== */
/**
 * User dashboard (own submissions)
 * GET /api/budget/my?page=1&limit=10&status=submitted&fiscalYear=2026
 */
router.get('/my', BudgetController.getMyBudgets);

/**
 * HOD dashboard (department-specific)
 * GET /api/budget/hod?page=1&limit=10&status=submitted&fiscalYear=2026
 */
router.get('/hod', requireRoles('hod'), BudgetController.getHodBudgets);

/**
 * DoF dashboard (all proposals at DoF/Principal stage)
 * GET /api/budget/dof?page=1&limit=20&status=dof_approved&fiscalYear=2026
 */
router.get('/dof', requireRoles('dof'), BudgetController.getDofBudgets);

/**
 * Principal dashboard (final approval stage)
 * GET /api/budget/principal?page=1&limit=10&status=principal_approved&fiscalYear=2026
 */
router.get('/principal', requireRoles('principal'), BudgetController.getPrincipalBudgets);

/**
 * Aggregates for charts/tables
 * GET /api/budget/aggregates?fiscalYear=2026
 */
router.get('/aggregates', BudgetController.getAggregates);

/**
 * Dashboard stats (cards: pending/approved/rejected counts)
 * GET /api/budget/stats?fiscalYear=2026
 */
router.get('/stats', BudgetController.getStats);

/* =====================================================
   3. ADMIN & REPORTING (STATIC PATHS)
===================================================== */
/**
 * Admin list (role-based filtering)
 * GET /api/budget/admin?page=1&status=submitted&fiscalYear=2026
 */
router.get('/admin', requireRoles('hod', 'dof', 'principal'), BudgetController.adminList);

/**
 * Bulk export (CSV/JSON)
 * GET /api/budget/export?fiscalYear=2026&status=completed&format=csv
 * DoF/Principal only
 */
router.get('/export', requireRoles('dof', 'principal'), BudgetController.export);

/**
 * Advanced search
 * GET /api/budget/search?q=CSE&status=hod_approved&fiscalYear=2026
 */
router.get('/search', async (req, res) => {
  try {
    const { q, status, fiscalYear } = req.query;
    
    // Role-based search scope
    const filters = {
      userId: req.user.id,
      userEmail: req.user.email,
      role: req.user.role,
      department: req.user.role === 'hod' ? req.user.department : undefined,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      status,
      page: 1,
      limit: 100
    };

    const budgets = await BudgetModel.listBudgets(filters);

    // Client-side filtering if query provided
    let results = budgets.budgets;
    if (q) {
      const query = q.toLowerCase();
      results = results.filter(b => 
        b.proposal_ref?.toLowerCase().includes(query) ||
        b.beneficiary_value?.toLowerCase().includes(query) ||
        b.department?.toLowerCase().includes(query) ||
        b.org_unit_name?.toLowerCase().includes(query)
      );
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      filters: req.query
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
});

/* =====================================================
   4. ADMIN CONFIG MANAGEMENT (STATIC PATH)
===================================================== */
/**
 * Update approval flow config (Principal only)
 * PATCH /api/budget/admin/flow/:id
 */
router.patch(
  '/admin/flow/:id(\\d+)', 
  requireRoles('principal'), 
  BudgetController.updateFlowConfig
);

/* =====================================================
   5. CREATE & UPDATE OPERATIONS
===================================================== */
/**
 * CREATE proposal
 * POST /api/budget
 */
router.post('/', BudgetController.create);

/**
 * UPDATE proposal (draft/returned only)
 * PUT /api/budget/:id
 */
router.put('/:id(\\d+)', BudgetController.update);

/* =====================================================
   6. PER-PROPOSAL OPERATIONS (DYNAMIC ID PATHS)
   Using /:id(\\d+) regex to ensure numeric IDs
===================================================== */
/**
 * GET proposal history/audit trail
 * GET /api/budget/:id/history
 */
router.get('/:id(\\d+)/history', BudgetController.getHistory);

/**
 * GET month-wise allocations report
 * GET /api/budget/:id/allocations
 */
router.get('/:id(\\d+)/allocations', BudgetController.getMonthAllocations);

/**
 * GET quick status check
 * GET /api/budget/:id/status
 */
router.get('/:id(\\d+)/status', BudgetController.getStatus);

/**
 * APPROVAL endpoint (HOD/DoF/Principal)
 * PATCH /api/budget/:id/approval
 * Body: {decision: 'approved'|'rejected'|'returned', feedback?: string}
 */
router.patch(
  '/:id(\\d+)/approval', 
  requireRoles('hod', 'dof', 'principal'), 
  BudgetController.approve
);

// /:id routes section (Validation: ID must be numeric)
router.delete('/:id(\\d+)', BudgetController.deleteProposal);

/**
 * File upload (sanction letters, attachments)
 * POST /api/budget/:id/upload
 */
router.post(
  '/:id(\\d+)/upload',
  upload.fields([
    { name: 'sanctionLetter', maxCount: 1 },
    { name: 'attachments', maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      // Access check
      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        req.user.id,
        req.user.email,
        req.user.role,
        req.user.department
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // TODO: Save file paths to database (budget_proposal_files table)
      res.json({
        success: true,
        message: 'Files uploaded successfully',
        data: {
          proposalId,
          sanctionLetter: req.files?.sanctionLetter?.[0] ? {
            filename: req.files.sanctionLetter[0].originalname,
            path: req.files.sanctionLetter[0].path,
            size: req.files.sanctionLetter[0].size
          } : null,
          attachments: req.files?.attachments?.map(f => ({
            filename: f.originalname,
            path: f.path,
            size: f.size,
            mimetype: f.mimetype
          })) || []
        }
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/* =====================================================
   7. GET SINGLE PROPOSAL (ALWAYS LAST!)
===================================================== */
/**
 * GET single proposal (full details)
 * GET /api/budget/:id
 * Used for: form load, view, edit
 */
router.get('/:id(\\d+)', BudgetController.get);

/* =====================================================
   ERROR HANDLER (Catch-all for this router)
===================================================== */
router.use((err, req, res, next) => {
  console.error('Budget routes error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default router;
