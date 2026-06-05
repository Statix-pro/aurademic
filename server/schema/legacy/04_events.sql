/* ============================================================
   04_events.sql
   MODULE: Academic Events, Pre-Event Planning & Finance
   PURPOSE: Defines tables for organizing and tracking college events,
            pre-event planning details, event types, collaborating
            departments, target audience, SDGs, publicity channels,
            coordinators, budgets, participants, and event finance records.
   Date: June 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS youtube_links;
DROP TABLE IF EXISTS important_links;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS letters;
DROP TABLE IF EXISTS resource_persons;
DROP TABLE IF EXISTS publicity;
DROP TABLE IF EXISTS finance_docs;
DROP TABLE IF EXISTS finance_sponsors;
DROP TABLE IF EXISTS finance_expenditure;
DROP TABLE IF EXISTS events_uploads;
DROP TABLE IF EXISTS finance_income;
DROP TABLE IF EXISTS finance;
DROP TABLE IF EXISTS coordinators;
DROP TABLE IF EXISTS collaborations;
DROP TABLE IF EXISTS sdgs;
DROP TABLE IF EXISTS themes;
DROP TABLE IF EXISTS target_audience;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS event_types;
DROP TABLE IF EXISTS pre_events;
DROP TABLE IF EXISTS events;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. CORE EVENTS REGISTRY
   ============================================================ */

/* 1.1 EVENTS TABLE */
CREATE TABLE events (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) DEFAULT 'Untitled Event' COMMENT 'Official Title of the Event',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft' COMMENT 'Overall workflow approval status of the event',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.2 PRE-EVENTS PLANNING REGISTRY */
CREATE TABLE pre_events (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL COMMENT 'Event proposal title',
  start_date DATE DEFAULT NULL COMMENT 'Event start date',
  end_date DATE DEFAULT NULL COMMENT 'Event completion date',
  inaugural_date DATE DEFAULT NULL COMMENT 'Inaugural ceremony date',
  inaugural_time TIME DEFAULT NULL COMMENT 'Inaugural ceremony time',
  inaugural_venue VARCHAR(255) DEFAULT NULL COMMENT 'Inaugural ceremony physical/virtual venue',
  valedictory_date DATE DEFAULT NULL COMMENT 'Valedictory ceremony date',
  valedictory_time TIME DEFAULT NULL COMMENT 'Valedictory ceremony time',
  valedictory_venue VARCHAR(255) DEFAULT NULL COMMENT 'Valedictory ceremony physical/virtual venue',
  mode ENUM('Physical', 'Virtual', 'Hybrid') DEFAULT NULL COMMENT 'Event execution mode',
  meeting_link VARCHAR(500) DEFAULT NULL COMMENT 'Virtual meeting conference link (e.g. Zoom, Meet)',
  level ENUM('international', 'national', 'state', 'district', 'intra_college') DEFAULT NULL COMMENT 'Scope or reach of the event',
  description TEXT COMMENT 'Detailed objective and description of the event',
  expected_participants INT DEFAULT NULL COMMENT 'Forecasted number of attendees',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pre_events_level (level),
  KEY idx_pre_events_mode (mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. PLANNING DETAILS & METADATA (Linked to Pre-Events)
   ============================================================ */

/* 2.1 EVENT TYPES */
CREATE TABLE event_types (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  type_name VARCHAR(255) NOT NULL COMMENT 'Event type (e.g., Seminar, Workshop, Conference, FDP)',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT event_types_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.2 DEPARTMENTS (Organizing & Collaborating departments for the event) */
CREATE TABLE departments (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  name VARCHAR(255) NOT NULL COMMENT 'Name of the organizing/collaborating department',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT departments_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.3 TARGET AUDIENCE */
CREATE TABLE target_audience (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  audience VARCHAR(255) NOT NULL COMMENT 'Target demographic (e.g. UG Students, PG Students, Faculty, Industry)',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT target_audience_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.4 THEMES (Areas and tracks covered) */
CREATE TABLE themes (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  theme VARCHAR(255) NOT NULL COMMENT 'Scientific track or theme name',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT themes_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.5 SDGs (UN Sustainable Development Goals alignment) */
CREATE TABLE sdgs (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  sdg_name VARCHAR(255) NOT NULL COMMENT 'UN SDG Goal Title or Number',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT sdgs_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.6 COLLABORATIONS (External partners and corporate sponsors) */
CREATE TABLE collaborations (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  collaborator VARCHAR(255) NOT NULL COMMENT 'Collaborator organization name',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT collaborations_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.7 COORDINATORS (Faculty and staff event coordinators) */
CREATE TABLE coordinators (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  name VARCHAR(255) NOT NULL COMMENT 'Coordinator full name',
  email VARCHAR(255) DEFAULT NULL COMMENT 'Coordinator email',
  department VARCHAR(255) DEFAULT NULL COMMENT 'Coordinator department',
  mobile VARCHAR(15) DEFAULT NULL COMMENT 'Coordinator mobile number',
  phone VARCHAR(50) DEFAULT NULL COMMENT 'Coordinator alternative phone number',
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  KEY idx_coordinators_department (department),
  CONSTRAINT coordinators_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.8 PRE-EVENT BUDGETS PROPOSALS (Estimated requirements) */
CREATE TABLE budgets (
  id INT NOT NULL AUTO_INCREMENT,
  pre_event_id INT NOT NULL COMMENT 'FK link to pre_events',
  head VARCHAR(255) NOT NULL COMMENT 'Budget head item (e.g. Printing, Honorarium, Catering)',
  amount DECIMAL(15,2) NOT NULL COMMENT 'Proposed budget allocation amount',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT budgets_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. EVENT EXECUTIONS, UPLOADS & PARTICIPANTS
   ============================================================ */

/* 3.1 RESOURCE PERSONS (Speakers and subject experts) */
CREATE TABLE resource_persons (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  name VARCHAR(255) DEFAULT '' COMMENT 'Speaker name',
  designation VARCHAR(255) DEFAULT '' COMMENT 'Speaker professional designation',
  organization VARCHAR(255) DEFAULT '' COMMENT 'Speaker corporate/institutional affiliation',
  email VARCHAR(255) DEFAULT '' COMMENT 'Speaker email',
  linkedin VARCHAR(500) DEFAULT '' COMMENT 'Speaker LinkedIn profile URL',
  location VARCHAR(255) DEFAULT NULL COMMENT 'City / Country of origin of speaker',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  KEY idx_resource_persons_location (location),
  CONSTRAINT resource_persons_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.2 EVENT UPLOADS (Brochures, photos, agendas) */
CREATE TABLE events_uploads (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT DEFAULT NULL COMMENT 'FK link to events',
  filename VARCHAR(512) NOT NULL COMMENT 'Stored system filename on server disk',
  original_name VARCHAR(512) NOT NULL COMMENT 'Original filename uploaded by user',
  mime VARCHAR(255) DEFAULT NULL COMMENT 'File MIME type',
  size BIGINT DEFAULT NULL COMMENT 'File size in bytes',
  uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_uploads_event_id (event_id),
  CONSTRAINT events_uploads_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.3 PUBLICITY CHANNELS & SOCIAL MEDIA */
CREATE TABLE publicity (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  website_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating college website posting',
  website_date DATE DEFAULT NULL COMMENT 'Posting date on website',
  newspaper_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating newspaper coverage request',
  newspaper_date DATE DEFAULT NULL COMMENT 'Publication date in newspaper',
  newspaper_upload_id INT DEFAULT NULL COMMENT 'Link to events_uploads for newspaper draft',
  press_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating local press release',
  press_date DATE DEFAULT NULL COMMENT 'Press release date',
  press_upload_id INT DEFAULT NULL COMMENT 'Link to events_uploads for press release file',
  facebook_link VARCHAR(500) DEFAULT NULL COMMENT 'Facebook post/event URL',
  x_link VARCHAR(500) DEFAULT NULL COMMENT 'Twitter/X post URL',
  instagram_link VARCHAR(500) DEFAULT NULL COMMENT 'Instagram post URL',
  linkedin_link VARCHAR(500) DEFAULT NULL COMMENT 'LinkedIn post URL',
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT publicity_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.4 OFFICIAL LETTERS (Invitations, permissions) */
CREATE TABLE letters (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  section_name VARCHAR(255) NOT NULL COMMENT 'Addressed entity or department',
  active TINYINT(1) DEFAULT '0' COMMENT 'Letter activation/dispatch status',
  mode ENUM('Letter', 'Email', 'Letter/ Email') DEFAULT 'Letter/ Email' COMMENT 'Delivery dispatch mode',
  letter_date DATE DEFAULT NULL COMMENT 'Dispatch date',
  upload_id INT DEFAULT NULL COMMENT 'FK to events_uploads for signed copy',
  PRIMARY KEY (id),
  KEY event_id (event_id),
  KEY idx_letters_section (section_name),
  CONSTRAINT letters_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.5 EVENT PROOFS & ATTACHMENTS */
CREATE TABLE documents (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  doc_name VARCHAR(255) NOT NULL COMMENT 'Name/description of document (e.g. Schedule, Budget Approval)',
  active TINYINT(1) DEFAULT '0' COMMENT 'Verification/inclusion status',
  upload_id INT DEFAULT NULL COMMENT 'FK to events_uploads',
  PRIMARY KEY (id),
  KEY idx_documents_active (active),
  KEY idx_documents_upload_id (upload_id),
  KEY idx_documents_event_id (event_id),
  CONSTRAINT documents_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT documents_ibfk_2 FOREIGN KEY (upload_id) REFERENCES events_uploads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 3.6 EVENT PARTICIPANTS (Attendance registers) */
CREATE TABLE participants (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  type ENUM('internal-students', 'external-students', 'faculty', 'research-scholars', 'industry-experts', 'alumni', 'general-public') NOT NULL COMMENT 'Participant demographic group',
  count INT DEFAULT '0' COMMENT 'Number of participants in this category',
  count_verified TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag indicating attendance list audit verification',
  PRIMARY KEY (id),
  KEY idx_participants_type (type),
  KEY idx_participants_event_id (event_id),
  CONSTRAINT participants_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. EVENT EXECUTION FINANCES (Post-Event Accounts)
   ============================================================ */

/* 4.1 EVENT FINANCE ROOT RECORD */
CREATE TABLE finance (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT finance_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.2 EVENT INCOME RECEIVED (Registration fees, sponsorships) */
CREATE TABLE finance_income (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance record',
  source VARCHAR(255) NOT NULL COMMENT 'Source category (e.g. Registration Fee, CSIR Grant)',
  agency_name VARCHAR(255) DEFAULT NULL COMMENT 'Sponsoring agency name (if applicable)',
  amount DECIMAL(12,2) NOT NULL COMMENT 'Income amount received',
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  KEY idx_finance_income_agency (agency_name),
  CONSTRAINT finance_income_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.3 EVENT EXPENDITURE DETAILS (Realised expenditure vs budget) */
CREATE TABLE finance_expenditure (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance record',
  category VARCHAR(255) NOT NULL COMMENT 'Expense item category name',
  amount_proposed DECIMAL(12,2) DEFAULT NULL COMMENT 'Originally allocated budget amount',
  amount DECIMAL(12,2) NOT NULL COMMENT 'Actual spent amount',
  upload_id INT DEFAULT NULL COMMENT 'FK to events_uploads for bills/receipts',
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  KEY idx_finance_expenditure_upload (upload_id),
  CONSTRAINT finance_expenditure_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE,
  CONSTRAINT finance_expenditure_ibfk_2 FOREIGN KEY (upload_id) REFERENCES events_uploads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.4 EVENT SPONSORS DETAILS */
CREATE TABLE finance_sponsors (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance record',
  agency_name VARCHAR(255) NOT NULL COMMENT 'Name of sponsoring company/agency',
  amount DECIMAL(12,2) DEFAULT NULL COMMENT 'Sponsorship amount committed/received',
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  CONSTRAINT finance_sponsors_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 4.5 EVENT FINANCE VOUCHERS & DOCUMENTS */
CREATE TABLE finance_docs (
  id INT NOT NULL AUTO_INCREMENT,
  finance_id INT NOT NULL COMMENT 'FK link to finance record',
  filename VARCHAR(512) NOT NULL COMMENT 'Disk storage filename',
  original_name VARCHAR(512) NOT NULL COMMENT 'Original filename',
  mime VARCHAR(255) DEFAULT NULL,
  size BIGINT DEFAULT NULL,
  uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  CONSTRAINT finance_docs_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   5. ENGAGEMENTS & LINKS
   ============================================================ */

/* 5.1 REGISTRATION & FEEDBACK LINKS */
CREATE TABLE important_links (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  registration_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag showing registration status',
  registration_url VARCHAR(500) DEFAULT NULL COMMENT 'Google Form or portal registration link',
  feedback_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag showing feedback link availability',
  feedback_url VARCHAR(500) DEFAULT NULL COMMENT 'Google Form feedback link',
  youtube_enabled TINYINT(1) DEFAULT '0' COMMENT 'Boolean flag showing video stream link availability',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT important_links_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 5.2 YOUTUBE LIVESTREAM/RECORDING LINKS */
CREATE TABLE youtube_links (
  id INT NOT NULL AUTO_INCREMENT,
  event_id INT NOT NULL COMMENT 'FK link to events',
  url VARCHAR(500) NOT NULL COMMENT 'YouTube video or livestream URL',
  enabled TINYINT(1) DEFAULT '1' COMMENT 'Status of link availability',
  sort_order INT DEFAULT '0' COMMENT 'Custom sequence order for display',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT youtube_links_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;