/**
 * Shared SQL fragments for filtering expenditure requests.
 *
 * Lives in shared/ rather than in expenditureModel.js so the report module can reuse it
 * without importing that model — the model is mocked wholesale in the test suite, and a
 * mocked module cannot supply a real SQL builder.
 */

/**
 * Fiscal-year membership for an expenditure request, as a WHERE fragment taking five copies
 * of the year.
 *
 * A request belongs to a year when any of its advance/settlement/expenditure rows point at a
 * proposal from that year, when its finance request was carried forward into that year, or —
 * for requests with no proposal link at all — when its own date falls in that year (April
 * start). The approval queue and the report both call this, so a request can never appear
 * under one year in the queue and a different one in the report.
 *
 * @param {string} alias - table alias for expenditure_requests.
 * @returns {string} SQL fragment expecting params [year, year, year, year, year].
 */
export function buildExpenditureFiscalYearCondition(alias = 'er') {
  return `(
      EXISTS (
        SELECT 1
          FROM expenditure_advance_rows ar_fy
          JOIN budget_proposals bp_fy ON bp_fy.id = ar_fy.budget_proposal_id
         WHERE ar_fy.expenditure_id = ${alias}.id
           AND bp_fy.fiscal_year = ?
      )
      OR EXISTS (
        SELECT 1
          FROM expenditure_settlement_rows sr_fy
          JOIN budget_proposals bp_fy ON bp_fy.id = sr_fy.budget_proposal_id
         WHERE sr_fy.expenditure_id = ${alias}.id
           AND bp_fy.fiscal_year = ?
      )
      OR EXISTS (
        SELECT 1
          FROM expenditure_line_rows lr_fy
          JOIN budget_proposals bp_fy ON bp_fy.id = lr_fy.budget_proposal_id
         WHERE lr_fy.expenditure_id = ${alias}.id
           AND bp_fy.fiscal_year = ?
      )
      OR EXISTS (
        -- Carry-forward: a proposal carried into the target year must surface
        -- under that target year for approvers too — matching finance/budget
        -- (financeModel.listFinanceQueueRecords) and the creator dashboard.
        SELECT 1
          FROM finance_carry_forward_allocations cf_fy
         WHERE cf_fy.finance_request_id = ${alias}.finance_request_id
           AND cf_fy.target_fiscal_year = ?
           AND LOWER(TRIM(COALESCE(cf_fy.status, 'active'))) = 'active'
      )
      OR (
        NOT EXISTS (SELECT 1 FROM expenditure_advance_rows ar_any WHERE ar_any.expenditure_id = ${alias}.id AND ar_any.budget_proposal_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM expenditure_settlement_rows sr_any WHERE sr_any.expenditure_id = ${alias}.id AND sr_any.budget_proposal_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM expenditure_line_rows lr_any WHERE lr_any.expenditure_id = ${alias}.id AND lr_any.budget_proposal_id IS NOT NULL)
        AND (
          YEAR(COALESCE(${alias}.request_date, ${alias}.created_at))
            - (MONTH(COALESCE(${alias}.request_date, ${alias}.created_at)) < 4)
        ) = ?
      )
    )`;
}
