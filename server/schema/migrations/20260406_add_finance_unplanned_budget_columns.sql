-- ============================================================
-- Add unplanned budget columns to finance_requests (idempotent)
-- ============================================================

SET @db_name = DATABASE();

SET @has_unplanned_enabled = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'unplanned_budget_enabled'
);

SET @has_unplanned_amount = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'unplanned_budget_amount'
);

SET @sql_enabled = IF(
  @has_unplanned_enabled = 0,
  'ALTER TABLE finance_requests ADD COLUMN unplanned_budget_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER balance_amount',
  'SELECT 1'
);
PREPARE stmt_enabled FROM @sql_enabled;
EXECUTE stmt_enabled;
DEALLOCATE PREPARE stmt_enabled;

SET @sql_amount = IF(
  @has_unplanned_amount = 0,
  'ALTER TABLE finance_requests ADD COLUMN unplanned_budget_amount DECIMAL(15,2) NULL AFTER unplanned_budget_enabled',
  'SELECT 1'
);
PREPARE stmt_amount FROM @sql_amount;
EXECUTE stmt_amount;
DEALLOCATE PREPARE stmt_amount;

UPDATE finance_requests
SET unplanned_budget_enabled = 0
WHERE unplanned_budget_enabled IS NULL;

