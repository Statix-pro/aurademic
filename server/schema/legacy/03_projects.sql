CREATE TABLE research_projects (
  id int NOT NULL AUTO_INCREMENT,
  project_category varchar(50) NOT NULL,
  category varchar(50) NOT NULL,
  title varchar(255) NOT NULL,
  duration_years int DEFAULT NULL,
  duration_months int DEFAULT NULL,
  duration_days int DEFAULT NULL,
  date_of_submission date DEFAULT NULL,
  submission_status varchar(50) DEFAULT 'waiting',
  is_collaboration_enabled tinyint(1) DEFAULT '0',
  file_path varchar(255) DEFAULT NULL,
  application_number varchar(255) DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  agency_id int DEFAULT NULL,
  scheme_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_agency_id (agency_id),
  KEY fk_scheme_id (scheme_id),
  CONSTRAINT fk_agency_id FOREIGN KEY (agency_id) REFERENCES project_agency_options (id),
  CONSTRAINT fk_scheme_id FOREIGN KEY (scheme_id) REFERENCES project_scheme_options (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE author_project (
  id int NOT NULL AUTO_INCREMENT,
  author_id int DEFAULT NULL,
  project_id int DEFAULT NULL,
  is_principal tinyint(1) DEFAULT '0',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  is_primary tinyint(1) DEFAULT '0',
  PRIMARY KEY (id),
  UNIQUE KEY unique_author_project (author_id, project_id),
  KEY idx_project (project_id),
  KEY idx_author (author_id),
  CONSTRAINT author_project_ibfk_1 FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE,
  CONSTRAINT author_project_ibfk_2 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_financial_contributions (
  id int NOT NULL AUTO_INCREMENT,
  project_id int DEFAULT NULL,
  agency varchar(255) DEFAULT NULL,
  amount decimal(15,2) DEFAULT NULL,
  agency_type_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY project_id (project_id),
  KEY fk_agency_type_id (agency_type_id),
  CONSTRAINT fk_agency_type_id FOREIGN KEY (agency_type_id) REFERENCES project_agency_type_options (id),
  CONSTRAINT project_financial_contributions_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_collaborations (
  id int NOT NULL AUTO_INCREMENT,
  project_id int DEFAULT NULL,
  partner varchar(255) DEFAULT NULL,
  address varchar(255) DEFAULT NULL,
  support varchar(50) NOT NULL,
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_collaborations_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_details (
  id int NOT NULL AUTO_INCREMENT,
  project_id int DEFAULT NULL,
  date_of_presentation date DEFAULT NULL,
  date_of_result_announcement date DEFAULT NULL,
  sanction_order_amount decimal(15,2) DEFAULT NULL,
  sanction_order_date date DEFAULT NULL,
  project_duration_start_date date DEFAULT NULL,
  project_duration_end_date date DEFAULT NULL,
  outcome_type varchar(150) NOT NULL,
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_details_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_grant_disbursements (
  id int NOT NULL AUTO_INCREMENT,
  project_id int DEFAULT NULL,
  fiscal_year varchar(10) DEFAULT NULL,
  agency varchar(255) DEFAULT NULL,
  amount decimal(15,2) DEFAULT NULL,
  disbursement_date date DEFAULT NULL,
  sanction_letter_path varchar(255) DEFAULT NULL,
  uc_and_soe_path varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_project_disbursement (project_id, fiscal_year, agency, amount, disbursement_date),
  CONSTRAINT project_grant_disbursements_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_documents (
  id int NOT NULL AUTO_INCREMENT,
  project_id int DEFAULT NULL,
  document_type enum('sanctionOrder','utilizationCertificate','statementOfExpenditure','projectReport','bankStatement','sanctionLetter','ucAndSoe') DEFAULT NULL,
  file_path varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY project_id (project_id),
  CONSTRAINT project_documents_ibfk_1 FOREIGN KEY (project_id) REFERENCES research_projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_agency_options (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_scheme_options (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_agency_type_options (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_requests (
  id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  request_type enum('agency','scheme','agency_type') NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  admin_comment text,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_user_id (user_id),
  KEY idx_request_type (request_type),
  KEY idx_created_at (created_at),
  CONSTRAINT project_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;