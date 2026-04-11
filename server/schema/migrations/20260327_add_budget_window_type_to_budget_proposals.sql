-- Add canonical proposal window type (initial/additional) to budget_proposals
-- and backfill using fiscal-year freeze cutoff date.

ALTER TABLE budget_proposals
  ADD COLUMN budget_window_type ENUM('initial', 'additional') NULL AFTER request_date;

UPDATE budget_proposals bp
LEFT JOIN budget_time_freeze_config btf
  ON btf.fiscal_year = bp.fiscal_year
SET bp.budget_window_type = CASE
  WHEN COALESCE(bp.request_date, DATE(bp.created_at))
       <= COALESCE(btf.cutoff_date, STR_TO_DATE(CONCAT(bp.fiscal_year, '-02-01'), '%Y-%m-%d'))
    THEN 'initial'
  ELSE 'additional'
END
WHERE bp.id > 0
  AND (bp.budget_window_type IS NULL OR bp.budget_window_type NOT IN ('initial', 'additional'));

ALTER TABLE budget_proposals
  MODIFY COLUMN budget_window_type ENUM('initial', 'additional') NOT NULL DEFAULT 'additional';
