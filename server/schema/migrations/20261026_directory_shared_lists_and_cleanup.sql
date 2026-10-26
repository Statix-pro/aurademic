-- ==================================================================
-- Migration: shared directory lists, the official email's type, and the legacy cleanup
-- Author: Maheshwaran A K
-- Date: 2026-10-26
--
-- Follows 20261026_directory_contacts_and_lists.sql, which has already run on production;
-- changes to the directories made after it belong here, not in that file.
--
--   A. A resource person's official email says whose it is.
--        `directory_resource_person_professions.official_email_type` is added:
--        'personal' (the person's own address) or 'role' (a mailbox the post's next
--        holder reads, like membersecretary@). NULL where unknown, as on every email the
--        earlier migration copied onto profession rows -- the submitter sets it on their
--        next edit.
--
--   B. One Tag list and one Specialization list for both directories.
--      The earlier migration gave each directory its own lists, in
--      `directory_organization_options` and `directory_resource_person_options`. The
--      owner's decision (2026-10-26) is that both directories pick from the same two lists,
--      kept by either directory's Directory Admin or a super admin.
--        B1. `directory_options` is created, the same shape as the two per-directory tables.
--        B2. It is filled once, while empty, from both of them: one entry per (list, name).
--            Names compare under the column's collation (utf8mb4_unicode_ci: case and
--            accents ignored), the organization spelling is kept where the two differ, and
--            an entry is active if it is active in either directory, so neither form loses
--            an entry it offered before.
--      Records are untouched: they store a value by name, and every value either
--      directory's list held is now in the shared one.
--
--   C. What the directories no longer use is dropped (owner's decision, 2026-10-26: the
--      directories had no real use on production yet, so nothing is kept for history):
--        C1. `directory_organization_options` and `directory_resource_person_options`,
--            replaced by `directory_options` in B.
--        C2. `organizations.sector` and `directory_resource_persons.specialization`, whose
--            values the earlier migration copied into the specializations tables.
--        C3. `directory_resource_persons.official_email` (and its index), whose values the
--            earlier migration copied onto profession rows.
--      Each drop first checks that nothing would be lost -- every value is present where it
--      moved to -- and is skipped otherwise, printing a `skipped` row saying which. A
--      skipped item stays until someone reconciles it and runs the file again.
--
-- Idempotent: every column and table step checks what exists first, and the copy in B runs
-- only while `directory_options` is empty. Once filled it never empties again, as the
-- General Tag cannot be deleted (modules/shared/directoryLists.js).
--
-- Read-only audit. Before -- distinct names per list across the two old tables, which B
-- must reproduce, and the legacy values C would drop that are missing from where they
-- moved (each must be 0, or C keeps that item):
--
--   SELECT list_key, COUNT(DISTINCT name) AS distinct_names
--     FROM (SELECT list_key, name FROM directory_organization_options
--           UNION ALL
--           SELECT list_key, name FROM directory_resource_person_options) src
--    GROUP BY list_key;
--   SELECT COUNT(*) AS sector_not_moved FROM organizations o
--    WHERE COALESCE(TRIM(o.sector), '') <> ''
--      AND NOT EXISTS (SELECT 1 FROM directory_organization_specializations s
--                       WHERE s.organization_id = o.id AND s.name = TRIM(o.sector));
--   SELECT COUNT(*) AS specialization_not_moved FROM directory_resource_persons rp
--    WHERE COALESCE(TRIM(rp.specialization), '') <> ''
--      AND NOT EXISTS (SELECT 1 FROM directory_resource_person_specializations s
--                       WHERE s.resource_person_id = rp.id AND s.name = TRIM(rp.specialization));
--   SELECT COUNT(*) AS official_email_not_moved FROM directory_resource_persons rp
--    WHERE COALESCE(rp.official_email, '') <> ''
--      AND NOT EXISTS (SELECT 1 FROM directory_resource_person_professions p
--                       WHERE p.resource_person_id = rp.id AND p.official_email = rp.official_email);
--
-- After -- entries per list (must equal distinct_names above), and any Tag or
-- Specialization a record holds that the shared list lacks (must be 0):
--
--   SELECT list_key, COUNT(*) AS entries, SUM(is_active) AS active
--     FROM directory_options GROUP BY list_key;
--   SELECT COUNT(*) AS missing FROM (
--     SELECT 'tag' AS list_key, tag AS name FROM organizations
--     UNION SELECT 'tag', tag FROM directory_resource_persons
--     UNION SELECT 'specialization', name FROM directory_organization_specializations
--     UNION SELECT 'specialization', name FROM directory_resource_person_specializations
--   ) held
--    WHERE COALESCE(held.name, '') <> ''
--      AND NOT EXISTS (SELECT 1 FROM directory_options o
--                       WHERE o.list_key = held.list_key AND o.name = held.name);
-- ==================================================================

SET @db_name = DATABASE();

-- ==================================================================
-- A. Official email type
-- ==================================================================

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'directory_resource_person_professions'
                   AND COLUMN_NAME = 'official_email_type');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE directory_resource_person_professions ADD COLUMN official_email_type ENUM(''personal'',''role'') NULL DEFAULT NULL COMMENT ''Own address or a role mailbox the next post holder reads; NULL when unknown'' AFTER official_email',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- B. The shared list
-- ==================================================================

CREATE TABLE IF NOT EXISTS `directory_options` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `list_key` ENUM('tag','specialization') NOT NULL COMMENT 'Which list the entry belongs to',
  `name` VARCHAR(255) NOT NULL COMMENT 'The label -- what an organization or resource person record stores',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Retired entries stay so records holding them still validate',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_directory_options` (`list_key`,`name`),
  KEY `idx_directory_options_active` (`list_key`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

-- Copied only while directory_options is empty and both old lists still exist; C drops
-- them, so the statement is prepared rather than written out, or a second run would fail
-- on the missing tables.
SET @old_lists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_SCHEMA = @db_name
                     AND TABLE_NAME IN ('directory_organization_options',
                                        'directory_resource_person_options'));
SET @first_run = (SELECT COUNT(*) = 0 FROM `directory_options`);

-- Organization entries first, so theirs is the spelling kept; a later duplicate only turns
-- the kept entry active when its own copy is.
SET @sql = IF(@first_run = 1 AND @old_lists = 2,
  'INSERT INTO directory_options (list_key, name, is_active)
   SELECT src.list_key, src.name, src.is_active
     FROM (SELECT 0 AS source, id, list_key, name, is_active FROM directory_organization_options
           UNION ALL
           SELECT 1, id, list_key, name, is_active FROM directory_resource_person_options) src
    ORDER BY src.source, src.id
   ON DUPLICATE KEY UPDATE is_active = GREATEST(directory_options.is_active, VALUES(is_active))',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;

-- ==================================================================
-- C. Drop what is no longer used (DDL commits on its own, so this runs after the copy)
-- ==================================================================

-- C1. The per-directory lists: each is dropped only if every entry it holds is in
-- directory_options.
SET @has_table = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'directory_organization_options');
SET @sql = IF(@has_table = 1,
  'SELECT COUNT(*) INTO @not_moved FROM directory_organization_options src WHERE NOT EXISTS (SELECT 1 FROM directory_options o WHERE o.list_key = src.list_key AND o.name = src.name)',
  'SELECT 0 INTO @not_moved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@has_table = 0, 'SELECT 1',
  IF(@not_moved = 0, 'DROP TABLE directory_organization_options',
     'SELECT ''directory_organization_options kept: entries missing from directory_options'' AS skipped'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_table = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                   WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'directory_resource_person_options');
SET @sql = IF(@has_table = 1,
  'SELECT COUNT(*) INTO @not_moved FROM directory_resource_person_options src WHERE NOT EXISTS (SELECT 1 FROM directory_options o WHERE o.list_key = src.list_key AND o.name = src.name)',
  'SELECT 0 INTO @not_moved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@has_table = 0, 'SELECT 1',
  IF(@not_moved = 0, 'DROP TABLE directory_resource_person_options',
     'SELECT ''directory_resource_person_options kept: entries missing from directory_options'' AS skipped'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- C2. organizations.sector, once every value is a pick of its organization.
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'organizations'
                   AND COLUMN_NAME = 'sector');
SET @sql = IF(@has_col = 1,
  'SELECT COUNT(*) INTO @not_moved FROM organizations o WHERE COALESCE(TRIM(o.sector), '''') <> '''' AND NOT EXISTS (SELECT 1 FROM directory_organization_specializations s WHERE s.organization_id = o.id AND s.name = TRIM(o.sector))',
  'SELECT 0 INTO @not_moved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@has_col = 0, 'SELECT 1',
  IF(@not_moved = 0, 'ALTER TABLE organizations DROP COLUMN sector',
     'SELECT ''organizations.sector kept: values missing from the organization picks'' AS skipped'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- C2. directory_resource_persons.specialization, once every value is a pick of its person.
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'directory_resource_persons'
                   AND COLUMN_NAME = 'specialization');
SET @sql = IF(@has_col = 1,
  'SELECT COUNT(*) INTO @not_moved FROM directory_resource_persons rp WHERE COALESCE(TRIM(rp.specialization), '''') <> '''' AND NOT EXISTS (SELECT 1 FROM directory_resource_person_specializations s WHERE s.resource_person_id = rp.id AND s.name = TRIM(rp.specialization))',
  'SELECT 0 INTO @not_moved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@has_col = 0, 'SELECT 1',
  IF(@not_moved = 0, 'ALTER TABLE directory_resource_persons DROP COLUMN specialization',
     'SELECT ''directory_resource_persons.specialization kept: values missing from the person picks'' AS skipped'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- C3. directory_resource_persons.official_email, once every value is on one of the
-- person's profession rows. Dropping the column drops its index with it.
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'directory_resource_persons'
                   AND COLUMN_NAME = 'official_email');
SET @sql = IF(@has_col = 1,
  'SELECT COUNT(*) INTO @not_moved FROM directory_resource_persons rp WHERE COALESCE(rp.official_email, '''') <> '''' AND NOT EXISTS (SELECT 1 FROM directory_resource_person_professions p WHERE p.resource_person_id = rp.id AND p.official_email = rp.official_email)',
  'SELECT 0 INTO @not_moved');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(@has_col = 0, 'SELECT 1',
  IF(@not_moved = 0, 'ALTER TABLE directory_resource_persons DROP COLUMN official_email',
     'SELECT ''directory_resource_persons.official_email kept: emails not on a profession row'' AS skipped'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- C cannot be undone from this file: the dropped tables and columns are gone, though every
-- value they held is in directory_options, the specializations tables and the profession
-- rows. Restore them from the backup taken before the run if they are ever needed again.
-- DROP TABLE IF EXISTS `directory_options`;
-- ALTER TABLE directory_resource_person_professions DROP COLUMN official_email_type;
