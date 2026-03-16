-- Migration: Cleanup budget_proposal_refs and add Unique Constraint
-- Author: Gemini CLI
-- Date: 2026-02-25
-- Description: 
--   1. Removes redundant tracker rows (ref_sequence = 0) where more than one exists per year.
--   2. Adds a UNIQUE constraint on (ref_year, ref_sequence) to ensure data integrity 
--       and make INSERT IGNORE logic work as intended.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Remove redundant tracker rows (keep the oldest one per year)
DELETE r1 FROM budget_proposal_refs r1
JOIN budget_proposal_refs r2 
  ON r1.ref_year = r2.ref_year 
  AND r1.ref_sequence = r2.ref_sequence
  AND r1.id > r2.id
WHERE r1.ref_sequence = 0;

-- 2. Add the Unique Constraint
ALTER TABLE budget_proposal_refs 
ADD UNIQUE KEY uq_budget_ref_year_seq (ref_year, ref_sequence);

SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT 'Migration completed: budget_proposal_refs cleaned and constrained.' AS result;
