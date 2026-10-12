/**
 * HTTP handlers for the notification inbox, preferences and push subscriptions.
 *
 * Every handler derives the user from `req.user.id` and never from the request
 * body or params. That is the whole authorization story for this module: there
 * is no notification a user may read or modify other than their own, so there
 * is nothing to gate beyond `authMiddleware`.
 */

import { CHANNELS, listCatalogForPreferences } from './notificationCatalog.js';
import { canReceiveNotificationType, userCapabilities } from './notificationEligibility.js';
import notificationModel from './notificationModel.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const VALID_FILTERS = new Set(['all', 'unread']);

/** DB rows are snake_case; the client speaks camelCase. */
const toClientNotification = (row) => ({
  id: row.id,
  eventType: row.event_type,
  category: row.category,
  severity: row.severity,
  title: row.title,
  body: row.body,
  link: row.link,
  recipientRole: row.recipient_role,
  isRead: Boolean(row.is_read),
  readAt: row.read_at,
  createdAt: row.created_at,
});

const notificationController = {
  /**
   * The bell's poll target. Kept to two aggregates so it stays cheap enough to
   * call every 45 seconds per active user.
   */
  async getSummary(req, res) {
    try {
      const summary = await notificationModel.getSummary(req.user.id);
      return res.status(200).json({ success: true, data: summary });
    } catch (error) {
      console.error('Failed to load notification summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load notification summary',
      });
    }
  },

  async list(req, res) {
    try {
      const filter = VALID_FILTERS.has(String(req.query.filter)) ? String(req.query.filter) : 'all';
      const category = req.query.category ? String(req.query.category).slice(0, 50) : null;

      const { items, nextCursor } = await notificationModel.listForUser(req.user.id, {
        filter,
        category,
        limit: req.query.limit,
        cursor: req.query.cursor,
      });

      return res.status(200).json({
        success: true,
        data: { items: items.map(toClientNotification), nextCursor },
      });
    } catch (error) {
      console.error('Failed to list notifications:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load notifications',
      });
    }
  },

  async markRead(req, res) {
    try {
      const notificationId = toPositiveInt(req.params.id);
      if (!notificationId) {
        return res.status(400).json({ success: false, message: 'Invalid notification id' });
      }

      const updated = await notificationModel.markRead(req.user.id, notificationId);

      // The UPDATE is scoped by user_id, so "not found" and "belongs to someone
      // else" are the same answer here — which is what we want to expose.
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      console.error('Failed to mark notification read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
      });
    }
  },

  async markAllRead(req, res) {
    try {
      const category = req.body?.category ? String(req.body.category).slice(0, 50) : null;
      const count = await notificationModel.markAllRead(req.user.id, { category });

      return res.status(200).json({
        success: true,
        data: { updated: count },
        message: `${count} notification(s) marked as read`,
      });
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to mark notifications as read',
      });
    }
  },

  async archive(req, res) {
    try {
      const notificationId = toPositiveInt(req.params.id);
      if (!notificationId) {
        return res.status(400).json({ success: false, message: 'Invalid notification id' });
      }

      const updated = await notificationModel.archive(req.user.id, notificationId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }

      return res.status(200).json({ success: true, message: 'Notification dismissed' });
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to dismiss notification',
      });
    }
  },

  /**
   * The catalog joined with this user's overrides — everything the preferences
   * screen needs in one call, with `enabled` already resolved so the UI does
   * not have to reimplement the precedence rules.
   */
  async getPreferences(req, res) {
    try {
      const overrides = await notificationModel.getPreferences(req.user.id);

      // Only what this person can actually be sent: an approver-queue switch is
      // noise on the screen of someone who never approves anything. The route
      // adds `authorizationSnapshotMiddleware` so these roles are the live ones
      // rather than the JWT's, which can be a day stale.
      const capabilities = userCapabilities(req.user);

      const types = listCatalogForPreferences()
        .filter((entry) => canReceiveNotificationType(entry, capabilities))
        .map((entry) => {
          const channels = {};

          for (const channel of CHANNELS) {
            const exact = overrides.find(
              (row) => row.event_type === entry.eventType && row.channel === channel,
            );
            const wildcard = overrides.find(
              (row) =>
                row.event_type === '*' &&
                row.category === entry.category &&
                row.channel === channel,
            );

            channels[channel] = exact
              ? Boolean(exact.is_enabled)
              : wildcard
                ? Boolean(wildcard.is_enabled)
                : entry.defaultChannels.includes(channel);
          }

          return { ...entry, channels };
        });

      return res.status(200).json({
        success: true,
        data: { channels: [...CHANNELS], types },
      });
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to load notification preferences',
      });
    }
  },

  /**
   * Upserts overrides. Unknown event types and channels are rejected rather
   * than stored, so the table cannot accumulate rows the dispatcher will never
   * consult.
   */
  async updatePreferences(req, res) {
    try {
      const submitted = Array.isArray(req.body?.preferences) ? req.body.preferences : null;
      if (!submitted) {
        return res.status(400).json({
          success: false,
          message: 'preferences must be an array of { eventType, channel, isEnabled }',
        });
      }

      if (submitted.length > 500) {
        return res.status(400).json({ success: false, message: 'Too many preference rows' });
      }

      const catalog = new Map(listCatalogForPreferences().map((entry) => [entry.eventType, entry]));
      const rows = [];
      const rejected = [];

      for (const item of submitted) {
        const eventType = String(item?.eventType || '').trim();
        const channel = String(item?.channel || '').trim();
        const entry = catalog.get(eventType);

        if (!entry || !CHANNELS.includes(channel)) {
          rejected.push(`${eventType || '(empty)'} / ${channel || '(empty)'}`);
          continue;
        }

        rows.push({
          eventType,
          category: entry.category,
          channel,
          isEnabled: Boolean(item.isEnabled),
        });
      }

      if (rejected.length) {
        return res.status(400).json({
          success: false,
          message: `Unknown notification type or channel: ${rejected.join(', ')}`,
        });
      }

      await notificationModel.upsertPreferences(req.user.id, rows);

      return res.status(200).json({
        success: true,
        data: { updated: rows.length },
        message: 'Notification preferences saved',
      });
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save notification preferences',
      });
    }
  },

  /**
   * The VAPID public key. Public by design — it is the identifier a browser
   * needs to create a subscription, and is useless without the private half.
   */
  async getPushPublicKey(req, res) {
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
    return res.status(200).json({
      success: true,
      data: { publicKey: publicKey || null, enabled: Boolean(publicKey) },
    });
  },

  async subscribePush(req, res) {
    try {
      const endpoint = String(req.body?.endpoint || '').trim();
      const p256dh = String(req.body?.keys?.p256dh || req.body?.p256dh || '').trim();
      const auth = String(req.body?.keys?.auth || req.body?.auth || '').trim();

      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({
          success: false,
          message: 'endpoint and keys.p256dh / keys.auth are required',
        });
      }

      // Push endpoints are always https URLs issued by the browser's push
      // service. Anything else is not a subscription we can send to.
      if (!/^https:\/\//i.test(endpoint) || endpoint.length > 500) {
        return res.status(400).json({ success: false, message: 'Invalid push endpoint' });
      }

      await notificationModel.upsertPushSubscription(req.user.id, {
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers['user-agent'] || null,
      });

      return res.status(201).json({ success: true, message: 'Push subscription saved' });
    } catch (error) {
      console.error('Failed to save push subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to save push subscription',
      });
    }
  },

  async unsubscribePush(req, res) {
    try {
      const endpoint = String(req.body?.endpoint || req.query?.endpoint || '').trim();
      if (!endpoint) {
        return res.status(400).json({ success: false, message: 'endpoint is required' });
      }

      await notificationModel.deletePushSubscription(req.user.id, endpoint);
      return res.status(200).json({ success: true, message: 'Push subscription removed' });
    } catch (error) {
      console.error('Failed to remove push subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove push subscription',
      });
    }
  },
};

export default notificationController;
