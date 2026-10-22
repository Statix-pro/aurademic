-- ==================================================================
-- Migration: Publisher master for conference papers, books and chapters
-- Author: Maheshwaran A K
-- Date: 2026-10-21
--
-- Conference, Book and Book Chapter records kept their publisher as free text
-- inside journals.publication_details, so the same house was spelt a dozen
-- ways and nothing could be counted by publisher. The publication form now
-- picks from this table instead and stores the chosen row's id beside the
-- name (publication_details.publisher_id).
--
-- A user's "Add Publisher" creates a 'pending' row the requester can use at
-- once; it reaches everyone else's picker only after an admin approves it
-- under Publication Management. Rejected rows stay so a record that already
-- points at one keeps its id.
--
-- Names are unique under the column's accent- and case-insensitive collation,
-- so 'Elsevier' and 'ELSEVIER' cannot both exist. That collation is NO PAD,
-- so the application trims names before they reach the table.
-- ==================================================================

CREATE TABLE IF NOT EXISTS `publishers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `status` enum('approved','pending','rejected') NOT NULL DEFAULT 'pending',
  `requested_by` int DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_publishers_name` (`name`),
  KEY `idx_publishers_status` (`status`),
  KEY `idx_publishers_requested_by` (`requested_by`),
  CONSTRAINT `fk_publishers_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_publishers_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------------
-- Seed from the names already in use, as approved entries.
--
-- Read-only audit — run first to review exactly what will be inserted:
--
--   SELECT name, COUNT(*) AS uses FROM (
--     SELECT TRIM(publisher) AS name FROM journal_options
--      WHERE publisher IS NOT NULL AND TRIM(publisher) <> ''
--     UNION ALL
--     SELECT TRIM(JSON_UNQUOTE(JSON_EXTRACT(publication_details, '$.publisher')))
--       FROM journals
--      WHERE JSON_TYPE(JSON_EXTRACT(publication_details, '$.publisher')) = 'STRING'
--        AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(publication_details, '$.publisher'))) <> ''
--   ) used GROUP BY name ORDER BY name;
--
-- Insert-only into the new table; no existing row is changed. INSERT IGNORE
-- folds names that differ only in case or accents into the first one seen
-- and makes a re-run a no-op.
-- ------------------------------------------------------------------
INSERT IGNORE INTO `publishers` (`name`, `status`)
SELECT DISTINCT LEFT(used.name, 255), 'approved'
  FROM (
    SELECT TRIM(publisher) AS name FROM journal_options
     WHERE publisher IS NOT NULL AND TRIM(publisher) <> ''
    UNION
    SELECT TRIM(JSON_UNQUOTE(JSON_EXTRACT(publication_details, '$.publisher')))
      FROM journals
     WHERE JSON_TYPE(JSON_EXTRACT(publication_details, '$.publisher')) = 'STRING'
       AND TRIM(JSON_UNQUOTE(JSON_EXTRACT(publication_details, '$.publisher'))) <> ''
  ) used;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- DROP TABLE IF EXISTS `publishers`;
