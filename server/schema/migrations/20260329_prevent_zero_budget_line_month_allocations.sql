-- Migration: Prevent zero-value month allocations in budget_line_month_allocations
-- Date: 2026-03-29
-- Purpose:
--   1) Remove already-stored zero-value month allocations
--   2) Prevent future inserts/updates from storing zero amounts

SET SQL_SAFE_UPDATES = 0;
DELETE FROM budget_line_month_allocations
WHERE amount = 0.00;

SET @has_zero_default := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'budget_line_month_allocations'
    AND COLUMN_NAME = 'amount'
    AND COALESCE(COLUMN_DEFAULT, '') IN ('0', '0.00', '0.000000')
);

SET @sql_remove_zero_default := IF(
  @has_zero_default > 0,
  'ALTER TABLE budget_line_month_allocations MODIFY COLUMN amount DECIMAL(15,2) NOT NULL',
  'SELECT 1'
);
PREPARE stmt_remove_zero_default FROM @sql_remove_zero_default;
EXECUTE stmt_remove_zero_default;
DEALLOCATE PREPARE stmt_remove_zero_default;

SET @has_non_zero_check := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'budget_line_month_allocations'
    AND CONSTRAINT_TYPE = 'CHECK'
    AND CONSTRAINT_NAME = 'chk_budget_line_month_amount_non_zero'
);

SET @sql_add_non_zero_check := IF(
  @has_non_zero_check = 0,
  'ALTER TABLE budget_line_month_allocations ADD CONSTRAINT chk_budget_line_month_amount_non_zero CHECK (amount <> 0.00)',
  'SELECT 1'
);
PREPARE stmt_add_non_zero_check FROM @sql_add_non_zero_check;
EXECUTE stmt_add_non_zero_check;
DEALLOCATE PREPARE stmt_add_non_zero_check;
