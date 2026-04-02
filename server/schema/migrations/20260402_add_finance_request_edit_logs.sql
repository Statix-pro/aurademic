-- Migration: Add finance request edit logs
-- Date: 2026-04-02
-- Description:
--   Stores per-update change summaries so finance request edits appear in the log popup.

CREATE TABLE IF NOT EXISTS finance_request_edits (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  edited_by_user_id INT NULL,
  edited_by_email VARCHAR(255) NULL,
  edited_by_role VARCHAR(100) NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  summary VARCHAR(500) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_request_edits_request (finance_request_id),
  KEY idx_finance_request_edits_created (created_at),
  CONSTRAINT fk_finance_request_edits_request
    FOREIGN KEY (finance_request_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_request_edits_user
    FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
