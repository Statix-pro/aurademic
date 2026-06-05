/* ============================================================
   08_org_and_budget_v9_PRODUCTION_FINAL.sql
   UPGRADED: Faculty flow now matches Department (requires HoD)
   Date: June 6, 2026 (Upgraded: Feb 17, 2026)
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP VIEW IF EXISTS v_budget_summary;
DROP TABLE IF EXISTS budget_proposal_approvals;
DROP TABLE IF EXISTS budget_line_month_allocations;
DROP TABLE IF EXISTS budget_proposal_lines;
DROP TABLE IF EXISTS budget_proposal_refs;
DROP TABLE IF EXISTS budget_proposals;
DROP TABLE IF EXISTS approval_flow_config;
DROP TABLE IF EXISTS org_unit_emails;
DROP TABLE IF EXISTS org_units;
DROP TABLE IF EXISTS org_unit_types;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. SHARED ORG STRUCTURE
   ============================================================ */

/* 1.1 ORG UNIT TYPES */
CREATE TABLE org_unit_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE COMMENT 'DEPARTMENT, CENTRE, CELL, CLUB, PROF_BODY',
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 1.2 ORG UNITS (87 units) */
CREATE TABLE org_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_unit_type_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(50) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_type_name (org_unit_type_id, name),
  KEY idx_unit_type (org_unit_type_id),
  KEY idx_unit_active (is_active),
  KEY idx_unit_short_code (short_code),
  KEY idx_unit_name (name),
  CONSTRAINT fk_org_units_type
    FOREIGN KEY (org_unit_type_id) REFERENCES org_unit_types(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 1.3 ORG UNIT EMAILS */
CREATE TABLE org_unit_emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_unit_id INT NOT NULL,
  role ENUM('office','hod','finance','generic') NOT NULL DEFAULT 'office',
  email VARCHAR(255) NOT NULL,
  is_primary TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_unit_role_email (org_unit_id, role, email),
  KEY idx_email (email),
  KEY idx_primary (is_primary),
  CONSTRAINT fk_org_unit_emails
    FOREIGN KEY (org_unit_id) REFERENCES org_units(id)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 1.4 APPROVAL FLOW CONFIG */
CREATE TABLE approval_flow_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  beneficiary_type VARCHAR(100) NOT NULL COMMENT 'Faculty, Department, Centre, etc.',
  org_unit_type_code VARCHAR(50) NULL COMMENT 'DEPARTMENT, CENTRE, etc. NULL for Faculty/Institution',
  module ENUM('BUDGET','FINANCE','BOTH') NOT NULL DEFAULT 'BOTH',
  requires_hod TINYINT(1) DEFAULT 0,
  requires_dof TINYINT(1) DEFAULT 1,
  requires_principal TINYINT(1) DEFAULT 1,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_flow (beneficiary_type, org_unit_type_code, module),
  KEY idx_flow_type (beneficiary_type),
  KEY idx_flow_module (module),
  KEY idx_flow_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   2. BUDGET TABLES
   ============================================================ */

/* 2.1 MASTER PROPOSALS */
CREATE TABLE budget_proposals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposal_ref VARCHAR(20) UNIQUE NOT NULL COMMENT '#B-2026-0001',
  fiscal_year YEAR NOT NULL COMMENT '2026 for FY 2026-27',
  employee_id INT NOT NULL COMMENT 'Submitter employee ID',
  user_id INT NOT NULL COMMENT 'From JWT',
  user_email VARCHAR(255) NOT NULL COMMENT 'From JWT',
  request_date DATE NOT NULL,
  
  beneficiary_type VARCHAR(100) NOT NULL,
  beneficiary_value VARCHAR(255) NULL,
  org_unit_id INT NULL,
  department VARCHAR(100) NULL COMMENT 'For HOD filtering',
  
  proposal_description TEXT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  approval_flow VARCHAR(50) NOT NULL DEFAULT 'dof_principal',
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  current_stage VARCHAR(20) NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_proposal_ref (proposal_ref),
  KEY idx_fiscal_year (fiscal_year),
  KEY idx_user_email (user_email),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  KEY idx_stage (current_stage),
  KEY idx_beneficiary_type (beneficiary_type),
  KEY idx_org_unit (org_unit_id),
  KEY idx_department (department),
  KEY idx_approval_flow (approval_flow),
  KEY idx_created (created_at),
  KEY idx_fy_status (fiscal_year, status),
  KEY idx_flow_stage (approval_flow, current_stage),
  
  CONSTRAINT fk_bp_org_unit
    FOREIGN KEY (org_unit_id) REFERENCES org_units(id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.2 PROPOSAL REFERENCES */
CREATE TABLE budget_proposal_refs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposal_id INT NULL COMMENT 'NULL for year tracker row',
  ref_year YEAR NOT NULL,
  ref_sequence INT NOT NULL DEFAULT 0,
  proposal_ref VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_proposal_id (proposal_id),
  UNIQUE KEY uq_proposal_ref (proposal_ref),
  KEY idx_ref_year (ref_year),
  KEY idx_sequence (ref_year, ref_sequence),
  CONSTRAINT fk_proposal_ref
    FOREIGN KEY (proposal_id) REFERENCES budget_proposals(id) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.3 PROPOSAL LINES */
CREATE TABLE budget_proposal_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  budget_proposal_id INT NOT NULL,
  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,
  unit_amount DECIMAL(15,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total DECIMAL(15,2) NOT NULL,
  line_description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_proposal (budget_proposal_id),
  KEY idx_budget_head (budget_head),
  CONSTRAINT fk_proposal_line
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.4 MONTH ALLOCATIONS */
CREATE TABLE budget_line_month_allocations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  budget_line_id INT NOT NULL,
  month ENUM('Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar') NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_line_month (budget_line_id, month),
  KEY idx_month (month),
  CONSTRAINT fk_month_line
    FOREIGN KEY (budget_line_id) REFERENCES budget_proposal_lines(id) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2.5 APPROVAL AUDIT TRAIL */
CREATE TABLE budget_proposal_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  budget_proposal_id INT NOT NULL,
  role VARCHAR(20) NOT NULL,
  approver_user_id INT NOT NULL,
  approver_email VARCHAR(255) NOT NULL,
  decision VARCHAR(20) NOT NULL,
  feedback TEXT NULL,
  allows_edit TINYINT(1) DEFAULT 0,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_proposal (budget_proposal_id),
  KEY idx_role_decision (role, decision),
  KEY idx_decided (decided_at),
  KEY idx_approver (approver_user_id),
  CONSTRAINT fk_approval_proposal
    FOREIGN KEY (budget_proposal_id) REFERENCES budget_proposals(id) 
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   3. SEED DATA
   ============================================================ */

/* 3.1 ORG UNIT TYPES */
INSERT INTO org_unit_types (code, name) VALUES
('DEPARTMENT','Department'),
('CENTRE','Centre'),
('CELL','Cell'),
('CLUB','Club'),
('PROF_BODY','Professional Body');

/* 3.2 DEPARTMENTS (25) */
INSERT INTO org_units (org_unit_type_id, name, short_code) 
SELECT 
  (SELECT id FROM org_unit_types WHERE code='DEPARTMENT'), 
  name, 
  short_code 
FROM (
  SELECT 'Artificial Intelligence & Data Science' as name, 'AIDS' as short_code UNION ALL
  SELECT 'Biotechnology', 'BT' UNION ALL
  SELECT 'Civil Engineering', 'CIVIL' UNION ALL
  SELECT 'Computer Science and Business Systems', 'CSBS' UNION ALL
  SELECT 'Computer Science and Engineering', 'CSE' UNION ALL
  SELECT 'Computer Science and Engineering (AI&ML)', 'AIML' UNION ALL
  SELECT 'Electrical and Electronics Engineering', 'EEE' UNION ALL
  SELECT 'Electronics and Communication Engineering', 'ECE' UNION ALL
  SELECT 'Food Technology', 'FT' UNION ALL
  SELECT 'Information Technology', 'IT' UNION ALL
  SELECT 'Mechanical Engineering', 'MECH' UNION ALL
  SELECT 'Mechatronics Engineering', 'MCT' UNION ALL
  SELECT 'Nano Science and Technology', 'NANO' UNION ALL
  SELECT 'Electronics Engineering (VLSI)', 'VLSI' UNION ALL
  SELECT 'Textile Technology', 'TEXTILE' UNION ALL
  SELECT 'Management Studies', 'MBA' UNION ALL
  SELECT 'Master of Computer Applications', 'MCA' UNION ALL
  SELECT 'English', 'ENGLISH' UNION ALL
  SELECT 'Tamil', 'TAMIL' UNION ALL
  SELECT 'Mathematics', 'MATHS' UNION ALL
  SELECT 'Physics', 'PHYSICS' UNION ALL
  SELECT 'Chemistry', 'CHEMISTRY' UNION ALL
  SELECT 'Library', 'LIBRARY' UNION ALL
  SELECT 'Physical Education', 'PE' UNION ALL
  SELECT 'Principal Office', 'PRINCIPAL'
) t;

/* 3.3 DEPARTMENT EMAILS */
INSERT INTO org_unit_emails (org_unit_id, role, email)
SELECT id, 'office', email_addr FROM (
  SELECT (SELECT id FROM org_units WHERE short_code='AIDS') as id, 'aidsoffice@ksrct.ac.in' as email_addr UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='BT'), 'btoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='CIVIL'), 'civiloffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='CSBS'), 'csbsoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='CSE'), 'cseoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='AIML'), 'aimloffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='EEE'), 'eeeoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='ECE'), 'eceoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='FT'), 'ftoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='IT'), 'itoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='MECH'), 'mechoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='MCT'), 'mctoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='NANO'), 'nanooffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='VLSI'), 'vlsioffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='TEXTILE'), 'textileoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='MBA'), 'mbaoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE short_code='MCA'), 'mcaoffice@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='English'), 'english@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Tamil'), 'tamil@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Mathematics'), 'maths@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Physics'), 'physics@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Chemistry'), 'chemistry@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Library'), 'library@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Physical Education'), 'ped@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Principal Office'), 'office@ksrct.ac.in'
) t;

/* 3.4 CENTRES */
INSERT INTO org_units (org_unit_type_id, name) 
SELECT (SELECT id FROM org_unit_types WHERE code='CENTRE'), name FROM (
  SELECT 'Centre for Research & Development' as name UNION ALL
  SELECT 'Centre for Sustainable Development Goals' UNION ALL
  SELECT 'Centre for Skill Development' UNION ALL
  SELECT 'AICTE IDEA Lab' UNION ALL
  SELECT 'Career Guidance Academy' UNION ALL
  SELECT 'Centre for Student Affairs' UNION ALL
  SELECT 'Centre for IT Infrastructure' UNION ALL
  SELECT 'KSRCT MSME Business Incubator' UNION ALL
  SELECT 'KSRCT ACIC Incubation Foundation'
) t;

/* 3.5 CENTRE EMAILS */
INSERT INTO org_unit_emails (org_unit_id, role, email)
SELECT id, 'office', email_addr FROM (
  SELECT (SELECT id FROM org_units WHERE name='Centre for Research & Development') as id, 'headcfrd@ksrct.ac.in' as email_addr UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Centre for Sustainable Development Goals'), 'sdg@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='AICTE IDEA Lab'), 'idealab@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Centre for IT Infrastructure'), 'directorium@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='KSRCT MSME Business Incubator'), 'msme@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='KSRCT ACIC Incubation Foundation'), 'acic@ksrct.ac.in'
) t;

/* 3.6 CLUBS */
INSERT INTO org_units (org_unit_type_id, name)
SELECT (SELECT id FROM org_unit_types WHERE code='CLUB'), name FROM (
  SELECT 'Cultural Club' as name UNION ALL
  SELECT 'Readers Club' UNION ALL
  SELECT 'NDLI Club' UNION ALL
  SELECT 'Service Motto Volunteers' UNION ALL
  SELECT 'LifX Club' UNION ALL
  SELECT 'Build Club' UNION ALL
  SELECT 'Eco Care Club' UNION ALL
  SELECT 'Drone Club' UNION ALL
  SELECT 'Neomutant Association' UNION ALL
  SELECT 'PAC PMC Club' UNION ALL
  SELECT 'Tamil Mandram' UNION ALL
  SELECT 'Young Indians' UNION ALL
  SELECT 'Rotaract Club'
) t;

/* 3.7 CLUB EMAILS */
INSERT INTO org_unit_emails (org_unit_id, role, email)
SELECT id, 'office', email_addr FROM (
  SELECT (SELECT id FROM org_units WHERE name='Cultural Club') as id, 'culturalclub@ksrct.ac.in' as email_addr UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='LifX Club'), 'lifxclub@ksrct.ac.in'
) t;

/* 3.8 CELLS */
INSERT INTO org_units (org_unit_type_id, name)
SELECT (SELECT id FROM org_unit_types WHERE code='CELL'), name FROM (
  SELECT 'Institutions Innovation Council' as name UNION ALL
  SELECT 'Intellectual Property Rights Cell' UNION ALL
  SELECT 'Consultancy' UNION ALL
  SELECT 'Entrepreneurship Development Cell' UNION ALL
  SELECT 'Higher Education Cell' UNION ALL
  SELECT 'Alumni Cell' UNION ALL
  SELECT 'National Cadet Corps (NCC) Army Wing' UNION ALL
  SELECT 'National Cadet Corps (NCC) Air Wing' UNION ALL
  SELECT 'National Service Scheme (NSS)' UNION ALL
  SELECT 'Youth Red Cross (YRC)' UNION ALL
  SELECT 'Red Ribbon Club (RRC)' UNION ALL
  SELECT 'Unnat Bharat Abhiyan (UBA)' UNION ALL
  SELECT 'Autonomous' UNION ALL
  SELECT 'Internal Quality Assurance Cell' UNION ALL
  SELECT 'Training' UNION ALL
  SELECT 'Placement' UNION ALL
  SELECT 'Exam Cell' UNION ALL
  SELECT 'Admission' UNION ALL
  SELECT 'NPTEL' UNION ALL
  SELECT 'Women Empowerment Cell' UNION ALL
  SELECT 'Press & Media'
) t;

/* 3.9 CELL EMAILS */
INSERT INTO org_unit_emails (org_unit_id, role, email)
SELECT id, 'office', email_addr FROM (
  SELECT (SELECT id FROM org_units WHERE name='Institutions Innovation Council') as id, 'iic@ksrct.ac.in' as email_addr UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Intellectual Property Rights Cell'), 'iprpolicy@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Consultancy'), 'consultancy@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Entrepreneurship Development Cell'), 'edc@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Higher Education Cell'), 'hec@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Alumni Cell'), 'alumni@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='National Cadet Corps (NCC) Army Wing'), 'nccarmy@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='National Cadet Corps (NCC) Air Wing'), 'nccairwing@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='National Service Scheme (NSS)'), 'nss@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Autonomous'), 'autonomous@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Internal Quality Assurance Cell'), 'iqac@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Training'), 'training@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Placement'), 'placement@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Exam Cell'), 'examcell@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Admission'), 'admission@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='NPTEL'), 'spocnptel@ksrct.ac.in' UNION ALL
  SELECT (SELECT id FROM org_units WHERE name='Press & Media'), 'press@ksrct.ac.in'
) t;

/* 3.10 PROFESSIONAL BODIES */
INSERT INTO org_units (org_unit_type_id, name)
SELECT (SELECT id FROM org_unit_types WHERE code='PROF_BODY'), name FROM (
  SELECT 'ICT Academy' as name UNION ALL
  SELECT 'Indian Society for Technical Education' UNION ALL
  SELECT 'The Institution of Engineers (India)' UNION ALL
  SELECT 'Institute of Electrical and Electronics Engineers' UNION ALL
  SELECT 'Institution of Electronics and Telecommunication Engineers' UNION ALL
  SELECT 'Indian Welding Society' UNION ALL
  SELECT 'American Society of Mechanical Engineers' UNION ALL
  SELECT 'SAE Collegiate Club' UNION ALL
  SELECT 'Textile Association of India' UNION ALL
  SELECT 'Madras Management Association' UNION ALL
  SELECT 'IEEE Engineering in Medicine and Biology Society' UNION ALL
  SELECT 'Confederation of Indian Industry' UNION ALL
  SELECT 'Indian Concrete Institute' UNION ALL
  SELECT 'Indian Geotechnical Society' UNION ALL
  SELECT 'Association of Food Scientist & Technologists (India)' UNION ALL
  SELECT 'Microbiologists Society, India' UNION ALL
  SELECT 'The Indian Society of Heating, Refrigerating and Air Conditioning Engineers (ISHRAE)' UNION ALL
  SELECT 'The Indian Institute of Welding (IIW - India)' UNION ALL
  SELECT 'The Institute of Indian Foundrymen (IIF)'
) t;

/* 3.11 APPROVAL FLOW CONFIG - ✅ UPGRADED */
INSERT INTO approval_flow_config (beneficiary_type, org_unit_type_code, module, requires_hod, requires_dof, requires_principal) VALUES
('Faculty', NULL, 'BOTH', 1, 1, 1),            -- ✅ CHANGED: Now requires HoD (was 0)
('Department', 'DEPARTMENT', 'BOTH', 1, 1, 1), -- ✅ Unchanged (already correct)
('Centre', 'CENTRE', 'BOTH', 0, 1, 1),
('Cell', 'CELL', 'BOTH', 0, 1, 1),
('Club', 'CLUB', 'BOTH', 0, 1, 1),
('Professional Body', 'PROF_BODY', 'BOTH', 0, 1, 0),
('Institution', NULL, 'BOTH', 0, 1, 1);

/* ============================================================
   4. VIEW (FIXED - NO RESERVED KEYWORDS)
   ============================================================ */

CREATE OR REPLACE VIEW v_budget_summary AS
SELECT 
  bp.id, bp.proposal_ref, bp.fiscal_year, bp.beneficiary_type,
  bp.beneficiary_value, bp.department, bp.org_unit_id, bp.total_amount,
  bp.status, bp.current_stage, bp.approval_flow,
  bp.user_id, bp.user_email,
  ou.name AS org_unit_name, ou.short_code AS org_unit_code,
  out_type.name AS org_unit_type_name,
  COUNT(DISTINCT bpl.id) AS line_count,
  COUNT(DISTINCT bpa.id) AS approval_count,
  SUM(bpl.line_total) AS calculated_total,
  bp.created_at, bp.updated_at
FROM budget_proposals bp
LEFT JOIN org_units ou ON bp.org_unit_id = ou.id
LEFT JOIN org_unit_types out_type ON ou.org_unit_type_id = out_type.id
LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
LEFT JOIN budget_proposal_approvals bpa ON bp.id = bpa.budget_proposal_id
GROUP BY bp.id, ou.name, ou.short_code, out_type.name;

/* ============================================================
   5. VERIFICATION
   ============================================================ */

SELECT 'org_unit_types' as table_name, COUNT(*) as count FROM org_unit_types
UNION ALL SELECT 'org_units', COUNT(*) FROM org_units
UNION ALL SELECT 'org_unit_emails', COUNT(*) FROM org_unit_emails
UNION ALL SELECT 'approval_flow_config', COUNT(*) FROM approval_flow_config
UNION ALL SELECT 'budget_proposals', COUNT(*) FROM budget_proposals;

/* Expected: 5, 87, 50, 7, 0 */

/* ============================================================
   ✅ CHANGELOG v8 → v9 (Feb 17, 2026)
   ============================================================
   1. ✅ FIXED: Faculty now requires_hod = 1 (matches Department flow)
   2. ✅ REASON: Both Faculty and Department follow HoD → DoF → Principal
   3. ✅ NOTE: Principal auto-approval logic handled in backend (budgetModel.js)
   4. ✅ VERIFIED: All 7 approval_flow_config rows aligned with backend
   ============================================================ */


-- ==========================================
-- NEW BUDGET MODULE TABLES (Added June 6, 2026)
-- ==========================================

CREATE TABLE `Budget_annual` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `fiscal_year` int NOT NULL,
  `beneficiary_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beneficiary_entity_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `proposed_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `initial_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `additional_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `expenditure_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `annual_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_annual_scope` (`fiscal_year`,`beneficiary_type`,`department_id`,`entity_id`),
  KEY `idx_budget_annual_fy` (`fiscal_year`),
  KEY `idx_budget_annual_type` (`beneficiary_type`),
  KEY `idx_budget_annual_entity` (`beneficiary_entity_id`),
  KEY `idx_budget_annual_department` (`department_id`),
  KEY `idx_budget_annual_entity_id` (`entity_id`),
  KEY `idx_budget_annual_rollup` (`fiscal_year`,`beneficiary_type`,`department_id`,`beneficiary_entity_id`),
  CONSTRAINT `fk_budget_annual_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_budget_annual_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_budget_annual_entity_id` FOREIGN KEY (`entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `budget_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_budget_head_name` (`name`),
  UNIQUE KEY `uniq_budget_heads_code` (`code`),
  KEY `idx_budget_head_group` (`group_label`),
  KEY `idx_budget_head_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `budget_sub_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head_id` int DEFAULT NULL,
  `scope` enum('head-specific','hoac-shared') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'head-specific',
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_label` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head_identity_id` int GENERATED ALWAYS AS (coalesce(`head_id`,0)) STORED,
  `event_type_key` varchar(100) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(`event_type`,_utf8mb4'')) STORED,
  `group_label_key` varchar(150) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(`group_label`,_utf8mb4'')) STORED,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_budget_subhead_identity` (`name`,`scope`,`head_identity_id`,`event_type_key`,`group_label_key`),
  KEY `idx_subhead_scope` (`scope`),
  KEY `idx_subhead_head` (`head_id`),
  KEY `idx_subhead_event_type` (`event_type`),
  KEY `idx_budget_sub_heads_code` (`code`),
  KEY `idx_budget_sub_head_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=586 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `budget_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tag_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_tags_name` (`tag_name`),
  KEY `idx_budget_tags_active_order` (`is_active`,`sort_order`,`tag_name`),
  KEY `idx_budget_tags_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `budget_time_freeze_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fiscal_year` int NOT NULL,
  `cutoff_date` date NOT NULL,
  `is_frozen` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by_user_id` int DEFAULT NULL,
  `updated_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_time_freeze_config_fiscal_year` (`fiscal_year`),
  KEY `idx_budget_time_freeze_config_fiscal_year` (`fiscal_year`),
  KEY `fk_budget_time_freeze_config_user` (`updated_by_user_id`),
  CONSTRAINT `fk_budget_time_freeze_config_user` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `budget_proposal_edits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_proposal_id` int NOT NULL,
  `edited_by_user_id` int DEFAULT NULL,
  `edited_by_email` varchar(191) DEFAULT NULL,
  `summary` varchar(255) DEFAULT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_proposal_edits_proposal` (`budget_proposal_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

