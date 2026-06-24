CREATE TABLE journals (
  id int NOT NULL AUTO_INCREMENT,
  category varchar(50) NOT NULL,
  title varchar(255) NOT NULL,
  book_chapter_title varchar(255) DEFAULT NULL,
  publication_details json DEFAULT NULL,
  type varchar(100) NOT NULL,
  quartile varchar(2) DEFAULT NULL,
  impact_factor decimal(10,3) DEFAULT NULL,
  cite_score decimal(10,3) DEFAULT NULL,
  anna_university_listed tinyint(1) DEFAULT NULL,
  anna_university_annexure_no varchar(50) DEFAULT NULL,
  acknowledgement json DEFAULT NULL,
  date_of_submission date DEFAULT NULL,
  status varchar(50) DEFAULT 'waiting',
  volume varchar(50) DEFAULT NULL,
  issue varchar(50) DEFAULT NULL,
  issue_type varchar(50) DEFAULT NULL,
  pages_from int DEFAULT NULL,
  pages_to int DEFAULT NULL,
  article_number varchar(50) DEFAULT NULL,
  abstract text,
  keywords text,
  sdgs json DEFAULT NULL,
  doi varchar(255) DEFAULT NULL,
  accepted_date date DEFAULT NULL,
  available_online_date date DEFAULT NULL,
  file_path varchar(255) DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  author_affiliation json DEFAULT NULL,
  external_details json DEFAULT NULL,
  journal_options_id int NOT NULL,
  driven_by enum('faculty','student') DEFAULT 'faculty',
  credit_to varchar(255) DEFAULT NULL,
  reference_number varchar(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY fk_journal_options (journal_options_id),
  CONSTRAINT fk_journal_options FOREIGN KEY (journal_options_id) REFERENCES journal_options (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE journal_options (
  id int NOT NULL AUTO_INCREMENT,
  journal_name varchar(255) NOT NULL,
  publisher varchar(255) DEFAULT NULL,
  website varchar(255) DEFAULT NULL,
  print_issn varchar(20) DEFAULT NULL,
  online_issn varchar(20) DEFAULT NULL,
  impact_factor decimal(10,3) DEFAULT NULL,
  cite_score decimal(10,3) DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category enum('National','International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (id),
  KEY idx_journal_options_name (journal_name),
  KEY idx_journal_options_publisher (publisher)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE authors (
  id int NOT NULL AUTO_INCREMENT,
  email varchar(255) DEFAULT NULL,
  author_id varchar(255) DEFAULT NULL,
  designation varchar(100) DEFAULT '',
  name varchar(255) NOT NULL,
  department varchar(255) DEFAULT '',
  organization varchar(255) DEFAULT '',
  country varchar(100) DEFAULT '',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  state varchar(100) DEFAULT '',
  student_ref int DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY author_id (author_id),
  KEY idx_author_id (author_id),
  KEY fk_authors_student_ref (student_ref),
  CONSTRAINT fk_authors_student_ref FOREIGN KEY (student_ref) REFERENCES author_students (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE author_students (
  id int NOT NULL AUTO_INCREMENT,
  student_unique_id varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  department varchar(255) DEFAULT '',
  organization varchar(255) DEFAULT '',
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY student_unique_id (student_unique_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE author_journal (
  id int NOT NULL AUTO_INCREMENT,
  author_id int DEFAULT NULL,
  journal_id int DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  is_first_author tinyint(1) DEFAULT '0',
  is_primary tinyint(1) DEFAULT '0',
  PRIMARY KEY (id),
  UNIQUE KEY unique_author_journal (author_id, journal_id),
  KEY idx_journal (journal_id),
  KEY idx_author (author_id),
  CONSTRAINT author_journal_ibfk_1 FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE,
  CONSTRAINT author_journal_ibfk_2 FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE journal_indexes (
  id int NOT NULL AUTO_INCREMENT,
  journal_id int DEFAULT NULL,
  index_name varchar(50) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY journal_id (journal_id),
  CONSTRAINT journal_indexes_ibfk_1 FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE journal_requests (
  id int NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  journal_name varchar(255) NOT NULL,
  publisher varchar(255) DEFAULT NULL,
  website varchar(255) DEFAULT NULL,
  print_issn varchar(20) DEFAULT NULL,
  online_issn varchar(20) DEFAULT NULL,
  impact_factor decimal(10,3) DEFAULT NULL,
  cite_score decimal(10,3) DEFAULT NULL,
  status enum('pending','approved','rejected') DEFAULT 'pending',
  admin_comment text,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  category enum('National','International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT journal_requests_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE journal_status_updates (
  id int NOT NULL AUTO_INCREMENT,
  journal_id int NOT NULL,
  user_id int NOT NULL,
  status varchar(50) NOT NULL,
  user_comment text,
  admin_reply text,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_journal_id (journal_id),
  KEY idx_user_id (user_id),
  KEY idx_created_at (created_at),
  CONSTRAINT journal_status_updates_ibfk_1 FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE,
  CONSTRAINT journal_status_updates_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
