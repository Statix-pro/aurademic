-- Migration: Rename 'hod' Stage to Generic 'level1' (Safe Version)
-- Author: Codex
-- Date: 2026-02-26
-- Description:
--   Unifies the Level-1 approval stage for both Departments and Entities.
--   Renames DB columns and status strings using safe WHERE clauses to avoid broad updates.
--   Idempotent version.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. approval_flow_config
DROP PROCEDURE IF EXISTS RenameHodColumn;
DELIMITER $$
CREATE PROCEDURE RenameHodColumn()
BEGIN
    IF EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'approval_flow_config'
        AND COLUMN_NAME = 'requires_hod'
        AND TABLE_SCHEMA = DATABASE()
    ) THEN
        ALTER TABLE approval_flow_config CHANGE requires_hod requires_level1 TINYINT(1) NOT NULL DEFAULT 0;
    END IF;
END $$
DELIMITER ;
CALL RenameHodColumn();
DROP PROCEDURE RenameHodColumn;

-- 2. budget_proposals
-- Update existing status strings only where relevant:
UPDATE budget_proposals 
SET status = REPLACE(status, 'hod_', 'level1_') 
WHERE status LIKE 'hod_%';

UPDATE budget_proposals 
SET current_stage = 'level1' 
WHERE current_stage = 'hod';

UPDATE budget_proposals 
SET approval_flow = REPLACE(approval_flow, 'hod', 'level1') 
WHERE approval_flow LIKE '%hod%';

-- 3. budget_proposal_approvals
UPDATE budget_proposal_approvals 
SET role = 'level1' 
WHERE role = 'hod';

-- 4. permissions
DROP PROCEDURE IF EXISTS RenameHodPermission;
DELIMITER $$
CREATE PROCEDURE RenameHodPermission()
BEGIN
    DECLARE hod_id INT;
    DECLARE level1_id INT;
    
    SELECT id INTO hod_id FROM permissions WHERE permission_key = 'budget.workflow.hod';
    SELECT id INTO level1_id FROM permissions WHERE permission_key = 'budget.workflow.level1';

    IF hod_id IS NOT NULL THEN
        IF level1_id IS NULL THEN
            UPDATE permissions 
            SET permission_key = 'budget.workflow.level1', 
                action_key = 'level1', 
                description = 'View Level-1 queue and process HOD/Coordinator approvals' 
            WHERE id = hod_id;
        ELSE
            -- Both exist, migrate role mappings to level1 and drop hod
            UPDATE IGNORE role_permissions SET permission_id = level1_id WHERE permission_id = hod_id;
            DELETE FROM role_permissions WHERE permission_id = hod_id;
            DELETE FROM permissions WHERE id = hod_id;
        END IF;
    END IF;
END $$
DELIMITER ;
CALL RenameHodPermission();
DROP PROCEDURE RenameHodPermission;

SET FOREIGN_KEY_CHECKS = 1;
