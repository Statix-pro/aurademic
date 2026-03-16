-- Migration: Simplify Budget RBAC Permission Model
-- Author: Codex
-- Date: 2026-02-18
-- Description:
--   Replaces granular budget permissions and deprecated budget_master permissions
--   with a simplified 6-permission budget RBAC model.

-- =====================================================
-- BUDGET PERMISSIONS (SIMPLIFIED MODEL)
-- =====================================================
INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES
  (
    'budget_proposal',
    'manage',
    'budget.proposal.manage',
    'Create, edit, delete, and view own budget proposals',
    1
  ),
  (
    'budget_workflow',
    'hod',
    'budget.workflow.hod',
    'View HOD queue and process HOD-stage approvals',
    1
  ),
  (
    'budget_workflow',
    'dof',
    'budget.workflow.dof',
    'View DoF queue and process DoF-stage approvals',
    1
  ),
  (
    'budget_workflow',
    'principal',
    'budget.workflow.principal',
    'View Principal queue and process Principal-stage approvals',
    1
  ),
  (
    'budget_admin',
    'view',
    'budget.admin.view',
    'View budget admin dashboards, reports, and exports',
    1
  ),
  (
    'budget_admin',
    'manage',
    'budget.admin.manage',
    'Manage budget approval configuration and entity masters',
    1
  )
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

-- =====================================================
-- ROLE -> PERMISSION DEFAULTS
-- =====================================================

-- Super Admin: all budget permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.proposal.manage',
  'budget.workflow.hod',
  'budget.workflow.dof',
  'budget.workflow.principal',
  'budget.admin.view',
  'budget.admin.manage'
)
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Admin: proposal + admin view/manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.proposal.manage',
  'budget.admin.view',
  'budget.admin.manage'
)
WHERE r.role_code = 'admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- HOD: proposal + HOD workflow
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.proposal.manage',
  'budget.workflow.hod'
)
WHERE r.role_code = 'hod'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Finance Admin: DoF workflow + admin view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.workflow.dof',
  'budget.admin.view'
)
WHERE r.role_code = 'finance_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- Principal: principal workflow + admin view/manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.workflow.principal',
  'budget.admin.view',
  'budget.admin.manage'
)
WHERE r.role_code = 'principal'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- =====================================================
-- DEPRECATE LEGACY BUDGET MASTER PERMISSIONS
-- =====================================================
DELETE rp
FROM role_permissions rp
JOIN permissions p ON p.id = rp.permission_id
WHERE p.permission_key IN (
  'budget_master.read',
  'budget_master.edit',
  'budget_master.manage'
);

DELETE FROM permissions
WHERE permission_key IN (
  'budget_master.read',
  'budget_master.edit',
  'budget_master.manage'
);
