-- Migration: Add budget time freeze config table
-- Author: Codex
-- Date: 2026-03-08
-- Description:
--   Stores DoF-configured fiscal-year freeze cutoff date for initial budget window.

CREATE TABLE IF NOT EXISTS budget_time_freeze_config (
  id INT NOT NULL AUTO_INCREMENT,
  fiscal_year INT NOT NULL,
  cutoff_date DATE NOT NULL,
  is_frozen TINYINT(1) NOT NULL DEFAULT 0,
  updated_by_user_id INT NULL,
  updated_by_email VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_time_freeze_config_fiscal_year (fiscal_year),
  KEY idx_budget_time_freeze_config_fiscal_year (fiscal_year),
  CONSTRAINT fk_budget_time_freeze_config_user
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
