-- ==================================================================
-- Give projects their own budget head vocabulary
--
-- The project module pointed its three head-carrying tables at the
-- institution-wide `budget_heads` catalog, so a project budgeted against
-- the heads the college spends its own money under — Civil
-- Infrastructure, Institutional Audits, Club Activities. A project is
-- sanctioned against the heads its funding agency recognises instead:
-- Manpower, Contingencies and Overhead Charges on a research grant;
-- Honorarium, Boarding and Lodging on a sponsored event.
--
-- That vocabulary cannot live in `budget_heads`: five of its names
-- (Equipment, Consumables, Printing, Stationery, Administrative
-- Expenses) are already taken there by heads in other groups, and
-- `budget_heads.name` is UNIQUE — while `Consumables` has to be reachable
-- from both project groups at once, which one row per name can never be.
-- Relaxing that index is not an option either: budget, expenditure and
-- finance all resolve heads by name through resolveCatalogIds().
--
-- So project heads become a code-side list stored by name, the way
-- PROJECT_INCOME_HEADS already works on the income side of the same
-- ledger. Both tables already snapshot the name, so nothing is lost —
-- this migration only makes the snapshot the single source, moves each
-- duplicate guard onto it, and drops the catalog reference.
-- ==================================================================

SET @db_name = DATABASE();

-- ── 1. Backfill every snapshot from the catalog before cutting the tie ──
-- A row that never stored its name still has one to inherit while the
-- foreign key is in place. After this the catalog is never read again.

-- Each is guarded on the column it reads: step 5 drops those columns, so an
-- unguarded backfill would make a second run of this migration fail rather
-- than do nothing.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0,
  'UPDATE project_budget_heads pbh
     JOIN budget_heads bh ON bh.id = pbh.budget_head_id
      SET pbh.budget_head_name = bh.name
    WHERE NULLIF(TRIM(pbh.budget_head_name), \'\') IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0,
  'UPDATE project_finance_row_heads frh
     JOIN budget_heads bh ON bh.id = frh.budget_head_id
      SET frh.budget_head_name = bh.name
    WHERE NULLIF(TRIM(frh.budget_head_name), \'\') IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0,
  'UPDATE project_transactions pt
     JOIN budget_heads bh ON bh.id = pt.budget_head_id
      SET pt.head_name = bh.name
    WHERE NULLIF(TRIM(pt.head_name), \'\') IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 2. Drop the foreign keys ────────────────────────────────────────────
-- MySQL refuses to drop a column an FK still names, so these go first.

SET @fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
              AND CONSTRAINT_NAME = 'fk_project_budget_heads_head');
SET @sql = IF(@fk > 0,
  'ALTER TABLE project_budget_heads DROP FOREIGN KEY fk_project_budget_heads_head',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
              AND CONSTRAINT_NAME = 'fk_project_finance_row_heads_head');
SET @sql = IF(@fk > 0,
  'ALTER TABLE project_finance_row_heads DROP FOREIGN KEY fk_project_finance_row_heads_head',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
              AND CONSTRAINT_NAME = 'fk_project_transactions_head');
SET @sql = IF(@fk > 0,
  'ALTER TABLE project_transactions DROP FOREIGN KEY fk_project_transactions_head',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. Move each duplicate guard onto the name ──────────────────────────
-- The old keys were on budget_head_id, which is about to disappear. Both
-- normalizers already deduplicated by name before saving, so no existing
-- row should collide; MySQL still treats NULL names as distinct, so a
-- half-filled row does not block its siblings.

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND INDEX_NAME = 'uq_project_budget_heads_name');
SET @sql = IF(@key = 0,
  'ALTER TABLE project_budget_heads
     ADD UNIQUE KEY uq_project_budget_heads_name (project_id, budget_head_name)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
               AND INDEX_NAME = 'uq_project_finance_row_heads_name');
SET @sql = IF(@key = 0,
  'ALTER TABLE project_finance_row_heads
     ADD UNIQUE KEY uq_project_finance_row_heads_name (finance_row_id, budget_head_name)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- The ledger has many rows per head, so it carries an ordinary index.
SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND INDEX_NAME = 'idx_project_transactions_head_name');
SET @sql = IF(@key = 0,
  'ALTER TABLE project_transactions
     ADD KEY idx_project_transactions_head_name (project_id, head_name)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 4. Drop the old keys, explicitly ────────────────────────────────────
-- Dropping a column does NOT remove a composite index that names it: MySQL
-- rebuilds the index on the columns that remain. Left alone,
-- uq_project_budget_heads (project_id, budget_head_id) would come back as
-- UNIQUE (project_id) and reject the second head row of every project, and
-- uq_project_finance_row_heads likewise as UNIQUE (finance_row_id). So each
-- one goes before its column does — but only now that step 3 has added the
-- index that takes over as the backing index for each table's foreign key,
-- which MySQL will not let these be dropped without.

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND INDEX_NAME = 'uq_project_budget_heads');
SET @sql = IF(@key > 0,
  'ALTER TABLE project_budget_heads DROP INDEX uq_project_budget_heads', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND INDEX_NAME = 'idx_project_budget_heads_head');
SET @sql = IF(@key > 0,
  'ALTER TABLE project_budget_heads DROP INDEX idx_project_budget_heads_head', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
               AND INDEX_NAME = 'uq_project_finance_row_heads');
SET @sql = IF(@key > 0,
  'ALTER TABLE project_finance_row_heads DROP INDEX uq_project_finance_row_heads', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
               AND INDEX_NAME = 'idx_project_finance_row_heads_head');
SET @sql = IF(@key > 0,
  'ALTER TABLE project_finance_row_heads DROP INDEX idx_project_finance_row_heads_head',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @key = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND INDEX_NAME = 'idx_project_transactions_head');
SET @sql = IF(@key > 0,
  'ALTER TABLE project_transactions DROP INDEX idx_project_transactions_head', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 5. Drop the catalog columns ─────────────────────────────────────────
-- Nothing indexes them any more, so these are plain column drops.

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_budget_heads'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0, 'ALTER TABLE project_budget_heads DROP COLUMN budget_head_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_finance_row_heads'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0,
  'ALTER TABLE project_finance_row_heads DROP COLUMN budget_head_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'project_transactions'
               AND COLUMN_NAME = 'budget_head_id');
SET @sql = IF(@col > 0, 'ALTER TABLE project_transactions DROP COLUMN budget_head_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented — the catalog ids are not recoverable once
-- dropped; the names remain, so re-linking means matching on name)
-- ==================================================================
-- ALTER TABLE project_budget_heads ADD COLUMN budget_head_id INT DEFAULT NULL AFTER project_id;
-- ALTER TABLE project_finance_row_heads ADD COLUMN budget_head_id INT DEFAULT NULL AFTER finance_row_id;
-- ALTER TABLE project_transactions ADD COLUMN budget_head_id INT DEFAULT NULL AFTER head_kind;
