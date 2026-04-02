-- ============================================================
-- FINANCE MODULE RESET + REBUILD (no legacy data preservation)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Drop in dependency order
DROP TABLE IF EXISTS finance_budget_usage_ledger;
DROP TABLE IF EXISTS finance_budget_line_usage;
DROP TABLE IF EXISTS finance_income_rows;
DROP TABLE IF EXISTS finance_budget_breakup;
DROP TABLE IF EXISTS finance_request_refs;
DROP TABLE IF EXISTS finance_request_ref_tracker;
DROP TABLE IF EXISTS finance_requests;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Rebuild finance module tables with budget references
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_requests (
  id INT NOT NULL AUTO_INCREMENT,

  employee_id INT NULL,
  applicant_name VARCHAR(255) NULL,
  designation VARCHAR(150) NULL,
  department VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  mobile VARCHAR(20) NULL,

  request_date DATE NOT NULL,
  description TEXT NULL,

  beneficiary_type VARCHAR(64) NOT NULL,
  beneficiary_value VARCHAR(255) NULL,
  budget_tag VARCHAR(100) NULL,
  department_id INT NULL,
  beneficiary_entity_id INT NULL,

  primary_head VARCHAR(255) NOT NULL,
  event_sub_head VARCHAR(255) NULL,

  is_budget_proposed ENUM('Yes','No') NOT NULL DEFAULT 'No',
  proposed_amount DECIMAL(15,2) NULL,
  balance_amount DECIMAL(15,2) NULL,

  income_type VARCHAR(100) NULL,
  income_status VARCHAR(255) NULL,
  income_amount_type VARCHAR(50) NULL,
  credit_status VARCHAR(100) NULL,
  debit_status ENUM('credited','reimbursement') NULL,
  partial_amount DECIMAL(15,2) NULL,
  enclosures JSON NULL,

  total_budget DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  director_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  director_comment TEXT NULL,
  principal_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  principal_comment TEXT NULL,
  principal_priority ENUM('High','Medium','Low') DEFAULT NULL,
  chairman_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  chairman_comment TEXT NULL,

  created_by INT NULL,
  overall_status ENUM('pending','approved','rejected','archived') DEFAULT 'pending',
  workflow_state JSON NULL,
  workflow_status VARCHAR(32)
    GENERATED ALWAYS AS (
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.status')), 'in_progress')
    ) STORED,
  workflow_stage VARCHAR(64)
    GENERATED ALWAYS AS (
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.currentStage')), '')
    ) STORED,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_finance_requests_created_by (created_by),
  KEY idx_finance_requests_employee (employee_id),
  KEY idx_finance_requests_request_date (request_date),
  KEY idx_finance_requests_status (overall_status),
  KEY idx_finance_requests_department_id (department_id),
  KEY idx_finance_requests_beneficiary_entity_id (beneficiary_entity_id),
  KEY idx_finance_requests_budget_tag (budget_tag),
  KEY idx_finance_requests_workflow_status (workflow_status),
  KEY idx_finance_requests_workflow_stage (workflow_stage),
  KEY idx_finance_requests_workflow_stage_status (workflow_stage, workflow_status),

  CONSTRAINT fk_finance_requests_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_requests_employee
    FOREIGN KEY (employee_id) REFERENCES master_employees(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_requests_department
    FOREIGN KEY (department_id) REFERENCES master_departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_requests_entity
    FOREIGN KEY (beneficiary_entity_id) REFERENCES master_entities(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_request_refs (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  ref_year INT NOT NULL,
  ref_sequence INT NOT NULL,
  request_ref VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_request_refs_request_id (finance_request_id),
  UNIQUE KEY uq_finance_request_refs_request_ref (request_ref),
  UNIQUE KEY uq_finance_request_refs_year_seq (ref_year, ref_sequence),
  KEY idx_finance_request_refs_year (ref_year),
  CONSTRAINT fk_finance_request_refs_request
    FOREIGN KEY (finance_request_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_request_ref_tracker (
  ref_year INT NOT NULL,
  last_sequence INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ref_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_budget_breakup (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL,
  budget_proposal_id INT NULL,
  budget_line_id INT NULL,
  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  approved_amount DECIMAL(15,2) NULL,
  available_amount_snapshot DECIMAL(15,2) NULL,
  remaining_amount_snapshot DECIMAL(15,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_budget_breakup_finance (finance_id),
  KEY idx_finance_budget_breakup_line (budget_line_id),
  KEY idx_finance_budget_breakup_proposal (budget_proposal_id),
  KEY idx_finance_budget_breakup_sort (finance_id, sort_order),
  CONSTRAINT fk_finance_budget_breakup_finance
    FOREIGN KEY (finance_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_breakup_budget_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_breakup_budget_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_income_rows (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL,
  income_source VARCHAR(255) NULL,
  contribution VARCHAR(50) NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(100) NULL,
  credit_account VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_income_rows_finance (finance_id),
  KEY idx_finance_income_rows_sort (finance_id, sort_order),
  CONSTRAINT fk_finance_income_rows_request
    FOREIGN KEY (finance_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_budget_line_usage (
  budget_line_id INT NOT NULL,
  consumed_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (budget_line_id),
  CONSTRAINT fk_finance_budget_line_usage_budget_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_budget_usage_ledger (
  id BIGINT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL,
  finance_budget_breakup_id INT NULL,
  budget_line_id INT NOT NULL,
  operation ENUM('consume','release','adjust') NOT NULL DEFAULT 'consume',
  amount DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  actor_user_id INT NULL,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_budget_usage_ledger_finance (finance_id),
  KEY idx_finance_budget_usage_ledger_budget_line (budget_line_id),
  KEY idx_finance_budget_usage_ledger_created (created_at),
  CONSTRAINT fk_finance_budget_usage_ledger_finance
    FOREIGN KEY (finance_id) REFERENCES finance_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_breakup
    FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_budget_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow metadata (idempotent)
INSERT INTO approval_flow_config (beneficiary_type, entity_type_code, module_key, flow, is_active)
VALUES ('*', NULL, 'finance', JSON_ARRAY('level1', 'dof', 'principal'), 1)
ON DUPLICATE KEY UPDATE
  flow = VALUES(flow),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  ('finance', 'level1', 'department', JSON_OBJECT('assignmentRoleCodes', JSON_ARRAY('hod'), 'requireAssignment', FALSE), 1),
  ('finance', 'dof', 'global', NULL, 1),
  ('finance', 'principal', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('finance_workflow', 'level1', 'finance.workflow.level1', 'Process finance Level-1 approvals', 1),
  ('finance_workflow', 'dof', 'finance.workflow.dof', 'Process finance DoF-stage approvals', 1),
  ('finance_workflow', 'principal', 'finance.workflow.principal', 'Process finance Principal-stage approvals', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);
