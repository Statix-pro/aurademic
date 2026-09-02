/* ============================================================
   20260902_create_notification_system.sql

   PURPOSE
     Introduces the portal-wide notification system. Until now
     nothing in the product told anyone that anything happened:
     approvers found work only by opening a queue page, and an
     applicant learned of a rejection only by reopening the record.

   THE FIVE TABLES

     notification_events      The transactional outbox. One row per
                              thing that happened, written inside the
                              business transaction that caused it.
     notifications            The fan-out. One row per recipient, with
                              the title/body/link rendered and frozen
                              at dispatch time.
     notification_deliveries  One row per (notification, channel)
                              attempt, so a failed web push can be
                              retried and diagnosed.
     notification_preferences Per-user, per-type, per-channel opt-out.
                              An absent row means "use the catalog
                              default", so a new user needs no seeding.
     push_subscriptions       Web Push endpoints, one per browser.

   WHY AN OUTBOX RATHER THAN NOTIFYING INLINE
     Stage transitions run inside a transaction that also consumes
     budget. If fan-out ran inline, a recipient-resolution bug would
     roll back a legitimate approval, and outbound push I/O would sit
     inside an open transaction holding row locks. Instead the emit is
     a single INSERT that commits atomically with the business change,
     and a dispatcher does the expensive work afterwards with retry.
     A rolled-back approval therefore also rolls back its notification,
     which is the behaviour we want and cannot get any other way.

   WHY THE RENDERED TEXT IS STORED
     Rendering at read time would let a record renamed next month
     silently rewrite the wording of last month's notification. The
     text is a historical record, so it is frozen when written.

   SAFETY
     All five tables are new. Nothing existing is altered or dropped.
     Idempotent, and safe to run more than once: the tables are
     CREATE TABLE IF NOT EXISTS, the workflow_stage_policies seed is
     ON DUPLICATE KEY UPDATE, and the preference normalisation in 4.2
     finds nothing left to do on a second run.
   ============================================================ */

/* ============================================================
   1. THE OUTBOX
   ============================================================ */

/* 1.1 One row per domain occurrence. `payload` carries the audience
   descriptors and the template variables, so the dispatcher needs no
   further knowledge of the emitting module.

   `dedupe_key` is a nullable UNIQUE: a caller that can be retried
   (a double-submitted approval, say) passes a stable key and the
   second INSERT is rejected rather than producing a second round of
   notifications. Callers with nothing meaningful to key on pass NULL,
   and MySQL permits any number of NULLs in a unique index. */
CREATE TABLE IF NOT EXISTS notification_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(100) NOT NULL COMMENT 'Key into the code-side notification catalog, e.g. finance.stage_advanced',
  actor_user_id INT DEFAULT NULL COMMENT 'Who caused it; excluded from the recipients so nobody is told about their own action',
  module_key VARCHAR(64) DEFAULT NULL COMMENT 'Owning domain, e.g. finance / budget / journal',
  record_id BIGINT DEFAULT NULL COMMENT 'Primary key of the record within that domain',
  payload JSON NOT NULL COMMENT '{ subject, audience[], data } — everything the dispatcher needs',
  dedupe_key VARCHAR(191) DEFAULT NULL COMMENT 'Optional idempotency key; NULL means "no deduplication"',
  status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Not claimed before this; pushed forward on each retry',
  locked_by VARCHAR(64) DEFAULT NULL COMMENT 'Dispatcher instance id holding the claim',
  locked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When the claim was taken; a reaper releases stale ones',
  last_error TEXT COMMENT 'Most recent failure, for diagnosis',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_events_dedupe (dedupe_key),
  KEY idx_notification_events_claim (status, available_at, id),
  KEY idx_notification_events_record (module_key, record_id, created_at),
  KEY idx_notification_events_actor (actor_user_id),
  CONSTRAINT fk_notification_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. THE FAN-OUT
   ============================================================ */

/* 2.1 One row per recipient per event.

   uq_notifications_event_user is what makes redelivery safe: the
   dispatcher fans out with INSERT IGNORE, so an event reprocessed
   after a crash or a partial failure cannot notify anyone twice. */
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  user_id INT NOT NULL COMMENT 'Recipient',
  event_type VARCHAR(100) NOT NULL COMMENT 'Denormalised from the event so the inbox can filter without a join',
  category VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Coarse grouping used by the inbox filter, e.g. finance',
  severity ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL COMMENT 'Rendered at dispatch and never re-rendered',
  body TEXT COMMENT 'Rendered at dispatch and never re-rendered',
  link VARCHAR(500) DEFAULT NULL COMMENT 'Client-relative deep link, validated against a route whitelist before storage',
  recipient_role VARCHAR(32) NOT NULL DEFAULT 'recipient' COMMENT 'Why this person is being told: applicant / approver / admin / subject',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  archived_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Dismissed by the user; hidden from the bell but kept for audit',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_event_user (event_id, user_id),
  KEY idx_notifications_user_unread (user_id, is_read, archived_at, created_at),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_category (user_id, category, created_at),
  CONSTRAINT fk_notifications_event
    FOREIGN KEY (event_id) REFERENCES notification_events (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. PER-CHANNEL DELIVERY LOG
   ============================================================ */

/* 3.1 The in-app channel is satisfied the moment the notifications row
   exists, so its delivery row is written straight to 'sent'. Web push
   is real network I/O and needs the attempt count and error text. */
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  notification_id BIGINT NOT NULL,
  channel VARCHAR(32) NOT NULL COMMENT 'in_app / web_push / (email, later)',
  status ENUM('pending','sent','skipped','failed') NOT NULL DEFAULT 'pending'
    COMMENT 'skipped = the user preference or the channel config turned it off',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_deliveries_channel (notification_id, channel),
  KEY idx_notification_deliveries_status (status, channel),
  CONSTRAINT fk_notification_deliveries_notification
    FOREIGN KEY (notification_id) REFERENCES notifications (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. USER PREFERENCES
   ============================================================ */

/* 4.1 Sparse by design — a row exists only where a user has overridden
   the catalog default, so this table stays small and a brand-new user
   needs no seeding at all.

   event_type accepts the wildcard '*' to mute an entire category in one
   row; the resolver checks the exact type first and falls back to the
   wildcard, then to the catalog default. */
CREATE TABLE IF NOT EXISTS notification_preferences (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_type VARCHAR(100) NOT NULL COMMENT 'Exact catalog key, or * to cover every type in the category',
  category VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Scopes a wildcard row; empty on an exact row, which is looked up by event_type alone',
  channel VARCHAR(32) NOT NULL COMMENT 'in_app / web_push',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_preferences (user_id, event_type, category, channel),
  KEY idx_notification_preferences_user (user_id),
  CONSTRAINT fk_notification_preferences_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.2 `category` belongs to a wildcard row and nothing else: it is what scopes
   '*' to one category. An exact row is matched on (user_id, event_type,
   channel) by every reader, but the unique key above includes `category`, so an
   exact row stamped with the catalog's category of the day starts drifting the
   moment that type is recategorised — the upsert misses, a second row appears
   for the same switch, and which one the resolver honours is arbitrary. Exact
   rows carry the empty category so the unique key and the lookup key are the
   same thing (see notificationModel.upsertPreferences).

   Collapse anything written before that rule existed, newest save winning, then
   clear the column. Idempotent: a second run finds no duplicates and no
   non-empty categories left to clear. */
DELETE p FROM notification_preferences p
JOIN (
  SELECT user_id, event_type, channel, MAX(id) AS keep_id
  FROM notification_preferences
  WHERE event_type <> '*'
  GROUP BY user_id, event_type, channel
) newest
  ON newest.user_id = p.user_id
  AND newest.event_type = p.event_type
  AND newest.channel = p.channel
WHERE p.event_type <> '*'
  AND p.id <> newest.keep_id;

UPDATE notification_preferences SET category = '' WHERE event_type <> '*' AND category <> '';

/* ============================================================
   5. WEB PUSH SUBSCRIPTIONS
   ============================================================ */

/* 5.1 One row per browser that opted in. `endpoint` is globally unique
   and is the identity of the subscription, so re-subscribing the same
   browser updates rather than duplicates.

   `disabled_at` is set when the push service answers 404/410 (the user
   cleared site data, or uninstalled). Keeping the row rather than
   deleting it means a later re-subscribe reuses the same id, and the
   purge script clears them out on its own schedule. */
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL COMMENT 'Push service URL; the identity of this subscription',
  p256dh VARCHAR(255) NOT NULL COMMENT 'Client public key from the Push API subscription',
  auth VARCHAR(255) NOT NULL COMMENT 'Client auth secret from the Push API subscription',
  user_agent VARCHAR(255) DEFAULT NULL COMMENT 'For the user to recognise the device in settings',
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  disabled_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Set when the push service reports the endpoint is gone',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
  KEY idx_push_subscriptions_user (user_id, disabled_at),
  CONSTRAINT fk_push_subscriptions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   6. STAGE POLICIES FOR BUDGET

   WHY THIS BELONGS IN THIS MIGRATION
     Budget runs on its own older approval engine and has never consulted
     `workflow_stage_policies`, so the table has rows for finance and
     expenditure only. Notification recipients are resolved from that table,
     which means without these rows a single department's budget proposal
     would resolve to EVERY level-1 approver in the institution.

     These rows mirror the finance ones exactly. Nothing reads them today
     except recipient resolution — budget's own engine still decides
     authorization from `WORKFLOW_STAGE_PERMISSION` — so adding them changes
     no existing behaviour, and it puts the scoping under the same
     admin-editable control as every other module.

   Idempotent: uq_workflow_stage_policy is (module_key, stage_key), so a
   re-run updates in place rather than duplicating.
   ============================================================ */

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  ('budget', 'level1', 'department',
   CAST('{"requireAssignment": false, "assignmentRoleCodes": ["hod", "coordinator", "entity_approver"]}' AS JSON), 1),
  ('budget', 'ithead', 'global', NULL, 1),
  ('budget', 'dof', 'global', NULL, 1),
  ('budget', 'principal', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active);

/* ============================================================
   ROLLBACK (keep commented)
   ============================================================

   DROP TABLE IF EXISTS push_subscriptions;
   DROP TABLE IF EXISTS notification_preferences;
   DROP TABLE IF EXISTS notification_deliveries;
   DROP TABLE IF EXISTS notifications;
   DROP TABLE IF EXISTS notification_events;

   ============================================================ */
