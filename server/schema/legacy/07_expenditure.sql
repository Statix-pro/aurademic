/* ============================================================
   07_expenditure.sql
   MODULE: Expenditure Requests & Settlement Accounts
   PURPOSE: Defines tables for actual event expenditure requests,
            planned and unplanned advance payouts, payee details,
            receipt and payment voucher uploads, NEFT exports,
            budget usage ledgers, and settlement balancing.
   Date: June 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS expenditure_budget_ledger;
DROP TABLE IF EXISTS expenditure_request_edits;
DROP TABLE IF EXISTS expenditure_bulk_neft_files;
DROP TABLE IF EXISTS expenditure_request_refs;
DROP TABLE IF EXISTS expenditure_request_ref_tracker;
DROP TABLE IF EXISTS expenditure_income_rows;
DROP TABLE IF EXISTS expenditure_unplanned_rows;
DROP TABLE IF EXISTS expenditure_line_rows;
DROP TABLE IF EXISTS expenditure_settlement_rows;
DROP TABLE IF EXISTS expenditure_advance_rows;
DROP TABLE IF EXISTS expenditure_request_bills;
DROP TABLE IF EXISTS expenditure_payee_rows;
DROP TABLE IF EXISTS expenditure_requests;
DROP TABLE IF EXISTS expenditure_payees;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. PAYEE REGISTRY (VENDORS, FACULTY, EXPERTS)
   ============================================================ */

/* 1.1 EXPENDITURE PAYEES (Master List of verified bank accounts) */
CREATE TABLE expenditure_payees (
  id BIGINT NOT NULL AUTO_INCREMENT,
  payee_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Full name of the payee/vendor',
  account_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Official name registered with bank',
  pan_number VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'PAN Number of payee',
  account_no VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bank account number',
  account_type VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Account type (Savings, Current)',
  bank_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Name of Bank',
  branch_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Name of Branch',
  ifsc VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Bank IFSC Code',
  beneficiary_type ENUM('individual', 'organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual' COMMENT 'Category of beneficiary',
  beneficiary_org ENUM('KSRCT', 'KSREI', 'External') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Affiliation group',
  organization_type VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Type of business entity (MSME, Proprietor)',
  msme VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MSME registration code if applicable',
  gstin VARCHAR(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'GST Identification Number',
  tds_details VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Tax Deducted at Source details',
  tds_section VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Applicable Income Tax Section for TDS',
  created_by INT DEFAULT NULL COMMENT 'FK to users representing profile creator',
  is_active TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Status flag',
  approval_status ENUM('pending', 'approved', 'rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved' COMMENT 'Vendor verification approval status',
  requested_by INT DEFAULT NULL COMMENT 'FK to users indicating who requested addition',
  requested_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by INT DEFAULT NULL COMMENT 'FK to users indicating who verified payee',
  approved_at TIMESTAMP NULL DEFAULT NULL,
  rejection_reason VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Admin rejection reasons',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_payees_account_ifsc (account_no, ifsc),
  KEY idx_expenditure_payees_name (payee_name),
  KEY idx_expenditure_payees_bank (bank_name),
  KEY idx_expenditure_payees_ifsc (ifsc),
  KEY idx_expenditure_payees_active_name (is_active, payee_name),
  KEY fk_expenditure_payees_user (created_by),
  KEY idx_expenditure_payees_approval_status (approval_status),
  KEY idx_expenditure_payees_requested_by (requested_by),
  KEY idx_expenditure_payees_approved_by (approved_by),
  CONSTRAINT fk_expenditure_payees_approved_by FOREIGN KEY (approved_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_payees_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_payees_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   2. CORE EXPENDITURE REQUESTS
   ============================================================ */

/* 2.1 EXPENDITURE REQUESTS (Planned/Unplanned Advances & Settlements) */
CREATE TABLE expenditure_requests (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL COMMENT 'FK link to parent finance_requests',
  employee_id INT DEFAULT NULL COMMENT 'FK to master_employees (requesting staff)',
  applicant_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Applicant display name',
  designation VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Applicant designation',
  department VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Applicant department name',
  email VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  mobile VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  request_date DATE NOT NULL COMMENT 'Date request was initiated',
  description TEXT COLLATE utf8mb4_unicode_ci COMMENT 'Justification and description of expenditure',
  beneficiary_type VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Target beneficiary classification (Faculty, Department, Cell)',
  beneficiary_value VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Target entity details',
  budget_tag VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Budget group tag',
  department_id INT DEFAULT NULL COMMENT 'FK to master_departments',
  beneficiary_entity_id INT DEFAULT NULL COMMENT 'FK to master_entities',
  primary_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Primary account classification',
  primary_head_id INT DEFAULT NULL COMMENT 'FK link to budget_heads',
  event_sub_head VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Event sub head label',
  event_sub_head_id INT DEFAULT NULL COMMENT 'FK link to budget_sub_heads',
  request_type ENUM('Advance', 'Settlement', 'Expenditure') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Expenditure flow path',
  is_budget_proposed ENUM('Yes', 'No') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'No',
  proposed_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Originally allocated event budget reference',
  balance_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Unused balance snapshot',
  unplanned_budget_enabled TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Boolean flag indicating unplanned expenditure mapping',
  unplanned_budget_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Unplanned allowance amount',
  unplanned_head_of_account VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Account source for unplanned funds',
  unplanned_head_of_account_budget_line_id INT DEFAULT NULL COMMENT 'Unplanned source budget line reference',
  unplanned_head_of_account_budget_proposal_id INT DEFAULT NULL COMMENT 'Unplanned source budget proposal reference',
  unplanned_budget_head VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  unplanned_budget_sub_head VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  unplanned_budget_description VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  income_type VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  income_status VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  income_amount_type VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  credit_status VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  debit_status ENUM('credited', 'reimbursement') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  partial_amount DECIMAL(15,2) DEFAULT NULL,
  show_bulk_neft TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Indicates if NEFT template download is enabled',
  payment_mode VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Settlement mode (NEFT, Cheque, Cash)',
  payment_ref_no VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Bank reference / UTR number',
  payment_date DATE DEFAULT NULL COMMENT 'Disbursement date',
  payment_status ENUM('Paid', 'Pending', 'Processing', 'Cancelled') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Disbursement state',
  payment_debit_account VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'College debit source account',
  advance_total_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consolidated advance payouts total',
  settlement_total_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consolidated settlement bills total',
  expenditure_total_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consolidated direct expenditures total',
  settlement_remarks VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  expenditure_remarks VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  tentative_settlement_date DATE DEFAULT NULL COMMENT 'Date target for submission of bills',
  total_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Overall requested sum',
  approved_total_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consolidated approved sum',
  director_status ENUM('pending', 'approved', 'rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  director_comment TEXT COLLATE utf8mb4_unicode_ci,
  principal_status ENUM('pending', 'approved', 'rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  principal_comment TEXT COLLATE utf8mb4_unicode_ci,
  principal_priority ENUM('Routine', 'Urgent', 'Most Urgent') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  chairman_status ENUM('pending', 'approved', 'rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  chairman_comment TEXT COLLATE utf8mb4_unicode_ci,
  created_by INT DEFAULT NULL COMMENT 'FK to users (original request submitter)',
  overall_status ENUM('pending', 'approved', 'rejected', 'archived', 'deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  workflow_state JSON DEFAULT NULL COMMENT 'JSON metadata snapshot of current workflow configuration',
  workflow_status VARCHAR(32) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.status')),_utf8mb4'in_progress')) STORED,
  workflow_stage VARCHAR(64) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.currentStage')),_utf8mb4'')) STORED,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  KEY idx_er_primary_head_id (primary_head_id),
  KEY idx_er_event_sub_head_id (event_sub_head_id),
  CONSTRAINT fk_expenditure_requests_department FOREIGN KEY (department_id) REFERENCES master_departments (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_employee FOREIGN KEY (employee_id) REFERENCES master_employees (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_entity FOREIGN KEY (beneficiary_entity_id) REFERENCES master_entities (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_finance FOREIGN KEY (finance_request_id) REFERENCES finance_requests (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_requests_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   3. EXPENDITURE PAYEES & BILLS LISTS
   ============================================================ */

/* 3.1 EXPENDITURE PAYEE ROWS (Payee breakdown allocations inside the request) */
CREATE TABLE expenditure_payee_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL COMMENT 'FK link to parent expenditure_requests',
  payee_id BIGINT DEFAULT NULL COMMENT 'FK to master expenditure_payees',
  payee_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Denormalized payee name',
  bank_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  account_no VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  ifsc VARCHAR(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  branch_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  url VARCHAR(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Attachment invoice/quote URL link',
  amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Payout amount allocated',
  mode VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Payout method (NEFT, cheque)',
  account_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  pan_number VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  account_type VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  beneficiary_type ENUM('individual', 'organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual',
  beneficiary_org ENUM('KSRCT', 'KSREI', 'External') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  organization_type VARCHAR(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  msme VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  gstin VARCHAR(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  tds_details VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  tds_section VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Sequence display order',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_payee_rows_request (expenditure_id),
  KEY idx_expenditure_payee_rows_payee (payee_id),
  KEY idx_expenditure_payee_rows_sort (expenditure_id, sort_order),
  CONSTRAINT fk_expenditure_payee_rows_payee FOREIGN KEY (payee_id) REFERENCES expenditure_payees (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_payee_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 3.2 EXPENDITURE REQUEST BILLS (Uploaded files and payment receipts) */
CREATE TABLE expenditure_request_bills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL COMMENT 'FK link to parent expenditure_requests',
  payee_row_id BIGINT DEFAULT NULL COMMENT 'FK link to associated payee_rows (if linked to a specific payout)',
  file_category ENUM('bill', 'payment_proof') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bill' COMMENT 'Classification of upload',
  original_name VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Original filename uploaded by user',
  stored_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'System filename saved on disk',
  file_path VARCHAR(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'System physical path',
  mime_type VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'MIME type classification',
  file_size BIGINT DEFAULT NULL COMMENT 'File size in bytes',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Sequence display order',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_request_bills_request (expenditure_id),
  KEY idx_expenditure_request_bills_payee_row (payee_row_id),
  KEY idx_expenditure_request_bills_sort (expenditure_id, sort_order, id),
  KEY idx_expenditure_request_bills_category (expenditure_id, file_category),
  CONSTRAINT fk_expenditure_request_bills_payee_row FOREIGN KEY (payee_row_id) REFERENCES expenditure_payee_rows (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_request_bills_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   4. DETAILED ALLOCATIONS & FLOW LINES (PLANNED/SETTLEMENTS)
   ============================================================ */

/* 4.1 EXPENDITURE ADVANCE ROWS (Breakdown of requested advance lines) */
CREATE TABLE expenditure_advance_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL COMMENT 'FK link to expenditure_requests',
  finance_budget_breakup_id INT DEFAULT NULL COMMENT 'FK to event budget breakup line source',
  budget_proposal_id INT DEFAULT NULL COMMENT 'FK to master budget proposal source',
  budget_line_id INT DEFAULT NULL COMMENT 'FK to specific master budget proposal line',
  amount_source ENUM('planned', 'unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned' COMMENT 'Funding allocation classification',
  budget_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Allocated budget head name',
  sub_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Allocated sub-head name',
  budget_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Allocated budget line limit',
  pre_advance_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Previously released advances total',
  advance_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Requested advance amount in this line',
  available_amount_snapshot DECIMAL(15,2) DEFAULT NULL COMMENT 'Balance available snapshot',
  remaining_amount_snapshot DECIMAL(15,2) DEFAULT NULL COMMENT 'Projected balance snapshot after payout',
  unplanned_available_snapshot DECIMAL(15,2) DEFAULT NULL COMMENT 'Unplanned balance snapshot',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Sequence display order',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  budget_head_id INT DEFAULT NULL COMMENT 'FK link to budget_heads',
  budget_sub_head_id INT DEFAULT NULL COMMENT 'FK link to budget_sub_heads',
  PRIMARY KEY (id),
  KEY idx_expenditure_advance_rows_request (expenditure_id),
  KEY idx_expenditure_advance_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_advance_rows_line (budget_line_id),
  KEY idx_expenditure_advance_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_advance_rows_sort (expenditure_id, sort_order),
  KEY idx_ear_head_id (budget_head_id),
  KEY idx_ear_subhead_id (budget_sub_head_id),
  CONSTRAINT fk_expenditure_advance_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_proposal FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_advance_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4.2 EXPENDITURE SETTLEMENT ROWS (Expense details matching actual invoices) */
CREATE TABLE expenditure_settlement_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  finance_budget_breakup_id INT DEFAULT NULL COMMENT 'FK to event budget breakup line source',
  budget_proposal_id INT DEFAULT NULL COMMENT 'FK to master budget proposal source',
  budget_line_id INT DEFAULT NULL COMMENT 'FK to specific master budget proposal line',
  amount_source ENUM('planned', 'unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  budget_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  sub_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  budget_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Original budget allowance limit',
  advance_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Advance amount already received',
  settlement_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Actual spent amount matching bills',
  available_amount_snapshot DECIMAL(15,2) DEFAULT NULL COMMENT 'Available budget snapshot',
  remaining_amount_snapshot DECIMAL(15,2) DEFAULT NULL COMMENT 'Balance remaining snapshot',
  unplanned_available_snapshot DECIMAL(15,2) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Sequence display order',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  budget_head_id INT DEFAULT NULL COMMENT 'FK link to budget_heads',
  budget_sub_head_id INT DEFAULT NULL COMMENT 'FK link to budget_sub_heads',
  PRIMARY KEY (id),
  KEY idx_expenditure_settlement_rows_request (expenditure_id),
  KEY idx_expenditure_settlement_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_settlement_rows_line (budget_line_id),
  KEY idx_expenditure_settlement_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_settlement_rows_sort (expenditure_id, sort_order),
  KEY idx_esr_head_id (budget_head_id),
  KEY idx_esr_subhead_id (budget_sub_head_id),
  CONSTRAINT fk_expenditure_settlement_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_proposal FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_settlement_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4.3 EXPENDITURE LINE ROWS (Detailed breakdown of direct expenditure requests) */
CREATE TABLE expenditure_line_rows (
  id BIGINT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  finance_budget_breakup_id INT DEFAULT NULL,
  budget_proposal_id INT DEFAULT NULL,
  budget_line_id INT DEFAULT NULL,
  amount_source ENUM('planned', 'unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  budget_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  sub_head VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  budget_amount DECIMAL(15,2) DEFAULT NULL,
  expenditure_input VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'User remarks or description of expense',
  auto_sum_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Calculated direct expenditure amount',
  available_amount_snapshot DECIMAL(15,2) DEFAULT NULL,
  remaining_amount_snapshot DECIMAL(15,2) DEFAULT NULL,
  unplanned_available_snapshot DECIMAL(15,2) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  budget_head_id INT DEFAULT NULL COMMENT 'FK link to budget_heads',
  budget_sub_head_id INT DEFAULT NULL COMMENT 'FK link to budget_sub_heads',
  PRIMARY KEY (id),
  KEY idx_expenditure_line_rows_request (expenditure_id),
  KEY idx_expenditure_line_rows_finance_breakup (finance_budget_breakup_id),
  KEY idx_expenditure_line_rows_line (budget_line_id),
  KEY idx_expenditure_line_rows_proposal (budget_proposal_id),
  KEY idx_expenditure_line_rows_sort (expenditure_id, sort_order),
  KEY idx_elr_head_id (budget_head_id),
  KEY idx_elr_subhead_id (budget_sub_head_id),
  CONSTRAINT fk_expenditure_line_rows_finance_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_proposal FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_line_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4.4 EXPENDITURE UNPLANNED ROWS (Unplanned allocations breakdown) */
CREATE TABLE expenditure_unplanned_rows (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  head_of_account VARCHAR(255) NOT NULL COMMENT 'Source category name providing funding',
  head_of_account_budget_line_id INT NOT NULL COMMENT 'FK to budget_proposal_lines of source',
  head_of_account_budget_proposal_id INT DEFAULT NULL COMMENT 'FK to budget_proposals of source',
  budget_head VARCHAR(255) NOT NULL COMMENT 'Target allocated budget head name',
  sub_head VARCHAR(255) NOT NULL COMMENT 'Target allocated sub-head name',
  amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Amount allocated',
  description VARCHAR(500) DEFAULT NULL COMMENT 'Justification remarks',
  sort_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_unplanned_rows_request (expenditure_id),
  KEY idx_expenditure_unplanned_rows_head_line (head_of_account_budget_line_id),
  KEY idx_expenditure_unplanned_rows_head_proposal (head_of_account_budget_proposal_id),
  CONSTRAINT fk_expenditure_unplanned_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.5 EXPENDITURE INCOME ROWS (Event revenue deposits matching settlements) */
CREATE TABLE expenditure_income_rows (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  income_source VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Income description (e.g. Registration fees)',
  contribution VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Source contributor',
  amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Revenue amount received',
  status VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Receipt verification status',
  remarks VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Auditing notes',
  credit_account VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Target college credit account',
  sort_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_income_rows_request (expenditure_id),
  KEY idx_expenditure_income_rows_sort (expenditure_id, sort_order),
  CONSTRAINT fk_expenditure_income_rows_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   5. AUDIT FILES, HISTORY & WORKFLOW LEDGERS
   ============================================================ */

/* 5.1 REFERENCE SEQUENCER TRACKER (Sequencer codes for expenditure requests) */
CREATE TABLE expenditure_request_ref_tracker (
  ref_year INT NOT NULL COMMENT 'Fiscal Year of sequencer (e.g. 2026)',
  last_sequence INT NOT NULL DEFAULT '0' COMMENT 'Last generated sequential number',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ref_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5.2 REFERENCE RECORDS (Assigned reference numbers) */
CREATE TABLE expenditure_request_refs (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_request_id INT NOT NULL,
  ref_year INT NOT NULL,
  ref_sequence INT NOT NULL,
  request_ref VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Assigned reference code (e.g. #E-2026-0004)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_request_refs_request_id (expenditure_request_id),
  UNIQUE KEY uq_expenditure_request_refs_request_ref (request_ref),
  UNIQUE KEY uq_expenditure_request_refs_year_seq (ref_year, ref_sequence),
  KEY idx_expenditure_request_refs_year (ref_year),
  CONSTRAINT fk_expenditure_request_refs_request FOREIGN KEY (expenditure_request_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5.3 BULK NEFT EXPORTS (System logs for exported bank payout templates) */
CREATE TABLE expenditure_bulk_neft_files (
  id BIGINT unsigned NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL,
  template_version VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Excel template version mapping key',
  original_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename',
  stored_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Hashed disk filename',
  file_path VARCHAR(512) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Server folder path',
  mime_type VARCHAR(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  file_size BIGINT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expenditure_bulk_neft_request (expenditure_id),
  KEY idx_expenditure_bulk_neft_created (created_at),
  CONSTRAINT fk_expenditure_bulk_neft_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE,
  CONSTRAINT chk_expenditure_bulk_neft_excel_name CHECK (regexp_like(lower(`original_name`),_utf8mb4'\\.(xlsx|xls)$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5.4 EXPENDITURE REQUEST EDITS (Auditing log of updates) */
CREATE TABLE expenditure_request_edits (
  id INT NOT NULL AUTO_INCREMENT,
  expenditure_request_id INT NOT NULL,
  edited_by_user_id INT DEFAULT NULL COMMENT 'FK to users who made change',
  edited_by_email VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  edited_by_role VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT '0',
  summary VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Modification description summary',
  details LONGTEXT COLLATE utf8mb4_unicode_ci COMMENT 'JSON layout of modified keys and diff values',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_request_edits_request (expenditure_request_id),
  KEY idx_expenditure_request_edits_created (created_at),
  KEY fk_expenditure_request_edits_user (edited_by_user_id),
  CONSTRAINT fk_expenditure_request_edits_request FOREIGN KEY (expenditure_request_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_request_edits_user FOREIGN KEY (edited_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5.5 BUDGET USAGE TRANSACTIONS LEDGER (Detailed ledger audit logs) */
CREATE TABLE expenditure_budget_ledger (
  id BIGINT unsigned NOT NULL AUTO_INCREMENT,
  expenditure_id INT NOT NULL COMMENT 'FK link to parent expenditure_requests',
  budget_line_id INT NOT NULL COMMENT 'FK to target budget_proposal_lines',
  operation ENUM('advance', 'expenditure', 'settlement', 'release') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Ledger transaction type',
  amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Transaction amount',
  balance_after DECIMAL(15,2) DEFAULT NULL COMMENT 'Calculated balance remaining on the budget line after transaction',
  actor_user_id INT DEFAULT NULL COMMENT 'FK to users representing transaction executor',
  remarks VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Transaction description/remarks',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenditure_budget_ledger_expenditure (expenditure_id),
  KEY idx_expenditure_budget_ledger_budget_line (budget_line_id),
  KEY idx_expenditure_budget_ledger_created (created_at),
  KEY fk_expenditure_budget_ledger_user (actor_user_id),
  CONSTRAINT fk_expenditure_budget_ledger_budget_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_budget_ledger_request FOREIGN KEY (expenditure_id) REFERENCES expenditure_requests (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_expenditure_budget_ledger_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
