-- Migration: Add deleted to workflow_actions decision
-- Date: 2026-04-10
-- Description:
--   Extends the decision enum in workflow_actions table to include 'deleted' status.

ALTER TABLE workflow_actions
MODIFY COLUMN decision ENUM('approved','rejected','returned','archived','deleted') NOT NULL;
