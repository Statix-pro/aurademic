-- Migration: Add approval lifecycle columns for expenditure payees
-- Date: 2026-05-03
-- Purpose:
--   1) Track pending/approved/rejected payees in master
--   2) Record requester/approver and decision metadata
--   3) Backfill existing active payees as approved

ALTER TABLE expenditure_payees
  ADD COLUMN approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved' AFTER is_active,
  ADD COLUMN requested_by INT NULL AFTER approval_status,
  ADD COLUMN requested_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER requested_by,
  ADD COLUMN approved_by INT NULL AFTER requested_at,
  ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by,
  ADD COLUMN rejection_reason VARCHAR(500) NULL AFTER approved_at,
  ADD KEY idx_expenditure_payees_approval_status (approval_status),
  ADD KEY idx_expenditure_payees_requested_by (requested_by),
  ADD KEY idx_expenditure_payees_approved_by (approved_by),
  ADD CONSTRAINT fk_expenditure_payees_requested_by
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT fk_expenditure_payees_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE expenditure_payees
SET approval_status = 'approved',
    approved_at = COALESCE(approved_at, updated_at, created_at, CURRENT_TIMESTAMP),
    approved_by = COALESCE(approved_by, created_by),
    rejection_reason = NULL
WHERE COALESCE(is_active, 0) = 1;
