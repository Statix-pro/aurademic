-- ==================================================================
-- Migration: let directory users suggest a Specialization for the Directory Admin to approve
-- Author: Maheshwaran A K
-- Date: 2026-10-28
--
-- `directory_options` gains a review state:
--   * `approval_status` -- every existing entry is 'Approved' (the admin added it). An entry a
--     user adds from the Specialization dropdown starts 'Pending'; the Directory Admin approves
--     or rejects it on the Directory Lists page.
--   * `suggested_by` -> `users` -- who suggested it. Only they are offered a Pending entry,
--     and they may save it on their own organization or person record; that record cannot be
--     approved until the entry is.
--   * `reviewed_by` -> `users`, `reviewed_at` -- the admin's decision.
--
-- Records still store a specialization by name, so nothing else changes. Deleting a user
-- clears the links (ON DELETE SET NULL) and keeps the entry.
--
-- Guarded, so running the file again changes nothing.
-- ==================================================================

SET @db_name = DATABASE();

-- 1. approval_status
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'directory_options'
                   AND COLUMN_NAME = 'approval_status');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE directory_options ADD COLUMN approval_status ENUM(''Approved'',''Pending'',''Rejected'') NOT NULL DEFAULT ''Approved'' COMMENT ''Pending until the Directory Admin reviews a user''''s suggestion'' AFTER is_active, ADD KEY idx_directory_options_review (list_key, approval_status)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. suggested_by, reviewed_by, reviewed_at
SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'directory_options'
                   AND COLUMN_NAME = 'suggested_by');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE directory_options ADD COLUMN suggested_by INT NULL DEFAULT NULL COMMENT ''The user who suggested the entry, or NULL when the admin added it'' AFTER approval_status, ADD COLUMN reviewed_by INT NULL DEFAULT NULL AFTER suggested_by, ADD COLUMN reviewed_at DATETIME NULL DEFAULT NULL AFTER reviewed_by',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'directory_options'
                  AND CONSTRAINT_NAME = 'fk_directory_options_suggested_by');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE directory_options ADD CONSTRAINT fk_directory_options_suggested_by FOREIGN KEY (suggested_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE TABLE_SCHEMA = @db_name
                  AND TABLE_NAME = 'directory_options'
                  AND CONSTRAINT_NAME = 'fk_directory_options_reviewed_by');
SET @sql = IF(@has_fk = 0,
  'ALTER TABLE directory_options ADD CONSTRAINT fk_directory_options_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =====================================================
-- ROLLBACK (kept commented for reference)
-- =====================================================
-- Suggestions that were never approved are not real list entries; remove them first, or
-- they would turn into active, approved entries once the column is gone.
-- DELETE FROM directory_options WHERE approval_status <> 'Approved';
-- ALTER TABLE directory_options DROP FOREIGN KEY fk_directory_options_reviewed_by;
-- ALTER TABLE directory_options DROP FOREIGN KEY fk_directory_options_suggested_by;
-- ALTER TABLE directory_options DROP KEY idx_directory_options_review;
-- ALTER TABLE directory_options DROP COLUMN reviewed_at, DROP COLUMN reviewed_by,
--   DROP COLUMN suggested_by, DROP COLUMN approval_status;
