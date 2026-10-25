-- ==================================================================
-- Migration: KSRCT journal list import and yearly journal metrics
-- Author: Maheshwaran A K
-- Date: 2026-10-25
--
-- The journal list (`journal_options`) was typed in by hand, one journal at a
-- time. It is now filled from files the college already has: the faculty-kept
-- KSRCT journal master sheet, KSRCT's own Scopus and Web of Science exports,
-- and the yearly Scopus Source List and SCImago ranking. The list stays limited
-- to journals KSRCT actually uses; the big reference files are only looked up,
-- and the uploaded files themselves are never stored.
--
-- This migration only adds. No existing row is changed or deleted:
--
--   * `journal_options` gains the reference columns the yearly files fill in
--     (Scopus source id and status, Medline, Web of Science, country) and
--     `level_source`, which records who decided National/International so an
--     import never overrides an administrator. Existing rows get NULL there:
--     it is not known whether a person chose their level or the form's
--     'National' default did, so an import may propose a level for them, and
--     the admin sees that change in the preview before applying it.
--   * `journal_metrics_yearly` keeps every metric per year and per source, so
--     a new year never overwrites an old one and a publication can show the
--     value for its own year.
--   * `journal_import_batches` / `journal_import_rows` record each import:
--     who uploaded which file (name and SHA-256 only, never the contents) and
--     the per-journal outcome the admin previews, applies or resolves.
--
-- Every step is guarded, so running the file twice is a no-op.
--
-- Read-only audit — run first to see the rows this feature will match against:
--
--   SELECT COUNT(*) AS journals,
--          SUM(is_placeholder = 1) AS placeholders,
--          SUM(COALESCE(print_issn, '') = '' AND COALESCE(online_issn, '') = '') AS no_issn
--     FROM journal_options;
--
--   -- Names held by more than one non-placeholder row (an import matches on ISSN first,
--   -- then on name, so these are worth merging by hand first):
--   SELECT journal_name, COUNT(*) AS copies, GROUP_CONCAT(id ORDER BY id) AS ids
--     FROM journal_options WHERE is_placeholder = 0
--    GROUP BY journal_name HAVING COUNT(*) > 1;
-- ==================================================================

SET @db_name = DATABASE();

-- ------------------------------------------------------------------
-- 1. Reference columns on journal_options
-- ------------------------------------------------------------------

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'scopus_source_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN scopus_source_id BIGINT UNSIGNED NULL COMMENT ''Scopus Sourcerecord ID; SCImago Sourceid is the same number'' AFTER online_issn',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'scopus_status');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN scopus_status ENUM(''active'',''inactive'') NULL COMMENT ''NULL = not in the Scopus Source List'' AFTER scopus_source_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'scopus_discontinued');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN scopus_discontinued TINYINT(1) NOT NULL DEFAULT 0 AFTER scopus_status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'medline');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN medline TINYINT(1) NOT NULL DEFAULT 0 AFTER scopus_discontinued',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'wos_indexed');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN wos_indexed TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Seen in a KSRCT Web of Science export'' AFTER medline',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'country');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN country VARCHAR(100) NULL COMMENT ''Publishing country, from SCImago'' AFTER wos_indexed',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'level_source');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN level_source ENUM(''auto'',''faculty'',''admin'') NULL COMMENT ''Who set category: admin > faculty sheet > auto default; NULL = unknown (rows before 2026-10-25)'' AFTER category',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND COLUMN_NAME = 'reference_checked_at');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_options ADD COLUMN reference_checked_at TIMESTAMP NULL COMMENT ''Last time a Scopus/SCImago import matched this journal'' AFTER level_source',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- One Scopus source can be only one journal in the list; a second row claiming the same id is
-- a duplicate the import reports instead of silently merging.
SET @has_idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_options'
                   AND INDEX_NAME = 'uq_journal_options_scopus_source');
SET @sql = IF(@has_idx = 0,
  'ALTER TABLE journal_options ADD UNIQUE KEY uq_journal_options_scopus_source (scopus_source_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------------
-- 2. Import log — no file contents, ever
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `journal_import_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_key` varchar(40) NOT NULL COMMENT 'Which file type: ksrct_master, scopus_export, wos_export, scopus_source_list, scimago',
  `file_name` varchar(255) DEFAULT NULL,
  `file_sha256` char(64) NOT NULL COMMENT 'Blocks applying the same file twice; the file itself is not kept',
  `metric_year` smallint DEFAULT NULL COMMENT 'Year the file''s metrics belong to',
  `status` enum('previewed','applied','discarded') NOT NULL DEFAULT 'previewed',
  `summary` json DEFAULT NULL COMMENT 'Row counts by outcome and by reason for leaving rows out',
  `created_by` int DEFAULT NULL,
  `applied_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `applied_at` timestamp NULL DEFAULT NULL,
  `discarded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_journal_import_batches_file` (`source_key`, `file_sha256`),
  KEY `idx_journal_import_batches_status` (`status`),
  CONSTRAINT `fk_journal_import_batches_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_journal_import_batches_applied_by` FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `journal_import_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `batch_id` int NOT NULL,
  `source_row` int NOT NULL COMMENT 'First line of the file this journal came from',
  `outcome` enum('add','update','unchanged','exception') NOT NULL,
  `resolution` enum('pending','applied','excluded') NOT NULL DEFAULT 'pending',
  `journal_option_id` int DEFAULT NULL COMMENT 'Journal matched at preview, or created on apply',
  `journal_name` varchar(255) NOT NULL,
  `reason` varchar(500) DEFAULT NULL COMMENT 'Why an exception needs a person, or what was auto-corrected',
  `payload` json NOT NULL COMMENT 'Normalised values the apply step writes',
  `changes` json DEFAULT NULL COMMENT 'Field-by-field before/after shown in the preview',
  `resolved_by` int DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_journal_import_rows_batch_outcome` (`batch_id`, `outcome`, `resolution`),
  KEY `idx_journal_import_rows_journal` (`journal_option_id`),
  CONSTRAINT `fk_journal_import_rows_batch` FOREIGN KEY (`batch_id`) REFERENCES `journal_import_batches` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_journal_import_rows_journal` FOREIGN KEY (`journal_option_id`) REFERENCES `journal_options` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_journal_import_rows_resolved_by` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- 3. Metrics by year and source
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `journal_metrics_yearly` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_option_id` int NOT NULL,
  `metric` enum('impact_factor','cite_score','sjr','quartile','h_index') NOT NULL,
  `metric_year` smallint NOT NULL COMMENT 'Data year (JCR 2025 release = 2024)',
  `source` enum('faculty_master','scimago','citescore','jcr','faculty_entry','admin') NOT NULL,
  `value_decimal` decimal(12,3) DEFAULT NULL,
  `value_text` varchar(10) DEFAULT NULL COMMENT 'Quartile code (Q1-Q4)',
  `import_batch_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journal_metrics_yearly` (`journal_option_id`, `metric`, `metric_year`, `source`),
  KEY `idx_journal_metrics_yearly_metric_year` (`metric`, `metric_year`),
  CONSTRAINT `fk_journal_metrics_yearly_journal` FOREIGN KEY (`journal_option_id`) REFERENCES `journal_options` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_journal_metrics_yearly_batch` FOREIGN KEY (`import_batch_id`) REFERENCES `journal_import_batches` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- DROP TABLE IF EXISTS journal_metrics_yearly;
-- DROP TABLE IF EXISTS journal_import_rows;
-- DROP TABLE IF EXISTS journal_import_batches;
-- ALTER TABLE journal_options
--   DROP INDEX uq_journal_options_scopus_source,
--   DROP COLUMN reference_checked_at,
--   DROP COLUMN level_source,
--   DROP COLUMN country,
--   DROP COLUMN wos_indexed,
--   DROP COLUMN medline,
--   DROP COLUMN scopus_discontinued,
--   DROP COLUMN scopus_status,
--   DROP COLUMN scopus_source_id;
