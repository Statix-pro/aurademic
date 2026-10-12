-- ============================================
-- Migration: Project budget, income-head and ledger fields
-- Author: Maheshwaran A K
-- Date: 2026-09-23
-- ============================================

-- Description:
-- One migration for the project-form changes that ship together, so production
-- takes a single file. Five changes, each a nullable column or a new table:
--
--   1. project_budget_heads.contribution_organization_*
--        Who contributes each budget head — the Contribution column on the
--        Budget Allotment matrix.
--   2. project_transactions.payment_mode
--        How a ledger entry was paid: NEFT, RTGS, DD, Cheque, UPI, Cash, PFMS.
--   3. project_transactions.contribution_organization_*
--        Who an income entry came from. Shown in place of Ref. No. on an income
--        row; stored on every row, so switching a head's kind hides a value
--        rather than destroying it.
--   4. project_income_heads (new table)
--        Which income heads apply to the project — the Income Heads card.
--   5. project_finance_rows.covers_all_heads
--        "All Budget Heads" on a Financial Contribution / Budget Sharing row.
--        A flag rather than a head name, so it can never collide with a head an
--        administrator adds to the vocabulary.
--
-- SAFE TO RE-RUN. MySQL commits every ALTER on its own, so this file cannot be
-- one transaction — if it stops partway, what ran stays applied. Each step is
-- therefore guarded on the column or table it creates (the pattern
-- 20260908_project_budget_heads_by_name.sql uses): a second run skips what is
-- already in place and finishes the rest. Each guarded ALTER is a single
-- statement, and MySQL applies a single ALTER whole or not at all, so a step is
-- never left half-done.
--
-- ORDER MATTERS in one place: step 3 adds its columns AFTER `payment_mode`, so
-- step 2 has to run first. They are in that order below.
--
-- NO DATA IS REWRITTEN. Every new column is nullable or defaults to the value
-- that means "as before", and the new table starts empty:
--   - budget heads and ledger rows start unattributed (NULL contributor);
--   - ledger rows start with no stated payment mode (NULL);
--   - finance rows keep covering exactly the heads they list (covers_all_heads 0);
--   - projects start with no income heads ticked.
-- No balance, allotment, Actuals figure or summary total moves.
--
-- Also shipping with this, but in code rather than here: the income-head
-- vocabulary (PROJECT_INCOME_HEADS in projectPayload.js) is now Grant-in-aid,
-- Bank Interest, HI Contribution, Other Income. The server rejects an income
-- ledger row outside that list, so before running this on a database that holds
-- income rows under the old names (Deposit, Interest, Grant Received), check:
--
--   SELECT head_name, COUNT(*) FROM project_transactions
--    WHERE head_kind = 'income'
--      AND head_name NOT IN ('Grant-in-aid','Bank Interest','HI Contribution','Other Income')
--    GROUP BY head_name;
--
-- Any rows it returns would make their project unsaveable until re-filed.

SET @db_name = DATABASE();

-- ── 1. Budget heads: who contributes each head ──────────────────────────
-- ON DELETE SET NULL: removing an organization from the master list empties the
-- cell rather than taking the budget row, and its allotments, down with it.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND COLUMN_NAME = 'contribution_organization_id');
SET @sql = IF(@col = 0,
  'ALTER TABLE `project_budget_heads`
     ADD COLUMN `contribution_organization_id` int DEFAULT NULL
       COMMENT ''FK to project_organizations; the party contributing this head''
       AFTER `budget_head_name`,
     ADD COLUMN `contribution_organization_name` varchar(255) DEFAULT NULL
       COMMENT ''Snapshot of the organization name at save time''
       AFTER `contribution_organization_id`,
     ADD KEY `idx_project_budget_heads_contribution` (`contribution_organization_id`),
     ADD CONSTRAINT `fk_project_budget_heads_contribution`
       FOREIGN KEY (`contribution_organization_id`) REFERENCES `project_organizations` (`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. Ledger: how each entry was paid ──────────────────────────────────
-- An ENUM, the way research_projects.sanction_mode is: the list is fixed and
-- `toEnum()` validates against the same seven values before the insert.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND COLUMN_NAME = 'payment_mode');
SET @sql = IF(@col = 0,
  'ALTER TABLE `project_transactions`
     ADD COLUMN `payment_mode`
       enum(''neft'',''rtgs'',''dd'',''cheque'',''upi'',''cash'',''pfms'') DEFAULT NULL
       COMMENT ''How the money moved; NULL where the entry does not say''
       AFTER `reference_no`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. Ledger: who an income entry came from ────────────────────────────
-- After step 2 — these columns are placed AFTER `payment_mode`.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND COLUMN_NAME = 'contribution_organization_id');
SET @sql = IF(@col = 0,
  'ALTER TABLE `project_transactions`
     ADD COLUMN `contribution_organization_id` int DEFAULT NULL
       COMMENT ''FK to project_organizations; who an income entry came from''
       AFTER `payment_mode`,
     ADD COLUMN `contribution_organization_name` varchar(255) DEFAULT NULL
       COMMENT ''Snapshot of the organization name at save time''
       AFTER `contribution_organization_id`,
     ADD KEY `idx_project_transactions_contribution` (`contribution_organization_id`),
     ADD CONSTRAINT `fk_project_transactions_contribution`
       FOREIGN KEY (`contribution_organization_id`) REFERENCES `project_organizations` (`id`)
       ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 4. Income heads a project declares as applicable ────────────────────
-- Stored by name, replaced wholesale on save, like project_budget_heads. The
-- vocabulary stays in code; nothing is backfilled.

CREATE TABLE IF NOT EXISTS `project_income_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `income_head_name` varchar(255) NOT NULL COMMENT 'One of PROJECT_INCOME_HEADS, stored by name',
  `display_order` int NOT NULL DEFAULT '0' COMMENT 'Top-to-bottom order in the card',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_income_heads_name` (`project_id`, `income_head_name`),
  KEY `idx_project_income_heads_project` (`project_id`, `display_order`),
  CONSTRAINT `fk_project_income_heads_project`
    FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Finance rows: "All Budget Heads" ─────────────────────────────────
-- A row with the flag set carries no head rows; normalizeFinanceRows() drops
-- any sent alongside it.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_rows'
               AND COLUMN_NAME = 'covers_all_heads');
SET @sql = IF(@col = 0,
  'ALTER TABLE `project_finance_rows`
     ADD COLUMN `covers_all_heads` tinyint(1) NOT NULL DEFAULT ''0''
       COMMENT ''1 = the row covers every budget head; its head rows are then empty''
       AFTER `amount`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- Reverse order. Step 3 before step 2, since its columns sit after payment_mode.
-- Dropping these discards whatever was entered into them since.
-- ============================================
-- ALTER TABLE `project_finance_rows` DROP COLUMN `covers_all_heads`;
-- DROP TABLE IF EXISTS `project_income_heads`;
-- ALTER TABLE `project_transactions`
--   DROP FOREIGN KEY `fk_project_transactions_contribution`,
--   DROP INDEX `idx_project_transactions_contribution`,
--   DROP COLUMN `contribution_organization_name`,
--   DROP COLUMN `contribution_organization_id`;
-- ALTER TABLE `project_transactions` DROP COLUMN `payment_mode`;
-- ALTER TABLE `project_budget_heads`
--   DROP FOREIGN KEY `fk_project_budget_heads_contribution`,
--   DROP INDEX `idx_project_budget_heads_contribution`,
--   DROP COLUMN `contribution_organization_name`,
--   DROP COLUMN `contribution_organization_id`;
