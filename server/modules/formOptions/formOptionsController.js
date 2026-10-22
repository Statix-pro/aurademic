import formOptionsModel from './formOptionsModel.js';
import { PUBLISHER_STATUSES, assertValidPublisherName } from '../shared/publishers.js';

/**
 * A model error that carries a statusCode is a rejected request (a website that
 * is not an http(s) address, a scheme move that would strand projects), not a
 * server fault, so it is answered with its own status.
 */
const respondWithError = (res, error) =>
  res.status(error.statusCode ?? 500).json({ status: 'error', message: error.message });

/** The publisher routes answer in the `{ success, data?, message? }` envelope. */
const respondWithPublisherError = (res, error, fallbackMessage) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const formOptionsController = {
  async getAllOptions(req, res) {
    try {
      const journals = await formOptionsModel.getJournalOptions();
      res.json({
        status: 'success',
        data: journals,
      });
    } catch (error) {
      console.error('Error in getAllOptions:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  async addOption(req, res) {
    try {
      const newJournal = await formOptionsModel.addJournalOption(req.body);
      res.status(201).json({
        status: 'success',
        data: newJournal,
      });
    } catch (error) {
      console.error('Error in addOption:', error);
      respondWithError(res, error);
    }
  },

  async updateOption(req, res) {
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
    } catch (error) {
      console.error('Error in updateOption:', error);
      respondWithError(res, error);
    }
  },

  async deleteOption(req, res) {
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
    } catch (error) {
      console.error('Error in deleteOption:', error);
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  },

  // ==========================================================================
  // Publishers
  // ==========================================================================

  async getPublishers(req, res) {
    try {
      const publishers = await formOptionsModel.getPublishers();
      return res.json({ success: true, data: publishers });
    } catch (error) {
      console.error('Error in getPublishers:', error);
      return res.status(500).json({ success: false, message: 'Failed to load publishers.' });
    }
  },

  async addPublisher(req, res) {
    try {
      const name = assertValidPublisherName(req.body?.name);
      const publisher = await formOptionsModel.addPublisher(name, req.user.id);
      return res.status(201).json({ success: true, data: publisher });
    } catch (error) {
      return respondWithPublisherError(res, error, 'Failed to add publisher.');
    }
  },

  async updatePublisher(req, res) {
    try {
      const name = assertValidPublisherName(req.body?.name);
      const status = String(req.body?.status ?? '');
      if (!PUBLISHER_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${PUBLISHER_STATUSES.join(', ')}.`,
        });
      }

      const updated = await formOptionsModel.updatePublisher(
        req.params.id,
        { name, status },
        req.user.id,
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Publisher not found' });
      }
      return res.json({ success: true, message: 'Publisher updated successfully' });
    } catch (error) {
      return respondWithPublisherError(res, error, 'Failed to update publisher.');
    }
  },

  async deletePublisher(req, res) {
    try {
      const deleted = await formOptionsModel.deletePublisher(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Publisher not found' });
      }
      return res.json({ success: true, message: 'Publisher deleted successfully' });
    } catch (error) {
      return respondWithPublisherError(res, error, 'Failed to delete publisher.');
    }
  },

  // ==========================================================================
  // Project organizations
  // ==========================================================================

  async getProjectOrganizations(req, res) {
    try {
      const organizations = await formOptionsModel.getProjectOrganizations();
      res.json({ status: 'success', data: organizations });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectOrganization(req, res) {
    try {
      if (!String(req.body?.name ?? '').trim()) {
        return res.status(400).json({ status: 'error', message: 'A name is required' });
      }

      const organization = await formOptionsModel.addProjectOrganization(req.body);
      return res.status(201).json({ status: 'success', data: organization });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async updateProjectOrganization(req, res) {
    try {
      if (!String(req.body?.name ?? '').trim()) {
        return res.status(400).json({ status: 'error', message: 'A name is required' });
      }

      const success = await formOptionsModel.updateProjectOrganization(req.params.id, req.body);
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Organization not found' });
      }
      return res.json({ status: 'success', message: 'Organization updated successfully' });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async deleteProjectOrganization(req, res) {
    try {
      const result = await formOptionsModel.deleteProjectOrganization(req.params.id);
      if (!result) {
        return res.status(404).json({ status: 'error', message: 'Organization not found' });
      }
      return res.json({
        status: 'success',
        message: result?.deactivated
          ? 'Organization is used by existing projects, so it was deactivated instead of deleted'
          : 'Organization deleted successfully',
      });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  // ==========================================================================
  // Project schemes
  // ==========================================================================

  async getProjectSchemes(req, res) {
    try {
      const schemes = await formOptionsModel.getProjectSchemes();
      res.json({ status: 'success', data: schemes });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectScheme(req, res) {
    try {
      if (!String(req.body?.name ?? '').trim()) {
        return res.status(400).json({ status: 'error', message: 'A name is required' });
      }
      if (!Number(req.body?.organization_id)) {
        return res
          .status(400)
          .json({ status: 'error', message: 'Select the funding agency that offers the scheme' });
      }

      const scheme = await formOptionsModel.addProjectScheme(req.body);
      return res.status(201).json({ status: 'success', data: scheme });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async updateProjectScheme(req, res) {
    try {
      if (!String(req.body?.name ?? '').trim() || !Number(req.body?.organization_id)) {
        return res
          .status(400)
          .json({ status: 'error', message: 'A name and funding agency are required' });
      }

      const success = await formOptionsModel.updateProjectScheme(req.params.id, req.body);
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Scheme not found' });
      }
      return res.json({ status: 'success', message: 'Scheme updated successfully' });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async deleteProjectScheme(req, res) {
    try {
      const result = await formOptionsModel.deleteProjectScheme(req.params.id);
      if (!result) {
        return res.status(404).json({ status: 'error', message: 'Scheme not found' });
      }
      return res.json({
        status: 'success',
        message: result?.deactivated
          ? 'Scheme is used by existing projects, so it was deactivated instead of deleted'
          : 'Scheme deleted successfully',
      });
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  },

  // ==========================================================================
  // Project budget heads
  // ==========================================================================

  async getProjectBudgetHeads(req, res) {
    try {
      const heads = await formOptionsModel.getProjectBudgetHeads();
      res.json({ status: 'success', data: heads });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  },

  async addProjectBudgetHead(req, res) {
    try {
      const head = await formOptionsModel.addProjectBudgetHead(req.body ?? {});
      return res.status(201).json({ status: 'success', data: head });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async updateProjectBudgetHead(req, res) {
    try {
      const success = await formOptionsModel.updateProjectBudgetHead(req.params.id, req.body ?? {});
      if (!success) {
        return res.status(404).json({ status: 'error', message: 'Budget head not found' });
      }
      return res.json({ status: 'success', message: 'Budget head updated successfully' });
    } catch (error) {
      return respondWithError(res, error);
    }
  },

  async deleteProjectBudgetHead(req, res) {
    try {
      const result = await formOptionsModel.deleteProjectBudgetHead(req.params.id);
      if (!result) {
        return res.status(404).json({ status: 'error', message: 'Budget head not found' });
      }
      return res.json({
        status: 'success',
        message: result?.deactivated
          ? 'Budget head is used by existing projects, so it was deactivated instead of deleted'
          : 'Budget head deleted successfully',
      });
    } catch (error) {
      return respondWithError(res, error);
    }
  },
};

export default formOptionsController;
