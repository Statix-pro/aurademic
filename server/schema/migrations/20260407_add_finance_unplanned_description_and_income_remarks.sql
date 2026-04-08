-- ==================================================================
-- Add unplanned budget description and income remarks (idempotent)
-- ==================================================================

SET @db_name = DATABASE();

SET @has_unplanned_budget_description = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'unplanned_budget_description'
);

SET @has_income_remarks = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_income_rows'
    AND COLUMN_NAME = 'remarks'
);

SET @sql_add_unplanned_budget_description = IF(
  @has_unplanned_budget_description = 0,
  'ALTER TABLE finance_requests ADD COLUMN unplanned_budget_description VARCHAR(500) NULL AFTER unplanned_budget_amount',
  'SELECT 1'
);
PREPARE stmt_add_unplanned_budget_description FROM @sql_add_unplanned_budget_description;
EXECUTE stmt_add_unplanned_budget_description;
DEALLOCATE PREPARE stmt_add_unplanned_budget_description;

SET @sql_add_income_remarks = IF(
  @has_income_remarks = 0,
  'ALTER TABLE finance_income_rows ADD COLUMN remarks VARCHAR(500) NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt_add_income_remarks FROM @sql_add_income_remarks;
EXECUTE stmt_add_income_remarks;
DEALLOCATE PREPARE stmt_add_income_remarks;

