-- ============================================================
-- Create finance_request_annexures table for multi-file storage
-- ============================================================

SET @db_name = DATABASE();

SET @has_table_finance_request_annexures = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_request_annexures'
);

SET @finance_request_id_type = (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

SET @sql_create_finance_request_annexures = IF(
  @has_table_finance_request_annexures = 0,
  CONCAT(
    'CREATE TABLE finance_request_annexures (',
    ' id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,',
    ' finance_id ', IFNULL(@finance_request_id_type, 'INT'), ' NOT NULL,',
    ' annexure_type VARCHAR(100) NULL,',
    ' original_name VARCHAR(255) NULL,',
    ' stored_name VARCHAR(255) NOT NULL,',
    ' file_path VARCHAR(512) NOT NULL,',
    ' mime_type VARCHAR(150) NULL,',
    ' file_size BIGINT NULL,',
    ' sort_order INT NOT NULL DEFAULT 0,',
    ' created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    ' PRIMARY KEY (id),',
    ' KEY idx_finance_request_annexures_finance_id (finance_id),',
    ' KEY idx_finance_request_annexures_sort (finance_id, sort_order, id),',
    ' CONSTRAINT fk_finance_request_annexures_finance_id',
    ' FOREIGN KEY (finance_id) REFERENCES finance_requests(id)',
    ' ON DELETE CASCADE',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
  ),
  'SELECT 1'
);
PREPARE stmt_create_finance_request_annexures FROM @sql_create_finance_request_annexures;
EXECUTE stmt_create_finance_request_annexures;
DEALLOCATE PREPARE stmt_create_finance_request_annexures;
