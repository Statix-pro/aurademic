-- ============================================
-- Migration: Add soft-delete flag to budget_tags
-- Date: 2026-05-25
-- ============================================

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_tags' AND COLUMN_NAME = 'is_deleted'), 'SELECT 1', 'ALTER TABLE `budget_tags` ADD COLUMN `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_tags' AND INDEX_NAME = 'idx_budget_tags_deleted'), 'SELECT 1', 'ALTER TABLE `budget_tags` ADD INDEX `idx_budget_tags_deleted` (`is_deleted`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

