// modules/budget/budgetController.js - PRODUCTION v12.0 (Feb 17, 2026 - FINAL UPGRADE)
// UPGRADED: Explicit fiscal_year support + Bulletproof access validation

import BudgetModel from "./budgetModel.js";

const VALID_BENEFICIARY_TYPES = [
  'Faculty', 'Department', 'Centre', 'Cell', 'Club', 'Institution', 'Professional Body'
];

class BudgetController {
  /* =====================================================
     1. FACULTY AUTO-FILL (JWT → employee_id)
  ===================================================== */
  static async getFacultyDetails(req, res) {
    try {
      const userId = req.user?.id || req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      res.json({
        success: true,
        data: {
          employee_id: userId,
          user_id: userId,
          name: req.user.name,
          email: req.user.email,
          department: req.user.department,
          role: req.user.role
        }
      });
    } catch (error) {
      console.error('Faculty details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch faculty details'
      });
    }
  }

  /* =====================================================
     2. GET ORG UNITS BY TYPE (Dropdown Data)
  ===================================================== */
  static async getOrgUnits(req, res) {
    try {
      const { type } = req.params;
      
      if (!['DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROF_BODY'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid org unit type. Must be: DEPARTMENT, CENTRE, CELL, CLUB, PROF_BODY'
        });
      }

      const units = await BudgetModel.getOrgUnitsByType(type);

      res.json({
        success: true,
        data: units,
        count: units.length
      });

    } catch (error) {
      console.error('Get org units error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch org units'
      });
    }
  }

  /* =====================================================
     3. GET ALL ORG UNITS (All Types Combined)
  ===================================================== */
  static async getAllOrgUnits(req, res) {
    try {
      const units = await BudgetModel.getAllOrgUnits();

      const grouped = units.reduce((acc, unit) => {
        const type = unit.type_code;
        if (!acc[type]) acc[type] = [];
        acc[type].push(unit);
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          all: units,
          grouped: grouped
        },
        count: units.length
      });

    } catch (error) {
      console.error('Get all org units error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch all org units'
      });
    }
  }

  /* =====================================================
     4. GET APPROVAL FLOW CONFIGS (Admin/Form Info)
  ===================================================== */
  static async getApprovalFlows(req, res) {
    try {
      const configs = await BudgetModel.getApprovalFlowConfigs();

      res.json({
        success: true,
        data: configs
      });

    } catch (error) {
      console.error('Get approval flows error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch approval flow configs'
      });
    }
  }

  /* =====================================================
     5. CREATE PROPOSAL (POST /budget) - ✅ UPGRADED WITH EXPLICIT FISCAL_YEAR
  ===================================================== */
  static async create(req, res) {
    try {
      const payload = req.body;

      const userId = req.user?.id || req.user?.userId;
      const userEmail = req.user?.email;

      // ✅ VALIDATE FISCAL YEAR (NEW REQUIRED FIELD)
      if (!payload.fiscal_year || isNaN(parseInt(payload.fiscal_year))) {
        return res.status(400).json({
          success: false,
          message: 'fiscal_year is required and must be a valid integer (e.g., 2026)'
        });
      }

      if (!payload.request_date || !payload.beneficiary_type) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: request_date, beneficiary_type'
        });
      }

      if (!VALID_BENEFICIARY_TYPES.includes(payload.beneficiary_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid beneficiary_type: ${payload.beneficiary_type}. Valid: ${VALID_BENEFICIARY_TYPES.join(', ')}`
        });
      }

      if (!payload.lines?.length) {
        return res.status(400).json({
          success: false,
          message: 'At least one budget line required'
        });
      }

      if (!['Faculty', 'Institution'].includes(payload.beneficiary_type) && !payload.beneficiary_value) {
        return res.status(400).json({
          success: false,
          message: `beneficiary_value required for ${payload.beneficiary_type}`
        });
      }

      for (let i = 0; i < payload.lines.length; i++) {
        const line = payload.lines[i];
        if (!line.budget_head || !line.unit_amount || !line.line_description) {
          return res.status(400).json({
            success: false,
            message: `Line ${i + 1}: budget_head, unit_amount, line_description required`
          });
        }
        if (!line.month_allocations || Object.keys(line.month_allocations).length === 0) {
          return res.status(400).json({
            success: false,
            message: `Line ${i + 1}: month_allocations required`
          });
        }
      }

      // ✅ PASS EXPLICIT FISCAL YEAR TO MODEL
      const result = await BudgetModel.create({
        ...payload,
        fiscal_year: parseInt(payload.fiscal_year), // ✅ Ensure integer
        user_id: userId,
        user_email: userEmail,
        employee_id: payload.employee_id || userId,
        department: payload.department || req.user.department
      });

      res.status(201).json({
        success: true,
        message: 'Budget proposal created successfully',
        data: {
          proposalId: result.proposalId,
          proposalRef: result.proposalRef,
          fiscalYear: result.fyYear,
          approvalFlow: result.approvalFlow,
          initialStage: result.initialStage,
          requiresHod: result.requiresHod
        }
      });

    } catch (error) {
      console.error('Create budget error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create budget proposal',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  /* =====================================================
     6. UPDATE PROPOSAL (PUT /budget/:id) - ✅ UPGRADED
  ===================================================== */
  static async update(req, res) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      // ✅ UPGRADED ACCESS CHECK
      const userId = req.user?.id || req.user?.userId || null;
      const userEmail = req.user?.email?.trim() || null;
      const userRole = (req.user?.role || '').toLowerCase().trim();
      const userDept = req.user?.department?.trim() || null;

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDept
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied - cannot update this proposal`,
          debug: process.env.NODE_ENV === 'development' ? {
            proposalId,
            userId,
            userEmail,
            userRole,
            userDept
          } : undefined
        });
      }

      const payload = req.body;
      
      if (!payload.lines?.length) {
        return res.status(400).json({
          success: false,
          message: 'At least one budget line required'
        });
      }

      await BudgetModel.update(proposalId, payload);

      res.json({
        success: true,
        message: 'Budget proposal updated successfully'
      });

    } catch (error) {
      console.error('Update budget error:', error);
      if (error.message.includes('Cannot edit')) {
        return res.status(403).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update budget'
      });
    }
  }

    /* =====================================================
     6.5 DELETE PROPOSAL (DELETE /budget/:id)
    ===================================================== */
    static async deleteProposal(req, res) {
      try {
        const proposalId = parseInt(req.params.id);
        if (isNaN(proposalId)) {
          return res.status(400).json({ success: false, message: 'Invalid proposal ID' });
        }

        // 1. Check access & existence
        const userId = req.user?.id || req.user?.userId;
        const proposal = await BudgetModel.getBudgetById(proposalId);

        if (!proposal) {
          return res.status(404).json({ success: false, message: 'Proposal not found' });
        }

        // 2. Authorization: Only Owner can delete
        if (proposal.user_id !== userId) {
          return res.status(403).json({ success: false, message: 'Only the creator can delete this proposal' });
        }

        // 3. Status Check: Can't delete if already partially approved
        // Allow delete if: submitted, draft, returned
        const DELETABLE_STATUSES = ['submitted', 'draft', 'hod_returned', 'dof_returned'];
        if (!DELETABLE_STATUSES.includes(proposal.status)) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot delete proposal in '${proposal.status}' status` 
          });
        }

        // 4. Perform Delete
        const success = await BudgetModel.delete(proposalId);
        if (!success) {
          throw new Error('Database delete failed');
        }

        res.json({ success: true, message: 'Budget proposal deleted successfully' });

      } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete proposal' });
      }
    }

    /* =====================================================
     7. GET SINGLE PROPOSAL (GET /budget/:id) - ✅ UPGRADED WITH LOGGING
    ===================================================== */
    static async get(req, res) {
      try {
        const proposalId = parseInt(req.params.id);
        if (isNaN(proposalId)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid proposal ID'
          });
        }

        const budget = await BudgetModel.getFull(proposalId);
        if (!budget) {
          return res.status(404).json({
            success: false,
            message: 'Proposal not found'
          });
        }

        // // 🔍 HIGH-VISIBILITY DEBUG LOGGING
        // console.log('-------------------------------------------');
        // console.log('🔍 BUDGET ACCESS DEBUG [GET /budget/' + proposalId + ']');
        // console.log('👤 RAW REQ.USER:', JSON.stringify(req.user, null, 2));
        
        const userId = req.user?.id || req.user?.userId || null;
        const userEmail = req.user?.email?.trim() || null;
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const userDept = req.user?.department?.trim() || null;

        // console.log('⚙️  NORMALIZED PARAMS:', { userId, userEmail, userRole, userDept });

        const hasAccess = await BudgetModel.validateUserAccess(
          proposalId,
          userId,
          userEmail,
          userRole,
          userDept
        );

        // console.log('🛡️  HAS ACCESS:', hasAccess);
        // console.log('-------------------------------------------');

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message: `Access denied - cannot view this proposal`,
            debug: {
              proposalId,
              userId,
              userEmail,
              userRole,
              userDept,
              receivedUser: req.user // Shows exactly what JWT provided
            }
          });
        }

        res.json({
          success: true,
          data: budget
        });

      } catch (error) {
        console.error('❌ Get budget error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch proposal'
        });
      }
    }

  /* =====================================================
     8. USER DASHBOARD (GET /budget/my)
  ===================================================== */
  static async getMyBudgets(req, res) {
  try {
    const { page = 1, limit = 10, status, fiscalYear } = req.query;
    
    // ✅ Extract from JWT - userId AND userEmail
    const userId = req.user?.id || req.user?.userId;
    const userEmail = req.user?.email || '';
    
    // ✅ DEBUG log
    console.log('DEBUG getMyBudgets:', { 
      userId, 
      userEmail, 
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    const budgets = await BudgetModel.listBudgets({
      userId: userId,
      userEmail: userEmail,  // ✅ Fixed: Now properly passed
      role: 'user',
      page: parseInt(page),
      limit: parseInt(limit),
      status: status || undefined,
      fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
    });

    console.log(`Found ${budgets.budgets.length} budgets for user ${userId}`);

    res.json({
      success: true,
      data: budgets.budgets,
      pagination: budgets.pagination,
      currentFiscalYear: BudgetModel.getCurrentFinancialYear()
    });

  } catch (error) {
    console.error('My budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your budgets',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

  /* =====================================================
     9. HOD DASHBOARD (GET /budget/hod)
  ===================================================== */
  static async getHodBudgets(req, res) {
    try {
      if (req.user.role !== 'hod') {
        return res.status(403).json({
          success: false,
          message: 'HOD access required'
        });
      }

      if (!req.user.department) {
        return res.status(400).json({
          success: false,
          message: 'Department not set for HOD'
        });
      }

      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      
      const budgets = await BudgetModel.listBudgets({
        department: req.user.department,
        role: 'hod',
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || undefined,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
      });

      res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        department: req.user.department,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear()
      });

    } catch (error) {
      console.error('HOD budgets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch HOD budgets'
      });
    }
  }

  /* =====================================================
     10. DoF DASHBOARD (GET /budget/dof)
  ===================================================== */
  static async getDofBudgets(req, res) {
    try {
      if (req.user.role !== 'dof') {
        return res.status(403).json({
          success: false,
          message: 'DoF access required'
        });
      }

      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      
      const budgets = await BudgetModel.listBudgets({
        role: 'dof',
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || undefined,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
      });

      res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear()
      });

    } catch (error) {
      console.error('DoF budgets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch DoF budgets'
      });
    }
  }

  /* =====================================================
     11. PRINCIPAL DASHBOARD (GET /budget/principal)
  ===================================================== */
  static async getPrincipalBudgets(req, res) {
    try {
      if (req.user.role !== 'principal') {
        return res.status(403).json({
          success: false,
          message: 'Principal access required'
        });
      }

      const { page = 1, limit = 10, status, fiscalYear } = req.query;
      
      const budgets = await BudgetModel.listBudgets({
        role: 'principal',
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || undefined,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
      });

      res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear()
      });

    } catch (error) {
      console.error('Principal budgets error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Principal budgets'
      });
    }
  }

  /* =====================================================
     12. DASHBOARD AGGREGATES (GET /budget/aggregates)
  ===================================================== */
  static async getAggregates(req, res) {
    try {
      const { role, department } = req.user;
      const { fiscalYear } = req.query;
      
      const aggregates = await BudgetModel.dashboardAggregates({ 
        role, 
        department: role === 'hod' ? department : undefined,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
      });

      res.json({
        success: true,
        data: aggregates,
        currentFiscalYear: BudgetModel.getCurrentFinancialYear()
      });

    } catch (error) {
      console.error('Aggregates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch aggregates'
      });
    }
  }

  /* =====================================================
     13. PROCESS APPROVAL (PATCH /budget/:id/approval) - ✅ UPGRADED
  ===================================================== */
  static async approve(req, res) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      const { decision = 'approved', feedback } = req.body;
      if (!['approved', 'rejected', 'returned'].includes(decision)) {
        return res.status(400).json({
          success: false,
          message: 'Decision must be: approved, rejected, returned'
        });
      }

      if (!['hod', 'dof', 'principal'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions - approver role required'
        });
      }

      // ✅ UPGRADED ACCESS CHECK
      const userId = req.user?.id || req.user?.userId || null;
      const userEmail = req.user?.email?.trim() || null;
      const userRole = (req.user?.role || '').toLowerCase().trim();
      const userDept = req.user?.department?.trim() || null;

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDept
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied - proposal not in your queue`,
          debug: process.env.NODE_ENV === 'development' ? {
            proposalId,
            userId,
            userEmail,
            userRole,
            userDept
          } : undefined
        });
      }

      await BudgetModel.processApproval(proposalId, {
        role: req.user.role,
        decision,
        feedback: decision !== 'approved' ? feedback : undefined,
        approverUserId: userId,
        approverEmail: req.user.email
      });

      res.json({
        success: true,
        message: `Proposal ${decision} successfully`,
        data: {
          decision,
          role: req.user.role,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Approval error:', error);
      if (error.message.includes('Stage mismatch') || 
          error.message.includes('Feedback required') ||
          error.message.includes('expected')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Approval processing failed'
      });
    }
  }

  /* =====================================================
     14. ADMIN FULL LIST (GET /budget/admin)
  ===================================================== */
  static async adminList(req, res) {
    try {
      if (!['hod', 'dof', 'principal'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { page = 1, limit = 20, status, fiscalYear } = req.query;
      
      const budgets = await BudgetModel.listBudgets({
        role: req.user.role,
        department: req.user.role === 'hod' ? req.user.department : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined
      });

      res.json({
        success: true,
        data: budgets.budgets,
        pagination: budgets.pagination,
        filters: {
          role: req.user.role,
          department: req.user.department,
          fiscalYear: fiscalYear || BudgetModel.getCurrentFinancialYear()
        }
      });

    } catch (error) {
      console.error('Admin list error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin budgets'
      });
    }
  }

  /* =====================================================
     15. GET PROPOSAL HISTORY (GET /budget/:id/history) - ✅ UPGRADED
  ===================================================== */
  static async getHistory(req, res) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      // ✅ UPGRADED ACCESS CHECK
      const userId = req.user?.id || req.user?.userId || null;
      const userEmail = req.user?.email?.trim() || null;
      const userRole = (req.user?.role || '').toLowerCase().trim();
      const userDept = req.user?.department?.trim() || null;

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDept
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied - cannot view history`,
          debug: process.env.NODE_ENV === 'development' ? {
            proposalId,
            userId,
            userEmail,
            userRole,
            userDept
          } : undefined
        });
      }

      const budget = await BudgetModel.getFull(proposalId);
      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found'
        });
      }

      res.json({
        success: true,
        data: {
          proposal: budget.master,
          approvals: budget.approvals,
          timeline: budget.approvals.map(a => ({
            stage: a.role,
            decision: a.decision,
            feedback: a.feedback,
            timestamp: a.decided_at_formatted || a.decided_at,
            approver: a.approver_email,
            allowsEdit: a.allows_edit
          }))
        }
      });

    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch proposal history'
      });
    }
  }

  /* =====================================================
     16. MONTH ALLOCATIONS REPORT (GET /budget/:id/allocations) - ✅ UPGRADED
  ===================================================== */
  static async getMonthAllocations(req, res) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      // ✅ UPGRADED ACCESS CHECK
      const userId = req.user?.id || req.user?.userId || null;
      const userEmail = req.user?.email?.trim() || null;
      const userRole = (req.user?.role || '').toLowerCase().trim();
      const userDept = req.user?.department?.trim() || null;

      const hasAccess = await BudgetModel.validateUserAccess(
        proposalId,
        userId,
        userEmail,
        userRole,
        userDept
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied - cannot view allocations`,
          debug: process.env.NODE_ENV === 'development' ? {
            proposalId,
            userId,
            userEmail,
            userRole,
            userDept
          } : undefined
        });
      }

      const allocations = await BudgetModel.getMonthlyAllocations(proposalId);

      res.json({
        success: true,
        data: allocations
      });

    } catch (error) {
      console.error('Get allocations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch month allocations'
      });
    }
  }

  /* =====================================================
     17. BULK EXPORT (GET /budget/export)
  ===================================================== */
  static async export(req, res) {
    try {
      if (!['dof', 'principal'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Export requires DoF or Principal access'
        });
      }

      const { fiscalYear, status, format = 'csv' } = req.query;
      
      const budgets = await BudgetModel.listBudgets({
        role: req.user.role,
        fiscalYear: fiscalYear ? parseInt(fiscalYear) : undefined,
        status,
        page: 1,
        limit: 10000
      });

      if (format === 'csv') {
        const csvHeader = 'Ref,FY,Type,Value,Department,Amount,Status,Stage,Created\n';
        const csvRows = budgets.budgets.map(b => 
          `${b.proposal_ref},${b.fiscal_year},${b.beneficiary_type},"${b.beneficiary_value || ''}",${b.department || ''},${b.total_amount},${b.status},${b.current_stage},${b.created_date}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=budget-export-FY${fiscalYear || BudgetModel.getCurrentFinancialYear()}-${Date.now()}.csv`);
        res.send(csvHeader + csvRows);
      } else {
        res.json({
          success: true,
          data: budgets.budgets,
          exportedAt: new Date().toISOString(),
          filters: { fiscalYear, status }
        });
      }

    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export budgets'
      });
    }
  }

  /* =====================================================
     18. STATS SUMMARY (GET /budget/stats)
  ===================================================== */
  static async getStats(req, res) {
    try {
      const { fiscalYear } = req.query;
      const fy = fiscalYear ? parseInt(fiscalYear) : BudgetModel.getCurrentFinancialYear();

      const stats = await BudgetModel.getBudgetStatsByFY(fy);

      res.json({
        success: true,
        data: stats,
        fiscalYear: fy
      });

    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stats'
      });
    }
  }

  /* =====================================================
     19. QUICK STATUS CHECK (GET /budget/:id/status)
  ===================================================== */
  static async getStatus(req, res) {
    try {
      const proposalId = parseInt(req.params.id);
      if (isNaN(proposalId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal ID'
        });
      }

      const proposal = await BudgetModel.getBudgetById(proposalId);
      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found'
        });
      }

      // Public info - anyone with token can check status
      res.json({
        success: true,
        data: {
          id: proposal.id,
          proposalRef: proposal.proposal_ref,
          status: proposal.status,
          currentStage: proposal.current_stage,
          approvalFlow: proposal.approval_flow,
          totalAmount: proposal.total_amount,
          createdAt: proposal.created_at
        }
      });

    } catch (error) {
      console.error('Get status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch status'
      });
    }
  }

  /* =====================================================
     20. UPDATE APPROVAL FLOW CONFIG (PATCH /budget/admin/flow/:id)
  ===================================================== */
  static async updateFlowConfig(req, res) {
    try {
      if (req.user.role !== 'principal') {
        return res.status(403).json({
          success: false,
          message: 'Only Principal can update approval flow configs'
        });
      }

      const configId = parseInt(req.params.id);
      if (isNaN(configId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid config ID'
        });
      }

      const { requiresHod, requiresDof, requiresPrincipal } = req.body;

      if (![0, 1].includes(requiresHod) || ![0, 1].includes(requiresDof) || ![0, 1].includes(requiresPrincipal)) {
        return res.status(400).json({
          success: false,
          message: 'requiresHod, requiresDof, requiresPrincipal must be 0 or 1'
        });
      }

      const updated = await BudgetModel.updateApprovalFlowConfig(configId, {
        requiresHod,
        requiresDof,
        requiresPrincipal
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Config not found'
        });
      }

      res.json({
        success: true,
        message: 'Approval flow config updated successfully'
      });

    } catch (error) {
      console.error('Update flow config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update approval flow config'
      });
    }
  }
}

export default BudgetController;
