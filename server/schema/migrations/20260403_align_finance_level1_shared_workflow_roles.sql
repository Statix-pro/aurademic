-- Migration: Align Finance Level-1 to shared dynamic workflow role model
-- Date: 2026-04-03
-- Purpose:
--   1) Ensure finance level1 stage policy uses shared assignment roles
--   2) Ensure finance.workflow.level1 permission is granted to all level1 role codes

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('finance_workflow', 'level1', 'finance.workflow.level1', 'Process finance Level-1 approvals', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'finance.workflow.level1'
WHERE r.role_code IN ('hod', 'coordinator', 'entity_approver')
ON DUPLICATE KEY UPDATE
  granted_at = granted_at;

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  (
    'finance',
    'level1',
    'department',
    JSON_OBJECT(
      'assignmentRoleCodes',
      JSON_ARRAY('hod', 'coordinator', 'entity_approver'),
      'requireAssignment',
      FALSE
    ),
    1
  )
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
