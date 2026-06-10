-- ============================================================================
-- Budget duplicate-line audit  (READ-ONLY — runs only SELECTs)
-- ----------------------------------------------------------------------------
-- Purpose: before consolidating duplicate budget_proposal_lines (same proposal,
-- same budget_head + sub_head) we need to know the blast radius — how many
-- duplicates exist and how many of the duplicate line ids are referenced by
-- financial records (finance usage/ledger, expenditure rows/ledger, month
-- allocations). Those references decide whether a merge is a trivial DELETE or
-- a careful repoint-then-delete migration.
--
-- "Duplicate" key = (budget_proposal_id, LOWER(TRIM(budget_head)),
--                    LOWER(TRIM(sub_head)))  — matches the app's grouping.
--
-- Run:  mysql -u <user> -p research < budget_duplicate_lines_audit.sql
-- Nothing here writes data.
-- ============================================================================

-- 1) Headline: how many proposals and how many extra (mergeable) lines? --------
--    surplus_lines = total dup lines minus one survivor per group.
SELECT
  COUNT(*)                              AS duplicate_groups,
  SUM(line_count)                       AS lines_in_dup_groups,
  SUM(line_count - 1)                   AS surplus_lines_to_merge,
  COUNT(DISTINCT budget_proposal_id)    AS affected_proposals
FROM (
  SELECT
    budget_proposal_id,
    LOWER(TRIM(budget_head)) AS h,
    LOWER(TRIM(sub_head))    AS s,
    COUNT(*)                 AS line_count
  FROM budget_proposal_lines
  GROUP BY budget_proposal_id, LOWER(TRIM(budget_head)), LOWER(TRIM(sub_head))
  HAVING COUNT(*) > 1
) AS dup_groups;

-- 2) The duplicate groups themselves, with the line ids that collide ----------
SELECT
  l.budget_proposal_id,
  p.status                                          AS proposal_status,
  l.budget_head,
  l.sub_head,
  COUNT(*)                                          AS line_count,
  GROUP_CONCAT(l.id ORDER BY l.id)                  AS line_ids,
  MIN(l.id)                                         AS proposed_survivor_id,
  SUM(l.line_total)                                 AS combined_line_total
FROM budget_proposal_lines l
JOIN budget_proposals p ON p.id = l.budget_proposal_id
GROUP BY l.budget_proposal_id, p.status,
         LOWER(TRIM(l.budget_head)), LOWER(TRIM(l.sub_head)),
         l.budget_head, l.sub_head
HAVING COUNT(*) > 1
ORDER BY line_count DESC, l.budget_proposal_id;

-- 3) Reference blast radius: for every line that lives in a dup group, count ---
--    how many financial rows point at it in each FK table. Any non-zero column
--    means a plain DELETE would cascade/null/block — i.e. repointing required.
WITH dup_line_ids AS (
  SELECT l.id AS line_id
  FROM budget_proposal_lines l
  JOIN (
    SELECT budget_proposal_id,
           LOWER(TRIM(budget_head)) AS h,
           LOWER(TRIM(sub_head))    AS s
    FROM budget_proposal_lines
    GROUP BY budget_proposal_id, LOWER(TRIM(budget_head)), LOWER(TRIM(sub_head))
    HAVING COUNT(*) > 1
  ) g
    ON g.budget_proposal_id = l.budget_proposal_id
   AND g.h = LOWER(TRIM(l.budget_head))
   AND g.s = LOWER(TRIM(l.sub_head))
)
SELECT
  (SELECT COUNT(*) FROM dup_line_ids)                                                          AS dup_lines_total,
  (SELECT COUNT(*) FROM budget_line_month_allocations  WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS month_allocation_refs,
  (SELECT COUNT(*) FROM expenditure_advance_rows       WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS advance_row_refs,
  (SELECT COUNT(*) FROM expenditure_settlement_rows    WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS settlement_row_refs,
  (SELECT COUNT(*) FROM expenditure_line_rows          WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS expenditure_row_refs,
  (SELECT COUNT(*) FROM expenditure_budget_ledger      WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS expenditure_ledger_refs_RESTRICT,
  (SELECT COUNT(*) FROM finance_budget_line_usage      WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS finance_usage_refs,
  (SELECT COUNT(*) FROM finance_budget_usage_ledger    WHERE budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS finance_ledger_refs,
  (SELECT COUNT(*) FROM expenditure_requests           WHERE unplanned_head_of_account_budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS unplanned_head_refs,
  (SELECT COUNT(*) FROM expenditure_unplanned_rows     WHERE head_of_account_budget_line_id IN (SELECT line_id FROM dup_line_ids)) AS unplanned_row_refs;

-- 4) Same reference counts but per duplicate line id, so we can see exactly ----
--    which collisions carry real history (only rows with any reference shown).
WITH dup_line_ids AS (
  SELECT l.id AS line_id, l.budget_proposal_id, l.budget_head, l.sub_head
  FROM budget_proposal_lines l
  JOIN (
    SELECT budget_proposal_id,
           LOWER(TRIM(budget_head)) AS h,
           LOWER(TRIM(sub_head))    AS s
    FROM budget_proposal_lines
    GROUP BY budget_proposal_id, LOWER(TRIM(budget_head)), LOWER(TRIM(sub_head))
    HAVING COUNT(*) > 1
  ) g
    ON g.budget_proposal_id = l.budget_proposal_id
   AND g.h = LOWER(TRIM(l.budget_head))
   AND g.s = LOWER(TRIM(l.sub_head))
)
SELECT
  d.line_id, d.budget_proposal_id, d.budget_head, d.sub_head,
  (SELECT COUNT(*) FROM expenditure_advance_rows    WHERE budget_line_id = d.line_id) AS adv,
  (SELECT COUNT(*) FROM expenditure_settlement_rows WHERE budget_line_id = d.line_id) AS settle,
  (SELECT COUNT(*) FROM expenditure_line_rows       WHERE budget_line_id = d.line_id) AS exp,
  (SELECT COUNT(*) FROM expenditure_budget_ledger   WHERE budget_line_id = d.line_id) AS exp_ledger,
  (SELECT COUNT(*) FROM finance_budget_line_usage   WHERE budget_line_id = d.line_id) AS fin_usage,
  (SELECT COUNT(*) FROM finance_budget_usage_ledger WHERE budget_line_id = d.line_id) AS fin_ledger,
  (SELECT COUNT(*) FROM budget_line_month_allocations WHERE budget_line_id = d.line_id) AS months
FROM dup_line_ids d
HAVING (adv + settle + exp + exp_ledger + fin_usage + fin_ledger) > 0
ORDER BY d.budget_proposal_id, d.line_id;
