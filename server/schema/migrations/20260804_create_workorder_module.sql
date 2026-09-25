-- schema/migrations/20260804_create_workorder_module.sql
-- Date: 2026-08-04
-- Description: Full schema for the Work Order module - catalog tables
--              (categories/types/subtypes, pre-seeded from the WorkOrder.tsx
--              WORK_CATALOG), the work_orders / work_order_items tables, and
--              the workflow_state column used by the shared workflow engine
--              (shared/workflow/workflowService.js) to drive the
--              level1 -> dof -> principal approval flow.
--
-- Reviewed against PR #54 (client/src/features/workorder/WorkOrder.tsx and
-- user-dashboard/workorderdashboard/WorkOrderDashboard.tsx). Corrections vs.
-- the originally supplied 20260711_create_workorder_tables.sql:
--
--   1. Added `wo_number` (UNIQUE) to work_orders. WorkOrderDashboard.tsx
--      declares and renders `wo_number` (card title, search index) and only
--      falls back to formatLegacyWorkOrderId() when it is absent. The column
--      did not exist, so every card would have shown a synthesized id.
--      Added `code` + `sort_order` to work_order_categories so the backend
--      can generate the documented YY + category-code + 4-digit-sequence
--      format (e.g. '26CA0001') without hardcoding the map server-side.
--   2. Added generated `workflow_status` / `workflow_stage` STORED columns
--      plus indexes. The original comment claimed finance_requests reads
--      these via query-time JSON_EXTRACT with "no generated columns needed"
--      -- that is incorrect: finance_requests HAS both as STORED generated
--      columns with three supporting indexes, and the dashboard reads
--      `workflow_status` as a response field.
--   3. Added the per-item dashboard columns written by
--      PATCH /workorders/items/:itemId/dashboard -- `status`,
--      `assigned_to`, `assigned_to_role`, `reminder_date`. None existed,
--      so the only field the dashboard actually persists had nowhere to go.
--   4. Replaced the single `photo_path VARCHAR(255)` with a
--      work_order_item_photos child table. `locationPhotos` is an ARRAY per
--      item on both the create payload and the read path (multiple uploads
--      per item, each a separate POST /workorders/upload).
--   5. Made `work_order_items.type_id` NOT NULL. It was nullable with
--      ON DELETE SET NULL while `sub_type_id` was NOT NULL / RESTRICT --
--      but a subtype belongs to a type, so a NULL type_id alongside a
--      non-NULL sub_type_id is an unreachable, self-contradictory state.
--   6. Registered the module in approval_flow_config and
--      workflow_stage_policies. The header comment promised a
--      level1 -> dof -> principal flow but nothing registered it, so
--      workflowService.js would throw "Workflow module not registered".
--   7. Added the roles/permissions/role_permissions rows for work_order.*.
--      ability.ts maps work_order.read/edit/create/manage but none of those
--      permission keys existed in the DB, so no non-super-admin could
--      create or edit a work order.
--   8. Added `idx_work_orders_budget_tag` to match finance_requests, which
--      indexes budget_tag for the same dashboard filter pattern.
--
-- NOTE (frontend, not fixed here): WorkOrderDashboard's WorkOrderPriority
-- type allows 'High'|'Medium'|'Low'|'Routine' and normalizePriority()
-- defaults unrecognized values to 'Medium', but the form only ever produces
-- 'Routine'|'High'. The ENUM below matches what is actually submitted;
-- widening it would encode dead values. Reconcile in the client.

-- =====================================================
-- 1. CATALOG TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS `work_order_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  -- Short code used to build wo_number (LEGACY_CATEGORY_CODE_MAP in
  -- WorkOrderDashboard.tsx). Kept here so the format lives in one place.
  `code` VARCHAR(10) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_category_name` (`name`),
  UNIQUE KEY `uniq_category_code` (`code`),
  KEY `idx_categories_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_order_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `category_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_type_per_category` (`category_id`, `name`),
  KEY `idx_types_category` (`category_id`),
  CONSTRAINT `fk_types_category` FOREIGN KEY (`category_id`) REFERENCES `work_order_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_order_subtypes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `type_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_subtype_per_type` (`type_id`, `name`),
  KEY `idx_subtypes_type` (`type_id`),
  CONSTRAINT `fk_subtypes_type` FOREIGN KEY (`type_id`) REFERENCES `work_order_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. WORK ORDER TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS `work_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  -- Human-facing reference, format YY + category code + 4-digit sequence
  -- (e.g. '26CA0001'). Read and displayed by WorkOrderDashboard.tsx.
  `wo_number` VARCHAR(32) DEFAULT NULL,
  `employee_id` INT DEFAULT NULL,
  `applicant_name` VARCHAR(255) NOT NULL,
  `department` VARCHAR(255) DEFAULT NULL,
  `department_id` INT DEFAULT NULL,
  `designation` VARCHAR(150) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `mobile` VARCHAR(20) DEFAULT NULL,
  `request_date` DATE NOT NULL,
  `beneficiary_type` VARCHAR(64) DEFAULT NULL,
  `beneficiary_value` VARCHAR(255) DEFAULT NULL,
  `beneficiary_employee_id` INT DEFAULT NULL,
  `beneficiary_entity_id` INT DEFAULT NULL,
  `budget_tag` VARCHAR(100) DEFAULT NULL,
  `category_id` INT NOT NULL,
  `created_by` INT DEFAULT NULL,
  `overall_status` ENUM('pending','approved','rejected','archived','deleted') NOT NULL DEFAULT 'pending',
  -- Drives the shared workflow engine (level1 -> incharge -> principal -> workorder_admin).
  -- FIX: finance_requests exposes status/stage as STORED generated columns
  -- with indexes (not query-time JSON_EXTRACT as the original comment
  -- claimed); the queue/KPI filters and WorkOrderDashboard's `workflow_status`
  -- field both depend on them.
  `workflow_state` JSON DEFAULT NULL,
  `workflow_status` VARCHAR(32) GENERATED ALWAYS AS (
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`workflow_state`, '$.status')), 'in_progress')
  ) STORED,
  `workflow_stage` VARCHAR(64) GENERATED ALWAYS AS (
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`workflow_state`, '$.currentStage')), '')
  ) STORED,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_work_orders_wo_number` (`wo_number`),
  KEY `idx_work_orders_employee` (`employee_id`),
  KEY `idx_work_orders_department_id` (`department_id`),
  KEY `idx_work_orders_created_by` (`created_by`),
  KEY `idx_work_orders_category` (`category_id`),
  KEY `idx_work_orders_beneficiary_type` (`beneficiary_type`),
  KEY `idx_work_orders_beneficiary_employee` (`beneficiary_employee_id`),
  KEY `idx_work_orders_beneficiary_entity` (`beneficiary_entity_id`),
  KEY `idx_work_orders_status` (`overall_status`),
  KEY `idx_work_orders_request_date` (`request_date`),
  KEY `idx_work_orders_budget_tag` (`budget_tag`),
  KEY `idx_work_orders_workflow_status` (`workflow_status`),
  KEY `idx_work_orders_workflow_stage` (`workflow_stage`),
  KEY `idx_work_orders_workflow_stage_status` (`workflow_stage`,`workflow_status`),
  CONSTRAINT `fk_work_orders_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_work_orders_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_work_orders_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_work_orders_category` FOREIGN KEY (`category_id`) REFERENCES `work_order_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_work_orders_beneficiary_employee` FOREIGN KEY (`beneficiary_employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_work_orders_beneficiary_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `work_order_id` INT NOT NULL,
  -- FIX: was nullable with ON DELETE SET NULL. A subtype belongs to a type,
  -- so NULL type_id + NOT NULL sub_type_id is a contradictory state.
  `type_id` INT NOT NULL,
  `sub_type_id` INT NOT NULL,
  `item_index` INT NOT NULL DEFAULT 0,
  -- Free-text location. BLOCKS/FLOORS are hardcoded client-side with no
  -- API behind them, so these stay strings rather than FKs to a master.
  `block` VARCHAR(100) DEFAULT NULL,
  `floor` VARCHAR(100) DEFAULT NULL,
  `room_lab_no` VARCHAR(100) DEFAULT NULL,
  `description` TEXT,
  `target_date` DATE DEFAULT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `priority` ENUM('Routine','High') NOT NULL DEFAULT 'Routine',

  -- Per-item execution state, written by
  -- PATCH /workorders/items/:itemId/dashboard. Distinct from the header's
  -- overall_status/workflow_state: approval happens on the work order,
  -- fulfilment is tracked per item.
  `status` ENUM('Pending','Assigned','Procurement','On Hold','Completed') NOT NULL DEFAULT 'Pending',
  `assigned_to` VARCHAR(255) DEFAULT NULL,
  `assigned_to_role` VARCHAR(100) DEFAULT NULL,
  `reminder_date` DATE DEFAULT NULL,

  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_work_order_items_work_order` (`work_order_id`),
  KEY `idx_work_order_items_type` (`type_id`),
  KEY `idx_work_order_items_sub_type` (`sub_type_id`),
  KEY `idx_work_order_items_priority` (`priority`),
  KEY `idx_work_order_items_status` (`status`),
  KEY `idx_work_order_items_reminder_date` (`reminder_date`),
  KEY `idx_work_order_items_order_index` (`work_order_id`,`item_index`),
  CONSTRAINT `fk_work_order_items_work_order` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_work_order_items_type` FOREIGN KEY (`type_id`) REFERENCES `work_order_types` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_work_order_items_sub_type` FOREIGN KEY (`sub_type_id`) REFERENCES `work_order_subtypes` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FIX: replaces the single `photo_path VARCHAR(255)` column. WorkOrder.tsx
-- uploads N images per item (one POST /workorders/upload each, field name
-- `file`, max 5 MB, image/* only) and collects the returned URLs into the
-- item's `locationPhotos` array. Column set follows the finance_requests
-- annexure_* convention so filename/mime/size survive the round trip -- the
-- UI currently falls back to the literal 'Uploaded photo' precisely because
-- no original name comes back from the server.
CREATE TABLE IF NOT EXISTS `work_order_item_photos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `work_order_item_id` INT NOT NULL,
  `file_name` VARCHAR(255) DEFAULT NULL COMMENT 'Original client filename',
  `storage_name` VARCHAR(255) DEFAULT NULL COMMENT 'Name on disk under uploads/',
  `file_path` VARCHAR(512) NOT NULL COMMENT 'Public URL returned as locationPhotos[]',
  `mime_type` VARCHAR(100) DEFAULT NULL,
  `file_size` INT DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `uploaded_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_work_order_item_photos_item` (`work_order_item_id`),
  KEY `idx_work_order_item_photos_sort` (`work_order_item_id`,`sort_order`),
  CONSTRAINT `fk_work_order_item_photos_item` FOREIGN KEY (`work_order_item_id`) REFERENCES `work_order_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_work_order_item_photos_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. CATALOG SEED DATA (from WorkOrder.tsx: CATEGORIES / WORK_TYPES / WORK_CATALOG)
-- =====================================================

-- 3a. Categories. `code` values come from LEGACY_CATEGORY_CODE_MAP in
-- WorkOrderDashboard.tsx and feed wo_number generation. sort_order follows
-- the CATEGORIES array (alphabetical), not the differently-ordered
-- CATEGORIES_TABS array used for the dashboard tab strip.
INSERT INTO `work_order_categories` (`name`, `code`, `sort_order`, `is_active`) VALUES
  ('Carpentry',         'CA',  1, 1),
  ('Civil',             'CI',  2, 1),
  ('Electrical',        'EL',  3, 1),
  ('Gardening',         'GA',  4, 1),
  ('HVAC',              'AC',  5, 1),
  ('Interior',          'IN',  6, 1),
  ('IT Infrastructure', 'IT',  7, 1),
  ('Labour',            'LA',  8, 1),
  ('Metal Works',       'MW1', 9, 1),
  ('Painting',          'PA', 10, 1),
  ('Plumbing',          'PL', 11, 1),
  ('UPS',               'UP', 12, 1)
ON DUPLICATE KEY UPDATE
  `code` = VALUES(`code`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

-- 3b. Types (same 6 work types under every category).
-- The original wrote `JOIN (...) t ON woc.name IN (<all 12 category names>)`,
-- an unconditional cross join spelled as a filter. `ON TRUE` says that
-- directly -- and the ON clause must stay: without it the parser consumes the
-- following `ON DUPLICATE` as this join's condition and then fails on
-- `KEY UPDATE`.
INSERT INTO `work_order_types` (`category_id`, `name`, `sort_order`, `is_active`)
SELECT woc.id, t.name, t.sort_order, 1
FROM `work_order_categories` woc
JOIN (
  SELECT 'Installation' AS name, 1 AS sort_order
  UNION ALL
  SELECT 'Construction' AS name, 2 AS sort_order
  UNION ALL
  SELECT 'Replacement' AS name, 3 AS sort_order
  UNION ALL
  SELECT 'Service' AS name, 4 AS sort_order
  UNION ALL
  SELECT 'Maintenance' AS name, 5 AS sort_order
  UNION ALL
  SELECT 'Labour work' AS name, 6 AS sort_order
) t ON TRUE
ON DUPLICATE KEY UPDATE
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

-- 3c. Subtypes (category + type -> subtype list, exactly as in WORK_CATALOG)
INSERT INTO `work_order_subtypes` (`type_id`, `name`, `is_active`)
SELECT wot.id, v.name, 1
FROM `work_order_types` wot
JOIN `work_order_categories` woc ON woc.id = wot.category_id
JOIN (
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'New door installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'New window installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'Furniture assembly (desk/table)' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'Chair assembly' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'Almirah / cabinet installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'Partition panel installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Installation' AS type_name, 'Notice board / whiteboard install' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'New door installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'New window installation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'Custom wooden furniture build' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'Built-in wardrobe / shelf build' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'Lab / workshop bench build' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Construction' AS type_name, 'Reception counter construction' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Door lock replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Door hinge replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Broken glass replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Window latch replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Chair wheel / castor replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Chair cushion replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Desk drawer lock replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Replacement' AS type_name, 'Armrest replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Window latch replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Lock stuck / broken repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Door alignment repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Door stopper repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Window latch repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Drawer jam repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Service' AS type_name, 'Chair height mechanism repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Maintenance' AS type_name, 'Door alignment repair' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Maintenance' AS type_name, 'Door / window lubrication' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Maintenance' AS type_name, 'Furniture polishing' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Maintenance' AS type_name, 'Lock oiling / servicing' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Maintenance' AS type_name, 'Periodic furniture checkup' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Furniture assembly (desk/table)' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Chair assembly' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Door lock replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Door hinge replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Armrest replacement' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Furniture shifting / relocation' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Door / window fitting labour' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Furniture dismantling' AS name
  UNION ALL
  SELECT 'Carpentry' AS category_name, 'Labour work' AS type_name, 'Heavy item loading / unloading' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'New flooring (tiles / marble)' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'Carpet / mat laying' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'False ceiling installation' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'New staircase / steps' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'Pathway / walkway construction' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Installation' AS type_name, 'Parking area marking' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'New flooring (tiles / marble)' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'New staircase / steps' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Pathway / walkway construction' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Compound wall construction' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Room / building construction' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Slab / RCC work' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Brick masonry work' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Plastering work' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Roof / terrace construction' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Broken tile replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Construction' AS type_name, 'Wall crack repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Replacement' AS type_name, 'Broken tile replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Replacement' AS type_name, 'Carpet replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Replacement' AS type_name, 'False ceiling panel replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Replacement' AS type_name, 'Damaged skirting replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Replacement' AS type_name, 'Window / door frame replacement' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Wall crack repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Roof leakage repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Dampness / seepage repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Floor settlement repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Pathway / ramp repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Service' AS type_name, 'Staircase damage repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Roof leakage repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Dampness / seepage repair' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Floor cleaning & maintenance' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Wall painting (periodic)' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Terrace waterproofing maintenance' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Drainage cleaning' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Maintenance' AS type_name, 'Compound / campus maintenance' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Brick masonry work' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Plastering work' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Wall painting (periodic)' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Tile cutting / laying labour' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Plaster / putty application' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Painting labour' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Debris / material clearing' AS name
  UNION ALL
  SELECT 'Civil' AS category_name, 'Labour work' AS type_name, 'Sand / cement mixing' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'New wiring layout' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Switchboard installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Power socket installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Distribution board setup' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Earthing / grounding setup' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'UPS / inverter installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Light fixture installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Light bulb / tube installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Ceiling fan installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Exhaust fan installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Installation' AS type_name, 'Fan regulator installation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Construction' AS type_name, 'Distribution board setup' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Construction' AS type_name, 'Electrical conduit laying' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Construction' AS type_name, 'Cable tray construction' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Construction' AS type_name, 'Panel room construction' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Damaged wire replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Switch / socket replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'MCB / fuse replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Distribution board replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Light fitting replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Light bulb / tube replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'UPS battery replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Fan motor replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Ceiling fan replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Replacement' AS type_name, 'Fan regulator replacement' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Short circuit repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Power outage investigation' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Sparking / burning smell check' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Phase failure repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Stabilizer / UPS fault repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Light not working repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Light flickering repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Ceiling fan repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Exhaust fan repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Service' AS type_name, 'Fan regulator repair' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'Wiring inspection (periodic)' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'DB / panel board servicing' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'Generator periodic service' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'Earthing check' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'Light fixture maintenance' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Maintenance' AS type_name, 'Fan cleaning / maintenance' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Wire pulling / laying' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Conduit pipe fitting' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Light fixture fitting' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Cable tray fitting' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Fan fitting / shifting' AS name
  UNION ALL
  SELECT 'Electrical' AS category_name, 'Labour work' AS type_name, 'Electrical helper work' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'New garden bed setup' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'Plant sapling installation' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'Lawn grass laying' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'Irrigation pipe installation' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'Garden edging installation' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Installation' AS type_name, 'Planter box installation' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Construction' AS type_name, 'Landscape area development' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Construction' AS type_name, 'Pathway garden border construction' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Construction' AS type_name, 'Soil bed preparation' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Construction' AS type_name, 'Compost pit construction' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Construction' AS type_name, 'Garden fencing work' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Replacement' AS type_name, 'Dead plant replacement' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Replacement' AS type_name, 'Damaged planter replacement' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Replacement' AS type_name, 'Broken irrigation pipe replacement' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Replacement' AS type_name, 'Garden light fixture replacement' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Replacement' AS type_name, 'Lawn patch replacement' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Plant pruning' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Weed removal' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Pest control treatment' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Soil loosening' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Irrigation leak repair' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Service' AS type_name, 'Tree branch trimming' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Lawn mowing' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Regular watering' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Garden cleaning' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Fertilizer application' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Hedge trimming' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Maintenance' AS type_name, 'Seasonal garden maintenance' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'Soil shifting' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'Plant pot shifting' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'Garden waste clearing' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'Watering support' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'Mulch spreading' AS name
  UNION ALL
  SELECT 'Gardening' AS category_name, 'Labour work' AS type_name, 'General gardening helper work' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Split AC installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Window AC installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Cassette AC installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Water cooler installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Exhaust fan installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Ceiling fan installation' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Installation' AS type_name, 'Ventilation duct setup' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Construction' AS type_name, 'Ventilation duct setup' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Construction' AS type_name, 'AC plant room construction' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Construction' AS type_name, 'Cooling tower platform build' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'AC remote replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'AC filter replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'Compressor replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'Fan motor replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'AC PCB / board replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Replacement' AS type_name, 'Refrigerant refill' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'Fan motor replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'Refrigerant refill' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'AC not cooling repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'AC not turning on' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'AC water dripping repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'AC loud noise repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'AC error code diagnosis' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'Water cooler fault repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Service' AS type_name, 'Exhaust / ceiling fan repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC filter replacement' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC not cooling repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC water dripping repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'Water cooler fault repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'Exhaust / ceiling fan repair' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC filter cleaning' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC coil cleaning (indoor/outdoor)' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'AC periodic service' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'Water cooler cleaning' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Maintenance' AS type_name, 'Duct cleaning' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Labour work' AS type_name, 'AC unit lifting / shifting' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Labour work' AS type_name, 'Bracket / stand fabrication' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Labour work' AS type_name, 'Copper pipe bending / fitting' AS name
  UNION ALL
  SELECT 'HVAC' AS category_name, 'Labour work' AS type_name, 'Drain pipe fitting' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Wallpaper installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Wall panelling installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'False ceiling installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Curtain / blind installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Glass partition installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Acoustic panel installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Installation' AS type_name, 'Signage / name board installation' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Construction' AS type_name, 'Partition wall construction' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Construction' AS type_name, 'Reception area build' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Construction' AS type_name, 'Display unit construction' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Construction' AS type_name, 'Storage cabinet construction' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Construction' AS type_name, 'Modular workstation setup' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Wallpaper replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Ceiling tile replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Curtain / blind replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Glass panel replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Carpet / mat replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Replacement' AS type_name, 'Signage replacement' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'Wall panel repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'False ceiling repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'Curtain track repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'Glass crack repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'Acoustic panel repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Service' AS type_name, 'Interior fixture repair' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Maintenance' AS type_name, 'Interior deep cleaning' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Maintenance' AS type_name, 'Wall panel polishing' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Maintenance' AS type_name, 'Carpet shampooing' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Maintenance' AS type_name, 'Ceiling inspection' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Maintenance' AS type_name, 'Periodic interior checkup' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Labour work' AS type_name, 'Wallpaper pasting labour' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Labour work' AS type_name, 'Panel fitting labour' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Labour work' AS type_name, 'Ceiling tile fitting labour' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Labour work' AS type_name, 'Curtain fitting labour' AS name
  UNION ALL
  SELECT 'Interior' AS category_name, 'Labour work' AS type_name, 'Interior material shifting' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'New network point / LAN setup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Wi-Fi access point installation' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'CCTV camera installation' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Computer / PC setup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Printer / scanner setup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Projector / AV system install' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Server rack installation' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Installation' AS type_name, 'Intercom / PA system setup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Construction' AS type_name, 'New network point / LAN setup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Construction' AS type_name, 'Server rack installation' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Construction' AS type_name, 'Server room construction' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Construction' AS type_name, 'Network cable duct construction' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'LAN cable replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'Keyboard / mouse replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'RAM / hard disk replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'Monitor replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'Toner / ink cartridge replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'Switch / router replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Replacement' AS type_name, 'HDMI / VGA cable replacement' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'Wi-Fi connectivity repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'PC not booting / blue screen' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'PC overheating repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'Printer fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'Projector fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'CCTV fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Service' AS type_name, 'Biometric device fault' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'PC overheating repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'Printer fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'Projector fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'CCTV fault repair' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'PC / laptop cleaning & checkup' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'Network switch maintenance' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'CCTV system maintenance' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Maintenance' AS type_name, 'Server room maintenance' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Labour work' AS type_name, 'LAN cable pulling / termination' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Labour work' AS type_name, 'Cable management / dressing' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Labour work' AS type_name, 'PC shifting / relocation' AS name
  UNION ALL
  SELECT 'IT Infrastructure' AS category_name, 'Labour work' AS type_name, 'Equipment loading / unloading' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Installation' AS type_name, 'Scaffolding setup' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Installation' AS type_name, 'Temporary shed erection' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Installation' AS type_name, 'Barricade installation' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Installation' AS type_name, 'Material storage setup' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Construction' AS type_name, 'Brick / block laying' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Construction' AS type_name, 'Concrete mixing & pouring' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Construction' AS type_name, 'Trench digging' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Construction' AS type_name, 'Foundation work' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Construction' AS type_name, 'Compound wall building' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Replacement' AS type_name, 'Damaged barricade replacement' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Replacement' AS type_name, 'Safety net replacement' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Replacement' AS type_name, 'Scaffolding plank replacement' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Service' AS type_name, 'Debris removal' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Service' AS type_name, 'Site cleaning after work' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Service' AS type_name, 'Emergency labour support' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Service' AS type_name, 'Water logging clearance' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Maintenance' AS type_name, 'Campus ground maintenance' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Maintenance' AS type_name, 'Garden / landscape upkeep' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Maintenance' AS type_name, 'Drain / sump cleaning' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Maintenance' AS type_name, 'Road / pathway sweeping' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Maintenance' AS type_name, 'Periodic campus cleanup' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'Material loading / unloading' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'Furniture shifting / relocation' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'Heavy equipment moving' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'Sand / gravel spreading' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'General helper work' AS name
  UNION ALL
  SELECT 'Labour' AS category_name, 'Labour work' AS type_name, 'Event setup / teardown labour' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'MS frame installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Gate / grill installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Handrail installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Rack / stand installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Window grill installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Shed / canopy installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Installation' AS type_name, 'Staircase railing installation' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Fabrication of frame' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Steel frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Door frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Window frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Table / bench frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Platform / stand fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Truss / shed frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Grill / gate fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Handrail / railing fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Construction' AS type_name, 'Partition frame fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Damaged frame replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Rusted member replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Hinge / latch replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Grill panel replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Sheet / mesh replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Replacement' AS type_name, 'Support bracket replacement' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Welding repair' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Frame alignment repair' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Crack repair' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Gate / grill repair' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Railing repair' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Rust removal and touch-up' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Service' AS type_name, 'Bolt / anchor tightening' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Welding joint inspection' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Anti-rust painting' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Frame strengthening' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Gate / railing maintenance' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Lubrication of hinges' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Maintenance' AS type_name, 'Periodic fabrication check' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Cutting and welding labour' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Grinding / finishing work' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Drilling / anchoring work' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Material shifting for fabrication' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Sheet metal bending' AS name
  UNION ALL
  SELECT 'Metal Works' AS category_name, 'Labour work' AS type_name, 'Fabrication helper work' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Installation' AS type_name, 'Primer / base coat application' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Installation' AS type_name, 'New wall painting' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Installation' AS type_name, 'Texture / designer finish application' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Installation' AS type_name, 'Anti-fungal coating application' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Installation' AS type_name, 'Waterproof coating application' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Construction' AS type_name, 'Putty / wall preparation' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Construction' AS type_name, 'Plaster repair before painting' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Construction' AS type_name, 'Scaffolding for painting work' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Replacement' AS type_name, 'Old paint stripping & repainting' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Replacement' AS type_name, 'Discoloured wall repainting' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Replacement' AS type_name, 'Ceiling repaint' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Replacement' AS type_name, 'Door / window frame repaint' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Service' AS type_name, 'Paint touch-up' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Service' AS type_name, 'Stain removal on wall' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Service' AS type_name, 'Dampness treatment & repaint' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Service' AS type_name, 'Graffiti removal' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Service' AS type_name, 'Paint peeling repair' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Maintenance' AS type_name, 'Periodic repainting (exterior)' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Maintenance' AS type_name, 'Periodic repainting (interior)' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Maintenance' AS type_name, 'Anti-rust painting (metal)' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Maintenance' AS type_name, 'Floor marking repaint' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Maintenance' AS type_name, 'Boundary wall painting' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Labour work' AS type_name, 'Wall scraping / sanding labour' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Labour work' AS type_name, 'Putty application labour' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Labour work' AS type_name, 'Painting helper work' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Labour work' AS type_name, 'Scaffolding setup for painters' AS name
  UNION ALL
  SELECT 'Painting' AS category_name, 'Labour work' AS type_name, 'Paint material mixing' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'New tap / faucet installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Wash basin installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Commode / toilet installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'New pipeline laying' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Water tank installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Water pump installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Geyser / water heater install' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Installation' AS type_name, 'Water filter / RO installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Wash basin installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Commode / toilet installation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'New pipeline laying' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Underground pipeline construction' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Overhead water tank construction' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Sump / underground tank build' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Drainage channel construction' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Construction' AS type_name, 'Septic tank construction' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Tap / faucet replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Wash basin replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Flush tank / valve replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Damaged pipe replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Water pump replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Geyser element replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Replacement' AS type_name, 'Water filter cartridge replace' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Damaged pipe replacement' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Water leakage repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'No water flow repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Pipe burst repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Sewage / drainage clearance' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Toilet flush repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Water pump fault repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Service' AS type_name, 'Foul smell investigation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Water leakage repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Sewage / drainage clearance' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Water pump fault repair' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Foul smell investigation' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Pipeline flushing & inspection' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Water tank cleaning' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Drain / sump cleaning' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Maintenance' AS type_name, 'Water pump servicing' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Labour work' AS type_name, 'Pipe cutting / joining' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Labour work' AS type_name, 'Digging / trenching for pipe' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Labour work' AS type_name, 'Tank / pump shifting' AS name
  UNION ALL
  SELECT 'Plumbing' AS category_name, 'Labour work' AS type_name, 'Bathroom fittings labour' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'New UPS unit installation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'UPS battery bank setup' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'Online UPS installation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'Servo stabilizer installation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'UPS bypass switch installation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Installation' AS type_name, 'Power conditioning unit setup' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Construction' AS type_name, 'UPS room construction' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Construction' AS type_name, 'Battery rack fabrication & setup' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Construction' AS type_name, 'Cable tray for UPS wiring' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Construction' AS type_name, 'Ventilation setup for UPS room' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'UPS battery replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'UPS fan replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'UPS fuse / MCB replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'UPS display panel replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'Stabilizer component replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Replacement' AS type_name, 'UPS capacitor replacement' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'UPS not turning on repair' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'UPS beeping / alarm repair' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'UPS overload fault repair' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'Battery not charging repair' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'UPS output voltage fluctuation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'Stabilizer fault repair' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Service' AS type_name, 'UPS bypass mode issue' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'UPS battery health check' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'UPS periodic servicing' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'Battery terminal cleaning' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'UPS load testing' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'UPS firmware update' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'Stabilizer periodic service' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Maintenance' AS type_name, 'UPS room cleaning & inspection' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Labour work' AS type_name, 'UPS unit shifting / relocation' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Labour work' AS type_name, 'Battery loading / unloading' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Labour work' AS type_name, 'Cable pulling for UPS' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Labour work' AS type_name, 'Battery disposal / recycling' AS name
  UNION ALL
  SELECT 'UPS' AS category_name, 'Labour work' AS type_name, 'UPS room cleaning labour' AS name
) v ON v.category_name = woc.name AND v.type_name = wot.name
ON DUPLICATE KEY UPDATE `is_active` = VALUES(`is_active`);

-- =====================================================
-- 4. APPROVAL WORKFLOW REGISTRATION
-- =====================================================
-- FIX: the module header promised a level1 -> dof -> principal flow but
-- nothing registered it. Without these rows workflowService.js resolves no
-- stage policy and getWorkflowModule() has no flow to walk.
-- '*' beneficiary_type mirrors how the flow is registered for other modules
-- that apply the same chain regardless of beneficiary.

-- IMPORTANT: `uq_approval_flow` is (beneficiary_type, entity_type_code,
-- module_key) and entity_type_code is NULL here. MySQL treats NULLs as
-- distinct in a UNIQUE index, so ON DUPLICATE KEY UPDATE NEVER fires for
-- these rows and a re-run silently inserts a duplicate. That has already
-- happened in production: approval_flow_config holds three identical
-- ('*', NULL, 'finance') rows (ids 8, 9, 10). Use explicit
-- UPDATE-then-INSERT-if-absent instead, which is genuinely idempotent.
-- Flow is level1 (HOD) -> incharge -> principal -> workorder_admin
-- (final allocation stage that assigns approved work to staff).
DELETE legacy FROM `approval_flow_config` legacy
JOIN `approval_flow_config` canonical
  ON canonical.`module_key` = 'workorder'
 AND canonical.`beneficiary_type` = legacy.`beneficiary_type`
 AND canonical.`entity_type_code` <=> legacy.`entity_type_code`
WHERE legacy.`module_key` = 'work_order'
  AND legacy.`beneficiary_type` = '*'
  AND legacy.`entity_type_code` IS NULL;

UPDATE `approval_flow_config`
SET `flow` = '["level1", "incharge", "principal", "workorder_admin"]', `is_active` = 1
WHERE `module_key` = 'work_order'
  AND `beneficiary_type` = '*'
  AND `entity_type_code` IS NULL;

INSERT INTO `approval_flow_config` (`beneficiary_type`, `entity_type_code`, `flow`, `module_key`, `is_active`)
SELECT '*', NULL, '["level1", "incharge", "principal", "workorder_admin"]', 'work_order', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `approval_flow_config` afc
  WHERE afc.`module_key` = 'work_order'
    AND afc.`beneficiary_type` = '*'
    AND afc.`entity_type_code` IS NULL
);

-- level1 is department-scoped with the same approver role codes finance and
-- expenditure use; incharge, principal, and workorder_admin are institute-wide.
-- incharge is the review stage before Principal, and workorder_admin is the
-- final allocation stage that assigns approved work to staff.
-- Rename previously-seeded 'dof' rows to 'incharge' in place. This module
-- already ran once with 'dof' naming (copied from the budget flow by
-- mistake -- work_order has no DoF role). Renaming in place preserves any
-- role_permissions grants already made against that permission_id instead
-- of orphaning them under a key nothing points to anymore.
DELETE legacy FROM `workflow_stage_policies` legacy
JOIN `workflow_stage_policies` canonical
  ON canonical.`module_key` = 'workorder'
 AND canonical.`stage_key` = legacy.`stage_key`
WHERE legacy.`module_key` = 'work_order'
  AND legacy.`stage_key` IN ('level1', 'incharge', 'principal', 'workorder_admin');

UPDATE `workflow_stage_policies`
SET `stage_key` = 'incharge'
WHERE `module_key` = 'work_order' AND `stage_key` = 'dof';

UPDATE `permissions`
SET `action_key` = 'incharge', `permission_key` = 'work_order.workflow.incharge'
WHERE `module_key` = 'work_order_workflow' AND `action_key` = 'dof';

INSERT INTO `workflow_stage_policies` (`module_key`, `stage_key`, `scope_type`, `meta`, `is_active`)
VALUES
  ('work_order', 'level1', 'department', '{"requireAssignment": false, "assignmentRoleCodes": ["hod", "coordinator", "entity_approver"]}', 1),
  ('work_order', 'incharge', 'global', NULL, 1),
  ('work_order', 'principal', 'global', NULL, 1),
  ('work_order', 'workorder_admin', 'global', NULL, 1)
ON DUPLICATE KEY UPDATE `scope_type` = VALUES(`scope_type`), `meta` = VALUES(`meta`), `is_active` = 1;

-- Runtime code registers and queries this module as `workorder`. Reconcile
-- older migration rows that used `work_order` so workflow configuration is
-- resolved from the same canonical module key on existing databases too.
UPDATE `approval_flow_config`
SET `module_key` = 'workorder'
WHERE `module_key` = 'work_order'
  AND `beneficiary_type` = '*'
  AND `entity_type_code` IS NULL;

UPDATE `workflow_stage_policies`
SET `module_key` = 'workorder'
WHERE `module_key` = 'work_order'
  AND `stage_key` IN ('level1', 'incharge', 'principal', 'workorder_admin');

-- =====================================================
-- 5. PERMISSIONS
-- =====================================================
-- FIX: ability.ts maps work_order.read/edit/create/manage into CASL rules,
-- but none of these permission keys existed in `permissions`. WorkOrder.tsx
-- gates its submit button on can('create'|'edit','WorkOrder'), so without
-- these rows only super_admin (which short-circuits permissionMiddleware and
-- gets can('manage','all')) could submit anything.
--
-- Naming note: the client uses `work_order.*` with an underscore -- matched
-- exactly here. Do not "normalize" it to `workorder.*` without changing
-- PERMISSION_MAP in client/src/shared/casl/ability.ts to match.

INSERT INTO `permissions` (`module_key`, `action_key`, `permission_key`, `description`, `is_system`)
VALUES
  ('work_order', 'read', 'work_order.read', 'View work orders', 1),
  ('work_order', 'create', 'work_order.create', 'Raise new work orders', 1),
  ('work_order', 'edit', 'work_order.edit', 'Edit work orders and update item fulfilment', 1),
  ('work_order', 'manage', 'work_order.manage', 'Manage work order catalog and assignments', 1),
  ('work_order_workflow', 'level1', 'work_order.workflow.level1', 'Process work order Level-1 (HOD) approvals', 1),
  ('work_order_workflow', 'incharge', 'work_order.workflow.incharge', 'Process work order Incharge-stage approvals', 1),
  ('work_order_workflow', 'principal', 'work_order.workflow.principal', 'Process work order Principal-stage approvals', 1),
  ('work_order_workflow', 'workorder_admin', 'work_order.workflow.workorder_admin', 'Process final work order allocation stage', 1)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Grants. Keyed by role_code / permission_key rather than hardcoded ids so
-- this is safe to re-run and safe across environments with different
-- AUTO_INCREMENT positions.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.module_key IN ('work_order', 'work_order_workflow')
WHERE r.role_code = 'super_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- Every authenticated user may raise and view a work order: all five
-- /workorder* routes in App.tsx use the plain ProtectedRoute guard, so the
-- base `user` role must carry read/create/edit or the form is submit-disabled
-- for everyone.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.create', 'work_order.edit')
WHERE r.role_code = 'user'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.manage')
WHERE r.role_code = 'admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.workflow.level1')
WHERE r.role_code IN ('hod', 'coordinator')
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.workflow.principal')
WHERE r.role_code = 'principal'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- Incharge and Workorder Admin are created through the Access Control UI
-- (not seeded roles), so there's no fixed role_code to match here yet.
-- Once those roles exist, check work_order.workflow.incharge on Incharge and
-- work_order.workflow.workorder_admin on Workorder Admin from that screen.
-- These inserts are no-ops (match zero rows) until a role with that exact
-- role_code exists, so they're safe to keep for environments that do seed one.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.workflow.incharge')
WHERE r.role_code = 'incharge'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.permission_key IN ('work_order.read', 'work_order.workflow.workorder_admin')
WHERE r.role_code = 'workorder_admin'
ON DUPLICATE KEY UPDATE `granted_at` = `granted_at`;

-- =====================================================
-- 6. ENRICHED READ VIEW
-- =====================================================
-- Resolves the applicant/department/category joins the dashboard list needs,
-- matching the v_guesthouse_bookings / v_budget_proposals pattern. Item rows
-- and photos are fetched separately -- one row per work order here.
CREATE OR REPLACE VIEW `v_work_orders` AS
SELECT
  wo.id,
  wo.wo_number,
  wo.employee_id,
  wo.created_by,
  COALESCE(
    CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')),
    wo.applicant_name
  ) AS applicant_name,
  COALESCE(e.designation, wo.designation) AS designation,
  COALESCE(d.name, wo.department) AS department,
  wo.department_id,
  COALESCE(e.email, wo.email) AS email,
  COALESCE(e.mobile, wo.mobile) AS mobile,
  wo.request_date,
  wo.beneficiary_type,
  wo.beneficiary_value,
  wo.beneficiary_employee_id,
  wo.beneficiary_entity_id,
  wo.budget_tag,
  wo.category_id,
  woc.name AS category_name,
  woc.code AS category_code,
  wo.overall_status,
  wo.workflow_status,
  wo.workflow_stage,
  (SELECT COUNT(*) FROM work_order_items woi WHERE woi.work_order_id = wo.id) AS item_count,
  wo.created_at,
  wo.updated_at
FROM work_orders wo
LEFT JOIN master_employees e ON wo.employee_id = e.id
LEFT JOIN master_departments d ON wo.department_id = d.id
LEFT JOIN work_order_categories woc ON wo.category_id = woc.id;

-- ROLLBACK (kept commented for reference):
-- DROP VIEW IF EXISTS `v_work_orders`;
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module_key IN ('work_order', 'work_order_workflow'));
-- DELETE FROM permissions WHERE module_key IN ('work_order', 'work_order_workflow');
-- DELETE FROM workflow_stage_policies WHERE module_key = 'work_order';
-- DELETE FROM approval_flow_config WHERE module_key = 'work_order';
-- DROP TABLE IF EXISTS `work_order_item_photos`;
-- DROP TABLE IF EXISTS `work_order_items`;
-- DROP TABLE IF EXISTS `work_orders`;
-- DROP TABLE IF EXISTS `work_order_subtypes`;
-- DROP TABLE IF EXISTS `work_order_types`;
-- DROP TABLE IF EXISTS `work_order_categories`;
