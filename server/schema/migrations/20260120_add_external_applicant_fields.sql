-- Migration: Add External Applicant Fields to Finance Requests
-- Author: System
-- Date: 2026-01-20
-- Description: Add fields for external/non-staff applicants (hybrid storage)
-- Run Order: After finance_requests table exists

-- ============================================
-- ADD EXTERNAL APPLICANT FIELDS
-- ============================================
-- These fields are used when employee_id is NULL (external applicants)

ALTER TABLE finance_requests 
ADD COLUMN applicant_name VARCHAR(255) NULL DEFAULT NULL COMMENT 'For external/non-staff applicants'
AFTER employee_id;

ALTER TABLE finance_requests 
ADD COLUMN designation VARCHAR(150) NULL DEFAULT NULL
AFTER applicant_name;

ALTER TABLE finance_requests 
ADD COLUMN department VARCHAR(255) NULL DEFAULT NULL
AFTER designation;

ALTER TABLE finance_requests 
ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL
AFTER department;

ALTER TABLE finance_requests 
ADD COLUMN mobile VARCHAR(15) NULL DEFAULT NULL
AFTER email;

-- ============================================
-- UPDATE VIEW FOR HYBRID STORAGE
-- ============================================
-- Uses COALESCE: pulls from master_employees for staff, falls back to direct fields for external

CREATE OR REPLACE VIEW v_finance_requests AS
SELECT 
    fr.id,
    fr.employee_id,
    fr.created_by,
    
    -- Applicant data: COALESCE for hybrid
    COALESCE(
        CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')),
        fr.applicant_name
    ) AS applicant_name,
    COALESCE(e.designation, fr.designation) AS designation,
    COALESCE(d.name, fr.department) AS department,
    COALESCE(e.email, fr.email) AS email,
    COALESCE(e.mobile, fr.mobile) AS mobile,
    e.erp_id,
    
    -- Is external applicant flag
    CASE WHEN fr.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
    
    -- Request details
    fr.request_date,
    fr.description,
    fr.beneficiary_type,
    fr.beneficiary_value,
    fr.primary_head,
    fr.event_sub_head,
    
    -- Budget
    fr.is_budget_proposed,
    fr.proposed_amount,
    fr.balance_amount,
    fr.total_budget,
    
    -- Financial nature
    fr.income_type,
    fr.income_status,
    fr.income_amount_type,
    fr.credit_status,
    fr.debit_status,
    fr.partial_amount,
    
    -- Enclosures
    fr.enclosures,
    
    -- Approval status
    fr.director_status,
    fr.director_comment,
    fr.principal_status,
    fr.principal_comment,
    fr.principal_priority,
    fr.chairman_status,
    fr.chairman_comment,
    fr.overall_status,
    
    -- Timestamps
    fr.created_at,
    fr.updated_at
    
FROM finance_requests fr
LEFT JOIN master_employees e ON fr.employee_id = e.id
LEFT JOIN master_departments d ON e.department_id = d.id;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check columns were added:
-- DESCRIBE finance_requests;
-- 
-- Test the view:
-- SELECT * FROM v_finance_requests LIMIT 5;
