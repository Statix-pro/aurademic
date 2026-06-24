-- Migration: Clean Up Authors Data
-- Author: System
-- Date: 2026-01-19
-- Description: Link existing authors to master_employees and clean redundant data
-- Run Order: 5 (After employee data is imported)

-- ============================================
-- STEP 1: Link Authors to Employees by Email
-- ============================================
-- Match existing author records to employees using email

UPDATE authors a
JOIN master_employees e ON LOWER(TRIM(a.email)) = LOWER(TRIM(e.email))
SET a.employee_id = e.id
WHERE a.email IS NOT NULL 
  AND a.email != ''
  AND a.employee_id IS NULL;

-- ============================================
-- STEP 2: Verify Linkage
-- ============================================
SELECT 
    COUNT(*) as total_authors,
    SUM(CASE WHEN employee_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_employee,
    SUM(CASE WHEN employee_id IS NULL THEN 1 ELSE 0 END) as external_authors
FROM authors;

-- ============================================
-- STEP 3: Clear Redundant Data for Internal Authors
-- ============================================
-- For authors linked to employees, we clear the redundant fields
-- since data will now come from master_employees via the view

UPDATE authors
SET 
    name = NULL,
    designation = NULL,
    department = NULL,
    organization = NULL
WHERE employee_id IS NOT NULL;

-- ============================================
-- STEP 4: Verify Cleanup
-- ============================================
-- Check that internal authors now have NULL local fields
SELECT 
    a.id,
    a.employee_id,
    a.name AS author_name_field,
    e.first_name AS employee_name,
    a.email AS author_email,
    e.email AS employee_email
FROM authors a
JOIN master_employees e ON a.employee_id = e.id
LIMIT 10;

-- Check external authors still have their data
SELECT 
    a.id,
    a.name,
    a.email,
    a.organization
FROM authors a
WHERE a.employee_id IS NULL
LIMIT 10;

-- ============================================
-- STEP 5: Test the View
-- ============================================
-- The v_authors view should now work correctly
-- SELECT * FROM v_authors LIMIT 20;

-- ============================================
-- SUMMARY
-- ============================================
-- After running this migration:
-- 1. Internal authors (KSRCT staff) → employee_id is set, local fields are NULL
-- 2. External authors (other colleges) → employee_id is NULL, local fields have data
-- 3. v_authors view → Returns correct data from appropriate source
