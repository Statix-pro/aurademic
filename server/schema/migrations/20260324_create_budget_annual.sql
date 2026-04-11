-- Migration: Create Budget_annual annual totals table
-- Date: 2026-03-24
-- Purpose:
--   1) Persist annual approved totals per unit (Department/Centre/Cell/Club/Professional Body)
--   2) Keep only aggregate fields needed for budget summary

CREATE TABLE IF NOT EXISTS Budget_annual (
  id BIGINT NOT NULL AUTO_INCREMENT,
  fiscal_year INT NOT NULL,
  beneficiary_type VARCHAR(64) NOT NULL,
  beneficiary_entity_id INT NULL,
  department_id INT NULL,
  entity_id INT NULL,
  proposed_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  initial_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  additional_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  expenditure_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  balance_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  annual_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_annual_scope (fiscal_year, beneficiary_type, department_id, entity_id),
  KEY idx_budget_annual_fy (fiscal_year),
  KEY idx_budget_annual_type (beneficiary_type),
  KEY idx_budget_annual_entity (beneficiary_entity_id),
  KEY idx_budget_annual_department (department_id),
  KEY idx_budget_annual_entity_id (entity_id),
  KEY idx_budget_annual_rollup (fiscal_year, beneficiary_type, department_id, beneficiary_entity_id),
  CONSTRAINT fk_budget_annual_department
    FOREIGN KEY (department_id) REFERENCES master_departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_budget_annual_entity
    FOREIGN KEY (beneficiary_entity_id) REFERENCES master_entities(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_budget_annual_entity_id
    FOREIGN KEY (entity_id) REFERENCES master_entities(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Budget_annual (
  fiscal_year,
  beneficiary_type,
  beneficiary_entity_id,
  department_id,
  entity_id,
  proposed_total_amount,
  approved_total_amount,
  initial_total_amount,
  additional_total_amount,
  expenditure_total_amount,
  balance_total_amount,
  annual_total_amount
)
SELECT
  bp.fiscal_year,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN 'Department'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'centre' THEN 'Centre'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'cell' THEN 'Cell'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'club' THEN 'Club'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
    ELSE COALESCE(NULLIF(TRIM(bp.beneficiary_type), ''), 'Unknown')
  END AS beneficiary_type,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END AS beneficiary_entity_id,
  bp.department_id,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END AS entity_id,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS proposed_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS approved_total_amount,
  SUM(
    CASE
      WHEN bp.created_at <= CONCAT(bp.fiscal_year, '-02-01 23:59:59')
        THEN COALESCE(bp.approved_total_amount, bp.total_amount, 0)
      ELSE 0
    END
  ) AS initial_total_amount,
  SUM(
    CASE
      WHEN bp.created_at > CONCAT(bp.fiscal_year, '-02-01 23:59:59')
        THEN COALESCE(bp.approved_total_amount, bp.total_amount, 0)
      ELSE 0
    END
  ) AS additional_total_amount,
  0 AS expenditure_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS balance_total_amount,
  SUM(COALESCE(bp.approved_total_amount, bp.total_amount, 0)) AS annual_total_amount
FROM budget_proposals bp
WHERE bp.status IN ('principal_approved', 'completed')
GROUP BY
  bp.fiscal_year,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN 'Department'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'centre' THEN 'Centre'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'cell' THEN 'Cell'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'club' THEN 'Club'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
    ELSE COALESCE(NULLIF(TRIM(bp.beneficiary_type), ''), 'Unknown')
  END,
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('faculty', 'staff', 'department') THEN NULL
    ELSE bp.beneficiary_entity_id
  END,
  bp.department_id;
