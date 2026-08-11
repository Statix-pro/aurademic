-- ============================================
-- Migration: De-duplicate approval_flow_config and make the unique key
--            NULL-safe so duplicates cannot be re-created
-- Date: 2026-08-04
-- ============================================

-- Description:
-- `uq_approval_flow` is UNIQUE (beneficiary_type, entity_type_code, module_key).
-- MySQL treats NULLs as DISTINCT in a unique index, so for every module
-- registered with `entity_type_code = NULL` the constraint enforces nothing and
-- `INSERT ... ON DUPLICATE KEY UPDATE` never fires -- each re-run of a
-- registration migration silently appends another row.
--
-- That already happened: approval_flow_config holds three identical
-- ('*', NULL, 'finance') rows (ids 8, 9, 10), created 2026-03-23, 2026-04-01
-- and 2026-04-01. Row 11 ('*', NULL, 'expenditure') is exposed the same way and
-- would duplicate on the next re-run.
--
-- Runtime impact today: NONE. Both read paths happen to tolerate duplicates --
-- resolveFlowConfig() (workflowService.js:114) ends in `ORDER BY ... id ASC
-- LIMIT 1`, and getWorkflowMetadata() (workflowService.js:843) de-dupes stage
-- keys through a Set. No approval has been mis-routed.
--
-- Why fix it anyway:
--   1. updateApprovalFlowConfig() (adminBudgetModel.js:3236) writes by a single
--      `id`. resolveFlowConfig() always reads the LOWEST id. So editing the
--      flow on id 9 or 10 saves successfully and changes nothing -- a silent
--      no-op that is very hard to debug from the UI.
--   2. Row count grows without bound on every migration re-run.
--   3. Nobody reading the table can tell which of the three rows is
--      authoritative.
--
-- Safety: only rows that are EXACT duplicates (identical `flow` AND identical
-- `is_active`) of a lower-id row are removed. A row that shares the key but
-- carries a different flow is a real configuration difference and is left
-- alone -- it will instead surface as an error in step 2, which is the correct
-- outcome: a human must decide which flow wins.
--
-- No foreign key anywhere references approval_flow_config, so deleting these
-- rows cannot cascade.

-- ============================================
-- STEP 0: Inspect before changing anything
-- ============================================
-- Run this first and read the output. Expect 3 finance rows, all with
-- flow = ["level1", "dof", "principal"].
SELECT
  COALESCE(entity_type_code, '(null)') AS entity_type_code,
  beneficiary_type,
  module_key,
  COUNT(*)                       AS row_count,
  COUNT(DISTINCT CAST(flow AS CHAR)) AS distinct_flows,
  GROUP_CONCAT(id ORDER BY id)   AS ids
FROM approval_flow_config
GROUP BY beneficiary_type, module_key, COALESCE(entity_type_code, '(null)')
HAVING COUNT(*) > 1;

-- ============================================
-- STEP 1: Delete exact duplicates, keeping the lowest id
-- ============================================
-- The lowest id is kept deliberately: it is the row resolveFlowConfig() has
-- been reading all along, so keeping it makes this migration a no-op for
-- runtime behaviour.
DELETE afc
FROM `approval_flow_config` afc
JOIN `approval_flow_config` keeper
  ON  keeper.`beneficiary_type` = afc.`beneficiary_type`
  AND keeper.`module_key`       = afc.`module_key`
  AND COALESCE(keeper.`entity_type_code`, '__NULL__')
      = COALESCE(afc.`entity_type_code`, '__NULL__')
  AND keeper.`id` < afc.`id`
WHERE keeper.`flow` = afc.`flow`
  AND keeper.`is_active` = afc.`is_active`;

-- ============================================
-- STEP 2: Make the constraint NULL-safe
-- ============================================
-- A UNIQUE index cannot be made to treat NULLs as equal, so index a generated
-- column that folds NULL onto a sentinel instead. '__NULL__' cannot collide
-- with a real code: master_entity_types uses CENTRE, CELL, CLUB,
-- PROFESSIONAL_BODY, INSTITUTION, SECTION.
--
-- After this, plain `INSERT ... ON DUPLICATE KEY UPDATE` works correctly for
-- NULL-entity-type rows and the workaround in
-- 20260804_create_workorder_module.sql / the guesthouse migration
-- (UPDATE-then-INSERT-if-absent) becomes belt-and-braces rather than required.
--
-- If this ALTER fails with ERROR 1062, STEP 1 left a same-key row with a
-- DIFFERENT flow. That is intentional -- inspect with STEP 0 and decide which
-- flow is correct before re-running.
ALTER TABLE `approval_flow_config`
  ADD COLUMN `entity_type_code_key` VARCHAR(50)
    GENERATED ALWAYS AS (COALESCE(`entity_type_code`, '__NULL__')) STORED
    COMMENT 'NULL-safe mirror of entity_type_code; exists only to back uq_approval_flow_nullsafe',
  ADD UNIQUE KEY `uq_approval_flow_nullsafe`
    (`beneficiary_type`, `entity_type_code_key`, `module_key`);

-- NOTE: the original `uq_approval_flow` is deliberately LEFT IN PLACE. It is
-- redundant for NULL rows but still the key that existing migrations rely on
-- for non-NULL entity_type_code rows (ids 3-6, CENTRE/CELL/CLUB/
-- PROFESSIONAL_BODY) via ON DUPLICATE KEY UPDATE. Dropping it would break
-- those.

-- ============================================
-- STEP 3: Verify
-- ============================================
-- Expect zero rows returned.
SELECT
  beneficiary_type, module_key,
  COALESCE(entity_type_code, '(null)') AS entity_type_code,
  COUNT(*) AS row_count
FROM approval_flow_config
GROUP BY beneficiary_type, module_key, COALESCE(entity_type_code, '(null)')
HAVING COUNT(*) > 1;

-- ============================================
-- ROLLBACK (keep commented)
-- ============================================
-- The deleted rows were exact duplicates of rows that remain, so there is
-- nothing to restore. To undo only the constraint change:
-- ALTER TABLE `approval_flow_config`
--   DROP INDEX `uq_approval_flow_nullsafe`,
--   DROP COLUMN `entity_type_code_key`;
