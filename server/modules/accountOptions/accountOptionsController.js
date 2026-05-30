import accountOptionsModel from './accountOptionsModel.js';

const getActorUserId = (req) => Number.parseInt(req.user?.id, 10) || null;

const sendError = (res, error, fallbackMessage) => {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  return res.status(statusCode).json({
    status: 'error',
    message: error?.message || fallbackMessage,
  });
};

const accountOptionsController = {
  async listAccountOptions(_req, res) {
    try {
      const options = await accountOptionsModel.listAccountOptions();
      return res.json({ status: 'success', data: options });
    } catch (error) {
      return sendError(res, error, 'Failed to load account options');
    }
  },

  async createAccountOption(req, res) {
    try {
      const accountName = req.body?.account_name ?? req.body?.name;
      const option = await accountOptionsModel.createAccountOption({
        accountName,
        actorUserId: getActorUserId(req),
      });
      return res.status(201).json({ status: 'success', data: option });
    } catch (error) {
      return sendError(res, error, 'Failed to add account option');
    }
  },

  async updateAccountOption(req, res) {
    try {
      const accountName = req.body?.account_name ?? req.body?.name;
      const option = await accountOptionsModel.updateAccountOption(req.params.id, {
        accountName,
        actorUserId: getActorUserId(req),
      });

      if (!option) {
        return res.status(404).json({
          status: 'error',
          message: 'Account option not found',
        });
      }

      return res.json({ status: 'success', data: option });
    } catch (error) {
      return sendError(res, error, 'Failed to update account option');
    }
  },

  async deleteAccountOption(req, res) {
    try {
      const deleted = await accountOptionsModel.deleteAccountOption(req.params.id, {
        actorUserId: getActorUserId(req),
      });

      if (!deleted) {
        return res.status(404).json({
          status: 'error',
          message: 'Account option not found',
        });
      }

      return res.json({
        status: 'success',
        message: 'Account option deleted',
      });
    } catch (error) {
      return sendError(res, error, 'Failed to delete account option');
    }
  },
};

export default accountOptionsController;
