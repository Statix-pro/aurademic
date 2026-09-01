-- ==================================================================
-- Record who submitted a publication
--
-- Access to a publication was inferred entirely from authorship: the
-- workflow check matched the caller's email against the journal's authors.
-- A submitter who filed a paper without listing themselves among its
-- authors therefore lost the record the moment it was created — edits,
-- deletes and index changes all answered 403, and the publication never
-- appeared in their publication space either.
--
-- created_by makes the submitter explicit, so "may I change this?" no
-- longer depends on being credited on the paper.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_created_by = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'journals'
    AND COLUMN_NAME = 'created_by'
);

SET @sql_created_by = IF(
  @has_created_by = 0,
  'ALTER TABLE journals ADD COLUMN created_by INT DEFAULT NULL COMMENT ''User who submitted the publication'' AFTER reference_number',
  'SELECT 1'
);
PREPARE stmt FROM @sql_created_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_fk = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'journals'
    AND CONSTRAINT_NAME = 'fk_journals_created_by'
);

SET @sql_fk = IF(
  @has_fk = 0,
  'ALTER TABLE journals ADD CONSTRAINT fk_journals_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: for publications written before this column, the corresponding
-- (or first) author is the best available stand-in for the submitter. Rows
-- whose authors have no login stay NULL and keep the authorship-based check.
UPDATE journals j
  JOIN (
    SELECT aj.journal_id, MIN(u.id) AS user_id
      FROM author_journal aj
      JOIN v_authors va ON va.author_id = aj.author_id
      JOIN users u ON u.email = va.email
     GROUP BY aj.journal_id
  ) owner ON owner.journal_id = j.id
   SET j.created_by = owner.user_id
 WHERE j.created_by IS NULL;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE journals DROP FOREIGN KEY fk_journals_created_by;
-- ALTER TABLE journals DROP COLUMN created_by;
