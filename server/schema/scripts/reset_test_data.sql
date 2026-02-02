-- Reset Test Data Script
-- Preserves: master_employees, master_departments
-- Clears: All other tables with test data

SET FOREIGN_KEY_CHECKS = 0;

-- Clear junction tables first
TRUNCATE TABLE author_journal;
TRUNCATE TABLE author_project;
TRUNCATE TABLE author_students;

-- Clear journal-related tables
TRUNCATE TABLE journal_indexes;
TRUNCATE TABLE journal_status_updates;
TRUNCATE TABLE journal_requests;
TRUNCATE TABLE journals;

-- Clear project-related tables
TRUNCATE TABLE project_collaborations;
TRUNCATE TABLE project_documents;
TRUNCATE TABLE project_grant_disbursements;
TRUNCATE TABLE project_financial_contributions;
TRUNCATE TABLE project_details;
TRUNCATE TABLE project_requests;
TRUNCATE TABLE research_projects;

-- Clear finance tables
TRUNCATE TABLE finance_status_updates;
TRUNCATE TABLE finance_budget_breakup;
TRUNCATE TABLE finance_requests;

-- Clear edit requests
TRUNCATE TABLE edit_requests;

-- Clear authors (will be recreated)
TRUNCATE TABLE authors;

-- Clear users (will need to re-login)
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- Verify
SELECT 'Data cleared successfully. Tables preserved: master_employees, master_departments' AS result;
SELECT 'Lookup tables preserved: journal_options, project_agency_options, project_scheme_options, etc.' AS note;
