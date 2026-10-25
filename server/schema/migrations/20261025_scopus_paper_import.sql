-- ==================================================================
-- Migration: import KSRCT papers from the Scopus export
-- Author: Maheshwaran A K
-- Date: 2026-10-25
--
-- KSRCT's own papers are loaded from its Scopus export through the Journal
-- Import screen, instead of every author typing them in. A paper is credited
-- to a staff member by their Scopus Author ID (`master_employees.scopus_id`),
-- never by name: Scopus names are initials plus a surname, and many staff
-- share them.
--
-- This migration only adds. No existing row is changed or deleted:
--
--   * `journals.import_batch_id` records which import created or filled a
--     publication.
--   * `journal_scopus_authors` keeps Scopus's author list for every imported
--     paper: position, Scopus Author ID, name and whether the author gave a
--     KSRCT affiliation. A paper whose KSRCT author has no Scopus ID on file
--     yet is kept unassigned; when that ID is filled in later, this table is
--     how every one of their papers is found and credited to them.
--   * `journal_import_rows.publication_id` links an import row to the
--     publication it created or updated, as `journal_option_id` does for the
--     journal list.
--   * `employee_scopus_ids` holds further Scopus Author IDs per staff member.
--     Scopus often splits one person's papers over two or more profiles; the
--     staff record's own `scopus_id` stays the main one. Rows come from a
--     super admin's bulk sheet or from staff confirming a suggested profile,
--     and say who added them and when, so a wrong claim can be undone.
--
-- Every step is guarded, so running the file twice is a no-op.
--
-- Read-only audit — run first:
--
--   -- Publications already carrying a Scopus EID or a DOI, which the import
--   -- matches instead of adding a second copy:
--   SELECT COUNT(*) AS publications,
--          SUM(COALESCE(scopus_id, '') <> '') AS with_scopus_eid,
--          SUM(COALESCE(doi, '') <> '') AS with_doi
--     FROM journals;
--
--   -- Staff with a Scopus Author ID on file (the only thing papers are credited by):
--   SELECT COUNT(*) AS staff, SUM(COALESCE(scopus_id, '') <> '') AS with_scopus_id
--     FROM master_employees;
-- ==================================================================

SET @db_name = DATABASE();

-- ------------------------------------------------------------------
-- 1. Which import created or filled a publication
-- ------------------------------------------------------------------

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journals'
                   AND COLUMN_NAME = 'import_batch_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journals ADD COLUMN import_batch_id INT NULL COMMENT ''Journal Import batch that created or filled this publication; NULL = entered on the form'' AFTER created_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journals'
                  AND CONSTRAINT_NAME = 'fk_journals_import_batch');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE journals ADD CONSTRAINT fk_journals_import_batch FOREIGN KEY (import_batch_id) REFERENCES journal_import_batches (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- The import finds an existing copy of a paper by its Scopus EID and DOI.
SET @has_idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journals'
                   AND INDEX_NAME = 'idx_journals_scopus_id');
SET @sql = IF(@has_idx = 0,
  'ALTER TABLE journals ADD KEY idx_journals_scopus_id (scopus_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journals'
                   AND INDEX_NAME = 'idx_journals_doi');
SET @sql = IF(@has_idx = 0,
  'ALTER TABLE journals ADD KEY idx_journals_doi (doi)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------------
-- 2. Scopus's author list for imported papers
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `journal_scopus_authors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_id` int NOT NULL,
  `author_position` smallint NOT NULL COMMENT '1 = first author, in Scopus order',
  `scopus_author_id` bigint unsigned DEFAULT NULL,
  `author_name` varchar(255) NOT NULL COMMENT 'As Scopus gives it: Surname, Given names',
  `is_ksrct` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'The author gave a KSRCT affiliation on this paper',
  `employee_id` int DEFAULT NULL COMMENT 'Staff member credited, matched by Scopus Author ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journal_scopus_authors_position` (`journal_id`, `author_position`),
  KEY `idx_journal_scopus_authors_scopus_id` (`scopus_author_id`),
  KEY `idx_journal_scopus_authors_employee` (`employee_id`),
  CONSTRAINT `fk_journal_scopus_authors_journal` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_journal_scopus_authors_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- 3. Further Scopus Author IDs per staff member
-- ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `employee_scopus_ids` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `scopus_author_id` bigint unsigned NOT NULL,
  `source` enum('admin_sheet','self_claim') NOT NULL COMMENT 'Super admin bulk sheet, or the staff member confirming a suggested profile',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_scopus_ids_scopus` (`scopus_author_id`),
  KEY `idx_employee_scopus_ids_employee` (`employee_id`),
  CONSTRAINT `fk_employee_scopus_ids_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_employee_scopus_ids_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- 4. Import rows that created or updated a publication
-- ------------------------------------------------------------------

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_import_rows'
                   AND COLUMN_NAME = 'publication_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE journal_import_rows ADD COLUMN publication_id INT NULL COMMENT ''Paper imports: the publication matched at preview, or created on apply'' AFTER journal_option_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'journal_import_rows'
                  AND CONSTRAINT_NAME = 'fk_journal_import_rows_publication');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE journal_import_rows ADD CONSTRAINT fk_journal_import_rows_publication FOREIGN KEY (publication_id) REFERENCES journals (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE journal_import_rows DROP FOREIGN KEY fk_journal_import_rows_publication,
--   DROP COLUMN publication_id;
-- DROP TABLE IF EXISTS employee_scopus_ids;
-- DROP TABLE IF EXISTS journal_scopus_authors;
-- ALTER TABLE journals DROP FOREIGN KEY fk_journals_import_batch,
--   DROP INDEX idx_journals_doi, DROP INDEX idx_journals_scopus_id,
--   DROP COLUMN import_batch_id;
