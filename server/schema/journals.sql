CREATE TABLE journals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  journal_options_id INT NOT NULL,
  quartile VARCHAR(2),
  impact_factor DECIMAL(10,3),
  cite_score DECIMAL(10,3),
  anna_university_listed BOOLEAN,
  anna_university_annexure_no VARCHAR(50),
  acknowledgement JSON,
  author_affiliation JSON,
  driven_by ENUM('faculty','student') DEFAULT 'faculty',
  date_of_submission DATE,
  status VARCHAR(50) DEFAULT 'waiting',
  volume VARCHAR(50),
  issue VARCHAR(50),
  issue_type VARCHAR(50),
  pages_from INT,
  pages_to INT,
  article_number VARCHAR(50),
  abstract TEXT,
  keywords TEXT,
  sdgs JSON,
  doi VARCHAR(255),
  credit_to VARCHAR(255),
  reference_number VARCHAR(255),
  accepted_date DATE,
  available_online_date DATE,
  file_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


CREATE TABLE journal_options  (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_name VARCHAR(255) NOT NULL,
  publisher VARCHAR(255),
  website VARCHAR(255),
  print_issn VARCHAR(20),
  online_issn VARCHAR(20),
  category ENUM('National', 'International') DEFAULT 'National',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- ALTER TABLE journal_options
-- ADD COLUMN category ENUM('National','International') NOT NULL DEFAULT 'National';

-- Add foreign key constraint
ALTER TABLE journals
ADD CONSTRAINT fk_journal_options
FOREIGN KEY (journal_options_id) REFERENCES journal_options(id);

-- Add indexes
CREATE INDEX idx_journal_options_name ON journal_options(journal_name);
CREATE INDEX idx_journal_options_publisher ON journal_options(publisher);

-- Authors table - needed in both since it's referenced by both project and journal
CREATE TABLE IF NOT EXISTS authors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NULL,    
    author_id VARCHAR(255) UNIQUE,
    student_id VARCHAR(255) NULL UNIQUE,
    designation VARCHAR(100) DEFAULT '',
    name VARCHAR(255) NOT NULL,
    department VARCHAR(255) DEFAULT '',
    organization VARCHAR(255) DEFAULT '',
    country VARCHAR(100) DEFAULT '',
    state VARCHAR(100) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (email) REFERENCES users(email) ON UPDATE CASCADE,
    INDEX idx_author_id (author_id),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS author_journal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_id INT NOT NULL,
  journal_id INT,
  is_first_author BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_author_journal (author_id, journal_id),
  FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
  INDEX idx_journal (journal_id),
  INDEX idx_author (author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE journal_indexes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_id INT,
  index_name VARCHAR(50),
  FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_edit_requests (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER REFERENCES journals(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal Requests table for custom journal requests
CREATE TABLE journal_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    journal_name VARCHAR(255) NOT NULL,
    publisher VARCHAR(255),
    website VARCHAR(255),
    print_issn VARCHAR(20),
    online_issn VARCHAR(20),
    category ENUM('National', 'International') DEFAULT 'National',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);
-- ALTER TABLE journal_requests
-- ADD COLUMN category ENUM('National','International') NOT NULL DEFAULT 'National';

-- Journal Status Updates table for tracking status changes and comments
CREATE TABLE journal_status_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    journal_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    user_comment TEXT,
    admin_reply TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_journal_id (journal_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Need to add\-- Add unique constraint to ensure only one primary author per journal
-- ALTER TABLE author_journal
-- ADD CONSTRAINT unique_primary_author 
-- UNIQUE (journal_id, is_primary_author),
-- ADD CONSTRAINT check_primary_author 
-- CHECK (NOT is_primary_author OR (is_primary_author AND author_order = 1));


 
-- CREATE TABLE author_project (
--   author_id INT,
--   project_id INT,
--   PRIMARY KEY (author_id, project_id),
--   FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
--   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
-- );
