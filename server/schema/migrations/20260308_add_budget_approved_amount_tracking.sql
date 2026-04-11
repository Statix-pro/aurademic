-- Migration: Add Approved Amount Tracking to Budget Tables
-- Date: 2026-03-08
-- Description:
--   Adds separate approved amount columns for budget lines and proposal totals.
--   Safe for partially migrated databases.

SET @schema_name := DATABASE();

-- 1) budget_proposal_lines.approved_unit_amount
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'budget_proposal_lines'
    AND COLUMN_NAME = 'approved_unit_amount'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE budget_proposal_lines ADD COLUMN approved_unit_amount DECIMAL(15,2) NULL COMMENT ''Approver-set unit amount (NULL = use unit_amount)'' AFTER unit_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) budget_proposal_lines.approved_line_total
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'budget_proposal_lines'
    AND COLUMN_NAME = 'approved_line_total'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE budget_proposal_lines ADD COLUMN approved_line_total DECIMAL(15,2) NULL COMMENT ''approved_unit_amount * quantity'' AFTER line_total',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) budget_proposal_lines.updated_at
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'budget_proposal_lines'
    AND COLUMN_NAME = 'updated_at'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE budget_proposal_lines ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed existing line values
UPDATE budget_proposal_lines
SET
  approved_unit_amount = COALESCE(approved_unit_amount, unit_amount),
  approved_line_total = COALESCE(approved_line_total, line_total);

-- 4) budget_proposals.approved_total_amount
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'budget_proposals'
    AND COLUMN_NAME = 'approved_total_amount'
);
SET @sql := IF(
  @has_col = 0,
  'ALTER TABLE budget_proposals ADD COLUMN approved_total_amount DECIMAL(15,2) NULL COMMENT ''Sum of approved_line_total across all lines'' AFTER total_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Seed/re-seed totals based on approved line totals
UPDATE budget_proposals bp
SET bp.approved_total_amount = (
  SELECT COALESCE(SUM(COALESCE(bpl.approved_line_total, bpl.line_total)), 0)
  FROM budget_proposal_lines bpl
  WHERE bpl.budget_proposal_id = bp.id
);

-- Enforce final shape
UPDATE budget_proposals
SET approved_total_amount = 0.00
WHERE approved_total_amount IS NULL;

ALTER TABLE budget_proposals
  MODIFY COLUMN approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00
    COMMENT 'Sum of approved_line_total across all lines';
