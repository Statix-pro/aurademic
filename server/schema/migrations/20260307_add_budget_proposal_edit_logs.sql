-- Migration: Add budget proposal edit logs
-- Author: Codex
-- Date: 2026-03-07
-- Description:
--   Stores per-update change summaries so UI can show what changed and where.

CREATE TABLE IF NOT EXISTS budget_proposal_edits (
  id INT NOT NULL AUTO_INCREMENT,
  budget_proposal_id INT NOT NULL,
  edited_by_user_id INT NULL,
  edited_by_email VARCHAR(255) NULL,
  summary VARCHAR(500) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_proposal_edits_proposal (budget_proposal_id),
  KEY idx_budget_proposal_edits_created (created_at),
  CONSTRAINT fk_budget_proposal_edits_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_budget_proposal_edits_user
    FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
