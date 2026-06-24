CREATE TABLE events (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(255) DEFAULT 'Untitled Event',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE pre_events (
  id int NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  inaugural_date date DEFAULT NULL,
  inaugural_time time DEFAULT NULL,
  inaugural_venue varchar(255) DEFAULT NULL,
  valedictory_date date DEFAULT NULL,
  valedictory_time time DEFAULT NULL,
  valedictory_venue varchar(255) DEFAULT NULL,
  mode enum('Physical','Virtual','Hybrid') DEFAULT NULL,
  meeting_link varchar(500) DEFAULT NULL,
  level enum('international','national','state','district','intra_college') DEFAULT NULL,
  description text,
  expected_participants int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pre_events_level (level),
  KEY idx_pre_events_mode (mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE event_types (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  type_name varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT event_types_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE departments (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  name varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT departments_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE target_audience (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  audience varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT target_audience_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE themes (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  theme varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT themes_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sdgs (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  sdg_name varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT sdgs_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE collaborations (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  collaborator varchar(255) NOT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT collaborations_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE coordinators (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  name varchar(255) NOT NULL,
  email varchar(255) DEFAULT NULL,
  department varchar(255) DEFAULT NULL,
  mobile varchar(15) DEFAULT NULL,
  phone varchar(50) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  KEY idx_coordinators_department (department),
  CONSTRAINT coordinators_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE finance (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT finance_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE finance_income (
  id int NOT NULL AUTO_INCREMENT,
  finance_id int NOT NULL,
  source varchar(255) NOT NULL,
  agency_name varchar(255) DEFAULT NULL,
  amount decimal(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  KEY idx_finance_income_agency (agency_name),
  CONSTRAINT finance_income_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE events_uploads (
  id int NOT NULL AUTO_INCREMENT,
  event_id int DEFAULT NULL,
  filename varchar(512) NOT NULL,
  original_name varchar(512) NOT NULL,
  mime varchar(255) DEFAULT NULL,
  size bigint DEFAULT NULL,
  uploaded_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_uploads_event_id (event_id),
  CONSTRAINT events_uploads_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE finance_expenditure (
  id int NOT NULL AUTO_INCREMENT,
  finance_id int NOT NULL,
  category varchar(255) NOT NULL,
  amount_proposed decimal(12,2) DEFAULT NULL,
  amount decimal(12,2) NOT NULL,
  upload_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  KEY idx_finance_expenditure_upload (upload_id),
  CONSTRAINT finance_expenditure_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE,
  CONSTRAINT finance_expenditure_ibfk_2 FOREIGN KEY (upload_id) REFERENCES events_uploads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE finance_sponsors (
  id int NOT NULL AUTO_INCREMENT,
  finance_id int NOT NULL,
  agency_name varchar(255) NOT NULL,
  amount decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  CONSTRAINT finance_sponsors_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE finance_docs (
  id int NOT NULL AUTO_INCREMENT,
  finance_id int NOT NULL,
  filename varchar(512) NOT NULL,
  original_name varchar(512) NOT NULL,
  mime varchar(255) DEFAULT NULL,
  size bigint DEFAULT NULL,
  uploaded_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY finance_id (finance_id),
  CONSTRAINT finance_docs_ibfk_1 FOREIGN KEY (finance_id) REFERENCES finance (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE publicity (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  website_enabled tinyint(1) DEFAULT '0',
  website_date date DEFAULT NULL,
  newspaper_enabled tinyint(1) DEFAULT '0',
  newspaper_date date DEFAULT NULL,
  newspaper_upload_id int DEFAULT NULL,
  press_enabled tinyint(1) DEFAULT '0',
  press_date date DEFAULT NULL,
  press_upload_id int DEFAULT NULL,
  facebook_link varchar(500) DEFAULT NULL,
  x_link varchar(500) DEFAULT NULL,
  instagram_link varchar(500) DEFAULT NULL,
  linkedin_link varchar(500) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT publicity_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE resource_persons (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  name varchar(255) DEFAULT '',
  designation varchar(255) DEFAULT '',
  organization varchar(255) DEFAULT '',
  email varchar(255) DEFAULT '',
  linkedin varchar(500) DEFAULT '',
  location varchar(255) DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  KEY idx_resource_persons_location (location),
  CONSTRAINT resource_persons_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE letters (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  section_name varchar(255) NOT NULL,
  active tinyint(1) DEFAULT '0',
  mode enum('Letter','Email','Letter/ Email') DEFAULT 'Letter/ Email',
  letter_date date DEFAULT NULL,
  upload_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  KEY idx_letters_section (section_name),
  CONSTRAINT letters_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE documents (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  doc_name varchar(255) NOT NULL,
  active tinyint(1) DEFAULT '0',
  upload_id int DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_documents_active (active),
  KEY idx_documents_upload_id (upload_id),
  KEY idx_documents_event_id (event_id),
  CONSTRAINT documents_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT documents_ibfk_2 FOREIGN KEY (upload_id) REFERENCES events_uploads (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE participants (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  type enum('internal-students','external-students','faculty','research-scholars','industry-experts','alumni','general-public') NOT NULL,
  count int DEFAULT '0',
  count_verified tinyint(1) DEFAULT '0',
  PRIMARY KEY (id),
  KEY idx_participants_type (type),
  KEY idx_participants_event_id (event_id),
  CONSTRAINT participants_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE budgets (
  id int NOT NULL AUTO_INCREMENT,
  pre_event_id int NOT NULL,
  head varchar(255) NOT NULL,
  amount decimal(15,2) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY pre_event_id (pre_event_id),
  CONSTRAINT budgets_ibfk_1 FOREIGN KEY (pre_event_id) REFERENCES pre_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE important_links (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  registration_enabled tinyint(1) DEFAULT '0',
  registration_url varchar(500) DEFAULT NULL,
  feedback_enabled tinyint(1) DEFAULT '0',
  feedback_url varchar(500) DEFAULT NULL,
  youtube_enabled tinyint(1) DEFAULT '0',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT important_links_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE youtube_links (
  id int NOT NULL AUTO_INCREMENT,
  event_id int NOT NULL,
  url varchar(500) NOT NULL,
  enabled tinyint(1) DEFAULT '1',
  sort_order int DEFAULT '0',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY event_id (event_id),
  CONSTRAINT youtube_links_ibfk_1 FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;