import db from '../../config/connection.js';

const SUPER_ADMIN_ROLE_CODE = 'super_admin';

const LEGACY_ADMIN_PERMISSION_KEYS = [
  'admin_dashboard.read',
  'admin_dashboard.edit',
  'admin_dashboard.approve',
  'admin_dashboard.manage',
  'form_options.read',
  'form_options.edit',
  'form_options.manage',
  'access_control.read',
  'access_control.manage',
];

const SYSTEM_PERMISSION_SEED = [
  {
    module_key: 'admin_dashboard',
    action_key: 'read',
    permission_key: 'admin_dashboard.read',
    description: 'View admin dashboard data',
    is_system: true,
  },
  {
    module_key: 'admin_dashboard',
    action_key: 'edit',
    permission_key: 'admin_dashboard.edit',
    description: 'Edit admin-managed records',
    is_system: true,
  },
  {
    module_key: 'admin_dashboard',
    action_key: 'approve',
    permission_key: 'admin_dashboard.approve',
    description: 'Approve and reject admin workflows',
    is_system: true,
  },
  {
    module_key: 'admin_dashboard',
    action_key: 'manage',
    permission_key: 'admin_dashboard.manage',
    description: 'Full admin dashboard access',
    is_system: true,
  },
  {
    module_key: 'form_options',
    action_key: 'read',
    permission_key: 'form_options.read',
    description: 'View form option masters',
    is_system: true,
  },
  {
    module_key: 'form_options',
    action_key: 'edit',
    permission_key: 'form_options.edit',
    description: 'Create and update form options',
    is_system: true,
  },
  {
    module_key: 'form_options',
    action_key: 'manage',
    permission_key: 'form_options.manage',
    description: 'Full control over form options',
    is_system: true,
  },
  {
    module_key: 'finance',
    action_key: 'read',
    permission_key: 'finance.read',
    description: 'View finance requests',
    is_system: true,
  },
  {
    module_key: 'finance',
    action_key: 'edit',
    permission_key: 'finance.edit',
    description: 'Edit finance requests',
    is_system: true,
  },
  {
    module_key: 'finance',
    action_key: 'approve',
    permission_key: 'finance.approve',
    description: 'Approve finance requests',
    is_system: true,
  },
  {
    module_key: 'publications',
    action_key: 'read',
    permission_key: 'publications.read',
    description: 'View publication records',
    is_system: true,
  },
  {
    module_key: 'publications',
    action_key: 'edit',
    permission_key: 'publications.edit',
    description: 'Edit publication records',
    is_system: true,
  },
  {
    module_key: 'projects',
    action_key: 'read',
    permission_key: 'projects.read',
    description: 'View project records',
    is_system: true,
  },
  {
    module_key: 'projects',
    action_key: 'edit',
    permission_key: 'projects.edit',
    description: 'Edit project records',
    is_system: true,
  },
  {
    module_key: 'events',
    action_key: 'read',
    permission_key: 'events.read',
    description: 'View events',
    is_system: true,
  },
  {
    module_key: 'events',
    action_key: 'edit',
    permission_key: 'events.edit',
    description: 'Create and edit events',
    is_system: true,
  },
  {
    module_key: 'reports',
    action_key: 'read',
    permission_key: 'reports.read',
    description: 'View reports',
    is_system: true,
  },
  {
    module_key: 'reports',
    action_key: 'manage',
    permission_key: 'reports.manage',
    description: 'Manage report access and exports',
    is_system: true,
  },
  {
    module_key: 'access_control',
    action_key: 'read',
    permission_key: 'access_control.read',
    description: 'View roles and permissions',
    is_system: true,
  },
  {
    module_key: 'access_control',
    action_key: 'manage',
    permission_key: 'access_control.manage',
    description: 'Create roles and assign access',
    is_system: true,
  },
];

const SYSTEM_PERMISSION_KEYS = new Set(
  SYSTEM_PERMISSION_SEED.map((permission) => permission.permission_key)
);

const RBAC_MIGRATION_MESSAGE =
  'RBAC tables are missing. Run migration 20260206_add_rbac_for_admin_access.sql.';
const DYNAMIC_PERMISSION_MIGRATION_MESSAGE =
  'Permission metadata is missing. Run migration 20260207_add_dynamic_permission_management.sql.';

const normalizeRoleCode = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_');
};

const normalizePermissionToken = (value) => {
  if (!value) return '';
  return value
    .toString()
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_');
};

const uniqueStringArray = (values = []) => [
  ...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean)
  ),
];

const isMissingRbacTableError = (error) => {
  if (!error) {
    return false;
  }

  return (
    error.code === 'ER_NO_SUCH_TABLE' ||
    (typeof error.message === 'string' &&
      error.message.toLowerCase().includes("doesn't exist"))
  );
};

const isMissingDynamicPermissionColumnError = (error) => {
  if (!error || error.code !== 'ER_BAD_FIELD_ERROR') {
    return false;
  }

  return (
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('is_system')
  );
};

const makeRbacError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getEmptyAuthorizationSnapshot = () => ({
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  isAdmin: false,
});

const groupUserRows = (rows = []) => {
  if (!rows.length) {
    return null;
  }

  const firstRow = rows[0];
  const roles = [];

  rows.forEach((row) => {
    if (row.role_id) {
      roles.push({
        id: row.role_id,
        role_code: row.role_code,
        role_name: row.role_name,
      });
    }
  });

  const uniqueRoles = roles.filter(
    (role, index) =>
      roles.findIndex((item) => item.role_code === role.role_code) === index
  );

  return {
    id: firstRow.id,
    name: firstRow.name,
    email: firstRow.email,
    is_admin: Boolean(firstRow.is_admin),
    is_super_admin: uniqueRoles.some(
      (role) => role.role_code === SUPER_ADMIN_ROLE_CODE
    ),
    roles: uniqueRoles,
  };
};

const validatePermissionPayload = ({
  module_key,
  action_key,
  permission_key,
  description,
}) => {
  const normalizedModuleKey = normalizePermissionToken(module_key || '');
  const normalizedActionKey = normalizePermissionToken(action_key || '');

  if (!normalizedModuleKey) {
    throw makeRbacError('module_key is required', 400);
  }

  if (!normalizedActionKey) {
    throw makeRbacError('action_key is required', 400);
  }

  const normalizedPermissionKey = permission_key
    ? permission_key.toString().trim().toLowerCase()
    : `${normalizedModuleKey}.${normalizedActionKey}`;

  if (!normalizedPermissionKey || !normalizedPermissionKey.includes('.')) {
    throw makeRbacError('permission_key must be in module.action format', 400);
  }

  return {
    module_key: normalizedModuleKey,
    action_key: normalizedActionKey,
    permission_key: normalizedPermissionKey,
    description: description?.toString().trim() || null,
  };
};

const accessControlModel = {
  async getUserAuthorizationSnapshot(userId) {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return getEmptyAuthorizationSnapshot();
    }

    const [userRows] = await db.query(
      'SELECT id, is_admin FROM users WHERE id = ? LIMIT 1',
      [parsedUserId]
    );

    if (!userRows.length) {
      return getEmptyAuthorizationSnapshot();
    }

    const legacyIsAdmin = Boolean(userRows[0].is_admin);
    const fallbackPermissions = legacyIsAdmin
      ? [...LEGACY_ADMIN_PERMISSION_KEYS]
      : [];

    try {
      const [roleRows] = await db.query(
        `
          SELECT
            r.id,
            r.role_code,
            r.role_name,
            r.is_admin_role
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = ?
          ORDER BY r.role_name ASC
        `,
        [parsedUserId]
      );

      const [permissionRows] = await db.query(
        `
          SELECT DISTINCT
            p.permission_key
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = ?
          ORDER BY p.permission_key ASC
        `,
        [parsedUserId]
      );

      const roles = roleRows.map((role) => role.role_code);
      const hasAdminRole = roleRows.some((role) => Boolean(role.is_admin_role));
      let permissions = permissionRows.map((permission) => permission.permission_key);

      if (legacyIsAdmin && permissions.length === 0) {
        permissions = [...LEGACY_ADMIN_PERMISSION_KEYS];
      }

      const isSuperAdmin = roles.includes(SUPER_ADMIN_ROLE_CODE);

      return {
        roles,
        permissions: uniqueStringArray(permissions),
        isSuperAdmin,
        isAdmin: isSuperAdmin || hasAdminRole || legacyIsAdmin,
      };
    } catch (error) {
      if (isMissingRbacTableError(error)) {
        return {
          roles: [],
          permissions: fallbackPermissions,
          isSuperAdmin: false,
          isAdmin: legacyIsAdmin,
        };
      }

      throw error;
    }
  },

  async getAllPermissions() {
    try {
      const [rows] = await db.query(
        `
          SELECT
            id,
            module_key,
            action_key,
            permission_key,
            description,
            COALESCE(is_system, 0) AS is_system
          FROM permissions
          ORDER BY module_key ASC, action_key ASC
        `
      );

      return rows.map((permission) => ({
        ...permission,
        is_system: Boolean(permission.is_system),
      }));
    } catch (error) {
      if (isMissingRbacTableError(error)) {
        return SYSTEM_PERMISSION_SEED;
      }

      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async getPermissionById(permissionId) {
    const parsedPermissionId = Number(permissionId);

    if (!Number.isInteger(parsedPermissionId) || parsedPermissionId <= 0) {
      return null;
    }

    try {
      const [rows] = await db.query(
        `
          SELECT
            id,
            module_key,
            action_key,
            permission_key,
            description,
            COALESCE(is_system, 0) AS is_system
          FROM permissions
          WHERE id = ?
          LIMIT 1
        `,
        [parsedPermissionId]
      );

      if (!rows.length) {
        return null;
      }

      return {
        ...rows[0],
        is_system: Boolean(rows[0].is_system),
      };
    } catch (error) {
      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async createPermission(payload) {
    const permissionData = validatePermissionPayload(payload || {});

    if (SYSTEM_PERMISSION_KEYS.has(permissionData.permission_key)) {
      throw makeRbacError('System permission keys are reserved', 400);
    }

    try {
      const [result] = await db.query(
        `
          INSERT INTO permissions (
            module_key,
            action_key,
            permission_key,
            description,
            is_system
          )
          VALUES (?, ?, ?, ?, 0)
        `,
        [
          permissionData.module_key,
          permissionData.action_key,
          permissionData.permission_key,
          permissionData.description,
        ]
      );

      return this.getPermissionById(result.insertId);
    } catch (error) {
      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async updatePermission(permissionId, payload) {
    const existingPermission = await this.getPermissionById(permissionId);

    if (!existingPermission) {
      throw makeRbacError('Permission not found', 404);
    }

    if (existingPermission.is_system) {
      throw makeRbacError('System permissions cannot be modified', 400);
    }

    const mergedPayload = {
      module_key: payload?.module_key ?? existingPermission.module_key,
      action_key: payload?.action_key ?? existingPermission.action_key,
      permission_key: payload?.permission_key ?? existingPermission.permission_key,
      description:
        payload?.description !== undefined
          ? payload.description
          : existingPermission.description,
    };

    const permissionData = validatePermissionPayload(mergedPayload);

    if (SYSTEM_PERMISSION_KEYS.has(permissionData.permission_key)) {
      throw makeRbacError('System permission keys are reserved', 400);
    }

    try {
      await db.query(
        `
          UPDATE permissions
          SET
            module_key = ?,
            action_key = ?,
            permission_key = ?,
            description = ?
          WHERE id = ?
        `,
        [
          permissionData.module_key,
          permissionData.action_key,
          permissionData.permission_key,
          permissionData.description,
          existingPermission.id,
        ]
      );

      return this.getPermissionById(existingPermission.id);
    } catch (error) {
      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async deletePermission(permissionId) {
    const existingPermission = await this.getPermissionById(permissionId);

    if (!existingPermission) {
      throw makeRbacError('Permission not found', 404);
    }

    if (existingPermission.is_system) {
      throw makeRbacError('System permissions cannot be deleted', 400);
    }

    const [usageRows] = await db.query(
      'SELECT COUNT(*) AS total FROM role_permissions WHERE permission_id = ?',
      [existingPermission.id]
    );

    if (Number(usageRows[0]?.total || 0) > 0) {
      throw makeRbacError(
        'Permission is assigned to one or more roles. Remove it from roles first.',
        409
      );
    }

    try {
      await db.query('DELETE FROM permissions WHERE id = ?', [existingPermission.id]);

      return true;
    } catch (error) {
      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async getRolesWithPermissions() {
    try {
      const [rows] = await db.query(
        `
          SELECT
            r.id,
            r.role_code,
            r.role_name,
            r.description,
            r.is_system,
            r.is_admin_role,
            COALESCE(ru.assigned_user_count, 0) AS assigned_user_count,
            p.permission_key,
            p.module_key,
            p.action_key,
            p.description AS permission_description,
            COALESCE(p.is_system, 0) AS permission_is_system
          FROM roles r
          LEFT JOIN (
            SELECT role_id, COUNT(*) AS assigned_user_count
            FROM user_roles
            GROUP BY role_id
          ) ru ON ru.role_id = r.id
          LEFT JOIN role_permissions rp ON rp.role_id = r.id
          LEFT JOIN permissions p ON p.id = rp.permission_id
          ORDER BY r.is_system DESC, r.role_name ASC, p.module_key ASC, p.action_key ASC
        `
      );

      const roleMap = new Map();

      rows.forEach((row) => {
        if (!roleMap.has(row.id)) {
          roleMap.set(row.id, {
            id: row.id,
            role_code: row.role_code,
            role_name: row.role_name,
            description: row.description,
            is_system: Boolean(row.is_system),
            is_admin_role: Boolean(row.is_admin_role),
            assigned_user_count: Number(row.assigned_user_count || 0),
            permissions: [],
          });
        }

        if (row.permission_key) {
          roleMap.get(row.id).permissions.push({
            permission_key: row.permission_key,
            module_key: row.module_key,
            action_key: row.action_key,
            description: row.permission_description,
            is_system: Boolean(row.permission_is_system),
          });
        }
      });

      return Array.from(roleMap.values());
    } catch (error) {
      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      if (isMissingDynamicPermissionColumnError(error)) {
        throw makeRbacError(DYNAMIC_PERMISSION_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async createRole({
    role_name,
    role_code,
    description,
    permission_keys = [],
    is_admin_role = true,
  }) {
    const trimmedRoleName = role_name?.toString().trim();

    if (!trimmedRoleName) {
      throw makeRbacError('Role name is required', 400);
    }

    const generatedRoleCode = normalizeRoleCode(role_code || trimmedRoleName);

    if (!generatedRoleCode) {
      throw makeRbacError('Role code is invalid', 400);
    }

    const uniquePermissionKeys = uniqueStringArray(permission_keys);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [existingRoles] = await connection.query(
        'SELECT id FROM roles WHERE role_code = ? LIMIT 1',
        [generatedRoleCode]
      );

      if (existingRoles.length > 0) {
        throw makeRbacError('Role code already exists', 409);
      }

      const [insertRoleResult] = await connection.query(
        `
          INSERT INTO roles (
            role_code,
            role_name,
            description,
            is_system,
            is_admin_role
          )
          VALUES (?, ?, ?, 0, ?)
        `,
        [
          generatedRoleCode,
          trimmedRoleName,
          description?.toString().trim() || null,
          is_admin_role ? 1 : 0,
        ]
      );

      const roleId = insertRoleResult.insertId;

      if (uniquePermissionKeys.length > 0) {
        const [permissionRows] = await connection.query(
          'SELECT id, permission_key FROM permissions WHERE permission_key IN (?)',
          [uniquePermissionKeys]
        );

        if (permissionRows.length !== uniquePermissionKeys.length) {
          const foundPermissionKeys = permissionRows.map(
            (permission) => permission.permission_key
          );
          const missingPermissionKeys = uniquePermissionKeys.filter(
            (permissionKey) => !foundPermissionKeys.includes(permissionKey)
          );

          throw makeRbacError(
            `Invalid permission keys: ${missingPermissionKeys.join(', ')}`,
            400
          );
        }

        for (const permission of permissionRows) {
          await connection.query(
            `
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES (?, ?)
            `,
            [roleId, permission.id]
          );
        }
      }

      await connection.commit();

      return this.getRoleById(roleId);
    } catch (error) {
      await connection.rollback();

      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    } finally {
      connection.release();
    }
  },

  async getRoleById(roleId) {
    const parsedRoleId = Number(roleId);

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      return null;
    }

    const roles = await this.getRolesWithPermissions();

    return roles.find((role) => role.id === parsedRoleId) || null;
  },

  async updateRole(roleId, payload = {}) {
    const parsedRoleId = Number(roleId);

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      throw makeRbacError('Invalid role id', 400);
    }

    const [roleRows] = await db.query(
      `
        SELECT id, role_name, role_code, description, is_system, is_admin_role
        FROM roles
        WHERE id = ?
        LIMIT 1
      `,
      [parsedRoleId]
    );

    if (!roleRows.length) {
      throw makeRbacError('Role not found', 404);
    }

    const existingRole = roleRows[0];

    if (existingRole.is_system) {
      throw makeRbacError('System roles cannot be modified', 400);
    }

    const roleName =
      payload.role_name !== undefined
        ? payload.role_name.toString().trim()
        : existingRole.role_name;
    const description =
      payload.description !== undefined
        ? payload.description?.toString().trim() || null
        : existingRole.description;
    const isAdminRole =
      payload.is_admin_role !== undefined
        ? Boolean(payload.is_admin_role)
        : Boolean(existingRole.is_admin_role);

    if (!roleName) {
      throw makeRbacError('Role name is required', 400);
    }

    await db.query(
      `
        UPDATE roles
        SET role_name = ?, description = ?, is_admin_role = ?
        WHERE id = ?
      `,
      [roleName, description, isAdminRole ? 1 : 0, parsedRoleId]
    );

    return this.getRoleById(parsedRoleId);
  },

  async deleteRole(roleId) {
    const parsedRoleId = Number(roleId);

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      throw makeRbacError('Invalid role id', 400);
    }

    const [roleRows] = await db.query(
      `
        SELECT id, role_code, is_system
        FROM roles
        WHERE id = ?
        LIMIT 1
      `,
      [parsedRoleId]
    );

    if (!roleRows.length) {
      throw makeRbacError('Role not found', 404);
    }

    const existingRole = roleRows[0];

    if (existingRole.is_system || existingRole.role_code === SUPER_ADMIN_ROLE_CODE) {
      throw makeRbacError('System roles cannot be deleted', 400);
    }

    const [usageRows] = await db.query(
      'SELECT COUNT(*) AS total FROM user_roles WHERE role_id = ?',
      [parsedRoleId]
    );

    if (Number(usageRows[0]?.total || 0) > 0) {
      throw makeRbacError(
        'Role is assigned to users. Remove assignments before deleting the role.',
        409
      );
    }

    await db.query('DELETE FROM roles WHERE id = ?', [parsedRoleId]);

    return true;
  },

  async updateRolePermissions(roleId, permissionKeys = []) {
    const parsedRoleId = Number(roleId);

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      throw makeRbacError('Invalid role id', 400);
    }

    const uniquePermissionKeys = uniqueStringArray(permissionKeys);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [roleRows] = await connection.query(
        'SELECT id, role_code FROM roles WHERE id = ? LIMIT 1',
        [parsedRoleId]
      );

      if (!roleRows.length) {
        throw makeRbacError('Role not found', 404);
      }

      if (roleRows[0].role_code === SUPER_ADMIN_ROLE_CODE) {
        throw makeRbacError('Super Admin permissions cannot be modified', 400);
      }

      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [
        parsedRoleId,
      ]);

      if (uniquePermissionKeys.length > 0) {
        const [permissionRows] = await connection.query(
          'SELECT id, permission_key FROM permissions WHERE permission_key IN (?)',
          [uniquePermissionKeys]
        );

        if (permissionRows.length !== uniquePermissionKeys.length) {
          const foundPermissionKeys = permissionRows.map(
            (permission) => permission.permission_key
          );
          const missingPermissionKeys = uniquePermissionKeys.filter(
            (permissionKey) => !foundPermissionKeys.includes(permissionKey)
          );

          throw makeRbacError(
            `Invalid permission keys: ${missingPermissionKeys.join(', ')}`,
            400
          );
        }

        for (const permission of permissionRows) {
          await connection.query(
            `
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES (?, ?)
            `,
            [parsedRoleId, permission.id]
          );
        }
      }

      await connection.commit();

      return this.getRoleById(parsedRoleId);
    } catch (error) {
      await connection.rollback();

      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    } finally {
      connection.release();
    }
  },

  async getUsersWithRoles(search = '') {
    try {
      const normalizedSearch = search.toString().trim();
      const likeTerm = `%${normalizedSearch}%`;

      const [rows] = await db.query(
        `
          SELECT
            u.id,
            u.name,
            u.email,
            u.is_admin,
            r.id AS role_id,
            r.role_code,
            r.role_name
          FROM users u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN roles r ON r.id = ur.role_id
          WHERE
            ? = '' OR
            u.name LIKE ? OR
            u.email LIKE ?
          ORDER BY u.name ASC, u.email ASC
          LIMIT 500
        `,
        [normalizedSearch, likeTerm, likeTerm]
      );

      const userMap = new Map();

      rows.forEach((row) => {
        if (!userMap.has(row.id)) {
          userMap.set(row.id, {
            id: row.id,
            name: row.name,
            email: row.email,
            is_admin: Boolean(row.is_admin),
            is_super_admin: false,
            roles: [],
          });
        }

        const user = userMap.get(row.id);

        if (row.role_id) {
          user.roles.push({
            id: row.role_id,
            role_code: row.role_code,
            role_name: row.role_name,
          });

          if (row.role_code === SUPER_ADMIN_ROLE_CODE) {
            user.is_super_admin = true;
          }
        }
      });

      return Array.from(userMap.values());
    } catch (error) {
      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },

  async syncLegacyAdminFlag(connection, userId) {
    const [roleRows] = await connection.query(
      `
        SELECT
          r.is_admin_role
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `,
      [userId]
    );

    const hasAdminRole = roleRows.some((role) => Boolean(role.is_admin_role));

    await connection.query('UPDATE users SET is_admin = ? WHERE id = ?', [
      hasAdminRole ? 1 : 0,
      userId,
    ]);

    return hasAdminRole;
  },

  async ensureAtLeastOneSuperAdmin(connection) {
    const [superAdminRows] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE r.role_code = ?
      `,
      [SUPER_ADMIN_ROLE_CODE]
    );

    if (!superAdminRows[0] || Number(superAdminRows[0].total) <= 0) {
      throw makeRbacError('At least one Super Admin must remain assigned', 400);
    }
  },

  async updateUserRoles(userId, roleCodes = [], assignedBy = null) {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw makeRbacError('Invalid user id', 400);
    }

    const uniqueRoleCodes = uniqueStringArray(roleCodes);
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [userRows] = await connection.query(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [parsedUserId]
      );

      if (!userRows.length) {
        throw makeRbacError('User not found', 404);
      }

      let roleRows = [];

      if (uniqueRoleCodes.length > 0) {
        [roleRows] = await connection.query(
          'SELECT id, role_code FROM roles WHERE role_code IN (?)',
          [uniqueRoleCodes]
        );

        if (roleRows.length !== uniqueRoleCodes.length) {
          const foundRoleCodes = roleRows.map((role) => role.role_code);
          const missingRoleCodes = uniqueRoleCodes.filter(
            (roleCode) => !foundRoleCodes.includes(roleCode)
          );

          throw makeRbacError(
            `Invalid role codes: ${missingRoleCodes.join(', ')}`,
            400
          );
        }
      }

      await connection.query('DELETE FROM user_roles WHERE user_id = ?', [
        parsedUserId,
      ]);

      for (const role of roleRows) {
        await connection.query(
          `
            INSERT INTO user_roles (user_id, role_id, assigned_by)
            VALUES (?, ?, ?)
          `,
          [parsedUserId, role.id, assignedBy || null]
        );
      }

      await this.ensureAtLeastOneSuperAdmin(connection);

      await this.syncLegacyAdminFlag(connection, parsedUserId);

      await connection.commit();

      return this.getUserByIdWithRoles(parsedUserId);
    } catch (error) {
      await connection.rollback();

      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    } finally {
      connection.release();
    }
  },

  async setUserSuperAdmin(userId, enabled, assignedBy = null) {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      throw makeRbacError('Invalid user id', 400);
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [userRows] = await connection.query(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [parsedUserId]
      );

      if (!userRows.length) {
        throw makeRbacError('User not found', 404);
      }

      const [superRoleRows] = await connection.query(
        'SELECT id FROM roles WHERE role_code = ? LIMIT 1',
        [SUPER_ADMIN_ROLE_CODE]
      );

      if (!superRoleRows.length) {
        throw makeRbacError('Super Admin role is missing', 500);
      }

      const superRoleId = superRoleRows[0].id;

      if (enabled) {
        await connection.query(
          `
            INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by)
            VALUES (?, ?, ?)
          `,
          [parsedUserId, superRoleId, assignedBy || null]
        );
      } else {
        await connection.query(
          'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?',
          [parsedUserId, superRoleId]
        );

        await this.ensureAtLeastOneSuperAdmin(connection);
      }

      await this.syncLegacyAdminFlag(connection, parsedUserId);

      await connection.commit();

      return this.getUserByIdWithRoles(parsedUserId);
    } catch (error) {
      await connection.rollback();

      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    } finally {
      connection.release();
    }
  },

  async getUserByIdWithRoles(userId) {
    const parsedUserId = Number(userId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return null;
    }

    try {
      const [rows] = await db.query(
        `
          SELECT
            u.id,
            u.name,
            u.email,
            u.is_admin,
            r.id AS role_id,
            r.role_code,
            r.role_name
          FROM users u
          LEFT JOIN user_roles ur ON ur.user_id = u.id
          LEFT JOIN roles r ON r.id = ur.role_id
          WHERE u.id = ?
        `,
        [parsedUserId]
      );

      return groupUserRows(rows);
    } catch (error) {
      if (isMissingRbacTableError(error)) {
        throw makeRbacError(RBAC_MIGRATION_MESSAGE);
      }

      throw error;
    }
  },
};

export default accessControlModel;
