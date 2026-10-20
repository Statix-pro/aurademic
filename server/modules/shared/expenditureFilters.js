/**
 * Shared SQL fragments for filtering expenditure requests.
 *
 * Lives in shared/ rather than in expenditureModel.js so the report module can reuse it
 * without importing that model — the model is mocked wholesale in the test suite, and a
 * mocked module cannot supply a real SQL builder.
 */

/**
 * Normalize a text column to one charset/collation so it can be combined across tables in a
 * UNION.
 *
 * The three expenditure row tables were created with differing column collations, which makes
 * MySQL raise ER_CANT_AGGREGATE_NCOLLATIONS ("Illegal mix of collations") on UNION. Shared
 * rather than copied per module: two copies would have to be changed together, and the one
 * left behind would start throwing at runtime rather than failing a test.
 */
export const collateBudgetText = (expr) =>
  `CONVERT(${expr} USING utf8mb4) COLLATE utf8mb4_unicode_ci`;

/**
 * A request counts as finalized once it has cleared its workflow.
 *
 * Only finalized money is reported as advance/settlement/expenditure; anything still moving is
 * reported as pending. The approval queue and the report share this, so a new terminal status
 * cannot be recognised by one and read as "pending" by the other.
 *
 * @param {string} alias - table alias for expenditure_requests.
 * @returns {string} SQL boolean fragment taking no params.
 */
export function buildFinalizedExpenditureStatusCondition(alias = 'er') {
  return `(
    LOWER(TRIM(COALESCE(${alias}.overall_status, ''))) IN ('approved', 'completed')
    OR LOWER(TRIM(COALESCE(${alias}.workflow_status, ''))) IN ('approved', 'completed')
    OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(${alias}.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
  )`;
}

/**
 * The reference shown for a request: its first assigned ref, falling back to a synthesized
 * `#EX-YYYY-NNNN`.
 *
 * Shared so the queue and the report cannot show different refs for the same request — the
 * report also SEARCHES on this expression, so a divergence would make a ref copied from the
 * queue find nothing in the report.
 *
 * @param {string} alias - table alias for expenditure_requests.
 */
export function buildExpenditureDisplayRefExpr(alias = 'er') {
  return `COALESCE(
    (
      SELECT err_display.request_ref
        FROM expenditure_request_refs err_display
       WHERE err_display.expenditure_request_id = ${alias}.id
       ORDER BY err_display.id ASC
       LIMIT 1
    ),
    CONCAT('#EX-', YEAR(COALESCE(${alias}.request_date, ${alias}.created_at)), '-', LPAD(${alias}.id, 4, '0'))
  )`;
}

/**
 * Which expenditure requests count as a claim against a finance card.
 *
 * Rejected and archived requests are not claims. Counting them let a rejected request
 * inflate `claimed_amount` permanently, and — because the card swaps its amount boxes and
 * its status label once anything is claimed — an approved card could read "Claimed" for
 * money that was never released.
 *
 * Pending and returned requests DO count: they are live claims moving through the workflow,
 * and the card has to show that headroom as committed so a user cannot claim it twice.
 *
 * The finance card (financeModel.getFinanceClaimTotalsByFinanceIds) and the expenditure
 * dashboard (expenditureModel.getExpenditureDashboard) both use this, so the two screens
 * cannot disagree about the same card.
 *
 * @param {string} alias - table alias for expenditure_requests.
 * @returns {string} SQL boolean fragment taking no params.
 */
export function buildClaimedExpenditureStatusCondition(alias = 'er') {
  return `LOWER(TRIM(COALESCE(${alias}.overall_status, 'pending'))) NOT IN ('rejected', 'deleted', 'archived')`;
}

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
        -- FALLBACK: expenditure requests raised before the row tables carried
        -- budget_proposal_id have no proposal to read a fiscal year from, so the request's own
        -- date decides the year (April start). Only applies when NONE of a request's rows carry
        -- a proposal link, so a linked request is never classified by date.
        -- Remove once every row has a proposal link, i.e. once all three of these return 0:
        --   SELECT COUNT(*) FROM expenditure_advance_rows    WHERE budget_proposal_id IS NULL;
        --   SELECT COUNT(*) FROM expenditure_settlement_rows WHERE budget_proposal_id IS NULL;
        --   SELECT COUNT(*) FROM expenditure_line_rows       WHERE budget_proposal_id IS NULL;
        NOT EXISTS (SELECT 1 FROM expenditure_advance_rows fallback_ar WHERE fallback_ar.expenditure_id = ${alias}.id AND fallback_ar.budget_proposal_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM expenditure_settlement_rows fallback_sr WHERE fallback_sr.expenditure_id = ${alias}.id AND fallback_sr.budget_proposal_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM expenditure_line_rows fallback_lr WHERE fallback_lr.expenditure_id = ${alias}.id AND fallback_lr.budget_proposal_id IS NOT NULL)
        AND (
          YEAR(COALESCE(${alias}.request_date, ${alias}.created_at))
            - (MONTH(COALESCE(${alias}.request_date, ${alias}.created_at)) < 4)
        ) = ?
      )
    )`;
}
