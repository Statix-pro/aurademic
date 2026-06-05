/* ============================================================
   03_projects.sql
   MODULE: Research Projects & Grants
   PURPOSE: Defines tables for funded projects, proposals,
            financial contributions, grant disbursements, documents,
            collaboration agreements, options lists, and requests.
   Date: June 6, 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS project_requests;
DROP TABLE IF EXISTS project_agency_type_options;
DROP TABLE IF EXISTS project_scheme_options;
DROP TABLE IF EXISTS project_agency_options;
DROP TABLE IF EXISTS project_documents;
DROP TABLE IF EXISTS project_grant_disbursements;
DROP TABLE IF EXISTS project_details;
DROP TABLE IF EXISTS project_collaborations;
DROP TABLE IF EXISTS project_financial_contributions;
DROP TABLE IF EXISTS author_project;
DROP TABLE IF EXISTS research_projects;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. MASTER CONFIG & METADATA OPTIONS
   ============================================================ */

/* 1.1 AGENCY OPTIONS (Funding agencies like DST, AICTE, ISRO) */
CREATE TABLE project_agency_options (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL COMMENT 'Funding Agency Name',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.2 SCHEME OPTIONS (Funding schemes under agencies) */
CREATE TABLE project_scheme_options (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL COMMENT 'Scheme Name (e.g., RPS, FIST, MODROB)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.3 AGENCY TYPE OPTIONS (Government, Private, Non-Government, etc.) */
CREATE TABLE project_agency_type_options (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT 'Classification of Agency (e.g. Govt, Private, NGO)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. CORE PROJECTS REGISTRY
   ============================================================ */

/* 2.1 RESEARCH PROJECTS */
CREATE TABLE research_projects (
  id INT NOT NULL AUTO_INCREMENT,
  project_category VARCHAR(50) NOT NULL COMMENT 'Main category (e.g., Sponsored, Consultancy)',
  category VARCHAR(50) NOT NULL COMMENT 'Sub-category classification',
  title VARCHAR(255) NOT NULL COMMENT 'Research Project Title',
  duration_years INT DEFAULT NULL COMMENT 'Planned project duration (Years)',
  duration_months INT DEFAULT NULL COMMENT 'Planned project duration (Months)',
  duration_days INT DEFAULT NULL COMMENT 'Planned project duration (Days)',
  date_of_submission DATE DEFAULT NULL COMMENT 'Proposal submission date',
  submission_status VARCHAR(50) DEFAULT 'waiting' COMMENT 'Approval/Submission status (waiting, approved, ongoing, completed)',
  is_collaboration_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating multi-institutional collaboration',
  file_path VARCHAR(255) DEFAULT NULL COMMENT 'Path of the submitted proposal PDF document',
  application_number VARCHAR(255) DEFAULT NULL COMMENT 'Project application/proposal reference number',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  agency_id INT DEFAULT NULL COMMENT 'Link to project_agency_options',
  scheme_id INT DEFAULT NULL COMMENT 'Link to project_scheme_options',
  PRIMARY KEY (id),
  KEY fk_agency_id (agency_id),
  KEY fk_scheme_id (scheme_id),
  CONSTRAINT fk_agency_id FOREIGN KEY (agency_id) REFERENCES project_agency_options (id),
  CONSTRAINT fk_scheme_id FOREIGN KEY (scheme_id) REFERENCES project_scheme_options (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.2 AUTHOR PROJECT RELATIONS (Principal Investigators and Co-PIs) */
CREATE TABLE author_project (
  id INT NOT NULL AUTO_INCREMENT,
  author_id INT DEFAULT NULL,
  project_id INT DEFAULT NULL,
  is_principal TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating if the author is the Principal Investigator (PI)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  is_primary TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating primary corresponding contributor',
  PRIMARY KEY (id),
  UNIQUE KEY unique_author_project (author_id, project_id),
  KEY idx_project (project_id),
  KEY idx_author (author_id),
  CONSTRAINT author_project_ibfk_1 FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE,
  CONSTRAINT author_project_ibfk_2 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. FINANCIAL DETAILS & CONTRIBUTIONS
   ============================================================ */

/* 3.1 FINANCIAL CONTRIBUTIONS (Sponsors and agencies breakdown) */
CREATE TABLE project_financial_contributions (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT DEFAULT NULL,
  agency VARCHAR(255) DEFAULT NULL COMMENT 'Agency name providing contribution',
  amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Amount contributed by this agency',
  agency_type_id INT DEFAULT NULL COMMENT 'Link to project_agency_type_options',
  PRIMARY KEY (id),
  KEY project_id (project_id),
  KEY fk_agency_type_id (agency_type_id),
  CONSTRAINT fk_agency_type_id FOREIGN KEY (agency_type_id) REFERENCES project_agency_type_options (id),
  CONSTRAINT project_financial_contributions_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.2 GRANT DISBURSEMENTS (Tranches and releases over fiscal years) */
CREATE TABLE project_grant_disbursements (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT DEFAULT NULL,
  fiscal_year VARCHAR(10) DEFAULT NULL COMMENT 'Fiscal Year of disbursement (e.g. 2025-26)',
  agency VARCHAR(255) DEFAULT NULL COMMENT 'Agency releasing the funds',
  amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Amount released in this tranche',
  disbursement_date DATE DEFAULT NULL COMMENT 'Date funds were credited/released',
  sanction_letter_path VARCHAR(255) DEFAULT NULL COMMENT 'File upload path for the sanction letter',
  uc_and_soe_path VARCHAR(255) DEFAULT NULL COMMENT 'File upload path for Utilization Certificate and Statement of Expenditure',
  PRIMARY KEY (id),
  UNIQUE KEY idx_project_disbursement (project_id, fiscal_year, agency, amount, disbursement_date),
  CONSTRAINT project_grant_disbursements_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. COLLABORATIONS, PROGRESS & DOCUMENTATION
   ============================================================ */

/* 4.1 PROJECT COLLABORATIONS (Joint research agreements) */
CREATE TABLE project_collaborations (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT DEFAULT NULL,
  partner VARCHAR(255) DEFAULT NULL COMMENT 'Collaborator institution or partner name',
  address VARCHAR(255) DEFAULT NULL COMMENT 'Address of collaborating partner',
  support VARCHAR(50) NOT NULL COMMENT 'Type of support (e.g. Financial, Technical, Infrastructure)',
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_collaborations_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.2 PROJECT SANCTION DETAILS */
CREATE TABLE project_details (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT DEFAULT NULL,
  date_of_presentation DATE DEFAULT NULL COMMENT 'Presentation date to technical committee',
  date_of_result_announcement DATE DEFAULT NULL COMMENT 'Result or approval announcement date',
  sanction_order_amount DECIMAL(15,2) DEFAULT NULL COMMENT 'Total sanctioned amount',
  sanction_order_date DATE DEFAULT NULL COMMENT 'Sanction order signature/issue date',
  project_duration_start_date DATE DEFAULT NULL COMMENT 'Official project start date',
  project_duration_end_date DATE DEFAULT NULL COMMENT 'Official project completion date',
  outcome_type VARCHAR(150) NOT NULL COMMENT 'Expected project outcome (e.g., Patent, Publication, Product)',
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_details_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.3 PROJECT DOCUMENTS (Sanction, UC, SOE, reports) */
CREATE TABLE project_documents (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT DEFAULT NULL,
  document_type ENUM('sanctionOrder', 'utilizationCertificate', 'statementOfExpenditure', 'projectReport', 'bankStatement', 'sanctionLetter', 'ucAndSoe') DEFAULT NULL COMMENT 'Classification of uploaded project document',
  file_path VARCHAR(255) DEFAULT NULL COMMENT 'Upload path of the document',
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_documents_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   5. OPTION ADD REQUESTS
   ============================================================ */

/* 5.1 PROJECT COMPONENT ADD REQUESTS */
CREATE TABLE project_requests (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'User requesting the new metadata option',
  request_type ENUM('agency', 'scheme', 'agency_type') NOT NULL COMMENT 'The category of option being requested',
  name VARCHAR(255) NOT NULL COMMENT 'Proposed name of the agency or scheme',
  description TEXT COMMENT 'Explanation or reasoning for adding the option',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Admin approval status',
  admin_comment TEXT COMMENT 'Review feedback from the admin',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_user_id (user_id),
  KEY idx_request_type (request_type),
  KEY idx_created_at (created_at),
  CONSTRAINT project_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;