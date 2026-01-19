-- Migration: Link Authors Table to Master Employees
-- Author: System
-- Date: 2026-01-19
-- Description: Add employee_id FK to authors table for internal staff linkage
-- Run Order: 3 of 3 (Requires master_employees to exist)

-- ============================================
-- MODIFY AUTHORS TABLE
-- ============================================
-- Add a column to link internal authors (college staff) to their employee record
-- External authors will have employee_id = NULL

-- Step 1: Add employee_id column to existing authors table
ALTER TABLE authors 
ADD COLUMN employee_id INT NULL COMMENT 'FK to master_employees for internal college staff'
AFTER id;

-- Step 2: Make name nullable (internal authors get name from master_employees)
ALTER TABLE authors
MODIFY name VARCHAR(255) NULL;

-- Step 3: Add foreign key constraint
ALTER TABLE authors
ADD CONSTRAINT fk_author_employee 
FOREIGN KEY (employee_id) REFERENCES master_employees(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Step 4: Add index for performance
ALTER TABLE authors
ADD KEY idx_author_employee (employee_id);


-- ============================================
-- DATA MIGRATION (Run after importing employees)
-- ============================================
-- Uncomment and run these AFTER you have imported employee data into master_employees

-- Link existing authors to employees by email match
-- UPDATE authors a
-- JOIN master_employees e ON LOWER(TRIM(a.email)) = LOWER(TRIM(e.email))
-- SET a.employee_id = e.id
-- WHERE a.email IS NOT NULL 
--   AND a.email != ''
--   AND a.employee_id IS NULL;

-- Verify the linkage
-- SELECT 
--     COUNT(*) as total_authors,
--     SUM(CASE WHEN employee_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_employee,
--     SUM(CASE WHEN employee_id IS NULL THEN 1 ELSE 0 END) as external_authors
-- FROM authors;


-- ============================================
-- UPDATED VIEW: Authors with Employee Details
-- ============================================
-- This view gives you author info along with their employee details (if internal)

CREATE OR REPLACE VIEW v_authors AS
SELECT 
    a.id AS author_id,
    a.author_id AS author_code,
    
    -- Use employee data if linked, otherwise use author's own data
    CASE 
        WHEN a.employee_id IS NOT NULL THEN 
            CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, ''))
        ELSE a.name 
    END AS author_name,
    
    CASE WHEN a.employee_id IS NOT NULL THEN e.email ELSE a.email END AS email,
    CASE WHEN a.employee_id IS NOT NULL THEN e.designation ELSE a.designation END AS designation,
    CASE WHEN a.employee_id IS NOT NULL THEN d.name ELSE a.department END AS department,
    CASE WHEN a.employee_id IS NOT NULL THEN 'KSRCT' ELSE a.organization END AS organization,
    
    -- Employee-specific fields (NULL for external authors)
    e.erp_id,
    e.orcid_id,
    e.scopus_id,
    e.wos_researcher_id,
    e.google_scholar_id,
    
    -- Author type flag
    CASE WHEN a.employee_id IS NOT NULL THEN 'Internal' ELSE 'External' END AS author_type,
    
    a.employee_id,
    a.student_ref,
    a.created_at
    
FROM authors a
LEFT JOIN master_employees e ON a.employee_id = e.id
LEFT JOIN master_departments d ON e.department_id = d.id;


-- ============================================
-- USAGE EXAMPLES
-- ============================================

-- Find all authors for a journal (with employee details)
-- SELECT aj.journal_id, v.* 
-- FROM author_journal aj
-- JOIN v_authors v ON aj.author_id = v.author_id
-- WHERE aj.journal_id = 123;

-- Find all publications by an employee
-- SELECT j.title, j.category, aj.is_first_author
-- FROM master_employees e
-- JOIN authors a ON a.employee_id = e.id
-- JOIN author_journal aj ON aj.author_id = a.id
-- JOIN journals j ON aj.journal_id = j.id
-- WHERE e.erp_id = 'EMP001';


-- ============================================
-- VERIFICATION
-- ============================================
-- Run after migration:
-- DESCRIBE authors;
-- SHOW CREATE TABLE authors;
-- SELECT * FROM v_authors LIMIT 10;
