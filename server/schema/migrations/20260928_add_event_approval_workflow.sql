-- Migration: Add event_approval_history table for Event Approval Workflow Engine
-- Sequence: Creator (Submit) -> HOD -> IQAC -> Principal -> Approved / Published

CREATE TABLE IF NOT EXISTS `event_approval_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_id` INT NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `user_id` INT DEFAULT NULL,
  `user_name` VARCHAR(255) DEFAULT NULL,
  `action` VARCHAR(50) NOT NULL,
  `comments` TEXT DEFAULT NULL,
  `action_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_eah_event` (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
