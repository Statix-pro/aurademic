-- ============================================================
-- Migration: 20260829_create_event_registration_settings.sql
-- Purpose:   Create a dedicated, normalized table for event
--            registration settings instead of storing everything
--            inside the events.registration_settings JSON blob.
-- Run on:    research (MySQL 8.x)
-- ============================================================

CREATE TABLE IF NOT EXISTS `event_registration_settings` (
  `id`                          int          NOT NULL AUTO_INCREMENT,
  `event_id`                    int          NOT NULL COMMENT 'FK -> events(id)',
  `enabled`                     tinyint(1)   NOT NULL DEFAULT '0',
  `eligible_participants`       varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `open_to`                     varchar(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Any',
  `gender_restriction`          varchar(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Any',
  `min_age`                     int          DEFAULT NULL,
  `max_age`                     int          DEFAULT NULL,
  `registration_status`         varchar(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Open',
  `last_date`                   datetime     DEFAULT NULL,
  `extension_enabled`           tinyint(1)   NOT NULL DEFAULT '0',
  `extended_date`               datetime     DEFAULT NULL,
  `shortlisting_required`       tinyint(1)   NOT NULL DEFAULT '0',
  `selection_intimation`        varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `team_enabled`                tinyint(1)   NOT NULL DEFAULT '0',
  `min_team_size`               int          DEFAULT NULL,
  `max_team_size`               int          DEFAULT NULL,
  `document_enabled`            tinyint(1)   NOT NULL DEFAULT '0',
  `document_name`               varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_type`               varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_size`               varchar(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `document_text_field_enabled` tinyint(1)   NOT NULL DEFAULT '0',
  `created_by`                  int          DEFAULT NULL,
  `updated_by`                  int          DEFAULT NULL,
  `created_at`                  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE  KEY `uq_ers_event`      (`event_id`),
  KEY     `idx_ers_status`        (`registration_status`),
  KEY     `fk_ers_created_by`     (`created_by`),
  KEY     `fk_ers_updated_by`     (`updated_by`),
  CONSTRAINT `fk_ers_event`       FOREIGN KEY (`event_id`)    REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ers_created_by`  FOREIGN KEY (`created_by`)  REFERENCES `users`  (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ers_updated_by`  FOREIGN KEY (`updated_by`)  REFERENCES `users`  (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_ers_age`        CHECK ((`min_age` IS NULL) OR (`max_age` IS NULL) OR (`min_age` <= `max_age`)),
  CONSTRAINT `chk_ers_team_size`  CHECK ((`min_team_size` IS NULL) OR (`max_team_size` IS NULL) OR (`min_team_size` <= `max_team_size`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
