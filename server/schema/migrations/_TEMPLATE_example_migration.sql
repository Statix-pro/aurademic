-- ============================================
-- Migration: Example Migration (Template)
-- Author: Your Name
-- Date: 2025-12-19
-- ============================================

-- Description:
-- This is a reference template for writing migrations.
-- Copy this file and rename it using the format: YYYYMMDD_description.sql
-- Example: 20251220_add_status_to_journals.sql

-- ============================================
-- EXAMPLE 1: Adding a new column
-- ============================================
-- ALTER TABLE `journals` 
-- ADD COLUMN `review_status` VARCHAR(50) DEFAULT 'pending' AFTER `status`;

-- ============================================
-- EXAMPLE 2: Creating a new table
-- ============================================
-- CREATE TABLE IF NOT EXISTS `notifications` (
--     `id` INT AUTO_INCREMENT PRIMARY KEY,
--     `user_id` INT NOT NULL,
--     `title` VARCHAR(255) NOT NULL,
--     `message` TEXT NOT NULL,
--     `is_read` BOOLEAN DEFAULT FALSE,
--     `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     
--     CONSTRAINT `fk_notifications_user` 
--         FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) 
--         ON DELETE CASCADE ON UPDATE CASCADE,
--     
--     INDEX `idx_notifications_user` (`user_id`),
--     INDEX `idx_notifications_read` (`is_read`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EXAMPLE 3: Adding an index
-- ============================================
-- CREATE INDEX `idx_journals_created_at` ON `journals`(`created_at`);

-- ============================================
-- EXAMPLE 4: Modifying a column
-- ============================================
-- ALTER TABLE `journals` 
-- MODIFY COLUMN `title` VARCHAR(500) NOT NULL;

-- ============================================
-- EXAMPLE 5: Dropping a column (be careful!)
-- ============================================
-- ALTER TABLE `journals` 
-- DROP COLUMN `old_column_name`;

-- ============================================
-- EXAMPLE 6: Adding a foreign key
-- ============================================
-- ALTER TABLE `journals`
-- ADD CONSTRAINT `fk_journals_department`
-- FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`)
-- ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- ROLLBACK (Keep commented - use if you need to undo)
-- ============================================
-- ALTER TABLE `journals` DROP COLUMN `review_status`;
-- DROP TABLE IF EXISTS `notifications`;
-- DROP INDEX `idx_journals_created_at` ON `journals`;
