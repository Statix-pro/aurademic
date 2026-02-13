-- Migration: Add Journal Submission Approval Workflow
-- Author: Codex
-- Date: 2026-02-13
-- Description:
--   Adds admin approval metadata to journals and backfills existing rows
--   as approved to keep current records usable after rollout.

ALTER TABLE journals
  ADD COLUMN admin_approval_status ENUM('pending', 'approved', 'rejected')
    NOT NULL DEFAULT 'pending' AFTER status,
  ADD COLUMN admin_approval_comment TEXT NULL AFTER admin_approval_status,
  ADD COLUMN admin_approved_by INT NULL AFTER admin_approval_comment,
  ADD COLUMN admin_approved_at TIMESTAMP NULL AFTER admin_approved_by,
  ADD COLUMN admin_rejected_by INT NULL AFTER admin_approved_at,
  ADD COLUMN admin_rejected_at TIMESTAMP NULL AFTER admin_rejected_by;

ALTER TABLE journals
  ADD INDEX idx_journals_admin_approval_status (admin_approval_status);

ALTER TABLE journals
  ADD CONSTRAINT fk_journals_admin_approved_by
    FOREIGN KEY (admin_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_journals_admin_rejected_by
    FOREIGN KEY (admin_rejected_by) REFERENCES users(id) ON DELETE SET NULL;

UPDATE journals
SET
  admin_approval_status = 'approved',
  admin_approval_comment = COALESCE(admin_approval_comment, 'Backfilled during publication approval workflow rollout'),
  admin_approved_at = COALESCE(admin_approved_at, updated_at, created_at, CURRENT_TIMESTAMP),
  admin_rejected_by = NULL,
  admin_rejected_at = NULL
WHERE admin_approval_status IS NULL OR admin_approval_status = 'pending';
