-- ==================================================================
-- Add unplanned budget provision fields to expenditure_requests
-- ==================================================================

SET @db_name = DATABASE();

SET @has_unplanned_enabled = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_budget_enabled'
);

SET @has_unplanned_amount = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_budget_amount'
);

SET @has_unplanned_description = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_budget_description'
);

SET @has_unplanned_head = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_budget_head'
);

SET @has_unplanned_sub_head = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_budget_sub_head'
);

SET @sql_enabled = IF(
  @has_unplanned_enabled = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_budget_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER balance_amount',
  'SELECT 1'
);
PREPARE stmt_enabled FROM @sql_enabled;
EXECUTE stmt_enabled;
DEALLOCATE PREPARE stmt_enabled;

SET @sql_amount = IF(
  @has_unplanned_amount = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_budget_amount DECIMAL(15,2) NULL AFTER unplanned_budget_enabled',
  'SELECT 1'
);
PREPARE stmt_amount FROM @sql_amount;
EXECUTE stmt_amount;
DEALLOCATE PREPARE stmt_amount;

SET @sql_head = IF(
  @has_unplanned_head = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_budget_head VARCHAR(255) NULL AFTER unplanned_budget_amount',
  'SELECT 1'
);
PREPARE stmt_head FROM @sql_head;
EXECUTE stmt_head;
DEALLOCATE PREPARE stmt_head;

SET @sql_sub_head = IF(
  @has_unplanned_sub_head = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_budget_sub_head VARCHAR(255) NULL AFTER unplanned_budget_head',
  'SELECT 1'
);
PREPARE stmt_sub_head FROM @sql_sub_head;
EXECUTE stmt_sub_head;
DEALLOCATE PREPARE stmt_sub_head;

SET @sql_description = IF(
  @has_unplanned_description = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_budget_description VARCHAR(500) NULL AFTER unplanned_budget_sub_head',
  'SELECT 1'
);
PREPARE stmt_description FROM @sql_description;
EXECUTE stmt_description;
DEALLOCATE PREPARE stmt_description;

UPDATE expenditure_requests
SET unplanned_budget_enabled = 0
WHERE unplanned_budget_enabled IS NULL;
