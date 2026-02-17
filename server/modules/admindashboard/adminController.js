// adminController.js
import adminModel from './adminModel.js';

const adminController = {
  async getDashboard(req, res) {
    try {
      const stats = await adminModel.getDashboardStats();
      res.status(200).json({ data: stats });
    } catch (error) {
      console.error('Error in getDashboard:', error);
      res.status(500).json({
        message: 'Error retrieving dashboard stats',
        error: error.message,
      });
    }
  },

  async getAllProjects(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;

      const { projects, total } = await adminModel.getAllProjects(
        page,
        perPage
      );
      if (!projects) {
        return res.status(200).json({ data: [], total: 0 });
      }
      res.status(200).json({ data: projects, total });
    } catch (error) {
      console.error('Error in getAllProjects:', error);
      res.status(500).json({
        message: 'Error retrieving projects',
        error: error.message,
      });
    }
  },

  async getProjectDetails(req, res) {
    try {
      const projectId = parseInt(req.params.id);
      const project = await adminModel.getProjectById(projectId);

      if (!project) {
        return res.status(404).json({
          message: 'Project not found',
        });
      }

      res.status(200).json({ data: project });
    } catch (error) {
      console.error('Error in getProjectDetails:', error);
      res.status(500).json({
        message: 'Error retrieving project details',
        error: error.message,
      });
    }
  },

  async getAllJournals(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;

      const { journals, total } = await adminModel.getAllJournals(
        page,
        perPage
      );

      if (!journals) {
        return res.status(200).json({ data: [], total: 0 });
      }
      res.status(200).json({ data: journals, total });
    } catch (error) {
      console.error('Error in getAllJournals:', error);
      res.status(500).json({
        message: 'Error retrieving journals',
        error: error.message,
      });
    }
  },

  async getJournalDetails(req, res) {
    try {
      const journalId = parseInt(req.params.id);
      const journal = await adminModel.getJournalById(journalId);

      if (!journal) {
        return res.status(404).json({
          message: 'Journal not found',
        });
      }

      res.status(200).json({ data: journal });
    } catch (error) {
      console.error('Error in getJournalDetails:', error);
      res.status(500).json({
        message: 'Error retrieving journal details',
        error: error.message,
      });
    }
  },

  async updateJournalSubmissionApproval(req, res) {
    try {
      const journalId = parseInt(req.params.id, 10);
      const { status, admin_comment } = req.body;

      if (!Number.isInteger(journalId) || journalId <= 0) {
        return res.status(400).json({
          message: 'Invalid journal ID',
        });
      }

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          message: "Status must be either 'approved' or 'rejected'",
        });
      }

      const updatedJournal = await adminModel.updateJournalSubmissionApproval(
        journalId,
        status,
        admin_comment,
        req.user.id
      );

      if (!updatedJournal) {
        return res.status(404).json({
          message: 'Journal not found',
        });
      }

      return res.status(200).json({
        message: `Journal submission ${status} successfully`,
        data: updatedJournal,
      });
    } catch (error) {
      console.error('Error in updateJournalSubmissionApproval:', error);
      return res.status(500).json({
        message: 'Error updating journal submission approval',
        error: error.message,
      });
    }
  },

  // Journal Request Management methods
  async getAllJournalRequests(req, res) {
    try {
      const requests = await adminModel.getAllJournalRequests();
      res.status(200).json({ data: requests });
    } catch (error) {
      console.error('Error in getAllJournalRequests:', error);
      res.status(500).json({
        message: 'Error retrieving journal requests',
        error: error.message,
      });
    }
  },

  async approveJournalRequest(req, res) {
    try {
      const requestId = parseInt(req.params.id);
      const { admin_comment } = req.body;

      const result = await adminModel.approveJournalRequest(
        requestId,
        admin_comment
      );

      if (!result) {
        return res.status(404).json({
          message: 'Journal request not found',
        });
      }

      res.status(200).json({
        message: 'Journal request approved successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in approveJournalRequest:', error);
      res.status(500).json({
        message: 'Error approving journal request',
        error: error.message,
      });
    }
  },

  async rejectJournalRequest(req, res) {
    try {
      const requestId = parseInt(req.params.id);
      const { admin_comment } = req.body;

      const result = await adminModel.rejectJournalRequest(
        requestId,
        admin_comment
      );

      if (!result) {
        return res.status(404).json({
          message: 'Journal request not found',
        });
      }

      res.status(200).json({
        message: 'Journal request rejected successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in rejectJournalRequest:', error);
      res.status(500).json({
        message: 'Error rejecting journal request',
        error: error.message,
      });
    }
  },

  async rejectJournalRequest(req, res) {
    try {
      const requestId = parseInt(req.params.id);
      const { admin_comment } = req.body;

      const result = await adminModel.rejectJournalRequest(
        requestId,
        admin_comment
      );

      if (!result) {
        return res.status(404).json({
          message: 'Journal request not found',
        });
      }

      res.status(200).json({
        message: 'Journal request rejected successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in rejectJournalRequest:', error);
      res.status(500).json({
        message: 'Error rejecting journal request',
        error: error.message,
      });
    }
  },

  // Project Request Management methods
  async getAllProjectRequests(req, res) {
    try {
      const requests = await adminModel.getAllProjectRequests();
      res.status(200).json({ data: requests });
    } catch (error) {
      console.error('Error in getAllProjectRequests:', error);
      res.status(500).json({
        message: 'Error retrieving project requests',
        error: error.message,
      });
    }
  },

  async approveProjectRequest(req, res) {
    try {
      const requestId = parseInt(req.params.id);
      const { admin_comment } = req.body;

      const result = await adminModel.approveProjectRequest(
        requestId,
        admin_comment
      );

      if (!result) {
        return res.status(404).json({
          message: 'Project request not found',
        });
      }

      res.status(200).json({
        message: 'Project request approved successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in approveProjectRequest:', error);
      res.status(500).json({
        message: 'Error approving project request',
        error: error.message,
      });
    }
  },

  async rejectProjectRequest(req, res) {
    try {
      const requestId = parseInt(req.params.id);
      const { admin_comment } = req.body;

      const result = await adminModel.rejectProjectRequest(
        requestId,
        admin_comment
      );

      if (!result) {
        return res.status(404).json({
          message: 'Project request not found',
        });
      }

      res.status(200).json({
        message: 'Project request rejected successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error in rejectProjectRequest:', error);
      res.status(500).json({
        message: 'Error rejecting project request',
        error: error.message,
      });
    }
  },

  // Journal Status Update Management methods
  async getAllJournalStatusUpdates(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;
      const status = req.query.status; // Optional filter by status

      const { statusUpdates, total } =
        await adminModel.getAllJournalStatusUpdates(page, perPage, status);

      res.status(200).json({ data: statusUpdates, total });
    } catch (error) {
      console.error('Error in getAllJournalStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal status updates',
        error: error.message,
      });
    }
  },

  async getJournalStatusUpdates(req, res) {
    try {
      const journalId = parseInt(req.params.id);
      const statusUpdates = await adminModel.getJournalStatusUpdates(journalId);

      res.status(200).json({ data: statusUpdates });
    } catch (error) {
      console.error('Error in getJournalStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal status updates',
        error: error.message,
      });
    }
  },

  async updateStatusUpdateAdminReply(req, res) {
    try {
      const statusUpdateId = parseInt(req.params.statusUpdateId);
      const { admin_reply } = req.body;

      if (!admin_reply || !admin_reply.trim()) {
        return res.status(400).json({
          message: 'Admin reply is required',
        });
      }

      const result = await adminModel.updateStatusUpdateAdminReply(
        statusUpdateId,
        admin_reply.trim()
      );

      if (result.affectedRows > 0) {
        res.status(200).json({
          message: 'Admin reply updated successfully',
          data: { id: statusUpdateId, admin_reply: admin_reply.trim() },
        });
      } else {
        res.status(404).json({
          message: 'Status update not found',
        });
      }
    } catch (error) {
      console.error('Error in updateStatusUpdateAdminReply:', error);
      res.status(500).json({
        message: 'Error updating admin reply',
        error: error.message,
      });
    }
  },

  async getJournalWithStatusUpdates(req, res) {
    try {
      const journalId = parseInt(req.params.id);
      const journal = await adminModel.getJournalById(journalId);

      if (!journal) {
        return res.status(404).json({
          message: 'Journal not found',
        });
      }

      const statusUpdates = await adminModel.getJournalStatusUpdates(journalId);

      res.status(200).json({
        data: {
          journal,
          statusUpdates,
        },
      });
    } catch (error) {
      console.error('Error in getJournalWithStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal with status updates',
        error: error.message,
      });
    }
  },

  async getAllBudgets(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.perpage) || 20;
      const filters = {
        fiscalYear: req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null,
        status: req.query.status || null,
        beneficiaryType: req.query.beneficiaryType || null
      };
      
      const { budgets, total } = await adminModel.getAllBudgets(page, perPage, filters);
      
      res.status(200).json({ 
        success: true,
        data: budgets, 
        total,
        filters
      });
    } catch (error) {
      console.error('Error in getAllBudgets:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error retrieving budgets', 
        error: error.message 
      });
    }
  },

  async getBudgetStats(req, res) {
    try {
      const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear) : null;
      const stats = await adminModel.getBudgetStats(fiscalYear);
      
      res.status(200).json({ 
        success: true,
        data: stats,
        fiscalYear: fiscalYear || 'All'
      });
    } catch (error) {
      console.error('Error in getBudgetStats:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error retrieving budget stats', 
        error: error.message 
      });
    }
  },

};

export default adminController;
