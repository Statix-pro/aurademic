-- ==================================================================
-- Migration: Facility, Manpower, Outcomes and Documents tabs
-- Author: Maheshwaran A K
-- Date: 2026-09-30
-- ==================================================================
--
-- Description:
-- The project form gains four tabs, each a set of repeatable rows
-- saved with the rest of the project:
--
--   Facility   project_facilities             equipment and software the
--                                             project set up
--   Manpower   project_manpower               the staff it employs
--   Outcomes   project_publications           papers, by DOI
--              project_iprs                   patents, copyrights, designs,
--                                             trademarks, GIs
--              project_tech_transfers         start-ups, prototypes,
--                                             products, processes ...
--              project_outcome_candidates     people who earned a degree or
--                                             fellowship through it
--   Documents  project_document_transactions  correspondence with the
--                                             agency, inward and outward
--
-- Five kinds of row carry an uploaded PDF. Those files are stored the
-- way a grant tranche's documents already are: a `project_documents`
-- row pointing at its parent through a nullable column beside
-- `disbursement_id`, under a new document type. Deleting the parent
-- row deletes its document row with it. Rows that carry documents are
-- matched by id on save so a file survives an edit to the rest of its
-- row; the others are rewritten on every save.
--
-- The Outcomes rows replace the six typed counts on
-- `research_projects` (`outcome_journal_articles` … `outcome_startups`)
-- as the record of outcomes. Those columns are left exactly as they
-- are: the form stops writing them, and they are read only to show the
-- counts older projects entered before this change.
--
-- Closed lists the form offers as fixed options are ENUMs. Which
-- document kinds belong to which direction on the Documents tab is
-- enforced by the server's normalizer, not by the schema.
--
-- Additive only: new tables, nullable columns, and enum values appended
-- at the end, so no existing row, balance or total is touched and every
-- existing document row keeps its type and parent. Every step is
-- guarded, so a second run is a no-op.

-- ── 1. Facility tab ─────────────────────────────────────────────────
-- `istem_listed` says whether the facility is listed on the I-STEM
-- portal; `istem_id` is only stored while it is.

CREATE TABLE IF NOT EXISTS `project_facilities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `facility_name` varchar(255) NOT NULL,
  `facility_type` enum('synthesis','manufacturing','characterization','analysis','software','it_product') DEFAULT NULL,
  `installation_date` date DEFAULT NULL,
  `cost` decimal(15,2) DEFAULT NULL,
  `make` varchar(150) DEFAULT NULL,
  `model` varchar(150) DEFAULT NULL,
  `serial_no` varchar(150) DEFAULT NULL COMMENT 'Manufacturer serial number',
  `stock_register_ref` varchar(150) DEFAULT NULL COMMENT 'Stock register S.No. and page no.',
  `istem_listed` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Listed on the I-STEM portal',
  `istem_id` varchar(100) DEFAULT NULL COMMENT 'I-STEM ID, NULL unless istem_listed',
  `supplier_details` varchar(1000) DEFAULT NULL COMMENT 'Supplier name, address, email and mobile',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_facilities_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_facilities_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 2. Manpower tab ─────────────────────────────────────────────────
-- Each row carries an uploaded profile (`manpower_profile`, step 8).

CREATE TABLE IF NOT EXISTS `project_manpower` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `role` enum('project_associate','research_associate','senior_research_fellow','junior_research_fellow','field_investigator','field_worker','lab_technician') NOT NULL,
  `name` varchar(255) NOT NULL,
  `qualification` varchar(255) DEFAULT NULL,
  `salary` decimal(15,2) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `remarks` varchar(1000) DEFAULT NULL,
  `relieving_date` date DEFAULT NULL COMMENT 'Never before joining_date',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_manpower_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_manpower_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 3. Outcomes tab: publications ───────────────────────────────────
-- A publication keeps what was fetched for its DOI (title, venue,
-- year) on its own row, and links to the portal's `journals` record
-- when the DOI matched one. The link is ON DELETE SET NULL so removing
-- a journal record never removes the project's publication row.

CREATE TABLE IF NOT EXISTS `project_publications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `publication_type` enum('journal','conference','book_chapter') NOT NULL,
  `doi` varchar(255) DEFAULT NULL COMMENT 'Bare DOI, without a https://doi.org/ prefix',
  `journal_id` int DEFAULT NULL COMMENT 'The portal journals record the DOI matched, if any',
  `title` varchar(500) DEFAULT NULL,
  `venue` varchar(255) DEFAULT NULL COMMENT 'Journal, conference or book it appeared in',
  `publication_year` smallint DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_publications_project` (`project_id`,`display_order`),
  KEY `idx_project_publications_journal` (`journal_id`),
  CONSTRAINT `fk_project_publications_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_publications_journal` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 4. Outcomes tab: IPRs ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `project_iprs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `ipr_type` enum('patent','copyright','design_patent','trademark','geographical_indication') NOT NULL,
  `ipr_number` varchar(100) DEFAULT NULL COMMENT 'Application or registration number',
  `status` enum('filed','published','granted','rejected','expired') DEFAULT NULL,
  `title` varchar(500) DEFAULT NULL,
  `filing_date` date DEFAULT NULL,
  `grant_date` date DEFAULT NULL COMMENT 'Never before filing_date',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_iprs_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_iprs_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 5. Outcomes tab: technology transfers ───────────────────────────
-- Each row carries a document (`tech_transfer_document`, step 8).

CREATE TABLE IF NOT EXISTS `project_tech_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `category` enum('startup','prototype','product','process','service','theory','variety') NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  `trl` tinyint unsigned DEFAULT NULL COMMENT 'Technology Readiness Level, 3 to 9',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_tech_transfers_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_tech_transfers_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 6. Outcomes tab: candidates ─────────────────────────────────────
-- A separate list from the staff in `project_manpower`. Each row
-- carries a document (`candidate_document`, step 8).

CREATE TABLE IF NOT EXISTS `project_outcome_candidates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `candidate_name` varchar(255) NOT NULL,
  `degree` enum('me_mtech','phd','pdf') NOT NULL COMMENT 'M.E./M.Tech., Ph.D. or post-doctoral fellowship',
  `university` varchar(255) DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_outcome_candidates_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_outcome_candidates_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 7. Documents tab: correspondence log ────────────────────────────
-- Each row carries a scanned copy (`document_transaction_file`,
-- step 8).

CREATE TABLE IF NOT EXISTS `project_document_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `transaction_date` date NOT NULL,
  `direction` enum('inward','outward') NOT NULL,
  `document_kind` enum('sanction_order','query','acknowledgement','yearly_progress_report','revised_uc','clarification','final_report_submission') NOT NULL,
  `description` varchar(500) DEFAULT NULL COMMENT 'How it was sent and its reference number',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_document_transactions_project` (`project_id`,`display_order`),
  CONSTRAINT `fk_project_document_transactions_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 8. project_documents: a parent column per row kind ──────────────
-- Each column is added only when missing, so a database that already
-- has some of them (or all) is left as it is.

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_documents'
     AND column_name = 'manpower_id'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_documents`
     ADD COLUMN `manpower_id` int DEFAULT NULL COMMENT \'Set for a manpower row profile\' AFTER `disbursement_id`,
     ADD KEY `idx_project_documents_manpower` (`manpower_id`),
     ADD CONSTRAINT `fk_project_documents_manpower` FOREIGN KEY (`manpower_id`)
       REFERENCES `project_manpower` (`id`) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_documents'
     AND column_name = 'tech_transfer_id'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_documents`
     ADD COLUMN `tech_transfer_id` int DEFAULT NULL COMMENT \'Set for a technology transfer document\' AFTER `manpower_id`,
     ADD KEY `idx_project_documents_tech_transfer` (`tech_transfer_id`),
     ADD CONSTRAINT `fk_project_documents_tech_transfer` FOREIGN KEY (`tech_transfer_id`)
       REFERENCES `project_tech_transfers` (`id`) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_documents'
     AND column_name = 'candidate_id'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_documents`
     ADD COLUMN `candidate_id` int DEFAULT NULL COMMENT \'Set for an outcome candidate document\' AFTER `tech_transfer_id`,
     ADD KEY `idx_project_documents_candidate` (`candidate_id`),
     ADD CONSTRAINT `fk_project_documents_candidate` FOREIGN KEY (`candidate_id`)
       REFERENCES `project_outcome_candidates` (`id`) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'project_documents'
     AND column_name = 'document_transaction_id'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `project_documents`
     ADD COLUMN `document_transaction_id` int DEFAULT NULL COMMENT \'Set for a logged document transaction file\' AFTER `candidate_id`,
     ADD KEY `idx_project_documents_document_transaction` (`document_transaction_id`),
     ADD CONSTRAINT `fk_project_documents_document_transaction` FOREIGN KEY (`document_transaction_id`)
       REFERENCES `project_document_transactions` (`id`) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 9. project_documents: the four new document types ───────────────
-- Appended after the existing values. Re-stating the enum is
-- idempotent on its own: running it again changes nothing.

ALTER TABLE `project_documents`
  MODIFY COLUMN `document_type` enum('presentation','sanction_order','project_report','utilization_certificate_soe','bill_copies','bank_statement','disbursement_sanction','disbursement_uc_soe','disbursement_report','manpower_profile','tech_transfer_document','candidate_document','document_transaction_file') NOT NULL;

-- ==================================================================
-- ROLLBACK (keep commented — deletes every facility, manpower,
-- outcome and document-transaction row on every project, and every
-- document row filed against them; the files under uploads/ stay on
-- disk). Run top to bottom: the document rows and parent columns go
-- before the tables their foreign keys point at.
-- ==================================================================
-- DELETE FROM `project_documents`
--  WHERE `document_type` IN ('manpower_profile', 'tech_transfer_document',
--                            'candidate_document', 'document_transaction_file');
-- ALTER TABLE `project_documents`
--   DROP FOREIGN KEY `fk_project_documents_document_transaction`,
--   DROP KEY `idx_project_documents_document_transaction`,
--   DROP COLUMN `document_transaction_id`,
--   DROP FOREIGN KEY `fk_project_documents_candidate`,
--   DROP KEY `idx_project_documents_candidate`,
--   DROP COLUMN `candidate_id`,
--   DROP FOREIGN KEY `fk_project_documents_tech_transfer`,
--   DROP KEY `idx_project_documents_tech_transfer`,
--   DROP COLUMN `tech_transfer_id`,
--   DROP FOREIGN KEY `fk_project_documents_manpower`,
--   DROP KEY `idx_project_documents_manpower`,
--   DROP COLUMN `manpower_id`,
--   MODIFY COLUMN `document_type` enum('presentation','sanction_order','project_report','utilization_certificate_soe','bill_copies','bank_statement','disbursement_sanction','disbursement_uc_soe','disbursement_report') NOT NULL;
-- DROP TABLE IF EXISTS `project_document_transactions`;
-- DROP TABLE IF EXISTS `project_outcome_candidates`;
-- DROP TABLE IF EXISTS `project_tech_transfers`;
-- DROP TABLE IF EXISTS `project_iprs`;
-- DROP TABLE IF EXISTS `project_publications`;
-- DROP TABLE IF EXISTS `project_manpower`;
-- DROP TABLE IF EXISTS `project_facilities`;
