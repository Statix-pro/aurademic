-- Migration: Normalize budget archive status tokens
-- Date: 2026-03-08
-- Description:
--   Normalizes legacy archive-like values to canonical token `archived`.

UPDATE budget_proposals
SET
  status = 'archived',
  current_stage = 'archived',
  updated_at = NOW()
WHERE LOWER(TRIM(status)) IN ('archive', 'archived')
   OR LOWER(TRIM(current_stage)) IN ('archive', 'archived');

UPDATE budget_proposal_approvals
SET decision = 'archived'
WHERE LOWER(TRIM(decision)) IN ('archive', 'archived');
