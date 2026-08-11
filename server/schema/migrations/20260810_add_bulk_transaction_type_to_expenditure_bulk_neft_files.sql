-- ==================================================================
-- Bulk NEFT becomes "Bulk Transaction": the uploaded payout file can
-- now be NEFT / RTGS / UPI (Excel only) or DD (any file format), and
-- the Excel template differs per bank (Axis / DBS).
--
-- 1. transaction_type  - NEFT | RTGS | UPI | DD (defaults to NEFT so
--                        existing rows keep their current meaning).
-- 2. bank_code         - AXIS | DBS, the template the file was built
--                        from. NULL for rows uploaded before this.
-- 3. Drops the .xlsx/.xls CHECK on original_name, which would reject
--    DD uploads (scanned PDFs / images).
-- ==================================================================

SET @db_name = DATABASE();

SET @has_transaction_type = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_bulk_neft_files'
    AND COLUMN_NAME = 'transaction_type'
);

SET @sql_transaction_type = IF(
  @has_transaction_type = 0,
  "ALTER TABLE expenditure_bulk_neft_files ADD COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'NEFT' COMMENT 'Bulk transaction mode: NEFT, RTGS, UPI or DD' AFTER expenditure_id",
  'SELECT 1'
);

PREPARE stmt_transaction_type FROM @sql_transaction_type;
EXECUTE stmt_transaction_type;
DEALLOCATE PREPARE stmt_transaction_type;

SET @has_bank_code = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_bulk_neft_files'
    AND COLUMN_NAME = 'bank_code'
);

SET @sql_bank_code = IF(
  @has_bank_code = 0,
  "ALTER TABLE expenditure_bulk_neft_files ADD COLUMN bank_code VARCHAR(20) DEFAULT NULL COMMENT 'Bank template the file was prepared from (AXIS, DBS)' AFTER transaction_type",
  'SELECT 1'
);

PREPARE stmt_bank_code FROM @sql_bank_code;
EXECUTE stmt_bank_code;
DEALLOCATE PREPARE stmt_bank_code;

SET @has_excel_name_check = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_bulk_neft_files'
    AND CONSTRAINT_NAME = 'chk_expenditure_bulk_neft_excel_name'
);

SET @sql_excel_name_check = IF(
  @has_excel_name_check > 0,
  'ALTER TABLE expenditure_bulk_neft_files DROP CHECK chk_expenditure_bulk_neft_excel_name',
  'SELECT 1'
);

PREPARE stmt_excel_name_check FROM @sql_excel_name_check;
EXECUTE stmt_excel_name_check;
DEALLOCATE PREPARE stmt_excel_name_check;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- NOT a plain three-statement revert. Restoring the Excel-only CHECK fails with "Check
-- constraint is violated" once a single DD upload exists (its file is a scan or PDF), and
-- dropping transaction_type first erases the only column that identifies those rows — so
-- the failure is unrecoverable in that order.
--
-- The DD-safe procedure lives in the rollback section of:
--   20260810_enforce_mode_aware_bulk_transaction_file_check.sql
-- Follow it there; it archives the DD rows before restoring the old constraint.
