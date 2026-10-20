-- ==================================================================
-- Drop the primary (corresponding) investigator flag
--
-- The project form used to carry two facts in one column of pills: the
-- PI, which followed the drag order, and a separately chosen
-- corresponding investigator (`is_primary`, added by
-- 20260829_add_is_primary_to_project_investigators.sql). Reading one
-- pill two ways confused everyone, so the form now does one thing: the
-- pill you pick is the PI. Nothing reads `is_primary` on this table any
-- more, so it goes.
--
-- Any project whose corresponding investigator was not the PI keeps the
-- PI it was saved with; only the second, unused flag is discarded.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_is_primary = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'project_investigators'
    AND COLUMN_NAME = 'is_primary'
);

SET @sql_is_primary = IF(
  @has_is_primary = 1,
  'ALTER TABLE project_investigators DROP COLUMN is_primary',
  'SELECT 1'
);

PREPARE stmt_is_primary FROM @sql_is_primary;
EXECUTE stmt_is_primary;
DEALLOCATE PREPARE stmt_is_primary;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE project_investigators
--   ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT '0'
--   COMMENT '1 = primary (corresponding) investigator' AFTER is_principal;
-- UPDATE project_investigators SET is_primary = is_principal;
