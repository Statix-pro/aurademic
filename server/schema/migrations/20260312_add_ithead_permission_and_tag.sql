-- Migration: Add IT Head workflow permission and IT budget tag
-- Date: 2026-03-12
-- Purpose:
--   1) Insert the `budget.workflow.ithead` permission for the IT Head approval stage
--   2) Create an `it_head` role and assign the ithead permission
--   3) Grant super_admin the new permission
--   4) Insert the "IT" tag into budget_tags

-- =====================================================
-- 1. IT HEAD PERMISSION
-- =====================================================
INSERT INTO permissions (module_key, action_key, permission_key, description, is_system)
VALUES (
  'budget_workflow',
  'ithead',
  'budget.workflow.ithead',
  'View IT Head queue and process IT Head-stage approvals',
  1
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  is_system = VALUES(is_system);

-- =====================================================
-- 2. IT HEAD ROLE
-- =====================================================
INSERT INTO roles (role_code, role_name, description)
VALUES (
  'it_head',
  'IT Head',
  'Head of IT Department – approves IT-tagged budget proposals'
)
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  description = VALUES(description);

-- =====================================================
-- 3. ROLE -> PERMISSION GRANTS
-- =====================================================

-- Super Admin: grant IT Head permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key = 'budget.workflow.ithead'
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- IT Head role: proposal manage + ithead workflow
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.permission_key IN (
  'budget.proposal.manage',
  'budget.workflow.ithead'
)
WHERE r.role_code = 'it_head'
ON DUPLICATE KEY UPDATE granted_at = granted_at;

-- =====================================================
-- 4. IT BUDGET TAG
-- =====================================================
INSERT IGNORE INTO budget_tags (tag_name, is_active, sort_order)
VALUES ('IT', 1, 5);
