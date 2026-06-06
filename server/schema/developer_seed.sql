/* ============================================================
   developer_seed.sql
   Aurademic Research Portal
   PURPOSE: Quick-start database seed script for new developers.
   Date: June 6, 2026
   
   INSTRUCTIONS:
   1. Open this file in a text editor.
   2. Replace 'developer@example.com' with your actual Google OAuth
      or Microsoft login email address.
   3. Change the name if you wish.
   4. Run this script against your local 'research' database:
      
      mysql -u root -p research < server/schema/developer_seed.sql
      
   This will register your account in both the users and master_employees
   tables, and grant you full Super Admin credentials so you can log in
   and begin testing immediately.
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create the employee record linked to the target email
-- Note: id 9999 and erp_id 'DEV9999' are placeholder values for development
INSERT INTO `master_employees` (
  id, 
  erp_id, 
  title, 
  first_name, 
  last_name, 
  gender, 
  email, 
  mobile, 
  designation, 
  department_id, 
  employee_type, 
  status,
  user_id
)
VALUES (
  9999, 
  'DEV9999', 
  'Mr', 
  'Developer', 
  'Fresher', 
  'Male', 
  'developer@example.com', 
  '+919999999999', 
  'Assistant Professor', 
  1, -- department_id (Common IDs: 1=AIDS, 2=AIML, 3=BT, 4=CIVIL, 5=CSE, 6=CSBS, 7=ECE, 8=EEE, 10=IT, 23=ADMIN)
  'Teaching', 
  'Active',
  9999
)
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  user_id = VALUES(user_id);

-- 2. Create the user authentication record linked to the target email
INSERT INTO `users` (
  id, 
  email, 
  name, 
  picture, 
  is_admin
)
VALUES (
  9999, 
  'developer@example.com', 
  'Developer Fresher', 
  NULL, 
  1
)
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  name = VALUES(name);

-- 3. Associate the user with the Super Admin (id: 1) and base User (id: 15) roles
INSERT INTO `user_roles` (user_id, role_id)
VALUES 
  (9999, 1), 
  (9999, 15)
ON DUPLICATE KEY UPDATE 
  user_id = user_id;

-- 4. Create the author record linked to the employee profile (for journals & projects)
INSERT INTO `authors` (
  id, 
  employee_id, 
  email, 
  author_id, 
  designation, 
  name, 
  department, 
  organization
)
VALUES (
  9999, 
  9999, 
  'developer@example.com', 
  'DEV9999', 
  'Assistant Professor', 
  'Developer Fresher', 
  'AIDS', 
  'KSRCT'
)
ON DUPLICATE KEY UPDATE 
  email = VALUES(email),
  name = VALUES(name),
  employee_id = VALUES(employee_id);

-- ============================================================
-- OPTIONAL WORKFLOW TESTING ROLES
-- INSTRUCTIONS: If you need to test the exact workflow stages 
-- as specific approvers, uncomment the respective lines below.
-- ============================================================

-- A. Test as HOD (Head of Department)
-- (Applies to department ID 1. Change '1' to your department's ID if needed)
-- INSERT INTO `user_entity_roles` (user_id, entity_id, entity_type, role_id)
-- VALUES (9999, 1, 'DEPARTMENT', 3) ON DUPLICATE KEY UPDATE user_id = user_id;

-- B. Test as Coordinator (Clubs/Cells/Centres)
-- (Applies to Cell ID 1. Change '1' to your cell's ID if needed)
-- INSERT INTO `user_entity_roles` (user_id, entity_id, entity_type, role_id)
-- VALUES (9999, 1, 'CELL', 13) ON DUPLICATE KEY UPDATE user_id = user_id;

-- C. Test as Finance Admin / DoF (Director of Finance)
-- INSERT INTO `user_roles` (user_id, role_id)
-- VALUES (9999, 4) ON DUPLICATE KEY UPDATE user_id = user_id;

-- D. Test as Principal
-- INSERT INTO `user_roles` (user_id, role_id)
-- VALUES (9999, 5) ON DUPLICATE KEY UPDATE user_id = user_id;

-- E. Test as Chairman
-- INSERT INTO `user_roles` (user_id, role_id)
-- VALUES (9999, 38) ON DUPLICATE KEY UPDATE user_id = user_id;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Developer account successfully seeded!' AS status;
