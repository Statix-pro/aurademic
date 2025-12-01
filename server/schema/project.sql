-- research projects

CREATE TABLE research_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_category VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  agency_id INT,
  scheme_id INT,
  duration_years INT,
  duration_months INT,
  duration_days INT,
  date_of_submission DATE,
  submission_status VARCHAR(50) DEFAULT 'waiting',
  is_collaboration_enabled BOOLEAN DEFAULT FALSE,
  file_path VARCHAR(255),
  application_number VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES project_agency_options(id),
  FOREIGN KEY (scheme_id) REFERENCES project_scheme_options(id)
);

-- Author-Project relationship table
CREATE TABLE IF NOT EXISTS author_project (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_id INT,
  project_id INT,
  is_principal BOOLEAN DEFAULT FALSE, -- it is the primary user
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_author_project (author_id, project_id),
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  INDEX idx_project (project_id),
  INDEX idx_author (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_financial_contributions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  agency_type_id INT,
  agency VARCHAR(255),
  amount DECIMAL(15, 2),
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_type_id) REFERENCES project_agency_type_options(id)
);

CREATE TABLE project_collaborations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  partner VARCHAR(255),
  address VARCHAR(255),
  support VARCHAR(50) NOT NULL,
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
);

CREATE TABLE project_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  date_of_presentation DATE,
  date_of_result_announcement DATE,
  sanction_order_amount DECIMAL(15, 2),
  sanction_order_date DATE,
  project_duration_start_date DATE,
  project_duration_end_date DATE,
  outcome_type VARCHAR(150) NOT NULL,
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
);

CREATE TABLE project_grant_disbursements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  fiscal_year VARCHAR(10),
  agency VARCHAR(255),
  amount DECIMAL(15, 2),
  disbursement_date DATE,
  sanction_letter_path VARCHAR(255),
  uc_and_soe_path VARCHAR(255),
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_project_disbursement ON project_grant_disbursements (project_id, fiscal_year, agency, amount, disbursement_date);

CREATE TABLE project_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  document_type ENUM('sanctionOrder', 'utilizationCertificate', 'statementOfExpenditure', 'projectReport', 'bankStatement'),
  file_path VARCHAR(255),
  FOREIGN KEY (project_id) REFERENCES research_projects(id) ON DELETE CASCADE
);

-- Add new tables for options
CREATE TABLE project_agency_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE project_scheme_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE project_agency_type_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Project Requests table for custom agency, scheme, and agency type requests
CREATE TABLE project_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    request_type ENUM('agency', 'scheme', 'agency_type') NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_user_id (user_id),
    INDEX idx_request_type (request_type),
    INDEX idx_created_at (created_at)
);