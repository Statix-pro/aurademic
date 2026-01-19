-- Migration: Import Employee Data from CSV
-- Author: System
-- Date: 2026-01-19
-- Description: Imports employee data from KSRCT Research Profile IDs CSV
-- Run Order: 4 of 4 (After all master tables are created)

-- ============================================
-- NOTES
-- ============================================
-- This script expects:
-- 1. master_departments table to be populated
-- 2. CSV file to be available at the specified path
-- 
-- CSV columns:
-- Title, First Name, Last Name, Designation, Mobile, Gender, DoB, DoJ, DoR, 
-- Status, ERP ID, Email, Dept., Parent Dept., ORCID_ID, WoS Researcher_ID, 
-- Scopus_ID, Google_Scholar_ID

-- ============================================
-- OPTION 1: Direct INSERT statements (Recommended for reliability)
-- ============================================
-- These are generated from the CSV data

INSERT INTO master_employees (
    erp_id, title, first_name, last_name, designation, mobile, gender,
    dob, doj, dor, status, email, department_id,
    orcid_id, wos_researcher_id, scopus_id, google_scholar_id
) VALUES
-- Sample records (first 10 from CSV)
('2330115', 'Ms.', 'Bhuvaneshwari', 'N', 'Assistant Professor', '9843264285', 'Female', 
 STR_TO_DATE('20.08.1983', '%d.%m.%Y'), STR_TO_DATE('07.10.2012', '%d.%m.%Y'), NULL, 'Active',
 'nbhuvaneshwari@ksrct.ac.in', (SELECT id FROM master_departments WHERE name LIKE '%Artificial Intelligence%Data Science%' LIMIT 1),
 '0009-0008-9426-6884', 'PDX-5526-2025', NULL, NULL),

('2330005', 'Mr.', 'Giridharan', 'N', 'Assistant Professor', '8925325252', 'Male',
 STR_TO_DATE('19.09.1990', '%d.%m.%Y'), STR_TO_DATE('01.06.2015', '%d.%m.%Y'), NULL, 'Active',
 'giridharan@ksrct.ac.in', (SELECT id FROM master_departments WHERE name LIKE '%Artificial Intelligence%Data Science%' LIMIT 1),
 '0000-0003-0086-7010', 'PDW-6332-2025', '59222280800', '7PNkFrUAAAAJ'),

('2330314', 'Mr.', 'Karthick', 'J', 'Assistant Professor', '8056408054', 'Male',
 STR_TO_DATE('25.05.1990', '%d.%m.%Y'), STR_TO_DATE('01.07.2025', '%d.%m.%Y'), NULL, 'Active',
 'karthickj@ksrct.ac.in', (SELECT id FROM master_departments WHERE name LIKE '%Artificial Intelligence%Data Science%' LIMIT 1),
 '0009-0000-5459-6741', 'PDX-0683-2025', '59993399100', 'MmnP-QYAAAAJ');

-- ============================================
-- OPTION 2: LOAD DATA (For bulk import - faster)
-- ============================================
-- Run this command in MySQL after copying the CSV to a known location
-- Make sure to adjust the file path

/*
LOAD DATA LOCAL INFILE '/Users/mahesh/Downloads/Chrome/KSRCT Research Profile IDs (1).xlsx - Database.csv'
INTO TABLE master_employees
CHARACTER SET utf8mb4
FIELDS TERMINATED BY ',' 
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 ROWS
(
    title,
    first_name,
    last_name,
    designation,
    mobile,
    gender,
    @dob,
    @doj,
    @dor,
    @status,
    erp_id,
    email,
    @dept,
    @parent_dept,
    @orcid,
    @wos,
    @scopus,
    @gscholar
)
SET 
    dob = NULLIF(STR_TO_DATE(@dob, '%d.%m.%Y'), '0000-00-00'),
    doj = NULLIF(STR_TO_DATE(@doj, '%d.%m.%Y'), '0000-00-00'),
    dor = NULLIF(STR_TO_DATE(@dor, '%d.%m.%Y'), '0000-00-00'),
    status = CASE 
        WHEN @status = 'Active' THEN 'Active'
        WHEN @status = 'Long Leave' THEN 'On Leave'
        WHEN @status = 'Medical Leave' THEN 'On Leave'
        WHEN @status = 'Relieved' THEN 'Resigned'
        ELSE 'Active'
    END,
    department_id = (
        SELECT id FROM master_departments 
        WHERE name = @dept 
        OR name LIKE CONCAT('%', SUBSTRING_INDEX(@dept, ' ', 2), '%')
        LIMIT 1
    ),
    orcid_id = NULLIF(@orcid, ''),
    wos_researcher_id = NULLIF(@wos, ''),
    scopus_id = NULLIF(@scopus, ''),
    google_scholar_id = NULLIF(@gscholar, '');
*/


-- ============================================
-- VERIFICATION
-- ============================================
-- Run after import:
-- SELECT COUNT(*) as total_employees FROM master_employees;
-- SELECT department_id, COUNT(*) as count FROM master_employees GROUP BY department_id;
-- SELECT * FROM v_employees LIMIT 10;
