// userDashboardController.js
import userDashboardModel from './userDashboardModel.js';

const userDashboardController = {
  async getDashboardStats(req, res) {
    try {
      const stats = await userDashboardModel.getDashboardStats(req.user.id);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
      });
    }
  },

  async getUserProfile(req, res) {
    try {
      const profile = await userDashboardModel.getUserProfile(req.user.id);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found',
        });
      }
      res.json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error('Error getting user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile',
      });
    }
  },

  async getUserProjects(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;

      const { projects, total } = await userDashboardModel.getUserProjects(
        req.user.id,
        page,
        perPage
      );

      // Modify response structure to match frontend expectations
      res.json({
        status: 'success',
        data: projects, // Now projects is a flat array of objects
        pagination: {
          total,
          page,
          per_page: perPage,
          total_pages: Math.ceil(total / perPage),
        },
      });
    } catch (error) {
      console.error('Error getting user projects:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch projects',
      });
    }
  },

  async getUserJournals(req, res) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;

      if (!userId) {
        return res.status(400).json({
          status: 'error',
          message: 'User ID is required',
        });
      }

      const page = parseInt(req.query.page) || 1;
      const perPage = parseInt(req.query.per_page) || 10;
      const status = req.query.status || null; // null means all statuses
      const sortBy = req.query.sort_by || 'updated_at'; // default sort by updated_at

      const { journals, total } = await userDashboardModel.getUserJournals(
        userId,
        page,
        perPage,
        status,
        sortBy
      );

      // The journals array is directly what we want to send
      res.json({
        status: 'success',
        data: journals,
        pagination: {
          total: total || 0,
          page,
          per_page: perPage,
          total_pages: Math.ceil((total || 0) / perPage),
        },
      });
    } catch (error) {
      console.error('Controller error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch journals',
      });
    }
  },

  async getProjectDetails(req, res) {
    try {
      const projectId = parseInt(req.params.id);
      const project = await userDashboardModel.getProjectDetails(
        req.user.id,
        projectId
      );

      // Log the full project data for debugging
      // console.log('Project Data:', project);

      if (!project) {
        return res.status(404).json({
          status: 'error',
          message: 'Project not found',
        });
      }

      res.json({
        status: 'success',
        data: project,
      });
    } catch (error) {
      console.error('Error getting project details:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch project details',
      });
    }
  },

  async getJournalDetails(req, res) {
    try {
      const journalId = parseInt(req.params.id);
      const journal = await userDashboardModel.getJournalDetails(
        req.user.id,
        journalId
      );

      if (!journal) {
        return res.status(404).json({
          status: 'error',
          message: 'Journal not found',
        });
      }

      res.json({
        status: 'success',
        data: journal,
      });
    } catch (error) {
      console.error('Error getting journal details:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch journal details',
      });
    }
  },

  async deleteJournal(req, res) {
    try {
      const result = await userDashboardModel.deleteJournal(
        req.user.id,
        req.params.id
      );
      if (!result) {
        return res.status(404).json({
          status: 'error',
          message: 'Journal not found or already deleted',
        });
      }
      res.json({
        status: 'success',
        message: 'Journal deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting journal:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete journal',
      });
    }
  },
};

export default userDashboardController;
