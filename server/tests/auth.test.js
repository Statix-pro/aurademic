import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Set environment variables for tests
process.env.JWT_SECRET = 'test-secret-key';

import {
  authMiddleware,
  adminAuthMiddleware,
  superAdminMiddleware,
  permissionMiddleware,
} from '../middleware/authMiddleware.js';
import accessControlModel from '../modules/accessControl/accessControlModel.js';

// Mock the accessControlModel
vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: {
    getUserAuthorizationSnapshot: vi.fn(),
  },
}));

describe('Authentication & Authorization Middlewares', () => {
  let req;
  let res;
  let next;

  const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('authMiddleware', () => {
    it('successfully authenticates a valid JWT token', () => {
      const payload = {
        userId: 1,
        email: 'faculty@ksrct.ac.in',
        name: 'John Doe',
        isAdmin: false,
        isSuperAdmin: false,
        roles: ['faculty'],
        permissions: ['budget.create'],
      };
      const token = generateToken(payload);

      req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      };

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
      expect(req.user.email).toBe('faculty@ksrct.ac.in');
      expect(req.user.isAdmin).toBe(false);
      expect(req.user.isSuperAdmin).toBe(false);
      expect(req.user.roles).toContain('faculty');
      expect(req.user.permissions).toContain('budget.create');
    });

    it('returns 401 if Authorization header is missing', () => {
      req = {
        headers: {},
      };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
          shouldLogout: true,
        }),
      );
    });

    it('returns 401 if token is invalid', () => {
      req = {
        headers: {
          authorization: 'Bearer invalid-token-value',
        },
      };

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          shouldLogout: true,
        }),
      );
    });
  });

  describe('adminAuthMiddleware', () => {
    it('allows access to an admin user', async () => {
      req = {
        user: {
          id: 2,
          email: 'admin@ksrct.ac.in',
          isAdmin: true,
          roles: ['admin'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['admin'],
        permissions: [],
        isAdmin: true,
        isSuperAdmin: false,
      });

      await adminAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('denies access if user is not an admin', async () => {
      req = {
        user: {
          id: 3,
          email: 'user@ksrct.ac.in',
          isAdmin: false,
          roles: ['faculty'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: [],
        isAdmin: false,
        isSuperAdmin: false,
      });

      await adminAuthMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Admin access required',
        }),
      );
    });
  });

  describe('superAdminMiddleware', () => {
    it('allows access to a super admin user', async () => {
      req = {
        user: {
          id: 4,
          email: 'super@ksrct.ac.in',
          isSuperAdmin: true,
          roles: ['super_admin'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['super_admin'],
        permissions: [],
        isAdmin: true,
        isSuperAdmin: true,
      });

      await superAdminMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('denies access if user is not a super admin', async () => {
      req = {
        user: {
          id: 2,
          email: 'admin@ksrct.ac.in',
          isSuperAdmin: false,
          roles: ['admin'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['admin'],
        permissions: [],
        isAdmin: true,
        isSuperAdmin: false,
      });

      await superAdminMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Super Admin access required',
        }),
      );
    });
  });

  describe('permissionMiddleware', () => {
    it('allows access if user has the specific required permission', async () => {
      req = {
        user: {
          id: 5,
          email: 'faculty@ksrct.ac.in',
          permissions: ['budget.view'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: ['budget.view'],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const middleware = permissionMiddleware('budget.view');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('denies access if user does not have the required permission', async () => {
      req = {
        user: {
          id: 5,
          email: 'faculty@ksrct.ac.in',
          permissions: ['budget.view'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: ['budget.view'],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const middleware = permissionMiddleware('budget.delete');
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
          requiredPermissions: ['budget.delete'],
        }),
      );
    });

    it('allows access via wildcard permission matching', async () => {
      req = {
        user: {
          id: 5,
          email: 'faculty@ksrct.ac.in',
          permissions: ['budget.workflow.level1'],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['faculty'],
        permissions: ['budget.workflow.level1'],
        isAdmin: false,
        isSuperAdmin: false,
      });

      const middleware = permissionMiddleware('budget.workflow.*');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('allows access if user is super admin regardless of permissions list', async () => {
      req = {
        user: {
          id: 4,
          email: 'super@ksrct.ac.in',
          isSuperAdmin: true,
          permissions: [],
        },
      };

      accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue({
        roles: ['super_admin'],
        permissions: [],
        isAdmin: true,
        isSuperAdmin: true,
      });

      const middleware = permissionMiddleware('budget.delete');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
