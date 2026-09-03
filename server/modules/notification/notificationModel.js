/**
 * Every SQL statement the notification system runs.
 *
 * Read methods take an optional `{ tx }` executor so they compose inside a
 * caller's transaction, matching the convention the finance and expenditure
 * models already use for their workflow-facing methods.
 */

import { randomUUID } from 'node:crypto';

import db from '../../config/connection.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const clampLimit = (value, fallback = 20, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

/** MySQL DATETIME in the connection's timezone, for `available_at` arithmetic. */
const secondsFromNow = (seconds) => new Date(Date.now() + seconds * 1000);

const notificationModel = {
  /* ================= OUTBOX ================= */

  /**
   * Writes one outbox row. Called inside the emitting module's transaction, so
   * it must stay a single cheap INSERT.
   *
   * A duplicate `dedupe_key` is not an error: it means this exact thing was
   * already recorded, and the correct response is to do nothing. Returns null
   * in that case so the caller can tell the difference.
   */
  async insertEvent(
    {
      eventType,
      actorUserId = null,
      moduleKey = null,
      recordId = null,
      payload = {},
      dedupeKey = null,
    },
    { tx = db } = {},
  ) {
    try {
      const [result] = await tx.query(
        `INSERT INTO notification_events
           (event_type, actor_user_id, module_key, record_id, payload, dedupe_key)
         VALUES (?, ?, ?, ?, CAST(? AS JSON), ?)`,
        [
          String(eventType),
          toPositiveInt(actorUserId),
          moduleKey ? String(moduleKey).toLowerCase() : null,
          toPositiveInt(recordId),
          JSON.stringify(payload ?? {}),
          dedupeKey ? String(dedupeKey).slice(0, 191) : null,
        ],
      );
      return result.insertId || null;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') return null;
      throw error;
    }
  },

  /**
   * Atomically claims a batch of due events for one dispatcher instance.
   *
   * The UPDATE ... LIMIT is the claim: MySQL applies it under a row lock, so
   * two dispatchers (or two iisnode workers) can never take the same row. Only
   * then are the claimed rows read back.
   *
   * The read-back finds rows by the value just written to `locked_by`, so that
   * value has to be unique per claim rather than per process. Sharing it — two
   * workers on the `lockedBy` default, or one worker's overlapping sweeps —
   * would have each SELECT return the other's rows: the same batch processed
   * twice while the other batch sat in `processing` until the reaper freed it.
   * Hence the random suffix, which the caller must carry into `renewClaim` and
   * the terminal writes as its lease token.
   *
   * @returns {Promise<{ token: string, events: object[] }>}
   */
  async claimPendingEvents({ limit = 25, lockedBy = 'dispatcher' } = {}) {
    const batchSize = clampLimit(limit, 25, 200);
    // Bounded to fit locked_by's 64 characters with the suffix attached.
    const token = `${String(lockedBy).slice(0, 40)}:${randomUUID().slice(0, 12)}`;

    const [result] = await db.query(
      `UPDATE notification_events
       SET status = 'processing', locked_by = ?, locked_at = NOW()
       WHERE status = 'pending' AND available_at <= NOW()
       ORDER BY id
       LIMIT ?`,
      [token, batchSize],
    );

    if (!result.affectedRows) return { token, events: [] };

    const [rows] = await db.query(
      `SELECT id, event_type, actor_user_id, module_key, record_id, payload, attempts
       FROM notification_events
       WHERE status = 'processing' AND locked_by = ?
       ORDER BY id
       LIMIT ?`,
      [token, batchSize],
    );

    return { token, events: rows };
  },

  /**
   * Returns rows abandoned mid-flight — a process killed between claiming and
   * finishing — to the pending pool. Without this a restart would strand them
   * in `processing` forever.
   *
   * A live-but-slow worker can be caught by this too, which is why the workers
   * restamp their lease per event (`renewClaim`) and fence their terminal
   * writes on `locked_by`: whoever picks the row up next owns it outright.
   */
  async releaseStaleClaims({ staleMinutes = 5, maxAttempts = 5 } = {}) {
    const minutes = Math.max(1, Number(staleMinutes) || 5);
    const attemptCeiling = Math.max(1, Number(maxAttempts) || 5);

    // A reap counts as an attempt. Without that an event that kills whatever
    // worker touches it — an audience big enough to exhaust memory, a payload
    // that hangs a channel — is reclaimed forever, taking a worker down with it
    // every time, because `attempts` only ever grows on a clean failure path.
    // Counting it puts a stranded event on the same ladder as a failing one.
    const [failed] = await db.query(
      `UPDATE notification_events
       SET status = 'failed',
           attempts = attempts + 1,
           locked_by = NULL,
           locked_at = NULL,
           last_error = CONCAT('Claim went stale after ', attempts + 1, ' attempt(s); giving up')
       WHERE status = 'processing'
         AND locked_at IS NOT NULL
         AND locked_at < (NOW() - INTERVAL ? MINUTE)
         AND attempts + 1 >= ?`,
      [minutes, attemptCeiling],
    );

    // The rest go back to the pool immediately: the stale threshold has already
    // served as the backoff, and the usual reason is a deploy or a crash that
    // the next sweep can simply redo.
    const [released] = await db.query(
      `UPDATE notification_events
       SET status = 'pending',
           attempts = attempts + 1,
           locked_by = NULL,
           locked_at = NULL,
           last_error = 'Claim went stale; returned to the pool'
       WHERE status = 'processing'
         AND locked_at IS NOT NULL
         AND locked_at < (NOW() - INTERVAL ? MINUTE)`,
      [minutes],
    );

    return { released: released.affectedRows || 0, failed: failed.affectedRows || 0 };
  },

  /**
   * Extends this instance's lease on a claimed event.
   *
   * Called before each event is processed so the stale threshold measures how
   * long one event has been in flight, not how long the whole batch has taken.
   * Returns false when the lease is gone — the reaper handed the event to
   * someone else — which is the caller's signal to leave it alone.
   */
  async renewClaim(eventId, { lockedBy } = {}) {
    const id = toPositiveInt(eventId);
    if (!id || !lockedBy) return false;

    const [result] = await db.query(
      `UPDATE notification_events
       SET locked_at = NOW()
       WHERE id = ? AND status = 'processing' AND locked_by = ?`,
      [id, String(lockedBy).slice(0, 64)],
    );
    return (result.affectedRows || 0) > 0;
  },

  /**
   * Terminal transitions are fenced on `locked_by`: a worker whose lease the
   * reaper revoked must not overwrite the state of whoever holds it now. All
   * three return false when the write did not apply.
   */
  async markEventDone(eventId, { lockedBy = null } = {}) {
    const [result] = await db.query(
      `UPDATE notification_events
       SET status = 'done', locked_by = NULL, locked_at = NULL, last_error = NULL
       WHERE id = ?${lockedBy ? ' AND locked_by = ?' : ''}`,
      lockedBy ? [toPositiveInt(eventId), String(lockedBy).slice(0, 64)] : [toPositiveInt(eventId)],
    );
    return (result.affectedRows || 0) > 0;
  },

  async markEventForRetry(eventId, { error = '', delaySeconds = 60, lockedBy = null } = {}) {
    const [result] = await db.query(
      `UPDATE notification_events
       SET status = 'pending',
           attempts = attempts + 1,
           available_at = ?,
           locked_by = NULL,
           locked_at = NULL,
           last_error = ?
       WHERE id = ?${lockedBy ? ' AND locked_by = ?' : ''}`,
      [
        secondsFromNow(delaySeconds),
        String(error).slice(0, 2000),
        toPositiveInt(eventId),
        ...(lockedBy ? [String(lockedBy).slice(0, 64)] : []),
      ],
    );
    return (result.affectedRows || 0) > 0;
  },

  async markEventFailed(eventId, { error = '', lockedBy = null } = {}) {
    const [result] = await db.query(
      `UPDATE notification_events
       SET status = 'failed',
           attempts = attempts + 1,
           locked_by = NULL,
           locked_at = NULL,
           last_error = ?
       WHERE id = ?${lockedBy ? ' AND locked_by = ?' : ''}`,
      [
        String(error).slice(0, 2000),
        toPositiveInt(eventId),
        ...(lockedBy ? [String(lockedBy).slice(0, 64)] : []),
      ],
    );
    return (result.affectedRows || 0) > 0;
  },

  /* ================= FAN-OUT ================= */

  /**
   * Writes one row per recipient.
   *
   * INSERT IGNORE plus the (event_id, user_id) unique key is what makes a
   * retried event safe: rows already written are skipped rather than
   * duplicated. The follow-up SELECT then returns the full set — new and
   * pre-existing — so deliveries are completed for a partially-processed event.
   */
  async insertNotifications(eventId, rows = []) {
    const normalizedEventId = toPositiveInt(eventId);
    if (!normalizedEventId || !rows.length) return [];

    const values = rows.map((row) => [
      normalizedEventId,
      toPositiveInt(row.userId),
      String(row.eventType),
      String(row.category || 'general'),
      String(row.severity || 'info'),
      String(row.title).slice(0, 255),
      row.body ?? null,
      row.link ?? null,
      String(row.recipientRole || 'recipient').slice(0, 32),
    ]);

    await db.query(
      `INSERT IGNORE INTO notifications
         (event_id, user_id, event_type, category, severity, title, body, link, recipient_role)
       VALUES ?`,
      [values],
    );

    const [inserted] = await db.query(
      `SELECT id, user_id, event_type, category, severity, title, body, link, recipient_role
       FROM notifications
       WHERE event_id = ?`,
      [normalizedEventId],
    );

    return inserted;
  },

  /** Creates the per-channel delivery rows for a batch of notifications. */
  async insertDeliveries(rows = []) {
    if (!rows.length) return;

    const values = rows.map((row) => [
      toPositiveInt(row.notificationId),
      String(row.channel).slice(0, 32),
      String(row.status || 'pending'),
      row.status === 'sent' ? new Date() : null,
    ]);

    await db.query(
      `INSERT INTO notification_deliveries (notification_id, channel, status, sent_at)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         status = IF(notification_deliveries.status = 'sent', 'sent', VALUES(status)),
         sent_at = COALESCE(notification_deliveries.sent_at, VALUES(sent_at))`,
      [values],
    );
  },

  /**
   * The deliveries still owed for one event, joined to what the channel needs
   * to actually send. Only 'pending' rows come back, so a retried event never
   * re-sends a push that already went out.
   */
  async listPendingDeliveries(eventId) {
    const normalizedEventId = toPositiveInt(eventId);
    if (!normalizedEventId) return [];

    const [rows] = await db.query(
      `SELECT d.notification_id, d.channel,
              n.user_id, n.event_type, n.category, n.severity, n.title, n.body, n.link
       FROM notification_deliveries d
       JOIN notifications n ON n.id = d.notification_id
       WHERE n.event_id = ? AND d.status = 'pending'`,
      [normalizedEventId],
    );

    return rows;
  },

  /**
   * Records the outcome of one delivery attempt.
   *
   * A row already 'sent' is left alone. The dispatcher only ever marks rows
   * `listPendingDeliveries` handed it, so in normal operation the guard never
   * bites; it is there for the one case that would be expensive to get wrong —
   * a worker whose lease lapsed writing 'failed' over a send that succeeded,
   * which would put the row back in the pending set and push the recipient a
   * second time. "Sent once" then holds on the row itself rather than on the
   * lease still being valid.
   */
  async markDelivery(notificationId, channel, { status, error = null } = {}) {
    await db.query(
      `UPDATE notification_deliveries
       SET status = ?,
           attempts = attempts + 1,
           last_error = ?,
           sent_at = IF(? = 'sent', NOW(), sent_at)
       WHERE notification_id = ? AND channel = ? AND status <> 'sent'`,
      [
        status,
        error ? String(error).slice(0, 2000) : null,
        status,
        toPositiveInt(notificationId),
        String(channel),
      ],
    );
  },

  /* ================= DISPLAY NAMES ================= */

  /**
   * Names for a handful of user ids, used by the dispatcher to fill in
   * `actorName` / `applicantName` when the emitter did not supply them.
   *
   * Deliberately resolved here rather than at emit time: emit runs inside the
   * caller's approval transaction, and it should not pay for a join just to
   * make a sentence read better. By dispatch time we are outside that
   * transaction and one small query serves the whole batch.
   */
  async getUserNames(userIds = []) {
    const ids = [...new Set(userIds.map(toPositiveInt).filter(Boolean))];
    if (!ids.length) return new Map();

    const [rows] = await db.query(`SELECT id, name, email FROM users WHERE id IN (?)`, [ids]);

    return new Map(rows.map((row) => [row.id, row.name || row.email || null]));
  },

  /* ================= READING (per user) ================= */

  /**
   * The bell's poll target. Deliberately two aggregates on one indexed scan —
   * this runs once per user every 45 seconds, so it must stay cheap.
   */
  async getSummary(userId) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return { unreadCount: 0, latestId: 0 };

    const [rows] = await db.query(
      `SELECT
         COALESCE(SUM(is_read = 0), 0) AS unread_count,
         COALESCE(MAX(id), 0) AS latest_id
       FROM notifications
       WHERE user_id = ? AND archived_at IS NULL`,
      [normalizedUserId],
    );

    return {
      unreadCount: Number(rows[0]?.unread_count || 0),
      latestId: Number(rows[0]?.latest_id || 0),
    };
  },

  /**
   * Keyset pagination on the primary key: ids are monotonic, so `id < cursor`
   * is stable even while new notifications arrive mid-scroll, which an OFFSET
   * would not be.
   */
  async listForUser(userId, { filter = 'all', category = null, limit = 20, cursor = null } = {}) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return { items: [], nextCursor: null };

    const pageSize = clampLimit(limit, 20, 100);
    const where = ['user_id = ?', 'archived_at IS NULL'];
    const params = [normalizedUserId];

    if (filter === 'unread') where.push('is_read = 0');

    if (category) {
      where.push('category = ?');
      params.push(String(category));
    }

    const cursorId = toPositiveInt(cursor);
    if (cursorId) {
      where.push('id < ?');
      params.push(cursorId);
    }

    // One extra row tells us whether another page exists without a COUNT.
    params.push(pageSize + 1);

    const [rows] = await db.query(
      `SELECT id, event_type, category, severity, title, body, link,
              recipient_role, is_read, read_at, created_at
       FROM notifications
       WHERE ${where.join(' AND ')}
       ORDER BY id DESC
       LIMIT ?`,
      params,
    );

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  },

  /**
   * Scoped by user_id as well as id, so a caller cannot mark someone else's
   * notification read by guessing an id. Returns false when nothing matched.
   */
  async markRead(userId, notificationId) {
    const normalizedUserId = toPositiveInt(userId);
    const normalizedId = toPositiveInt(notificationId);
    if (!normalizedUserId || !normalizedId) return false;

    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE id = ? AND user_id = ?`,
      [normalizedId, normalizedUserId],
    );

    return result.affectedRows > 0;
  },

  async markAllRead(userId, { category = null } = {}) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return 0;

    const where = ['user_id = ?', 'is_read = 0', 'archived_at IS NULL'];
    const params = [normalizedUserId];

    if (category) {
      where.push('category = ?');
      params.push(String(category));
    }

    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE ${where.join(' AND ')}`,
      params,
    );

    return result.affectedRows || 0;
  },

  async archive(userId, notificationId) {
    const normalizedUserId = toPositiveInt(userId);
    const normalizedId = toPositiveInt(notificationId);
    if (!normalizedUserId || !normalizedId) return false;

    const [result] = await db.query(
      `UPDATE notifications
       SET archived_at = COALESCE(archived_at, NOW()),
           is_read = 1,
           read_at = COALESCE(read_at, NOW())
       WHERE id = ? AND user_id = ?`,
      [normalizedId, normalizedUserId],
    );

    return result.affectedRows > 0;
  },

  /* ================= PREFERENCES ================= */

  async getPreferences(userId) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return [];

    const [rows] = await db.query(
      `SELECT event_type, category, channel, is_enabled
       FROM notification_preferences
       WHERE user_id = ?`,
      [normalizedUserId],
    );

    return rows;
  },

  /**
   * Preferences for a whole batch of recipients at once. The dispatcher needs
   * them per event, and one query beats N.
   */
  async getPreferencesForUsers(userIds = []) {
    const ids = userIds.map(toPositiveInt).filter(Boolean);
    if (!ids.length) return [];

    const [rows] = await db.query(
      `SELECT user_id, event_type, category, channel, is_enabled
       FROM notification_preferences
       WHERE user_id IN (?)`,
      [ids],
    );

    return rows;
  },

  /**
   * `category` is stored only on a wildcard row, where it is what scopes the
   * row to a category. An exact row is looked up by (user_id, event_type,
   * channel) alone — every reader ignores its category — but the table's unique
   * key includes the column, so stamping the catalog's current category onto an
   * exact row makes that key drift the moment a type is recategorised: the
   * upsert misses the existing row, a second one appears for the same switch,
   * and which of the two the resolver honours is arbitrary. Exact rows
   * therefore carry the empty category, which keeps the unique key and the
   * lookup key the same thing.
   */
  async upsertPreferences(userId, rows = []) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId || !rows.length) return 0;

    const values = rows.map((row) => {
      const eventType = String(row.eventType).slice(0, 100);

      return [
        normalizedUserId,
        eventType,
        eventType === '*' ? String(row.category || 'general').slice(0, 50) : '',
        String(row.channel).slice(0, 32),
        row.isEnabled ? 1 : 0,
      ];
    });

    const [result] = await db.query(
      `INSERT INTO notification_preferences (user_id, event_type, category, channel, is_enabled)
       VALUES ?
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
      [values],
    );

    return result.affectedRows || 0;
  },

  /* ================= PUSH SUBSCRIPTIONS ================= */

  async listPushSubscriptions(userId) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return [];

    const [rows] = await db.query(
      `SELECT id, endpoint, p256dh, auth, user_agent, created_at
       FROM push_subscriptions
       WHERE user_id = ? AND disabled_at IS NULL`,
      [normalizedUserId],
    );

    return rows;
  },

  /**
   * The endpoint is the subscription's identity, so re-subscribing the same
   * browser updates the existing row — including re-enabling one previously
   * marked dead — rather than accumulating duplicates.
   */
  async upsertPushSubscription(userId, { endpoint, p256dh, auth, userAgent = null }) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId) return false;

    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         p256dh = VALUES(p256dh),
         auth = VALUES(auth),
         user_agent = VALUES(user_agent),
         last_seen_at = NOW(),
         disabled_at = NULL`,
      [
        normalizedUserId,
        String(endpoint).slice(0, 500),
        String(p256dh).slice(0, 255),
        String(auth).slice(0, 255),
        userAgent ? String(userAgent).slice(0, 255) : null,
      ],
    );

    return true;
  },

  async deletePushSubscription(userId, endpoint) {
    const normalizedUserId = toPositiveInt(userId);
    if (!normalizedUserId || !endpoint) return false;

    const [result] = await db.query(
      `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
      [normalizedUserId, String(endpoint).slice(0, 500)],
    );

    return result.affectedRows > 0;
  },

  /** Called when a push service reports the endpoint no longer exists. */
  async disablePushSubscription(endpoint) {
    if (!endpoint) return;
    await db.query(`UPDATE push_subscriptions SET disabled_at = NOW() WHERE endpoint = ?`, [
      String(endpoint).slice(0, 500),
    ]);
  },

  /* ================= RETENTION ================= */

  async purgeOldNotifications({ readOlderThanDays = 90 } = {}) {
    const [result] = await db.query(
      `UPDATE notifications
       SET archived_at = NOW()
       WHERE archived_at IS NULL
         AND is_read = 1
         AND created_at < (NOW() - INTERVAL ? DAY)`,
      [Math.max(1, Number(readOlderThanDays) || 90)],
    );
    return result.affectedRows || 0;
  },

  /**
   * Deletes finished outbox events, whose `notifications` rows follow by
   * ON DELETE CASCADE.
   *
   * An event still holding an unread notification is left alone however old it
   * is: the retention rule is that nobody loses a notification they never
   * acknowledged, and the cascade would delete it out from under them.
   */
  async purgeOldEvents({ olderThanDays = 180 } = {}) {
    const [result] = await db.query(
      `DELETE FROM notification_events
       WHERE status IN ('done', 'failed')
         AND created_at < (NOW() - INTERVAL ? DAY)
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.event_id = notification_events.id AND n.is_read = 0
         )`,
      [Math.max(1, Number(olderThanDays) || 180)],
    );
    return result.affectedRows || 0;
  },
};

export default notificationModel;
