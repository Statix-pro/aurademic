-- ============================================
-- Migration: Catalog FK refs + code slug
-- Author: Maheshwaran
-- Date: 2026-05-21
-- ============================================
-- Adds stable catalog references to every table that currently stores
-- budget head / sub-head as free text, plus an optional `code` slug on the
-- catalog tables themselves.
--
-- Strategy:
--   * Existing text columns (`budget_head`, `sub_head`, `primary_head`,
--     `event_sub_head`) are kept as snapshots.
--   * New `*_id` columns are NULLABLE and have NO foreign key constraint
--     yet — Phase 3 backfills, Phase 4 starts preferring IDs in matching,
--     and FKs may be added later once every row is hydrated.
-- ============================================

-- MySQL DDL auto-commits, so make each schema change individually guarded.
-- This lets the migration be re-run after a partial deploy without failing
-- on "duplicate column" / "duplicate key" errors.

-- ----- Catalog tables: stable slug -----
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND COLUMN_NAME = 'code'), 'SELECT 1', 'ALTER TABLE `budget_heads` ADD COLUMN `code` VARCHAR(64) NULL AFTER `name`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_heads' AND INDEX_NAME = 'uniq_budget_heads_code'), 'SELECT 1', 'ALTER TABLE `budget_heads` ADD UNIQUE KEY `uniq_budget_heads_code` (`code`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND COLUMN_NAME = 'code'), 'SELECT 1', 'ALTER TABLE `budget_sub_heads` ADD COLUMN `code` VARCHAR(64) NULL AFTER `name`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_sub_heads' AND INDEX_NAME = 'idx_budget_sub_heads_code'), 'SELECT 1', 'ALTER TABLE `budget_sub_heads` ADD INDEX `idx_budget_sub_heads_code` (`code`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----- Budget proposal lines -----
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND COLUMN_NAME = 'budget_head_id'), 'SELECT 1', 'ALTER TABLE `budget_proposal_lines` ADD COLUMN `budget_head_id` INT NULL AFTER `sub_head`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND COLUMN_NAME = 'budget_sub_head_id'), 'SELECT 1', 'ALTER TABLE `budget_proposal_lines` ADD COLUMN `budget_sub_head_id` INT NULL AFTER `budget_head_id`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND INDEX_NAME = 'idx_bpl_head_id'), 'SELECT 1', 'ALTER TABLE `budget_proposal_lines` ADD INDEX `idx_bpl_head_id` (`budget_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'budget_proposal_lines' AND INDEX_NAME = 'idx_bpl_subhead_id'), 'SELECT 1', 'ALTER TABLE `budget_proposal_lines` ADD INDEX `idx_bpl_subhead_id` (`budget_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----- Finance: header + breakup -----
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND COLUMN_NAME = 'primary_head_id'), 'SELECT 1', 'ALTER TABLE `finance_requests` ADD COLUMN `primary_head_id` INT NULL AFTER `primary_head`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND COLUMN_NAME = 'event_sub_head_id'), 'SELECT 1', 'ALTER TABLE `finance_requests` ADD COLUMN `event_sub_head_id` INT NULL AFTER `event_sub_head`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND INDEX_NAME = 'idx_fr_primary_head_id'), 'SELECT 1', 'ALTER TABLE `finance_requests` ADD INDEX `idx_fr_primary_head_id` (`primary_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_requests' AND INDEX_NAME = 'idx_fr_event_sub_head_id'), 'SELECT 1', 'ALTER TABLE `finance_requests` ADD INDEX `idx_fr_event_sub_head_id` (`event_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND COLUMN_NAME = 'budget_head_id'), 'SELECT 1', 'ALTER TABLE `finance_budget_breakup` ADD COLUMN `budget_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND COLUMN_NAME = 'budget_sub_head_id'), 'SELECT 1', 'ALTER TABLE `finance_budget_breakup` ADD COLUMN `budget_sub_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND INDEX_NAME = 'idx_fbb_head_id'), 'SELECT 1', 'ALTER TABLE `finance_budget_breakup` ADD INDEX `idx_fbb_head_id` (`budget_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'finance_budget_breakup' AND INDEX_NAME = 'idx_fbb_subhead_id'), 'SELECT 1', 'ALTER TABLE `finance_budget_breakup` ADD INDEX `idx_fbb_subhead_id` (`budget_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----- Expenditure: header + row tables -----
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND COLUMN_NAME = 'primary_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_requests` ADD COLUMN `primary_head_id` INT NULL AFTER `primary_head`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND COLUMN_NAME = 'event_sub_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_requests` ADD COLUMN `event_sub_head_id` INT NULL AFTER `event_sub_head`');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND INDEX_NAME = 'idx_er_primary_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_requests` ADD INDEX `idx_er_primary_head_id` (`primary_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_requests' AND INDEX_NAME = 'idx_er_event_sub_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_requests` ADD INDEX `idx_er_event_sub_head_id` (`event_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND COLUMN_NAME = 'budget_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_advance_rows` ADD COLUMN `budget_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_advance_rows` ADD COLUMN `budget_sub_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND INDEX_NAME = 'idx_ear_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_advance_rows` ADD INDEX `idx_ear_head_id` (`budget_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_advance_rows' AND INDEX_NAME = 'idx_ear_subhead_id'), 'SELECT 1', 'ALTER TABLE `expenditure_advance_rows` ADD INDEX `idx_ear_subhead_id` (`budget_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND COLUMN_NAME = 'budget_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_settlement_rows` ADD COLUMN `budget_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_settlement_rows` ADD COLUMN `budget_sub_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND INDEX_NAME = 'idx_esr_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_settlement_rows` ADD INDEX `idx_esr_head_id` (`budget_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_settlement_rows' AND INDEX_NAME = 'idx_esr_subhead_id'), 'SELECT 1', 'ALTER TABLE `expenditure_settlement_rows` ADD INDEX `idx_esr_subhead_id` (`budget_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND COLUMN_NAME = 'budget_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_line_rows` ADD COLUMN `budget_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND COLUMN_NAME = 'budget_sub_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_line_rows` ADD COLUMN `budget_sub_head_id` INT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND INDEX_NAME = 'idx_elr_head_id'), 'SELECT 1', 'ALTER TABLE `expenditure_line_rows` ADD INDEX `idx_elr_head_id` (`budget_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenditure_line_rows' AND INDEX_NAME = 'idx_elr_subhead_id'), 'SELECT 1', 'ALTER TABLE `expenditure_line_rows` ADD INDEX `idx_elr_subhead_id` (`budget_sub_head_id`)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- BACKFILL (Phase 3)
-- Populate IDs from existing snapshot text. Safe to re-run.
-- DML is wrapped in a transaction so partial backfill failures roll back.
-- ============================================
START TRANSACTION;

-- Catalog code slugs: derive from name.
UPDATE `budget_heads`
SET `code` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(`name`,' ','-'),'&','and'),'/','-'),',',''))
WHERE `code` IS NULL;

UPDATE `budget_sub_heads`
SET `code` = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(`name`,' ','-'),'&','and'),'/','-'),',',''))
WHERE `code` IS NULL;

-- budget_proposal_lines
UPDATE `budget_proposal_lines` bpl
JOIN `budget_heads` h ON h.name = bpl.budget_head COLLATE utf8mb4_unicode_ci
SET bpl.budget_head_id = h.id
WHERE bpl.budget_head_id IS NULL;

UPDATE `budget_proposal_lines` bpl
JOIN `budget_sub_heads` s
  ON s.name = bpl.sub_head COLLATE utf8mb4_unicode_ci
 AND s.head_id = bpl.budget_head_id
 AND s.scope = 'head-specific'
SET bpl.budget_sub_head_id = s.id
WHERE bpl.budget_sub_head_id IS NULL AND bpl.budget_head_id IS NOT NULL;

-- finance_requests
UPDATE `finance_requests` fr
JOIN `budget_heads` h ON h.name = fr.primary_head
SET fr.primary_head_id = h.id
WHERE fr.primary_head_id IS NULL;

UPDATE `finance_requests` fr
JOIN `budget_sub_heads` s
  ON s.name = fr.event_sub_head
 AND s.scope = 'hoac-shared'
 AND s.event_type = CASE
      WHEN fr.primary_head IN ('Events & Competitions', 'Meetings & Audits') THEN fr.primary_head
      ELSE (
        SELECT h.group_label
        FROM `budget_heads` h
        WHERE h.name = fr.primary_head
          AND h.group_label IN ('Events & Competitions', 'Meetings & Audits')
        LIMIT 1
      )
    END
SET fr.event_sub_head_id = s.id
WHERE fr.event_sub_head_id IS NULL
  AND NULLIF(TRIM(fr.event_sub_head), '') IS NOT NULL;

-- finance_budget_breakup
UPDATE `finance_budget_breakup` fbb
JOIN `budget_heads` h ON h.name = fbb.budget_head
SET fbb.budget_head_id = h.id
WHERE fbb.budget_head_id IS NULL;

UPDATE `finance_budget_breakup` fbb
JOIN `budget_sub_heads` s
  ON s.name = fbb.sub_head
 AND s.head_id = fbb.budget_head_id
 AND s.scope = 'head-specific'
SET fbb.budget_sub_head_id = s.id
WHERE fbb.budget_sub_head_id IS NULL AND fbb.budget_head_id IS NOT NULL;

-- expenditure_requests
UPDATE `expenditure_requests` er
JOIN `budget_heads` h ON h.name = er.primary_head
SET er.primary_head_id = h.id
WHERE er.primary_head_id IS NULL;

UPDATE `expenditure_requests` er
JOIN `budget_sub_heads` s
  ON s.name = er.event_sub_head
 AND s.scope = 'hoac-shared'
 AND s.event_type = CASE
      WHEN er.primary_head IN ('Events & Competitions', 'Meetings & Audits') THEN er.primary_head
      ELSE (
        SELECT h.group_label
        FROM `budget_heads` h
        WHERE h.name = er.primary_head
          AND h.group_label IN ('Events & Competitions', 'Meetings & Audits')
        LIMIT 1
      )
    END
SET er.event_sub_head_id = s.id
WHERE er.event_sub_head_id IS NULL
  AND NULLIF(TRIM(er.event_sub_head), '') IS NOT NULL;

-- expenditure_advance_rows
UPDATE `expenditure_advance_rows` ear
JOIN `budget_heads` h ON h.name = ear.budget_head
SET ear.budget_head_id = h.id
WHERE ear.budget_head_id IS NULL;

UPDATE `expenditure_advance_rows` ear
JOIN `budget_sub_heads` s
  ON s.name = ear.sub_head
 AND s.head_id = ear.budget_head_id
 AND s.scope = 'head-specific'
SET ear.budget_sub_head_id = s.id
WHERE ear.budget_sub_head_id IS NULL AND ear.budget_head_id IS NOT NULL;

-- expenditure_settlement_rows
UPDATE `expenditure_settlement_rows` esr
JOIN `budget_heads` h ON h.name = esr.budget_head
SET esr.budget_head_id = h.id
WHERE esr.budget_head_id IS NULL;

UPDATE `expenditure_settlement_rows` esr
JOIN `budget_sub_heads` s
  ON s.name = esr.sub_head
 AND s.head_id = esr.budget_head_id
 AND s.scope = 'head-specific'
SET esr.budget_sub_head_id = s.id
WHERE esr.budget_sub_head_id IS NULL AND esr.budget_head_id IS NOT NULL;

-- expenditure_line_rows
UPDATE `expenditure_line_rows` elr
JOIN `budget_heads` h ON h.name = elr.budget_head
SET elr.budget_head_id = h.id
WHERE elr.budget_head_id IS NULL;

UPDATE `expenditure_line_rows` elr
JOIN `budget_sub_heads` s
  ON s.name = elr.sub_head
 AND s.head_id = elr.budget_head_id
 AND s.scope = 'head-specific'
SET elr.budget_sub_head_id = s.id
WHERE elr.budget_sub_head_id IS NULL AND elr.budget_head_id IS NOT NULL;

COMMIT;

-- ============================================
-- ROLLBACK
-- ============================================
-- ALTER TABLE budget_heads DROP COLUMN code;
-- ALTER TABLE budget_sub_heads DROP COLUMN code;
-- ALTER TABLE budget_proposal_lines DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
-- ALTER TABLE finance_requests DROP COLUMN primary_head_id, DROP COLUMN event_sub_head_id;
-- ALTER TABLE finance_budget_breakup DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
-- ALTER TABLE expenditure_requests DROP COLUMN primary_head_id, DROP COLUMN event_sub_head_id;
-- ALTER TABLE expenditure_advance_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
-- ALTER TABLE expenditure_settlement_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
-- ALTER TABLE expenditure_line_rows DROP COLUMN budget_head_id, DROP COLUMN budget_sub_head_id;
