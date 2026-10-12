-- ==================================================================
-- Migration: Curate the project budget head vocabulary in the admin
-- Author: Maheshwaran A K
-- Date: 2026-09-17
-- ==================================================================
--
-- Description:
-- 20260908_project_budget_heads_by_name.sql moved projects off the
-- institution-wide `budget_heads` catalog and onto a code-side list
-- stored by name — the heads a funding agency recognises are not the
-- heads the college budgets its own spending under, and `Consumables`
-- has to be reachable from both project groups at once, which
-- `budget_heads.name UNIQUE` can never allow.
--
-- Keeping that list in code meant a new head needed a release. This
-- table is the same vocabulary, curated by an administrator instead:
-- names only, no id anywhere else in the schema, because
-- `project_budget_heads`, `project_finance_row_heads` and
-- `project_transactions` all store the head by name and stay that way.
-- Nothing here touches an existing row, so a project budgeted under a
-- head that is later renamed or retired keeps the name it was
-- sanctioned under.
--
-- The unique key is (head_group, name) rather than (name): `Consumables`
-- is offered under both groups and is one head either way, exactly as
-- the constants it replaces had it.

-- ── 1. The table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `project_budget_head_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'Head name — what every project table stores',
  `head_group` varchar(150) NOT NULL DEFAULT 'Research Projects' COMMENT 'Vocabulary the head is offered under',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_budget_head_options` (`head_group`,`name`),
  KEY `idx_project_budget_head_options_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 2. Seed it with the vocabulary that was in code ─────────────────
-- Guarded on the table being empty rather than written as INSERT IGNORE:
-- a second run of this migration must not resurrect a head an
-- administrator has since deleted.

SET @seeded = (SELECT COUNT(*) FROM `project_budget_head_options`);
SET @sql = IF(@seeded = 0,
  'INSERT INTO `project_budget_head_options` (`name`, `head_group`, `sort_order`) VALUES
     (\'Equipment\', \'Research Projects\', 1),
     (\'Consumables\', \'Research Projects\', 2),
     (\'Manpower\', \'Research Projects\', 3),
     (\'Contingencies\', \'Research Projects\', 4),
     (\'Overhead Charges\', \'Research Projects\', 5),
     (\'Travel\', \'Research Projects\', 6),
     (\'Field Work\', \'Research Projects\', 7),
     (\'Other Costs\', \'Research Projects\', 8),
     (\'Honorarium\', \'Sponsored Events\', 1),
     (\'Consumables\', \'Sponsored Events\', 2),
     (\'Travel Allowance\', \'Sponsored Events\', 3),
     (\'Food & Refreshment\', \'Sponsored Events\', 4),
     (\'Registration Kit\', \'Sponsored Events\', 5),
     (\'Printing\', \'Sponsored Events\', 6),
     (\'Stationery\', \'Sponsored Events\', 7),
     (\'Administrative Expenses\', \'Sponsored Events\', 8),
     (\'Boarding Expenses\', \'Sponsored Events\', 9),
     (\'Lodging Expenses\', \'Sponsored Events\', 10)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented — dropping the table takes the curated
-- vocabulary with it; the heads stored on projects are unaffected
-- either way, since they are stored by name)
-- ==================================================================
-- DROP TABLE IF EXISTS `project_budget_head_options`;
