-- ==================================================================
-- Migration: Curate the project form's National Initiatives, Domains
--            and Categories in the admin
-- Author: Maheshwaran A K
-- Date: 2026-10-14
-- ==================================================================
--
-- Description:
-- Three lists the project form offers were fixed in code, so a new entry
-- needed a release:
--
--   national_initiative  Proposal Details' National Initiatives.
--   domain               A project's domain (Call for Details) and a
--                        scheme's (Form Management).
--   category             A scheme's category, one list per project type
--                        (Form Management and Add Scheme).
--
-- This table holds all three, curated on Form Management the way
-- `project_budget_head_options` holds budget heads. Like those heads, a
-- value is stored by name wherever it is used — `project_tags.tag_value`,
-- `research_projects.domain`, `project_schemes.domain` and `.category` —
-- and nothing here references a row by id. Renaming or retiring an entry
-- changes only what the form offers next; a project or scheme that already
-- holds the old name keeps it.
--
--   list_key      Which list the entry belongs to.
--   project_type  The project type a category is offered for; '' for the
--                 two lists that are not split by type. NOT NULL with ''
--                 rather than NULL so the unique key holds for them too —
--                 MySQL treats NULLs as distinct in a unique index.
--
-- Entries are offered in alphabetical order, so the table keeps no sort
-- order of its own.
--
-- Seeded with the lists exactly as they stood in code
-- (`modules/shared/schemeVocabulary.js` and the client's `constants.ts`).
-- No existing row is touched.

-- ── 1. The table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `project_vocabulary_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `list_key` enum('national_initiative','domain','category') NOT NULL COMMENT 'Which list the entry belongs to',
  `project_type` varchar(32) NOT NULL DEFAULT '' COMMENT 'Project type a category is offered for; empty for untyped lists',
  `name` varchar(255) NOT NULL COMMENT 'The label — what every project table stores',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_vocabulary_options` (`list_key`,`project_type`,`name`),
  KEY `idx_project_vocabulary_options_active` (`list_key`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── 2. Seed it with the lists that were in code ─────────────────────
-- Guarded on the table being empty rather than written as INSERT IGNORE:
-- a second run must not resurrect an entry an administrator has since
-- deleted.

SET @seeded = (SELECT COUNT(*) FROM `project_vocabulary_options`);
SET @sql = IF(@seeded = 0,
  'INSERT INTO `project_vocabulary_options` (`list_key`, `project_type`, `name`) VALUES
     (\'national_initiative\', \'\', \'Atmanirbhar Bharat\'),
     (\'national_initiative\', \'\', \'Atal Innovation Mission\'),
     (\'national_initiative\', \'\', \'Digital India\'),
     (\'national_initiative\', \'\', \'Green Hydrogen Mission\'),
     (\'national_initiative\', \'\', \'Jal Jeevan Mission\'),
     (\'national_initiative\', \'\', \'Make in India\'),
     (\'national_initiative\', \'\', \'National Education Policy 2020\'),
     (\'national_initiative\', \'\', \'National Mission on Quantum Technologies\'),
     (\'national_initiative\', \'\', \'National Quantum Mission\'),
     (\'national_initiative\', \'\', \'National Solar Mission\'),
     (\'national_initiative\', \'\', \'Skill India\'),
     (\'national_initiative\', \'\', \'Smart Cities Mission\'),
     (\'national_initiative\', \'\', \'Startup India\'),
     (\'national_initiative\', \'\', \'Svamitva\'),
     (\'national_initiative\', \'\', \'Swachh Bharat Mission\'),
     (\'national_initiative\', \'\', \'Unnat Bharat Abhiyan\'),
     (\'national_initiative\', \'\', \'Vocal for Local\'),
     (\'domain\', \'\', \'Innovation\'),
     (\'domain\', \'\', \'Start-up & Entrepreneurship\'),
     (\'domain\', \'\', \'Societal Development\'),
     (\'domain\', \'\', \'Engineering and Technology\'),
     (\'domain\', \'\', \'Science and Technology\'),
     (\'domain\', \'\', \'Agriculture and Biotechnology\'),
     (\'domain\', \'\', \'Health, Food and Nutrition\'),
     (\'domain\', \'\', \'Medicine\'),
     (\'domain\', \'\', \'Life Sciences\'),
     (\'domain\', \'\', \'Nano Science\'),
     (\'domain\', \'\', \'Materials\'),
     (\'domain\', \'\', \'Manufacturing\'),
     (\'domain\', \'\', \'Electronics\'),
     (\'domain\', \'\', \'Textile\'),
     (\'domain\', \'\', \'Civil & Infrastructure\'),
     (\'domain\', \'\', \'Energy\'),
     (\'domain\', \'\', \'Futuristic Technology\'),
     (\'domain\', \'\', \'Science, Technology, Engineering and Mathematics (STEM)\'),
     (\'domain\', \'\', \'Artificial Intelligence\'),
     (\'domain\', \'\', \'Computing Science\'),
     (\'domain\', \'\', \'Multidisciplinary\'),
     (\'domain\', \'\', \'Environment and Climate\'),
     (\'domain\', \'\', \'Social Science\'),
     (\'domain\', \'\', \'Traditional Knowledge\'),
     (\'domain\', \'\', \'Mathematics\'),
     (\'category\', \'research_project\', \'Research Project\'),
     (\'category\', \'research_project\', \'Product Development\'),
     (\'category\', \'research_project\', \'Community Outreach\'),
     (\'category\', \'research_project\', \'Survey\'),
     (\'category\', \'research_project\', \'Infrastructure\'),
     (\'category\', \'research_project\', \'Incubation/Start-up\'),
     (\'category\', \'research_project\', \'Collaborative Research\'),
     (\'category\', \'research_project\', \'Industrial R&D\'),
     (\'category\', \'research_project\', \'Facilities Access\'),
     (\'category\', \'research_project\', \'Centre of Excellence\'),
     (\'category\', \'event\', \'Seminar\'),
     (\'category\', \'event\', \'Workshop\'),
     (\'category\', \'event\', \'Conference\'),
     (\'category\', \'event\', \'Faculty Development Programme\'),
     (\'category\', \'event\', \'Entrepreneurship Development Programme\'),
     (\'category\', \'event\', \'Campaign\'),
     (\'category\', \'event\', \'Science Day\'),
     (\'category\', \'event\', \'Earth Day\'),
     (\'category\', \'event\', \'Competition\'),
     (\'category\', \'event\', \'Dissemination of Innovative Technology\'),
     (\'category\', \'event\', \'Bilateral Workshop\'),
     (\'category\', \'event\', \'Bilateral Conference\'),
     (\'category\', \'travel_grant\', \'Conference Travel Grant\'),
     (\'category\', \'travel_grant\', \'Research Travel Grant\'),
     (\'category\', \'fellowship\', \'Post Doctoral Fellowship\'),
     (\'category\', \'fellowship\', \'Doctoral Fellowship\'),
     (\'category\', \'fellowship\', \'Summer Research Fellowship\'),
     (\'category\', \'fellowship\', \'Women Scientist\'),
     (\'category\', \'fellowship\', \'Research Scholar Fellowship\')',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented — dropping the table takes the curated lists
-- with it; the values stored on projects and schemes are unaffected
-- either way, since they are stored by name)
-- ==================================================================
-- DROP TABLE IF EXISTS `project_vocabulary_options`;
