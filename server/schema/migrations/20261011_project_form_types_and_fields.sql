-- ============================================
-- Migration: Project types and the project form's new fields
-- Author: Maheshwaran A K
-- Date: 2026-10-11
-- ============================================

-- Description:
-- One change set to the project form, in four parts.
--
-- 1. Project types. Adding a project starts with a "Select Project Type"
--    dialog, the way adding a publication does: Research Project, Event,
--    Travel Grant or Fellowship. All four are grants from a funding
--    agency under a scheme, so they share the one form; what the form
--    asks then depends on the type.
--
--      research_projects.project_type  Which kind of grant the project is.
--                                      Changeable on the form afterwards.
--      project_schemes.project_type    The kind of grant a scheme funds. Its
--                                      category comes from that type's own
--                                      list, and the form offers only the
--                                      schemes of the project's type.
--      project_requests.project_type   The same, on an "Add Scheme" request,
--                                      so approving it files the scheme
--                                      under the right type. NULL on a
--                                      request for a funding agency.
--
-- 2. Classification fields on research_projects.
--
--      research_type      Proposal Details, for a Research Project: Basic,
--                         Applied, Experimental, Statistical or Not
--                         Applicable.
--      level              International or National, asked of an Event or
--                         Fellowship in place of research type.
--      funding_source     Call for Details: Central or State Government, a
--                         Public or Private Sector Industry, a Start-up, a
--                         Higher Education Institution, or Other. Recorded
--                         per project: the agency master's `category` is
--                         free text and does not separate central from
--                         state government or public from private industry.
--      grant_credited_to  Sanction Details' "Account": where the
--                         grant-in-aid is credited — PFMS, the
--                         institution's account, or an individual's.
--
-- 3. A facility's supplier, split into fields. A Facility-tab row recorded
--    its supplier as one free-text line (`supplier_details`). The form now
--    asks for each part on its own, so a mobile and an email can be
--    validated and a supplier found by name:
--
--      Supplier Details   supplier_name, supplier_address
--      Contact Details    contact_person, contact_designation,
--                         contact_mobile, contact_email
--
--    `supplier_details` is left in place but no longer written or read:
--    the project form was not in production use, so it holds no data to
--    carry over. Dropping it is left to a separate, explicit change.
--
-- Closed lists the form offers as fixed options are ENUMs; the server's
-- normalizer rejects anything outside them before the write.
--
-- Additive only. The two NOT NULL columns default to 'research_project',
-- which is what every existing project and scheme already is — the form
-- only recorded research projects before this change. Every other column
-- is nullable, so existing rows read as "not stated". No row, balance or
-- total is otherwise touched.
--
-- Each step is guarded, so a second run is a no-op. The steps run in this
-- order because `level` is placed after `research_type`.

-- ── 1. Project types ────────────────────────────────────────────────

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'project_type'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `project_type` enum(\'research_project\',\'event\',\'travel_grant\',\'fellowship\') NOT NULL DEFAULT \'research_project\'
       COMMENT \'Kind of grant, chosen when the project is added\'
     AFTER `driven_by`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_schemes'
     AND column_name = 'project_type'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_schemes`
     ADD COLUMN `project_type` enum(\'research_project\',\'event\',\'travel_grant\',\'fellowship\') NOT NULL DEFAULT \'research_project\'
       COMMENT \'Kind of grant the scheme funds; picks its category list\'
     AFTER `organization_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_requests'
     AND column_name = 'project_type'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_requests`
     ADD COLUMN `project_type` enum(\'research_project\',\'event\',\'travel_grant\',\'fellowship\') DEFAULT NULL
       COMMENT \'For a scheme request, the kind of grant; NULL for an agency\'
     AFTER `organization_name`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. Classification fields ────────────────────────────────────────

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'research_type'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `research_type` enum(\'basic\',\'applied\',\'experimental\',\'statistical\',\'not_applicable\') DEFAULT NULL
       COMMENT \'Proposal Details research type, NULL when not stated\'
     AFTER `duration_days`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'level'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `level` enum(\'international\',\'national\') DEFAULT NULL
       COMMENT \'Event or fellowship level, NULL for other project types\'
     AFTER `research_type`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'funding_source'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `funding_source` enum(\'central_government\',\'state_government\',\'public_sector_industry\',\'private_sector_industry\',\'startup\',\'higher_education\',\'other\') DEFAULT NULL
       COMMENT \'Call for Details funding source, NULL when not stated\'
     AFTER `funding_organization_id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'grant_credited_to'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `grant_credited_to` enum(\'pfms\',\'institution_account\',\'individual_account\') DEFAULT NULL
       COMMENT \'Where the grant-in-aid is credited, NULL when not stated\'
     AFTER `sanction_mode`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. Facility supplier fields ─────────────────────────────────────

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_facilities'
     AND column_name = 'supplier_name'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_facilities`
     ADD COLUMN `supplier_name` varchar(255) DEFAULT NULL AFTER `istem_id`,
     ADD COLUMN `supplier_address` varchar(500) DEFAULT NULL AFTER `supplier_name`,
     ADD COLUMN `contact_person` varchar(150) DEFAULT NULL COMMENT \'Contact at the supplier\' AFTER `supplier_address`,
     ADD COLUMN `contact_designation` varchar(150) DEFAULT NULL AFTER `contact_person`,
     ADD COLUMN `contact_mobile` varchar(20) DEFAULT NULL COMMENT \'Ten digits once normalized\' AFTER `contact_designation`,
     ADD COLUMN `contact_email` varchar(255) DEFAULT NULL AFTER `contact_mobile`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `project_facilities`
--   DROP COLUMN `contact_email`,
--   DROP COLUMN `contact_mobile`,
--   DROP COLUMN `contact_designation`,
--   DROP COLUMN `contact_person`,
--   DROP COLUMN `supplier_address`,
--   DROP COLUMN `supplier_name`;
-- ALTER TABLE `research_projects`
--   DROP COLUMN `grant_credited_to`,
--   DROP COLUMN `funding_source`,
--   DROP COLUMN `level`,
--   DROP COLUMN `research_type`,
--   DROP COLUMN `project_type`;
-- ALTER TABLE `project_requests` DROP COLUMN `project_type`;
-- ALTER TABLE `project_schemes` DROP COLUMN `project_type`;
