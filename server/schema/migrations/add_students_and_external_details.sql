-- Create author_students table to store student-specific data
CREATE TABLE IF NOT EXISTS author_students (
  id INT NOT NULL AUTO_INCREMENT,
  student_unique_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255) DEFAULT '',
  organization VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY (student_unique_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refactor authors table to reference author_students instead of storing student-specific fields
ALTER TABLE authors
  ADD COLUMN student_ref INT DEFAULT NULL AFTER state,
  DROP COLUMN student_id,
  ADD CONSTRAINT fk_authors_student_ref
    FOREIGN KEY (student_ref) REFERENCES author_students(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Add external_details JSON column on journals to store external author details per journal
ALTER TABLE journals
  ADD COLUMN external_details JSON DEFAULT NULL
  AFTER author_affiliation;



