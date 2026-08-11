-- ==================================================================
-- Migration: mode-aware file-format CHECK on expenditure_bulk_neft_files
-- Date: 2026-08-10
--
-- Follow-up to 20260810_add_bulk_transaction_type_to_expenditure_bulk_neft_files.sql,
-- which is already applied in every environment and must not be edited.
--
-- That migration dropped chk_expenditure_bulk_neft_excel_name outright, because an
-- Excel-only rule rejects the scans and PDFs a DD upload carries. Dropping it left the
-- table with no format rule at all, so a NEFT / RTGS / UPI row can now store a .pdf if a
-- caller ever bypasses the client. This restores the guarantee in the only shape that
-- fits both modes:
--
--   DD                -> any format (the instrument is a scan, PDF or document)
--   NEFT / RTGS / UPI -> .xlsx or .xls only (built from the bank's Excel template)
--
-- Extension matching uses RIGHT() rather than REGEXP_LIKE: both are deterministic and
-- legal in a CHECK, but a regex literal has to survive two levels of backslash escaping
-- inside PREPARE, and a mis-escaped pattern silently matches nothing.
--
-- Safe to re-run: the constraint is only added when absent, and only when no existing row
-- violates it. Pre-existing violations are reported instead of failing the migration, so
-- one bad legacy row cannot block the rest of a deployment.
-- ==================================================================

SET @db_name = DATABASE();

-- ------------------------------------------------------------------
-- 1. Count rows the new rule would reject.
-- ------------------------------------------------------------------
SET @violating_rows = (
  SELECT COUNT(*)
  FROM expenditure_bulk_neft_files
  WHERE UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) <> 'DD'
    AND LOWER(RIGHT(COALESCE(original_name, ''), 5)) <> '.xlsx'
    AND LOWER(RIGHT(COALESCE(original_name, ''), 4)) <> '.xls'
);

SET @has_format_check = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_bulk_neft_files'
    AND CONSTRAINT_NAME = 'chk_expenditure_bulk_neft_file_format'
);

-- ------------------------------------------------------------------
-- 2. Add the constraint when it is absent and the data already complies.
-- ------------------------------------------------------------------
SET @sql_format_check = IF(
  @has_format_check = 0 AND @violating_rows = 0,
  "ALTER TABLE expenditure_bulk_neft_files
     ADD CONSTRAINT chk_expenditure_bulk_neft_file_format
     CHECK (
       UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) = 'DD'
       OR LOWER(RIGHT(COALESCE(original_name, ''), 5)) = '.xlsx'
       OR LOWER(RIGHT(COALESCE(original_name, ''), 4)) = '.xls'
     )",
  'SELECT 1'
);

PREPARE stmt_format_check FROM @sql_format_check;
EXECUTE stmt_format_check;
DEALLOCATE PREPARE stmt_format_check;

-- ------------------------------------------------------------------
-- 3. Report the outcome so a skipped constraint is never silent.
-- ------------------------------------------------------------------
SELECT
  CASE
    WHEN @has_format_check > 0 THEN 'Already applied: chk_expenditure_bulk_neft_file_format exists.'
    WHEN @violating_rows = 0 THEN 'Applied: chk_expenditure_bulk_neft_file_format added.'
    ELSE CONCAT(
      'SKIPPED: ',
      @violating_rows,
      ' non-DD row(s) hold a non-Excel file. Fix them with the query below, then re-run this migration.'
    )
  END AS migration_result;

-- Rows to inspect when the result above says SKIPPED. Either correct transaction_type to
-- 'DD' where the upload really is an instrument scan, or re-upload the Excel file:
--
--   SELECT id, expenditure_id, transaction_type, bank_code, original_name, uploaded_at
--     FROM expenditure_bulk_neft_files
--    WHERE UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) <> 'DD'
--      AND LOWER(RIGHT(COALESCE(original_name, ''), 5)) <> '.xlsx'
--      AND LOWER(RIGHT(COALESCE(original_name, ''), 4)) <> '.xls';

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- Dropping this constraint is unconditional and always safe — it only removes a rule:
--
-- ALTER TABLE expenditure_bulk_neft_files DROP CHECK chk_expenditure_bulk_neft_file_format;
--
-- Reverting the whole Bulk Transaction feature (this migration AND the one it follows) is
-- NOT unconditional. The pre-DD schema carried an Excel-only CHECK, so restoring it fails
-- with "Check constraint is violated" as soon as one DD upload exists, and dropping
-- transaction_type erases the only column that distinguishes those rows. Order matters:
--
--   -- a. Confirm what would be lost. Restoring the Excel-only rule is impossible while
--   --    these rows exist, because nothing else records that they were DD uploads.
--   SELECT COUNT(*) AS dd_rows
--     FROM expenditure_bulk_neft_files
--    WHERE UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) = 'DD';
--
--   -- b. If that count is zero, the plain revert below is safe.
--   -- If it is NOT zero, first archive those rows (they cannot satisfy the old rule):
--   CREATE TABLE IF NOT EXISTS expenditure_bulk_neft_files_dd_archive
--     LIKE expenditure_bulk_neft_files;
--   INSERT INTO expenditure_bulk_neft_files_dd_archive
--     SELECT * FROM expenditure_bulk_neft_files
--      WHERE UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) = 'DD';
--   DELETE FROM expenditure_bulk_neft_files
--    WHERE UPPER(TRIM(COALESCE(transaction_type, 'NEFT'))) = 'DD';
--
--   -- c. Now the columns and the old constraint can go back:
--   ALTER TABLE expenditure_bulk_neft_files DROP CHECK chk_expenditure_bulk_neft_file_format;
--   ALTER TABLE expenditure_bulk_neft_files DROP COLUMN bank_code;
--   ALTER TABLE expenditure_bulk_neft_files DROP COLUMN transaction_type;
--   ALTER TABLE expenditure_bulk_neft_files
--     ADD CONSTRAINT chk_expenditure_bulk_neft_excel_name
--     CHECK (regexp_like(lower(`original_name`), _utf8mb4'\\.(xlsx|xls)$'));
--
-- The archived rows keep the DD files reachable on disk; the uploads themselves are never
-- deleted by this procedure.
-- ==================================================================
