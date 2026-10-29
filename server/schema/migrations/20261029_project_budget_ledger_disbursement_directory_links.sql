-- ==================================================================
-- Migration: Budget heads, ledger receipts and grant disbursements may name a directory collaborator
-- Author: Maheshwaran A K
-- Date: 2026-10-29
--
-- The companion of 20261029_project_finance_rows_directory_links.sql. A collaborator picked
-- from the Organization directory links to `organizations`, not to `project_organizations`,
-- so the other three party pickers on the Finance tab -- a budget head's contributing
-- organization, a receipt's contributor and a disbursement's releasing organization --
-- could not name it. Each table gains a link to `organizations` beside its existing one:
--
--   * project_budget_heads.contribution_directory_organization_id
--   * project_transactions.contribution_directory_organization_id
--   * project_grant_disbursements.directory_organization_id
--
-- The server accepts a collaborator of the same project, or a link the project already
-- holds, and copies the name into the existing name column on save. The
-- `project_organizations` links are unchanged. Existing rows keep the new columns NULL;
-- nothing is backfilled and no amount is touched. Deleting a directory record clears the
-- link (ON DELETE SET NULL) and leaves the copied name.
--
-- Guarded, so running the file again changes nothing.
-- ==================================================================

SET @db_name = DATABASE();

-- 1. project_budget_heads.contribution_directory_organization_id
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_budget_heads'
                   AND COLUMN_NAME = 'contribution_directory_organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_budget_heads ADD COLUMN contribution_directory_organization_id INT NULL DEFAULT NULL COMMENT ''A contributing collaborator picked from the Organization directory; NULL otherwise'' AFTER contribution_organization_name, ADD KEY idx_project_budget_heads_contribution_directory (contribution_directory_organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_budget_heads'
                  AND CONSTRAINT_NAME = 'fk_project_budget_heads_contribution_directory');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_budget_heads ADD CONSTRAINT fk_project_budget_heads_contribution_directory FOREIGN KEY (contribution_directory_organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. project_transactions.contribution_directory_organization_id
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_transactions'
                   AND COLUMN_NAME = 'contribution_directory_organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_transactions ADD COLUMN contribution_directory_organization_id INT NULL DEFAULT NULL COMMENT ''A contributing collaborator picked from the Organization directory; NULL otherwise'' AFTER contribution_organization_name, ADD KEY idx_project_transactions_contribution_directory (contribution_directory_organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_transactions'
                  AND CONSTRAINT_NAME = 'fk_project_transactions_contribution_directory');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_transactions ADD CONSTRAINT fk_project_transactions_contribution_directory FOREIGN KEY (contribution_directory_organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. project_grant_disbursements.directory_organization_id
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'project_grant_disbursements'
                   AND COLUMN_NAME = 'directory_organization_id');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE project_grant_disbursements ADD COLUMN directory_organization_id INT NULL DEFAULT NULL COMMENT ''A releasing collaborator picked from the Organization directory; NULL otherwise'' AFTER organization_name, ADD KEY idx_project_grant_disbursements_directory_org (directory_organization_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'project_grant_disbursements'
                  AND CONSTRAINT_NAME = 'fk_project_grant_disbursements_directory_org');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE project_grant_disbursements ADD CONSTRAINT fk_project_grant_disbursements_directory_org FOREIGN KEY (directory_organization_id) REFERENCES organizations (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE project_grant_disbursements DROP FOREIGN KEY fk_project_grant_disbursements_directory_org;
-- ALTER TABLE project_grant_disbursements DROP COLUMN directory_organization_id;
-- ALTER TABLE project_transactions DROP FOREIGN KEY fk_project_transactions_contribution_directory;
-- ALTER TABLE project_transactions DROP COLUMN contribution_directory_organization_id;
-- ALTER TABLE project_budget_heads DROP FOREIGN KEY fk_project_budget_heads_contribution_directory;
-- ALTER TABLE project_budget_heads DROP COLUMN contribution_directory_organization_id;
