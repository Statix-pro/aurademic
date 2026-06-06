import accountOptionsModel from './accountOptionsModel.js';

const getActorUserId = (req) => Number.parseInt(req.user?.id, 10) || null;

const sendError = (res, error, fallbackMessage) => {
  let statusCode = Number(error?.statusCode || error?.status || 500);
  let code = error?.code;
  let message = error?.message || fallbackMessage;

  if (error && (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146)) {
    statusCode = 404;
    code = 'TABLE_NOT_FOUND';
    message = 'Table account_options does not exist';
  }

  return res.status(statusCode).json({
    success: false,
    code,
    message,
    error: message,
  });
};

const accountOptionsController = {
  async listAccountOptions(_req, res) {
    try {
      const options = await accountOptionsModel.listAccountOptions();
      return res.json({ success: true, data: options });
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
      return res.status(201).json({ success: true, data: option });
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
          success: false,
          message: 'Account option not found',
          error: 'Account option not found',
        });
      }

      return res.json({ success: true, data: option });
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
          success: false,
          message: 'Account option not found',
          error: 'Account option not found',
        });
      }

      return res.json({
        success: true,
        message: 'Account option deleted',
      });
    } catch (error) {
      return sendError(res, error, 'Failed to delete account option');
    }
  },
};

export default accountOptionsController;
