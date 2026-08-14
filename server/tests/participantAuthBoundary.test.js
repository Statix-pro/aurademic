import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';
// Deliberately the SAME value as JWT_SECRET: proves the audience check alone
// holds the boundary even if the two secrets are ever misconfigured to match.
process.env.JWT_PARTICIPANT_SECRET = 'test-secret-key';

import { PARTICIPANT_TOKEN_AUDIENCE } from '../config/participantAuth.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { participantAuthMiddleware } from '../middleware/participantAuthMiddleware.js';
import participantAuthModel from '../modules/participantAuth/participantAuthModel.js';

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

vi.mock('../modules/participantAuth/participantAuthModel.js', () => ({
  default: { findActiveParticipantById: vi.fn() },
}));

describe('Participant / staff token boundary', () => {
  let req;
  let res;
  let next;

  const staffToken = () =>
    jwt.sign({ userId: 1, email: 'staff@ksrct.ac.in', roles: ['user'] }, process.env.JWT_SECRET);

  const participantToken = (participantId = 7) =>
    jwt.sign({ participantId, email: 'public@gmail.com' }, process.env.JWT_PARTICIPANT_SECRET, {
      audience: PARTICIPANT_TOKEN_AUDIENCE,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    req = { headers: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  describe('authMiddleware (staff routes)', () => {
    it('rejects a participant token with 403', () => {
      req.headers.authorization = `Bearer ${participantToken()}`;

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('still accepts a staff token', () => {
      req.headers.authorization = `Bearer ${staffToken()}`;

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.email).toBe('staff@ksrct.ac.in');
    });
  });

  describe('participantAuthMiddleware (event site routes)', () => {
    it('rejects a staff token', async () => {
      req.headers.authorization = `Bearer ${staffToken()}`;

      await participantAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
      expect(req.participant).toBeUndefined();
    });

    it('rejects a request with no token', async () => {
      await participantAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts a participant token and never populates req.user', async () => {
      participantAuthModel.findActiveParticipantById.mockResolvedValue({
        id: 7,
        email: 'public@gmail.com',
        name: 'Public User',
        is_blocked: 0,
      });
      req.headers.authorization = `Bearer ${participantToken()}`;

      await participantAuthMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.participant).toEqual({
        id: 7,
        email: 'public@gmail.com',
        name: 'Public User',
      });
      expect(req.user).toBeUndefined();
    });

    it('rejects a blocked participant even with a valid token', async () => {
      participantAuthModel.findActiveParticipantById.mockResolvedValue({
        id: 7,
        email: 'public@gmail.com',
        name: 'Public User',
        is_blocked: 1,
      });
      req.headers.authorization = `Bearer ${participantToken()}`;

      await participantAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a token whose participant no longer exists', async () => {
      participantAuthModel.findActiveParticipantById.mockResolvedValue(null);
      req.headers.authorization = `Bearer ${participantToken()}`;

      await participantAuthMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
