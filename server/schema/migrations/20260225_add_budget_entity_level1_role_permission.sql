-- Migration: Add Budget Entity Level-1 RBAC Permission and Role
-- Author: Codex
-- Date: 2026-02-25
-- Description:
--   Adds dedicated permission for entity Level-1 budget workflow approvals
--   and seeds a system role for entity approvers.

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES (
  'budget_workflow',
  'entity_level1',
  'budget.workflow.entity_level1',
  'View Entity Level-1 queue and process entity-assigned Level-1 approvals',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

INSERT INTO roles (role_code, role_name, description, is_system, is_admin_role)
VALUES (
  'entity_approver',
  'Entity Approver',
  'Entity beneficiary Level-1 budget approver role',
  1,
  1
)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  description = VALUES(description),
  is_system = VALUES(is_system),
  is_admin_role = VALUES(is_admin_role);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'budget.workflow.entity_level1'
WHERE r.role_code = 'entity_approver'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'budget.workflow.entity_level1'
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;
