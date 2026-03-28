-- Migration: Rebuild Budget_annual as FY-wise beneficiary summary store
-- Date: 2026-03-25
-- Purpose:
--   1) Ensure Budget_annual has summary columns used by budget-summary page
--   2) Normalize Faculty/Staff into Department totals
--   3) Rebuild data from final approved proposals

SET @has_table := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
);

SET @has_proposed := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'proposed_total_amount'
);
SET @sql_add_proposed := IF(
  @has_table = 1 AND @has_proposed = 0,
  'ALTER TABLE Budget_annual ADD COLUMN proposed_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER entity_id',
  'SELECT 1'
);
PREPARE stmt_add_proposed FROM @sql_add_proposed;
EXECUTE stmt_add_proposed;
DEALLOCATE PREPARE stmt_add_proposed;

SET @has_approved := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'approved_total_amount'
);
SET @sql_add_approved := IF(
  @has_table = 1 AND @has_approved = 0,
  'ALTER TABLE Budget_annual ADD COLUMN approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER proposed_total_amount',
  'SELECT 1'
);
PREPARE stmt_add_approved FROM @sql_add_approved;
EXECUTE stmt_add_approved;
DEALLOCATE PREPARE stmt_add_approved;

SET @has_initial := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'initial_total_amount'
);
SET @sql_add_initial := IF(
  @has_table = 1 AND @has_initial = 0,
  'ALTER TABLE Budget_annual ADD COLUMN initial_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER approved_total_amount',
  'SELECT 1'
);
PREPARE stmt_add_initial FROM @sql_add_initial;
EXECUTE stmt_add_initial;
DEALLOCATE PREPARE stmt_add_initial;

SET @has_additional := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'additional_total_amount'
);
SET @sql_add_additional := IF(
  @has_table = 1 AND @has_additional = 0,
  'ALTER TABLE Budget_annual ADD COLUMN additional_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER initial_total_amount',
  'SELECT 1'
);
PREPARE stmt_add_additional FROM @sql_add_additional;
EXECUTE stmt_add_additional;
DEALLOCATE PREPARE stmt_add_additional;

SET @has_expenditure := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'expenditure_total_amount'
);
SET @sql_add_expenditure := IF(
  @has_table = 1 AND @has_expenditure = 0,
  'ALTER TABLE Budget_annual ADD COLUMN expenditure_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER additional_total_amount',
  'SELECT 1'
);
PREPARE stmt_add_expenditure FROM @sql_add_expenditure;
EXECUTE stmt_add_expenditure;
DEALLOCATE PREPARE stmt_add_expenditure;

SET @has_balance := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND COLUMN_NAME = 'balance_total_amount'
);
SET @sql_add_balance := IF(
  @has_table = 1 AND @has_balance = 0,
  'ALTER TABLE Budget_annual ADD COLUMN balance_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER expenditure_total_amount',
  'SELECT 1'
);
PREPARE stmt_add_balance FROM @sql_add_balance;
EXECUTE stmt_add_balance;
DEALLOCATE PREPARE stmt_add_balance;

SET @has_unique_scope := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Budget_annual'
    AND INDEX_NAME = 'uq_budget_annual_scope'
);
SET @sql_add_unique_scope := IF(
  @has_table = 1 AND @has_unique_scope = 0,
  'ALTER TABLE Budget_annual ADD UNIQUE KEY uq_budget_annual_scope (fiscal_year, beneficiary_type, department_id, entity_id)',
  'SELECT 1'
);
PREPARE stmt_add_unique_scope FROM @sql_add_unique_scope;
EXECUTE stmt_add_unique_scope;
DEALLOCATE PREPARE stmt_add_unique_scope;

DELETE FROM Budget_annual;

INSERT INTO Budget_annual (
  fiscal_year,
  beneficiary_type,
  beneficiary_entity_id,
  department_id,
  entity_id,
  proposed_total_amount,
  approved_total_amount,
  initial_total_amount,
  additional_total_amount,
  expenditure_total_amount,
  balance_total_amount,
  annual_total_amount
)
SELECT
  bp.fiscal_year,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN 'Department'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'centre' THEN 'Centre'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'cell' THEN 'Cell'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'club' THEN 'Club'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
    ELSE COALESCE(NULLIF(TRIM(bp.beneficiary_type), ''), 'Unknown')
  END AS beneficiary_type,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END AS beneficiary_entity_id,
  bp.department_id,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END AS entity_id,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS proposed_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS approved_total_amount,
  SUM(
    CASE
      WHEN bp.created_at <= CONCAT(bp.fiscal_year, '-02-01 23:59:59')
        THEN COALESCE(bp.approved_total_amount, bp.total_amount, 0)
      ELSE 0
    END
  ) AS initial_total_amount,
  SUM(
    CASE
      WHEN bp.created_at > CONCAT(bp.fiscal_year, '-02-01 23:59:59')
        THEN COALESCE(bp.approved_total_amount, bp.total_amount, 0)
      ELSE 0
    END
  ) AS additional_total_amount,
  0 AS expenditure_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS balance_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS annual_total_amount
FROM budget_proposals bp
WHERE bp.status IN ('principal_approved', 'completed')
GROUP BY
  bp.fiscal_year,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN 'Department'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'centre' THEN 'Centre'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'cell' THEN 'Cell'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'club' THEN 'Club'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
    ELSE COALESCE(NULLIF(TRIM(bp.beneficiary_type), ''), 'Unknown')
  END,
  bp.department_id,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END;
