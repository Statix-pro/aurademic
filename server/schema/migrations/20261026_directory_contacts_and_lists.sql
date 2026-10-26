-- ==================================================================
-- Migration: directory contacts and the Directory-Admin Tag/Specialization lists
-- Author: Maheshwaran A K
-- Date: 2026-10-26
--
-- Three changes to the Organization and Resource Person directories, made together:
--
--   A. A resource person's official email moves onto their profession rows.
--      An official email belongs to a post at an organization, not to the person: an
--      individual institutional address stops working when they leave, and a designation
--      mailbox (hod.dept@, principal@) reaches whoever holds the post next. On the
--      profession row it sits next to the organization and the Working / Relieved status
--      that says whether it is still current.
--        A1. `directory_resource_person_professions.official_email` is added.
--        A2. Each person's `directory_resource_persons.official_email` is copied to one
--            profession row: the first Working row in form order, else the first row.
--            Skipped for a person who already has one on any profession row.
--        A3. A person with an official email and no profession rows gets one row holding
--            only that email (status Working, the form's default for a new row).
--
--   D. A profession row links to its organization by id.
--      The row named its organization only as text, so renaming the organization broke
--      the connection, and nothing could tell which of two same-named organizations
--      (names are unique per submitter only) was meant. `organization_id` now points at
--      the organization; the text column keeps the name for rows that match none (older
--      free text) and as the name shown if the organization is ever removed.
--        D1. `directory_resource_person_professions.organization_id` is added, with a
--            foreign key that sets it NULL if the organization row is deleted.
--        D2. Existing rows are linked by name: an Approved organization of that name
--            first, then one the resource person's own submitter created, then the
--            oldest. Rows whose name matches no organization stay unlinked.
--
--   B. Resource person Tag and Specializations are picked from lists.
--   C. Organization Tag and Specializations are picked from lists.
--      Both were free text, so one value arrived in several spellings. Each directory now
--      has its own lists, kept by its own Directory Admin (holders of
--      `<module>_directory.workflow.directory_admin`) on its Lists page; a user cannot type
--      a value of their own. A record has one Tag and any number of Specializations.
--        - `directory_<x>_options` holds both lists (`list_key` 'tag' or 'specialization').
--          Like `project_vocabulary_options`, a value is stored by name where it is used
--          and nothing references a row here by id, so renaming or retiring an entry
--          changes only what the form offers next.
--        - `directory_<x>_specializations` holds a record's picks, in the order chosen.
--        - Each list is seeded once, while empty, with 'General' (the server's default
--          Tag), the owner's starting Tags (2026-10-26; the same 13 in both directories --
--          the Directory Admin retires any that do not fit), and every distinct Tag and
--          Specialization already stored, so no record holds a value its list lacks.
--        - Each record's existing free-text Specialization becomes its one pick.
--
-- LEGACY, left in place and untouched; the app no longer reads or writes them. Drop them
-- in a later migration once production has been reconciled against the audit below:
--   directory_resource_persons.official_email, directory_resource_persons.specialization,
--   organizations.sector (the organization form's old Specialization).
--
-- Every step is guarded, so running the file twice is a no-op, and a second run never
-- brings back a list entry the Directory Admin has since deleted.
--
-- Read-only audit, run before and after:
--
--   SELECT COUNT(*) AS people,
--          SUM(COALESCE(official_email, '') <> '') AS with_official_email,
--          SUM(COALESCE(TRIM(specialization), '') <> '') AS with_specialization
--     FROM directory_resource_persons;
--   SELECT COUNT(*) AS organizations,
--          SUM(COALESCE(TRIM(sector), '') <> '') AS with_specialization
--     FROM organizations;
--
--   -- after only; each must equal the matching count above:
--   SELECT COUNT(DISTINCT resource_person_id) AS people_with_profession_email
--     FROM directory_resource_person_professions WHERE COALESCE(official_email, '') <> '';
--   SELECT COUNT(DISTINCT resource_person_id) AS people_with_pick
--     FROM directory_resource_person_specializations;
--   SELECT COUNT(DISTINCT organization_id) AS organizations_with_pick
--     FROM directory_organization_specializations;
--   -- rows naming an existing organization that are still unlinked; must be 0:
--   SELECT COUNT(*) AS unlinked FROM directory_resource_person_professions p
--    WHERE p.organization_id IS NULL
--      AND EXISTS (SELECT 1 FROM organizations o WHERE o.name = TRIM(p.organization));
-- ==================================================================

SET @db_name = DATABASE();

-- ==================================================================
-- A. Official email on the profession rows
-- ==================================================================

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'directory_resource_person_professions'
                   AND COLUMN_NAME = 'official_email');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE directory_resource_person_professions ADD COLUMN official_email VARCHAR(255) DEFAULT NULL COMMENT ''Official email for this post: individual or designation mailbox'' AFTER org_linked_in',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- D1. The organization link
-- ==================================================================

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'directory_resource_person_professions'
                   AND COLUMN_NAME = 'organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE directory_resource_person_professions ADD COLUMN organization_id INT NULL DEFAULT NULL COMMENT ''The organization this row names; NULL for free text that matches none'' AFTER department, ADD KEY idx_drp_professions_organization_id (organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'directory_resource_person_professions'
                  AND CONSTRAINT_NAME = 'fk_drp_professions_organization');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE directory_resource_person_professions ADD CONSTRAINT fk_drp_professions_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- B, C. The list tables
-- ==================================================================

CREATE TABLE IF NOT EXISTS `directory_resource_person_options` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `list_key` ENUM('tag','specialization') NOT NULL COMMENT 'Which list the entry belongs to',
  `name` VARCHAR(255) NOT NULL COMMENT 'The label -- what a resource person record stores',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Retired entries stay so records holding them still validate',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_directory_resource_person_options` (`list_key`,`name`),
  KEY `idx_directory_resource_person_options_active` (`list_key`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `directory_resource_person_specializations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `resource_person_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL COMMENT 'Entry name from directory_resource_person_options',
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_drp_specializations_person_name` (`resource_person_id`,`name`),
  KEY `idx_drp_specializations_name` (`name`),
  CONSTRAINT `fk_drp_specializations_person` FOREIGN KEY (`resource_person_id`)
    REFERENCES `directory_resource_persons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `directory_organization_options` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `list_key` ENUM('tag','specialization') NOT NULL COMMENT 'Which list the entry belongs to',
  `name` VARCHAR(255) NOT NULL COMMENT 'The label -- what an organization record stores',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Retired entries stay so records holding them still validate',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_directory_organization_options` (`list_key`,`name`),
  KEY `idx_directory_organization_options_active` (`list_key`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `directory_organization_specializations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `organization_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL COMMENT 'Entry name from directory_organization_options',
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_do_specializations_org_name` (`organization_id`,`name`),
  KEY `idx_do_specializations_name` (`name`),
  CONSTRAINT `fk_do_specializations_organization` FOREIGN KEY (`organization_id`)
    REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

START TRANSACTION;

-- ==================================================================
-- A2, A3. Copy each person's official email onto a profession row
-- ==================================================================

UPDATE directory_resource_person_professions target
JOIN directory_resource_persons rp ON rp.id = target.resource_person_id
JOIN (
  SELECT p.resource_person_id,
         SUBSTRING_INDEX(
           GROUP_CONCAT(p.id ORDER BY p.status = 'Working' DESC, p.sort_order, p.id),
           ',', 1) AS profession_id
    FROM directory_resource_person_professions p
   GROUP BY p.resource_person_id
) chosen ON chosen.profession_id = target.id
SET target.official_email = rp.official_email
WHERE COALESCE(rp.official_email, '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT resource_person_id FROM directory_resource_person_professions
       WHERE COALESCE(official_email, '') <> ''
    ) has_email
     WHERE has_email.resource_person_id = rp.id
  );

INSERT INTO directory_resource_person_professions
  (resource_person_id, official_email, status, sort_order)
SELECT rp.id, rp.official_email, 'Working', 0
  FROM directory_resource_persons rp
 WHERE COALESCE(rp.official_email, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM directory_resource_person_professions p
                    WHERE p.resource_person_id = rp.id);

-- ==================================================================
-- D2. Link existing profession rows to their organization by name
-- ==================================================================

UPDATE directory_resource_person_professions p
JOIN directory_resource_persons rp ON rp.id = p.resource_person_id
SET p.organization_id = (
  SELECT o.id FROM organizations o
   WHERE o.name = TRIM(p.organization)
   ORDER BY o.is_active DESC, (o.created_by <=> rp.created_by) DESC, o.id
   LIMIT 1)
WHERE p.organization_id IS NULL
  AND COALESCE(TRIM(p.organization), '') <> '';

-- ==================================================================
-- B. Seed the resource person lists (only while empty) and backfill picks
-- ==================================================================

SET @seeded = (SELECT COUNT(*) FROM `directory_resource_person_options`);

-- IGNORE: the unique key is case-insensitive, so 'general' and 'General' are one entry;
-- the first spelling met is kept, and the owner's spellings come first.
INSERT IGNORE INTO `directory_resource_person_options` (`list_key`, `name`)
SELECT seed.list_key, seed.name
  FROM (
    SELECT 0 AS priority, 'tag' AS list_key, 'General' AS name
    UNION ALL SELECT 0, 'tag', 'School'
    UNION ALL SELECT 0, 'tag', 'College'
    UNION ALL SELECT 0, 'tag', 'Research'
    UNION ALL SELECT 0, 'tag', 'Skilling'
    UNION ALL SELECT 0, 'tag', 'Accreditation'
    UNION ALL SELECT 0, 'tag', 'Higher Studies'
    UNION ALL SELECT 0, 'tag', 'Foreign Language'
    UNION ALL SELECT 0, 'tag', 'Construction'
    UNION ALL SELECT 0, 'tag', 'Manufacturing'
    UNION ALL SELECT 0, 'tag', 'IT Services'
    UNION ALL SELECT 0, 'tag', 'Stationery'
    UNION ALL SELECT 0, 'tag', 'Publisher'
    UNION ALL SELECT 0, 'tag', 'Funding'
    UNION ALL
    SELECT DISTINCT 1, 'tag', TRIM(tag) FROM directory_resource_persons
     WHERE COALESCE(TRIM(tag), '') <> ''
    UNION ALL
    SELECT DISTINCT 1, 'specialization', TRIM(specialization) FROM directory_resource_persons
     WHERE COALESCE(TRIM(specialization), '') <> ''
  ) seed
 WHERE @seeded = 0
 ORDER BY seed.priority;

INSERT INTO `directory_resource_person_specializations` (`resource_person_id`, `name`, `sort_order`)
SELECT rp.id, TRIM(rp.specialization), 0
  FROM directory_resource_persons rp
 WHERE COALESCE(TRIM(rp.specialization), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM directory_resource_person_specializations s
                    WHERE s.resource_person_id = rp.id);

-- ==================================================================
-- C. Seed the organization lists (only while empty) and backfill picks
-- ==================================================================

SET @seeded = (SELECT COUNT(*) FROM `directory_organization_options`);

INSERT IGNORE INTO `directory_organization_options` (`list_key`, `name`)
SELECT seed.list_key, seed.name
  FROM (
    SELECT 0 AS priority, 'tag' AS list_key, 'General' AS name
    UNION ALL SELECT 0, 'tag', 'School'
    UNION ALL SELECT 0, 'tag', 'College'
    UNION ALL SELECT 0, 'tag', 'Research'
    UNION ALL SELECT 0, 'tag', 'Skilling'
    UNION ALL SELECT 0, 'tag', 'Accreditation'
    UNION ALL SELECT 0, 'tag', 'Higher Studies'
    UNION ALL SELECT 0, 'tag', 'Foreign Language'
    UNION ALL SELECT 0, 'tag', 'Construction'
    UNION ALL SELECT 0, 'tag', 'Manufacturing'
    UNION ALL SELECT 0, 'tag', 'IT Services'
    UNION ALL SELECT 0, 'tag', 'Stationery'
    UNION ALL SELECT 0, 'tag', 'Publisher'
    UNION ALL SELECT 0, 'tag', 'Funding'
    UNION ALL
    SELECT DISTINCT 1, 'tag', TRIM(tag) FROM organizations
     WHERE COALESCE(TRIM(tag), '') <> ''
    UNION ALL
    SELECT DISTINCT 1, 'specialization', TRIM(sector) FROM organizations
     WHERE COALESCE(TRIM(sector), '') <> ''
  ) seed
 WHERE @seeded = 0
 ORDER BY seed.priority;

INSERT INTO `directory_organization_specializations` (`organization_id`, `name`, `sort_order`)
SELECT o.id, TRIM(o.sector), 0
  FROM organizations o
 WHERE COALESCE(TRIM(o.sector), '') <> ''
   AND NOT EXISTS (SELECT 1 FROM directory_organization_specializations s
                    WHERE s.organization_id = o.id);

COMMIT;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- The LEGACY columns were never changed, so they still hold every original value.
-- DROP TABLE IF EXISTS `directory_organization_specializations`;
-- DROP TABLE IF EXISTS `directory_organization_options`;
-- DROP TABLE IF EXISTS `directory_resource_person_specializations`;
-- DROP TABLE IF EXISTS `directory_resource_person_options`;
-- DELETE FROM directory_resource_person_professions
--  WHERE designation IS NULL AND department IS NULL AND organization IS NULL
--    AND city IS NULL AND state IS NULL AND country IS NULL AND org_linked_in IS NULL
--    AND official_email IS NOT NULL;
-- ALTER TABLE directory_resource_person_professions DROP COLUMN official_email;
-- ALTER TABLE directory_resource_person_professions
--   DROP FOREIGN KEY fk_drp_professions_organization, DROP COLUMN organization_id;
