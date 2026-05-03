-- Migration: Ensure base user role exists and is assigned to all users
-- Date: 2026-05-03
-- Purpose:
--   1) Create system role `user` if missing
--   2) Assign `user` role to every existing account

INSERT INTO roles (role_code, role_name, description, is_system, is_admin_role)
VALUES ('user', 'User', 'Base role assigned to all authenticated users', 1, 0)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  description = VALUES(description);

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT
  u.id AS user_id,
  r.id AS role_id,
  NULL AS assigned_by
FROM users u
JOIN roles r
  ON r.role_code = 'user'
LEFT JOIN user_roles ur
  ON ur.user_id = u.id
 AND ur.role_id = r.id
WHERE ur.user_id IS NULL;
