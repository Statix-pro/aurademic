-- ============================================
-- Migration: Directory Admin role
-- Author: Maheshwaran A K
-- Date: 2026-10-24
-- ============================================

-- Description:
-- Directory submissions run a one-stage workflow (`directory_admin`). The workflow
-- engine notifies, and lets act, whoever holds `<module>.workflow.<stage>`, but no
-- role held those keys, so every submission and resubmission notified nobody and only
-- super admins could approve. This adds a non-admin `directory_admin` role that holds
-- both stage keys plus the directory.* keys. Assign it from Access Control to whoever
-- handles the directory; super admins can hold it too if they want the notifications.
--
-- is_admin_role = 0 on purpose: an admin role opens the whole /api/admin surface.
-- Idempotent: every insert is keyed on a unique code and re-running changes nothing.

INSERT INTO `roles` (`role_code`, `role_name`, `description`, `is_system`, `is_admin_role`)
VALUES (
  'directory_admin',
  'Directory Admin',
  'Reviews organization and resource-person directory submissions',
  1,
  0
)
ON DUPLICATE KEY UPDATE `role_code` = `role_code`;

INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('organization_directory_workflow', 'directory_admin', 'organization_directory.workflow.directory_admin',
   'Approve or reject organization directory submissions', 1),
  ('resource_person_directory_workflow', 'directory_admin', 'resource_person_directory.workflow.directory_admin',
   'Approve or reject resource-person directory submissions', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p
  ON p.permission_key IN (
    'organization_directory.workflow.directory_admin',
    'resource_person_directory.workflow.directory_admin',
    'directory.read',
    'directory.create',
    'directory.edit'
  )
WHERE r.role_code = 'directory_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- ============================================
-- ROLLBACK (kept commented for reference)
-- ============================================
-- DELETE rp FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.role_code = 'directory_admin';
-- DELETE FROM user_roles WHERE role_id = (SELECT id FROM roles WHERE role_code = 'directory_admin');
-- DELETE FROM roles WHERE role_code = 'directory_admin';
-- DELETE FROM permissions WHERE permission_key IN (
--   'organization_directory.workflow.directory_admin',
--   'resource_person_directory.workflow.directory_admin'
-- );
