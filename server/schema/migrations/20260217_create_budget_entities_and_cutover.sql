-- Migration: Create Budget Entity Masters and Direct Budget Cutover
-- Author: Codex
-- Date: 2026-02-17
-- Description:
--   Introduces entity master tables for budget beneficiaries and directly
--   recreates budget schema against master_departments + new entity masters.

SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS v_budget_summary;
DROP VIEW IF EXISTS master_cells;
DROP VIEW IF EXISTS master_clubs;
DROP VIEW IF EXISTS master_centres;
DROP VIEW IF EXISTS master_professional_bodies;

DROP TABLE IF EXISTS budget_proposal_approvals;
DROP TABLE IF EXISTS budget_line_month_allocations;
DROP TABLE IF EXISTS budget_proposal_lines;
DROP TABLE IF EXISTS budget_proposal_refs;
DROP TABLE IF EXISTS budget_proposals;
DROP TABLE IF EXISTS approval_flow_config;

DROP TABLE IF EXISTS master_entity_contacts;
DROP TABLE IF EXISTS master_entities;
DROP TABLE IF EXISTS master_entity_types;

DROP TABLE IF EXISTS org_unit_emails;
DROP TABLE IF EXISTS org_units;
DROP TABLE IF EXISTS org_unit_types;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- ENTITY MASTER TABLES
-- =====================================================

CREATE TABLE master_entity_types (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entity_types_code (code),
  KEY idx_master_entity_types_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE master_entities (
  id INT NOT NULL AUTO_INCREMENT,
  entity_type_id INT NOT NULL,
  code VARCHAR(50) DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entities_type_name (entity_type_id, name),
  KEY idx_master_entities_type (entity_type_id),
  KEY idx_master_entities_code (code),
  KEY idx_master_entities_active (is_active),
  CONSTRAINT fk_master_entities_type FOREIGN KEY (entity_type_id)
    REFERENCES master_entity_types(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE master_entity_contacts (
  id INT NOT NULL AUTO_INCREMENT,
  entity_id INT NOT NULL,
  role ENUM('office', 'hod', 'finance', 'generic') NOT NULL DEFAULT 'office',
  email VARCHAR(255) NOT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entity_contacts (entity_id, role, email),
  KEY idx_master_entity_contacts_email (email),
  KEY idx_master_entity_contacts_entity (entity_id),
  CONSTRAINT fk_master_entity_contacts_entity FOREIGN KEY (entity_id)
    REFERENCES master_entities(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- ENTITY MASTER SEED DATA
-- =====================================================

INSERT INTO master_entity_types (code, name, sort_order) VALUES
  ('CENTRE', 'Centre', 1),
  ('CELL', 'Cell', 2),
  ('CLUB', 'Club', 3),
  ('PROFESSIONAL_BODY', 'Professional Body', 4);

INSERT INTO master_entities (entity_type_id, code, name, sort_order)
SELECT met.id, e.code, e.name, e.sort_order
FROM (
  SELECT 'CENTRE' AS type_code, 'CFRD' AS code, 'Centre for Research & Development' AS name, 1 AS sort_order UNION ALL
  SELECT 'CENTRE', 'CSDG', 'Centre for Sustainable Development Goals', 2 UNION ALL
  SELECT 'CENTRE', 'CSD', 'Centre for Skill Development', 3 UNION ALL
  SELECT 'CENTRE', 'IDEALAB', 'AICTE IDEA Lab', 4 UNION ALL
  SELECT 'CENTRE', 'CGA', 'Career Guidance Academy', 5 UNION ALL
  SELECT 'CENTRE', 'CSA', 'Centre for Student Affairs', 6 UNION ALL
  SELECT 'CENTRE', 'CITI', 'Centre for IT Infrastructure', 7 UNION ALL
  SELECT 'CENTRE', 'MSME_BI', 'KSRCT MSME Business Incubator', 8 UNION ALL
  SELECT 'CENTRE', 'ACIC', 'KSRCT ACIC Incubation Foundation', 9 UNION ALL

  SELECT 'CLUB', NULL, 'Cultural Club', 1 UNION ALL
  SELECT 'CLUB', NULL, 'Readers Club', 2 UNION ALL
  SELECT 'CLUB', NULL, 'NDLI Club', 3 UNION ALL
  SELECT 'CLUB', NULL, 'Service Motto Volunteers', 4 UNION ALL
  SELECT 'CLUB', NULL, 'LifX Club', 5 UNION ALL
  SELECT 'CLUB', NULL, 'Build Club', 6 UNION ALL
  SELECT 'CLUB', NULL, 'Eco Care Club', 7 UNION ALL
  SELECT 'CLUB', NULL, 'Drone Club', 8 UNION ALL
  SELECT 'CLUB', NULL, 'Neomutant Association', 9 UNION ALL
  SELECT 'CLUB', NULL, 'PAC PMC Club', 10 UNION ALL
  SELECT 'CLUB', NULL, 'Tamil Mandram', 11 UNION ALL
  SELECT 'CLUB', NULL, 'Young Indians', 12 UNION ALL
  SELECT 'CLUB', NULL, 'Rotaract Club', 13 UNION ALL

  SELECT 'CELL', NULL, 'Institutions Innovation Council', 1 UNION ALL
  SELECT 'CELL', NULL, 'Intellectual Property Rights Cell', 2 UNION ALL
  SELECT 'CELL', NULL, 'Consultancy', 3 UNION ALL
  SELECT 'CELL', NULL, 'Entrepreneurship Development Cell', 4 UNION ALL
  SELECT 'CELL', NULL, 'Higher Education Cell', 5 UNION ALL
  SELECT 'CELL', NULL, 'Alumni Cell', 6 UNION ALL
  SELECT 'CELL', NULL, 'National Cadet Corps (NCC) Army Wing', 7 UNION ALL
  SELECT 'CELL', NULL, 'National Cadet Corps (NCC) Air Wing', 8 UNION ALL
  SELECT 'CELL', NULL, 'National Service Scheme (NSS)', 9 UNION ALL
  SELECT 'CELL', NULL, 'Youth Red Cross (YRC)', 10 UNION ALL
  SELECT 'CELL', NULL, 'Red Ribbon Club (RRC)', 11 UNION ALL
  SELECT 'CELL', NULL, 'Unnat Bharat Abhiyan (UBA)', 12 UNION ALL
  SELECT 'CELL', NULL, 'Autonomous', 13 UNION ALL
  SELECT 'CELL', NULL, 'Internal Quality Assurance Cell', 14 UNION ALL
  SELECT 'CELL', NULL, 'Training', 15 UNION ALL
  SELECT 'CELL', NULL, 'Placement', 16 UNION ALL
  SELECT 'CELL', NULL, 'Exam Cell', 17 UNION ALL
  SELECT 'CELL', NULL, 'Admission', 18 UNION ALL
  SELECT 'CELL', NULL, 'NPTEL', 19 UNION ALL
  SELECT 'CELL', NULL, 'Women Empowerment Cell', 20 UNION ALL
  SELECT 'CELL', NULL, 'Press & Media', 21 UNION ALL

  SELECT 'PROFESSIONAL_BODY', NULL, 'ICT Academy', 1 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Indian Society for Technical Education', 2 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'The Institution of Engineers (India)', 3 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Institute of Electrical and Electronics Engineers', 4 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Institution of Electronics and Telecommunication Engineers', 5 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Indian Welding Society', 6 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'American Society of Mechanical Engineers', 7 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'SAE Collegiate Club', 8 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Textile Association of India', 9 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Madras Management Association', 10 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'IEEE Engineering in Medicine and Biology Society', 11 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Confederation of Indian Industry', 12 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Indian Concrete Institute', 13 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Indian Geotechnical Society', 14 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Association of Food Scientist & Technologists (India)', 15 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'Microbiologists Society, India', 16 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'The Indian Society of Heating, Refrigerating and Air Conditioning Engineers (ISHRAE)', 17 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'The Indian Institute of Welding (IIW - India)', 18 UNION ALL
  SELECT 'PROFESSIONAL_BODY', NULL, 'The Institute of Indian Foundrymen (IIF)', 19
) e
JOIN master_entity_types met ON met.code = e.type_code;

INSERT INTO master_entity_contacts (entity_id, role, email, is_primary)
SELECT me.id, c.role, c.email, c.is_primary
FROM (
  SELECT 'Centre for Research & Development' AS entity_name, 'office' AS role, 'headcfrd@ksrct.ac.in' AS email, 1 AS is_primary UNION ALL
  SELECT 'Centre for Sustainable Development Goals', 'office', 'sdg@ksrct.ac.in', 1 UNION ALL
  SELECT 'AICTE IDEA Lab', 'office', 'idealab@ksrct.ac.in', 1 UNION ALL
  SELECT 'Centre for IT Infrastructure', 'office', 'directorium@ksrct.ac.in', 1 UNION ALL
  SELECT 'KSRCT MSME Business Incubator', 'office', 'msme@ksrct.ac.in', 1 UNION ALL
  SELECT 'KSRCT ACIC Incubation Foundation', 'office', 'acic@ksrct.ac.in', 1 UNION ALL

  SELECT 'Cultural Club', 'office', 'culturalclub@ksrct.ac.in', 1 UNION ALL
  SELECT 'LifX Club', 'office', 'lifxclub@ksrct.ac.in', 1 UNION ALL

  SELECT 'Institutions Innovation Council', 'office', 'iic@ksrct.ac.in', 1 UNION ALL
  SELECT 'Intellectual Property Rights Cell', 'office', 'iprpolicy@ksrct.ac.in', 1 UNION ALL
  SELECT 'Consultancy', 'office', 'consultancy@ksrct.ac.in', 1 UNION ALL
  SELECT 'Entrepreneurship Development Cell', 'office', 'edc@ksrct.ac.in', 1 UNION ALL
  SELECT 'Higher Education Cell', 'office', 'hec@ksrct.ac.in', 1 UNION ALL
  SELECT 'Alumni Cell', 'office', 'alumni@ksrct.ac.in', 1 UNION ALL
  SELECT 'National Cadet Corps (NCC) Army Wing', 'office', 'nccarmy@ksrct.ac.in', 1 UNION ALL
  SELECT 'National Cadet Corps (NCC) Air Wing', 'office', 'nccairwing@ksrct.ac.in', 1 UNION ALL
  SELECT 'National Service Scheme (NSS)', 'office', 'nss@ksrct.ac.in', 1 UNION ALL
  SELECT 'Autonomous', 'office', 'autonomous@ksrct.ac.in', 1 UNION ALL
  SELECT 'Internal Quality Assurance Cell', 'office', 'iqac@ksrct.ac.in', 1 UNION ALL
  SELECT 'Training', 'office', 'training@ksrct.ac.in', 1 UNION ALL
  SELECT 'Placement', 'office', 'placement@ksrct.ac.in', 1 UNION ALL
  SELECT 'Exam Cell', 'office', 'examcell@ksrct.ac.in', 1 UNION ALL
  SELECT 'Admission', 'office', 'admission@ksrct.ac.in', 1 UNION ALL
  SELECT 'NPTEL', 'office', 'spocnptel@ksrct.ac.in', 1 UNION ALL
  SELECT 'Press & Media', 'office', 'press@ksrct.ac.in', 1
) c
JOIN master_entities me ON me.name = c.entity_name;

-- =====================================================
-- APPROVAL FLOW CONFIG
-- =====================================================

CREATE TABLE approval_flow_config (
  id INT NOT NULL AUTO_INCREMENT,
  beneficiary_type VARCHAR(100) NOT NULL,
  entity_type_code VARCHAR(50) NULL COMMENT 'CELL, CLUB, CENTRE, PROFESSIONAL_BODY',
  module ENUM('BUDGET', 'FINANCE', 'BOTH') NOT NULL DEFAULT 'BOTH',
  requires_hod TINYINT(1) NOT NULL DEFAULT 0,
  requires_dof TINYINT(1) NOT NULL DEFAULT 1,
  requires_principal TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_approval_flow (beneficiary_type, entity_type_code, module),
  KEY idx_approval_flow_type (beneficiary_type),
  KEY idx_approval_flow_entity_type (entity_type_code),
  KEY idx_approval_flow_module (module),
  KEY idx_approval_flow_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO approval_flow_config (
  beneficiary_type,
  entity_type_code,
  module,
  requires_hod,
  requires_dof,
  requires_principal
) VALUES
  ('Faculty', NULL, 'BOTH', 1, 1, 1),
  ('Department', NULL, 'BOTH', 1, 1, 1),
  ('Centre', 'CENTRE', 'BOTH', 0, 1, 1),
  ('Cell', 'CELL', 'BOTH', 0, 1, 1),
  ('Club', 'CLUB', 'BOTH', 0, 1, 1),
  ('Professional Body', 'PROFESSIONAL_BODY', 'BOTH', 0, 1, 0),
  ('Institution', NULL, 'BOTH', 0, 1, 1);

-- =====================================================
-- BUDGET TABLES
-- =====================================================

CREATE TABLE budget_proposals (
  id INT NOT NULL AUTO_INCREMENT,
  proposal_ref VARCHAR(20) NOT NULL,
  fiscal_year YEAR NOT NULL,
  employee_id INT NOT NULL,
  user_id INT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  request_date DATE NOT NULL,

  beneficiary_type VARCHAR(100) NOT NULL,
  beneficiary_value VARCHAR(255) DEFAULT NULL,
  beneficiary_entity_id INT DEFAULT NULL,
  department_id INT DEFAULT NULL,

  proposal_description TEXT,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,

  approval_flow VARCHAR(50) NOT NULL DEFAULT 'dof_principal',
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  current_stage VARCHAR(20) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_proposals_ref (proposal_ref),
  KEY idx_budget_proposals_fiscal_year (fiscal_year),
  KEY idx_budget_proposals_user_email (user_email),
  KEY idx_budget_proposals_user_id (user_id),
  KEY idx_budget_proposals_status (status),
  KEY idx_budget_proposals_stage (current_stage),
  KEY idx_budget_proposals_beneficiary_type (beneficiary_type),
  KEY idx_budget_proposals_beneficiary_entity (beneficiary_entity_id),
  KEY idx_budget_proposals_department_id (department_id),
  KEY idx_budget_proposals_approval_flow (approval_flow),
  KEY idx_budget_proposals_created_at (created_at),
  KEY idx_budget_proposals_fy_status (fiscal_year, status),
  KEY idx_budget_proposals_flow_stage (approval_flow, current_stage),

  CONSTRAINT fk_budget_proposals_department FOREIGN KEY (department_id)
    REFERENCES master_departments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_budget_proposals_entity FOREIGN KEY (beneficiary_entity_id)
    REFERENCES master_entities(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budget_proposal_refs (
  id INT NOT NULL AUTO_INCREMENT,
  proposal_id INT NULL COMMENT 'NULL for year tracker row',
  ref_year YEAR NOT NULL,
  ref_sequence INT NOT NULL DEFAULT 0,
  proposal_ref VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_proposal_refs_proposal_id (proposal_id),
  UNIQUE KEY uq_budget_proposal_refs_ref (proposal_ref),
  UNIQUE KEY uq_budget_proposal_refs_year_seq (ref_year, ref_sequence),
  KEY idx_budget_proposal_refs_year (ref_year),
  KEY idx_budget_proposal_refs_sequence (ref_year, ref_sequence),
  CONSTRAINT fk_budget_proposal_refs_proposal FOREIGN KEY (proposal_id)
    REFERENCES budget_proposals(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budget_proposal_lines (
  id INT NOT NULL AUTO_INCREMENT,
  budget_proposal_id INT NOT NULL,
  budget_head VARCHAR(255) NOT NULL,
  sub_head VARCHAR(255) NOT NULL,
  unit_amount DECIMAL(15,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total DECIMAL(15,2) NOT NULL,
  line_description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_proposal_lines_proposal (budget_proposal_id),
  KEY idx_budget_proposal_lines_head (budget_head),
  CONSTRAINT fk_budget_proposal_lines_proposal FOREIGN KEY (budget_proposal_id)
    REFERENCES budget_proposals(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budget_line_month_allocations (
  id INT NOT NULL AUTO_INCREMENT,
  budget_line_id INT NOT NULL,
  month ENUM('Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar') NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_line_month_allocations_line_month (budget_line_id, month),
  KEY idx_budget_line_month_allocations_month (month),
  CONSTRAINT fk_budget_line_month_allocations_line FOREIGN KEY (budget_line_id)
    REFERENCES budget_proposal_lines(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budget_proposal_approvals (
  id INT NOT NULL AUTO_INCREMENT,
  budget_proposal_id INT NOT NULL,
  role VARCHAR(20) NOT NULL,
  approver_user_id INT NOT NULL,
  approver_email VARCHAR(255) NOT NULL,
  decision VARCHAR(20) NOT NULL,
  feedback TEXT NULL,
  allows_edit TINYINT(1) NOT NULL DEFAULT 0,
  decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_budget_proposal_approvals_proposal (budget_proposal_id),
  KEY idx_budget_proposal_approvals_role_decision (role, decision),
  KEY idx_budget_proposal_approvals_decided_at (decided_at),
  KEY idx_budget_proposal_approvals_approver (approver_user_id),
  CONSTRAINT fk_budget_proposal_approvals_proposal FOREIGN KEY (budget_proposal_id)
    REFERENCES budget_proposals(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- COMPATIBILITY VIEWS FOR ENTITY MASTERS
-- =====================================================

CREATE OR REPLACE VIEW master_cells AS
SELECT
  me.id,
  me.code,
  me.name,
  me.is_active,
  me.sort_order,
  me.created_at,
  me.updated_at
FROM master_entities me
JOIN master_entity_types met ON me.entity_type_id = met.id
WHERE met.code = 'CELL';

CREATE OR REPLACE VIEW master_clubs AS
SELECT
  me.id,
  me.code,
  me.name,
  me.is_active,
  me.sort_order,
  me.created_at,
  me.updated_at
FROM master_entities me
JOIN master_entity_types met ON me.entity_type_id = met.id
WHERE met.code = 'CLUB';

CREATE OR REPLACE VIEW master_centres AS
SELECT
  me.id,
  me.code,
  me.name,
  me.is_active,
  me.sort_order,
  me.created_at,
  me.updated_at
FROM master_entities me
JOIN master_entity_types met ON me.entity_type_id = met.id
WHERE met.code = 'CENTRE';

CREATE OR REPLACE VIEW master_professional_bodies AS
SELECT
  me.id,
  me.code,
  me.name,
  me.is_active,
  me.sort_order,
  me.created_at,
  me.updated_at
FROM master_entities me
JOIN master_entity_types met ON me.entity_type_id = met.id
WHERE met.code = 'PROFESSIONAL_BODY';

-- =====================================================
-- BUDGET SUMMARY VIEW
-- =====================================================

CREATE OR REPLACE VIEW v_budget_summary AS
SELECT
  bp.id,
  bp.proposal_ref,
  bp.fiscal_year,
  bp.beneficiary_type,
  bp.beneficiary_value,
  bp.beneficiary_entity_id,
  bp.department_id,
  md.name AS department,
  md.code AS department_code,
  me.name AS entity_name,
  me.code AS entity_code,
  met.name AS entity_type_name,
  met.code AS entity_type_code,
  bp.total_amount,
  bp.status,
  bp.current_stage,
  bp.approval_flow,
  bp.user_id,
  bp.user_email,
  COUNT(DISTINCT bpl.id) AS line_count,
  COUNT(DISTINCT bpa.id) AS approval_count,
  SUM(bpl.line_total) AS calculated_total,
  bp.created_at,
  bp.updated_at
FROM budget_proposals bp
LEFT JOIN master_departments md ON bp.department_id = md.id
LEFT JOIN master_entities me ON bp.beneficiary_entity_id = me.id
LEFT JOIN master_entity_types met ON me.entity_type_id = met.id
LEFT JOIN budget_proposal_lines bpl ON bp.id = bpl.budget_proposal_id
LEFT JOIN budget_proposal_approvals bpa ON bp.id = bpa.budget_proposal_id
GROUP BY
  bp.id,
  bp.proposal_ref,
  bp.fiscal_year,
  bp.beneficiary_type,
  bp.beneficiary_value,
  bp.beneficiary_entity_id,
  bp.department_id,
  md.name,
  md.code,
  me.name,
  me.code,
  met.name,
  met.code,
  bp.total_amount,
  bp.status,
  bp.current_stage,
  bp.approval_flow,
  bp.user_id,
  bp.user_email,
  bp.created_at,
  bp.updated_at;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'master_entity_types' AS table_name, COUNT(*) AS count FROM master_entity_types
UNION ALL
SELECT 'master_entities', COUNT(*) FROM master_entities
UNION ALL
SELECT 'master_entity_contacts', COUNT(*) FROM master_entity_contacts
UNION ALL
SELECT 'approval_flow_config', COUNT(*) FROM approval_flow_config
UNION ALL
SELECT 'budget_proposals', COUNT(*) FROM budget_proposals;
