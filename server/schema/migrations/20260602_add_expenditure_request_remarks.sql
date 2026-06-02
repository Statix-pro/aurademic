-- ==================================================================
-- Add optional user remarks for Settlement and Expenditure requests
-- ==================================================================

SET @db_name = DATABASE();

SET @has_settlement_remarks = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'settlement_remarks'
);

SET @sql_settlement_remarks = IF(
  @has_settlement_remarks = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN settlement_remarks VARCHAR(500) NULL AFTER expenditure_total_amount',
  'SELECT 1'
);

PREPARE stmt_settlement_remarks FROM @sql_settlement_remarks;
EXECUTE stmt_settlement_remarks;
DEALLOCATE PREPARE stmt_settlement_remarks;

SET @has_expenditure_remarks = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'expenditure_remarks'
);

SET @sql_expenditure_remarks = IF(
  @has_expenditure_remarks = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN expenditure_remarks VARCHAR(500) NULL AFTER settlement_remarks',
  'SELECT 1'
);

PREPARE stmt_expenditure_remarks FROM @sql_expenditure_remarks;
EXECUTE stmt_expenditure_remarks;
DEALLOCATE PREPARE stmt_expenditure_remarks;
