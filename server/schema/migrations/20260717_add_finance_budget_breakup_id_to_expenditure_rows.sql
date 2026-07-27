-- ============================================
-- Migration: Add finance_budget_breakup_id to expenditure row tables
-- Author: Maheshwaran A K
-- Date: 2026-07-17
-- ============================================
--
-- Description:
-- The expenditure budget-usage code (getFinanceRequestBudgetUsageByBreakup /
-- getApprovedBudgets and the insertAdvance/Settlement/ExpenditureRows writers)
-- now reads and writes finance_budget_breakup_id on expenditure_advance_rows,
-- expenditure_settlement_rows and expenditure_line_rows so usage can be tracked
-- per finance breakup instead of per budget line. Databases created from the
-- current legacy/07_expenditure.sql already have the column, but production DBs
-- provisioned before this feature do not — there the new SELECT/INSERT
-- statements fail with ER_BAD_FIELD_ERROR (e.g. GET /expenditure/budget/approved
-- returns 500). This migration adds the missing column, its index and FK.
--
-- Idempotent: each object is guarded against information_schema so the file is
-- safe to run on environments that already have the column (dev) and those that
-- do not (production).

-- ─── expenditure_advance_rows ─────────────────────────────────────────────────
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows'
    AND COLUMN_NAME = 'finance_budget_breakup_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE expenditure_advance_rows ADD COLUMN finance_budget_breakup_id INT DEFAULT NULL COMMENT ''FK to event budget breakup line source'' AFTER expenditure_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows'
    AND INDEX_NAME = 'idx_expenditure_advance_rows_finance_breakup');
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE expenditure_advance_rows ADD KEY idx_expenditure_advance_rows_finance_breakup (finance_budget_breakup_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows'
    AND CONSTRAINT_NAME = 'fk_expenditure_advance_rows_finance_breakup');
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE expenditure_advance_rows ADD CONSTRAINT fk_expenditure_advance_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── expenditure_settlement_rows ──────────────────────────────────────────────
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows'
    AND COLUMN_NAME = 'finance_budget_breakup_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE expenditure_settlement_rows ADD COLUMN finance_budget_breakup_id INT DEFAULT NULL COMMENT ''FK to event budget breakup line source'' AFTER expenditure_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows'
    AND INDEX_NAME = 'idx_expenditure_settlement_rows_finance_breakup');
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE expenditure_settlement_rows ADD KEY idx_expenditure_settlement_rows_finance_breakup (finance_budget_breakup_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows'
    AND CONSTRAINT_NAME = 'fk_expenditure_settlement_rows_finance_breakup');
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE expenditure_settlement_rows ADD CONSTRAINT fk_expenditure_settlement_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── expenditure_line_rows ────────────────────────────────────────────────────
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows'
    AND COLUMN_NAME = 'finance_budget_breakup_id');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE expenditure_line_rows ADD COLUMN finance_budget_breakup_id INT DEFAULT NULL AFTER expenditure_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows'
    AND INDEX_NAME = 'idx_expenditure_line_rows_finance_breakup');
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE expenditure_line_rows ADD KEY idx_expenditure_line_rows_finance_breakup (finance_budget_breakup_id)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows'
    AND CONSTRAINT_NAME = 'fk_expenditure_line_rows_finance_breakup');
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE expenditure_line_rows ADD CONSTRAINT fk_expenditure_line_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE expenditure_advance_rows    DROP FOREIGN KEY fk_expenditure_advance_rows_finance_breakup,    DROP COLUMN finance_budget_breakup_id;
-- ALTER TABLE expenditure_settlement_rows DROP FOREIGN KEY fk_expenditure_settlement_rows_finance_breakup, DROP COLUMN finance_budget_breakup_id;
-- ALTER TABLE expenditure_line_rows       DROP FOREIGN KEY fk_expenditure_line_rows_finance_breakup,       DROP COLUMN finance_budget_breakup_id;
