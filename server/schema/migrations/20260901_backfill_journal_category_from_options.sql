-- ==================================================================
-- Re-sync journals.category with the curated journal level
--
-- National/International is set by admins on journal_options.category.
-- journals.category is only a snapshot of it, but the publication form
-- never read the curated value: /journals/search did not return the
-- column, so the read-only "Level" field stayed on its default and every
-- publication was stored as 'National' — including papers filed against
-- journals the admin had already marked 'International'.
--
-- The application now derives journals.category from the linked
-- journal_options row on every create and update. This backfills the rows
-- written before that, so existing publications stop reporting the wrong
-- level in the publication space and in the admin Basic Information panel.
--
-- Conference papers, Books and Book Chapters are left alone: they are
-- linked to placeholder journal_options rows that carry no curated level,
-- and their own category has no other source.
-- ==================================================================

UPDATE journals j
  JOIN journal_options jo ON jo.id = j.journal_options_id
   SET j.category = jo.category
 WHERE j.type NOT IN ('Conference paper', 'Book Chapter', 'Book')
   AND jo.category IN ('National', 'International')
   AND j.category <> jo.category;

-- ==================================================================
-- Collapse duplicate index rows
--
-- Saving a publication used to re-insert every selected index, so each edit
-- added another copy. The application now replaces the set instead; this
-- clears the copies already recorded.
-- ==================================================================

DELETE ji FROM journal_indexes ji
  JOIN journal_indexes keep
    ON keep.journal_id = ji.journal_id
   AND keep.index_name = ji.index_name
   AND keep.id < ji.id;

-- ==================================================================
-- Duplicate journal names (manual follow-up, not automated here)
--
-- Publications now link by journal_options_id and the admin screen
-- rejects a duplicate name, so no new ambiguity can be introduced.
-- Entries that are already duplicated still need a human decision about
-- which copy is authoritative before they can be merged, so list them:
--
--   SELECT journal_name, COUNT(*) AS copies,
--          GROUP_CONCAT(CONCAT(id, ':', category) ORDER BY id) AS entries
--     FROM journal_options
--    GROUP BY journal_name
--   HAVING COUNT(*) > 1;
-- ==================================================================

-- ==================================================================
-- ROLLBACK (keep commented)
--
-- There is no faithful rollback: the previous values were the wrong
-- level, not a distinct piece of information. To force everything back
-- to the old default:
-- UPDATE journals SET category = 'National'
--  WHERE type NOT IN ('Conference paper', 'Book Chapter', 'Book');
-- ==================================================================
