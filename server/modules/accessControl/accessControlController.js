import accessControlModel from './accessControlModel.js';

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  return res.status(error.statusCode || 500).json({
    status: 'error',
    message: error.message || fallbackMessage,
  });
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }

    if (value.toLowerCase() === 'false') {
      return false;
    }
  }

  return null;
};

const accessControlController = {
  async getPermissions(req, res) {
    try {
      const permissions = await accessControlModel.getAllPermissions();

      return res.json({
        status: 'success',
        data: permissions,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch permissions');
    }
  },

  async getRoles(req, res) {
    try {
      const roles = await accessControlModel.getRolesWithPermissions();

      return res.json({
        status: 'success',
        data: roles,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch roles');
    }
  },

  async createRole(req, res) {
    try {
      const {
        role_name,
        role_code,
        description,
        permission_keys,
        is_admin_role,
      } = req.body || {};

      const role = await accessControlModel.createRole({
        role_name,
        role_code,
        description,
        permission_keys: Array.isArray(permission_keys) ? permission_keys : [],
        is_admin_role,
      });

      return res.status(201).json({
        status: 'success',
        data: role,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to create role');
    }
  },

  async updateRolePermissions(req, res) {
    try {
      const { roleId } = req.params;
      const { permission_keys } = req.body || {};

      if (!Array.isArray(permission_keys)) {
        return res.status(400).json({
          status: 'error',
          message: 'permission_keys must be an array',
        });
      }

      const role = await accessControlModel.updateRolePermissions(
        roleId,
        permission_keys
      );

      return res.json({
        status: 'success',
        data: role,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to update role permissions');
    }
  },

  async getUsers(req, res) {
    try {
      const { search = '' } = req.query;
      const users = await accessControlModel.getUsersWithRoles(search);

      return res.json({
        status: 'success',
        data: users,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to fetch users');
    }
  },

  async updateUserRoles(req, res) {
    try {
      const { userId } = req.params;
      const { role_codes } = req.body || {};

      if (!Array.isArray(role_codes)) {
        return res.status(400).json({
          status: 'error',
          message: 'role_codes must be an array',
        });
      }

      const updatedUser = await accessControlModel.updateUserRoles(
        userId,
        role_codes,
        req.user?.id || null
      );

      return res.json({
        status: 'success',
        data: updatedUser,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to update user roles');
    }
  },

  async setUserSuperAdmin(req, res) {
    try {
      const { userId } = req.params;
      const { enabled } = req.body || {};
      const parsedEnabled = parseBoolean(enabled);

      if (parsedEnabled === null) {
        return res.status(400).json({
          status: 'error',
          message: 'enabled must be a boolean',
        });
      }

      const updatedUser = await accessControlModel.setUserSuperAdmin(
        userId,
        parsedEnabled,
        req.user?.id || null
      );

      return res.json({
        status: 'success',
        data: updatedUser,
      });
    } catch (error) {
      return handleError(res, error, 'Failed to update Super Admin access');
    }
  },
};

export default accessControlController;
