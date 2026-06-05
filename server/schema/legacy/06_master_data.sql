/* ============================================================
   06_master_data.sql
   MODULE: Master Data & College Registry
   PURPOSE: Defines tables for college organizational structures,
            departments, employees, specialized entities (cells,
            centres, clubs), entity contacts, and employee import
            pending queue structures.
   Date: June 6, 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS employee_import_pending;
DROP TABLE IF EXISTS master_entity_contacts;
DROP TABLE IF EXISTS master_employees;
DROP TABLE IF EXISTS master_entities;
DROP TABLE IF EXISTS master_entity_types;
DROP TABLE IF EXISTS master_departments;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. ORGANIZATIONAL REGISTRY (DEPARTMENTS)
   ============================================================ */

/* 1.1 MASTER DEPARTMENTS */
CREATE TABLE master_departments (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) DEFAULT NULL COMMENT 'Short code designation (e.g. CSE, ECE, MECH, MBA)',
  name VARCHAR(255) NOT NULL COMMENT 'Full department name',
  parent_id INT DEFAULT NULL COMMENT 'Self-referencing parent department ID (for nested divisions)',
  type ENUM('Academic', 'Administrative', 'Support', 'Research') DEFAULT 'Academic' COMMENT 'Operational division category',
  hod_name VARCHAR(255) DEFAULT NULL COMMENT 'Head of Department name (denormalized for quick reference)',
  email VARCHAR(255) DEFAULT NULL COMMENT 'Official department contact email address',
  phone VARCHAR(20) DEFAULT NULL COMMENT 'Department extension/phone number',
  is_active TINYINT(1) DEFAULT '1' COMMENT 'Status flag',
  sort_order INT DEFAULT '0' COMMENT 'Order sequence for dropdown lists',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY code (code),
  KEY idx_dept_code (code),
  KEY idx_dept_name (name),
  KEY idx_dept_parent (parent_id),
  KEY idx_dept_active (is_active),
  CONSTRAINT fk_dept_parent 
    FOREIGN KEY (parent_id) REFERENCES master_departments (id) 
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. SPECIALIZED ENTITY REGISTRY (CELLS, CENTRES, CLUBS)
   ============================================================ */

/* 2.1 ENTITY TYPES (Classification master list) */
CREATE TABLE master_entity_types (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL COMMENT 'Classification short code (e.g., CENTRE, CELL, CLUB, PROF_BODY)',
  name VARCHAR(100) NOT NULL COMMENT 'Full display name of entity type',
  is_active TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Status flag',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Order sequence for display dropdowns',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entity_types_code (code),
  KEY idx_master_entity_types_active (is_active)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.2 MASTER ENTITIES (Actual clubs, cells, centres registered) */
CREATE TABLE master_entities (
  id INT NOT NULL AUTO_INCREMENT,
  entity_type_id INT NOT NULL COMMENT 'FK link to master_entity_types',
  code VARCHAR(50) DEFAULT NULL COMMENT 'Entity unique short code',
  name VARCHAR(255) NOT NULL COMMENT 'Full name of the entity (e.g. IIC, NSS, eco-club)',
  is_active TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Status flag',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Order sequence',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entities_type_name (entity_type_id, name),
  KEY idx_master_entities_type (entity_type_id),
  KEY idx_master_entities_code (code),
  KEY idx_master_entities_active (is_active),
  CONSTRAINT fk_master_entities_type 
    FOREIGN KEY (entity_type_id) REFERENCES master_entity_types (id) 
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. HUMAN RESOURCES REGISTRY (EMPLOYEES)
   ============================================================ */

/* 3.1 MASTER EMPLOYEES (Staff profiles) */
CREATE TABLE master_employees (
  id INT NOT NULL AUTO_INCREMENT,
  erp_id VARCHAR(50) NOT NULL COMMENT 'Unique identifier linking to ERP/College system',
  title VARCHAR(20) DEFAULT NULL COMMENT 'Honorific title (Dr., Mr., Mrs., Ms., Prof.)',
  first_name VARCHAR(100) NOT NULL COMMENT 'First Name',
  last_name VARCHAR(100) DEFAULT NULL COMMENT 'Last Name / Initial',
  gender ENUM('Male', 'Female', 'Other') DEFAULT NULL,
  email VARCHAR(255) NOT NULL COMMENT 'Official college email address',
  mobile VARCHAR(20) DEFAULT NULL COMMENT 'Mobile number',
  alternate_email VARCHAR(255) DEFAULT NULL COMMENT 'Personal email address',
  designation VARCHAR(150) DEFAULT NULL COMMENT 'Official designation (Assistant Professor, HOD, etc.)',
  department_id INT DEFAULT NULL COMMENT 'FK to master_departments (primary academic unit)',
  entity_id INT DEFAULT NULL COMMENT 'FK to master_entities (for non-departmental/special unit staff)',
  parent_department_id INT DEFAULT NULL COMMENT 'FK to parent master_departments',
  employee_type ENUM('Teaching', 'Non-Teaching', 'Contract', 'Visiting', 'Guest Faculty') DEFAULT 'Teaching',
  dob DATE DEFAULT NULL COMMENT 'Date of Birth',
  doj DATE DEFAULT NULL COMMENT 'Date of Joining',
  dor DATE DEFAULT NULL COMMENT 'Date of Retirement',
  status ENUM('Active', 'Retired', 'Resigned', 'On Leave', 'Deputation', 'Terminated', 'Deceased', 'Relieved') DEFAULT 'Active' COMMENT 'Employment status',
  orcid_id VARCHAR(50) DEFAULT NULL COMMENT 'Researcher ORCID ID',
  wos_researcher_id VARCHAR(50) DEFAULT NULL COMMENT 'Web of Science Researcher ID',
  scopus_id VARCHAR(50) DEFAULT NULL COMMENT 'Scopus Author ID',
  google_scholar_id VARCHAR(100) DEFAULT NULL COMMENT 'Google Scholar Profile ID',
  research_gate_id VARCHAR(100) DEFAULT NULL COMMENT 'ResearchGate profile URL',
  user_id INT DEFAULT NULL COMMENT 'FK to users table representing authentication account',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT DEFAULT NULL COMMENT 'User who registered this profile',
  PRIMARY KEY (id),
  UNIQUE KEY erp_id (erp_id),
  UNIQUE KEY email (email),
  KEY idx_emp_erp (erp_id),
  KEY idx_emp_email (email),
  KEY idx_emp_dept (department_id),
  KEY idx_emp_status (status),
  KEY idx_emp_designation (designation),
  KEY idx_emp_name (first_name, last_name),
  KEY idx_emp_doj (doj),
  KEY idx_emp_orcid (orcid_id),
  KEY idx_emp_scopus (scopus_id),
  KEY fk_emp_user (user_id),
  KEY idx_emp_parent_dept (parent_department_id),
  KEY idx_emp_entity (entity_id),
  CONSTRAINT fk_emp_department 
    FOREIGN KEY (department_id) REFERENCES master_departments (id) 
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_emp_entity 
    FOREIGN KEY (entity_id) REFERENCES master_entities (id) 
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_emp_parent_department 
    FOREIGN KEY (parent_department_id) REFERENCES master_departments (id) 
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_emp_user 
    FOREIGN KEY (user_id) REFERENCES users (id) 
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=600 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. ENTITY COMMUNICATIONS
   ============================================================ */

/* 4.1 MASTER ENTITY CONTACTS (Emails of specialized units) */
CREATE TABLE master_entity_contacts (
  id INT NOT NULL AUTO_INCREMENT,
  entity_id INT NOT NULL COMMENT 'FK to master_entities',
  role ENUM('office', 'hod', 'finance', 'generic') NOT NULL DEFAULT 'office' COMMENT 'Target role email designation',
  email VARCHAR(255) NOT NULL COMMENT 'Contact email address',
  is_primary TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Flag indicating primary contact',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_master_entity_contacts (entity_id, role, email),
  KEY idx_master_entity_contacts_email (email),
  KEY idx_master_entity_contacts_entity (entity_id),
  CONSTRAINT fk_master_entity_contacts_entity 
    FOREIGN KEY (entity_id) REFERENCES master_entities (id) 
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   5. WORKFLOWS & DATA IMPORTS
   ============================================================ */

/* 5.1 EMPLOYEE IMPORT PENDING QUEUE (Temporary table for staging imports) */
CREATE TABLE employee_import_pending (
  id INT NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(50) NOT NULL COMMENT 'ERP id from import payload',
  email VARCHAR(255) NOT NULL COMMENT 'Imported email address',
  full_name VARCHAR(255) DEFAULT NULL COMMENT 'Imported full name',
  department_code VARCHAR(20) DEFAULT NULL COMMENT 'Department short code from payload',
  category VARCHAR(50) DEFAULT NULL COMMENT 'Designation or category descriptor',
  gender VARCHAR(20) DEFAULT NULL,
  dob DATE DEFAULT NULL,
  status VARCHAR(50) DEFAULT NULL,
  id_card_no VARCHAR(50) DEFAULT NULL,
  prime_erp_code VARCHAR(50) DEFAULT NULL COMMENT 'Primary ERP code match link',
  pending_reason VARCHAR(100) NOT NULL DEFAULT 'MISSING_PRIME_ERP' COMMENT 'Reason why import is blocked/pending review',
  source_file VARCHAR(255) DEFAULT NULL COMMENT 'Filename of source XLS/CSV',
  payload_json JSON DEFAULT NULL COMMENT 'Full JSON dump of raw import row',
  resolution_status ENUM('PENDING', 'PROMOTED', 'FAILED') NOT NULL DEFAULT 'PENDING' COMMENT 'Review resolution state',
  resolved_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when resolved',
  resolved_erp_id VARCHAR(50) DEFAULT NULL COMMENT 'Final mapped ERP code',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pending_email_employee_code (email, employee_code),
  KEY idx_pending_resolution_status (resolution_status),
  KEY idx_pending_prime_erp_code (prime_erp_code),
  KEY idx_pending_department_code (department_code)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
