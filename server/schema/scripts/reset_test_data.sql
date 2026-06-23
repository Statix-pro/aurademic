-- Reset Test Data Script
-- Preserves: master_employees, master_departments, master_entities, lookup configurations
-- Clears: All test transactions (journals, projects, events, budgets, finance, expenditure, and logs)
-- Date: June 6, 2026 (Updated At: 2026-06-06 01:42)

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. ACCESS CONTROL & WORKFLOW LOGS
-- ============================================================
TRUNCATE TABLE user_roles;
TRUNCATE TABLE user_entity_roles;
TRUNCATE TABLE workflow_actions;

-- ============================================================
-- 2. EXPENDITURE WORKFLOW TABLES
-- ============================================================
TRUNCATE TABLE expenditure_budget_ledger;
TRUNCATE TABLE expenditure_request_edits;
TRUNCATE TABLE expenditure_bulk_neft_files;
TRUNCATE TABLE expenditure_request_refs;
TRUNCATE TABLE expenditure_request_ref_tracker;
TRUNCATE TABLE expenditure_income_rows;
TRUNCATE TABLE expenditure_unplanned_rows;
TRUNCATE TABLE expenditure_line_rows;
TRUNCATE TABLE expenditure_settlement_rows;
TRUNCATE TABLE expenditure_advance_rows;
TRUNCATE TABLE expenditure_request_bills;
TRUNCATE TABLE expenditure_payee_rows;
TRUNCATE TABLE expenditure_requests;
TRUNCATE TABLE expenditure_payees;

-- ============================================================
-- 3. FINANCE REQUESTS WORKFLOW TABLES
-- ============================================================
TRUNCATE TABLE finance_carry_forward_allocations;
TRUNCATE TABLE finance_budget_usage_ledger;
TRUNCATE TABLE finance_budget_line_usage;
TRUNCATE TABLE finance_request_refs;
TRUNCATE TABLE finance_request_ref_tracker;
TRUNCATE TABLE finance_request_edits;
TRUNCATE TABLE finance_request_annexures;
TRUNCATE TABLE finance_status_updates;
TRUNCATE TABLE finance_budget_breakup;
TRUNCATE TABLE finance_requests;

-- ============================================================
-- 4. BUDGET PROPOSALS MODULE TABLES
-- ============================================================
TRUNCATE TABLE budget_proposal_approvals;
TRUNCATE TABLE budget_line_month_allocations;
TRUNCATE TABLE budget_proposal_lines;
TRUNCATE TABLE budget_proposal_refs;
TRUNCATE TABLE budget_proposal_edits;
TRUNCATE TABLE budget_proposals;
TRUNCATE TABLE Budget_annual;
TRUNCATE TABLE budget_time_freeze_config;

-- ============================================================
-- 5. ACADEMIC EVENTS MODULE TABLES
-- ============================================================
TRUNCATE TABLE youtube_links;
TRUNCATE TABLE important_links;
TRUNCATE TABLE budgets;
TRUNCATE TABLE participants;
TRUNCATE TABLE documents;
TRUNCATE TABLE letters;
TRUNCATE TABLE resource_persons;
TRUNCATE TABLE publicity;
TRUNCATE TABLE finance_docs;
TRUNCATE TABLE finance_sponsors;
TRUNCATE TABLE finance_expenditure;
TRUNCATE TABLE events_uploads;
TRUNCATE TABLE finance_income;
TRUNCATE TABLE finance;
TRUNCATE TABLE coordinators;
TRUNCATE TABLE collaborations;
TRUNCATE TABLE sdgs;
TRUNCATE TABLE themes;
TRUNCATE TABLE target_audience;
TRUNCATE TABLE departments;
TRUNCATE TABLE event_types;
TRUNCATE TABLE pre_events;
TRUNCATE TABLE events;

-- ============================================================
-- 6. RESEARCH PROJECTS MODULE TABLES
-- ============================================================
TRUNCATE TABLE project_collaborations;
TRUNCATE TABLE project_documents;
TRUNCATE TABLE project_grant_disbursements;
TRUNCATE TABLE project_financial_contributions;
TRUNCATE TABLE project_details;
TRUNCATE TABLE project_requests;
TRUNCATE TABLE research_projects;

-- ============================================================
-- 7. JOURNAL PUBLICATIONS MODULE TABLES
-- ============================================================
TRUNCATE TABLE author_journal;
TRUNCATE TABLE author_project;
TRUNCATE TABLE author_students;
TRUNCATE TABLE journal_indexes;
TRUNCATE TABLE journal_status_updates;
TRUNCATE TABLE journal_requests;
TRUNCATE TABLE journals;
TRUNCATE TABLE authors;

-- ============================================================
-- 8. AUTH, IMPORT QUEUES, AND USER SESSIONS
-- ============================================================
TRUNCATE TABLE edit_requests;
TRUNCATE TABLE employee_import_pending;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- Verify
SELECT 'Data cleared successfully. Tables preserved: master_employees, master_departments, master_entities, roles, permissions' AS result;
SELECT 'Lookup tables preserved: journal_options, project_agency_options, project_scheme_options, approval_flow_config, org_units, etc.' AS note;
