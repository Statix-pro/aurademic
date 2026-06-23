-- schema/migrations/20260603_update_employee_status_to_relieved.sql
-- Author: Antigravity
-- Date: 2026-06-03
-- Description: Add 'Relieved' status to master_employees and update existing 'Terminated' employees to 'Relieved'.

ALTER TABLE `master_employees` 
MODIFY COLUMN `status` enum('Active','Retired','Resigned','On Leave','Deputation','Terminated','Deceased','Relieved') DEFAULT 'Active';

UPDATE `master_employees` 
SET `status` = 'Relieved' 
WHERE `status` = 'Terminated';
