CREATE DATABASE IF NOT EXISTS event_management;
USE event_management;

-- =========================
-- Central events table
-- =========================
CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) DEFAULT 'Untitled Event',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft'
);

-- =========================
-- PRE-EVENTS (Normalized)
-- =========================
CREATE TABLE pre_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  inaugural_date DATE,
  inaugural_time TIME,
  inaugural_venue VARCHAR(255),
  valedictory_date DATE,
  valedictory_time TIME,
  valedictory_venue VARCHAR(255),
  mode ENUM('Physical','Virtual','Hybrid'),
  meeting_link VARCHAR(500),
  level ENUM('international', 'national', 'state', 'district', 'intra_college') DEFAULT NULL,
  description TEXT DEFAULT NULL,
  expected_participants INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE event_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  type_name VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE target_audience (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  audience VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE themes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  theme VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE sdgs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  sdg_name VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE collaborations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  collaborator VARCHAR(255) NOT NULL,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE coordinators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  department VARCHAR(255),
  mobile VARCHAR(15),
  phone VARCHAR(50),
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

-- =========================
-- FINANCE (Normalized)
-- =========================
CREATE TABLE finance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE finance_income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finance_id INT NOT NULL,
  source VARCHAR(255) NOT NULL,
  agency_name VARCHAR(255) DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (finance_id) REFERENCES finance(id) ON DELETE CASCADE
);

-- NOTE: The uploads table is now named 'events_uploads'
CREATE TABLE events_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NULL,
  filename VARCHAR(512) NOT NULL,
  original_name VARCHAR(512) NOT NULL,
  mime VARCHAR(255) NULL,
  size BIGINT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE finance_expenditure (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finance_id INT NOT NULL,
  category VARCHAR(255) NOT NULL,
  amount_proposed DECIMAL(12,2) DEFAULT NULL,
  amount DECIMAL(12,2) NOT NULL,
  upload_id INT DEFAULT NULL,
  FOREIGN KEY (finance_id) REFERENCES finance(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_id) REFERENCES events_uploads(id) ON DELETE SET NULL
);

CREATE TABLE finance_sponsors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finance_id INT NOT NULL,
  agency_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NULL,
  FOREIGN KEY (finance_id) REFERENCES finance(id) ON DELETE CASCADE
);

CREATE TABLE finance_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finance_id INT NOT NULL,
  filename VARCHAR(512) NOT NULL,
  original_name VARCHAR(512) NOT NULL,
  mime VARCHAR(255),
  size BIGINT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (finance_id) REFERENCES finance(id) ON DELETE CASCADE
);

-- =========================
-- EVENT EXTENSIONS
-- =========================
CREATE TABLE publicity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  website_enabled TINYINT(1) DEFAULT 0,
  website_date DATE NULL,
  newspaper_enabled TINYINT(1) DEFAULT 0,
  newspaper_date DATE NULL,
  newspaper_upload_id INT NULL,
  press_enabled TINYINT(1) DEFAULT 0,
  press_date DATE NULL,
  press_upload_id INT NULL,
  facebook_link VARCHAR(500) NULL,
  x_link VARCHAR(500) NULL,
  instagram_link VARCHAR(500) NULL,
  linkedin_link VARCHAR(500) NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE resource_persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(255) DEFAULT '',
  designation VARCHAR(255) DEFAULT '',
  organization VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  linkedin VARCHAR(500) DEFAULT '',
  location VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  active TINYINT(1) DEFAULT 0,
  mode ENUM('Letter','Email','Letter/ Email') DEFAULT 'Letter/ Email',
  letter_date DATE NULL,
  upload_id INT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  doc_name VARCHAR(255) NOT NULL,
  active TINYINT(1) DEFAULT 0,
  upload_id INT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_id) REFERENCES events_uploads(id) ON DELETE SET NULL
);

CREATE TABLE participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  type ENUM(
    'internal-students','external-students','faculty',
    'research-scholars','industry-experts','alumni','general-public'
  ) NOT NULL,
  count INT DEFAULT 0,
  count_verified TINYINT(1) DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pre_event_id INT NOT NULL,
  head VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pre_event_id) REFERENCES pre_events(id) ON DELETE CASCADE
);

CREATE TABLE important_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  registration_enabled TINYINT(1) DEFAULT 0,
  registration_url VARCHAR(500) NULL,
  feedback_enabled TINYINT(1) DEFAULT 0,
  feedback_url VARCHAR(500) NULL,
  youtube_enabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE youtube_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  url VARCHAR(500) NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- =========================
-- Indexes (Performance Optimization)
-- =========================
CREATE INDEX idx_pre_events_level ON pre_events(level);
CREATE INDEX idx_pre_events_mode ON pre_events(mode);
CREATE INDEX idx_coordinators_department ON coordinators(department);
CREATE INDEX idx_finance_expenditure_upload ON finance_expenditure(upload_id);
CREATE INDEX idx_finance_income_agency ON finance_income(agency_name);
CREATE INDEX idx_resource_persons_location ON resource_persons(location);
CREATE INDEX idx_letters_section ON letters(section_name);
CREATE INDEX idx_documents_active ON documents(active);
CREATE INDEX idx_participants_type ON participants(type);
CREATE INDEX idx_documents_upload_id ON documents(upload_id);
CREATE INDEX idx_documents_event_id ON documents(event_id);
CREATE INDEX idx_participants_event_id ON participants(event_id);
CREATE INDEX idx_events_uploads_event_id ON events_uploads(event_id);