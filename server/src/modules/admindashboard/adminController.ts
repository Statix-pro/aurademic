import { Request, Response } from 'express';
import adminModel from './adminModel.js';

const adminController = {
  async getDashboard(req: Request, res: Response) {
    try {
      const stats = await adminModel.getDashboardStats();
      res.status(200).json({ data: stats });
    } catch (error: any) {
      console.error('Error in getDashboard:', error);
      res.status(500).json({
        message: 'Error retrieving dashboard stats',
        error: error.message,
      });
    }
  },

  async getAllProjects(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.per_page as string) || 10;

      const { projects, total } = await adminModel.getAllProjects(
        page,
        perPage
      );
      if (!projects) {
        return res.status(200).json({ data: [], total: 0 });
      }
      res.status(200).json({ data: projects, total });
    } catch (error: any) {
      console.error('Error in getAllProjects:', error);
      res.status(500).json({
        message: 'Error retrieving projects',
        error: error.message,
      });
    }
  },

  async getProjectDetails(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const project = await adminModel.getProjectById(projectId);

      if (!project) {
        return res.status(404).json({
          message: 'Project not found',
        });
      }

      res.status(200).json({ data: project });
    } catch (error: any) {
      console.error('Error in getProjectDetails:', error);
      res.status(500).json({
        message: 'Error retrieving project details',
        error: error.message,
      });
    }
  },

  async getAllJournals(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.per_page as string) || 10;

      const { journals, total } = await adminModel.getAllJournals(
        page,
        perPage
      );

      if (!journals) {
        return res.status(200).json({ data: [], total: 0 });
      }
      res.status(200).json({ data: journals, total });
    } catch (error: any) {
      console.error('Error in getAllJournals:', error);
      res.status(500).json({
        message: 'Error retrieving journals',
        error: error.message,
      });
    }
  },

  async getJournalDetails(req: Request, res: Response) {
    try {
      const journalId = parseInt(req.params.id);
      const journal = await adminModel.getJournalById(journalId);

      if (!journal) {
        return res.status(404).json({
          message: 'Journal not found',
        });
      }

      res.status(200).json({ data: journal });
    } catch (error: any) {
      console.error('Error in getJournalDetails:', error);
      res.status(500).json({
        message: 'Error retrieving journal details',
        error: error.message,
      });
    }
  },

  // Journal Request Management methods
  async getAllJournalRequests(req: Request, res: Response) {
    try {
      const requests = await adminModel.getAllJournalRequests();
      res.status(200).json({ data: requests });
    } catch (error: any) {
      console.error('Error in getAllJournalRequests:', error);
      res.status(500).json({
        message: 'Error retrieving journal requests',
        error: error.message,
      });
    }
  },

  async approveJournalRequest(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in approveJournalRequest:', error);
      res.status(500).json({
        message: 'Error approving journal request',
        error: error.message,
      });
    }
  },

  async rejectJournalRequest(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in rejectJournalRequest:', error);
      res.status(500).json({
        message: 'Error rejecting journal request',
        error: error.message,
      });
    }
  },

  // Project Request Management methods
  async getAllProjectRequests(req: Request, res: Response) {
    try {
      const requests = await adminModel.getAllProjectRequests();
      res.status(200).json({ data: requests });
    } catch (error: any) {
      console.error('Error in getAllProjectRequests:', error);
      res.status(500).json({
        message: 'Error retrieving project requests',
        error: error.message,
      });
    }
  },

  async approveProjectRequest(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in approveProjectRequest:', error);
      res.status(500).json({
        message: 'Error approving project request',
        error: error.message,
      });
    }
  },

  async rejectProjectRequest(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in rejectProjectRequest:', error);
      res.status(500).json({
        message: 'Error rejecting project request',
        error: error.message,
      });
    }
  },

  // Journal Status Update Management methods
  async getAllJournalStatusUpdates(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.per_page as string) || 10;
      const status = req.query.status as string; // Optional filter by status

      const { statusUpdates, total } =
        await adminModel.getAllJournalStatusUpdates(page, perPage, status);

      res.status(200).json({ data: statusUpdates, total });
    } catch (error: any) {
      console.error('Error in getAllJournalStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal status updates',
        error: error.message,
      });
    }
  },

  async getJournalStatusUpdates(req: Request, res: Response) {
    try {
      const journalId = parseInt(req.params.id);
      const statusUpdates = await adminModel.getJournalStatusUpdates(journalId);

      res.status(200).json({ data: statusUpdates });
    } catch (error: any) {
      console.error('Error in getJournalStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal status updates',
        error: error.message,
      });
    }
  },

  async updateStatusUpdateAdminReply(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in updateStatusUpdateAdminReply:', error);
      res.status(500).json({
        message: 'Error updating admin reply',
        error: error.message,
      });
    }
  },

  async getJournalWithStatusUpdates(req: Request, res: Response) {
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
    } catch (error: any) {
      console.error('Error in getJournalWithStatusUpdates:', error);
      res.status(500).json({
        message: 'Error retrieving journal with status updates',
        error: error.message,
      });
    }
  },
};

export default adminController;
