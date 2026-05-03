-- Migration: Add Chairman stage to finance workflow
-- Date: 2026-05-02
-- Purpose:
--   1) Add finance.workflow.chairman permission
--   2) Grant chairman permission to super_admin and chairman roles
--   3) Keep default finance flow at principal; chairman is conditionally applied for >10,000
--   4) Ensure chairman stage policy exists
--   5) Upgrade active finance workflow snapshots that still have 3-stage flow

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('finance_workflow', 'chairman', 'finance.workflow.chairman', 'Process finance Chairman-stage approvals', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'finance.workflow.chairman'
WHERE r.role_code IN ('super_admin', 'chairman')
ON DUPLICATE KEY UPDATE
  granted_at = granted_at;

UPDATE approval_flow_config
SET flow = JSON_ARRAY('level1', 'dof', 'principal'),
    updated_at = CURRENT_TIMESTAMP
WHERE is_active = 1
  AND LOWER(TRIM(module_key)) = 'finance';

INSERT INTO workflow_stage_policies (module_key, stage_key, scope_type, meta, is_active)
VALUES
  ('finance', 'chairman', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE
  scope_type = VALUES(scope_type),
  meta = VALUES(meta),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

UPDATE finance_requests fr
SET fr.workflow_state = JSON_SET(
  fr.workflow_state,
  '$.flow',
  JSON_ARRAY_APPEND(JSON_EXTRACT(fr.workflow_state, '$.flow'), '$', 'chairman')
)
WHERE fr.workflow_state IS NOT NULL
  AND JSON_VALID(fr.workflow_state)
  AND JSON_TYPE(JSON_EXTRACT(fr.workflow_state, '$.flow')) = 'ARRAY'
  AND JSON_SEARCH(JSON_EXTRACT(fr.workflow_state, '$.flow'), 'one', 'principal') IS NOT NULL
  AND JSON_SEARCH(JSON_EXTRACT(fr.workflow_state, '$.flow'), 'one', 'chairman') IS NULL
  AND COALESCE(fr.total_budget, 0) > 10000
  AND LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('in_progress', 'returned');
