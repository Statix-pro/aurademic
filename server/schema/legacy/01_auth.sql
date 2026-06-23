/* ============================================================
   01_auth.sql
   MODULE: Authentication & User Profiles
   PURPOSE: Defines tables for user identities, admin status,
            and edit requests for research entities.
   Date: June 6, 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS edit_requests;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. USER IDENTITIES & AUTH
   ============================================================ */

/* 1.1 USERS TABLE */
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL COMMENT 'Primary login identifier (Google OAuth or Azure MSAL)',
  name VARCHAR(255) NOT NULL COMMENT 'Full name of the user',
  picture VARCHAR(512) DEFAULT NULL COMMENT 'URL to user avatar profile picture',
  is_admin TINYINT(1) DEFAULT '0' COMMENT 'Legacy boolean admin flag (use roles for granular permissions)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  last_login TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of last successful authentication',
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. DATA CORRECTION & EDIT WORKFLOWS
   ============================================================ */

/* 2.1 EDIT REQUESTS */
CREATE TABLE edit_requests (
  id INT NOT NULL AUTO_INCREMENT,
  entity_type ENUM('journals', 'research_projects') NOT NULL COMMENT 'Target entity type being edited',
  entity_id INT NOT NULL COMMENT 'Target foreign key id inside the respective entity table',
  user_id INT NOT NULL COMMENT 'Applicant requesting the edit/modification',
  status ENUM('pending', 'approved', 'rejected', 'none') NOT NULL COMMENT 'Approval workflow status',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Submission date',
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Resolution or modification date',
  PRIMARY KEY (id),
  KEY user_id (user_id),
  KEY entity_type_id_index (entity_type, entity_id),
  CONSTRAINT edit_requests_ibfk_1 
    FOREIGN KEY (user_id) REFERENCES users (id)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;