-- ============================================
-- Migration: Add payment_debit_account to finance_requests
-- Author: Claude
-- Date: 2026-07-08
-- ============================================

-- Description:
-- Adds a Debit Account field to finance requests, matching the equivalent
-- `payment_debit_account` column already present on `expenditure_requests`.
-- Lets a finance request record which bank account the payment should be
-- debited from, same as the existing Expenditure "Debit Account" toggle.

ALTER TABLE `finance_requests`
ADD COLUMN `payment_debit_account` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
  COMMENT 'College debit source account' AFTER `debit_status`;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `finance_requests` DROP COLUMN `payment_debit_account`;
