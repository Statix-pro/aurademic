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
  `sort_order` int NOT NULL DEFAULT '0',
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
  'INSERT INTO `project_vocabulary_options` (`list_key`, `project_type`, `name`, `sort_order`) VALUES
     (\'national_initiative\', \'\', \'Atmanirbhar Bharat\', 1),
     (\'national_initiative\', \'\', \'Atal Innovation Mission\', 2),
     (\'national_initiative\', \'\', \'Digital India\', 3),
     (\'national_initiative\', \'\', \'Green Hydrogen Mission\', 4),
     (\'national_initiative\', \'\', \'Jal Jeevan Mission\', 5),
     (\'national_initiative\', \'\', \'Make in India\', 6),
     (\'national_initiative\', \'\', \'National Education Policy 2020\', 7),
     (\'national_initiative\', \'\', \'National Mission on Quantum Technologies\', 8),
     (\'national_initiative\', \'\', \'National Quantum Mission\', 9),
     (\'national_initiative\', \'\', \'National Solar Mission\', 10),
     (\'national_initiative\', \'\', \'Skill India\', 11),
     (\'national_initiative\', \'\', \'Smart Cities Mission\', 12),
     (\'national_initiative\', \'\', \'Startup India\', 13),
     (\'national_initiative\', \'\', \'Svamitva\', 14),
     (\'national_initiative\', \'\', \'Swachh Bharat Mission\', 15),
     (\'national_initiative\', \'\', \'Unnat Bharat Abhiyan\', 16),
     (\'national_initiative\', \'\', \'Vocal for Local\', 17),
     (\'domain\', \'\', \'Innovation\', 1),
     (\'domain\', \'\', \'Start-up & Entrepreneurship\', 2),
     (\'domain\', \'\', \'Societal Development\', 3),
     (\'domain\', \'\', \'Engineering and Technology\', 4),
     (\'domain\', \'\', \'Science and Technology\', 5),
     (\'domain\', \'\', \'Agriculture and Biotechnology\', 6),
     (\'domain\', \'\', \'Health, Food and Nutrition\', 7),
     (\'domain\', \'\', \'Medicine\', 8),
     (\'domain\', \'\', \'Life Sciences\', 9),
     (\'domain\', \'\', \'Nano Science\', 10),
     (\'domain\', \'\', \'Materials\', 11),
     (\'domain\', \'\', \'Manufacturing\', 12),
     (\'domain\', \'\', \'Electronics\', 13),
     (\'domain\', \'\', \'Textile\', 14),
     (\'domain\', \'\', \'Civil & Infrastructure\', 15),
     (\'domain\', \'\', \'Energy\', 16),
     (\'domain\', \'\', \'Futuristic Technology\', 17),
     (\'domain\', \'\', \'Science, Technology, Engineering and Mathematics (STEM)\', 18),
     (\'domain\', \'\', \'Artificial Intelligence\', 19),
     (\'domain\', \'\', \'Computing Science\', 20),
     (\'domain\', \'\', \'Multidisciplinary\', 21),
     (\'domain\', \'\', \'Environment and Climate\', 22),
     (\'domain\', \'\', \'Social Science\', 23),
     (\'domain\', \'\', \'Traditional Knowledge\', 24),
     (\'domain\', \'\', \'Mathematics\', 25),
     (\'category\', \'research_project\', \'Research Project\', 1),
     (\'category\', \'research_project\', \'Product Development\', 2),
     (\'category\', \'research_project\', \'Community Outreach\', 3),
     (\'category\', \'research_project\', \'Survey\', 4),
     (\'category\', \'research_project\', \'Infrastructure\', 5),
     (\'category\', \'research_project\', \'Incubation/Start-up\', 6),
     (\'category\', \'research_project\', \'Collaborative Research\', 7),
     (\'category\', \'research_project\', \'Industrial R&D\', 8),
     (\'category\', \'research_project\', \'Facilities Access\', 9),
     (\'category\', \'research_project\', \'Centre of Excellence\', 10),
     (\'category\', \'event\', \'Seminar\', 1),
     (\'category\', \'event\', \'Workshop\', 2),
     (\'category\', \'event\', \'Conference\', 3),
     (\'category\', \'event\', \'Faculty Development Programme\', 4),
     (\'category\', \'event\', \'Entrepreneurship Development Programme\', 5),
     (\'category\', \'event\', \'Campaign\', 6),
     (\'category\', \'event\', \'Science Day\', 7),
     (\'category\', \'event\', \'Earth Day\', 8),
     (\'category\', \'event\', \'Competition\', 9),
     (\'category\', \'event\', \'Dissemination of Innovative Technology\', 10),
     (\'category\', \'event\', \'Bilateral Workshop\', 11),
     (\'category\', \'event\', \'Bilateral Conference\', 12),
     (\'category\', \'travel_grant\', \'Conference Travel Grant\', 1),
     (\'category\', \'travel_grant\', \'Research Travel Grant\', 2),
     (\'category\', \'fellowship\', \'Post Doctoral Fellowship\', 1),
     (\'category\', \'fellowship\', \'Doctoral Fellowship\', 2),
     (\'category\', \'fellowship\', \'Summer Research Fellowship\', 3),
     (\'category\', \'fellowship\', \'Women Scientist\', 4),
     (\'category\', \'fellowship\', \'Research Scholar Fellowship\', 5)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented — dropping the table takes the curated lists
-- with it; the values stored on projects and schemes are unaffected
-- either way, since they are stored by name)
-- ==================================================================
-- DROP TABLE IF EXISTS `project_vocabulary_options`;
