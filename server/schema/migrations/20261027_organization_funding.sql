-- ==================================================================
-- Migration: an organization's funding -- Private or Public
-- Author: Maheshwaran A K
-- Date: 2026-10-27
--
-- `organizations.funding` is added: 'Private' or 'Public', set from a toggle on the
-- Organization directory form. NULL where unknown, as on every organization saved before
-- this -- the submitter sets it on their next edit. Nothing is backfilled.
--
-- Guarded, so running the file again changes nothing.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = @db_name
                   AND TABLE_NAME = 'organizations'
                   AND COLUMN_NAME = 'funding');
SET @sql = IF(@has_col = 0,
  'ALTER TABLE organizations ADD COLUMN funding ENUM(''Private'',''Public'') NULL DEFAULT NULL COMMENT ''How the organization is funded; NULL when unknown'' AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE organizations DROP COLUMN funding;
