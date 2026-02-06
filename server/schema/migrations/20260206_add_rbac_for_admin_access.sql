-- Migration: Add RBAC for Scalable Admin Access Control
-- Author: Codex
-- Date: 2026-02-06
-- Description:
--   Introduce role-based access control (RBAC) with granular permissions.
--   Adds Super Admin capabilities to assign role-based read/edit/approve/manage
--   access for future admin levels (HOD, Finance, Principal, etc.).

-- =====================================================
-- ROLES MASTER
-- =====================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(80) NOT NULL,
  role_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_admin_role TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (role_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- PERMISSIONS MASTER
-- =====================================================
CREATE TABLE IF NOT EXISTS permissions (
  id INT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(100) NOT NULL,
  action_key VARCHAR(50) NOT NULL,
  permission_key VARCHAR(160) NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (permission_key),
  UNIQUE KEY uq_permissions_module_action (module_key, action_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- ROLE -> PERMISSION MAPPING
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id)
    REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id)
    REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- USER -> ROLE MAPPING
-- =====================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  assigned_by INT DEFAULT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  KEY idx_user_roles_assigned_by (assigned_by),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id)
    REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by)
    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- SEED PERMISSIONS
-- =====================================================
INSERT INTO permissions (module_key, action_key, permission_key, description)
VALUES
  ('admin_dashboard', 'read', 'admin_dashboard.read', 'View admin dashboard data'),
  ('admin_dashboard', 'edit', 'admin_dashboard.edit', 'Edit admin-managed records'),
  ('admin_dashboard', 'approve', 'admin_dashboard.approve', 'Approve and reject admin workflows'),
  ('admin_dashboard', 'manage', 'admin_dashboard.manage', 'Full admin dashboard access'),

  ('form_options', 'read', 'form_options.read', 'View form option masters'),
  ('form_options', 'edit', 'form_options.edit', 'Create and update form options'),
  ('form_options', 'manage', 'form_options.manage', 'Full control over form options'),

  ('finance', 'read', 'finance.read', 'View finance requests'),
  ('finance', 'edit', 'finance.edit', 'Edit finance requests'),
  ('finance', 'approve', 'finance.approve', 'Approve finance workflows'),

  ('publications', 'read', 'publications.read', 'View publication records'),
  ('publications', 'edit', 'publications.edit', 'Edit publication records'),

  ('projects', 'read', 'projects.read', 'View project records'),
  ('projects', 'edit', 'projects.edit', 'Edit project records'),

  ('events', 'read', 'events.read', 'View events'),
  ('events', 'edit', 'events.edit', 'Create and edit events'),

  ('reports', 'read', 'reports.read', 'View reports'),
  ('reports', 'manage', 'reports.manage', 'Manage report access and exports'),

  ('access_control', 'read', 'access_control.read', 'View roles and permissions'),
  ('access_control', 'manage', 'access_control.manage', 'Create roles and assign user access')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- =====================================================
-- SEED SYSTEM ROLES
-- =====================================================
INSERT INTO roles (role_code, role_name, description, is_system, is_admin_role)
VALUES
  ('super_admin', 'Super Admin', 'Global access to all modules and access control', 1, 1),
  ('admin', 'Admin', 'Standard admin access for current dashboard workflows', 1, 1),
  ('hod', 'Head of Department', 'Department-level review and approval role', 1, 1),
  ('finance_admin', 'Finance Admin', 'Finance-focused workflow access', 1, 1),
  ('principal', 'Principal', 'Institute-level review and approval role', 1, 1)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  description = VALUES(description),
  is_admin_role = VALUES(is_admin_role);

-- =====================================================
-- ROLE -> PERMISSION ASSIGNMENTS
-- =====================================================

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Admin role (current system behavior)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.role_code = 'admin'
  AND p.permission_key IN (
    'admin_dashboard.read',
    'admin_dashboard.edit',
    'admin_dashboard.approve',
    'form_options.read',
    'form_options.edit',
    'publications.read',
    'projects.read',
    'events.read',
    'reports.read'
  )
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- HOD role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.role_code = 'hod'
  AND p.permission_key IN (
    'publications.read',
    'publications.edit',
    'projects.read',
    'projects.edit',
    'admin_dashboard.read',
    'reports.read'
  )
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Finance Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.role_code = 'finance_admin'
  AND p.permission_key IN (
    'finance.read',
    'finance.edit',
    'finance.approve',
    'reports.read',
    'admin_dashboard.read'
  )
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Principal role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.role_code = 'principal'
  AND p.permission_key IN (
    'admin_dashboard.read',
    'admin_dashboard.approve',
    'publications.read',
    'projects.read',
    'finance.read',
    'reports.read'
  )
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- =====================================================
-- MIGRATE EXISTING ADMINS
-- =====================================================

-- Existing admins become Admin role members
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, r.id, NULL
FROM users u
JOIN roles r ON r.role_code = 'admin'
WHERE u.is_admin = 1
ON DUPLICATE KEY UPDATE assigned_at = assigned_at;

-- Bootstrap one Super Admin if none exists yet
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT bootstrap_user.id, super_role.id, NULL
FROM (
  SELECT id
  FROM users
  WHERE is_admin = 1
  ORDER BY id ASC
  LIMIT 1
) AS bootstrap_user
JOIN roles super_role ON super_role.role_code = 'super_admin'
WHERE NOT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.role_code = 'super_admin'
)
ON DUPLICATE KEY UPDATE assigned_at = assigned_at;

-- If no admin user exists yet, fallback to first user as Super Admin
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT bootstrap_user.id, super_role.id, NULL
FROM (
  SELECT id
  FROM users
  ORDER BY id ASC
  LIMIT 1
) AS bootstrap_user
JOIN roles super_role ON super_role.role_code = 'super_admin'
WHERE NOT EXISTS (
  SELECT 1
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.role_code = 'super_admin'
)
ON DUPLICATE KEY UPDATE assigned_at = assigned_at;

-- Keep legacy users.is_admin aligned with admin-role membership
UPDATE users u
SET u.is_admin = CASE
  WHEN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.is_admin_role = 1
  ) THEN 1
  ELSE 0
END;
