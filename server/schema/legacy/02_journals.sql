/* ============================================================
   02_journals.sql
   MODULE: Journal Publications
   PURPOSE: Defines tables for tracking academic papers, publishers,
            affiliations (faculty/student), indexing databases,
            and publication approval requests.
   Date: June 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS journal_status_updates;
DROP TABLE IF EXISTS journal_requests;
DROP TABLE IF EXISTS journal_indexes;
DROP TABLE IF EXISTS author_journal;
DROP TABLE IF EXISTS author_students;
DROP TABLE IF EXISTS authors;
DROP TABLE IF EXISTS journal_options;
DROP TABLE IF EXISTS journals;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. JOURNAL META-REGISTRY (OPTIONS)
   ============================================================ */

/* 1.1 JOURNAL OPTIONS (Master List of Journals) */
CREATE TABLE journal_options (
  id INT NOT NULL AUTO_INCREMENT,
  journal_name VARCHAR(255) NOT NULL COMMENT 'Official name of the academic journal',
  publisher VARCHAR(255) DEFAULT NULL COMMENT 'Publishing house or society',
  website VARCHAR(255) DEFAULT NULL COMMENT 'Official homepage URL of the journal',
  print_issn VARCHAR(20) DEFAULT NULL COMMENT 'Print ISSN identifier',
  online_issn VARCHAR(20) DEFAULT NULL COMMENT 'Online ISSN identifier',
  impact_factor DECIMAL(10,3) DEFAULT NULL COMMENT 'Web of Science Impact Factor',
  cite_score DECIMAL(10,3) DEFAULT NULL COMMENT 'Scopus CiteScore value',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category ENUM('National', 'International') NOT NULL DEFAULT 'National' COMMENT 'Geographical scope of the journal',
  PRIMARY KEY (id),
  KEY idx_journal_options_name (journal_name),
  KEY idx_journal_options_publisher (publisher)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. AUTHORS & AFFILIATIONS
   ============================================================ */

/* 2.1 STUDENT AUTHORS */
CREATE TABLE author_students (
  id INT NOT NULL AUTO_INCREMENT,
  student_unique_id VARCHAR(255) NOT NULL COMMENT 'Unique Student Registration or Roll Number',
  name VARCHAR(255) NOT NULL COMMENT 'Full name of the student author',
  department VARCHAR(255) DEFAULT '' COMMENT 'Academic department name',
  organization VARCHAR(255) DEFAULT '' COMMENT 'College/Institution name',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY student_unique_id (student_unique_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.2 AUTHORS MASTER (Faculty & External) */
CREATE TABLE authors (
  id INT NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) DEFAULT NULL COMMENT 'Author email address',
  author_id VARCHAR(255) DEFAULT NULL COMMENT 'Employee Code or External identifier',
  designation VARCHAR(100) DEFAULT '' COMMENT 'Professional designation (Professor, Scholar)',
  name VARCHAR(255) NOT NULL COMMENT 'Full name of the author',
  department VARCHAR(255) DEFAULT '' COMMENT 'Academic department name',
  organization VARCHAR(255) DEFAULT '' COMMENT 'Institution / University affiliation',
  country VARCHAR(100) DEFAULT '' COMMENT 'Country of affiliate organization',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  state VARCHAR(100) DEFAULT '' COMMENT 'State of affiliate organization',
  student_ref INT DEFAULT NULL COMMENT 'Link to author_students table if they are a student',
  PRIMARY KEY (id),
  UNIQUE KEY author_id (author_id),
  KEY idx_author_id (author_id),
  KEY fk_authors_student_ref (student_ref),
  CONSTRAINT fk_authors_student_ref 
    FOREIGN KEY (student_ref) REFERENCES author_students (id) 
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. JOURNAL PUBLICATIONS
   ============================================================ */

/* 3.1 JOURNALS TABLE (Core Publication Record) */
CREATE TABLE journals (
  id INT NOT NULL AUTO_INCREMENT,
  category VARCHAR(50) NOT NULL COMMENT 'Classification like Journal, Book, or Conference Proceeding',
  title VARCHAR(255) NOT NULL COMMENT 'Title of the research paper',
  book_chapter_title VARCHAR(255) DEFAULT NULL COMMENT 'Title of book chapter (if applicable)',
  publication_details JSON DEFAULT NULL COMMENT 'JSON storage of publisher metadata and details',
  type VARCHAR(100) NOT NULL COMMENT 'Type of article (e.g. Original Research, Review)',
  quartile VARCHAR(2) DEFAULT NULL COMMENT 'Journal Scimago Quartile (Q1, Q2, Q3, Q4)',
  impact_factor DECIMAL(10,3) DEFAULT NULL COMMENT 'Snapshot of impact factor at publication time',
  cite_score DECIMAL(10,3) DEFAULT NULL COMMENT 'Snapshot of cite score at publication time',
  anna_university_listed TINYINT(1) DEFAULT NULL COMMENT 'Boolean flag indicating Anna University Annexure listing',
  anna_university_annexure_no VARCHAR(50) DEFAULT NULL COMMENT 'Specific Annexure list number reference',
  acknowledgement JSON DEFAULT NULL COMMENT 'Funding or college name acknowledgement details',
  date_of_submission DATE DEFAULT NULL COMMENT 'Initial submission date',
  status VARCHAR(50) DEFAULT 'waiting' COMMENT 'Workflow state (waiting, approved, published)',
  volume VARCHAR(50) DEFAULT NULL COMMENT 'Journal volume number',
  issue VARCHAR(50) DEFAULT NULL COMMENT 'Journal issue number',
  issue_type VARCHAR(50) DEFAULT NULL COMMENT 'Type of issue (Regular, Special, Festschrift)',
  pages_from INT DEFAULT NULL COMMENT 'Start page number',
  pages_to INT DEFAULT NULL COMMENT 'End page number',
  article_number VARCHAR(50) DEFAULT NULL COMMENT 'Article identifier number (for electronic journals)',
  abstract TEXT COMMENT 'Abstract / summary of the paper',
  keywords TEXT COMMENT 'Keywords for database search index',
  sdgs JSON DEFAULT NULL COMMENT 'Sustainable Development Goals (SDGs) mapped to this publication',
  doi VARCHAR(255) DEFAULT NULL COMMENT 'Digital Object Identifier URL or code',
  accepted_date DATE DEFAULT NULL COMMENT 'Date the paper was accepted',
  available_online_date DATE DEFAULT NULL COMMENT 'Date the paper was published online',
  file_path VARCHAR(255) DEFAULT NULL COMMENT 'Upload path of the published PDF',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  author_affiliation JSON DEFAULT NULL COMMENT 'Affiliation details of the authors',
  external_details JSON DEFAULT NULL COMMENT 'Metadata for external collaborations',
  journal_options_id INT NOT NULL COMMENT 'Link to the journal metadata options registry',
  driven_by ENUM('faculty', 'student') DEFAULT 'faculty' COMMENT 'Who led the submission (Faculty or Student)',
  credit_to VARCHAR(255) DEFAULT NULL COMMENT 'Entities credited for the submission',
  reference_number VARCHAR(255) DEFAULT NULL COMMENT 'Internal reference tracking number',
  PRIMARY KEY (id),
  KEY fk_journal_options (journal_options_id),
  CONSTRAINT fk_journal_options 
    FOREIGN KEY (journal_options_id) REFERENCES journal_options (id)
      ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.2 AUTHOR JOURNAL RELATIONS (Many-to-Many) */
CREATE TABLE author_journal (
  id INT NOT NULL AUTO_INCREMENT,
  author_id INT DEFAULT NULL,
  journal_id INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  is_first_author TINYINT(1) DEFAULT '0' COMMENT 'Indicates if this author is the primary first author',
  is_primary TINYINT(1) DEFAULT '0' COMMENT 'Indicates if this is the corresponding author',
  PRIMARY KEY (id),
  UNIQUE KEY unique_author_journal (author_id, journal_id),
  KEY idx_journal (journal_id),
  KEY idx_author (author_id),
  CONSTRAINT author_journal_ibfk_1 
    FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE,
  CONSTRAINT author_journal_ibfk_2 
    FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.3 JOURNAL INDEX DATABASES (Scopus, WoS, UGC, etc.) */
CREATE TABLE journal_indexes (
  id INT NOT NULL AUTO_INCREMENT,
  journal_id INT DEFAULT NULL,
  index_name VARCHAR(50) DEFAULT NULL COMMENT 'Indexing body name (Scopus, Web of Science, UGC-CARE, SCI)',
  PRIMARY KEY (id),
  KEY journal_id (journal_id),
  CONSTRAINT journal_indexes_ibfk_1 
    FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. WORKFLOWS & ADD REQUESTS
   ============================================================ */

/* 4.1 JOURNAL OPTIONS ADD REQUESTS (Submit New Journal Request) */
CREATE TABLE journal_requests (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'User requesting the new journal addition',
  journal_name VARCHAR(255) NOT NULL COMMENT 'Proposed journal name',
  publisher VARCHAR(255) DEFAULT NULL COMMENT 'Publisher of the proposed journal',
  website VARCHAR(255) DEFAULT NULL,
  print_issn VARCHAR(20) DEFAULT NULL,
  online_issn VARCHAR(20) DEFAULT NULL,
  impact_factor DECIMAL(10,3) DEFAULT NULL,
  cite_score DECIMAL(10,3) DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'Admin approval status',
  admin_comment TEXT COMMENT 'Feedback or rejection notes from administrator',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category ENUM('National', 'International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT journal_requests_ibfk_1 
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.2 JOURNAL STATUS UPDATES (Review History & Status Transitions) */
CREATE TABLE journal_status_updates (
  id INT NOT NULL AUTO_INCREMENT,
  journal_id INT NOT NULL,
  user_id INT NOT NULL COMMENT 'Reviewer or applicant initiating the change',
  status VARCHAR(50) NOT NULL COMMENT 'Target status transition',
  user_comment TEXT COMMENT 'Reviewer comments or justification notes',
  admin_reply TEXT COMMENT 'Admin response feedback',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_journal_id (journal_id),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT journal_status_updates_ibfk_1 
    FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE,
  CONSTRAINT journal_status_updates_ibfk_2 
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
