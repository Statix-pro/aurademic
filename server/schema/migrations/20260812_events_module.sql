-- =====================================================================
-- Event Management Module - Production Migration & Schema Evolution
-- =====================================================================
-- Description: Native Event Management module migration for the Enterprise ERP.
--              Includes incremental schema evolution (ALTER TABLE) for existing tables,
--              CREATE TABLE IF NOT EXISTS for new tables, explicit DML data migration routines,
--              normalized event_sessions entity, refactored attendance FK, safe parent FK SET NULL,
--              deterministic ON DUPLICATE KEY UPDATE seed upserts, optimized composite indexes,
--              and ERP infrastructure integration (users, employees, departments, entities,
--              resource persons, finance requests, RBAC, workflow).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. SCHEMA EVOLUTION HELPER PROCEDURES
-- ---------------------------------------------------------------------

DELIMITER //

DROP PROCEDURE IF EXISTS `sp_add_column_if_not_exists`//
CREATE PROCEDURE `sp_add_column_if_not_exists`(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_name
    ) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_definition);
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS `sp_add_index_if_not_exists`//
CREATE PROCEDURE `sp_add_index_if_not_exists`(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = p_table_name
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.statistics 
        WHERE table_schema = DATABASE() AND table_name = p_table_name AND index_name = p_index_name
    ) THEN
        SET @s = CONCAT('ALTER TABLE `', p_table_name, '` ADD INDEX `', p_index_name, '` ', p_index_definition);
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;

-- ---------------------------------------------------------------------
-- 1. MASTER TABLES (Event-specific & ERP extensions)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `m_category` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `display_order` int DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_category_code` (`category_code`),
  UNIQUE KEY `uq_category_name` (`category_name`),
  KEY `idx_category_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_category_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_category_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_document_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allowed_extension` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_file_size` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_document_name` (`document_name`),
  KEY `idx_document_type_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_doc_type_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_doc_type_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_event_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `event_type_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_type_name` (`category_id`, `event_type_name`),
  KEY `idx_event_type_category` (`category_id`),
  KEY `idx_event_type_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_event_type_category` FOREIGN KEY (`category_id`) REFERENCES `m_category` (`id`),
  CONSTRAINT `fk_event_type_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_event_type_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_level` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_level_name` (`level_name`),
  KEY `idx_level_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_level_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_level_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_participant_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `participant_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_participant_type` (`participant_type`),
  KEY `idx_participant_type_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_part_type_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_part_type_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_sdg` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sdg_number` int NOT NULL,
  `sdg_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sdg_number` (`sdg_number`),
  KEY `idx_sdg_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_sdg_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sdg_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_sponsor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sponsor_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_person` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sponsor_name` (`sponsor_name`),
  KEY `idx_sponsor_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_sponsor_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sponsor_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_theme` (
  `id` int NOT NULL AUTO_INCREMENT,
  `theme_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_theme_name` (`theme_name`),
  KEY `idx_theme_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_theme_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_theme_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `m_venue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `venue_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `building_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `capacity` int NOT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_venue_name` (`venue_name`),
  KEY `idx_venue_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `chk_venue_capacity` CHECK (`capacity` >= 0),
  CONSTRAINT `fk_venue_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_venue_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 2. MAIN EVENTS & SESSIONS TABLES (Creation & Incremental Evolution)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_ref_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `event_type_id` int DEFAULT NULL,
  `level_id` int DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `workflow_state` json DEFAULT NULL,
  `workflow_status` varchar(32) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`, '$.status')), 'Draft')) STORED,
  `workflow_stage` varchar(64) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`, '$.currentStage')), '')) STORED,
  `feedback_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `certificate_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `facebook_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `x_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instagram_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_id` int DEFAULT NULL,
  `is_multi_event` tinyint(1) NOT NULL DEFAULT 0,
  `version` int NOT NULL DEFAULT 1,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_events_ref_no` (`event_ref_no`),
  KEY `fk_event_type` (`event_type_id`),
  KEY `fk_event_level` (`level_id`),
  KEY `fk_events_parent` (`parent_id`),
  KEY `idx_events_workflow_status` (`workflow_status`),
  KEY `idx_events_workflow_stage` (`workflow_stage`),
  KEY `idx_events_workflow_stage_status` (`workflow_stage`, `workflow_status`),
  KEY `idx_events_created_by` (`created_by`),
  KEY `idx_events_updated_by` (`updated_by`),
  KEY `idx_events_active_deleted` (`is_active`, `is_deleted`),
  KEY `idx_events_dates` (`start_date`, `end_date`),
  CONSTRAINT `fk_event_level` FOREIGN KEY (`level_id`) REFERENCES `m_level` (`id`),
  CONSTRAINT `fk_event_type` FOREIGN KEY (`event_type_id`) REFERENCES `m_event_type` (`id`),
  CONSTRAINT `fk_events_parent` FOREIGN KEY (`parent_id`) REFERENCES `events` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_events_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_events_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_events_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_events_dates` CHECK (`start_date` IS NULL OR `end_date` IS NULL OR `start_date` <= `end_date`),
  CONSTRAINT `chk_events_version` CHECK (`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Incremental Migration for Pre-existing `events` Tables
CALL sp_add_column_if_not_exists('events', 'event_ref_no', 'VARCHAR(50) DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'workflow_state', 'JSON DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'workflow_status', 'VARCHAR(32) GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`, ''$.status'')), ''Draft'')) STORED');
CALL sp_add_column_if_not_exists('events', 'workflow_stage', 'VARCHAR(64) GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`, ''$.currentStage'')), '''')) STORED');
CALL sp_add_column_if_not_exists('events', 'facebook_link', 'VARCHAR(255) DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'x_link', 'VARCHAR(255) DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'instagram_link', 'VARCHAR(255) DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'linkedin_link', 'VARCHAR(255) DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'version', 'INT NOT NULL DEFAULT 1');
CALL sp_add_column_if_not_exists('events', 'deleted_by', 'INT DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'deleted_at', 'TIMESTAMP NULL DEFAULT NULL');
CALL sp_add_column_if_not_exists('events', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL sp_add_column_if_not_exists('events', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');

CALL sp_add_index_if_not_exists('events', 'idx_events_workflow_status', '(`workflow_status`)');
CALL sp_add_index_if_not_exists('events', 'idx_events_workflow_stage', '(`workflow_stage`)');

CREATE TABLE IF NOT EXISTS `event_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `session_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `session_date` date DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `venue_id` int DEFAULT NULL,
  `resource_person_id` int DEFAULT NULL,
  `max_capacity` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_es_event` (`event_id`),
  KEY `fk_es_venue` (`venue_id`),
  KEY `fk_es_resource_person` (`resource_person_id`),
  KEY `idx_es_event_date` (`event_id`, `session_date`),
  KEY `idx_es_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_es_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_es_venue` FOREIGN KEY (`venue_id`) REFERENCES `m_venue` (`id`) ON DELETE SET NULL,
  -- fk_es_resource_person is attached by
  -- server/schema/migrations/20260813_event_participants_and_registration_delta.sql
  -- once `resource_persons` exists. Declaring it inline made this whole script
  -- fail with errno 1824 on any database without that table, which includes
  -- production -- `resource_persons` ships in a separate module.
  CONSTRAINT `chk_es_times` CHECK (`start_time` IS NULL OR `end_time` IS NULL OR `start_time` <= `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 3. INTERMEDIATE RELATIONSHIP TABLES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_coordinators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Coordinator',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_employee` (`event_id`, `employee_id`),
  KEY `fk_coordinator_employee` (`employee_id`),
  CONSTRAINT `fk_coordinator_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coordinator_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`),
  CONSTRAINT `fk_coordinator_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_coordinator_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_hosts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `entity_type` enum('DEPARTMENT', 'ENTITY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `department_id` int DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_host_event` (`event_id`),
  KEY `fk_host_department` (`department_id`),
  KEY `fk_host_entity` (`entity_id`),
  CONSTRAINT `fk_host_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_host_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`),
  CONSTRAINT `fk_host_entity` FOREIGN KEY (`entity_id`) REFERENCES `master_entities` (`id`),
  CONSTRAINT `fk_host_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_host_type` CHECK (
    (`entity_type` = 'DEPARTMENT' AND `department_id` IS NOT NULL AND `entity_id` IS NULL) OR
    (`entity_type` = 'ENTITY' AND `entity_id` IS NOT NULL AND `department_id` IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 4. EVENT REGISTRATION & ATTENDANCE
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_registrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `registration_ref_no` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `registration_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `is_waitlisted` tinyint(1) NOT NULL DEFAULT 0,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registrations_ref_no` (`registration_ref_no`),
  UNIQUE KEY `uq_event_user` (`event_id`, `user_id`),
  KEY `fk_reg_event` (`event_id`),
  KEY `fk_reg_user` (`user_id`),
  KEY `idx_reg_status` (`registration_status`),
  KEY `idx_reg_user_status` (`user_id`, `registration_status`),
  KEY `idx_reg_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_reg_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reg_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_reg_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_registration_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `eligible_participants` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `open_to` enum('Any','Internal','External') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Any',
  `gender_restriction` enum('Any','Male','Female') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Any',
  `min_age` int DEFAULT NULL,
  `max_age` int DEFAULT NULL,
  `registration_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Ongoing',
  `last_date` datetime DEFAULT NULL,
  `extension_required` tinyint(1) NOT NULL DEFAULT 0,
  `extended_date` datetime DEFAULT NULL,
  `shortlisting_required` tinyint(1) NOT NULL DEFAULT 0,
  `selection_intimation_date` datetime DEFAULT NULL,
  `team_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `minimum_team_size` int DEFAULT NULL,
  `maximum_team_size` int DEFAULT NULL,
  `max_participants` int DEFAULT NULL,
  `waiting_list_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `registration_deadline` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_registration_settings_event` (`event_id`),
  KEY `idx_ers_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_ers_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ers_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ers_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ers_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_ers_team_sizes` CHECK (
    `minimum_team_size` IS NULL
    OR `maximum_team_size` IS NULL
    OR `minimum_team_size` <= `maximum_team_size`
  ),
  CONSTRAINT `chk_ers_ages` CHECK (
    `min_age` IS NULL
    OR `max_age` IS NULL
    OR `min_age` <= `max_age`
  ),
  CONSTRAINT `chk_ers_limits` CHECK (
    `min_age` >= 0 AND `max_age` >= 0 AND `max_participants` >= 1 AND `minimum_team_size` >= 1 AND `maximum_team_size` >= 1
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `session_id` int DEFAULT NULL,
  `check_in` datetime DEFAULT NULL,
  `check_out` datetime DEFAULT NULL,
  `attendance_status` enum('Present', 'Absent', 'Excused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Present',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_session` (`registration_id`, `session_id`),
  KEY `fk_attendance_registration` (`registration_id`),
  KEY `fk_attendance_session` (`session_id`),
  KEY `idx_attendance_status` (`attendance_status`),
  CONSTRAINT `fk_attendance_registration` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attendance_session` FOREIGN KEY (`session_id`) REFERENCES `event_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attendance_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attendance_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_attendance_times` CHECK (`check_in` IS NULL OR `check_out` IS NULL OR `check_in` <= `check_out`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 5. ACCOMMODATION
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_accommodation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `accommodation_type` enum('Free','Paid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Free',
  `gents_limit` int NOT NULL DEFAULT 0,
  `ladies_limit` int NOT NULL DEFAULT 0,
  `fee_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_ea_event` (`event_id`),
  KEY `idx_ea_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_ea_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ea_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ea_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ea_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_ea_limits` CHECK (`gents_limit` >= 0 AND `ladies_limit` >= 0 AND `fee_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_registration_accommodation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `accommodation_required` tinyint(1) NOT NULL DEFAULT 0,
  `room_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hostel_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `room_allocation_id` int DEFAULT NULL COMMENT 'Reference to external guest house/room allocation schema if integrated later',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_acc_reg` (`registration_id`),
  KEY `idx_acc_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_acc_reg` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_acc_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_acc_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_acc_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 6. RESOURCE PERSONS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_resource_persons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `resource_person_id` int NOT NULL COMMENT 'FK referencing resource_persons(id) from separate PR module',
  `purpose` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode` enum('Online','Offline') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_datetime` datetime DEFAULT NULL,
  `topic_title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invitation_sent` tinyint(1) NOT NULL DEFAULT 0,
  `thanks_sent` tinyint(1) NOT NULL DEFAULT 0,
  `honorarium_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `travel_details` text COLLATE utf8mb4_unicode_ci,
  `accommodation_required` tinyint(1) NOT NULL DEFAULT 0,
  `accommodation_details` text COLLATE utf8mb4_unicode_ci,
  `payment_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_resource_person` (`event_id`, `resource_person_id`),
  KEY `fk_erp_event` (`event_id`),
  KEY `fk_erp_resource_person` (`resource_person_id`),
  KEY `idx_erp_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_erp_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  -- fk_erp_resource_person: see the note on fk_es_resource_person above.
  CONSTRAINT `fk_erp_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_erp_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_erp_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_erp_honorarium` CHECK (`honorarium_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 7. DOCUMENTS & ATTACHMENTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `document_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_edoc_event` (`event_id`),
  KEY `idx_edoc_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_edoc_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_edoc_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_edoc_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_edoc_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_document_upload` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `document_type_id` int NOT NULL,
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_event_document_upload_event` (`event_id`),
  KEY `fk_edu_doc_type` (`document_type_id`),
  KEY `idx_edu_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_edu_doc_type` FOREIGN KEY (`document_type_id`) REFERENCES `m_document_type` (`id`),
  CONSTRAINT `fk_edu_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_edu_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_edu_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_edu_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_registration_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `document_type_id` int DEFAULT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `verification_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_doc_reg` (`registration_id`),
  KEY `fk_doc_type_reg` (`document_type_id`),
  KEY `idx_doc_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_doc_reg` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_type_reg` FOREIGN KEY (`document_type_id`) REFERENCES `m_document_type` (`id`),
  CONSTRAINT `fk_reg_doc_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_doc_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_reg_doc_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 8. PAYMENTS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_registration_fees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `participant_type_id` int DEFAULT NULL,
  `individual_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `team_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `member_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `additional_member_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_erf_event` (`event_id`),
  KEY `fk_erf_part_type` (`participant_type_id`),
  KEY `idx_erf_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_erf_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_erf_part_type` FOREIGN KEY (`participant_type_id`) REFERENCES `m_participant_type` (`id`),
  CONSTRAINT `fk_erf_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_erf_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_erf_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_erf_nonnegative` CHECK (`individual_fee` >= 0 AND `team_fee` >= 0 AND `member_fee` >= 0 AND `additional_member_fee` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `registration_id` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_mode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transaction_reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `payment_date` datetime DEFAULT NULL,
  `receipt_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_by` int DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `finance_request_id` int DEFAULT NULL COMMENT 'Optional linkage to canonical finance ledger request if integrated',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipt_number` (`receipt_number`),
  KEY `fk_pay_reg` (`registration_id`),
  KEY `idx_pay_status` (`payment_status`),
  KEY `idx_pay_status_date` (`payment_status`, `payment_date`),
  KEY `idx_pay_active_deleted` (`is_active`, `is_deleted`),
  KEY `idx_pay_paymentdate` (`payment_date`),
  KEY `fk_pay_verified_by` (`verified_by`),
  KEY `fk_pay_finance_request` (`finance_request_id`),
  CONSTRAINT `fk_pay_reg` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pay_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pay_finance_request` FOREIGN KEY (`finance_request_id`) REFERENCES `finance_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pay_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pay_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pay_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_pay_amount_nonnegative` CHECK (`amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 9. CERTIFICATE MANAGEMENT
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_certificate_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `template_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `template_file` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
,,.r,der  KEY `fk_ec_reg` (`registration_id`),
  KEY `fk_ec_template` (`template_id`),
  KEY `idx_ec_active_deleted` (`is_active`, `is_deleted`),
  KEY `idx_ec_hash` (`verification_hash`),
  CONSTRAINT `fk_ec_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ec_reg` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ec_template` FOREIGN KEY (`template_id`) REFERENCES `event_certificate_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ec_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ec_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ec_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 10. FEEDBACK
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_feedback_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `question_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `question_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `section_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT 1,
  `is_required` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_efq_event` (`event_id`),
  KEY `idx_efq_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_efq_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_efq_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efq_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efq_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_feedback_question_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int NOT NULL,
  `option_text` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_order` int NOT NULL DEFAULT 1,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_efqo_question` (`question_id`),
  KEY `idx_efqo_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_efqo_question` FOREIGN KEY (`question_id`) REFERENCES `event_feedback_questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_efqo_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efqo_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efqo_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_feedbacks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `registration_id` int NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_feedback_registration` (`event_id`, `registration_id`),
  KEY `fk_ef_event` (`event_id`),
  KEY `fk_ef_registration` (`registration_id`),
  KEY `idx_ef_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_ef_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ef_registration` FOREIGN KEY (`registration_id`) REFERENCES `event_registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ef_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ef_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ef_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_feedback_answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `feedback_id` int NOT NULL,
  `question_id` int NOT NULL,
  `answer_text` text COLLATE utf8mb4_unicode_ci,
  `rating_value` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feedback_question_answer` (`feedback_id`, `question_id`),
  KEY `fk_efa_feedback` (`feedback_id`),
  KEY `fk_efa_question` (`question_id`),
  KEY `idx_efa_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_efa_feedback` FOREIGN KEY (`feedback_id`) REFERENCES `event_feedbacks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_efa_question` FOREIGN KEY (`question_id`) REFERENCES `event_feedback_questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_efa_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efa_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_efa_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 11. ADDITIONAL TRANSACTIONAL RELATIONSHIPS (Sponsors, SDGs, Themes)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_sdgs` (
  `event_id` int NOT NULL,
  `sdg_id` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`, `sdg_id`),
  KEY `fk_event_sdg_sdg` (`sdg_id`),
  CONSTRAINT `fk_event_sdg_evt` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_sdg_sdg` FOREIGN KEY (`sdg_id`) REFERENCES `m_sdg` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_sdg_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_sponsoring_agency` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `sponsor_id` int DEFAULT NULL,
  `agency_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sponsor_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_esa_event` (`event_id`),
  KEY `fk_esa_sponsor` (`sponsor_id`),
  KEY `idx_esa_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_esa_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_esa_sponsor` FOREIGN KEY (`sponsor_id`) REFERENCES `m_sponsor` (`id`),
  CONSTRAINT `fk_esa_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_esa_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_esa_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_esa_sponsor_amount_nonnegative` CHECK (`sponsor_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `event_themes` (
  `event_id` int NOT NULL,
  `theme_id` int NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`event_id`, `theme_id`),
  KEY `fk_event_theme_thm` (`theme_id`),
  CONSTRAINT `fk_event_theme_evt` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_theme_thm` FOREIGN KEY (`theme_id`) REFERENCES `m_theme` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_theme_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 12. PUBLICITY & PUBLIC RELATIONS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `event_publicity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `publicity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_date` date DEFAULT NULL,
  `mail_sent` tinyint(1) NOT NULL DEFAULT 0,
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `fk_ep_event` (`event_id`),
  KEY `idx_ep_active_deleted` (`is_active`, `is_deleted`),
  CONSTRAINT `fk_ep_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ep_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ep_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_ep_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------
-- 13. LEGACY DATA MIGRATION & TRANSFORMATION ROUTINES (DML)
-- ---------------------------------------------------------------------

-- Generate event_ref_no for legacy event records missing reference numbers
UPDATE `events` 
SET `event_ref_no` = CONCAT('EVT-LEGACY-', LPAD(`id`, 6, '0')) 
WHERE `event_ref_no` IS NULL OR `event_ref_no` = '';

-- Every backfill below is guarded by NOT EXISTS on the target's natural key,
-- NOT by INSERT IGNORE. IGNORE only suppresses a duplicate that violates a
-- UNIQUE or PRIMARY key, and event_documents, event_payments and
-- event_sponsoring_agency have no unique key over the copied columns — so on any
-- database where the legacy source tables still exist, each re-run of this file
-- would insert the whole set again. This file documents itself as re-runnable,
-- so the guard has to be explicit.

-- Migrate legacy event plans into event registration settings
SET @has_event_plans = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_plans');
SET @sql_event_plans = IF(@has_event_plans > 0,
  'INSERT INTO `event_registration_settings` (`event_id`, `eligible_participants`, `max_participants`, `created_at`)
     SELECT s.`event_id`, s.`target_audience`, s.`max_capacity`, CURRENT_TIMESTAMP
       FROM `event_plans` s
      WHERE NOT EXISTS (SELECT 1 FROM `event_registration_settings` t WHERE t.`event_id` = s.`event_id`)',
  'SELECT 1');
PREPARE stmt_plans FROM @sql_event_plans;
EXECUTE stmt_plans;
DEALLOCATE PREPARE stmt_plans;

-- Migrate legacy event uploads into event documents
SET @has_event_uploads = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_uploads');
SET @sql_event_uploads = IF(@has_event_uploads > 0,
  'INSERT INTO `event_documents` (`event_id`, `document_name`, `file_path`, `created_at`)
     SELECT s.`event_id`, s.`doc_name`, s.`file_url`, CURRENT_TIMESTAMP
       FROM `event_uploads` s
      WHERE NOT EXISTS (SELECT 1 FROM `event_documents` t WHERE t.`event_id` = s.`event_id` AND t.`file_path` = s.`file_url`)',
  'SELECT 1');
PREPARE stmt_uploads FROM @sql_event_uploads;
EXECUTE stmt_uploads;
DEALLOCATE PREPARE stmt_uploads;

-- Migrate legacy event finance into event payments
SET @has_event_finance = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_finance');
SET @sql_event_finance = IF(@has_event_finance > 0,
  'INSERT INTO `event_payments` (`registration_id`, `amount`, `payment_mode`, `payment_status`, `created_at`)
     SELECT s.`registration_id`, s.`amount`, s.`payment_mode`, s.`status`, CURRENT_TIMESTAMP
       FROM `event_finance` s
      WHERE NOT EXISTS (SELECT 1 FROM `event_payments` t WHERE t.`registration_id` = s.`registration_id` AND t.`amount` = s.`amount`)',
  'SELECT 1');
PREPARE stmt_finance FROM @sql_event_finance;
EXECUTE stmt_finance;
DEALLOCATE PREPARE stmt_finance;

-- Migrate legacy event_finance_sponsors into event_sponsoring_agency
SET @has_ef_sponsors = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_finance_sponsors');
SET @sql_ef_sponsors = IF(@has_ef_sponsors > 0,
  'INSERT INTO `event_sponsoring_agency` (`event_id`, `agency_name`, `sponsor_amount`, `created_at`)
     SELECT s.`event_id`, s.`sponsor_name`, s.`amount`, CURRENT_TIMESTAMP
       FROM `event_finance_sponsors` s
      WHERE NOT EXISTS (SELECT 1 FROM `event_sponsoring_agency` t WHERE t.`event_id` = s.`event_id` AND t.`agency_name` = s.`sponsor_name`)',
  'SELECT 1');
PREPARE stmt_ef_sponsors FROM @sql_ef_sponsors;
EXECUTE stmt_ef_sponsors;
DEALLOCATE PREPARE stmt_ef_sponsors;

-- Migrate legacy event_finance_docs into event_documents
SET @has_ef_docs = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_finance_docs');
SET @sql_ef_docs = IF(@has_ef_docs > 0,
  'INSERT INTO `event_documents` (`event_id`, `document_name`, `file_path`, `created_at`)
     SELECT s.`event_id`, s.`doc_name`, s.`file_url`, CURRENT_TIMESTAMP
       FROM `event_finance_docs` s
      WHERE NOT EXISTS (SELECT 1 FROM `event_documents` t WHERE t.`event_id` = s.`event_id` AND t.`file_path` = s.`file_url`)',
  'SELECT 1');
PREPARE stmt_ef_docs FROM @sql_ef_docs;
EXECUTE stmt_ef_docs;
DEALLOCATE PREPARE stmt_ef_docs;


-- ---------------------------------------------------------------------
-- 14. DETERMINISTIC IMMUTABLE SEED DATA (Natural Business Key Upserts)
-- ---------------------------------------------------------------------

INSERT INTO `m_category` (`category_name`, `category_code`, `description`, `display_order`) VALUES
('Academic', 'ACAD', 'Academic events including lectures, quizzes, and workshops', 10),
('Co-Curricular', 'COCURR', 'Co-curricular and project exhibitions', 20),
('Extra-Curricular', 'EXTRACURR', 'Sports, cultural, and community activities', 30)
ON DUPLICATE KEY UPDATE 
  `category_name` = VALUES(`category_name`),
  `description` = VALUES(`description`),
  `display_order` = VALUES(`display_order`);

INSERT INTO `m_participant_type` (`participant_type`) VALUES
('Student (Internal)'),
('Faculty (Internal)'),
('External Student'),
('External Faculty/Industry')
ON DUPLICATE KEY UPDATE 
  `participant_type` = VALUES(`participant_type`);

INSERT INTO `m_level` (`level_name`, `description`) VALUES
('Institution Level', 'Within the institution campus'),
('State Level', 'Across colleges in the state'),
('National Level', 'Nationwide participation'),
('International Level', 'International events')
ON DUPLICATE KEY UPDATE 
  `description` = VALUES(`description`);

INSERT INTO `m_sdg` (`sdg_number`, `sdg_name`) VALUES
(4, 'Quality Education'),
(5, 'Gender Equality'),
(8, 'Decent Work and Economic Growth'),
(9, 'Industry, Innovation, and Infrastructure')
ON DUPLICATE KEY UPDATE 
  `sdg_name` = VALUES(`sdg_name`);


-- ---------------------------------------------------------------------
-- 15. WORKFLOW & RBAC REGISTRATION
-- ---------------------------------------------------------------------

INSERT INTO `workflow_stage_policies`
  (`module_key`, `stage_key`, `scope_type`, `meta`, `is_active`)
VALUES
  ('events', 'level1',     'department', '{"requireAssignment": false, "assignmentRoleCode": null}', 1),
  ('events', 'dof',        'global',     NULL, 1),
  ('events', 'principal',  'global',     NULL, 1)
ON DUPLICATE KEY UPDATE 
  `scope_type` = VALUES(`scope_type`),
  `meta` = VALUES(`meta`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `approval_flow_config`
  (`beneficiary_type`, `entity_type_code`, `flow`, `module_key`, `is_active`)
VALUES
  ('', NULL, JSON_ARRAY('level1', 'dof', 'principal'), 'events', 1)
ON DUPLICATE KEY UPDATE 
  `flow` = VALUES(`flow`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `permissions`
  (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('events', 'view',                'event.view',                 'View events in the ERP system', 1),
  ('events', 'create',              'event.create',               'Create new event requests', 1),
  ('events', 'update',              'event.update',               'Update event specifications', 1),
  ('events', 'submit',              'event.submit',               'Submit event for verification/approvals', 1),
  ('events', 'approve',             'event.approve',              'Approve event requests at any workflow stage', 1),
  ('events', 'reject',              'event.reject',               'Reject event requests', 1),
  ('events', 'return',              'event.return',               'Return event request to draft', 1),
  ('events', 'cancel',              'event.cancel',               'Cancel scheduled events', 1),
  ('events', 'close',               'event.close',                'Close events and settlements', 1),
  ('events', 'register',            'event.register',             'Register as participant for events', 1),
  ('events', 'manage_registration',  'event.manage_registration',  'Manage participant registration lists', 1),
  ('events', 'manage_attendance',    'event.manage_attendance',    'Record and verify student attendance', 1),
  ('events', 'generate_certificate', 'event.generate_certificate', 'Configure and generate event certificates', 1),
  ('events', 'manage_documents',     'event.manage_documents',     'Manage event documentation templates', 1),
  ('events', 'manage_feedback',      'event.manage_feedback',      'Review and moderate event feedback surveys', 1),
  ('events', 'manage_resources',     'event.manage_resources',     'Assign resource persons and schedules', 1)
ON DUPLICATE KEY UPDATE 
  `description` = VALUES(`description`),
  `is_system` = VALUES(`is_system`);


-- ---------------------------------------------------------------------
-- 16. CLEANUP HELPER PROCEDURES
-- ---------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `sp_add_column_if_not_exists`;
DROP PROCEDURE IF EXISTS `sp_add_index_if_not_exists`;