-- ============================================
-- Migration: A project's own research domain
-- Author: Maheshwaran A K
-- Date: 2026-10-14
-- ============================================

-- Description:
-- Call for Details showed the domain read-only, taken from the selected
-- scheme (`project_schemes.domain`). Projects under one scheme can work in
-- different domains, so the domain is now picked per project:
--
--   research_projects.domain   The project's research domain, a label from
--                              the scheme domain list
--                              (`modules/shared/schemeVocabulary.js`).
--                              Stored as display text, like
--                              `project_schemes.domain`, so it is a VARCHAR
--                              rather than an ENUM; the server's normalizer
--                              rejects anything outside the list. NULL when
--                              not stated, and always for a Travel Grant.
--
-- `project_schemes.domain` and `project_requests.domain` stay in place.
-- Form Management still edits a scheme's domain; Add Scheme no longer asks
-- for one, so a request now stores NULL there.
--
-- Additive only, with no backfill: the project form was not in production
-- use, so no project holds a domain to carry over. No other row, balance or
-- total is touched.
--
-- Guarded, so a second run is a no-op.

SET @has_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'research_projects'
     AND column_name = 'domain'
);
SET @sql = IF(@has_column = 0,
  'ALTER TABLE `research_projects`
     ADD COLUMN `domain` varchar(255) DEFAULT NULL
       COMMENT \'Research domain, a scheme domain list label; NULL when not stated\'
     AFTER `funding_source`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `research_projects` DROP COLUMN `domain`;
