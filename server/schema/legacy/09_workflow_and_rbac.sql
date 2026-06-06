/* ============================================================
   09_workflow_and_rbac.sql
   MODULE: Role-Based Access Control (RBAC) & Workflow Engine
   PURPOSE: Defines tables for granular application permissions,
            user roles, entity-scoped roles (departments, centres, etc.),
            historical workflow action snapshots, stage policies, and
            permitted account options.
   Date: June 6, 2026
   ============================================================ */

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

/* 0. DROP EXISTING (Clean Slate) */
DROP TABLE IF EXISTS account_options;
DROP TABLE IF EXISTS workflow_stage_policies;
DROP TABLE IF EXISTS workflow_actions;
DROP TABLE IF EXISTS user_entity_roles;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;

SET FOREIGN_KEY_CHECKS = 1;

/* ============================================================
   1. GRANULAR PERMISSIONS & ACCESS CONTROL (RBAC)
   ============================================================ */

/* 1.1 PERMISSIONS MAP (System action permission keys) */
CREATE TABLE permissions (
  id INT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(100) NOT NULL COMMENT 'Functional domain key (e.g. journals, budget, finance)',
  action_key VARCHAR(50) NOT NULL COMMENT 'Permitted CRUD/workflow action (e.g. read, write, approve)',
  permission_key VARCHAR(160) NOT NULL COMMENT 'Consolidated unique system key (e.g. module:action)',
  description VARCHAR(255) DEFAULT NULL COMMENT 'Readable description of permission scope',
  is_system TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Boolean flag indicating core system permission (cannot delete)',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (permission_key),
  UNIQUE KEY uq_permissions_module_action (module_key, action_key)
) ENGINE=InnoDB AUTO_INCREMENT=11441 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.2 ROLES (User roles designation) */
CREATE TABLE roles (
  id INT NOT NULL AUTO_INCREMENT,
  role_code VARCHAR(80) NOT NULL COMMENT 'Unique uppercase system code of role (e.g. HOD, DIRECTOR, ADMIN)',
  role_name VARCHAR(120) NOT NULL COMMENT 'User-friendly name of the role',
  description VARCHAR(255) DEFAULT NULL COMMENT 'Description of role responsibilities',
  is_system TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Boolean flag indicating core system role',
  is_admin_role TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Flag indicating administrative management privileges',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (role_code)
) ENGINE=InnoDB AUTO_INCREMENT=2271 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.3 ROLE PERMISSIONS RELATIONS (Many-to-many permission grants) */
CREATE TABLE role_permissions (
  role_id INT NOT NULL COMMENT 'FK link to roles',
  permission_id INT NOT NULL COMMENT 'FK link to permissions',
  granted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.4 USER ROLES RELATIONS (Global role assignments) */
CREATE TABLE user_roles (
  user_id INT NOT NULL COMMENT 'FK to users',
  role_id INT NOT NULL COMMENT 'FK to roles',
  assigned_by INT DEFAULT NULL COMMENT 'FK to users who assigned the role',
  assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role (role_id),
  KEY idx_user_roles_assigned_by (assigned_by),
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 1.5 USER ENTITY-SCOPED ROLES (Departmental or club-specific HOD/Coordinator scopes) */
CREATE TABLE user_entity_roles (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT 'FK to users',
  entity_id INT NOT NULL COMMENT 'FK to master_entities or master_departments depending on scope type',
  entity_type ENUM('DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Target entity classification context',
  role_id INT NOT NULL COMMENT 'FK to roles',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_user_entity_role (user_id, entity_id, entity_type, role_id),
  KEY fk_uer_role (role_id),
  CONSTRAINT fk_uer_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_uer_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* ============================================================
   2. WORKFLOW ENGINE DETAILS
   ============================================================ */

/* 2.1 WORKFLOW ACTION HISTORY LOG */
CREATE TABLE workflow_actions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(64) NOT NULL COMMENT 'Target module context (e.g. BUDGET, FINANCE, EXPENDITURE)',
  record_id BIGINT NOT NULL COMMENT 'Target foreign key ID of request record being reviewed',
  stage VARCHAR(64) NOT NULL COMMENT 'Review stage snapshot key (e.g., hod, principal, chairman)',
  decision ENUM('approved', 'rejected', 'returned', 'archived', 'deleted', 'resubmitted') NOT NULL COMMENT 'Review action decision',
  feedback TEXT COMMENT 'Detailed comments and review feedback',
  actor_user_id INT DEFAULT NULL COMMENT 'FK to users who executed the action',
  actor_email VARCHAR(255) DEFAULT NULL COMMENT 'Email address of reviewing actor',
  actor_role VARCHAR(100) DEFAULT NULL COMMENT 'Sign-off role description used',
  decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  snapshot_before JSON NOT NULL COMMENT 'JSON snapshot backup of the record state before action execution',
  meta JSON DEFAULT NULL COMMENT 'Additional review action metadata (signatures, timestamps)',
  PRIMARY KEY (id),
  KEY idx_workflow_actions_record (module_key, record_id, decided_at),
  KEY idx_workflow_actions_actor (actor_user_id),
  KEY idx_workflow_actions_stage (module_key, stage, decided_at)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* 2.2 WORKFLOW STAGE POLICIES (Configurable validation rules for workflow paths) */
CREATE TABLE workflow_stage_policies (
  id INT NOT NULL AUTO_INCREMENT,
  module_key VARCHAR(64) NOT NULL COMMENT 'Functional module name',
  stage_key VARCHAR(64) NOT NULL COMMENT 'Stage identifier name',
  scope_type ENUM('global', 'department', 'entity') NOT NULL COMMENT 'Policy execution scope level',
  meta JSON DEFAULT NULL COMMENT 'JSON schema containing policy validation rules and constraints',
  is_active TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Status flag',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workflow_stage_policy (module_key, stage_key),
  KEY idx_workflow_stage_policy_module (module_key),
  KEY idx_workflow_stage_policy_scope (scope_type),
  KEY idx_workflow_stage_policy_active (is_active)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

/* ============================================================
   3. PERMITTED PAYMENT & CREDIT ACCOUNT LISTS
   ============================================================ */

/* 3.1 ACCOUNT OPTIONS */
CREATE TABLE account_options (
  id INT NOT NULL AUTO_INCREMENT,
  account_name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'General Ledger or bank account identifier description',
  is_active TINYINT(1) NOT NULL DEFAULT '1' COMMENT 'Status flag',
  is_deleted TINYINT(1) NOT NULL DEFAULT '0' COMMENT 'Soft delete flag',
  sort_order INT NOT NULL DEFAULT '0' COMMENT 'Dropdown sequence order',
  created_by INT DEFAULT NULL COMMENT 'FK to users',
  updated_by INT DEFAULT NULL COMMENT 'FK to users',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_account_options_account_name (account_name),
  KEY idx_account_options_active (is_active, is_deleted),
  KEY idx_account_options_sort (sort_order, account_name)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
