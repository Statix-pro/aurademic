import { Request, Response } from 'express';
import formOptionsModel from './formOptionsModel.js';

const formOptionsController = {
  async getAllOptions(req: Request, res: Response) {
    try {
      const journals = await formOptionsModel.getJournalOptions();
      res.json({
        status: 'success',
        data: journals,
      });
    } catch (error: any) {
      console.error('Error in getAllOptions:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async addOption(req: Request, res: Response) {
    try {
      const newJournal = await formOptionsModel.addJournalOption(req.body);
      res.status(201).json({
        status: 'success',
        data: newJournal,
      });
    } catch (error: any) {
      console.error('Error in addOption:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async updateOption(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await formOptionsModel.updateJournalOption(id, req.body);

      if (success) {
        res.json({
          status: 'success',
          message: 'Journal option updated successfully',
        });
      } else {
        res.status(404).json({
          status: 'error',
          message: 'Journal option not found',
        });
      }
    } catch (error: any) {
      console.error('Error in updateOption:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async deleteOption(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const success = await formOptionsModel.deleteJournalOption(id);

      if (success) {
        res.json({
          status: 'success',
          message: 'Journal option deleted successfully',
        });
      } else {
        res.status(404).json({
          status: 'error',
          message: 'Journal option not found',
        });
      }
    } catch (error: any) {
      console.error('Error in deleteOption:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  // Project Agency Options Controllers
  async getProjectAgencyOptions(req: Request, res: Response) {
    try {
      const options = await formOptionsModel.getProjectAgencyOptions();
      res.json({ status: 'success', data: options });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectAgencyOption(req: Request, res: Response) {
    try {
      const newOption = await formOptionsModel.addProjectAgencyOption(req.body);
      res.status(201).json({ status: 'success', data: newOption });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async updateProjectAgencyOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.updateProjectAgencyOption(
        req.params.id,
        req.body
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Agency option updated successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Agency option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async deleteProjectAgencyOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.deleteProjectAgencyOption(
        req.params.id
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Agency option deleted successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Agency option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Project Scheme Options Controllers
  async getProjectSchemeOptions(req: Request, res: Response) {
    try {
      const options = await formOptionsModel.getProjectSchemeOptions();
      res.json({ status: 'success', data: options });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectSchemeOption(req: Request, res: Response) {
    try {
      const newOption = await formOptionsModel.addProjectSchemeOption(req.body);
      res.status(201).json({ status: 'success', data: newOption });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async updateProjectSchemeOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.updateProjectSchemeOption(
        req.params.id,
        req.body
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Scheme option updated successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Scheme option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async deleteProjectSchemeOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.deleteProjectSchemeOption(
        req.params.id
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Scheme option deleted successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Scheme option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // Project Agency Type Options Controllers
  async getProjectAgencyTypeOptions(req: Request, res: Response) {
    try {
      const options = await formOptionsModel.getProjectAgencyTypeOptions();
      res.json({ status: 'success', data: options });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectAgencyTypeOption(req: Request, res: Response) {
    try {
      const newOption = await formOptionsModel.addProjectAgencyTypeOption(
        req.body
      );
      res.status(201).json({ status: 'success', data: newOption });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async updateProjectAgencyTypeOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.updateProjectAgencyTypeOption(
        req.params.id,
        req.body
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Agency type option updated successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Agency type option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async deleteProjectAgencyTypeOption(req: Request, res: Response) {
    try {
      const success = await formOptionsModel.deleteProjectAgencyTypeOption(
        req.params.id
      );
      if (success) {
        res.json({
          status: 'success',
          message: 'Agency type option deleted successfully',
        });
      } else {
        res
          .status(404)
          .json({ status: 'error', message: 'Agency type option not found' });
      }
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },
};

export default formOptionsController;
