-- ==================================================================
-- Add the primary (corresponding) investigator flag
--
-- `is_principal` follows the row order — the top row is the PI and the
-- rest are Co-PIs. `is_primary` is a separate, chosen flag: the one
-- investigator who corresponds about the project. The pre-redesign
-- project form carried both (see server/schema/legacy/03_projects.sql);
-- the redesign dropped `is_primary`, and this restores it.
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
  @has_is_primary = 0,
  'ALTER TABLE project_investigators ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT ''0'' COMMENT ''1 = primary (corresponding) investigator'' AFTER is_principal',
  'SELECT 1'
);

PREPARE stmt_is_primary FROM @sql_is_primary;
EXECUTE stmt_is_primary;
DEALLOCATE PREPARE stmt_is_primary;

-- Projects saved before this column existed have no chosen investigator, so
-- the Principal Investigator stands in until someone picks another.
UPDATE project_investigators pin
  JOIN (
    SELECT project_id
      FROM project_investigators
     GROUP BY project_id
    HAVING SUM(is_primary) = 0
  ) missing ON missing.project_id = pin.project_id
   SET pin.is_primary = 1
 WHERE pin.is_principal = 1;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE project_investigators DROP COLUMN is_primary;
