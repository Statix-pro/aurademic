-- Migration: Add resubmitted to workflow_actions decision
-- Date: 2026-05-27
-- Description:
--   Allows applicant resubmission comments to be stored as workflow audit log entries.

ALTER TABLE workflow_actions
MODIFY COLUMN decision ENUM('approved','rejected','returned','archived','deleted','resubmitted') NOT NULL;
