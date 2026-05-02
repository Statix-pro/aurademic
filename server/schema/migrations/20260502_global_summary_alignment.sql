-- Migration: Global Summary Alignment for Entities (Safe Version)
-- Date: 2026-05-02
-- Purpose: 
--  1. Align all Cells/Centres/Clubs/Sections to have department_id = NULL in the summary table.
--  2. Merge any fragmented/duplicate summary rows to show accurate totals.
--  Note: Character replacements (&/and) removed to respect official naming conventions.

-- STEP 1: Global Summary Table Alignment (Safe Merge)
-- Move the amounts from "Department-linked" rows to "Unit-linked" rows.
-- This handles ALL entities (Centres, Cells, Clubs, Sections, Prof Bodies).
UPDATE Budget_annual 
SET department_id = NULL 
WHERE beneficiary_type IN ('Centre', 'Cell', 'Club', 'Section', 'Professional Body')
  AND department_id IS NOT NULL;

-- STEP 2: Merge duplicates created by the alignment above
-- This ensures that if a unit had money split across multiple departments,
-- it is now summed together into one correct Unit row.
CREATE TEMPORARY TABLE tmp_annual_alignment_merge AS
SELECT 
    fiscal_year, beneficiary_type, beneficiary_entity_id, entity_id,
    SUM(proposed_total_amount) as p, 
    SUM(approved_total_amount) as a,
    SUM(initial_total_amount) as i,
    SUM(additional_total_amount) as addit,
    SUM(expenditure_total_amount) as e,
    SUM(balance_total_amount) as b,
    SUM(annual_total_amount) as ann
FROM Budget_annual
WHERE beneficiary_type IN ('Centre', 'Cell', 'Club', 'Section', 'Professional Body')
GROUP BY fiscal_year, beneficiary_type, beneficiary_entity_id, entity_id;

-- Clear the fragmented rows for these types
DELETE FROM Budget_annual WHERE beneficiary_type IN ('Centre', 'Cell', 'Club', 'Section', 'Professional Body');

-- Insert the clean, merged totals back into the summary table
INSERT INTO Budget_annual (
    fiscal_year, beneficiary_type, beneficiary_entity_id, entity_id, department_id,
    proposed_total_amount, approved_total_amount, initial_total_amount, 
    additional_total_amount, expenditure_total_amount, balance_total_amount, annual_total_amount
)
SELECT fiscal_year, beneficiary_type, beneficiary_entity_id, entity_id, NULL, p, a, i, addit, e, b, ann
FROM tmp_annual_alignment_merge;

DROP TEMPORARY TABLE tmp_annual_alignment_merge;

-- Verification
SELECT beneficiary_type, COUNT(*) as row_count, SUM(approved_total_amount) as total_approved
FROM Budget_annual
WHERE beneficiary_type IN ('Centre', 'Cell', 'Club', 'Section')
GROUP BY beneficiary_type;
