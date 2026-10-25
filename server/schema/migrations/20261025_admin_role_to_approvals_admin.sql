-- ==================================================================
-- Migration: The Admin role becomes Approvals Admin, without Access Control
-- Author: Maheshwaran A K
-- Date: 2026-10-25
--
-- "Admin" read as the same thing as "admin area", which every role with
-- is_admin_role = 1 opens (Chairman, HOD, Coordinator, Principal, Finance
-- Admin, IT Head), and as a lesser copy of Super Admin. In production it is
-- neither: its one active holder clears first-level finance and expenditure
-- approvals across every department (75 workflow actions in the 2026-09-13
-- dump) and has never assigned a role (0 of the user_roles rows carry their
-- id as assigned_by). So the name now says what it does, and it loses
-- Access Control, which it never used and which let it hand out roles.
--
-- 1. Display name and description only. role_code stays 'admin', so every
--    server check on the code (workflowScopeResolver, expenditureController,
--    expenditureReportModel, budget scopes) and every user_roles row is
--    untouched. Matches 'Research Admin' too, a name this migration carried
--    before it was settled; a name changed by hand to anything else is left.
-- 2. Removes access_control.read and access_control.manage from the role.
--    The Access Control menu entry and route follow access_control.manage,
--    so the screen becomes Super Admin only. Nothing at startup re-grants
--    them (only the base `user` role is seeded with permissions).
--
-- Idempotent: a second run matches no rows.
-- ==================================================================

START TRANSACTION;

UPDATE `roles`
SET
  `role_name` = 'Approvals Admin',
  `description` = 'Approves requests across every department; cannot change access or system settings'
WHERE `role_code` = 'admin'
  AND `role_name` IN ('Admin', 'Research Admin');

DELETE rp
FROM `role_permissions` rp
JOIN `roles` r ON r.id = rp.role_id
JOIN `permissions` p ON p.id = rp.permission_id
WHERE r.role_code = 'admin'
  AND p.permission_key IN ('access_control.read', 'access_control.manage');

COMMIT;

-- ==================================================================
-- ROLLBACK (kept commented for reference)
-- ==================================================================
-- START TRANSACTION;
-- UPDATE `roles`
-- SET `role_name` = 'Admin',
--     `description` = 'Standard admin access for current dashboard workflows'
-- WHERE `role_code` = 'admin' AND `role_name` = 'Approvals Admin';
-- INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
-- SELECT r.id, p.id
-- FROM `roles` r
-- JOIN `permissions` p ON p.permission_key IN ('access_control.read', 'access_control.manage')
-- WHERE r.role_code = 'admin';
-- COMMIT;
