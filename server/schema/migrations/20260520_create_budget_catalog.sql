-- ============================================
-- Migration: Create budget_catalog tables
-- Author: Maheshwaran
-- Date: 2026-05-20
-- ============================================
-- Moves the hardcoded BUDGET_HEAD_GROUPS / SUB_HEAD_BY_BUDGET_HEAD /
-- HOAC_SUBHEAD_OPTIONS / EVENT_SUBHEAD_GROUPS catalogs (client side)
-- into the database so admins can add/edit/remove without redeploys.
-- ============================================

CREATE TABLE IF NOT EXISTS `budget_heads` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `group_label` VARCHAR(100) NOT NULL,
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_budget_head_name` (`name`),
    INDEX `idx_budget_head_group` (`group_label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_sub_heads` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `head_id` INT NULL,
    `scope` ENUM('head-specific','hoac-shared','event-specific') NOT NULL DEFAULT 'head-specific',
    `event_type` VARCHAR(100) NULL,
    `group_label` VARCHAR(150) NULL,
    `sort_order` INT DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_subhead_head`
        FOREIGN KEY (`head_id`) REFERENCES `budget_heads`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_subhead_scope` (`scope`),
    INDEX `idx_subhead_head` (`head_id`),
    INDEX `idx_subhead_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ROLLBACK
-- ============================================
-- DROP TABLE IF EXISTS `budget_sub_heads`;
-- DROP TABLE IF EXISTS `budget_heads`;
