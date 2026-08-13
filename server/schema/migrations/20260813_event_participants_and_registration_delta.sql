-- =====================================================================
-- Event Module Delta — Public Participants, Teams, Accommodation Pricing
-- =====================================================================
-- Runs AFTER events_final.sql. Idempotent and self-healing: safe to re-run,
-- and safe on a database that already ran an earlier events_final.sql.
--
-- WHY THIS EXISTS
-- events_final.sql models a participant as `event_registrations.user_id ->
-- users(id)`. The participant-facing event site (event-client/) authenticates
-- the general public via Gmail, so that FK would put untrusted public rows in
-- the same table that drives staff RBAC: findOrCreateUser() inserts them and
-- ensureUserHasBaseRole() grants the base `user` role, which is enough to reach
-- every authMiddleware-only staff endpoint.
--
-- Of the 84 FKs to `users` in events_final.sql, 82 are staff audit columns
-- (created_by/updated_by/deleted_by) and one is verified_by. Exactly ONE is the
-- participant. event_certificates and event_feedbacks reach the participant via
-- registration_id, not user_id. So public identity moves to its own table by
-- changing a single FK, and staff auditing is untouched.
--
-- This makes participant/staff separation structural rather than something every
-- future query has to remember.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. SCHEMA EVOLUTION HELPERS
-- ---------------------------------------------------------------------

DELIMITER //

DROP PROCEDURE IF EXISTS `sp_evt_add_column_if_not_exists`//
CREATE PROCEDURE `sp_evt_add_column_if_not_exists`(
    IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND column_name = p_column) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_evt_drop_column_if_exists`//
CREATE PROCEDURE `sp_evt_drop_column_if_exists`(
    IN p_table VARCHAR(64), IN p_column VARCHAR(64)
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND column_name = p_column) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` DROP COLUMN `', p_column, '`');
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_evt_drop_fk_if_exists`//
CREATE PROCEDURE `sp_evt_drop_fk_if_exists`(
    IN p_table VARCHAR(64), IN p_constraint VARCHAR(64)
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND constraint_name = p_constraint
                 AND constraint_type = 'FOREIGN KEY') THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` DROP FOREIGN KEY `', p_constraint, '`');
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_evt_drop_index_if_exists`//
CREATE PROCEDURE `sp_evt_drop_index_if_exists`(
    IN p_table VARCHAR(64), IN p_index VARCHAR(64)
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND index_name = p_index) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` DROP INDEX `', p_index, '`');
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_evt_add_index_if_not_exists`//
CREATE PROCEDURE `sp_evt_add_index_if_not_exists`(
    IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.statistics
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND index_name = p_index) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_evt_add_constraint_if_not_exists`//
CREATE PROCEDURE `sp_evt_add_constraint_if_not_exists`(
    IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND constraint_name = p_constraint) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_definition);
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

-- Adds a FK only when the referenced table exists. Lets this migration run
-- standalone today and pick up the constraint once the dependency lands
-- (see section 8: resource_persons ships in a separate module).
DROP PROCEDURE IF EXISTS `sp_evt_add_fk_if_target_exists`//
CREATE PROCEDURE `sp_evt_add_fk_if_target_exists`(
    IN p_table VARCHAR(64), IN p_constraint VARCHAR(64),
    IN p_target VARCHAR(64), IN p_definition TEXT
)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_target)
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE table_schema = DATABASE() AND table_name = p_table
                 AND constraint_name = p_constraint) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_definition);
        PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;


-- ---------------------------------------------------------------------
-- 1. PUBLIC PARTICIPANT IDENTITY
-- ---------------------------------------------------------------------
-- Deliberately NOT in `users`. No roles, no permissions, no employee linkage.
-- A staff member who registers for an event gets a row here too; the two
-- identities stay unlinked (agreed: no linking).

CREATE TABLE IF NOT EXISTS `event_participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `picture` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_sub` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL
      COMMENT 'Google OAuth subject claim: the stable participant identifier',
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0
      COMMENT 'Set by an admin to bar a participant from registering further',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_participants_email` (`email`),
  UNIQUE KEY `uq_participants_google_sub` (`google_sub`),
  KEY `idx_participants_active_deleted` (`is_active`, `is_deleted`),
  KEY `idx_participants_blocked` (`is_blocked`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profile captured by the event site's ProfilePage.
--
-- Universal personal fields are real columns. Profession fields are
-- profession-type-conditional (a school student has classGrade/parentGuardian, a
-- faculty member has designation/qualification, industry has organization) —
-- roughly 35 sparse fields across 11 profession types. Those live in
-- `profession_details` JSON so a new profession type never needs an ALTER TABLE.
-- This follows the pattern already established by `events.workflow_state`.
--
-- The handful of profession fields an admin list filters or reports on are
-- promoted to real columns so they stay indexable.
CREATE TABLE IF NOT EXISTS `event_participant_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `participant_id` int NOT NULL,

  -- Personal (universal)
  `title` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gender` enum('Male','Female','Other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `differently_abled` tinyint(1) NOT NULL DEFAULT 0,
  `date_of_birth` date DEFAULT NULL COMMENT 'Age is derived, never stored',
  `mobile_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
      COMMENT 'Correspondence address; may differ from the sign-in email',
  `address` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pin` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photo_path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL
      COMMENT 'Multer path under server/uploads/. Never a base64 data URL',

  -- Profession (promoted: needed by admin lists, filters and fee resolution)
  `participant_type_id` int DEFAULT NULL COMMENT 'Drives which event_registration_fees row applies',
  `profession_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `register_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institution` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `id_card_path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  -- Everything else, keyed by the frontend's ProfessionDetails field names
  `profession_details` json DEFAULT NULL,

  `personal_completed_at` timestamp NULL DEFAULT NULL,
  `profession_completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_profile_participant` (`participant_id`),
  KEY `fk_profile_participant_type` (`participant_type_id`),
  KEY `idx_profile_institution` (`institution`),
  KEY `idx_profile_profession_type` (`profession_type`),
  CONSTRAINT `fk_profile_participant` FOREIGN KEY (`participant_id`)
      REFERENCES `event_participants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_profile_participant_type` FOREIGN KEY (`participant_type_id`)
      REFERENCES `m_participant_type` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 2. REPOINT event_registrations AT PARTICIPANTS
-- ---------------------------------------------------------------------
-- The events module is not deployed to production (the 2026-08-12 dump contains
-- no events tables), so this is a pre-release correction, not a data migration.
-- Guard first: refuse to run rather than silently discard registrations, because
-- an existing user_id cannot be mapped to a participant that does not exist yet.

SET @evt_reg_rows = (
  SELECT IFNULL((SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'event_registrations'), 0)
);

DELIMITER //
DROP PROCEDURE IF EXISTS `sp_evt_guard_registrations_empty`//
CREATE PROCEDURE `sp_evt_guard_registrations_empty`()
BEGIN
    DECLARE v_rows INT DEFAULT 0;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = DATABASE() AND table_name = 'event_registrations'
                 AND column_name = 'user_id') THEN
        SET @c = 'SELECT COUNT(*) INTO @evt_existing FROM `event_registrations`';
        PREPARE stmt FROM @c; EXECUTE stmt; DEALLOCATE PREPARE stmt;
        SET v_rows = IFNULL(@evt_existing, 0);
        IF v_rows > 0 THEN
            -- MESSAGE_TEXT is capped at 128 characters by MySQL; keep it terse.
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT =
              'Aborted: event_registrations has user_id rows. Map them to event_participants.participant_id, then re-run.';
        END IF;
    END IF;
END//
DELIMITER ;

CALL sp_evt_guard_registrations_empty();

CALL sp_evt_add_column_if_not_exists('event_registrations', 'participant_id',
  'INT NOT NULL COMMENT ''FK event_participants(id) — the public registrant'' AFTER `event_id`');

-- Retire the users-based participant link
CALL sp_evt_drop_fk_if_exists('event_registrations', 'fk_reg_user');
CALL sp_evt_drop_index_if_exists('event_registrations', 'uq_event_user');
CALL sp_evt_drop_index_if_exists('event_registrations', 'fk_reg_user');
CALL sp_evt_drop_index_if_exists('event_registrations', 'idx_reg_user_status');
CALL sp_evt_drop_column_if_exists('event_registrations', 'user_id');

CALL sp_evt_add_index_if_not_exists('event_registrations', 'uq_event_participant',
  'UNIQUE KEY `uq_event_participant` (`event_id`, `participant_id`)');
CALL sp_evt_add_index_if_not_exists('event_registrations', 'idx_reg_participant_status',
  'INDEX `idx_reg_participant_status` (`participant_id`, `registration_status`)');
CALL sp_evt_add_fk_if_target_exists('event_registrations', 'fk_reg_participant', 'event_participants',
  'FOREIGN KEY (`participant_id`) REFERENCES `event_participants` (`id`)');

-- Shortlisting outcome is a different axis from the form lifecycle, and the event
-- site renders both (formStatus vs reviewStatus). Keep them as separate columns
-- instead of overloading registration_status.
CALL sp_evt_add_column_if_not_exists('event_registrations', 'review_status',
  'VARCHAR(30) NOT NULL DEFAULT ''Pending'' COMMENT ''Pending|Shortlisted|Selected|Rejected''');
CALL sp_evt_add_index_if_not_exists('event_registrations', 'idx_reg_review_status',
  'INDEX `idx_reg_review_status` (`review_status`)');

-- Pin the status vocabularies. These were free varchars, so the API and UI had
-- no agreed set of values.
CALL sp_evt_add_constraint_if_not_exists('event_registrations', 'chk_reg_status_values',
  'CHECK (`registration_status` IN (''Pending'',''Submitted'',''Registered'',''Cancelled''))');
CALL sp_evt_add_constraint_if_not_exists('event_registrations', 'chk_reg_review_values',
  'CHECK (`review_status` IN (''Pending'',''Shortlisted'',''Selected'',''Rejected''))');


-- ---------------------------------------------------------------------
-- 3. TEAM MEMBERS
-- ---------------------------------------------------------------------
-- event_registration_settings has team_enabled / minimum_team_size /
-- maximum_team_size and event_registration_fees has team_fee / member_fee /
-- additional_member_fee, but nothing stored the members themselves.

CREATE TABLE IF NOT EXISTS `event_registration_team_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `member_order` int NOT NULL DEFAULT 1 COMMENT '1 = team lead',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant_id` int DEFAULT NULL
      COMMENT 'Set when this member also holds a participant account. Nullable: members are invited by email and may never sign in',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_team_member_email` (`registration_id`, `email`),
  UNIQUE KEY `uq_team_member_order` (`registration_id`, `member_order`),
  KEY `fk_team_member_participant` (`participant_id`),
  KEY `idx_team_member_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_team_member_registration` FOREIGN KEY (`registration_id`)
      REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_member_participant` FOREIGN KEY (`participant_id`)
      REFERENCES `event_participants` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_team_member_created_by` FOREIGN KEY (`created_by`)
      REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_team_member_updated_by` FOREIGN KEY (`updated_by`)
      REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_team_member_order` CHECK (`member_order` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 4. ACCOMMODATION PRICING
-- ---------------------------------------------------------------------
-- event_accommodation carries a single flat fee_amount, which cannot express
-- "AC room costs more than a dormitory" — an ordinary requirement, and what the
-- event site already offers. Room types become per-event admin-configured data
-- rather than the hardcoded price list currently in the frontend.
--
-- There is no existing guest-house schema to reuse (GuestHouseBooking.tsx is
-- frontend-only), so pricing lives here. event_registration_accommodation
-- .room_allocation_id remains the hook for a future allocation module.

CREATE TABLE IF NOT EXISTS `event_accommodation_room_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `room_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_per_night` decimal(10,2) NOT NULL DEFAULT '0.00',
  `max_occupants` int NOT NULL DEFAULT 1,
  `total_rooms` int DEFAULT NULL COMMENT 'NULL = unlimited',
  `display_order` int NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_room_type_event` (`event_id`, `room_type`),
  KEY `idx_room_type_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_room_type_event` FOREIGN KEY (`event_id`)
      REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_room_type_created_by` FOREIGN KEY (`created_by`)
      REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_room_type_updated_by` FOREIGN KEY (`updated_by`)
      REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_room_type_amounts` CHECK (
    `price_per_night` >= 0 AND `max_occupants` >= 1 AND (`total_rooms` IS NULL OR `total_rooms` >= 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stay dates on the participant's accommodation request. nights is derived so it
-- can never disagree with the dates it is computed from.
CALL sp_evt_add_column_if_not_exists('event_registration_accommodation', 'check_in_date',
  'DATE DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('event_registration_accommodation', 'check_out_date',
  'DATE DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('event_registration_accommodation', 'nights',
  'INT GENERATED ALWAYS AS (CASE WHEN `check_in_date` IS NULL OR `check_out_date` IS NULL THEN NULL ELSE GREATEST(DATEDIFF(`check_out_date`, `check_in_date`), 0) END) STORED');
CALL sp_evt_add_column_if_not_exists('event_registration_accommodation', 'total_amount',
  'DECIMAL(10,2) NOT NULL DEFAULT ''0.00'' COMMENT ''Sum of the room rows below''');
CALL sp_evt_add_constraint_if_not_exists('event_registration_accommodation', 'chk_acc_dates',
  'CHECK (`check_in_date` IS NULL OR `check_out_date` IS NULL OR `check_in_date` <= `check_out_date`)');
CALL sp_evt_add_constraint_if_not_exists('event_registration_accommodation', 'chk_acc_hostel_status',
  'CHECK (`hostel_status` IN (''Pending'',''Allocated'',''Rejected'',''Cancelled''))');
-- One accommodation request per registration
CALL sp_evt_add_index_if_not_exists('event_registration_accommodation', 'uq_acc_registration',
  'UNIQUE KEY `uq_acc_registration` (`registration_id`)');

CREATE TABLE IF NOT EXISTS `event_registration_accommodation_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_accommodation_id` int NOT NULL,
  `room_type_id` int DEFAULT NULL,
  -- Price is snapshotted at booking time: an admin editing the tariff later must
  -- not silently rewrite what past participants were charged.
  `room_type_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price_per_night_snapshot` decimal(10,2) NOT NULL DEFAULT '0.00',
  `occupants` int NOT NULL DEFAULT 1,
  `rooms_count` int NOT NULL DEFAULT 1,
  `nights` int NOT NULL DEFAULT 1,
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_acc_room_parent` (`registration_accommodation_id`),
  KEY `fk_acc_room_type` (`room_type_id`),
  CONSTRAINT `fk_acc_room_parent` FOREIGN KEY (`registration_accommodation_id`)
      REFERENCES `event_registration_accommodation` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_acc_room_type` FOREIGN KEY (`room_type_id`)
      REFERENCES `event_accommodation_room_types` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_acc_room_amounts` CHECK (
    `occupants` >= 1 AND `rooms_count` >= 1 AND `nights` >= 1
    AND `price_per_night_snapshot` >= 0 AND `amount` >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One accommodation configuration per event
CALL sp_evt_add_index_if_not_exists('event_accommodation', 'uq_accommodation_event',
  'UNIQUE KEY `uq_accommodation_event` (`event_id`)');


-- ---------------------------------------------------------------------
-- 5. PAYMENTS
-- ---------------------------------------------------------------------
-- event_payments already had verified_by / verified_at, which is the important
-- part: `Paid` is written by staff, never by the participant's browser. What was
-- missing is the proof the verifier actually looks at.

CALL sp_evt_add_column_if_not_exists('event_payments', 'proof_file_path',
  'VARCHAR(512) DEFAULT NULL COMMENT ''Multer path to the UPI screenshot under server/uploads/. Never a base64 data URL''');
CALL sp_evt_add_column_if_not_exists('event_payments', 'proof_uploaded_at',
  'TIMESTAMP NULL DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('event_payments', 'bill_type',
  'VARCHAR(40) NOT NULL DEFAULT ''Registration'' COMMENT ''Registration|Accommodation''');
CALL sp_evt_add_column_if_not_exists('event_payments', 'rejection_reason',
  'VARCHAR(512) DEFAULT NULL COMMENT ''Set when a verifier rejects the submitted proof''');

CALL sp_evt_add_constraint_if_not_exists('event_payments', 'chk_pay_status_values',
  'CHECK (`payment_status` IN (''Pending'',''Submitted'',''Verified'',''Rejected'',''Refunded''))');
CALL sp_evt_add_constraint_if_not_exists('event_payments', 'chk_pay_bill_type',
  'CHECK (`bill_type` IN (''Registration'',''Accommodation''))');

-- The invariant "payment_status = 'Verified' requires verified_by AND verified_at"
-- cannot be a CHECK constraint: MySQL rejects a CHECK on any column carrying a
-- foreign-key referential action (errno 3823), and fk_pay_verified_by is
-- ON DELETE SET NULL. It must therefore be enforced in the verification handler,
-- which is the only code path allowed to set 'Verified'. Do not set
-- payment_status from a generic update.
CALL sp_evt_add_index_if_not_exists('event_payments', 'idx_pay_bill_type',
  'INDEX `idx_pay_bill_type` (`bill_type`)');

CALL sp_evt_add_constraint_if_not_exists('event_registration_documents', 'chk_reg_doc_verification',
  'CHECK (`verification_status` IN (''Pending'',''Verified'',''Rejected''))');


-- ---------------------------------------------------------------------
-- 6. EVENTS TABLE — COMPLETE THE INCREMENTAL PATH
-- ---------------------------------------------------------------------
-- 20260812_events_module.sql adds only 13 columns to a pre-existing `events`
-- table, so a machine that ever ran the retired legacy/04_events.sql keeps its
-- 4-column shape and never gains event_title, dates, or type/level. Production
-- has no events table at all, so this is belt-and-braces for old dev databases.

CALL sp_evt_add_column_if_not_exists('events', 'event_title', 'VARCHAR(255) NOT NULL DEFAULT ''''');
CALL sp_evt_add_column_if_not_exists('events', 'description', 'TEXT');
CALL sp_evt_add_column_if_not_exists('events', 'event_type_id', 'INT DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('events', 'level_id', 'INT DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('events', 'start_date', 'DATETIME DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('events', 'end_date', 'DATETIME DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('events', 'feedback_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_evt_add_column_if_not_exists('events', 'certificate_enabled', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL sp_evt_add_column_if_not_exists('events', 'parent_id', 'INT DEFAULT NULL');
CALL sp_evt_add_column_if_not_exists('events', 'is_multi_event', 'TINYINT(1) NOT NULL DEFAULT 0');

-- Carry the legacy title across, then leave `title` in place for one release so
-- a rollback stays possible. Drop it in a follow-up migration.
-- LEGACY: `events.title` predates `event_title`.
-- Remove after all environments report event_title populated and no code reads title.
SET @evt_has_legacy_title = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'title');
SET @sql_backfill_title = IF(@evt_has_legacy_title > 0,
  'UPDATE `events` SET `event_title` = `title` WHERE (`event_title` IS NULL OR `event_title` = '''') AND `title` IS NOT NULL',
  'SELECT 1');
PREPARE stmt_title FROM @sql_backfill_title; EXECUTE stmt_title; DEALLOCATE PREPARE stmt_title;

-- workflow_status defaulted to 'Draft' while workflowService writes lowercase
-- statuses (in_progress, completed, rejected, archived). Normalise the odd one
-- out so status comparisons do not need to care about casing.
SET @evt_status_is_capitalised = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'events'
    AND column_name = 'workflow_status' AND generation_expression LIKE '%Draft%');
SET @sql_status_case = IF(@evt_status_is_capitalised > 0,
  'ALTER TABLE `events` MODIFY COLUMN `workflow_status` VARCHAR(32) GENERATED ALWAYS AS (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`workflow_state`, ''$.status'')), ''draft'')) STORED',
  'SELECT 1');
PREPARE stmt_status_case FROM @sql_status_case; EXECUTE stmt_status_case; DEALLOCATE PREPARE stmt_status_case;

-- One registration-settings row per event
CALL sp_evt_add_index_if_not_exists('event_registration_settings', 'uq_registration_settings_event',
  'UNIQUE KEY `uq_registration_settings_event` (`event_id`)');
CALL sp_evt_add_constraint_if_not_exists('event_registration_settings', 'chk_ers_status_values',
  'CHECK (`registration_status` IN (''NotStarted'',''Ongoing'',''Closed'',''Extended''))');

-- The event site needs to know, per event, whether a fee or accommodation
-- applies. Both are derivable by joining event_registration_fees /
-- event_accommodation, so no denormalised flags are added here; see the
-- /api/events/public projection in the module notes.


-- ---------------------------------------------------------------------
-- 7. PARTICIPANT-FACING RBAC
-- ---------------------------------------------------------------------
-- Reuses the keys seeded by events_final.sql. Payment verification is split out
-- from manage_registration: signing off money is a stronger grant than editing a
-- registration list, and the two should be assignable separately.

INSERT INTO `permissions`
  (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('events', 'verify_payment',    'event.verify_payment',    'Verify or reject participant payment proofs', 1),
  ('events', 'manage_accommodation', 'event.manage_accommodation', 'Configure room types and allocate participant accommodation', 1),
  ('events', 'manage_participants', 'event.manage_participants', 'View and block public event participant accounts', 1)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `is_system` = VALUES(`is_system`);


-- ---------------------------------------------------------------------
-- 8. DEFERRED DEPENDENCY: resource_persons
-- ---------------------------------------------------------------------
-- events_final.sql hard-FKs event_sessions.resource_person_id and
-- event_resource_persons.resource_person_id to `resource_persons`, which does not
-- exist in the production database — those CREATE TABLEs fail with errno 150.
-- The table ships in a separate module. These calls attach the constraints the
-- moment it lands and are no-ops until then, so this migration runs standalone.

CALL sp_evt_add_fk_if_target_exists('event_sessions', 'fk_es_resource_person', 'resource_persons',
  'FOREIGN KEY (`resource_person_id`) REFERENCES `resource_persons` (`id`) ON DELETE SET NULL');
CALL sp_evt_add_fk_if_target_exists('event_resource_persons', 'fk_erp_resource_person', 'resource_persons',
  'FOREIGN KEY (`resource_person_id`) REFERENCES `resource_persons` (`id`) ON DELETE CASCADE');


-- ---------------------------------------------------------------------
-- 9. CLEANUP
-- ---------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `sp_evt_guard_registrations_empty`;
DROP PROCEDURE IF EXISTS `sp_evt_add_column_if_not_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_drop_column_if_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_drop_fk_if_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_drop_index_if_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_add_index_if_not_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_add_constraint_if_not_exists`;
DROP PROCEDURE IF EXISTS `sp_evt_add_fk_if_target_exists`;
