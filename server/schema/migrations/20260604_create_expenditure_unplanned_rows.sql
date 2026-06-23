-- ==================================================================
-- Unplanned expenditure: Head of Accounts support
--   1. Head-of-account columns on expenditure_requests (single row + rollup)
--   2. expenditure_unplanned_rows table (multi-row storage)
-- Idempotent: safe to run more than once.
-- ==================================================================

SET @db_name = DATABASE();

-- 1) expenditure_requests.unplanned_head_of_account ------------------
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account VARCHAR(255) NULL AFTER unplanned_budget_amount',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) expenditure_requests.unplanned_head_of_account_budget_line_id ---
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account_budget_line_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account_budget_line_id INT NULL AFTER unplanned_head_of_account',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) expenditure_requests.unplanned_head_of_account_budget_proposal_id
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_requests'
    AND COLUMN_NAME = 'unplanned_head_of_account_budget_proposal_id'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE expenditure_requests ADD COLUMN unplanned_head_of_account_budget_proposal_id INT NULL AFTER unplanned_head_of_account_budget_line_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Multi-row unplanned storage table ------------------------------
CREATE TABLE IF NOT EXISTS expenditure_unplanned_rows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expenditure_id INT NOT NULL,
  head_of_account VARCHAR(255) NOT NULL,
  head_of_account_budget_line_id INT NOT NULL,
  head_of_account_budget_proposal_id INT NULL,
  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  description VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_expenditure_unplanned_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE,
  INDEX idx_expenditure_unplanned_rows_request (expenditure_id),
  INDEX idx_expenditure_unplanned_rows_head_line (head_of_account_budget_line_id),
  INDEX idx_expenditure_unplanned_rows_head_proposal (head_of_account_budget_proposal_id)
);
