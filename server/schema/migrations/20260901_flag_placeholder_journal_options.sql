-- ==================================================================
-- Keep book and conference placeholders out of the journal picker
--
-- journals.journal_options_id is NOT NULL, so a Conference paper, Book or
-- Book Chapter — which has no journal at all — is given a placeholder
-- journal_options row named after its own title. Those rows are then offered
-- as real journals in the publication form's "Search for a Journal" dropdown,
-- so a user filing an article could pick somebody else's book chapter, and the
-- list grew by one entry per book or conference ever recorded.
--
-- The flag marks them so the picker can skip them. Admin Journal Management
-- still lists everything, which is where such rows can be cleaned up.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_flag = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'journal_options'
    AND COLUMN_NAME = 'is_placeholder'
);

SET @sql_flag = IF(
  @has_flag = 0,
  'ALTER TABLE journal_options ADD COLUMN is_placeholder TINYINT(1) NOT NULL DEFAULT ''0'' COMMENT ''1 = stand-in row for a book/conference, not a real journal'' AFTER category',
  'SELECT 1'
);
PREPARE stmt FROM @sql_flag;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: a row used only by books/conferences and never by a journal article
-- is a placeholder. Rows with no publications at all are left alone, because an
-- admin-created journal that nobody has published in yet looks identical.
UPDATE journal_options jo
   SET jo.is_placeholder = 1
 WHERE EXISTS (
         SELECT 1 FROM journals j
          WHERE j.journal_options_id = jo.id
            AND j.type IN ('Conference paper', 'Book Chapter', 'Book')
       )
   AND NOT EXISTS (
         SELECT 1 FROM journals j
          WHERE j.journal_options_id = jo.id
            AND j.type NOT IN ('Conference paper', 'Book Chapter', 'Book')
       );

-- ==================================================================
-- Orphaned placeholders (manual follow-up)
--
-- Deleting a book or conference leaves its placeholder behind, and once
-- detached it can no longer be told apart from a real journal with no
-- publications. To review the unreferenced rows:
--
--   SELECT jo.id, jo.journal_name, jo.is_placeholder
--     FROM journal_options jo
--    WHERE NOT EXISTS (SELECT 1 FROM journals j WHERE j.journal_options_id = jo.id);
-- ==================================================================

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE journal_options DROP COLUMN is_placeholder;
