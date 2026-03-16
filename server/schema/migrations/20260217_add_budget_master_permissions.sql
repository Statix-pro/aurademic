-- Migration: Add Budget Master Permissions
-- Author: Codex
-- Date: 2026-02-17
-- Description:
--   Introduces RBAC permissions for budget entity master management.

INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  ('budget_master', 'read', 'budget_master.read', 'View budget entity masters', 1),
  ('budget_master', 'edit', 'budget_master.edit', 'Create and update budget entity masters', 1),
  ('budget_master', 'manage', 'budget_master.manage', 'Full control over budget entity masters', 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

-- Super Admin -> manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget_master.read',
  'budget_master.edit',
  'budget_master.manage'
)
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Admin -> manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget_master.read',
  'budget_master.edit',
  'budget_master.manage'
)
WHERE r.role_code = 'admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Principal -> edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget_master.read',
  'budget_master.edit'
)
WHERE r.role_code = 'principal'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Finance Admin -> read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'budget_master.read'
WHERE r.role_code = 'finance_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- HOD -> read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'budget_master.read'
WHERE r.role_code = 'hod'
ON DUPLICATE KEY UPDATE granted_at = granted_at;
