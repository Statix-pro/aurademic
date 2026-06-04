-- ============================================================
-- Expenditure module schema (finance sequel)
-- Date: 2026-04-08
-- Notes:
-- 1) Expenditure request is always linked to a finance request
-- 2) 3rd card supports request_type: Advance / Settlement / Expenditure
-- 3) Dedicated payee master for shortlist/autocomplete
-- 4) Bulk NEFT supports single Excel file (enforced by unique row + check)
-- 5) Bills upload supports multiple files and any type
-- ============================================================

CREATE TABLE IF NOT EXISTS expenditure_requests (
  id INT NOT NULL AUTO_INCREMENT,

  finance_request_id INT NOT NULL,

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
  request_type ENUM('Advance','Settlement','Expenditure') NOT NULL,

  is_budget_proposed ENUM('Yes','No') NOT NULL DEFAULT 'No',
  proposed_amount DECIMAL(15,2) NULL,
  balance_amount DECIMAL(15,2) NULL,
  unplanned_budget_enabled TINYINT(1) NOT NULL DEFAULT 0,
  unplanned_budget_amount DECIMAL(15,2) NULL,
  unplanned_head_of_account VARCHAR(255) NULL,
  unplanned_head_of_account_budget_line_id INT NULL,
  unplanned_head_of_account_budget_proposal_id INT NULL,
  unplanned_budget_head VARCHAR(255) NULL,
  unplanned_budget_sub_head VARCHAR(255) NULL,
  unplanned_budget_description VARCHAR(500) NULL,

  -- mirror finance income summary fields
  income_type VARCHAR(100) NULL,
  income_status VARCHAR(255) NULL,
  income_amount_type VARCHAR(50) NULL,
  credit_status VARCHAR(100) NULL,
  debit_status ENUM('credited','reimbursement') NULL,
  partial_amount DECIMAL(15,2) NULL,

  -- payment card (currently optional)
  show_bulk_neft TINYINT(1) NOT NULL DEFAULT 0,
  payment_mode VARCHAR(100) NULL,
  payment_ref_no VARCHAR(120) NULL,
  payment_date DATE NULL,
  payment_status ENUM('Paid','Pending','Processing','Cancelled') NULL,
  payment_debit_account VARCHAR(255) NULL,

  advance_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  settlement_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  expenditure_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  settlement_remarks VARCHAR(500) NULL,
  expenditure_remarks VARCHAR(500) NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  director_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  director_comment TEXT NULL,
  principal_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  principal_comment TEXT NULL,
  principal_priority ENUM('Routine','Urgent','Most Urgent') DEFAULT NULL,
  chairman_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  chairman_comment TEXT NULL,

  created_by INT NULL,
  overall_status ENUM('pending','approved','rejected','archived','deleted') DEFAULT 'pending',
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
  KEY idx_expenditure_requests_finance_id (finance_request_id),
  KEY idx_expenditure_requests_created_by (created_by),
  KEY idx_expenditure_requests_employee (employee_id),
  KEY idx_expenditure_requests_request_date (request_date),
  KEY idx_expenditure_requests_status (overall_status),
  KEY idx_expenditure_requests_type (request_type),
  KEY idx_expenditure_requests_department_id (department_id),
  KEY idx_expenditure_requests_entity_id (beneficiary_entity_id),
  KEY idx_expenditure_requests_budget_tag (budget_tag),
  KEY idx_expenditure_requests_workflow_status (workflow_status),
  KEY idx_expenditure_requests_workflow_stage (workflow_stage),
  KEY idx_expenditure_requests_workflow_stage_status (workflow_stage, workflow_status),
  KEY idx_expenditure_requests_finance_created (finance_request_id, created_by, created_at),
  KEY idx_expenditure_requests_created_fy_status (created_by, request_date, overall_status),

  CONSTRAINT fk_expenditure_requests_finance
    FOREIGN KEY (finance_request_id) REFERENCES finance_requests(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_employee
    FOREIGN KEY (employee_id) REFERENCES master_employees(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_department
    FOREIGN KEY (department_id) REFERENCES master_departments(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_entity
    FOREIGN KEY (beneficiary_entity_id) REFERENCES master_entities(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_request_refs (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_request_id INT NOT NULL,
  ref_year INT NOT NULL,
  ref_sequence INT NOT NULL,
  request_ref VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_request_refs_request_id (expenditure_request_id),
  UNIQUE KEY uq_expenditure_request_refs_request_ref (request_ref),
  UNIQUE KEY uq_expenditure_request_refs_year_seq (ref_year, ref_sequence),
  KEY idx_expenditure_request_refs_year (ref_year),
  CONSTRAINT fk_expenditure_request_refs_request
    FOREIGN KEY (expenditure_request_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_request_ref_tracker (
  ref_year INT NOT NULL,
  last_sequence INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ref_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dedicated payee master used for autosuggest/shortlist
CREATE TABLE IF NOT EXISTS expenditure_payees (
  id BIGINT NOT NULL AUTO_INCREMENT,
  payee_name VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NULL,
  pan_number VARCHAR(20) NULL,
  account_no VARCHAR(100) NOT NULL,
  account_type VARCHAR(100) NULL,
  bank_name VARCHAR(255) NOT NULL,
  branch_name VARCHAR(255) NOT NULL,
  ifsc VARCHAR(30) NOT NULL,

  beneficiary_type ENUM('individual','organization') NOT NULL DEFAULT 'individual',
  beneficiary_org ENUM('KSRCT','KSREI','External') NULL,
  organization_type VARCHAR(120) NULL,
  msme VARCHAR(100) NULL,
  gstin VARCHAR(30) NULL,
  tds_details VARCHAR(255) NULL,
  tds_section VARCHAR(100) NULL,

  created_by INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_payees_account_ifsc (account_no, ifsc),
  KEY idx_expenditure_payees_name (payee_name),
  KEY idx_expenditure_payees_bank (bank_name),
  KEY idx_expenditure_payees_ifsc (ifsc),
  KEY idx_expenditure_payees_active_name (is_active, payee_name),
  CONSTRAINT fk_expenditure_payees_user
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_income_rows (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  income_source VARCHAR(255) NULL,
  contribution VARCHAR(50) NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(100) NULL,
  remarks VARCHAR(500) NULL,
  credit_account VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_income_rows_request (expenditure_id),
  KEY idx_expenditure_income_rows_sort (expenditure_id, sort_order),
  CONSTRAINT fk_expenditure_income_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- per-request transactional payee rows (snapshot + amount/mode)
CREATE TABLE IF NOT EXISTS expenditure_payee_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  payee_id BIGINT NULL,

  payee_name VARCHAR(255) NULL,
  bank_name VARCHAR(255) NULL,
  account_no VARCHAR(100) NULL,
  ifsc VARCHAR(30) NULL,
  branch_name VARCHAR(255) NULL,
  url VARCHAR(512) NULL,

  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  mode VARCHAR(50) NULL,

  account_name VARCHAR(255) NULL,
  pan_number VARCHAR(20) NULL,
  account_type VARCHAR(100) NULL,
  beneficiary_type ENUM('individual','organization') NOT NULL DEFAULT 'individual',
  beneficiary_org ENUM('KSRCT','KSREI','External') NULL,
  organization_type VARCHAR(120) NULL,
  msme VARCHAR(100) NULL,
  gstin VARCHAR(30) NULL,
  tds_details VARCHAR(255) NULL,
  tds_section VARCHAR(100) NULL,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_expenditure_payee_rows_request (expenditure_id),
  KEY idx_expenditure_payee_rows_payee (payee_id),
  KEY idx_expenditure_payee_rows_sort (expenditure_id, sort_order),
  CONSTRAINT fk_expenditure_payee_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_payee_rows_payee
    FOREIGN KEY (payee_id) REFERENCES expenditure_payees(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_advance_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,

  finance_budget_breakup_id INT NULL,
  budget_proposal_id INT NULL,
  budget_line_id INT NULL,
  amount_source ENUM('planned','unplanned') NOT NULL DEFAULT 'planned',

  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,

  budget_amount DECIMAL(15,2) NULL,
  pre_advance_amount DECIMAL(15,2) NULL,
  advance_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,


  available_amount_snapshot DECIMAL(15,2) NULL,
  remaining_amount_snapshot DECIMAL(15,2) NULL,
  unplanned_available_snapshot DECIMAL(15,2) NULL,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_expenditure_advance_rows_request (expenditure_id),
  KEY idx_expenditure_advance_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_advance_rows_line (budget_line_id),
  KEY idx_expenditure_advance_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_advance_rows_sort (expenditure_id, sort_order),

  CONSTRAINT fk_expenditure_advance_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_finance_breakup
    FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_settlement_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,

  finance_budget_breakup_id INT NULL,
  budget_proposal_id INT NULL,
  budget_line_id INT NULL,
  amount_source ENUM('planned','unplanned') NOT NULL DEFAULT 'planned',

  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,

  budget_amount DECIMAL(15,2) NULL,
  advance_amount DECIMAL(15,2) NULL,
  settlement_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  available_amount_snapshot DECIMAL(15,2) NULL,
  remaining_amount_snapshot DECIMAL(15,2) NULL,
  unplanned_available_snapshot DECIMAL(15,2) NULL,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_expenditure_settlement_rows_request (expenditure_id),
  KEY idx_expenditure_settlement_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_settlement_rows_line (budget_line_id),
  KEY idx_expenditure_settlement_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_settlement_rows_sort (expenditure_id, sort_order),

  CONSTRAINT fk_expenditure_settlement_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_finance_breakup
    FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_line_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,

  finance_budget_breakup_id INT NULL,
  budget_proposal_id INT NULL,
  budget_line_id INT NULL,
  amount_source ENUM('planned','unplanned') NOT NULL DEFAULT 'planned',

  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,

  budget_amount DECIMAL(15,2) NULL,
  expenditure_input VARCHAR(255) NULL,
  auto_sum_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  available_amount_snapshot DECIMAL(15,2) NULL,
  remaining_amount_snapshot DECIMAL(15,2) NULL,
  unplanned_available_snapshot DECIMAL(15,2) NULL,

  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_expenditure_line_rows_request (expenditure_id),
  KEY idx_expenditure_line_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_line_rows_line (budget_line_id),
  KEY idx_expenditure_line_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_line_rows_sort (expenditure_id, sort_order),

  CONSTRAINT fk_expenditure_line_rows_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_finance_breakup
    FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bills upload: multiple files, any type
CREATE TABLE IF NOT EXISTS expenditure_request_bills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  payee_row_id BIGINT NULL,
  file_category ENUM('bill','payment_proof') NOT NULL DEFAULT 'bill',
  original_name VARCHAR(255) NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(150) NULL,
  file_size BIGINT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_request_bills_request (expenditure_id),
  KEY idx_expenditure_request_bills_payee_row (payee_row_id),
  KEY idx_expenditure_request_bills_category (expenditure_id, file_category),
  KEY idx_expenditure_request_bills_sort (expenditure_id, sort_order, id),
  CONSTRAINT fk_expenditure_request_bills_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_expenditure_request_bills_payee_row
    FOREIGN KEY (payee_row_id) REFERENCES expenditure_payee_rows(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk NEFT upload: single file only, Excel only
CREATE TABLE IF NOT EXISTS expenditure_bulk_neft_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  template_version VARCHAR(50) NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(150) NULL,
  file_size BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_bulk_neft_request (expenditure_id),
  KEY idx_expenditure_bulk_neft_created (created_at),
  CONSTRAINT fk_expenditure_bulk_neft_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_expenditure_bulk_neft_excel_name
    CHECK (
      LOWER(original_name) REGEXP '\\.(xlsx|xls)$'
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_request_edits (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_request_id INT NOT NULL,
  edited_by_user_id INT NULL,
  edited_by_email VARCHAR(255) NULL,
  edited_by_role VARCHAR(100) NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  summary VARCHAR(500) NULL,
  details LONGTEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_request_edits_request (expenditure_request_id),
  KEY idx_expenditure_request_edits_created (created_at),
  CONSTRAINT fk_expenditure_request_edits_request
    FOREIGN KEY (expenditure_request_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_request_edits_user
    FOREIGN KEY (edited_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenditure_budget_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  budget_line_id INT NOT NULL,
  operation ENUM('advance','expenditure','settlement','release') NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(15,2) NULL,
  actor_user_id INT NULL,
  remarks VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_budget_ledger_expenditure (expenditure_id),
  KEY idx_expenditure_budget_ledger_budget_line (budget_line_id),
  KEY idx_expenditure_budget_ledger_created (created_at),
  CONSTRAINT fk_expenditure_budget_ledger_request
    FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_budget_ledger_budget_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_budget_ledger_user
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Workflow metadata + permissions for expenditure module
INSERT INTO approval_flow_config (beneficiary_type, entity_type_code, module_key, flow, is_active)
SELECT '*', NULL, 'expenditure', JSON_ARRAY('level1', 'dof', 'principal'), 1
WHERE NOT EXISTS (
  SELECT 1
  FROM approval_flow_config
  WHERE beneficiary_type = '*'
    AND entity_type_code IS NULL
    AND module_key = 'expenditure'
);

UPDATE approval_flow_config
SET flow = JSON_ARRAY('level1', 'dof', 'principal'),
    is_active = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE beneficiary_type = '*'
  AND entity_type_code IS NULL
  AND module_key = 'expenditure';

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  ('expenditure', 'level1', 'department', JSON_OBJECT('assignmentRoleCodes', JSON_ARRAY('hod', 'coordinator', 'entity_approver'), 'requireAssignment', FALSE), 1),
  ('expenditure', 'dof', 'global', NULL, 1),
  ('expenditure', 'principal', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('expenditure_workflow', 'level1', 'expenditure.workflow.level1', 'Process expenditure Level-1 approvals', 1),
  ('expenditure_workflow', 'dof', 'expenditure.workflow.dof', 'Process expenditure DoF-stage approvals', 1),
  ('expenditure_workflow', 'principal', 'expenditure.workflow.principal', 'Process expenditure Principal-stage approvals', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);
