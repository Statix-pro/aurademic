-- ============================================
-- DOWN Migration: Revert budget catalog feature
-- Author: Maheshwaran
-- Date: 2026-05-25
-- ============================================
-- Reverses, in reverse dependency order, all schema changes introduced by:
--   20260520_create_budget_catalog.sql
--   20260520_seed_budget_catalog.sql
--   20260521_add_catalog_refs_to_workflow_tables.sql
--   20260521_add_expenditure_file_category.sql
--   20260522_add_catalog_deleted_flags.sql
--
-- Properties:
--   * Idempotent — every DDL is guarded by an INFORMATION_SCHEMA EXISTS
--     check, so partial-down states are safe to re-run.
--   * Non-destructive to legacy data — only DROPs columns/indexes/tables
--     added by the feature. Snapshot text columns (budget_head, sub_head,
--     primary_head, event_sub_head) are untouched.
--   * Drops indexes BEFORE the columns they cover, and drops the unique key
--     on the generated identity tuple BEFORE the generated columns themselves
--     (MySQL rejects column DROP while a key still references it).
-- ============================================

-- ============================================
-- 1. Reverse 20260522_add_catalog_deleted_flags.sql
-- ============================================
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND INDEX_NAME = 'idx_budget_sub_head_deleted'), 'ALTER TABLE `budget_sub_heads` DROP INDEX `idx_budget_sub_head_deleted`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'is_deleted'), 'ALTER TABLE `budget_sub_heads` DROP COLUMN `is_deleted`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND INDEX_NAME = 'idx_budget_head_deleted'), 'ALTER TABLE `budget_heads` DROP INDEX `idx_budget_head_deleted`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND COLUMN_NAME = 'is_deleted'), 'ALTER TABLE `budget_heads` DROP COLUMN `is_deleted`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 2. Reverse 20260521_add_expenditure_file_category.sql
-- ============================================
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_request_bills' AND INDEX_NAME = 'idx_expenditure_request_bills_category'), 'ALTER TABLE `expenditure_request_bills` DROP INDEX `idx_expenditure_request_bills_category`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_request_bills' AND COLUMN_NAME = 'file_category'), 'ALTER TABLE `expenditure_request_bills` DROP COLUMN `file_category`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 3. Reverse 20260521_add_catalog_refs_to_workflow_tables.sql
-- 3a. Workflow tables: drop indexes then nullable FK columns
-- ============================================

-- budget_proposal_lines
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND INDEX_NAME = 'idx_bpl_subhead_id'), 'ALTER TABLE `budget_proposal_lines` DROP INDEX `idx_bpl_subhead_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND INDEX_NAME = 'idx_bpl_head_id'), 'ALTER TABLE `budget_proposal_lines` DROP INDEX `idx_bpl_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND COLUMN_NAME = 'budget_sub_head_id'), 'ALTER TABLE `budget_proposal_lines` DROP COLUMN `budget_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND COLUMN_NAME = 'budget_head_id'), 'ALTER TABLE `budget_proposal_lines` DROP COLUMN `budget_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- finance_requests
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND INDEX_NAME = 'idx_fr_event_sub_head_id'), 'ALTER TABLE `finance_requests` DROP INDEX `idx_fr_event_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND INDEX_NAME = 'idx_fr_primary_head_id'), 'ALTER TABLE `finance_requests` DROP INDEX `idx_fr_primary_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND COLUMN_NAME = 'event_sub_head_id'), 'ALTER TABLE `finance_requests` DROP COLUMN `event_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND COLUMN_NAME = 'primary_head_id'), 'ALTER TABLE `finance_requests` DROP COLUMN `primary_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- finance_budget_breakup
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND INDEX_NAME = 'idx_fbb_subhead_id'), 'ALTER TABLE `finance_budget_breakup` DROP INDEX `idx_fbb_subhead_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND INDEX_NAME = 'idx_fbb_head_id'), 'ALTER TABLE `finance_budget_breakup` DROP INDEX `idx_fbb_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND COLUMN_NAME = 'budget_sub_head_id'), 'ALTER TABLE `finance_budget_breakup` DROP COLUMN `budget_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND COLUMN_NAME = 'budget_head_id'), 'ALTER TABLE `finance_budget_breakup` DROP COLUMN `budget_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenditure_requests
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND INDEX_NAME = 'idx_er_event_sub_head_id'), 'ALTER TABLE `expenditure_requests` DROP INDEX `idx_er_event_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND INDEX_NAME = 'idx_er_primary_head_id'), 'ALTER TABLE `expenditure_requests` DROP INDEX `idx_er_primary_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND COLUMN_NAME = 'event_sub_head_id'), 'ALTER TABLE `expenditure_requests` DROP COLUMN `event_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND COLUMN_NAME = 'primary_head_id'), 'ALTER TABLE `expenditure_requests` DROP COLUMN `primary_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenditure_advance_rows
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND INDEX_NAME = 'idx_ear_subhead_id'), 'ALTER TABLE `expenditure_advance_rows` DROP INDEX `idx_ear_subhead_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND INDEX_NAME = 'idx_ear_head_id'), 'ALTER TABLE `expenditure_advance_rows` DROP INDEX `idx_ear_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'ALTER TABLE `expenditure_advance_rows` DROP COLUMN `budget_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND COLUMN_NAME = 'budget_head_id'), 'ALTER TABLE `expenditure_advance_rows` DROP COLUMN `budget_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenditure_settlement_rows
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND INDEX_NAME = 'idx_esr_subhead_id'), 'ALTER TABLE `expenditure_settlement_rows` DROP INDEX `idx_esr_subhead_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND INDEX_NAME = 'idx_esr_head_id'), 'ALTER TABLE `expenditure_settlement_rows` DROP INDEX `idx_esr_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'ALTER TABLE `expenditure_settlement_rows` DROP COLUMN `budget_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND COLUMN_NAME = 'budget_head_id'), 'ALTER TABLE `expenditure_settlement_rows` DROP COLUMN `budget_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- expenditure_line_rows
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND INDEX_NAME = 'idx_elr_subhead_id'), 'ALTER TABLE `expenditure_line_rows` DROP INDEX `idx_elr_subhead_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND INDEX_NAME = 'idx_elr_head_id'), 'ALTER TABLE `expenditure_line_rows` DROP INDEX `idx_elr_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'ALTER TABLE `expenditure_line_rows` DROP COLUMN `budget_sub_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND COLUMN_NAME = 'budget_head_id'), 'ALTER TABLE `expenditure_line_rows` DROP COLUMN `budget_head_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 3b. Catalog extras added by 20260521 (code, generated identity columns)
-- Order: drop unique key on identity tuple BEFORE generated columns,
-- otherwise MySQL refuses to drop columns referenced by a key.
-- ============================================
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND INDEX_NAME = 'uniq_budget_subhead_identity'), 'ALTER TABLE `budget_sub_heads` DROP INDEX `uniq_budget_subhead_identity`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'group_label_key'), 'ALTER TABLE `budget_sub_heads` DROP COLUMN `group_label_key`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'event_type_key'), 'ALTER TABLE `budget_sub_heads` DROP COLUMN `event_type_key`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'head_identity_id'), 'ALTER TABLE `budget_sub_heads` DROP COLUMN `head_identity_id`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND INDEX_NAME = 'idx_budget_sub_heads_code'), 'ALTER TABLE `budget_sub_heads` DROP INDEX `idx_budget_sub_heads_code`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'code'), 'ALTER TABLE `budget_sub_heads` DROP COLUMN `code`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND INDEX_NAME = 'uniq_budget_heads_code'), 'ALTER TABLE `budget_heads` DROP INDEX `uniq_budget_heads_code`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND COLUMN_NAME = 'code'), 'ALTER TABLE `budget_heads` DROP COLUMN `code`', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 4. Reverse 20260520_seed_budget_catalog.sql + 20260520_create_budget_catalog.sql
-- Seed data lives only in these two tables; dropping the tables drops the seed.
-- Order: child (sub_heads, has FK to heads) before parent (heads).
-- SET FOREIGN_KEY_CHECKS=0 belt-and-braces in case any future FK from a
-- workflow table was added — current schema has none, so it's a no-op safety net.
-- ============================================
SET @fk_was = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `budget_sub_heads`;
DROP TABLE IF EXISTS `budget_heads`;

SET FOREIGN_KEY_CHECKS = @fk_was;

-- ============================================
-- Post-revert verification (run manually):
--   SHOW TABLES LIKE 'budget_%heads';   -- expect 0 rows
--   SHOW CREATE TABLE budget_proposal_lines\G   -- expect no *_head_id columns
--   SHOW CREATE TABLE finance_requests\G        -- expect no *_head_id columns
--   SHOW CREATE TABLE expenditure_request_bills\G -- expect no file_category
--   SELECT COUNT(*) FROM budget_proposal_lines;   -- compare with pre-migration count
--   SELECT COUNT(*) FROM finance_requests;        -- compare with pre-migration count
--   SELECT COUNT(*) FROM expenditure_requests;    -- compare with pre-migration count
-- ============================================
