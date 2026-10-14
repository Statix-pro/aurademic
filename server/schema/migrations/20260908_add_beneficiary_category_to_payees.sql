-- ==================================================================
-- Classify internal individual payees as Student / Faculty / Staff
--
-- A payee whose beneficiary is KSRCT or KSREI is someone inside the
-- institution, and Finance needs to know which population they belong
-- to — a student reimbursement, a faculty claim and a staff payment are
-- reported and reconciled separately, and until now the payee master
-- could not tell them apart.
--
-- Only individual payees carry a category: an External payee is outside
-- the institution and an Organization payee is an entity rather than a
-- person, so both stay NULL. Existing rows are left NULL — the category
-- is captured the next time each payee is submitted or edited.
-- ==================================================================

SET @db_name = DATABASE();

SET @has_beneficiary_category = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'expenditure_payees'
    AND COLUMN_NAME = 'beneficiary_category'
);

SET @sql_beneficiary_category = IF(
  @has_beneficiary_category = 0,
  'ALTER TABLE expenditure_payees
     ADD COLUMN beneficiary_category ENUM(''Student'', ''Faculty'', ''Staff'')
       DEFAULT NULL
       COMMENT ''Population an internal individual payee belongs to; NULL for External and Organization''
       AFTER beneficiary_org',
  'SELECT 1'
);
PREPARE stmt FROM @sql_beneficiary_category;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==================================================================
-- ROLLBACK (keep commented)
-- ==================================================================
-- ALTER TABLE expenditure_payees DROP COLUMN beneficiary_category;
