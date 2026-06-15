-- ============================================================================
-- Why is advanceTotal = 0 when settling? (settlement not matching its advance)
-- (READ-ONLY — only SELECTs)
-- ----------------------------------------------------------------------------
-- Shows the advance rows vs settlement rows for a finance request so we can see
-- whether their budget_line_id / head / sub-head line up. getCumulativeAdvanceSummary
-- matches an advance by budget_line_id (or NULL-line + head/sub text); if the
-- settlement row points at a different budget_line_id (e.g. target-year line after
-- carry-forward, or an internal split), the advance won't be found -> advanceTotal 0.
--
-- Set the finance ref fragment (digits only):
SET @ref = '2025-0001';
-- ============================================================================

SET @fid = (
  SELECT finance_request_id FROM finance_request_refs
   WHERE request_ref COLLATE utf8mb4_general_ci
         LIKE CONCAT('%', CONVERT(@ref USING utf8mb4) COLLATE utf8mb4_general_ci, '%')
   ORDER BY finance_request_id LIMIT 1
);
SELECT @fid AS resolved_finance_id;

-- 1) Advance rows under this finance request
SELECT
  er.id AS expenditure_id, er.request_type, er.overall_status,
  ar.budget_line_id, ar.budget_head, ar.sub_head,
  ar.budget_head_id, ar.budget_sub_head_id, ar.advance_amount
FROM expenditure_advance_rows ar
JOIN expenditure_requests er ON er.id = ar.expenditure_id
WHERE er.finance_request_id = @fid
ORDER BY er.id, ar.id;

-- 2) Settlement rows under this finance request
SELECT
  er.id AS expenditure_id, er.request_type, er.overall_status,
  sr.budget_line_id, sr.budget_head, sr.sub_head,
  sr.budget_head_id, sr.budget_sub_head_id, sr.settlement_amount
FROM expenditure_settlement_rows sr
JOIN expenditure_requests er ON er.id = sr.expenditure_id
WHERE er.finance_request_id = @fid
ORDER BY er.id, sr.id;

-- 3) Row-identity scope per expenditure (advance vs settlement linkage keys)
SELECT
  er.id AS expenditure_id, er.request_type, er.request_date,
  JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.workflowrowref')) AS workflow_row_ref,
  JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.dashboardRowId'))  AS dashboard_row_id,
  JSON_UNQUOTE(JSON_EXTRACT(er.workflow_state, '$.rowIndex'))        AS row_index
FROM expenditure_requests er
WHERE er.finance_request_id = @fid
ORDER BY er.id;
