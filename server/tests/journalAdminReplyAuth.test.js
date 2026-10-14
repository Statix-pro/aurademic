/**
 * `PUT /api/status-updates/:id/admin-reply` used to sit behind
 * `authMiddleware` alone, so ANY authenticated user could write a reply that
 * renders to the author as coming from an administrator. The equivalent route
 * on the admin router was correctly gated the whole time, which is what made
 * the gap easy to miss.
 *
 * These tests pin the gate. They matter because the route has no client caller,
 * so nothing else would notice if it regressed.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/journal/journalModel.js', () => ({
  default: {
    updateStatusUpdateAdminReply: vi.fn(),
    getStatusUpdateContext: vi.fn(),
  },
}));

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn() },
}));

// Stubbed so the reply's notification emit is a clean no-op here (it is
// covered in notificationService.test.js) and so this suite can assert that
// the author is told.
vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
  emit: vi.fn(),
}));

import accessControlModel from '../modules/accessControl/accessControlModel.js';
import journalModel from '../modules/journal/journalModel.js';
import notificationService from '../modules/notification/notificationService.js';
import app from '../server.js';

const ROUTE = '/api/status-updates/7/admin-reply';
let token;

const snapshot = (permissions, extra = {}) => ({
  roles: ['faculty'],
  permissions,
  isAdmin: false,
  isSuperAdmin: false,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  token = jwt.sign(
    { userId: 5, email: 'faculty@ksrct.ac.in', name: 'Ordinary User', roles: ['faculty'] },
    process.env.JWT_SECRET,
  );
  journalModel.updateStatusUpdateAdminReply.mockResolvedValue({ affectedRows: 1 });
  journalModel.getStatusUpdateContext.mockResolvedValue({
    id: 7,
    journal_id: 3,
    user_id: 9,
    title: 'A Paper',
  });
});

describe('PUT /api/status-updates/:statusUpdateId/admin-reply', () => {
  it('refuses an authenticated user with no reviewer permission', async () => {
    // The whole point: being logged in is not enough.
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot(['journal.create']));

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_reply: 'Approved by me, the definitely-an-admin.' });

    expect(response.status).toBe(403);
    expect(journalModel.updateStatusUpdateAdminReply).not.toHaveBeenCalled();
  });

  it('allows a user holding admin_dashboard.approve', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['admin_dashboard.approve']),
    );

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_reply: 'Please share the acceptance mail.' });

    expect(response.status).toBe(200);
    expect(journalModel.updateStatusUpdateAdminReply).toHaveBeenCalledWith(
      '7',
      'Please share the acceptance mail.',
    );

    // The author of the update — not the reviewer — is the one told about it.
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journal.status_update_replied',
        actorUserId: 5,
        audience: [{ kind: 'user', userId: 9, recipientRole: 'applicant' }],
      }),
    );
  });

  it('allows a user holding admin_dashboard.manage', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['admin_dashboard.manage']),
    );

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_reply: 'Noted.' });

    expect(response.status).toBe(200);
  });

  it('allows a super admin', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot([], { isSuperAdmin: true, roles: ['super_admin'] }),
    );

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_reply: 'Noted.' });

    expect(response.status).toBe(200);
  });

  it('still refuses an unauthenticated request', async () => {
    const response = await request(app).put(ROUTE).send({ admin_reply: 'hello' });

    expect(response.status).toBe(401);
    expect(journalModel.updateStatusUpdateAdminReply).not.toHaveBeenCalled();
    expect(notificationService.emit).not.toHaveBeenCalled();
  });

  it('validates the body only after the permission check passes', async () => {
    // An empty reply from someone who may not reply must read as 403, not 400 —
    // the response should not confirm the route's validation rules to a caller
    // who has no business here.
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot(['journal.create']));

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${token}`)
      .send({ admin_reply: '' });

    expect(response.status).toBe(403);
  });
});
