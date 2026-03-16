-- Migration: Add budget tags master and proposal snapshot fields
-- Date: 2026-03-10
-- Purpose:
--   1) Move budget tag options from frontend hardcode into DB
--   2) Persist applicant name + selected tag per proposal for dashboard rendering

CREATE TABLE IF NOT EXISTS budget_tags (
  id INT NOT NULL AUTO_INCREMENT,
  tag_name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_tags_name (tag_name),
  KEY idx_budget_tags_active_order (is_active, sort_order, tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO budget_tags (tag_name, is_active, sort_order) VALUES
  ('Laboratory', 1, 10),
  ('Association', 1, 20),
  ('Skilling', 1, 30),
  ('Research', 1, 40),
  ('Outreach', 1, 50),
  ('Office', 1, 60),
  ('Academics', 1, 70),
  ('Essentials', 1, 80),
  ('Events', 1, 90),
  ('Innovation', 1, 100),
  ('Start-up', 1, 110),
  ('Entrepreneurship', 1, 120);

-- Add budget_proposals.applicant_name (if missing)
SET @has_applicant_name := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'budget_proposals'
    AND COLUMN_NAME = 'applicant_name'
);
SET @sql_add_applicant_name := IF(
  @has_applicant_name = 0,
  'ALTER TABLE budget_proposals ADD COLUMN applicant_name VARCHAR(255) NULL AFTER user_email',
  'SELECT 1'
);
PREPARE stmt_add_applicant_name FROM @sql_add_applicant_name;
EXECUTE stmt_add_applicant_name;
DEALLOCATE PREPARE stmt_add_applicant_name;

-- Add budget_proposals.budget_tag (if missing)
SET @has_budget_tag := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'budget_proposals'
    AND COLUMN_NAME = 'budget_tag'
);
SET @sql_add_budget_tag := IF(
  @has_budget_tag = 0,
  'ALTER TABLE budget_proposals ADD COLUMN budget_tag VARCHAR(100) NULL AFTER proposal_description',
  'SELECT 1'
);
PREPARE stmt_add_budget_tag FROM @sql_add_budget_tag;
EXECUTE stmt_add_budget_tag;
DEALLOCATE PREPARE stmt_add_budget_tag;

-- Optional index for future filtering by tag
SET @has_budget_tag_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'budget_proposals'
    AND INDEX_NAME = 'idx_budget_proposals_tag'
);
SET @sql_add_budget_tag_index := IF(
  @has_budget_tag_index = 0,
  'ALTER TABLE budget_proposals ADD KEY idx_budget_proposals_tag (budget_tag)',
  'SELECT 1'
);
PREPARE stmt_add_budget_tag_index FROM @sql_add_budget_tag_index;
EXECUTE stmt_add_budget_tag_index;
DEALLOCATE PREPARE stmt_add_budget_tag_index;

-- Backfill applicant_name for historical rows where possible
UPDATE budget_proposals bp
LEFT JOIN master_employees emp ON bp.user_id = emp.user_id AND emp.status = 'Active'
LEFT JOIN users u ON bp.user_id = u.id
SET bp.applicant_name = COALESCE(
  NULLIF(TRIM(CONCAT(emp.first_name, ' ', COALESCE(emp.last_name, ''))), ''),
  NULLIF(TRIM(u.name), ''),
  NULLIF(TRIM(bp.user_email), '')
)
WHERE (bp.applicant_name IS NULL OR TRIM(bp.applicant_name) = '');
