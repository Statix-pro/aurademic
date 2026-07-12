-- ============================================
-- Migration: Add finalize/close tracking to finance_requests
-- Author: Claude
-- Date: 2026-07-10
-- ============================================

-- Description:
-- Adds an explicit "Finalize & Close" state to a finance request/card,
-- separate from the derived (all requests approved + paid) eligibility
-- check. This lets the applicant explicitly close out a finance card once
-- every submitted advance/expenditure/settlement request under it is
-- approved and paid, and gives the Expenditure dashboard's "Closed" KPI an
-- authoritative, auditable source of truth instead of only inferring it.

ALTER TABLE `finance_requests`
ADD COLUMN `closed_at` TIMESTAMP NULL DEFAULT NULL
  COMMENT 'When the finance card was manually finalized & closed' AFTER `payment_debit_account`,
ADD COLUMN `closed_by` INT NULL DEFAULT NULL
  COMMENT 'FK to users - who finalized & closed the finance card' AFTER `closed_at`,
ADD CONSTRAINT `fk_finance_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `finance_requests` DROP FOREIGN KEY `fk_finance_closed_by`;
-- ALTER TABLE `finance_requests` DROP COLUMN `closed_by`;
-- ALTER TABLE `finance_requests` DROP COLUMN `closed_at`;
