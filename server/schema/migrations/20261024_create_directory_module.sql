-- schema/migrations/20261024_create_directory_module.sql
-- Date: 2026-10-24
-- Description: Everything the Organization and Resource Person directories need, in one
--              file: their three tables, the directory.* permissions every role gets,
--              and the Directory Admin role that reviews submissions.
--
-- This single file replaces three drafts from the same unmerged PR (#83):
-- 20260804_create_directory_module.sql, 20261015_scope_organization_name_uniqueness_to_submitter.sql
-- and 20261024_create_directory_admin_role.sql. None of them reached main or production; a dev
-- database that ran any of them can run this file too.
--
-- Idempotent: tables use IF NOT EXISTS, index changes are guarded, and every insert is keyed
-- on a unique code, so re-running it changes nothing.
--
-- Table naming: the Events module already owns `resource_persons` and
-- `resource_person_professions`. The directory uses its own `directory_resource_persons` and
-- `directory_resource_person_professions` so the two modules stay independent, and its FK
-- names are unique because MySQL requires that per database.
--
-- How the API uses these tables:
--   * Records start Pending (is_active = 0) and go through the shared workflow engine
--     (one stage, `directory_admin`); approval sets is_active = 1, a reviewer's decision sets
--     updated_by, and an owner's edit clears it and resubmits.
--   * Approved records form the shared directory; Pending and Rejected ones are visible only
--     to their submitter and to reviewers.
--   * Both lists serve `date` as DATE(created_at) -- no separate column.

-- =====================================================
-- 1. ORGANIZATION DIRECTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `abbreviation` VARCHAR(100) DEFAULT NULL,
  -- Sent by the client on every save but no input renders it, so it always arrives as ''.
  -- VARCHAR (not YEAR/INT) so the empty string needs no special case. Retype once the form
  -- grows a real input for it.
  `establishment_year` VARCHAR(10) DEFAULT NULL,
  -- Labelled "Specialization" in the UI; `sector` is the payload key.
  `sector` VARCHAR(255) DEFAULT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Academic' COMMENT 'Academic, Industry, National Labs, Incubation, Start-up, Government',
  `tag` VARCHAR(100) NOT NULL DEFAULT 'General',
  `website` VARCHAR(512) DEFAULT NULL,
  `linked_in` VARCHAR(512) DEFAULT NULL,
  `address` VARCHAR(512) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  -- Free-text input in the client, not numeric-validated.
  `pin_code` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = approved into the shared directory',
  `workflow_state` JSON DEFAULT NULL COMMENT 'Shared workflow engine snapshot',
  `created_by` INT DEFAULT NULL,
  `updated_by` INT DEFAULT NULL COMMENT 'Reviewer of the last decision; cleared on resubmission',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Served to the client as the `date` field',
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Unique per submitter, not globally: two staff may each submit the same organization.
  -- The approval endpoint refuses to approve a name that is already approved, so the shared
  -- directory still holds one copy.
  UNIQUE KEY `uq_organizations_created_by_name` (`created_by`, `name`),
  KEY `idx_organizations_category` (`category`),
  KEY `idx_organizations_tag` (`tag`),
  KEY `idx_organizations_city` (`city`),
  KEY `idx_organizations_status` (`status`),
  KEY `idx_organizations_active` (`is_active`),
  KEY `idx_organizations_abbreviation` (`abbreviation`),
  CONSTRAINT `fk_organizations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_organizations_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- LEGACY: dev databases created from the first draft of this file have a global
-- `uq_organizations_name` instead of the per-submitter key above. Swap it; on any database
-- created from this version both statements are no-ops. Remove once no dev database predates
-- this file.
SET @legacy_drop_global_name_index = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'organizations'
        AND index_name = 'uq_organizations_name'
    ),
    'ALTER TABLE `organizations` DROP INDEX `uq_organizations_name`',
    'SELECT 1'
  )
);
PREPARE legacy_drop_global_name_index_stmt FROM @legacy_drop_global_name_index;
EXECUTE legacy_drop_global_name_index_stmt;
DEALLOCATE PREPARE legacy_drop_global_name_index_stmt;

SET @legacy_add_submitter_name_index = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'organizations'
        AND index_name = 'uq_organizations_created_by_name'
    ),
    'SELECT 1',
    'ALTER TABLE `organizations` ADD UNIQUE KEY `uq_organizations_created_by_name` (`created_by`, `name`)'
  )
);
PREPARE legacy_add_submitter_name_index_stmt FROM @legacy_add_submitter_name_index;
EXECUTE legacy_add_submitter_name_index_stmt;
DEALLOCATE PREPARE legacy_add_submitter_name_index_stmt;

-- =====================================================
-- 2. RESOURCE PERSON DIRECTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS `directory_resource_persons` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(20) NOT NULL DEFAULT 'Dr.' COMMENT 'Dr., Mr., Ms., Mrs., Prof.',
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  -- `${title} ${first_name} ${last_name}`, generated so it can never drift from its parts;
  -- the client's own `name` field is ignored on write.
  `name` VARCHAR(255) GENERATED ALWAYS AS (
    CONCAT_WS(' ', NULLIF(`title`, ''), `first_name`, `last_name`)
  ) STORED,
  `gender` ENUM('Male','Female','Others') NOT NULL DEFAULT 'Male',
  `dob` DATE DEFAULT NULL COMMENT 'Arrives as a string over multipart; empty is stored as NULL',
  `status` ENUM('In Service','Retired','Inactive') NOT NULL DEFAULT 'In Service',
  `category` VARCHAR(100) NOT NULL DEFAULT 'Academic' COMMENT 'Academic, Industry, Scientist, Administration, Incubation, Government, Entrepreneur, Alumni, Social Activist',
  `tag` VARCHAR(100) NOT NULL DEFAULT 'General',
  `specialization` VARCHAR(255) DEFAULT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `personal_email` VARCHAR(255) DEFAULT NULL,
  `official_email` VARCHAR(255) DEFAULT NULL,
  `linked_in` VARCHAR(512) DEFAULT NULL,

  -- File columns are written only from a file the server has just received (never from the
  -- request body) and point under /uploads/resource-persons/. The server accepts photos as
  -- JPG/PNG/WEBP/GIF and resumes as PDF/DOC/DOCX, each up to 5 MB; the form asks for JPG/PNG
  -- photos up to 2 MB. An owner can remove either file.
  `photo_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original client filename',
  `photo_path` VARCHAR(512) DEFAULT NULL COMMENT 'Public URL under /uploads/resource-persons',
  `photo_mime_type` VARCHAR(100) DEFAULT NULL,
  `photo_file_size` INT DEFAULT NULL,
  `resume_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original client filename',
  `resume_path` VARCHAR(512) DEFAULT NULL COMMENT 'Public URL under /uploads/resource-persons',
  `resume_mime_type` VARCHAR(100) DEFAULT NULL,
  `resume_file_size` INT DEFAULT NULL,

  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = approved into the shared directory',
  `workflow_state` JSON DEFAULT NULL COMMENT 'Shared workflow engine snapshot',
  `created_by` INT DEFAULT NULL,
  `updated_by` INT DEFAULT NULL COMMENT 'Reviewer of the last decision; cleared on resubmission',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Served to the client as the `date` field',
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_directory_resource_persons_name` (`name`),
  KEY `idx_directory_resource_persons_category` (`category`),
  KEY `idx_directory_resource_persons_tag` (`tag`),
  KEY `idx_directory_resource_persons_status` (`status`),
  KEY `idx_directory_resource_persons_active` (`is_active`),
  KEY `idx_directory_resource_persons_official_email` (`official_email`),
  KEY `idx_directory_resource_persons_mobile` (`mobile`),
  CONSTRAINT `fk_directory_resource_persons_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_directory_resource_persons_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One resource person has many profession/affiliation rows, kept in form order.
-- Named directory_* because the Events module owns `resource_person_professions`; reusing
-- that name made CREATE TABLE IF NOT EXISTS a silent no-op with the wrong FK in place.
CREATE TABLE IF NOT EXISTS `directory_resource_person_professions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `resource_person_id` INT NOT NULL,
  `designation` VARCHAR(255) DEFAULT NULL,
  `department` VARCHAR(255) DEFAULT NULL,
  `organization` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  -- Payload key is `orgLinkedIn`; the form labels it "Website".
  `org_linked_in` VARCHAR(512) DEFAULT NULL,
  `status` ENUM('Working','Relieved') NOT NULL DEFAULT 'Working',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_drp_professions_person` (`resource_person_id`),
  KEY `idx_drp_professions_sort` (`resource_person_id`,`sort_order`),
  KEY `idx_drp_professions_status` (`status`),
  KEY `idx_drp_professions_organization` (`organization`),
  CONSTRAINT `fk_drp_professions_person` FOREIGN KEY (`resource_person_id`) REFERENCES `directory_resource_persons` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. DIRECTORY ACCESS — every role
-- =====================================================
-- Directory-specific keys for the directory API only; no other master-data feature changes.
INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('directory', 'read', 'directory.read', 'View organization and resource-person directories', 1),
  ('directory', 'create', 'directory.create', 'Create organization and resource-person directory records', 1),
  ('directory', 'edit', 'directory.edit', 'Edit owned organization and resource-person directory records', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Every signed-in user may use the directories, so grant the keys to every role that exists
-- now. A base `user` role created later (first sign-in on a fresh database) gets them from
-- accessControlModel.ensureBaseUserRoleSeed. Nothing re-grants them after an administrator
-- revokes them.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.module_key = 'directory'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- =====================================================
-- 4. DIRECTORY ADMIN — reviews submissions
-- =====================================================
-- The workflow engine notifies, and lets act, whoever holds `<module>.workflow.<stage>`.
-- `directory_admin` holds both directories' review keys plus the directory.* keys. It is
-- deliberately not an admin role (is_admin_role = 0): an admin role opens all of /api/admin.
-- Assign it from Access Control; super admins may hold it too to receive the notifications.
INSERT INTO `roles` (`role_code`, `role_name`, `description`, `is_system`, `is_admin_role`)
VALUES (
  'directory_admin',
  'Directory Admin',
  'Reviews organization and resource-person directory submissions',
  1,
  0
)
ON DUPLICATE KEY UPDATE `role_code` = `role_code`;

INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('organization_directory_workflow', 'directory_admin', 'organization_directory.workflow.directory_admin',
   'Approve or reject organization directory submissions', 1),
  ('resource_person_directory_workflow', 'directory_admin', 'resource_person_directory.workflow.directory_admin',
   'Approve or reject resource-person directory submissions', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Review keys go to directory_admin only — never to every role, since holding one makes a
-- user an approver and a recipient of every directory submission.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p
  ON p.permission_key IN (
    'organization_directory.workflow.directory_admin',
    'resource_person_directory.workflow.directory_admin',
    'directory.read',
    'directory.create',
    'directory.edit'
  )
WHERE r.role_code = 'directory_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- =====================================================
-- ROLLBACK (kept commented for reference)
-- =====================================================
-- Only directory objects are dropped. `resource_persons` and `resource_person_professions`
-- belong to the Events module -- never drop them here.
-- DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.role_code = 'directory_admin';
-- DELETE FROM user_roles WHERE role_id = (SELECT id FROM roles WHERE role_code = 'directory_admin');
-- DELETE FROM roles WHERE role_code = 'directory_admin';
-- DELETE FROM role_permissions WHERE permission_id IN (
--   SELECT id FROM permissions
--   WHERE module_key IN ('directory', 'organization_directory_workflow', 'resource_person_directory_workflow')
-- );
-- DELETE FROM permissions
--   WHERE module_key IN ('directory', 'organization_directory_workflow', 'resource_person_directory_workflow');
-- DROP TABLE IF EXISTS `directory_resource_person_professions`;
-- DROP TABLE IF EXISTS `directory_resource_persons`;
-- DROP TABLE IF EXISTS `organizations`;
