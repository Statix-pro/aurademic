-- ============================================================
-- Add annexure storage columns to finance_requests (idempotent)
-- ============================================================

SET @db_name = DATABASE();

SET @has_annexure_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_type'
);

SET @has_annexure_file_name = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_file_name'
);

SET @has_annexure_storage_name = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_storage_name'
);

SET @has_annexure_file_path = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_file_path'
);

SET @has_annexure_mime_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_mime_type'
);

SET @has_annexure_file_size = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'annexure_file_size'
);

SET @sql_annexure_type = IF(
  @has_annexure_type = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_type VARCHAR(100) NULL AFTER enclosures',
  'SELECT 1'
);
PREPARE stmt_annexure_type FROM @sql_annexure_type;
EXECUTE stmt_annexure_type;
DEALLOCATE PREPARE stmt_annexure_type;

SET @sql_annexure_file_name = IF(
  @has_annexure_file_name = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_file_name VARCHAR(255) NULL AFTER annexure_type',
  'SELECT 1'
);
PREPARE stmt_annexure_file_name FROM @sql_annexure_file_name;
EXECUTE stmt_annexure_file_name;
DEALLOCATE PREPARE stmt_annexure_file_name;

SET @sql_annexure_storage_name = IF(
  @has_annexure_storage_name = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_storage_name VARCHAR(255) NULL AFTER annexure_file_name',
  'SELECT 1'
);
PREPARE stmt_annexure_storage_name FROM @sql_annexure_storage_name;
EXECUTE stmt_annexure_storage_name;
DEALLOCATE PREPARE stmt_annexure_storage_name;

SET @sql_annexure_file_path = IF(
  @has_annexure_file_path = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_file_path VARCHAR(512) NULL AFTER annexure_storage_name',
  'SELECT 1'
);
PREPARE stmt_annexure_file_path FROM @sql_annexure_file_path;
EXECUTE stmt_annexure_file_path;
DEALLOCATE PREPARE stmt_annexure_file_path;

SET @sql_annexure_mime_type = IF(
  @has_annexure_mime_type = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_mime_type VARCHAR(150) NULL AFTER annexure_file_path',
  'SELECT 1'
);
PREPARE stmt_annexure_mime_type FROM @sql_annexure_mime_type;
EXECUTE stmt_annexure_mime_type;
DEALLOCATE PREPARE stmt_annexure_mime_type;

SET @sql_annexure_file_size = IF(
  @has_annexure_file_size = 0,
  'ALTER TABLE finance_requests ADD COLUMN annexure_file_size BIGINT NULL AFTER annexure_mime_type',
  'SELECT 1'
);
PREPARE stmt_annexure_file_size FROM @sql_annexure_file_size;
EXECUTE stmt_annexure_file_size;
DEALLOCATE PREPARE stmt_annexure_file_size;

