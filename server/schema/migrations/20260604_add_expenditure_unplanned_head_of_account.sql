-- ==================================================================
-- Add Head of Accounts fields for unplanned expenditure deduction
-- ==================================================================

SET @db_name = DATABASE();

SET @has_unplanned_head_of_account = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account'
);

SET @has_unplanned_head_of_account_budget_line_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account_budget_line_id'
);

SET @has_unplanned_head_of_account_budget_proposal_id = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account_budget_proposal_id'
);

SET @sql_head_of_account = IF(
  @has_unplanned_head_of_account = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account VARCHAR(255) NULL AFTER unplanned_budget_amount',
  'SELECT 1'
);
PREPARE stmt_head_of_account FROM @sql_head_of_account;
EXECUTE stmt_head_of_account;
DEALLOCATE PREPARE stmt_head_of_account;

SET @sql_budget_line = IF(
  @has_unplanned_head_of_account_budget_line_id = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account_budget_line_id INT NULL AFTER unplanned_head_of_account',
  'SELECT 1'
);
PREPARE stmt_budget_line FROM @sql_budget_line;
EXECUTE stmt_budget_line;
DEALLOCATE PREPARE stmt_budget_line;

SET @sql_budget_proposal = IF(
  @has_unplanned_head_of_account_budget_proposal_id = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account_budget_proposal_id INT NULL AFTER unplanned_head_of_account_budget_line_id',
  'SELECT 1'
);
PREPARE stmt_budget_proposal FROM @sql_budget_proposal;
EXECUTE stmt_budget_proposal;
DEALLOCATE PREPARE stmt_budget_proposal;
