-- ============================================================
-- Migration: Create and reconcile Guest House booking module
-- Date: 2026-09-25
-- ============================================================

-- Description:
-- Creates/reconciles the guesthouse_* tables backing client/src/features/guesthouse
-- (booking form, PR #53) and the admin approval dashboard, plus the
-- workflow/RBAC rows the frontend already expects.
--
-- Fixes applied vs. the originally supplied guesthouse_schema.sql:
--   1. `beneficiary_type` changed from ENUM('Staff','Faculty','Institution')
--      to VARCHAR(100), matching the `budget_proposals.beneficiary_type`
--      convention. The booking form's BENEFICIARY_TYPE_OPTIONS
--      (GuestHouseBooking.tsx) offers 'Faculty', 'Staff', 'Department',
--      'Centre', 'Cell', 'Club', 'Section', 'Professional Body' -- an
--      ENUM restricted to 3 values would reject/truncate every other
--      option under strict SQL mode.
--   2. Added `role_permissions` grants. The original schema created the
--      `guesthouse_admin` role and the guesthouse.* permissions but never
--      linked them, so nobody except super admins (who bypass permission
--      checks in authMiddleware.js) could read, create, or approve a
--      booking. Grants below mirror the pattern already used for the
--      finance/expenditure/budget modules.

-- ============================================================
-- 1. Main booking table
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_bookings` (
  `id` INT NOT NULL AUTO_INCREMENT,

  `employee_id` INT DEFAULT NULL,
  `applicant_name` VARCHAR(255) DEFAULT NULL,
  `applicant_erp_id` VARCHAR(50) DEFAULT NULL,
  `department` VARCHAR(255) DEFAULT NULL,
  `department_id` INT DEFAULT NULL,
  `designation` VARCHAR(150) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `request_date` DATE NOT NULL,

  -- FIX: was ENUM('Staff','Faculty','Institution'); the booking form also
  -- allows Department/Centre/Cell/Club/Section/Professional Body values.
  `beneficiary_type` VARCHAR(100) DEFAULT NULL COMMENT 'Faculty, Staff, Department, Centre, Cell, Club, Section, Professional Body, etc.',
  `beneficiary_value` VARCHAR(255) DEFAULT NULL,
  `budget_tag` VARCHAR(100) DEFAULT NULL,

  `check_in_date` DATE DEFAULT NULL,
  `check_in_time` VARCHAR(20) DEFAULT NULL,
  `check_out_date` DATE DEFAULT NULL,
  `check_out_time` VARCHAR(20) DEFAULT NULL,
  `number_of_days` INT DEFAULT NULL,
  `duration_label` VARCHAR(100) DEFAULT NULL,

  `created_by` INT DEFAULT NULL,
  `overall_status` ENUM('pending','approved','rejected','archived') DEFAULT 'pending',

  `workflow_state` JSON DEFAULT NULL,
  `workflow_status` VARCHAR(32) GENERATED ALWAYS AS (
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`workflow_state`, '$.status')), 'in_progress')
  ) STORED,
  `workflow_stage` VARCHAR(64) GENERATED ALWAYS AS (
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`workflow_state`, '$.currentStage')), '')
  ) STORED,
  `principal_document` JSON DEFAULT NULL,

  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_guesthouse_bookings_created_by` (`created_by`),
  KEY `idx_guesthouse_bookings_employee` (`employee_id`),
  KEY `idx_guesthouse_bookings_department` (`department_id`),
  KEY `idx_guesthouse_bookings_request_date` (`request_date`),
  KEY `idx_guesthouse_bookings_status` (`overall_status`),
  KEY `idx_guesthouse_bookings_budget_tag` (`budget_tag`),
  KEY `idx_guesthouse_bookings_workflow_status` (`workflow_status`),
  KEY `idx_guesthouse_bookings_workflow_stage` (`workflow_stage`),
  KEY `idx_guesthouse_bookings_stage_status` (`workflow_stage`,`workflow_status`),
  CONSTRAINT `fk_guesthouse_bookings_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_guesthouse_bookings_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_guesthouse_bookings_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Guests (one booking -> many guests)
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_guests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `booking_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `gender` ENUM('Male','Female','Others') DEFAULT NULL,
  `priority` ENUM('Routine','High') DEFAULT 'Routine',
  `designation` VARCHAR(150) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `organization` VARCHAR(255) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(100) DEFAULT NULL,
  `accompanied_male` INT DEFAULT 0,
  `accompanied_female` INT DEFAULT 0,
  `accompanied_children` INT DEFAULT 0,
  `food_veg` INT DEFAULT 0,
  `food_nonveg` INT DEFAULT 0,
  `remarks` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guesthouse_guests_booking` (`booking_id`),
  KEY `idx_guesthouse_guests_sort` (`booking_id`,`sort_order`),
  CONSTRAINT `fk_guesthouse_guests_booking` FOREIGN KEY (`booking_id`) REFERENCES `guesthouse_bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Room type requested per guest
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_guest_room_requests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `guest_id` INT NOT NULL,
  `room_type` ENUM('Single','Double','Deluxe') NOT NULL,
  `requested_count` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guesthouse_guest_room_request_type` (`guest_id`,`room_type`),
  KEY `idx_guesthouse_guest_room_requests_guest` (`guest_id`),
  CONSTRAINT `fk_guesthouse_guest_room_requests_guest` FOREIGN KEY (`guest_id`) REFERENCES `guesthouse_guests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Per-day food requirements
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_food_requirements` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `booking_id` INT NOT NULL,
  `req_date` DATE NOT NULL,
  `morning_refreshment` INT DEFAULT 0,
  `breakfast_veg` INT DEFAULT 0,
  `breakfast_nonveg` INT DEFAULT 0,
  `lunch_veg` INT DEFAULT 0,
  `lunch_nonveg` INT DEFAULT 0,
  `evening_refreshment` INT DEFAULT 0,
  `dinner_veg` INT DEFAULT 0,
  `dinner_nonveg` INT DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guesthouse_food_booking_date` (`booking_id`,`req_date`),
  KEY `idx_guesthouse_food_date` (`req_date`),
  CONSTRAINT `fk_guesthouse_food_booking` FOREIGN KEY (`booking_id`) REFERENCES `guesthouse_bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. Master data: managed rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_rooms` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `room_type` ENUM('Single','Double','Deluxe') NOT NULL,
  `block` VARCHAR(50) NOT NULL,
  `floor` VARCHAR(50) DEFAULT NULL,
  `room_number` VARCHAR(50) NOT NULL,
  `status` ENUM('Active','Maintenance') NOT NULL DEFAULT 'Active',
  `facilities` JSON DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guesthouse_room_block_number` (`block`,`room_number`),
  KEY `idx_guesthouse_rooms_status` (`status`),
  KEY `idx_guesthouse_rooms_type` (`room_type`),
  CONSTRAINT `fk_guesthouse_rooms_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Master data: care takers
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_caretakers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `status` ENUM('Active','Leave') NOT NULL DEFAULT 'Active',
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guesthouse_caretaker_name_mobile` (`name`,`mobile`),
  KEY `idx_guesthouse_caretakers_status` (`status`),
  CONSTRAINT `fk_guesthouse_caretakers_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. Room allotment header (one per guest per booking)
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_room_allotments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `booking_id` INT NOT NULL,
  `guest_id` INT NOT NULL,
  `caretaker_id` INT DEFAULT NULL,
  `spoc` VARCHAR(255) DEFAULT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `amenities` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_guesthouse_allotment_booking_guest` (`booking_id`,`guest_id`),
  KEY `idx_guesthouse_allotment_guest` (`guest_id`),
  KEY `idx_guesthouse_allotment_caretaker` (`caretaker_id`),
  CONSTRAINT `fk_guesthouse_allotment_booking` FOREIGN KEY (`booking_id`) REFERENCES `guesthouse_bookings` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_guesthouse_allotment_guest` FOREIGN KEY (`guest_id`) REFERENCES `guesthouse_guests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_guesthouse_allotment_caretaker` FOREIGN KEY (`caretaker_id`) REFERENCES `guesthouse_caretakers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. Individual room rows under an allotment
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_room_allotment_rows` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `allotment_id` INT NOT NULL,
  `room_id` INT DEFAULT NULL,
  `room_type` ENUM('Single','Double','Deluxe') NOT NULL,
  `block` VARCHAR(50) DEFAULT NULL,
  `room_number` VARCHAR(50) DEFAULT NULL,
  `remarks` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guesthouse_allotment_rows_allotment` (`allotment_id`),
  KEY `idx_guesthouse_allotment_rows_room` (`room_id`),
  CONSTRAINT `fk_guesthouse_allotment_rows_allotment` FOREIGN KEY (`allotment_id`) REFERENCES `guesthouse_room_allotments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_guesthouse_allotment_rows_room` FOREIGN KEY (`room_id`) REFERENCES `guesthouse_rooms` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. Named occupants per room
-- ============================================================
CREATE TABLE IF NOT EXISTS `guesthouse_room_allotment_row_occupants` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `allotment_row_id` INT NOT NULL,
  `occupant_name` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_guesthouse_allotment_row_occupants_row` (`allotment_row_id`),
  CONSTRAINT `fk_guesthouse_allotment_row_occupants_row` FOREIGN KEY (`allotment_row_id`) REFERENCES `guesthouse_room_allotment_rows` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. Approval workflow registration
-- ============================================================
-- IMPORTANT: `uq_approval_flow` is (beneficiary_type, entity_type_code,
-- module_key) and entity_type_code is NULL here. MySQL treats NULLs as
-- DISTINCT in a UNIQUE index, so ON DUPLICATE KEY UPDATE NEVER fires for
-- these rows and a re-run silently appends a duplicate. That has already
-- happened in production: approval_flow_config holds three identical
-- ('*', NULL, 'finance') rows (ids 8, 9, 10). Use explicit
-- UPDATE-then-INSERT-if-absent, which is genuinely idempotent.
--
-- 20260804_dedupe_approval_flow_config.sql adds a NULL-safe unique index that
-- makes plain ON DUPLICATE KEY UPDATE correct again. This block stays valid
-- either way, so the two migrations have no ordering dependency.
UPDATE `approval_flow_config`
SET `flow` = '["hod", "guesthouse_incharge", "principal", "guesthouse_admin"]', `is_active` = 1
WHERE `module_key` = 'guesthouse'
  AND `beneficiary_type` = '*'
  AND `entity_type_code` IS NULL;

INSERT INTO `approval_flow_config` (`beneficiary_type`, `entity_type_code`, `flow`, `module_key`, `is_active`)
SELECT '*', NULL, '["hod", "guesthouse_incharge", "principal", "guesthouse_admin"]', 'guesthouse', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `approval_flow_config` afc
  WHERE afc.`module_key` = 'guesthouse'
    AND afc.`beneficiary_type` = '*'
    AND afc.`entity_type_code` IS NULL
);

INSERT INTO `workflow_stage_policies` (`module_key`, `stage_key`, `scope_type`, `meta`, `is_active`)
VALUES
  ('guesthouse', 'hod', 'department', '{"requireAssignment": false, "assignmentRoleCodes": ["hod"]}', 1),
  ('guesthouse', 'guesthouse_incharge', 'global', NULL, 1),
  ('guesthouse', 'principal', 'global', NULL, 1),
  ('guesthouse', 'guesthouse_admin', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE `scope_type` = VALUES(`scope_type`), `meta` = VALUES(`meta`), `is_active` = 1;

-- ============================================================
-- 11. Role + permissions
-- ============================================================
INSERT INTO `roles` (`role_code`, `role_name`, `description`, `is_system`, `is_admin_role`)
VALUES ('guesthouse_admin', 'Guest House Admin', 'Final-stage approver and master-data manager for Guest House bookings', 1, 1)
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`), `description` = VALUES(`description`);

INSERT INTO `roles` (`role_code`, `role_name`, `description`, `is_system`, `is_admin_role`)
VALUES ('guesthouse_incharge', 'Guesthouse Incharge', 'Reviews guesthouse requests after HOD approval', 0, 1)
ON DUPLICATE KEY UPDATE `role_name` = VALUES(`role_name`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('guesthouse', 'read', 'guesthouse.read', 'View guest house bookings', 1),
  ('guesthouse', 'edit', 'guesthouse.edit', 'Create and edit guest house bookings', 1),
  ('guesthouse', 'manage', 'guesthouse.manage', 'Manage guest house master data (rooms, care takers)', 1),
  ('guesthouse_workflow', 'hod', 'guesthouse.workflow.hod', 'Process guest house HOD-stage approvals', 1),
  ('guesthouse_workflow', 'guesthouse_incharge', 'guesthouse.workflow.guesthouse_incharge', 'Process Guesthouse Incharge-stage approvals', 1),
  ('guesthouse_workflow', 'principal', 'guesthouse.workflow.principal', 'Process guest house Principal-stage approvals', 1),
  ('guesthouse_workflow', 'guesthouse_admin', 'guesthouse.workflow.guesthouse_admin', 'Process guest house Admin-stage approvals', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- FIX: the original schema created the role and permissions above but never
-- granted them via role_permissions, so HOD/Incharge/Principal/Admin users
-- (anyone who isn't a super admin, which bypasses permission checks in
-- authMiddleware.js) could not read, submit, or approve a booking.
--
-- - `user` (role_code 'user') is the base role granted to every authenticated
--   account; GuestHouseBooking's /guesthouse/new and /guesthouse-dashboard
--   routes are gated only by the generic ProtectedRoute (any logged-in user),
--   so guesthouse.read/edit must be broadly granted the same way
--   budget_proposal.manage is.
-- - `admin` gets guesthouse.manage, matching how it holds *_admin.manage for
--   budget/access_control without holding workflow-stage permissions.
-- - The approval path is HOD -> Guesthouse Incharge -> Principal -> Admin.
-- - `guesthouse_admin` (the role created above) gets full module access:
--   read/edit/manage plus its own workflow stage and workflow-manage.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN (
  'guesthouse.read', 'guesthouse.edit', 'guesthouse.manage',
  'guesthouse.workflow.hod', 'guesthouse.workflow.guesthouse_incharge',
  'guesthouse.workflow.principal',
  'guesthouse.workflow.guesthouse_admin'
)
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key = 'guesthouse.manage'
WHERE r.role_code = 'admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('guesthouse.read', 'guesthouse.edit')
WHERE r.role_code = 'user'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key = 'guesthouse.workflow.hod'
WHERE r.role_code = 'hod'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key = 'guesthouse.workflow.guesthouse_incharge'
WHERE r.role_code = 'guesthouse_incharge'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key = 'guesthouse.workflow.principal'
WHERE r.role_code = 'principal'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN (
  'guesthouse.read', 'guesthouse.edit', 'guesthouse.manage',
  'guesthouse.workflow.guesthouse_admin'
)
WHERE r.role_code = 'guesthouse_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- ============================================================
-- 12. Enriched read view
-- ============================================================
CREATE OR REPLACE VIEW `v_guesthouse_bookings` AS
SELECT
  gb.id,
  gb.employee_id,
  gb.created_by,
  COALESCE(
    CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')),
    gb.applicant_name
  ) AS applicant_name,
  COALESCE(e.erp_id, gb.applicant_erp_id) AS applicant_erp_id,
  COALESCE(e.designation, gb.designation) AS designation,
  COALESCE(d.name, gb.department) AS department,
  COALESCE(e.email, gb.email) AS email,
  COALESCE(e.mobile, gb.mobile) AS mobile,
  CASE WHEN gb.employee_id IS NULL THEN 1 ELSE 0 END AS is_external,
  gb.request_date,
  gb.beneficiary_type,
  gb.beneficiary_value,
  gb.budget_tag,
  gb.check_in_date,
  gb.check_in_time,
  gb.check_out_date,
  gb.check_out_time,
  gb.number_of_days,
  gb.duration_label,
  gb.overall_status,
  gb.workflow_status,
  gb.workflow_stage,
  gb.created_at,
  gb.updated_at
FROM guesthouse_bookings gb
LEFT JOIN master_employees e ON gb.employee_id = e.id
LEFT JOIN master_departments d ON gb.department_id = d.id;

-- ============================================================
-- 13. Guest House workflow audit and department reconciliation
-- ============================================================
-- Keep the shared workflow audit enum compatible with the guesthouse archive
-- and unarchive actions. This is safe to rerun on existing installations.
ALTER TABLE `workflow_actions`
MODIFY COLUMN `decision` ENUM(
  'approved', 'rejected', 'returned', 'archived', 'unarchived', 'deleted', 'resubmitted'
) NOT NULL;

-- Backfill department IDs so HOD scoping uses the canonical department FK.
-- Only exact, unambiguous matches are selected; reruns only repair missing or
-- stale IDs and leave unmatched bookings unchanged.
UPDATE `guesthouse_bookings` AS gb
JOIN (
  SELECT LOWER(TRIM(name)) AS normalized_name, MIN(id) AS department_id
  FROM `master_departments`
  WHERE is_active = 1
  GROUP BY LOWER(TRIM(name))
  HAVING COUNT(*) = 1
) AS unique_departments
  ON unique_departments.normalized_name = LOWER(TRIM(
    CASE
      WHEN LOWER(TRIM(gb.beneficiary_type)) = 'department'
        THEN gb.beneficiary_value
      ELSE gb.department
    END
  ))
SET gb.department_id = unique_departments.department_id
WHERE gb.department_id IS NULL
   OR gb.department_id <> unique_departments.department_id;

-- ============================================================
-- ROLLBACK (keep commented; use if you need to undo)
-- ============================================================
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module_key IN ('guesthouse', 'guesthouse_workflow'));
-- DELETE FROM permissions WHERE module_key IN ('guesthouse', 'guesthouse_workflow');
-- DELETE FROM roles WHERE role_code = 'guesthouse_admin';
-- DELETE FROM workflow_stage_policies WHERE module_key = 'guesthouse';
-- DELETE FROM approval_flow_config WHERE module_key = 'guesthouse';
-- DROP VIEW IF EXISTS `v_guesthouse_bookings`;
-- DROP TABLE IF EXISTS `guesthouse_room_allotment_row_occupants`;
-- DROP TABLE IF EXISTS `guesthouse_room_allotment_rows`;
-- DROP TABLE IF EXISTS `guesthouse_room_allotments`;
-- DROP TABLE IF EXISTS `guesthouse_caretakers`;
-- DROP TABLE IF EXISTS `guesthouse_rooms`;
-- DROP TABLE IF EXISTS `guesthouse_food_requirements`;
-- DROP TABLE IF EXISTS `guesthouse_guest_room_requests`;
-- DROP TABLE IF EXISTS `guesthouse_guests`;
-- DROP TABLE IF EXISTS `guesthouse_bookings`;
