/**
 * HTTP surface of the notification inbox.
 *
 * The test that matters most here is "user A cannot touch user B's
 * notification". Every model statement is scoped by `user_id`, so the guarantee
 * is structural rather than a check that could be forgotten on a new endpoint —
 * these tests pin that the endpoints actually pass the JWT's user through and
 * never a value from the request.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../modules/notification/notificationModel.js', () => ({
  default: {
    getSummary: vi.fn(),
    listForUser: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    archive: vi.fn(),
    getPreferences: vi.fn(),
    upsertPreferences: vi.fn(),
    upsertPushSubscription: vi.fn(),
    deletePushSubscription: vi.fn(),
    listPushSubscriptions: vi.fn(),
  },
}));

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn() },
}));

import notificationModel from '../modules/notification/notificationModel.js';
import app from '../server.js';

const USER_ID = 42;
let token;

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

beforeEach(() => {
  vi.clearAllMocks();
  token = jwt.sign(
    { userId: USER_ID, email: 'user@ksrct.ac.in', name: 'Test User', roles: ['faculty'] },
    process.env.JWT_SECRET,
  );
});

describe('GET /api/notifications/summary', () => {
  it('returns the unread count and newest id for the caller', async () => {
    notificationModel.getSummary.mockResolvedValue({ unreadCount: 3, latestId: 99 });

    const response = await auth(request(app).get('/api/notifications/summary'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { unreadCount: 3, latestId: 99 } });
    // The id comes from the verified token, never from the request.
    expect(notificationModel.getSummary).toHaveBeenCalledWith(USER_ID);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/notifications/summary');
    expect(response.status).toBe(401);
    expect(notificationModel.getSummary).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: 1 }, 'not-the-secret');
    const response = await request(app)
      .get('/api/notifications/summary')
      .set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
  });

  it('answers 500 with the envelope shape when the model fails', async () => {
    notificationModel.getSummary.mockRejectedValue(new Error('pool exhausted'));

    const response = await auth(request(app).get('/api/notifications/summary'));

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /api/notifications', () => {
  beforeEach(() => {
    notificationModel.listForUser.mockResolvedValue({
      items: [
        {
          id: 7,
          event_type: 'finance.approved',
          category: 'finance',
          severity: 'success',
          title: 'Approved',
          body: 'All done',
          link: '/finance/1',
          recipient_role: 'applicant',
          is_read: 0,
          read_at: null,
          created_at: '2026-09-02T00:00:00.000Z',
        },
      ],
      nextCursor: 6,
    });
  });

  it('camelCases the rows for the client', async () => {
    const response = await auth(request(app).get('/api/notifications'));

    expect(response.status).toBe(200);
    expect(response.body.data.items[0]).toEqual({
      id: 7,
      eventType: 'finance.approved',
      category: 'finance',
      severity: 'success',
      title: 'Approved',
      body: 'All done',
      link: '/finance/1',
      recipientRole: 'applicant',
      isRead: false,
      readAt: null,
      createdAt: '2026-09-02T00:00:00.000Z',
    });
    expect(response.body.data.nextCursor).toBe(6);
  });

  it('passes through the unread filter, category and cursor', async () => {
    await auth(
      request(app).get('/api/notifications?filter=unread&category=budget&limit=5&cursor=50'),
    );

    expect(notificationModel.listForUser).toHaveBeenCalledWith(USER_ID, {
      filter: 'unread',
      category: 'budget',
      limit: '5',
      cursor: '50',
    });
  });

  it('falls back to "all" for an unrecognised filter rather than erroring', async () => {
    await auth(request(app).get('/api/notifications?filter=nonsense'));

    expect(notificationModel.listForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filter: 'all' }),
    );
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it("marks the caller's own notification read", async () => {
    notificationModel.markRead.mockResolvedValue(true);

    const response = await auth(request(app).patch('/api/notifications/7/read'));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(notificationModel.markRead).toHaveBeenCalledWith(USER_ID, 7);
  });

  it('404s for a notification belonging to somebody else', async () => {
    // The UPDATE is scoped by user_id, so another user's row matches nothing.
    // A 404 rather than a 403 is deliberate: it does not confirm the row exists.
    notificationModel.markRead.mockResolvedValue(false);

    const response = await auth(request(app).patch('/api/notifications/999999/read'));

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('rejects a non-numeric id', async () => {
    const response = await auth(request(app).patch('/api/notifications/abc/read'));

    expect(response.status).toBe(400);
    expect(notificationModel.markRead).not.toHaveBeenCalled();
  });

  it('cannot be redirected at another user by a body field', async () => {
    notificationModel.markRead.mockResolvedValue(true);

    await auth(request(app).patch('/api/notifications/7/read')).send({ userId: 1 });

    expect(notificationModel.markRead).toHaveBeenCalledWith(USER_ID, 7);
  });
});

describe('POST /api/notifications/mark-all-read', () => {
  it('marks everything read and reports how many', async () => {
    notificationModel.markAllRead.mockResolvedValue(4);

    const response = await auth(request(app).post('/api/notifications/mark-all-read'));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ updated: 4 });
    expect(notificationModel.markAllRead).toHaveBeenCalledWith(USER_ID, { category: null });
  });

  it('can be limited to one category', async () => {
    notificationModel.markAllRead.mockResolvedValue(1);

    await auth(request(app).post('/api/notifications/mark-all-read')).send({ category: 'finance' });

    expect(notificationModel.markAllRead).toHaveBeenCalledWith(USER_ID, { category: 'finance' });
  });
});

describe('PATCH /api/notifications/:id/archive', () => {
  it("dismisses the caller's notification", async () => {
    notificationModel.archive.mockResolvedValue(true);

    const response = await auth(request(app).patch('/api/notifications/7/archive'));

    expect(response.status).toBe(200);
    expect(notificationModel.archive).toHaveBeenCalledWith(USER_ID, 7);
  });

  it('404s when it is not theirs', async () => {
    notificationModel.archive.mockResolvedValue(false);

    const response = await auth(request(app).patch('/api/notifications/7/archive'));

    expect(response.status).toBe(404);
  });
});

describe('GET /api/notifications/preferences', () => {
  it("returns the catalog with the user's overrides already resolved", async () => {
    notificationModel.getPreferences.mockResolvedValue([
      { event_type: 'finance.approved', category: 'finance', channel: 'web_push', is_enabled: 0 },
    ]);

    const response = await auth(request(app).get('/api/notifications/preferences'));

    expect(response.status).toBe(200);
    expect(response.body.data.channels).toEqual(['in_app', 'web_push']);

    const financeApproved = response.body.data.types.find(
      (row) => row.eventType === 'finance.approved',
    );
    // The override wins over the catalog default...
    expect(financeApproved.channels.web_push).toBe(false);
    // ...and untouched channels keep the default.
    expect(financeApproved.channels.in_app).toBe(true);

    // A type with no override at all resolves purely from the catalog.
    const untouched = response.body.data.types.find((row) => row.eventType === 'budget.deleted');
    expect(untouched.channels.in_app).toBe(true);
    expect(untouched.channels.web_push).toBe(false);
  });

  it('applies a category wildcard override', async () => {
    notificationModel.getPreferences.mockResolvedValue([
      { event_type: '*', category: 'finance', channel: 'in_app', is_enabled: 0 },
    ]);

    const response = await auth(request(app).get('/api/notifications/preferences'));

    const financeTypes = response.body.data.types.filter((row) => row.category === 'finance');
    expect(financeTypes.length).toBeGreaterThan(0);
    expect(financeTypes.every((row) => row.channels.in_app === false)).toBe(true);
    // Other categories are untouched.
    const budget = response.body.data.types.find((row) => row.category === 'budget');
    expect(budget.channels.in_app).toBe(true);
  });

  it('is not shadowed by the /:id routes', async () => {
    // "preferences" would parse as an id if the routes were declared the other
    // way round, and the user would get a 400 instead of their settings.
    notificationModel.getPreferences.mockResolvedValue([]);
    const response = await auth(request(app).get('/api/notifications/preferences'));
    expect(response.status).toBe(200);
  });
});

describe('PUT /api/notifications/preferences', () => {
  it('saves valid rows', async () => {
    notificationModel.upsertPreferences.mockResolvedValue(1);

    const response = await auth(request(app).put('/api/notifications/preferences')).send({
      preferences: [{ eventType: 'finance.approved', channel: 'web_push', isEnabled: false }],
    });

    expect(response.status).toBe(200);
    expect(notificationModel.upsertPreferences).toHaveBeenCalledWith(USER_ID, [
      { eventType: 'finance.approved', category: 'finance', channel: 'web_push', isEnabled: false },
    ]);
  });

  it('rejects an unknown event type instead of storing a dead row', async () => {
    const response = await auth(request(app).put('/api/notifications/preferences')).send({
      preferences: [{ eventType: 'made.up.type', channel: 'in_app', isEnabled: true }],
    });

    expect(response.status).toBe(400);
    expect(notificationModel.upsertPreferences).not.toHaveBeenCalled();
  });

  it('rejects an unknown channel', async () => {
    const response = await auth(request(app).put('/api/notifications/preferences')).send({
      preferences: [{ eventType: 'finance.approved', channel: 'carrier_pigeon', isEnabled: true }],
    });

    expect(response.status).toBe(400);
    expect(notificationModel.upsertPreferences).not.toHaveBeenCalled();
  });

  it('rejects a non-array body', async () => {
    const response = await auth(request(app).put('/api/notifications/preferences')).send({
      preferences: 'all off',
    });

    expect(response.status).toBe(400);
  });

  it('rejects an unreasonably large batch', async () => {
    const response = await auth(request(app).put('/api/notifications/preferences')).send({
      preferences: Array.from({ length: 501 }, () => ({
        eventType: 'finance.approved',
        channel: 'in_app',
        isEnabled: true,
      })),
    });

    expect(response.status).toBe(400);
  });
});

describe('web push subscription endpoints', () => {
  it('reports push as disabled when no VAPID key is configured', async () => {
    const previous = process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PUBLIC_KEY;

    const response = await auth(request(app).get('/api/notifications/push/public-key'));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ publicKey: null, enabled: false });

    if (previous !== undefined) process.env.VAPID_PUBLIC_KEY = previous;
  });

  it('stores a subscription against the caller', async () => {
    notificationModel.upsertPushSubscription.mockResolvedValue(true);

    const response = await auth(request(app).post('/api/notifications/push/subscribe')).send({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: 'key-material', auth: 'auth-secret' },
    });

    expect(response.status).toBe(201);
    expect(notificationModel.upsertPushSubscription).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        p256dh: 'key-material',
        auth: 'auth-secret',
      }),
    );
  });

  it('rejects a non-https endpoint', async () => {
    // A real push endpoint is always https. Anything else is either a mistake
    // or an attempt to make the server fetch something it should not.
    const response = await auth(request(app).post('/api/notifications/push/subscribe')).send({
      endpoint: 'http://attacker.example/collect',
      keys: { p256dh: 'k', auth: 'a' },
    });

    expect(response.status).toBe(400);
    expect(notificationModel.upsertPushSubscription).not.toHaveBeenCalled();
  });

  it('rejects a subscription missing its keys', async () => {
    const response = await auth(request(app).post('/api/notifications/push/subscribe')).send({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    });

    expect(response.status).toBe(400);
  });

  it('removes a subscription only for the caller', async () => {
    notificationModel.deletePushSubscription.mockResolvedValue(true);

    const response = await auth(request(app).delete('/api/notifications/push/subscribe')).send({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    });

    expect(response.status).toBe(200);
    expect(notificationModel.deletePushSubscription).toHaveBeenCalledWith(
      USER_ID,
      'https://fcm.googleapis.com/fcm/send/abc123',
    );
  });
});
