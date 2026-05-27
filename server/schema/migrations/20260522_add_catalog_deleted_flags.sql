-- ============================================
-- Migration: Add deleted flags to budget catalog
-- Author: Maheshwaran
-- Date: 2026-05-22
-- ============================================
-- Separates reversible active/inactive state from hidden/deleted state.
-- `is_active` stays as the user-facing toggle.
-- `is_deleted` hides catalog rows from the UI without using hard delete.
-- ============================================

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND COLUMN_NAME = 'is_deleted'), 'SELECT 1', 'ALTER TABLE `budget_heads` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND INDEX_NAME = 'idx_budget_head_deleted'), 'SELECT 1', 'ALTER TABLE `budget_heads` ADD INDEX `idx_budget_head_deleted` (`is_deleted`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'is_deleted'), 'SELECT 1', 'ALTER TABLE `budget_sub_heads` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND INDEX_NAME = 'idx_budget_sub_head_deleted'), 'SELECT 1', 'ALTER TABLE `budget_sub_heads` ADD INDEX `idx_budget_sub_head_deleted` (`is_deleted`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK
-- ============================================
-- ALTER TABLE budget_heads DROP INDEX idx_budget_head_deleted;
-- ALTER TABLE budget_heads DROP COLUMN is_deleted;
-- ALTER TABLE budget_sub_heads DROP INDEX idx_budget_sub_head_deleted;
-- ALTER TABLE budget_sub_heads DROP COLUMN is_deleted;
