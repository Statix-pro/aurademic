import financeModel from './financeModel.js';

const financeController = {
  /* =====================================================
     CREATE FINANCE REQUEST
  ====================================================== */
  async createFinanceRequest(req, res) {
    try {
      const userId = req.user.id;
      const data = req.body;

      // Validation: require either employee_id (staff) OR applicant_name (external)
      const hasApplicant = data.employee_id || data.applicant_name;
      if (
        !hasApplicant ||
        !data.request_date ||
        !data.beneficiary_type ||
        !data.primary_head
      ) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing required fields (employee_id or applicant_name, request_date, beneficiary_type, primary_head)',
        });
      }

      const financeId = await financeModel.createFinanceRequest(data, userId);

      res.status(201).json({
        status: 'success',
        message: 'Finance request created successfully',
        data: { id: financeId },
      });
    } catch (error) {
      console.error('Error in createFinanceRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     UPDATE FINANCE REQUEST (APPLICANT)
  ====================================================== */
  async updateFinanceRequest(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const finance = await financeModel.getFinanceRequestById(id);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      if (finance.created_by !== userId) {
        return res.status(403).json({
          status: 'error',
          message: 'You are not allowed to update this request',
        });
      }

      if (finance.overall_status !== 'pending') {
        return res.status(400).json({
          status: 'error',
          message: 'Approved or rejected requests cannot be edited',
        });
      }

      const result = await financeModel.updateFinanceRequest(id, req.body);

      if (result.affectedRows > 0) {
        res.status(200).json({
          message: 'Finance request updated successfully',
        });
      } else {
        res.status(400).json({
          message: 'No changes applied',
        });
      }
    } catch (error) {
      console.error('Error in updateFinanceRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     GET FINANCE REQUEST (FULL VIEW)
  ====================================================== */
  async getFinanceRequest(req, res) {
    try {
      const { id } = req.params;

      const finance = await financeModel.getFinanceRequestById(id);
      if (!finance) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      const budget = await financeModel.getBudgetBreakup(id);
      const statusUpdates = await financeModel.getStatusUpdates(id);

      res.status(200).json({
        status: 'success',
        data: {
          ...finance,
          budget,
          status_updates: statusUpdates,
        },
      });
    } catch (error) {
      console.error('Error in getFinanceRequest:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     LIST FINANCE REQUESTS
  ====================================================== */
  async listFinanceRequests(req, res) {
    try {
      const userId = req.user.id;
      const { mine, status } = req.query;

      const rows = await financeModel.listFinanceRequests({
        userId,
        mine: mine === 'true',
        status,
      });

      res.json({
        status: 'success',
        data: rows,
      });
    } catch (error) {
      console.error('Error in listFinanceRequests:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     ADD BUDGET BREAKUP
  ====================================================== */
  async addBudgetBreakup(req, res) {
    try {
      const { id } = req.params;
      const rows = req.body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Budget breakup data is required',
        });
      }

      const exists = await financeModel.doesFinanceExist(id);
      if (!exists) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      await financeModel.addBudgetBreakup(id, rows);

      res.status(201).json({
        status: 'success',
        message: 'Budget breakup added successfully',
      });
    } catch (error) {
      console.error('Error in addBudgetBreakup:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     GET BUDGET BREAKUP
  ====================================================== */
  async getBudgetBreakup(req, res) {
    try {
      const { id } = req.params;

      const budget = await financeModel.getBudgetBreakup(id);

      res.status(200).json({
        status: 'success',
        data: budget,
      });
    } catch (error) {
      console.error('Error in getBudgetBreakup:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     ADD STATUS / APPROVAL UPDATE
  ====================================================== */
  async addStatusUpdate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { role, status, comment } = req.body;

      if (!role || !status) {
        return res.status(400).json({
          status: 'error',
          message: 'Role and status are required',
        });
      }

      const exists = await financeModel.doesFinanceExist(id);
      if (!exists) {
        return res.status(404).json({
          status: 'error',
          message: 'Finance request not found',
        });
      }

      await financeModel.addStatusUpdate(
        id,
        userId,
        role,
        status,
        comment
      );

      res.status(201).json({
        status: 'success',
        message: 'Status updated successfully',
      });
    } catch (error) {
      console.error('Error in addStatusUpdate:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     GET STATUS HISTORY
  ====================================================== */
  async getStatusUpdates(req, res) {
    try {
      const { id } = req.params;

      const updates = await financeModel.getStatusUpdates(id);

      res.status(200).json({
        status: 'success',
        data: updates,
      });
    } catch (error) {
      console.error('Error in getStatusUpdates:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     GET CURRENT USER'S EMPLOYEE INFO (for auto-fill)
  ====================================================== */
  async getCurrentEmployeeInfo(req, res) {
    try {
      const userEmail = req.user.email;

      if (!userEmail) {
        return res.status(400).json({
          status: 'error',
          message: 'User email not found',
        });
      }

      const employee = await financeModel.getEmployeeByEmail(userEmail);

      if (!employee) {
        // Not an employee, return basic user info
        return res.status(200).json({
          status: 'success',
          data: {
            name: req.user.name || '',
            email: userEmail,
            employee_id: null,
          },
        });
      }

      res.status(200).json({
        status: 'success',
        data: employee,
      });
    } catch (error) {
      console.error('Error in getCurrentEmployeeInfo:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  /* =====================================================
     SEARCH APPLICANT (for searchable dropdown)
  ====================================================== */
  async searchApplicant(req, res) {
    try {
      const { q } = req.query;

      // Allow empty query to fetch default list (top 20)
      const results = await financeModel.searchApplicant(q || '');

      res.status(200).json({
        status: 'success',
        data: results,
      });
    } catch (error) {
      console.error('Error in searchApplicant:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },
};

export default financeController;
