/* ============================================================
   20260828_redesign_project_module.sql

   PURPOSE
     Rebuilds the Research Projects module around the redesigned
     project form. The old shape spread one project across
     `research_projects` + `project_details` + flat option tables and
     could not express the new form at all (submission tracking,
     presentation, result announcement, sanction mode, finance
     sharing, per-disbursement documents, outcome counts).

   SAFETY
     Every `project_*` / `author_project` table is empty in every
     environment (verified against the 2026-08-24 dump), so the tables
     are recreated rather than altered and no data migration or
     backward-compatibility shim is needed. Journals/authors data is
     untouched: investigators still resolve to `authors`.

   WHAT CHANGES
     project_agency_options      -> project_organizations (all external orgs)
     project_agency_type_options -> project_organizations.category
     project_scheme_options      -> project_schemes (agency-scoped, + domain/category/website)
     author_project              -> project_investigators (ordered, PI flag, snapshots)
     project_details             -> merged into research_projects
     project_collaborations      -> project_collaborators (contact + MoU + city)
     project_financial_contributions -> project_finance_rows (+ contribution/sharing split)
                                        + project_finance_row_heads (budget heads)
     (new)                       -> project_tags (SDGs, national initiatives)
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS project_finance_row_heads;
DROP TABLE IF EXISTS project_finance_rows;
DROP TABLE IF EXISTS project_financial_contributions;
DROP TABLE IF EXISTS project_documents;
DROP TABLE IF EXISTS project_grant_disbursements;
DROP TABLE IF EXISTS project_collaborators;
DROP TABLE IF EXISTS project_collaborations;
DROP TABLE IF EXISTS project_tags;
DROP TABLE IF EXISTS project_investigators;
DROP TABLE IF EXISTS author_project;
DROP TABLE IF EXISTS project_details;
DROP TABLE IF EXISTS project_requests;
DROP TABLE IF EXISTS research_projects;
DROP TABLE IF EXISTS project_schemes;
DROP TABLE IF EXISTS project_scheme_options;
DROP TABLE IF EXISTS project_organizations;
DROP TABLE IF EXISTS project_agency_options;
DROP TABLE IF EXISTS project_agency_type_options;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. MASTER DATA
   ============================================================ */

/* 1.1 ORGANIZATIONS
   One master list for every external party a project touches: funding
   agencies, collaborating institutes, industry partners. `is_funding_agency`
   filters the "Funding Agency" dropdown; the same rows feed the
   collaborator, financial-contribution and disbursement dropdowns. */
CREATE TABLE project_organizations (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL COMMENT 'Full organization name (e.g. Department of Science and Technology)',
  short_name VARCHAR(100) DEFAULT NULL COMMENT 'Acronym shown in compact dropdowns (e.g. DST)',
  category VARCHAR(100) DEFAULT NULL COMMENT 'Government / Private / Industry / Academic / NGO / International',
  city VARCHAR(150) DEFAULT NULL,
  state VARCHAR(150) DEFAULT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  website VARCHAR(500) DEFAULT NULL,
  is_funding_agency TINYINT(1) NOT NULL DEFAULT '1' COMMENT '1 = offered in the Funding Agency dropdown',
  is_internal TINYINT(1) NOT NULL DEFAULT '0' COMMENT '1 = the host institution itself',
  is_active TINYINT(1) NOT NULL DEFAULT '1',
  sort_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_organizations_name (name),
  KEY idx_project_organizations_active (is_active),
  KEY idx_project_organizations_funding (is_funding_agency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.2 SCHEMES
   A scheme belongs to one funding organization and carries the read-only
   metadata the form shows next to it (domain, category, website). */
CREATE TABLE project_schemes (
  id INT NOT NULL AUTO_INCREMENT,
  organization_id INT NOT NULL COMMENT 'Funding organization offering the scheme',
  name VARCHAR(255) NOT NULL COMMENT 'Scheme / call name (e.g. SERB-POWER, FIST, MODROB)',
  domain VARCHAR(255) DEFAULT NULL COMMENT 'Research domain the call targets',
  category VARCHAR(150) DEFAULT NULL COMMENT 'Scheme classification (e.g. Research Project, Infrastructure)',
  website VARCHAR(500) DEFAULT NULL COMMENT 'Call / scheme landing page',
  is_active TINYINT(1) NOT NULL DEFAULT '1',
  sort_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_schemes_org_name (organization_id, name),
  KEY idx_project_schemes_active (is_active),
  CONSTRAINT fk_project_schemes_organization
    FOREIGN KEY (organization_id) REFERENCES project_organizations (id)
      ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   2. PROJECT AGGREGATE ROOT
   ============================================================ */

CREATE TABLE research_projects (
  id INT NOT NULL AUTO_INCREMENT,

  /* -- Investigators card -- */
  driven_by ENUM('faculty', 'student') NOT NULL DEFAULT 'faculty'
    COMMENT 'Whether the proposal is faculty- or student-driven',

  /* -- Proposal details -- */
  title VARCHAR(500) NOT NULL,
  project_cost DECIMAL(15,2) DEFAULT NULL COMMENT 'Total proposed project cost',
  duration_years TINYINT UNSIGNED DEFAULT NULL,
  duration_months TINYINT UNSIGNED DEFAULT NULL,
  duration_days SMALLINT UNSIGNED DEFAULT NULL,

  /* -- Call for details -- */
  funding_organization_id INT DEFAULT NULL,
  scheme_id INT DEFAULT NULL,

  /* -- Section toggles (a disabled section keeps its rows but is not shown) -- */
  collaborators_enabled TINYINT(1) NOT NULL DEFAULT '0',
  financial_contribution_enabled TINYINT(1) NOT NULL DEFAULT '0',
  finance_sharing_enabled TINYINT(1) NOT NULL DEFAULT '0',
  presentation_enabled TINYINT(1) NOT NULL DEFAULT '0',

  /* -- Submission details -- */
  submitted_on DATE DEFAULT NULL,
  submission_mode VARCHAR(50) DEFAULT NULL COMMENT 'Online / Offline / Email / Portal / Post',
  reference_number VARCHAR(150) DEFAULT NULL COMMENT 'Agency-side proposal reference number',
  cfrd_copy_submitted TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Full proposal copy handed to CFRD',
  cfrd_copy_submitted_on DATE DEFAULT NULL,
  proposal_status ENUM(
    'draft',
    'submitted',
    'accepted_for_evaluation',
    'shortlisted',
    'shortlisted_for_presentation',
    'result_announced'
  ) NOT NULL DEFAULT 'draft',

  /* -- Presentation -- */
  presentation_date DATE DEFAULT NULL,
  presentation_venue VARCHAR(255) DEFAULT NULL,
  presentation_panelists VARCHAR(1000) DEFAULT NULL,

  /* -- Result announcement -- */
  result_mode VARCHAR(50) DEFAULT NULL COMMENT 'Email / Website / Letter / Portal',
  result_date DATE DEFAULT NULL,
  final_result ENUM('selected', 'not_selected') DEFAULT NULL,

  /* -- Sanction details -- */
  sanction_date DATE DEFAULT NULL,
  sanction_reference_no VARCHAR(150) DEFAULT NULL,
  sanction_mode ENUM('installment', 'advance', 'reimbursement', 'advance_reimbursement')
    DEFAULT NULL,

  /* -- Project status -- */
  project_start_date DATE DEFAULT NULL,
  project_closing_date DATE DEFAULT NULL,
  project_status ENUM('ongoing', 'completed', 'closed') DEFAULT NULL,

  /* -- Outcome counts -- */
  outcome_journal_articles INT UNSIGNED NOT NULL DEFAULT '0',
  outcome_conferences INT UNSIGNED NOT NULL DEFAULT '0',
  outcome_iprs INT UNSIGNED NOT NULL DEFAULT '0',
  outcome_products INT UNSIGNED NOT NULL DEFAULT '0',
  outcome_tech_transfers INT UNSIGNED NOT NULL DEFAULT '0',
  outcome_startups INT UNSIGNED NOT NULL DEFAULT '0',

  remarks TEXT,

  created_by INT DEFAULT NULL COMMENT 'users.id that created the record',
  updated_by INT DEFAULT NULL COMMENT 'users.id of the last writer',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_research_projects_org (funding_organization_id),
  KEY idx_research_projects_scheme (scheme_id),
  KEY idx_research_projects_proposal_status (proposal_status),
  KEY idx_research_projects_project_status (project_status),
  KEY idx_research_projects_submitted_on (submitted_on),
  KEY idx_research_projects_created_by (created_by),
  CONSTRAINT fk_research_projects_organization
    FOREIGN KEY (funding_organization_id) REFERENCES project_organizations (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_research_projects_scheme
    FOREIGN KEY (scheme_id) REFERENCES project_schemes (id)
      ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_research_projects_created_by
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_research_projects_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. INVESTIGATORS
   ============================================================ */

/* Row order is the form's drag order; the top row carries is_principal = 1
   and exactly one row carries is_primary = 1 (the chosen corresponding
   investigator, which need not be the PI). Faculty and student rows point at `authors` (so the
   dashboards' v_authors joins keep working); external rows are stored
   inline because they have no institutional identity. */
CREATE TABLE project_investigators (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  member_type ENUM('faculty', 'student', 'external') NOT NULL DEFAULT 'faculty',
  author_id INT DEFAULT NULL COMMENT 'FK to authors.id for faculty / student / external rows',
  name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot of the name at save time',
  department VARCHAR(255) DEFAULT NULL,
  organization VARCHAR(255) DEFAULT NULL,
  country VARCHAR(100) DEFAULT NULL,
  is_principal TINYINT(1) NOT NULL DEFAULT '0' COMMENT '1 = Principal Investigator',
  is_primary TINYINT(1) NOT NULL DEFAULT '0' COMMENT '1 = primary (corresponding) investigator',
  display_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_project_investigators_project (project_id, display_order),
  KEY idx_project_investigators_author (author_id),
  CONSTRAINT fk_project_investigators_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_investigators_author
    FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   4. CLASSIFICATION TAGS (SDGs, national initiatives)
   ============================================================ */

CREATE TABLE project_tags (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  tag_type ENUM('national_initiative', 'sdg') NOT NULL,
  tag_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_tags (project_id, tag_type, tag_value),
  KEY idx_project_tags_type_value (tag_type, tag_value),
  CONSTRAINT fk_project_tags_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   5. COLLABORATORS
   ============================================================ */

CREATE TABLE project_collaborators (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  category VARCHAR(100) DEFAULT NULL COMMENT 'Academic / Industry / Government / NGO / International',
  role VARCHAR(255) DEFAULT NULL COMMENT 'Role played in the project',
  organization_id INT DEFAULT NULL COMMENT 'FK to project_organizations when picked from the master',
  organization_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  city VARCHAR(150) DEFAULT NULL,
  has_active_mou TINYINT(1) NOT NULL DEFAULT '0',
  contact_name VARCHAR(255) DEFAULT NULL,
  contact_designation VARCHAR(150) DEFAULT NULL,
  contact_email VARCHAR(255) DEFAULT NULL,
  display_order INT NOT NULL DEFAULT '0',
  PRIMARY KEY (id),
  KEY idx_project_collaborators_project (project_id, display_order),
  KEY idx_project_collaborators_organization (organization_id),
  CONSTRAINT fk_project_collaborators_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_collaborators_organization
    FOREIGN KEY (organization_id) REFERENCES project_organizations (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   6. FINANCE ROWS (financial contribution + finance sharing)
   ============================================================ */

/* Both tables in the form have the same columns and differ only in meaning:
   `contribution` = money an organization brings in, `sharing` = money shared
   out. One table with a discriminator keeps totals and reporting uniform. */
CREATE TABLE project_finance_rows (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  row_type ENUM('contribution', 'sharing') NOT NULL,
  organization_id INT DEFAULT NULL,
  organization_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  amount DECIMAL(15,2) DEFAULT NULL,
  display_order INT NOT NULL DEFAULT '0',
  PRIMARY KEY (id),
  KEY idx_project_finance_rows_project (project_id, row_type, display_order),
  KEY idx_project_finance_rows_organization (organization_id),
  CONSTRAINT fk_project_finance_rows_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_finance_rows_organization
    FOREIGN KEY (organization_id) REFERENCES project_organizations (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* A finance row can span several budget heads, so heads live in a junction
   table pointing at the shared budget catalog. */
CREATE TABLE project_finance_row_heads (
  id INT NOT NULL AUTO_INCREMENT,
  finance_row_id INT NOT NULL,
  budget_head_id INT DEFAULT NULL COMMENT 'FK to budget_heads; NULL keeps a head that was later retired',
  budget_head_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot of the head name at save time',
  PRIMARY KEY (id),
  UNIQUE KEY uq_project_finance_row_heads (finance_row_id, budget_head_id),
  KEY idx_project_finance_row_heads_head (budget_head_id),
  CONSTRAINT fk_project_finance_row_heads_row
    FOREIGN KEY (finance_row_id) REFERENCES project_finance_rows (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_finance_row_heads_head
    FOREIGN KEY (budget_head_id) REFERENCES budget_heads (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   7. GRANT DISBURSEMENTS
   ============================================================ */

CREATE TABLE project_grant_disbursements (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  financial_year VARCHAR(9) DEFAULT NULL COMMENT 'e.g. 2025-26',
  organization_id INT DEFAULT NULL,
  organization_name VARCHAR(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  amount DECIMAL(15,2) DEFAULT NULL,
  disbursement_date DATE DEFAULT NULL,
  display_order INT NOT NULL DEFAULT '0',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_project_grant_disbursements_project (project_id, display_order),
  KEY idx_project_grant_disbursements_fy (financial_year),
  CONSTRAINT fk_project_grant_disbursements_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_grant_disbursements_organization
    FOREIGN KEY (organization_id) REFERENCES project_organizations (id)
      ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   8. DOCUMENTS
   ============================================================ */

/* One row per uploaded file. Project-level slots leave disbursement_id NULL;
   the three per-tranche slots set it. Slot uniqueness is enforced in the
   model (MySQL unique keys treat NULLs as distinct). */
CREATE TABLE project_documents (
  id INT NOT NULL AUTO_INCREMENT,
  project_id INT NOT NULL,
  disbursement_id INT DEFAULT NULL COMMENT 'Set for the per-tranche document slots',
  document_type ENUM(
    'presentation',
    'sanction_order',
    'project_report',
    'utilization_certificate_soe',
    'bill_copies',
    'bank_statement',
    'disbursement_sanction',
    'disbursement_uc_soe',
    'disbursement_report'
  ) NOT NULL,
  file_path VARCHAR(500) NOT NULL COMMENT 'Path under uploads/, served at /uploads',
  original_name VARCHAR(255) DEFAULT NULL,
  file_size INT UNSIGNED DEFAULT NULL,
  mime_type VARCHAR(100) DEFAULT NULL,
  uploaded_by INT DEFAULT NULL,
  uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_project_documents_project (project_id, document_type),
  KEY idx_project_documents_disbursement (disbursement_id),
  CONSTRAINT fk_project_documents_project
    FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_documents_disbursement
    FOREIGN KEY (disbursement_id) REFERENCES project_grant_disbursements (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_documents_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   9. MASTER-DATA ADD REQUESTS ("Add Scheme" on the form)
   ============================================================ */

CREATE TABLE project_requests (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'Requester',
  request_type ENUM('organization', 'scheme') NOT NULL,
  name VARCHAR(255) NOT NULL COMMENT 'Proposed organization / scheme name',
  organization_id INT DEFAULT NULL COMMENT 'Parent organization for a scheme request',
  organization_name VARCHAR(255) DEFAULT NULL COMMENT 'Free-text parent when it is not in the master yet',
  domain VARCHAR(255) DEFAULT NULL,
  category VARCHAR(150) DEFAULT NULL,
  website VARCHAR(500) DEFAULT NULL,
  description TEXT,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  approved_record_id INT DEFAULT NULL COMMENT 'id created in the master table on approval',
  reviewed_by INT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_project_requests_status (status),
  KEY idx_project_requests_user (user_id),
  KEY idx_project_requests_type (request_type),
  KEY idx_project_requests_created (created_at),
  CONSTRAINT fk_project_requests_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_project_requests_organization
    FOREIGN KEY (organization_id) REFERENCES project_organizations (id) ON DELETE SET NULL,
  CONSTRAINT fk_project_requests_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   10. SEED
   ============================================================ */

/* The host institution: pre-selected as the investigators' organization and
   offered in the finance-sharing dropdown. */
INSERT INTO project_organizations
  (name, short_name, category, city, state, country, is_funding_agency, is_internal, sort_order)
VALUES
  ('K.S.Rangasamy College of Technology', 'KSRCT', 'Academic', 'Tiruchengode', 'Tamil Nadu',
   'India', 0, 1, 0);

/* Common Indian funding agencies so the form is usable before an admin
   curates the master list. */
INSERT INTO project_organizations (name, short_name, category, country, sort_order) VALUES
  ('All India Council for Technical Education', 'AICTE', 'Government', 'India', 10),
  ('Anna University', 'Anna University', 'Academic', 'India', 20),
  ('Council of Scientific and Industrial Research', 'CSIR', 'Government', 'India', 30),
  ('Defence Research and Development Organisation', 'DRDO', 'Government', 'India', 40),
  ('Department of Biotechnology', 'DBT', 'Government', 'India', 50),
  ('Department of Science and Technology', 'DST', 'Government', 'India', 60),
  ('Indian Council of Medical Research', 'ICMR', 'Government', 'India', 70),
  ('Indian Space Research Organisation', 'ISRO', 'Government', 'India', 80),
  ('Ministry of Electronics and Information Technology', 'MeitY', 'Government', 'India', 90),
  ('Ministry of New and Renewable Energy', 'MNRE', 'Government', 'India', 100),
  ('Science and Engineering Research Board', 'SERB', 'Government', 'India', 110),
  ('Tamil Nadu State Council for Science and Technology', 'TNSCST', 'Government', 'India', 120),
  ('University Grants Commission', 'UGC', 'Government', 'India', 130);
