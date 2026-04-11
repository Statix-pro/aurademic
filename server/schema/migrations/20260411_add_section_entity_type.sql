-- ======================================================================================
-- SCRIPT: Add 'Section' to Master Entity Types
-- DESCRIPTION: Inserts 'Section' as a new classification for entities.
-- ======================================================================================

-- 1. START TRANSACTION
START TRANSACTION;

-- 2. INSERT THE NEW ENTITY TYPE
INSERT INTO master_entity_types (code, name, is_active, sort_order)
VALUES ('SECTION', 'Section', 1, 100);

-- 3. VERIFY THE INSERT
SELECT id, code, name, is_active FROM master_entity_types WHERE code = 'SECTION';

-- 4. COMMIT (Uncomment to save)
COMMIT;
-- ROLLBACK;
