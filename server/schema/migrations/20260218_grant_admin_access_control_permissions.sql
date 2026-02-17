-- Migration: Grant Access Control Permissions to Admin
-- Author: Codex
-- Date: 2026-02-18
-- Description:
--   Allows admin role to manage role assignments via access control module.

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'access_control.read',
  'access_control.manage'
)
WHERE r.role_code = 'admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;
