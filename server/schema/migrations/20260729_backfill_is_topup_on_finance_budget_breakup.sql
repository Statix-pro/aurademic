-- ============================================
-- Migration: Backfill is_topup on finance_budget_breakup
-- Date: 2026-07-29
-- ============================================

-- Description:
-- finance_budget_breakup.is_topup was added on 2026-06-27, but normalizeBudgetRows
-- dropped the flag before insert (it rebuilt each row from a field whitelist that
-- omitted is_topup), so replaceBudgetRows wrote 0 for every row. Top-up rows created
-- before that fix are stored with is_topup = 0, making them indistinguishable from
-- original proposal rows in the detail/admin views and the PDF, and leaving
-- topup_amount at 0 on the dashboard card.
--
-- Discriminator: the usage ledger's net consumed total is the authority on which rows
-- were already paid for by the original approval. Rows are ordered originals-first
-- (the top-up path appends), so the top-up rows are exactly the suffix whose running
-- total exceeds what the ledger covers.
--
-- Why not simpler signals — both were checked against real data and rejected:
--   * approved_amount IS NULL: some original rows were consumed without
--     approved_amount ever being written, so this mislabels them as top-ups.
--   * finance_budget_usage_ledger.finance_budget_breakup_id: legacy ledger rows carry
--     NULL there, and replaceBudgetRows deletes/re-inserts rows so ids are rewritten.
--
-- Requires MySQL 8 (window functions).

-- ============================================
-- STEP 1 — PREVIEW. Run this first and eyeball the result.
-- Expect: only the appended top-up rows, never a request's first row.
-- ============================================
WITH ledger AS (
  SELECT finance_id,
         COALESCE(SUM(CASE WHEN operation = 'consume' THEN amount ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN operation = 'release' THEN amount ELSE 0 END), 0)
           AS net_consumed
    FROM finance_budget_usage_ledger
   GROUP BY finance_id
),
ranked AS (
  SELECT fbb.id,
         fbb.finance_id,
         fbb.budget_head,
         fbb.sub_head,
         fbb.amount,
         fbb.is_topup,
         SUM(fbb.amount) OVER (
           PARTITION BY fbb.finance_id ORDER BY fbb.sort_order, fbb.id
         ) AS running_total
    FROM finance_budget_breakup fbb
)
SELECT r.finance_id, r.id, r.budget_head, r.sub_head, r.amount,
       r.running_total, l.net_consumed, r.is_topup AS is_topup_now
  FROM ranked r
  JOIN ledger l ON l.finance_id = r.finance_id
  JOIN finance_requests fr ON fr.id = r.finance_id
 WHERE r.is_topup = 0
   AND l.net_consumed > 0
   AND r.running_total > l.net_consumed
   AND JSON_EXTRACT(fr.workflow_state, '$.topupAt') IS NOT NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.topupAt')) NOT IN ('', 'null')
   -- Same alignment guard as STEP 2 — keep the two predicates identical so the
   -- preview shows exactly what the UPDATE will change.
   AND EXISTS (
     SELECT 1
       FROM ranked aligned
      WHERE aligned.finance_id = r.finance_id
        AND aligned.running_total = l.net_consumed
   )
 ORDER BY r.finance_id, r.running_total;

-- ============================================
-- STEP 2 — APPLY. Same predicate as the preview.
-- ============================================
UPDATE finance_budget_breakup target
  JOIN (
    WITH ledger AS (
      SELECT finance_id,
             COALESCE(SUM(CASE WHEN operation = 'consume' THEN amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN operation = 'release' THEN amount ELSE 0 END), 0)
               AS net_consumed
        FROM finance_budget_usage_ledger
       GROUP BY finance_id
    ),
    ranked AS (
      SELECT fbb.id,
             fbb.finance_id,
             fbb.is_topup,
             SUM(fbb.amount) OVER (
               PARTITION BY fbb.finance_id ORDER BY fbb.sort_order, fbb.id
             ) AS running_total
        FROM finance_budget_breakup fbb
    )
    SELECT r.id
      FROM ranked r
      JOIN ledger l ON l.finance_id = r.finance_id
      JOIN finance_requests fr ON fr.id = r.finance_id
     WHERE r.is_topup = 0
       AND l.net_consumed > 0
       AND r.running_total > l.net_consumed
       AND JSON_EXTRACT(fr.workflow_state, '$.topupAt') IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.topupAt')) NOT IN ('', 'null')
       -- Only touch requests where net_consumed lands EXACTLY on a row boundary.
       -- Consumption always commits whole rows, so if no row's running total equals
       -- net_consumed the row amounts were edited after approval and the original
       -- composition is unrecoverable — guessing there would mislabel an original
       -- row as a top-up. Such requests are skipped and must be set by hand
       -- (see STEP 4).
       AND EXISTS (
         SELECT 1
           FROM ranked aligned
          WHERE aligned.finance_id = r.finance_id
            AND aligned.running_total = l.net_consumed
       )
  ) AS picked ON picked.id = target.id
   SET target.is_topup = 1;

-- ============================================
-- STEP 3 — VERIFICATION: top-ups approved but never consumed
-- ============================================
-- These are requests where a top-up was APPROVED while the old per-request
-- consumption guard was in place. Their top-up amount was never deducted from the
-- budget line and never added to approved_total_amount. The code fix prevents new
-- occurrences but cannot retroactively repair these — review each one and correct
-- the budget line usage deliberately.
--
-- Compares what the ledger actually committed to budget lines against the sum of the
-- request's rows. A positive shortfall is row value that was approved on paper but
-- never deducted from any budget line (the unplanned amount is excluded because it is
-- never consumed from a budget line).
SELECT fr.id,
       fr.approved_total_amount,
       rows_total.total_rows,
       l.net_consumed,
       rows_total.total_rows - l.net_consumed AS shortfall_not_consumed,
       rows_total.topup_rows,
       JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')) AS status
  FROM finance_requests fr
  JOIN (
    SELECT finance_id,
           SUM(amount) AS total_rows,
           SUM(CASE WHEN is_topup = 1 THEN amount ELSE 0 END) AS topup_rows
      FROM finance_budget_breakup
     GROUP BY finance_id
  ) rows_total ON rows_total.finance_id = fr.id
  JOIN (
    SELECT finance_id,
           COALESCE(SUM(CASE WHEN operation = 'consume' THEN amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN operation = 'release' THEN amount ELSE 0 END), 0)
             AS net_consumed
      FROM finance_budget_usage_ledger
     GROUP BY finance_id
  ) l ON l.finance_id = fr.id
 WHERE JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status'))
         IN ('approved', 'completed')
   AND rows_total.total_rows > l.net_consumed
 ORDER BY shortfall_not_consumed DESC;

-- ============================================
-- STEP 4 — AMBIGUOUS REQUESTS (manual)
-- ============================================
-- Requests that have been topped up but whose net_consumed does NOT align with any
-- row boundary. Their row amounts were edited after approval, so which rows came from
-- the top-up cannot be derived from the data — STEP 2 deliberately skips them.
-- List them, decide from the request's own history/UI which rows were the top-up,
-- then flag those row ids explicitly.
--
SELECT fr.id AS finance_id,
       l.net_consumed,
       SUM(fbb.amount) AS total_rows,
       COUNT(*) AS row_count
  FROM finance_requests fr
  JOIN finance_budget_breakup fbb ON fbb.finance_id = fr.id
  JOIN (
    SELECT finance_id,
           COALESCE(SUM(CASE WHEN operation = 'consume' THEN amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN operation = 'release' THEN amount ELSE 0 END), 0)
             AS net_consumed
      FROM finance_budget_usage_ledger
     GROUP BY finance_id
  ) l ON l.finance_id = fr.id
 WHERE JSON_EXTRACT(fr.workflow_state, '$.topupAt') IS NOT NULL
   AND l.net_consumed > 0
   AND NOT EXISTS (
     SELECT 1
       FROM (
         SELECT finance_id,
                SUM(amount) OVER (
                  PARTITION BY finance_id ORDER BY sort_order, id
                ) AS running_total
           FROM finance_budget_breakup
       ) rt
      WHERE rt.finance_id = fr.id
        AND rt.running_total = l.net_consumed
   )
 GROUP BY fr.id, l.net_consumed;

-- Then, per request, after confirming which rows are the top-up, fill in the row
-- ids and run (kept commented — this is the one statement in this file you must
-- edit by hand before running):
-- UPDATE finance_budget_breakup SET is_topup = 1 WHERE id IN (/* row ids */);

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- Note: this reverts ALL is_topup flags on topped-up requests, including any set
-- correctly by the application after the code fix. Prefer restoring from a backup.
-- UPDATE finance_budget_breakup fbb
--   JOIN finance_requests fr ON fr.id = fbb.finance_id
--    SET fbb.is_topup = 0
--  WHERE JSON_EXTRACT(fr.workflow_state, '$.topupAt') IS NOT NULL;
