-- ==================================================================
-- Let Expenditure requests reference bills already uploaded in the
-- linked Finance request instead of requiring a re-upload.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_source_finance_annexure_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_request_bills'
    AND COLUMN_NAME = 'source_finance_annexure_id'
);

SET @sql_source_finance_annexure_id = IF(
  @has_source_finance_annexure_id = 0,
  'ALTER TABLE expenditure_request_bills ADD COLUMN source_finance_annexure_id BIGINT UNSIGNED NULL AFTER payee_row_id',
  'SELECT 1'
);

PREPARE stmt_source_finance_annexure_id FROM @sql_source_finance_annexure_id;
EXECUTE stmt_source_finance_annexure_id;
DEALLOCATE PREPARE stmt_source_finance_annexure_id;

SET @has_fk_source_finance_annexure = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_request_bills'
    AND CONSTRAINT_NAME = 'fk_expenditure_request_bills_finance_annexure'
);

SET @sql_fk_source_finance_annexure = IF(
  @has_fk_source_finance_annexure = 0,
  'ALTER TABLE expenditure_request_bills ADD CONSTRAINT fk_expenditure_request_bills_finance_annexure FOREIGN KEY (source_finance_annexure_id) REFERENCES finance_request_annexures (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);

PREPARE stmt_fk_source_finance_annexure FROM @sql_fk_source_finance_annexure;
EXECUTE stmt_fk_source_finance_annexure;
DEALLOCATE PREPARE stmt_fk_source_finance_annexure;

SET @has_idx_source_finance_annexure = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_request_bills'
    AND INDEX_NAME = 'idx_expenditure_request_bills_finance_annexure'
);

SET @sql_idx_source_finance_annexure = IF(
  @has_idx_source_finance_annexure = 0,
  'ALTER TABLE expenditure_request_bills ADD INDEX idx_expenditure_request_bills_finance_annexure (source_finance_annexure_id)',
  'SELECT 1'
);

PREPARE stmt_idx_source_finance_annexure FROM @sql_idx_source_finance_annexure;
EXECUTE stmt_idx_source_finance_annexure;
DEALLOCATE PREPARE stmt_idx_source_finance_annexure;
