-- Add is_topup flag to finance_budget_breakup so admin views can distinguish
-- rows that were added via a topup resubmission from the original approved rows.
ALTER TABLE finance_budget_breakup
  ADD COLUMN is_topup TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = row was added as part of a topup resubmission; 0 = original row'
  AFTER sort_order;
