-- ==================================================================
-- Migration: backfill the budget 'resubmitted' log rows
-- Author: Maheshwaran A K
-- Date: 2026-10-26
--
-- The budget approval cards show "Resubmitted on", read from the applicant's
-- `decision = 'resubmitted'` row in `budget_proposal_approvals`. That row has been
-- written on every resubmit only since commit 8c45a7d (2026-05-27); a proposal
-- resubmitted before then has no row, so its card shows no date -- including ones still
-- waiting in a queue as re_submitted.
--
-- The resubmit itself was logged all along: it is an edit, and every edit writes a
-- `budget_proposal_edits` row. A resubmission is the first edit after a return made by
-- the applicant -- the proposal's owner, or an editor the edit log records as 'user'
-- (a HOD resubmitting their own proposal is logged as 'hod'; a proposal raised on
-- someone's behalf has a different owner). Approvers' edits are neither.
-- Checked against all 23 rows written since 2026-05-27: the rule finds each one to the
-- second, with no misses.
--
-- For every return with no 'resubmitted' row before the next return, this inserts one,
-- dated at that edit, as the applicant who made it. `feedback` stays NULL -- the
-- remarks were not kept -- which also marks these rows: every row the app writes
-- carries the required remarks. No status, stage or amount changes, and no
-- notification is sent; the rows only add the missing log entry.
--
-- Idempotent: a return that already has a 'resubmitted' row in its window is skipped,
-- so a second run inserts nothing.
--
-- Read-only audit, run before and after (after: 0 rows):
--
--   SELECT c.budget_proposal_id, c.status, c.returned_at, e.created_at AS resubmitted_at
--     FROM (SELECT r.budget_proposal_id, r.decided_at AS returned_at, bp.status,
--                  (SELECT MIN(n.decided_at) FROM budget_proposal_approvals n
--                    WHERE n.budget_proposal_id = r.budget_proposal_id
--                      AND n.decision = 'returned'
--                      AND (n.decided_at > r.decided_at
--                           OR (n.decided_at = r.decided_at AND n.id > r.id))) AS next_returned_at,
--                  bp.user_id
--             FROM budget_proposal_approvals r
--             JOIN budget_proposals bp ON bp.id = r.budget_proposal_id
--            WHERE r.decision = 'returned') c
--     JOIN budget_proposal_edits e ON e.id = (
--            SELECT e2.id FROM budget_proposal_edits e2
--             WHERE e2.budget_proposal_id = c.budget_proposal_id
--               AND (e2.edited_by_user_id = c.user_id
--                    OR JSON_UNQUOTE(JSON_EXTRACT(e2.details, '$.editorRole')) = 'user')
--               AND e2.created_at >= c.returned_at
--               AND (c.next_returned_at IS NULL OR e2.created_at < c.next_returned_at)
--             ORDER BY e2.created_at, e2.id LIMIT 1)
--    WHERE NOT EXISTS (SELECT 1 FROM budget_proposal_approvals x
--                       WHERE x.budget_proposal_id = c.budget_proposal_id
--                         AND x.decision = 'resubmitted'
--                         AND x.decided_at >= c.returned_at
--                         AND (c.next_returned_at IS NULL OR x.decided_at < c.next_returned_at))
--    ORDER BY resubmitted_at;
--
--   SELECT COUNT(*) AS resubmitted_rows,
--          SUM(feedback IS NULL) AS backfilled_rows
--     FROM budget_proposal_approvals WHERE decision = 'resubmitted';
-- ==================================================================

START TRANSACTION;

INSERT INTO budget_proposal_approvals
  (budget_proposal_id, role, approver_user_id, approver_email,
   decision, feedback, allows_edit, decided_at)
SELECT c.budget_proposal_id, 'applicant', COALESCE(e.edited_by_user_id, 0),
       COALESCE(e.edited_by_email, ''), 'resubmitted', NULL, 0, e.created_at
  FROM (SELECT r.budget_proposal_id, r.decided_at AS returned_at,
               (SELECT MIN(n.decided_at) FROM budget_proposal_approvals n
                 WHERE n.budget_proposal_id = r.budget_proposal_id
                   AND n.decision = 'returned'
                   AND (n.decided_at > r.decided_at
                        OR (n.decided_at = r.decided_at AND n.id > r.id))) AS next_returned_at,
               bp.user_id
          FROM budget_proposal_approvals r
          JOIN budget_proposals bp ON bp.id = r.budget_proposal_id
         WHERE r.decision = 'returned') c
  JOIN budget_proposal_edits e ON e.id = (
         SELECT e2.id FROM budget_proposal_edits e2
          WHERE e2.budget_proposal_id = c.budget_proposal_id
            AND (e2.edited_by_user_id = c.user_id
                 OR JSON_UNQUOTE(JSON_EXTRACT(e2.details, '$.editorRole')) = 'user')
            AND e2.created_at >= c.returned_at
            AND (c.next_returned_at IS NULL OR e2.created_at < c.next_returned_at)
          ORDER BY e2.created_at, e2.id LIMIT 1)
 WHERE NOT EXISTS (SELECT 1 FROM budget_proposal_approvals x
                    WHERE x.budget_proposal_id = c.budget_proposal_id
                      AND x.decision = 'resubmitted'
                      AND x.decided_at >= c.returned_at
                      AND (c.next_returned_at IS NULL OR x.decided_at < c.next_returned_at));

COMMIT;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- Only backfilled rows have no remarks; every resubmit the app writes requires them.
-- DELETE FROM budget_proposal_approvals
--  WHERE decision = 'resubmitted' AND role = 'applicant' AND feedback IS NULL;
