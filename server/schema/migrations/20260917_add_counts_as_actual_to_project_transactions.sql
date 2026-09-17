-- ============================================
-- Migration: Mark a project ledger row as counting toward Actuals
-- Author: Maheshwaran A K
-- Date: 2026-09-17
-- ============================================

-- Description:
-- The Transaction Summary reports Budget against Actuals, and until now every
-- ledger row counted toward Actuals with no way to say otherwise. An internal
-- transfer, a correction entry or a provisional advance moves real money through
-- the account but is not what the project spent or received against its budget,
-- so counting it overstates both sides of that report.
--
-- This column is that switch, per transaction. It changes the Transaction
-- Summary only: the ledger's own running Balance stays a total of every credit
-- and debit, because the account's cash position does not care how a row is
-- reported.
--
-- DEFAULT 1 is what makes this safe to apply to live data: every row already in
-- the table is counted exactly as it is today, so no total on any existing
-- project moves when this lands.

ALTER TABLE `project_transactions`
ADD COLUMN `counts_as_actual` tinyint(1) NOT NULL DEFAULT '1'
  COMMENT 'Counts toward the Transaction Summary Actuals — the ledger Balance ignores it'
AFTER `debit`;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `project_transactions` DROP COLUMN `counts_as_actual`;
