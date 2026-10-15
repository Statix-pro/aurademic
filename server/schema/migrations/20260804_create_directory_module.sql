-- schema/migrations/20260804_create_directory_module.sql
-- Date: 2026-08-04
-- Description: Tables backing the Organization Directory and Resource Person
--              Directory features added in PR #54, plus the directory.*
--              permission rows that authorize the directory API only.
--
-- Why this file exists: PR #54 shipped four new frontend files for these two
-- directories, but the accompanying migration
-- (20260711_create_workorder_tables.sql) covered only the work_order tables.
-- Both dashboards are genuinely API-backed -- each carries an explicit
-- "API Contract (backend must implement)" comment and falls back to an empty
-- list with "Could not reach the server" on failure, so today they render
-- permanently empty. Endpoints the client calls:
--
--   GET    /organizations           POST /organizations      PUT /organizations/:id
--   GET    /resource-persons        POST /resource-persons   PUT /resource-persons/:id
--
-- DELETE /organizations/:id and DELETE /resource-persons/:id are documented in
-- the client's contract comments but never called from any UI. Both tables get
-- is_active below so removal can be a soft delete when those are wired up.
--
-- Table naming: the Events module already owns `resource_persons` and
-- `resource_person_professions` (FK -> resource_persons). The directory
-- therefore uses its own tables, `directory_resource_persons` and
-- `directory_resource_person_professions`, so the two modules stay independent
-- and no existing Events data is touched. Foreign key names are also unique
-- (fk_drp_professions_person), since MySQL requires FK names to be unique
-- per database.
--
-- Serialization notes the backend must honour (from the client code):
--   * ResourcePerson is submitted as multipart/form-data and every non-file
--     value goes through String(val), so all scalars arrive as strings --
--     `dob` and any empty value arrive as '' and MUST be coerced to NULL
--     before insert, or strict mode rejects the DATE column.
--   * `professions` arrives as a single JSON.stringify'd field and must be
--     parsed into directory_resource_person_professions rows.
--   * Both interfaces read a server-generated `date` field. That is served as
--     DATE(created_at) -- no separate column, to avoid two sources of truth.

-- =====================================================
-- 1. ORGANIZATION DIRECTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `abbreviation` VARCHAR(100) DEFAULT NULL,
  -- Sent by the client on every save but NO input renders it, so it always
  -- arrives as ''. VARCHAR (not YEAR/INT) so the empty string does not have
  -- to be special-cased before the column exists to be populated.
  -- Remove or retype once the form grows a real input for it.
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
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Soft-delete flag for the not-yet-wired DELETE endpoint',
  `workflow_state` JSON DEFAULT NULL COMMENT 'Shared workflow engine snapshot',
  `created_by` INT DEFAULT NULL,
  `updated_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Served to the client as the `date` field',
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organizations_name` (`name`),
  KEY `idx_organizations_category` (`category`),
  KEY `idx_organizations_tag` (`tag`),
  KEY `idx_organizations_city` (`city`),
  KEY `idx_organizations_status` (`status`),
  KEY `idx_organizations_active` (`is_active`),
  KEY `idx_organizations_abbreviation` (`abbreviation`),
  CONSTRAINT `fk_organizations_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_organizations_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. RESOURCE PERSON DIRECTORY
-- =====================================================
CREATE TABLE IF NOT EXISTS `directory_resource_persons` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(20) NOT NULL DEFAULT 'Dr.' COMMENT 'Dr., Mr., Ms., Mrs., Prof.',
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  -- Denormalized `${title} ${first_name} ${last_name}`, computed client-side
  -- and sent as its own field. Generated here instead so the two can never
  -- drift; the client's value is ignored on write.
  `name` VARCHAR(255) GENERATED ALWAYS AS (
    CONCAT_WS(' ', NULLIF(`title`, ''), `first_name`, `last_name`)
  ) STORED,
  `gender` ENUM('Male','Female','Others') NOT NULL DEFAULT 'Male',
  `dob` DATE DEFAULT NULL COMMENT 'Arrives as a string over multipart; coerce empty to NULL',
  `status` ENUM('In Service','Retired','Inactive') NOT NULL DEFAULT 'In Service',
  `category` VARCHAR(100) NOT NULL DEFAULT 'Academic' COMMENT 'Academic, Industry, Scientist, Administration, Incubation, Government, Entrepreneur, Alumni, Social Activist',
  `tag` VARCHAR(100) NOT NULL DEFAULT 'General',
  `specialization` VARCHAR(255) DEFAULT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `personal_email` VARCHAR(255) DEFAULT NULL,
  `official_email` VARCHAR(255) DEFAULT NULL,
  `linked_in` VARCHAR(512) DEFAULT NULL,

  -- Photo: image/* accepted, .jpg/.jpeg/.png enforced, max 2 MB.
  -- Resume: .pdf/.doc/.docx, max 5 MB.
  -- Multipart parts are named `photoFile` / `resumeFile`; the original
  -- filenames also arrive as `photoName` / `resumeName`. Storage path is kept
  -- separate from the display name, following the finance annexure_* pattern.
  `photo_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original client filename',
  `photo_path` VARCHAR(512) DEFAULT NULL COMMENT 'Public URL under /uploads',
  `photo_mime_type` VARCHAR(100) DEFAULT NULL,
  `photo_file_size` INT DEFAULT NULL,
  `resume_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original client filename',
  `resume_path` VARCHAR(512) DEFAULT NULL COMMENT 'Public URL under /uploads',
  `resume_mime_type` VARCHAR(100) DEFAULT NULL,
  `resume_file_size` INT DEFAULT NULL,

  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Soft-delete flag for the not-yet-wired DELETE endpoint',
  `workflow_state` JSON DEFAULT NULL COMMENT 'Shared workflow engine snapshot',
  `created_by` INT DEFAULT NULL,
  `updated_by` INT DEFAULT NULL,
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

-- One resource person has many profession/affiliation rows. The dashboard
-- shows a "primary" one, picked as status='Working' then professions[0].
-- Named directory_* because the Events module already owns
-- `resource_person_professions` (FK -> resource_persons); reusing that name
-- made CREATE TABLE IF NOT EXISTS a silent no-op and left the wrong FK in place.
CREATE TABLE IF NOT EXISTS `directory_resource_person_professions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `resource_person_id` INT NOT NULL,
  `designation` VARCHAR(255) DEFAULT NULL,
  `department` VARCHAR(255) DEFAULT NULL,
  `organization` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  -- Payload key is `orgLinkedIn` but the UI labels it "Website" with a
  -- "Website URL" placeholder. Named for the payload key; the label is a
  -- client-side discrepancy worth reconciling there.
  `org_linked_in` VARCHAR(512) DEFAULT NULL,
  -- Only these two values are reachable from the form.
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
-- 3. PERMISSIONS
-- =====================================================
-- These directory-specific keys deliberately replace the generic master_data.*
-- grants for the two directory endpoints. They do not alter authorization for
-- any other master-data feature.
--
INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('directory', 'read', 'directory.read', 'View organization and resource-person directories', 1),
  ('directory', 'create', 'directory.create', 'Create organization and resource-person directory records', 1),
  ('directory', 'edit', 'directory.edit', 'Edit owned organization and resource-person directory records', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Directory pages are available to every authenticated user. Role assignments
-- may be global or contextual, so grant the directory keys to every role that
-- already exists; runtime base-role seeding also grants them to roles created
-- after this migration runs.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.module_key = 'directory'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- =====================================================
-- ROLLBACK (kept commented for reference)
-- =====================================================
-- Only directory objects are dropped. `resource_persons` and
-- `resource_person_professions` belong to the Events module -- never drop them here.
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module_key = 'directory');
-- DELETE FROM permissions WHERE module_key = 'directory';
-- DROP TABLE IF EXISTS `directory_resource_person_professions`;
-- DROP TABLE IF EXISTS `directory_resource_persons`;
-- DROP TABLE IF EXISTS `organizations`;
