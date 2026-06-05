/* ============================================================
   05_finance.sql
   MODULE: Finance Approvals & Budget Allocation
   PURPOSE: Defines tables for tracking pre-event finance requests,
            budget item breakups, workflow status approvals, upload
            annexures, reference trackers, budget usage rollups,
            ledger history, and carry-forward allocations.
   Date: June 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP VIEW IF EXISTS v_finance_requests;
DROP TABLE IF EXISTS finance_carry_forward_allocations;
DROP TABLE IF EXISTS finance_budget_usage_ledger;
DROP TABLE IF EXISTS finance_budget_line_usage;
DROP TABLE IF EXISTS finance_request_refs;
DROP TABLE IF EXISTS finance_request_ref_tracker;
DROP TABLE IF EXISTS finance_request_edits;
DROP TABLE IF EXISTS finance_request_annexures;
DROP TABLE IF EXISTS finance_status_updates;
DROP TABLE IF EXISTS finance_budget_breakup;
DROP TABLE IF EXISTS finance_requests;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. CORE FINANCE REQUEST REGISTRY
   ============================================================ */

/* 1.1 FINANCE REQUESTS (Core Pre-Event Funding Applications) */
CREATE TABLE finance_requests (
  id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NULL COMMENT 'FK to master_employees for staff applicants',
  applicant_name VARCHAR(255) NULL COMMENT 'For external or non-staff applicants (denormalized name)',
  designation VARCHAR(150) NULL COMMENT 'Applicant professional designation',
  department VARCHAR(255) NULL COMMENT 'Applicant department name',
  email VARCHAR(255) NULL COMMENT 'Applicant contact email address',
  mobile VARCHAR(15) NULL COMMENT 'Applicant mobile number',
  request_date DATE NOT NULL COMMENT 'Application submission date',
  description TEXT COMMENT 'Detailed objective and justification of the funding request',
  beneficiary_type ENUM(
    'Individual Faculty',
    'Faculty_Team',
    'Student_Team',
    'Department',
    'Centre',
    'Cell',
    'Club',
    'Institution'
  ) NOT NULL COMMENT 'Target entity type receiving the funding allocation',
  beneficiary_value TEXT COMMENT 'Additional scope parameters (e.g. event name, faculty profile)',
  primary_head VARCHAR(255) NOT NULL COMMENT 'General primary account category (e.g., Academic, Operations)',
  event_sub_head VARCHAR(255) DEFAULT NULL COMMENT 'Specific sub-head classification',
  is_budget_proposed ENUM('Yes', 'No') NOT NULL DEFAULT 'No' COMMENT 'Boolean flag indicating if budget was pre-proposed in FY annual plan',
  proposed_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Requested funding amount',
  balance_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Available balance snapshot at request time',
  income_type VARCHAR(100) DEFAULT NULL COMMENT 'Income classification if generating event revenue',
  income_status VARCHAR(255) DEFAULT NULL COMMENT 'Income receipt status',
  income_amount_type ENUM('Full', 'Partial') DEFAULT NULL COMMENT 'Income type specification',
  credit_status VARCHAR(100) DEFAULT NULL COMMENT 'Credit audit status',
  debit_status ENUM('credited', 'reimbursement') DEFAULT NULL COMMENT 'Debit settlement method',
  partial_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Partial release amount (if approved in phases)',
  enclosures JSON DEFAULT NULL COMMENT 'Attached checklist items and declarations',
  total_budget DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT 'Total actual approved budget',
  director_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Director review stage status',
  director_comment TEXT DEFAULT NULL COMMENT 'Director remarks feedback',
  principal_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Principal review stage status',
  principal_comment TEXT DEFAULT NULL COMMENT 'Principal remarks feedback',
  principal_priority ENUM('High', 'Medium', 'Low') DEFAULT NULL COMMENT 'Principal review priority flag',
  chairman_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Chairman final review stage status',
  chairman_comment TEXT DEFAULT NULL COMMENT 'Chairman remarks feedback',
  created_by INT NOT NULL COMMENT 'FK to users table indicating applicant account',
  overall_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Overall consolidated workflow status',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_created_by (created_by),
  KEY idx_employee_id (employee_id),
  KEY idx_overall_status (overall_status),
  KEY idx_request_date (request_date),
  KEY idx_director_status (director_status),
  KEY idx_principal_status (principal_status),
  KEY idx_chairman_status (chairman_status),
  CONSTRAINT fk_finance_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_finance_employee FOREIGN KEY (employee_id) REFERENCES master_employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 1.2 BUDGET BREAKDOWN (Itemised budget lines for the request) */
CREATE TABLE finance_budget_breakup (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance_requests',
  budget_head VARCHAR(255) NOT NULL COMMENT 'Specific budget head category',
  sub_head VARCHAR(255) NOT NULL COMMENT 'Detailed item name/description',
  amount DECIMAL(15,2) NOT NULL COMMENT 'Item allocation amount',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_id (finance_id),
  CONSTRAINT fk_budget_finance FOREIGN KEY (finance_id) REFERENCES finance_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 1.3 FINANCE STATUS UPDATES (Historical Audit log of workflow transitions) */
CREATE TABLE finance_status_updates (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL,
  user_id INT NOT NULL COMMENT 'The reviewing actor user id',
  role ENUM('director', 'principal', 'chairman', 'applicant') NOT NULL COMMENT 'Stage authority role',
  status ENUM('pending', 'approved', 'rejected') NOT NULL COMMENT 'Action decision',
  comment TEXT DEFAULT NULL COMMENT 'Action review remarks',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_id (finance_id),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_status_finance FOREIGN KEY (finance_id) REFERENCES finance_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_status_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ============================================================
   2. ANNEXURES, REFERENCES & TRACKERS
   ============================================================ */

/* 2.1 FINANCE REQUEST ANNEXURES (Uploaded documents & bills) */
CREATE TABLE finance_request_annexures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance_requests',
  annexure_type VARCHAR(100) DEFAULT NULL COMMENT 'Classification of upload (e.g. Invitation, Agenda)',
  original_name VARCHAR(255) DEFAULT NULL COMMENT 'Original filename',
  stored_name VARCHAR(255) NOT NULL COMMENT 'Hashed filename saved on disk',
  file_path VARCHAR(512) NOT NULL COMMENT 'Physical path on file system',
  mime_type VARCHAR(150) DEFAULT NULL COMMENT 'File MIME type',
  file_size BIGINT DEFAULT NULL COMMENT 'File size in bytes',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Order sequence for frontend preview',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_request_annexures_finance_id (finance_id),
  KEY idx_finance_request_annexures_sort (finance_id, sort_order, id),
  CONSTRAINT fk_finance_request_annexures_finance_id FOREIGN KEY (finance_id) REFERENCES finance_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.2 FINANCE REQUEST EDITS (Track alterations by Admins/Approvers) */
CREATE TABLE finance_request_edits (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  edited_by_user_id INT DEFAULT NULL COMMENT 'FK to users who made edits',
  edited_by_email VARCHAR(255) DEFAULT NULL COMMENT 'Email address of editor',
  edited_by_role VARCHAR(100) DEFAULT NULL COMMENT 'Role of editor',
  is_admin TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Admin role indicator',
  summary VARCHAR(500) DEFAULT NULL COMMENT 'Short description of change',
  details LONGTEXT COMMENT 'Diff or JSON representation of modification details',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_request_edits_request (finance_request_id),
  KEY idx_finance_request_edits_created (created_at),
  KEY fk_finance_request_edits_user (edited_by_user_id),
  CONSTRAINT fk_finance_request_edits_request FOREIGN KEY (finance_request_id) REFERENCES finance_requests (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_request_edits_user FOREIGN KEY (edited_by_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.3 REFERENCE ID SEQUENCER (For generating sequential finance codes) */
CREATE TABLE finance_request_ref_tracker (
  ref_year INT NOT NULL COMMENT 'Fiscal Year identifier (e.g. 2026)',
  last_sequence INT NOT NULL DEFAULT '0' COMMENT 'Last generated numeric sequence number',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ref_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.4 REFERENCE ID RECORDS (Allocated project reference codes) */
CREATE TABLE finance_request_refs (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  ref_year INT NOT NULL COMMENT 'Fiscal Year of reference code',
  ref_sequence INT NOT NULL COMMENT 'Assigned numeric sequence number',
  request_ref VARCHAR(20) NOT NULL COMMENT 'Complete formatted reference string (e.g. #F-2026-0021)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_request_refs_request_id (finance_request_id),
  UNIQUE KEY uq_finance_request_refs_request_ref (request_ref),
  UNIQUE KEY uq_finance_request_refs_year_seq (ref_year, ref_sequence),
  KEY idx_finance_request_refs_year (ref_year),
  CONSTRAINT fk_finance_request_refs_request FOREIGN KEY (finance_request_id) REFERENCES finance_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   3. BUDGET LINE CONSUMPTION & LEDGERS
   ============================================================ */

/* 3.1 BUDGET LINE USAGE SUMMARY (Rollup of consumed amount per budget line) */
CREATE TABLE finance_budget_line_usage (
  budget_line_id INT NOT NULL COMMENT 'FK link to budget_proposal_lines',
  consumed_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consolidated spent/committed amount',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (budget_line_id),
  CONSTRAINT fk_finance_budget_line_usage_budget_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 3.2 BUDGET USAGE LEDGER (Detailed transactional audit log of allocations) */
CREATE TABLE finance_budget_usage_ledger (
  id BIGINT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance_requests',
  finance_budget_breakup_id INT DEFAULT NULL COMMENT 'FK link to specific breakup line item',
  budget_line_id INT NOT NULL COMMENT 'FK link to master budget proposal line',
  operation ENUM('consume', 'release', 'adjust') NOT NULL DEFAULT 'consume' COMMENT 'Ledger transaction type',
  amount DECIMAL(15,2) NOT NULL COMMENT 'Transaction amount',
  balance_after DECIMAL(15,2) NOT NULL COMMENT 'Calculated balance remaining after transaction',
  actor_user_id INT DEFAULT NULL COMMENT 'FK to users executing transaction',
  remarks VARCHAR(255) DEFAULT NULL COMMENT 'Justification or comments for transaction',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_finance_budget_usage_ledger_finance (finance_id),
  KEY idx_finance_budget_usage_ledger_budget_line (budget_line_id),
  KEY idx_finance_budget_usage_ledger_created (created_at),
  KEY fk_finance_budget_usage_ledger_breakup (finance_budget_breakup_id),
  KEY fk_finance_budget_usage_ledger_actor (actor_user_id),
  CONSTRAINT fk_finance_budget_usage_ledger_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_breakup FOREIGN KEY (finance_budget_breakup_id) REFERENCES finance_budget_breakup (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_budget_line FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_finance_budget_usage_ledger_finance FOREIGN KEY (finance_id) REFERENCES finance_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 3.3 CARRY FORWARD ALLOCATIONS (Moving unused event funds across fiscal years) */
CREATE TABLE finance_carry_forward_allocations (
  id INT NOT NULL AUTO_INCREMENT,
  finance_request_id INT NOT NULL,
  source_fiscal_year INT NOT NULL COMMENT 'Source Year funds are moved from',
  target_fiscal_year INT NOT NULL COMMENT 'Target Year funds are moved to',
  carry_forward_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Approved carry forward amount',
  used_amount DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Consumed amount in target year',
  remarks TEXT COMMENT 'Review approval notes',
  status VARCHAR(30) NOT NULL DEFAULT 'active' COMMENT 'Allocation status (active, completed, cancelled)',
  created_by_user_id INT DEFAULT NULL COMMENT 'FK to users who set up carry-forward',
  created_by_email VARCHAR(255) DEFAULT NULL COMMENT 'Email identifier of creator',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_finance_cf_active_target (finance_request_id, target_fiscal_year, status),
  KEY idx_finance_cf_finance (finance_request_id),
  KEY idx_finance_cf_source_fy (source_fiscal_year),
  KEY idx_finance_cf_target_fy (target_fiscal_year),
  CONSTRAINT fk_finance_cf_request FOREIGN KEY (finance_request_id) REFERENCES finance_requests (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   4. DENORMALIZED DATABASE VIEWS
   ============================================================ */

/* 4.1 VIEW: v_finance_requests (Enriched with applicant employee & department details) */
CREATE OR REPLACE VIEW v_finance_requests AS
SELECT 
  fr.id,
  fr.employee_id,
  fr.created_by,
  COALESCE(
    CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')),
    fr.applicant_name
  ) AS applicant_name,
  COALESCE(e.designation, fr.designation) AS designation,
  COALESCE(d.name, fr.department) AS department,
  COALESCE(e.email, fr.email) AS email,
  COALESCE(e.mobile, fr.mobile) AS mobile,
  e.erp_id,
  CASE WHEN fr.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
  fr.request_date,
  fr.description,
  fr.beneficiary_type,
  fr.beneficiary_value,
  fr.primary_head,
  fr.event_sub_head,
  fr.is_budget_proposed,
  fr.proposed_amount,
  fr.balance_amount,
  fr.total_budget,
  fr.income_type,
  fr.income_status,
  fr.income_amount_type,
  fr.credit_status,
  fr.debit_status,
  fr.partial_amount,
  fr.enclosures,
  fr.director_status,
  fr.director_comment,
  fr.principal_status,
  fr.principal_comment,
  fr.principal_priority,
  fr.chairman_status,
  fr.chairman_comment,
  fr.overall_status,
  fr.created_at,
  fr.updated_at
FROM finance_requests fr
LEFT JOIN master_employees e ON fr.employee_id = e.id
LEFT JOIN master_departments d ON e.department_id = d.id;
