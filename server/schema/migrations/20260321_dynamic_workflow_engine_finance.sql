-- Migration: Dynamic Ordered Workflow Engine (Finance First)
-- Date: 2026-03-21
-- Description:
--   1) Convert approval_flow_config from fixed boolean stages to dynamic JSON flow arrays
--   2) Add generic workflow_stage_policies and workflow_actions tables
--   3) Add finance workflow snapshot columns and scope fields
--   4) Seed finance stage permissions and role mappings

-- =====================================================
-- 1) approval_flow_config -> module_key + flow(JSON)
-- =====================================================

DROP PROCEDURE IF EXISTS migrate_approval_flow_config_dynamic;
DELIMITER $$
CREATE PROCEDURE migrate_approval_flow_config_dynamic()
BEGIN
  DECLARE has_module_col INT DEFAULT 0;
  DECLARE has_module_key_col INT DEFAULT 0;
  DECLARE has_flow_col INT DEFAULT 0;
  DECLARE has_requires_level1_col INT DEFAULT 0;
  DECLARE has_requires_dof_col INT DEFAULT 0;
  DECLARE has_requires_principal_col INT DEFAULT 0;

  SELECT COUNT(*) INTO has_module_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'module';

  SELECT COUNT(*) INTO has_module_key_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'module_key';

  IF has_module_col > 0 AND has_module_key_col = 0 THEN
    ALTER TABLE approval_flow_config
      CHANGE COLUMN module module_key VARCHAR(64) NOT NULL;
  END IF;

  SELECT COUNT(*) INTO has_flow_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'flow';

  IF has_flow_col = 0 THEN
    ALTER TABLE approval_flow_config
      ADD COLUMN flow JSON NULL AFTER entity_type_code;
  END IF;

  SELECT COUNT(*) INTO has_requires_level1_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'requires_level1';

  SELECT COUNT(*) INTO has_requires_dof_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'requires_dof';

  SELECT COUNT(*) INTO has_requires_principal_col
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_flow_config'
    AND COLUMN_NAME = 'requires_principal';

  -- Normalize module keys if present
  UPDATE approval_flow_config
  SET module_key = CASE
    WHEN UPPER(TRIM(module_key)) = 'BUDGET' THEN 'budget'
    WHEN UPPER(TRIM(module_key)) = 'FINANCE' THEN 'finance'
    WHEN UPPER(TRIM(module_key)) = 'BOTH' THEN '*'
    WHEN TRIM(module_key) = '' THEN '*'
    ELSE LOWER(TRIM(module_key))
  END;

  -- Backfill flow from old booleans if columns still exist
  IF has_requires_level1_col > 0 AND has_requires_dof_col > 0 AND has_requires_principal_col > 0 THEN
    UPDATE approval_flow_config
    SET flow = CASE
      WHEN COALESCE(requires_level1, 0) = 1
        AND COALESCE(requires_dof, 0) = 1
        AND COALESCE(requires_principal, 0) = 1 THEN JSON_ARRAY('level1', 'dof', 'principal')
      WHEN COALESCE(requires_level1, 0) = 1
        AND COALESCE(requires_dof, 0) = 1
        AND COALESCE(requires_principal, 0) = 0 THEN JSON_ARRAY('level1', 'dof')
      WHEN COALESCE(requires_level1, 0) = 1
        AND COALESCE(requires_dof, 0) = 0
        AND COALESCE(requires_principal, 0) = 1 THEN JSON_ARRAY('level1', 'principal')
      WHEN COALESCE(requires_level1, 0) = 1
        AND COALESCE(requires_dof, 0) = 0
        AND COALESCE(requires_principal, 0) = 0 THEN JSON_ARRAY('level1')
      WHEN COALESCE(requires_level1, 0) = 0
        AND COALESCE(requires_dof, 0) = 1
        AND COALESCE(requires_principal, 0) = 1 THEN JSON_ARRAY('dof', 'principal')
      WHEN COALESCE(requires_level1, 0) = 0
        AND COALESCE(requires_dof, 0) = 1
        AND COALESCE(requires_principal, 0) = 0 THEN JSON_ARRAY('dof')
      WHEN COALESCE(requires_level1, 0) = 0
        AND COALESCE(requires_dof, 0) = 0
        AND COALESCE(requires_principal, 0) = 1 THEN JSON_ARRAY('principal')
      ELSE JSON_ARRAY('level1', 'dof', 'principal')
    END
    WHERE flow IS NULL OR JSON_LENGTH(flow) = 0;

    ALTER TABLE approval_flow_config
      DROP COLUMN requires_level1,
      DROP COLUMN requires_dof,
      DROP COLUMN requires_principal;
  END IF;

  UPDATE approval_flow_config
  SET flow = JSON_ARRAY('level1', 'dof', 'principal')
  WHERE flow IS NULL OR JSON_TYPE(flow) <> 'ARRAY' OR JSON_LENGTH(flow) = 0;

  ALTER TABLE approval_flow_config
    MODIFY COLUMN flow JSON NOT NULL;
END$$
DELIMITER ;

CALL migrate_approval_flow_config_dynamic();
DROP PROCEDURE migrate_approval_flow_config_dynamic;

-- =====================================================
-- 2) workflow_stage_policies
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_stage_policies (
  id INT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(64) NOT NULL,
  stage_key VARCHAR(64) NOT NULL,
  scope_type ENUM('global', 'department', 'entity') NOT NULL,
  meta JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workflow_stage_policy (module_key, stage_key),
  KEY idx_workflow_stage_policy_module (module_key),
  KEY idx_workflow_stage_policy_scope (scope_type),
  KEY idx_workflow_stage_policy_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- 3) workflow_actions (append-only audit)
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_actions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(64) NOT NULL,
  record_id BIGINT NOT NULL,
  stage VARCHAR(64) NOT NULL,
  decision ENUM('approved', 'rejected', 'returned', 'archived') NOT NULL,
  feedback TEXT NULL,
  actor_user_id INT NULL,
  actor_email VARCHAR(255) NULL,
  actor_role VARCHAR(100) NULL,
  decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snapshot_before JSON NOT NULL,
  meta JSON NULL,
  PRIMARY KEY (id),
  KEY idx_workflow_actions_record (module_key, record_id, decided_at),
  KEY idx_workflow_actions_actor (actor_user_id),
  KEY idx_workflow_actions_stage (module_key, stage, decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- 4) finance_requests workflow snapshot + scope fields
-- =====================================================

DROP PROCEDURE IF EXISTS migrate_finance_requests_workflow_cols;
DELIMITER $$
CREATE PROCEDURE migrate_finance_requests_workflow_cols()
BEGIN
  DECLARE has_department_id INT DEFAULT 0;
  DECLARE has_beneficiary_entity_id INT DEFAULT 0;
  DECLARE has_workflow_state INT DEFAULT 0;
  DECLARE has_workflow_status INT DEFAULT 0;
  DECLARE has_workflow_stage INT DEFAULT 0;

  SELECT COUNT(*) INTO has_department_id
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'department_id';

  IF has_department_id = 0 THEN
    ALTER TABLE finance_requests
      ADD COLUMN department_id INT NULL AFTER beneficiary_value;
  END IF;

  SELECT COUNT(*) INTO has_beneficiary_entity_id
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'beneficiary_entity_id';

  IF has_beneficiary_entity_id = 0 THEN
    ALTER TABLE finance_requests
      ADD COLUMN beneficiary_entity_id INT NULL AFTER department_id;
  END IF;

  SELECT COUNT(*) INTO has_workflow_state
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'workflow_state';

  IF has_workflow_state = 0 THEN
    ALTER TABLE finance_requests
      ADD COLUMN workflow_state JSON NULL AFTER overall_status;
  END IF;

  SELECT COUNT(*) INTO has_workflow_status
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'workflow_status';

  IF has_workflow_status = 0 THEN
    ALTER TABLE finance_requests
      ADD COLUMN workflow_status VARCHAR(32)
        GENERATED ALWAYS AS (
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.status')),
            'in_progress'
          )
        ) STORED;
  END IF;

  SELECT COUNT(*) INTO has_workflow_stage
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'finance_requests'
    AND COLUMN_NAME = 'workflow_stage';

  IF has_workflow_stage = 0 THEN
    ALTER TABLE finance_requests
      ADD COLUMN workflow_stage VARCHAR(64)
        GENERATED ALWAYS AS (
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.currentStage')),
            ''
          )
        ) STORED;
  END IF;
END$$
DELIMITER ;

CALL migrate_finance_requests_workflow_cols();
DROP PROCEDURE migrate_finance_requests_workflow_cols;

ALTER TABLE finance_requests
  MODIFY COLUMN overall_status ENUM('pending','approved','rejected','archived') DEFAULT 'pending';

ALTER TABLE finance_requests
  ADD INDEX idx_finance_requests_department_id (department_id),
  ADD INDEX idx_finance_requests_beneficiary_entity_id (beneficiary_entity_id),
  ADD INDEX idx_finance_requests_workflow_status (workflow_status),
  ADD INDEX idx_finance_requests_workflow_stage (workflow_stage),
  ADD INDEX idx_finance_requests_workflow_stage_status (workflow_stage, workflow_status);

-- Best-effort backfill for workflow context columns from staff records
UPDATE finance_requests fr
LEFT JOIN master_employees e ON fr.employee_id = e.id
SET
  fr.department_id = COALESCE(fr.department_id, e.department_id),
  fr.beneficiary_entity_id = COALESCE(fr.beneficiary_entity_id, e.entity_id)
WHERE fr.employee_id IS NOT NULL;

-- =====================================================
-- 5) Permissions and role mappings for finance workflow stages
-- =====================================================

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('finance_workflow', 'level1', 'finance.workflow.level1', 'Process finance Level-1 approvals', 1),
  ('finance_workflow', 'dof', 'finance.workflow.dof', 'Process finance DoF-stage approvals', 1),
  ('finance_workflow', 'principal', 'finance.workflow.principal', 'Process finance Principal-stage approvals', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

-- Super admin gets all finance workflow permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'finance.workflow.level1',
  'finance.workflow.dof',
  'finance.workflow.principal'
)
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Level-1 approvers (HOD + Coordinator/Entity approver) -> level1
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'finance.workflow.level1'
WHERE r.role_code IN ('hod', 'coordinator', 'entity_approver')
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Finance admin -> dof
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'finance.workflow.dof'
WHERE r.role_code = 'finance_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Principal -> principal
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'finance.workflow.principal'
WHERE r.role_code = 'principal'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- =====================================================
-- 6) Seed finance flow config + stage policies
-- =====================================================

INSERT INTO approval_flow_config (
  beneficiary_type,
  entity_type_code,
  module_key,
  flow,
  is_active
)
VALUES
  ('*', NULL, 'finance', JSON_ARRAY('level1', 'dof', 'principal'), 1)
ON DUPLICATE KEY UPDATE
  flow = VALUES(flow),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  ('finance', 'level1', 'department', JSON_OBJECT('assignmentRoleCodes', JSON_ARRAY('hod', 'coordinator', 'entity_approver'), 'requireAssignment', FALSE), 1),
  ('finance', 'dof', 'global', NULL, 1),
  ('finance', 'principal', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
