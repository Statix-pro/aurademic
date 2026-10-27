-- ==================================================================
-- Migration: link a project collaborator to the Organization and Resource Person directories
-- Author: Maheshwaran A K
-- Date: 2026-10-27
--
-- `project_collaborators` gains two nullable links:
--   * `directory_organization_id` -> `organizations` (the Organization directory). Picked on
--     the project form; the server then copies the organization's name and city into the
--     row, and the form locks City.
--   * `directory_resource_person_id` -> `directory_resource_persons`. Picked from the Name
--     field; the server copies the person's name and designation into the row. Their email
--     is never copied: the directory keeps a resource person's contacts private to whoever
--     added the record, so a linked row stores contact_email as NULL and the project only
--     says that the directory has one.
--
-- `organization_id` (-> `project_organizations`, which the finance tables use) is unchanged
-- and still matched by name. Existing rows keep both new columns NULL -- they stay free
-- text until someone picks from the directory. Deleting a directory record clears the
-- link (ON DELETE SET NULL) and leaves the copied text.
--
-- Guarded, so running the file again changes nothing.
-- ==================================================================

SET @db_name = DATABASE();

-- 1. directory_organization_id
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_collaborators'
                   AND COLUMN_NAME = 'directory_organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_collaborators ADD COLUMN directory_organization_id INT NULL DEFAULT NULL COMMENT ''The Organization directory entry picked; NULL for free text'' AFTER organization_name, ADD KEY idx_project_collaborators_directory_org (directory_organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_collaborators'
                  AND CONSTRAINT_NAME = 'fk_project_collaborators_directory_org');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_collaborators ADD CONSTRAINT fk_project_collaborators_directory_org FOREIGN KEY (directory_organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. directory_resource_person_id
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_collaborators'
                   AND COLUMN_NAME = 'directory_resource_person_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_collaborators ADD COLUMN directory_resource_person_id INT NULL DEFAULT NULL COMMENT ''The Resource Person directory entry picked; NULL for free text'' AFTER has_active_mou, ADD KEY idx_project_collaborators_directory_rp (directory_resource_person_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_collaborators'
                  AND CONSTRAINT_NAME = 'fk_project_collaborators_directory_rp');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_collaborators ADD CONSTRAINT fk_project_collaborators_directory_rp FOREIGN KEY (directory_resource_person_id) REFERENCES directory_resource_persons (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE project_collaborators
--   DROP FOREIGN KEY fk_project_collaborators_directory_rp,
--   DROP FOREIGN KEY fk_project_collaborators_directory_org;
-- ALTER TABLE project_collaborators
--   DROP COLUMN directory_resource_person_id,
--   DROP COLUMN directory_organization_id;
