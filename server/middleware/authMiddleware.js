import jwt from 'jsonwebtoken';

import accessControlModel from '../modules/accessControl/accessControlModel.js';

const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [, token] = authHeader.split(' ');

  return token || null;
};

const decodeTokenFromRequest = (req, res) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      message: 'Authentication required',
      shouldLogout: true,
    });
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        message: 'Token expired',
        shouldLogout: true,
        tokenExpired: true,
      });
      return null;
    }

    res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
    return null;
  }
};

const uniqueStringArray = (values = []) => [
  ...new Set(
    values
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

const normalizeDecodedUser = (decoded) => {
  const userId = decoded.userId || decoded.id;
  const decodedRoles = Array.isArray(decoded.roles)
    ? decoded.roles
    : decoded.role
      ? [decoded.role]
      : [];

  return {
    id: userId,
    email: decoded.email,
    name: decoded.name,
    isAdmin: Boolean(decoded.isAdmin ?? decoded.is_admin),
    isSuperAdmin: Boolean(decoded.isSuperAdmin ?? decoded.is_super_admin),
    roles: uniqueStringArray(decodedRoles),
    permissions: uniqueStringArray(Array.isArray(decoded.permissions) ? decoded.permissions : []),
  };
};

const normalizeRequestUser = (requestUser = {}) => ({
  id: requestUser.id,
  email: requestUser.email,
  name: requestUser.name,
  isAdmin: Boolean(requestUser.isAdmin ?? requestUser.is_admin),
  isSuperAdmin: Boolean(requestUser.isSuperAdmin ?? requestUser.is_super_admin),
  roles: uniqueStringArray(
    Array.isArray(requestUser.roles)
      ? requestUser.roles
      : requestUser.role
        ? [requestUser.role]
        : [],
  ),
  permissions: uniqueStringArray(
    Array.isArray(requestUser.permissions) ? requestUser.permissions : [],
  ),
});

const toRequestUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  isAdmin: Boolean(user.isAdmin),
  isSuperAdmin: Boolean(user.isSuperAdmin),
  roles: uniqueStringArray(user.roles),
  role: uniqueStringArray(user.roles)[0] || null,
  permissions: uniqueStringArray(user.permissions),
  authorizationResolved: Boolean(user.authorizationResolved),
  // Backward compatibility for older handlers/components
  is_admin: Boolean(user.isAdmin),
  is_super_admin: Boolean(user.isSuperAdmin),
});

const mergeAuthorizationSnapshot = async (user) => {
  if (!user?.id) {
    return user;
  }

  const authorization = await accessControlModel.getUserAuthorizationSnapshot(user.id);

  // The token's roles and permissions are a copy of this same snapshot, taken
  // when the token was signed and then frozen for its 24h lifetime. Falling
  // back to them can therefore only ever restore authority the database has
  // since taken away -- there is no grant the token can hold that the database
  // legitimately should not. The one exception is a snapshot that could not be
  // read at all: `degraded` marks the missing-RBAC-table branch, where the
  // stale copy is better than locking the estate out.
  //
  // This matters even for a user that still exists. Every user row gets a
  // `base_user` assignment, so a resolved snapshot always carries a role, but
  // its permission list is empty whenever that user's roles grant nothing --
  // and the old fallback then handed back whatever the token was signed with.
  const roles = authorization.degraded ? uniqueStringArray(user.roles) : authorization.roles;
  const permissions = authorization.degraded
    ? uniqueStringArray(user.permissions)
    : authorization.permissions;

  return {
    ...user,
    roles,
    permissions,
    // Authority comes from the database, never from the token. A token may say
    // who you are; it may not say what you may do.
    //
    // These were `authorization.X || user.X`. Because `user` is the DECODED
    // TOKEN, that OR meant a self-signed token asserting isSuperAdmin was
    // super-admin regardless of the database — and getUserAuthorizationSnapshot
    // returns an empty snapshot for an id with no users row, so the id did not
    // have to exist. permissionMiddleware short-circuits on isSuperAdmin, so
    // that claim bypassed every permission check on every write route.
    //
    // NOTE ON THE BLAST RADIUS: getUserAuthorizationSnapshot has a catch branch
    // for a missing RBAC table that returns isSuperAdmin false for everyone,
    // and the old fallback silently rescued an administrator in that state.
    // Failing closed is correct for an authority check, but it means a missing
    // table is now a lockout rather than a degradation. Pair this with a
    // startup check that the RBAC tables exist, so it surfaces at boot.
    isSuperAdmin: authorization.isSuperAdmin,
    isAdmin: authorization.isAdmin,
  };
};

const ensureLatestUserAuthorization = async (req, res) => {
  if (req.user?.authorizationResolved) {
    return req.user;
  }

  let baseUser;

  if (req.user?.id) {
    baseUser = normalizeRequestUser(req.user);
  } else {
    const decoded = decodeTokenFromRequest(req, res);

    if (!decoded) {
      return null;
    }

    baseUser = normalizeDecodedUser(decoded);

    if (!baseUser.id) {
      res.status(401).json({
        message: 'Invalid token payload',
        shouldLogout: true,
      });
      return null;
    }
  }

  const mergedUser = await mergeAuthorizationSnapshot(baseUser);
  req.user = toRequestUser({
    ...mergedUser,
    authorizationResolved: true,
  });

  return req.user;
};

export const authorizationSnapshotMiddleware = async (req, res, next) => {
  try {
    const user = await ensureLatestUserAuthorization(req, res);

    if (!user) {
      return;
    }

    return next();
  } catch (error) {
    console.error('Authorization snapshot refresh error:', error);

    return res.status(500).json({
      message: 'Failed to validate permissions',
    });
  }
};

export const authMiddleware = (req, res, next) => {
  try {
    const decoded = decodeTokenFromRequest(req, res);

    if (!decoded) {
      return;
    }

    const user = normalizeDecodedUser(decoded);

    if (!user.id) {
      return res.status(401).json({
        message: 'Invalid token payload',
        shouldLogout: true,
      });
    }

    req.user = toRequestUser({
      ...user,
      authorizationResolved: false,
    });

    return next();
  } catch (error) {
    return res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
  }
};

export const adminAuthMiddleware = async (req, res, next) => {
  try {
    const user = await ensureLatestUserAuthorization(req, res);

    if (!user) {
      return;
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        message: 'Admin access required',
      });
    }

    return next();
  } catch (error) {
    console.error('Admin token validation error:', error);

    return res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
  }
};

export const superAdminMiddleware = async (req, res, next) => {
  try {
    const user = await ensureLatestUserAuthorization(req, res);

    if (!user) {
      return;
    }

    if (!user.isSuperAdmin) {
      return res.status(403).json({
        message: 'Super Admin access required',
      });
    }

    return next();
  } catch (error) {
    console.error('Super admin validation error:', error);

    return res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
  }
};

export const permissionMiddleware = (requiredPermissions, { requireAll = false } = {}) => {
  const requiredPermissionList = uniqueStringArray(
    Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions],
  );

  return async (req, res, next) => {
    try {
      const user = await ensureLatestUserAuthorization(req, res);

      if (!user) {
        return;
      }

      if (user.isSuperAdmin) {
        return next();
      }

      if (requiredPermissionList.length === 0) {
        return next();
      }

      const userPermissionSet = new Set(uniqueStringArray(user.permissions));
      const matchesPermissionRequirement = (requiredPermission) => {
        const normalizedRequiredPermission = String(requiredPermission || '').trim();

        if (!normalizedRequiredPermission) {
          return false;
        }

        if (normalizedRequiredPermission.endsWith('*')) {
          const prefix = normalizedRequiredPermission.slice(0, -1);
          if (!prefix) {
            return false;
          }

          for (const permission of userPermissionSet) {
            if (permission.startsWith(prefix)) {
              return true;
            }
          }

          return false;
        }

        return userPermissionSet.has(normalizedRequiredPermission);
      };

      const hasAccess = requireAll
        ? requiredPermissionList.every((permission) => matchesPermissionRequirement(permission))
        : requiredPermissionList.some((permission) => matchesPermissionRequirement(permission));

      if (!hasAccess) {
        return res.status(403).json({
          message: 'Insufficient permissions',
          requiredPermissions: requiredPermissionList,
        });
      }

      return next();
    } catch (error) {
      console.error('Permission validation error:', error);

      return res.status(500).json({
        message: 'Failed to validate permissions',
      });
    }
  };
};
