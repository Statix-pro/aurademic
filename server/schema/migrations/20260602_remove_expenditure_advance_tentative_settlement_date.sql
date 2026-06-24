-- ==================================================================
-- Remove tentative settlement date from expenditure advance rows
-- ==================================================================

SET @db_name = DATABASE();

SET @has_tentative_settlement_date = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_advance_rows'
    AND COLUMN_NAME = 'tentative_settlement_date'
);

SET @sql_tentative_settlement_date = IF(
  @has_tentative_settlement_date > 0,
  'ALTER TABLE expenditure_advance_rows DROP COLUMN tentative_settlement_date',
  'SELECT 1'
);

PREPARE stmt_tentative_settlement_date FROM @sql_tentative_settlement_date;
EXECUTE stmt_tentative_settlement_date;
DEALLOCATE PREPARE stmt_tentative_settlement_date;
