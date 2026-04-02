-- Migration: Add entity_id FK column to Budget_annual
-- Date: 2026-03-25
-- Purpose:
--   1) Add entity_id (FK to master_entities) for Centre/Cell/Club/Professional Body rows
--   2) Backfill entity_id from beneficiary_entity_id

SET @has_table := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
);

SET @has_entity_id_col := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'entity_id'
);

SET @sql_add_entity_id := IF(
  @has_table = 1 AND @has_entity_id_col = 0,
  'ALTER TABLE Budget_annual ADD COLUMN entity_id INT NULL AFTER department_id',
  'SELECT 1'
);
PREPARE stmt_add_entity_id FROM @sql_add_entity_id;
EXECUTE stmt_add_entity_id;
DEALLOCATE PREPARE stmt_add_entity_id;

SET @has_entity_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND INDEX_NAME = 'idx_budget_annual_entity_id'
);

SET @sql_add_entity_idx := IF(
  @has_table = 1 AND @has_entity_idx = 0,
  'ALTER TABLE Budget_annual ADD KEY idx_budget_annual_entity_id (entity_id)',
  'SELECT 1'
);
PREPARE stmt_add_entity_idx FROM @sql_add_entity_idx;
EXECUTE stmt_add_entity_idx;
DEALLOCATE PREPARE stmt_add_entity_idx;

SET @has_entity_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND CONSTRAINT_NAME = 'fk_budget_annual_entity_id'
);

SET @sql_add_entity_fk := IF(
  @has_table = 1 AND @has_entity_fk = 0,
  'ALTER TABLE Budget_annual ADD CONSTRAINT fk_budget_annual_entity_id FOREIGN KEY (entity_id) REFERENCES master_entities(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_entity_fk FROM @sql_add_entity_fk;
EXECUTE stmt_add_entity_fk;
DEALLOCATE PREPARE stmt_add_entity_fk;

UPDATE Budget_annual
SET entity_id = beneficiary_entity_id
WHERE entity_id IS NULL
  AND beneficiary_entity_id IS NOT NULL;
