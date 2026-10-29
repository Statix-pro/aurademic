-- ==================================================================
-- Migration: Financial Contribution and Budget Sharing rows may name a directory collaborator
-- Author: Maheshwaran A K
-- Date: 2026-10-29
--
-- A project collaborator picked from the Organization directory links to `organizations`,
-- not to `project_organizations`, so the two finance tables -- which offered only
-- `project_organizations` -- could not name it. `project_finance_rows` gains:
--
--   * `directory_organization_id` -> `organizations` -- the collaborator's directory entry.
--     The server accepts only an organization that is a collaborator on the same project, and
--     copies its name into `organization_name` on save.
--
-- `organization_id` (-> `project_organizations`) is unchanged: the college and the funding
-- agency are still named through it. Existing rows keep the new column NULL; nothing is
-- backfilled and no amount is touched. Deleting a directory record clears the link
-- (ON DELETE SET NULL) and leaves the copied name.
--
-- Guarded, so running the file again changes nothing.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_finance_rows'
                   AND COLUMN_NAME = 'directory_organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_finance_rows ADD COLUMN directory_organization_id INT NULL DEFAULT NULL COMMENT ''A collaborator picked from the Organization directory; NULL otherwise'' AFTER organization_name, ADD KEY idx_project_finance_rows_directory_org (directory_organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_finance_rows'
                  AND CONSTRAINT_NAME = 'fk_project_finance_rows_directory_org');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_finance_rows ADD CONSTRAINT fk_project_finance_rows_directory_org FOREIGN KEY (directory_organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE project_finance_rows DROP FOREIGN KEY fk_project_finance_rows_directory_org;
-- ALTER TABLE project_finance_rows DROP COLUMN directory_organization_id;
