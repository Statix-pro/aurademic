-- Migration: Add Scopus ID and SCIE ID to journals table and update v_authors view to remove salutations
-- Created: 2026-03-17

-- 1. Add Scopus and SCIE ID columns to journals
ALTER TABLE journals ADD COLUMN scopus_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE journals ADD COLUMN scie_id VARCHAR(100) DEFAULT NULL;

-- 2. Update v_authors view to remove salutations (titles like Dr, Mr, etc) from faculty names
CREATE OR REPLACE VIEW v_authors AS 
SELECT 
    a.id AS author_id, 
    a.author_id AS author_code, 
    (CASE 
        WHEN (a.employee_id IS NOT NULL) 
        THEN TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, ''))) 
        ELSE a.name 
    END) AS author_name, 
    (CASE WHEN (a.employee_id IS NOT NULL) THEN e.email ELSE a.email END) AS email, 
    (CASE WHEN (a.employee_id IS NOT NULL) THEN e.designation ELSE a.designation END) AS designation, 
    (CASE WHEN (a.employee_id IS NOT NULL) THEN d.name ELSE a.department END) AS department, 
    (CASE WHEN (a.employee_id IS NOT NULL) THEN 'K.S.Rangasamy College of Technology' ELSE a.organization END) AS organization, 
    e.erp_id AS erp_id, 
    e.orcid_id AS orcid_id, 
    e.scopus_id AS scopus_id, 
    e.wos_researcher_id AS wos_researcher_id, 
    e.google_scholar_id AS google_scholar_id, 
    (CASE WHEN (a.employee_id IS NOT NULL) THEN 'Internal' ELSE 'External' END) AS author_type, 
    a.employee_id AS employee_id, 
    a.student_ref AS student_ref, 
    a.created_at AS created_at 
FROM ((authors a 
    LEFT JOIN master_employees e ON ((a.employee_id = e.id))) 
    LEFT JOIN master_departments d ON ((e.department_id = d.id)));
