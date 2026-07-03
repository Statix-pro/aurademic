-- ============================================
-- Migration: Drop Anna University CFR Annexure columns from journals
-- Date: 2026-07-03
-- ============================================
--
-- Description:
-- The "Listed in Anna University CFR Annexure" field was removed from the
-- journal form (UI, server model/controller, and Swagger docs). This drops the
-- two now-unused columns from the journals table.
--
-- WARNING: This is destructive and irreversible — any existing data in these
-- columns is permanently lost. Back up the journals table before running in prod.

ALTER TABLE `journals`
  DROP COLUMN `anna_university_listed`,
  DROP COLUMN `anna_university_annexure_no`;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `journals`
--   ADD COLUMN `anna_university_listed` TINYINT(1) DEFAULT NULL
--     COMMENT 'Boolean flag indicating Anna University Annexure listing' AFTER `cite_score`,
--   ADD COLUMN `anna_university_annexure_no` VARCHAR(50) DEFAULT NULL
--     COMMENT 'Specific Annexure list number reference' AFTER `anna_university_listed`;
