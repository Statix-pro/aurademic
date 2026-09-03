-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: 10.1.16.2    Database: research
-- ------------------------------------------------------
-- Server version	9.2.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account_options`
--

DROP TABLE IF EXISTS `account_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_options_account_name` (`account_name`),
  KEY `idx_account_options_active` (`is_active`,`is_deleted`),
  KEY `idx_account_options_sort` (`sort_order`,`account_name`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_options`
--


--
-- Table structure for table `approval_flow_config`
--

DROP TABLE IF EXISTS `approval_flow_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `approval_flow_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `beneficiary_type` varchar(100) NOT NULL,
  `entity_type_code` varchar(50) DEFAULT NULL COMMENT 'CELL, CLUB, CENTRE, PROFESSIONAL_BODY',
  `flow` json NOT NULL,
  `module_key` varchar(64) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_approval_flow` (`beneficiary_type`,`entity_type_code`,`module_key`),
  KEY `idx_approval_flow_type` (`beneficiary_type`),
  KEY `idx_approval_flow_entity_type` (`entity_type_code`),
  KEY `idx_approval_flow_module` (`module_key`),
  KEY `idx_approval_flow_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approval_flow_config`
--


--
-- Table structure for table `author_journal`
--

DROP TABLE IF EXISTS `author_journal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `author_journal` (
  `id` int NOT NULL AUTO_INCREMENT,
  `author_id` int DEFAULT NULL,
  `journal_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_first_author` tinyint(1) DEFAULT '0',
  `is_primary` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_author_journal` (`author_id`,`journal_id`),
  KEY `idx_journal` (`journal_id`),
  KEY `idx_author` (`author_id`),
  CONSTRAINT `author_journal_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `author_journal_ibfk_2` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_journal`
--


--
-- Table structure for table `author_students`
--

DROP TABLE IF EXISTS `author_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `author_students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_unique_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `department` varchar(255) DEFAULT '',
  `organization` varchar(255) DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_unique_id` (`student_unique_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_students`
--


--
-- Table structure for table `authors`
--

DROP TABLE IF EXISTS `authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL COMMENT 'FK to master_employees for internal college staff',
  `email` varchar(255) DEFAULT NULL,
  `author_id` varchar(255) DEFAULT NULL,
  `designation` varchar(100) DEFAULT '',
  `name` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT '',
  `organization` varchar(255) DEFAULT '',
  `country` varchar(100) DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `state` varchar(100) DEFAULT '',
  `student_ref` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `author_id` (`author_id`),
  KEY `idx_author_id` (`author_id`),
  KEY `fk_authors_student_ref` (`student_ref`),
  KEY `idx_author_employee` (`employee_id`),
  CONSTRAINT `fk_author_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_authors_student_ref` FOREIGN KEY (`student_ref`) REFERENCES `author_students` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `authors`
--


--
-- Table structure for table `budget_annual`
--

DROP TABLE IF EXISTS `budget_annual`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_annual` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `fiscal_year` int NOT NULL,
  `beneficiary_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beneficiary_entity_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `proposed_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `initial_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `additional_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `expenditure_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `annual_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_annual_scope` (`fiscal_year`,`beneficiary_type`,`department_id`,`entity_id`),
  KEY `idx_budget_annual_fy` (`fiscal_year`),
  KEY `idx_budget_annual_type` (`beneficiary_type`),
  KEY `idx_budget_annual_entity` (`beneficiary_entity_id`),
  KEY `idx_budget_annual_department` (`department_id`),
  KEY `idx_budget_annual_entity_id` (`entity_id`),
  KEY `idx_budget_annual_rollup` (`fiscal_year`,`beneficiary_type`,`department_id`,`beneficiary_entity_id`),
  CONSTRAINT `fk_budget_annual_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_budget_annual_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_budget_annual_entity_id` FOREIGN KEY (`entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=230 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_annual`
--


--
-- Table structure for table `budget_heads`
--

DROP TABLE IF EXISTS `budget_heads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_label` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_budget_head_name` (`name`),
  UNIQUE KEY `uniq_budget_heads_code` (`code`),
  KEY `idx_budget_head_group` (`group_label`),
  KEY `idx_budget_head_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_heads`
--


--
-- Table structure for table `budget_line_month_allocations`
--

DROP TABLE IF EXISTS `budget_line_month_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_line_month_allocations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_line_id` int NOT NULL,
  `month` enum('Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_line_month_allocations_line_month` (`budget_line_id`,`month`),
  KEY `idx_budget_line_month_allocations_month` (`month`),
  CONSTRAINT `fk_budget_line_month_allocations_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_budget_line_month_amount_non_zero` CHECK ((`amount` <> 0.00))
) ENGINE=InnoDB AUTO_INCREMENT=38945 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_line_month_allocations`
--


--
-- Table structure for table `budget_proposal_approvals`
--

DROP TABLE IF EXISTS `budget_proposal_approvals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_proposal_approvals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_proposal_id` int NOT NULL,
  `role` varchar(20) NOT NULL,
  `approver_user_id` int NOT NULL,
  `approver_email` varchar(255) NOT NULL,
  `decision` varchar(20) NOT NULL,
  `feedback` text,
  `allows_edit` tinyint(1) NOT NULL DEFAULT '0',
  `decided_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_proposal_approvals_proposal` (`budget_proposal_id`),
  KEY `idx_budget_proposal_approvals_role_decision` (`role`,`decision`),
  KEY `idx_budget_proposal_approvals_decided_at` (`decided_at`),
  KEY `idx_budget_proposal_approvals_approver` (`approver_user_id`),
  CONSTRAINT `fk_budget_proposal_approvals_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3862 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_approvals`
--


--
-- Table structure for table `budget_proposal_edits`
--

DROP TABLE IF EXISTS `budget_proposal_edits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_proposal_edits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_proposal_id` int NOT NULL,
  `edited_by_user_id` int DEFAULT NULL,
  `edited_by_email` varchar(191) DEFAULT NULL,
  `summary` varchar(255) DEFAULT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_proposal_edits_proposal` (`budget_proposal_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_edits`
--


--
-- Table structure for table `budget_proposal_lines`
--

DROP TABLE IF EXISTS `budget_proposal_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_proposal_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_proposal_id` int NOT NULL,
  `budget_head` varchar(255) NOT NULL,
  `sub_head` varchar(255) NOT NULL,
  `budget_head_id` int DEFAULT NULL,
  `budget_sub_head_id` int DEFAULT NULL,
  `unit_amount` decimal(15,2) NOT NULL,
  `approved_unit_amount` decimal(15,2) DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `line_total` decimal(15,2) NOT NULL,
  `approved_line_total` decimal(15,2) DEFAULT NULL,
  `approved_month_allocations_json` longtext,
  `line_description` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_proposal_lines_proposal` (`budget_proposal_id`),
  KEY `idx_budget_proposal_lines_head` (`budget_head`),
  KEY `idx_bpl_head_id` (`budget_head_id`),
  KEY `idx_bpl_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_budget_proposal_lines_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5807 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_lines`
--


--
-- Table structure for table `budget_proposal_refs`
--

DROP TABLE IF EXISTS `budget_proposal_refs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_proposal_refs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_id` int DEFAULT NULL COMMENT 'NULL for year tracker row',
  `ref_year` year NOT NULL,
  `ref_sequence` int NOT NULL DEFAULT '0',
  `proposal_ref` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_ref_year_seq` (`ref_year`,`ref_sequence`),
  UNIQUE KEY `uq_budget_proposal_refs_proposal_id` (`proposal_id`),
  UNIQUE KEY `uq_budget_proposal_refs_ref` (`proposal_ref`),
  KEY `idx_budget_proposal_refs_year` (`ref_year`),
  KEY `idx_budget_proposal_refs_sequence` (`ref_year`,`ref_sequence`),
  CONSTRAINT `fk_budget_proposal_refs_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2716 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_refs`
--


--
-- Table structure for table `budget_proposals`
--

DROP TABLE IF EXISTS `budget_proposals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_ref` varchar(20) NOT NULL,
  `fiscal_year` year NOT NULL,
  `employee_id` int NOT NULL,
  `user_id` int NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `applicant_name` varchar(255) DEFAULT NULL,
  `request_date` date NOT NULL,
  `budget_window_type` enum('initial','additional') NOT NULL DEFAULT 'additional',
  `beneficiary_type` varchar(100) NOT NULL,
  `beneficiary_value` varchar(255) DEFAULT NULL,
  `beneficiary_entity_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `proposal_description` text,
  `budget_tag` varchar(100) DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_amount` decimal(15,2) DEFAULT NULL,
  `approval_flow` varchar(50) NOT NULL DEFAULT 'dof_principal',
  `status` varchar(50) NOT NULL DEFAULT 'submitted',
  `current_stage` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_proposals_ref` (`proposal_ref`),
  KEY `idx_budget_proposals_fiscal_year` (`fiscal_year`),
  KEY `idx_budget_proposals_user_email` (`user_email`),
  KEY `idx_budget_proposals_user_id` (`user_id`),
  KEY `idx_budget_proposals_status` (`status`),
  KEY `idx_budget_proposals_stage` (`current_stage`),
  KEY `idx_budget_proposals_beneficiary_type` (`beneficiary_type`),
  KEY `idx_budget_proposals_beneficiary_entity` (`beneficiary_entity_id`),
  KEY `idx_budget_proposals_department_id` (`department_id`),
  KEY `idx_budget_proposals_approval_flow` (`approval_flow`),
  KEY `idx_budget_proposals_created_at` (`created_at`),
  KEY `idx_budget_proposals_fy_status` (`fiscal_year`,`status`),
  KEY `idx_budget_proposals_flow_stage` (`approval_flow`,`current_stage`),
  KEY `idx_budget_proposals_tag` (`budget_tag`),
  CONSTRAINT `fk_budget_proposals_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_budget_proposals_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1358 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposals`
--


--
-- Table structure for table `budget_sub_heads`
--

DROP TABLE IF EXISTS `budget_sub_heads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_sub_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head_id` int DEFAULT NULL,
  `scope` enum('head-specific','hoac-shared') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'head-specific',
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_label` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `head_identity_id` int GENERATED ALWAYS AS (coalesce(`head_id`,0)) STORED,
  `event_type_key` varchar(100) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(`event_type`,_utf8mb4'')) STORED,
  `group_label_key` varchar(150) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(`group_label`,_utf8mb4'')) STORED,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_budget_subhead_identity` (`name`,`scope`,`head_identity_id`,`event_type_key`,`group_label_key`),
  KEY `idx_subhead_scope` (`scope`),
  KEY `idx_subhead_head` (`head_id`),
  KEY `idx_subhead_event_type` (`event_type`),
  KEY `idx_budget_sub_heads_code` (`code`),
  KEY `idx_budget_sub_head_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=622 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_sub_heads`
--


--
-- Table structure for table `budget_tags`
--

DROP TABLE IF EXISTS `budget_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tag_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_tags_name` (`tag_name`),
  KEY `idx_budget_tags_active_order` (`is_active`,`sort_order`,`tag_name`),
  KEY `idx_budget_tags_deleted` (`is_deleted`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_tags`
--


--
-- Table structure for table `budget_time_freeze_config`
--

DROP TABLE IF EXISTS `budget_time_freeze_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_time_freeze_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fiscal_year` int NOT NULL,
  `cutoff_date` date NOT NULL,
  `is_frozen` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by_user_id` int DEFAULT NULL,
  `updated_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_time_freeze_config_fiscal_year` (`fiscal_year`),
  KEY `idx_budget_time_freeze_config_fiscal_year` (`fiscal_year`),
  KEY `fk_budget_time_freeze_config_user` (`updated_by_user_id`),
  CONSTRAINT `fk_budget_time_freeze_config_user` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_time_freeze_config`
--


--
-- Table structure for table `edit_requests`
--

DROP TABLE IF EXISTS `edit_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `edit_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` enum('journals','research_projects') NOT NULL,
  `entity_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('pending','approved','rejected','none') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `entity_type_id_index` (`entity_type`,`entity_id`),
  CONSTRAINT `edit_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edit_requests`
--


--
-- Table structure for table `expenditure_advance_rows`
--

DROP TABLE IF EXISTS `expenditure_advance_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_advance_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `finance_budget_breakup_id` int DEFAULT NULL,
  `budget_proposal_id` int DEFAULT NULL,
  `budget_line_id` int DEFAULT NULL,
  `amount_source` enum('planned','unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `budget_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_amount` decimal(15,2) DEFAULT NULL,
  `pre_advance_amount` decimal(15,2) DEFAULT NULL,
  `advance_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `available_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `remaining_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `unplanned_available_snapshot` decimal(15,2) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `budget_head_id` int DEFAULT NULL,
  `budget_sub_head_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_advance_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_advance_rows_finance_breakup` (`finance_budget_breakup_id`),
  KEY `idx_expenditure_advance_rows_line` (`budget_line_id`),
  KEY `idx_expenditure_advance_rows_proposal` (`budget_proposal_id`),
  KEY `idx_expenditure_advance_rows_sort` (`expenditure_id`,`sort_order`),
  KEY `idx_ear_head_id` (`budget_head_id`),
  KEY `idx_ear_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_expenditure_advance_rows_finance_breakup` FOREIGN KEY (`finance_budget_breakup_id`) REFERENCES `finance_budget_breakup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_advance_rows_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_advance_rows_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_advance_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_advance_rows`
--


--
-- Table structure for table `expenditure_budget_ledger`
--

DROP TABLE IF EXISTS `expenditure_budget_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_budget_ledger` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `budget_line_id` int NOT NULL,
  `operation` enum('advance','expenditure','settlement','release') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `balance_after` decimal(15,2) DEFAULT NULL,
  `actor_user_id` int DEFAULT NULL,
  `remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_budget_ledger_expenditure` (`expenditure_id`),
  KEY `idx_expenditure_budget_ledger_budget_line` (`budget_line_id`),
  KEY `idx_expenditure_budget_ledger_created` (`created_at`),
  KEY `fk_expenditure_budget_ledger_user` (`actor_user_id`),
  CONSTRAINT `fk_expenditure_budget_ledger_budget_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_budget_ledger_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_budget_ledger_user` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_budget_ledger`
--


--
-- Table structure for table `expenditure_bulk_neft_files`
--

DROP TABLE IF EXISTS `expenditure_bulk_neft_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_bulk_neft_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `transaction_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NEFT' COMMENT 'Bulk transaction mode: NEFT, RTGS, UPI or DD',
  `bank_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Bank template the file was prepared from (AXIS, DBS)',
  `template_version` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expenditure_bulk_neft_request` (`expenditure_id`),
  KEY `idx_expenditure_bulk_neft_created` (`created_at`),
  CONSTRAINT `fk_expenditure_bulk_neft_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_expenditure_bulk_neft_file_format` CHECK (((upper(trim(coalesce(`transaction_type`,_utf8mb4'NEFT'))) = _utf8mb4'DD') or (lower(right(coalesce(`original_name`,_utf8mb4''),5)) = _utf8mb4'.xlsx') or (lower(right(coalesce(`original_name`,_utf8mb4''),4)) = _utf8mb4'.xls')))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_bulk_neft_files`
--


--
-- Table structure for table `expenditure_income_rows`
--

DROP TABLE IF EXISTS `expenditure_income_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_income_rows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `income_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contribution` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_account` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_income_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_income_rows_sort` (`expenditure_id`,`sort_order`),
  CONSTRAINT `fk_expenditure_income_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_income_rows`
--


--
-- Table structure for table `expenditure_line_rows`
--

DROP TABLE IF EXISTS `expenditure_line_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_line_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `finance_budget_breakup_id` int DEFAULT NULL,
  `budget_proposal_id` int DEFAULT NULL,
  `budget_line_id` int DEFAULT NULL,
  `amount_source` enum('planned','unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `budget_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_amount` decimal(15,2) DEFAULT NULL,
  `expenditure_input` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auto_sum_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `available_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `remaining_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `unplanned_available_snapshot` decimal(15,2) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `budget_head_id` int DEFAULT NULL,
  `budget_sub_head_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_line_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_line_rows_finance_breakup` (`finance_budget_breakup_id`),
  KEY `idx_expenditure_line_rows_line` (`budget_line_id`),
  KEY `idx_expenditure_line_rows_proposal` (`budget_proposal_id`),
  KEY `idx_expenditure_line_rows_sort` (`expenditure_id`,`sort_order`),
  KEY `idx_elr_head_id` (`budget_head_id`),
  KEY `idx_elr_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_expenditure_line_rows_finance_breakup` FOREIGN KEY (`finance_budget_breakup_id`) REFERENCES `finance_budget_breakup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_line_rows_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_line_rows_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_line_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=479 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_line_rows`
--


--
-- Table structure for table `expenditure_payee_rows`
--

DROP TABLE IF EXISTS `expenditure_payee_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_payee_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `payee_id` bigint DEFAULT NULL,
  `payee_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ifsc` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `mode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `beneficiary_type` enum('individual','organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual',
  `beneficiary_org` enum('KSRCT','KSREI','External') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organization_type` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msme` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstin` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tds_details` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tds_section` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_payee_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_payee_rows_payee` (`payee_id`),
  KEY `idx_expenditure_payee_rows_sort` (`expenditure_id`,`sort_order`),
  CONSTRAINT `fk_expenditure_payee_rows_payee` FOREIGN KEY (`payee_id`) REFERENCES `expenditure_payees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_payee_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=350 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_payee_rows`
--


--
-- Table structure for table `expenditure_payees`
--

DROP TABLE IF EXISTS `expenditure_payees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_payees` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `payee_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_no` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `branch_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ifsc` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beneficiary_type` enum('individual','organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual',
  `beneficiary_org` enum('KSRCT','KSREI','External') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `organization_type` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `msme` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstin` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tds_details` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tds_section` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `approval_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `requested_by` int DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expenditure_payees_account_ifsc` (`account_no`,`ifsc`),
  KEY `idx_expenditure_payees_name` (`payee_name`),
  KEY `idx_expenditure_payees_bank` (`bank_name`),
  KEY `idx_expenditure_payees_ifsc` (`ifsc`),
  KEY `idx_expenditure_payees_active_name` (`is_active`,`payee_name`),
  KEY `fk_expenditure_payees_user` (`created_by`),
  KEY `idx_expenditure_payees_approval_status` (`approval_status`),
  KEY `idx_expenditure_payees_requested_by` (`requested_by`),
  KEY `idx_expenditure_payees_approved_by` (`approved_by`),
  CONSTRAINT `fk_expenditure_payees_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_payees_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_payees_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_payees`
--


--
-- Table structure for table `expenditure_request_bills`
--

DROP TABLE IF EXISTS `expenditure_request_bills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_request_bills` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `payee_row_id` bigint DEFAULT NULL,
  `source_finance_annexure_id` bigint unsigned DEFAULT NULL COMMENT 'FK to finance_request_annexures when this bill is reused from the linked finance request',
  `file_category` enum('bill','payment_proof') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'bill',
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_request_bills_request` (`expenditure_id`),
  KEY `idx_expenditure_request_bills_payee_row` (`payee_row_id`),
  KEY `idx_expenditure_request_bills_sort` (`expenditure_id`,`sort_order`,`id`),
  KEY `idx_expenditure_request_bills_category` (`expenditure_id`,`file_category`),
  KEY `idx_expenditure_request_bills_finance_annexure` (`source_finance_annexure_id`),
  CONSTRAINT `fk_expenditure_request_bills_finance_annexure` FOREIGN KEY (`source_finance_annexure_id`) REFERENCES `finance_request_annexures` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_request_bills_payee_row` FOREIGN KEY (`payee_row_id`) REFERENCES `expenditure_payee_rows` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_request_bills_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=297 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_bills`
--


--
-- Table structure for table `expenditure_request_edits`
--

DROP TABLE IF EXISTS `expenditure_request_edits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_request_edits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expenditure_request_id` int NOT NULL,
  `edited_by_user_id` int DEFAULT NULL,
  `edited_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edited_by_role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_request_edits_request` (`expenditure_request_id`),
  KEY `idx_expenditure_request_edits_created` (`created_at`),
  KEY `fk_expenditure_request_edits_user` (`edited_by_user_id`),
  CONSTRAINT `fk_expenditure_request_edits_request` FOREIGN KEY (`expenditure_request_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_request_edits_user` FOREIGN KEY (`edited_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_edits`
--


--
-- Table structure for table `expenditure_request_ref_tracker`
--

DROP TABLE IF EXISTS `expenditure_request_ref_tracker`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_request_ref_tracker` (
  `ref_year` int NOT NULL,
  `last_sequence` int NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ref_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_ref_tracker`
--


--
-- Table structure for table `expenditure_request_refs`
--

DROP TABLE IF EXISTS `expenditure_request_refs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_request_refs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expenditure_request_id` int NOT NULL,
  `ref_year` int NOT NULL,
  `ref_sequence` int NOT NULL,
  `request_ref` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expenditure_request_refs_request_id` (`expenditure_request_id`),
  UNIQUE KEY `uq_expenditure_request_refs_request_ref` (`request_ref`),
  UNIQUE KEY `uq_expenditure_request_refs_year_seq` (`ref_year`,`ref_sequence`),
  KEY `idx_expenditure_request_refs_year` (`ref_year`),
  CONSTRAINT `fk_expenditure_request_refs_request` FOREIGN KEY (`expenditure_request_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=223 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_refs`
--


--
-- Table structure for table `expenditure_requests`
--

DROP TABLE IF EXISTS `expenditure_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_request_id` int NOT NULL,
  `employee_id` int DEFAULT NULL,
  `applicant_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_date` date NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `beneficiary_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beneficiary_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `budget_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `beneficiary_entity_id` int DEFAULT NULL,
  `primary_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_head_id` int DEFAULT NULL,
  `event_sub_head` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_sub_head_id` int DEFAULT NULL,
  `request_type` enum('Advance','Settlement','Expenditure') COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_budget_proposed` enum('Yes','No') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'No',
  `proposed_amount` decimal(15,2) DEFAULT NULL,
  `balance_amount` decimal(15,2) DEFAULT NULL,
  `unplanned_budget_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `unplanned_budget_amount` decimal(15,2) DEFAULT NULL,
  `unplanned_head_of_account` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unplanned_head_of_account_budget_line_id` int DEFAULT NULL,
  `unplanned_head_of_account_budget_proposal_id` int DEFAULT NULL,
  `unplanned_budget_head` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unplanned_budget_sub_head` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `unplanned_budget_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_status` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_amount_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_status` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `debit_status` enum('credited','reimbursement') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `partial_amount` decimal(15,2) DEFAULT NULL,
  `show_bulk_neft` tinyint(1) NOT NULL DEFAULT '0',
  `payment_mode` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_ref_no` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_date` date DEFAULT NULL,
  `payment_status` enum('Paid','Pending','Processing','Cancelled') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_debit_account` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `advance_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `settlement_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `expenditure_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `settlement_remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expenditure_remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tentative_settlement_date` date DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `director_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `director_comment` text COLLATE utf8mb4_unicode_ci,
  `principal_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `principal_comment` text COLLATE utf8mb4_unicode_ci,
  `principal_priority` enum('Routine','Urgent','Most Urgent') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chairman_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `chairman_comment` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `overall_status` enum('pending','approved','rejected','archived','deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `workflow_state` json DEFAULT NULL,
  `workflow_status` varchar(32) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.status')),_utf8mb4'in_progress')) STORED,
  `workflow_stage` varchar(64) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.currentStage')),_utf8mb4'')) STORED,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_requests_finance_id` (`finance_request_id`),
  KEY `idx_expenditure_requests_created_by` (`created_by`),
  KEY `idx_expenditure_requests_employee` (`employee_id`),
  KEY `idx_expenditure_requests_request_date` (`request_date`),
  KEY `idx_expenditure_requests_status` (`overall_status`),
  KEY `idx_expenditure_requests_type` (`request_type`),
  KEY `idx_expenditure_requests_department_id` (`department_id`),
  KEY `idx_expenditure_requests_entity_id` (`beneficiary_entity_id`),
  KEY `idx_expenditure_requests_budget_tag` (`budget_tag`),
  KEY `idx_expenditure_requests_workflow_status` (`workflow_status`),
  KEY `idx_expenditure_requests_workflow_stage` (`workflow_stage`),
  KEY `idx_expenditure_requests_workflow_stage_status` (`workflow_stage`,`workflow_status`),
  KEY `idx_expenditure_requests_finance_created` (`finance_request_id`,`created_by`,`created_at`),
  KEY `idx_expenditure_requests_created_fy_status` (`created_by`,`request_date`,`overall_status`),
  KEY `idx_er_primary_head_id` (`primary_head_id`),
  KEY `idx_er_event_sub_head_id` (`event_sub_head_id`),
  CONSTRAINT `fk_expenditure_requests_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_requests_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_requests_finance` FOREIGN KEY (`finance_request_id`) REFERENCES `finance_requests` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_requests_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=221 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_requests`
--


--
-- Table structure for table `expenditure_settlement_rows`
--

DROP TABLE IF EXISTS `expenditure_settlement_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_settlement_rows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `finance_budget_breakup_id` int DEFAULT NULL,
  `budget_proposal_id` int DEFAULT NULL,
  `budget_line_id` int DEFAULT NULL,
  `amount_source` enum('planned','unplanned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'planned',
  `budget_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `budget_amount` decimal(15,2) DEFAULT NULL,
  `advance_amount` decimal(15,2) DEFAULT NULL,
  `settlement_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `available_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `remaining_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `unplanned_available_snapshot` decimal(15,2) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `budget_head_id` int DEFAULT NULL,
  `budget_sub_head_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_settlement_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_settlement_rows_finance_breakup` (`finance_budget_breakup_id`),
  KEY `idx_expenditure_settlement_rows_line` (`budget_line_id`),
  KEY `idx_expenditure_settlement_rows_proposal` (`budget_proposal_id`),
  KEY `idx_expenditure_settlement_rows_sort` (`expenditure_id`,`sort_order`),
  KEY `idx_esr_head_id` (`budget_head_id`),
  KEY `idx_esr_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_expenditure_settlement_rows_finance_breakup` FOREIGN KEY (`finance_budget_breakup_id`) REFERENCES `finance_budget_breakup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_settlement_rows_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_settlement_rows_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_settlement_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_settlement_rows`
--


--
-- Table structure for table `expenditure_unplanned_rows`
--

DROP TABLE IF EXISTS `expenditure_unplanned_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_unplanned_rows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
  `head_of_account` varchar(255) NOT NULL,
  `head_of_account_budget_line_id` int NOT NULL,
  `head_of_account_budget_proposal_id` int DEFAULT NULL,
  `budget_head` varchar(255) NOT NULL,
  `sub_head` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `description` varchar(500) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenditure_unplanned_rows_request` (`expenditure_id`),
  KEY `idx_expenditure_unplanned_rows_head_line` (`head_of_account_budget_line_id`),
  KEY `idx_expenditure_unplanned_rows_head_proposal` (`head_of_account_budget_proposal_id`),
  CONSTRAINT `fk_expenditure_unplanned_rows_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_unplanned_rows`
--


--
-- Table structure for table `finance_budget_breakup`
--

DROP TABLE IF EXISTS `finance_budget_breakup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_budget_breakup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `budget_proposal_id` int DEFAULT NULL,
  `budget_line_id` int DEFAULT NULL,
  `budget_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_amount` decimal(15,2) DEFAULT NULL,
  `available_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `remaining_amount_snapshot` decimal(15,2) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_topup` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = row was added as part of a topup resubmission; 0 = original row',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `budget_head_id` int DEFAULT NULL,
  `budget_sub_head_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_finance_budget_breakup_finance` (`finance_id`),
  KEY `idx_finance_budget_breakup_line` (`budget_line_id`),
  KEY `idx_finance_budget_breakup_proposal` (`budget_proposal_id`),
  KEY `idx_finance_budget_breakup_sort` (`finance_id`,`sort_order`),
  KEY `idx_fbb_head_id` (`budget_head_id`),
  KEY `idx_fbb_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_finance_budget_breakup_budget_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_budget_breakup_budget_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_budget_breakup_finance` FOREIGN KEY (`finance_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2147 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_budget_breakup`
--


--
-- Table structure for table `finance_budget_line_usage`
--

DROP TABLE IF EXISTS `finance_budget_line_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_budget_line_usage` (
  `budget_line_id` int NOT NULL,
  `consumed_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`budget_line_id`),
  CONSTRAINT `fk_finance_budget_line_usage_budget_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_budget_line_usage`
--


--
-- Table structure for table `finance_budget_usage_ledger`
--

DROP TABLE IF EXISTS `finance_budget_usage_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_budget_usage_ledger` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `finance_budget_breakup_id` int DEFAULT NULL,
  `budget_line_id` int NOT NULL,
  `operation` enum('consume','release','adjust') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'consume',
  `amount` decimal(15,2) NOT NULL,
  `balance_after` decimal(15,2) NOT NULL,
  `actor_user_id` int DEFAULT NULL,
  `remarks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_budget_usage_ledger_finance` (`finance_id`),
  KEY `idx_finance_budget_usage_ledger_budget_line` (`budget_line_id`),
  KEY `idx_finance_budget_usage_ledger_created` (`created_at`),
  KEY `fk_finance_budget_usage_ledger_breakup` (`finance_budget_breakup_id`),
  KEY `fk_finance_budget_usage_ledger_actor` (`actor_user_id`),
  CONSTRAINT `fk_finance_budget_usage_ledger_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_budget_usage_ledger_breakup` FOREIGN KEY (`finance_budget_breakup_id`) REFERENCES `finance_budget_breakup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_budget_usage_ledger_budget_line` FOREIGN KEY (`budget_line_id`) REFERENCES `budget_proposal_lines` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_budget_usage_ledger_finance` FOREIGN KEY (`finance_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=522 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_budget_usage_ledger`
--


--
-- Table structure for table `finance_carry_forward_allocations`
--

DROP TABLE IF EXISTS `finance_carry_forward_allocations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_carry_forward_allocations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_request_id` int NOT NULL,
  `source_fiscal_year` int NOT NULL,
  `target_fiscal_year` int NOT NULL,
  `carry_forward_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `used_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `remarks` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by_user_id` int DEFAULT NULL,
  `created_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_cf_active_target` (`finance_request_id`,`target_fiscal_year`,`status`),
  KEY `idx_finance_cf_finance` (`finance_request_id`),
  KEY `idx_finance_cf_source_fy` (`source_fiscal_year`),
  KEY `idx_finance_cf_target_fy` (`target_fiscal_year`),
  CONSTRAINT `fk_finance_cf_request` FOREIGN KEY (`finance_request_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_carry_forward_allocations`
--


--
-- Table structure for table `finance_income_rows`
--

DROP TABLE IF EXISTS `finance_income_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_income_rows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `income_source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contribution` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remarks` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_account` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_income_rows_finance` (`finance_id`),
  KEY `idx_finance_income_rows_sort` (`finance_id`,`sort_order`),
  CONSTRAINT `fk_finance_income_rows_request` FOREIGN KEY (`finance_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_income_rows`
--


--
-- Table structure for table `finance_request_annexures`
--

DROP TABLE IF EXISTS `finance_request_annexures`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_request_annexures` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `annexure_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stored_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_request_annexures_finance_id` (`finance_id`),
  KEY `idx_finance_request_annexures_sort` (`finance_id`,`sort_order`,`id`),
  CONSTRAINT `fk_finance_request_annexures_finance_id` FOREIGN KEY (`finance_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=887 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_annexures`
--


--
-- Table structure for table `finance_request_edits`
--

DROP TABLE IF EXISTS `finance_request_edits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_request_edits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_request_id` int NOT NULL,
  `edited_by_user_id` int DEFAULT NULL,
  `edited_by_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edited_by_role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `summary` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `details` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_request_edits_request` (`finance_request_id`),
  KEY `idx_finance_request_edits_created` (`created_at`),
  KEY `fk_finance_request_edits_user` (`edited_by_user_id`),
  CONSTRAINT `fk_finance_request_edits_request` FOREIGN KEY (`finance_request_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_request_edits_user` FOREIGN KEY (`edited_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=460 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_edits`
--


--
-- Table structure for table `finance_request_ref_tracker`
--

DROP TABLE IF EXISTS `finance_request_ref_tracker`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_request_ref_tracker` (
  `ref_year` int NOT NULL,
  `last_sequence` int NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ref_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_ref_tracker`
--


--
-- Table structure for table `finance_request_refs`
--

DROP TABLE IF EXISTS `finance_request_refs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_request_refs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_request_id` int NOT NULL,
  `ref_year` int NOT NULL,
  `ref_sequence` int NOT NULL,
  `request_ref` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_finance_request_refs_request_id` (`finance_request_id`),
  UNIQUE KEY `uq_finance_request_refs_request_ref` (`request_ref`),
  UNIQUE KEY `uq_finance_request_refs_year_seq` (`ref_year`,`ref_sequence`),
  KEY `idx_finance_request_refs_year` (`ref_year`),
  CONSTRAINT `fk_finance_request_refs_request` FOREIGN KEY (`finance_request_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=452 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_refs`
--


--
-- Table structure for table `finance_requests`
--

DROP TABLE IF EXISTS `finance_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL,
  `applicant_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_date` date NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `beneficiary_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `beneficiary_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `budget_tag` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `beneficiary_entity_id` int DEFAULT NULL,
  `primary_head` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_head_id` int DEFAULT NULL,
  `event_sub_head` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_sub_head_id` int DEFAULT NULL,
  `is_budget_proposed` enum('Yes','No') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'No',
  `proposed_amount` decimal(15,2) DEFAULT NULL,
  `balance_amount` decimal(15,2) DEFAULT NULL,
  `unplanned_budget_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `unplanned_budget_amount` decimal(15,2) DEFAULT NULL,
  `unplanned_budget_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_status` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_amount_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credit_status` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `debit_status` enum('credited','reimbursement') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_debit_account` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'College debit source account',
  `closed_at` timestamp NULL DEFAULT NULL COMMENT 'When the finance card was manually finalized & closed',
  `closed_by` int DEFAULT NULL COMMENT 'FK to users - who finalized & closed the finance card',
  `partial_amount` decimal(15,2) DEFAULT NULL,
  `enclosures` json DEFAULT NULL,
  `annexure_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annexure_file_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annexure_storage_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annexure_file_path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annexure_mime_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annexure_file_size` bigint DEFAULT NULL,
  `total_budget` decimal(15,2) NOT NULL DEFAULT '0.00',
  `approved_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `director_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `director_comment` text COLLATE utf8mb4_unicode_ci,
  `principal_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `principal_comment` text COLLATE utf8mb4_unicode_ci,
  `principal_priority` enum('High','Medium','Low') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chairman_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `chairman_comment` text COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `overall_status` enum('pending','approved','rejected','archived','deleted') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `workflow_state` json DEFAULT NULL,
  `workflow_status` varchar(32) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.status')),_utf8mb4'in_progress')) STORED,
  `workflow_stage` varchar(64) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (coalesce(json_unquote(json_extract(`workflow_state`,_utf8mb4'$.currentStage')),_utf8mb4'')) STORED,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_requests_created_by` (`created_by`),
  KEY `idx_finance_requests_employee` (`employee_id`),
  KEY `idx_finance_requests_request_date` (`request_date`),
  KEY `idx_finance_requests_status` (`overall_status`),
  KEY `idx_finance_requests_department_id` (`department_id`),
  KEY `idx_finance_requests_beneficiary_entity_id` (`beneficiary_entity_id`),
  KEY `idx_finance_requests_budget_tag` (`budget_tag`),
  KEY `idx_finance_requests_workflow_status` (`workflow_status`),
  KEY `idx_finance_requests_workflow_stage` (`workflow_stage`),
  KEY `idx_finance_requests_workflow_stage_status` (`workflow_stage`,`workflow_status`),
  KEY `idx_fr_primary_head_id` (`primary_head_id`),
  KEY `idx_fr_event_sub_head_id` (`event_sub_head_id`),
  KEY `fk_finance_closed_by` (`closed_by`),
  CONSTRAINT `fk_finance_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_finance_requests_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=452 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_requests`
--


--
-- Table structure for table `finance_status_updates`
--

DROP TABLE IF EXISTS `finance_status_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_status_updates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` enum('director','principal','chairman','applicant') NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_id` (`finance_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_status_finance` FOREIGN KEY (`finance_id`) REFERENCES `finance_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_status_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_status_updates`
--


--
-- Table structure for table `journal_indexes`
--

DROP TABLE IF EXISTS `journal_indexes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_indexes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_id` int DEFAULT NULL,
  `index_name` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `journal_id` (`journal_id`),
  CONSTRAINT `journal_indexes_ibfk_1` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_indexes`
--


--
-- Table structure for table `journal_options`
--

DROP TABLE IF EXISTS `journal_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_name` varchar(255) NOT NULL,
  `publisher` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `print_issn` varchar(20) DEFAULT NULL,
  `online_issn` varchar(20) DEFAULT NULL,
  `impact_factor` decimal(10,3) DEFAULT NULL,
  `cite_score` decimal(10,3) DEFAULT NULL,
  `category` enum('National','International') NOT NULL DEFAULT 'National',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journal_options_name` (`journal_name`),
  KEY `idx_journal_options_publisher` (`publisher`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_options`
--


--
-- Table structure for table `journal_requests`
--

DROP TABLE IF EXISTS `journal_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `journal_name` varchar(255) NOT NULL,
  `publisher` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `print_issn` varchar(20) DEFAULT NULL,
  `online_issn` varchar(20) DEFAULT NULL,
  `impact_factor` decimal(10,3) DEFAULT NULL,
  `cite_score` decimal(10,3) DEFAULT NULL,
  `category` enum('National','International') NOT NULL DEFAULT 'National',
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `journal_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_requests`
--


--
-- Table structure for table `journal_status_updates`
--

DROP TABLE IF EXISTS `journal_status_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_status_updates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` varchar(50) NOT NULL,
  `user_comment` text,
  `admin_reply` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journal_id` (`journal_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `journal_status_updates_ibfk_1` FOREIGN KEY (`journal_id`) REFERENCES `journals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `journal_status_updates_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_status_updates`
--


--
-- Table structure for table `journals`
--

DROP TABLE IF EXISTS `journals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `book_chapter_title` varchar(255) DEFAULT NULL,
  `publication_details` json DEFAULT NULL,
  `type` varchar(100) NOT NULL,
  `quartile` varchar(2) DEFAULT NULL,
  `impact_factor` decimal(10,3) DEFAULT NULL,
  `cite_score` decimal(10,3) DEFAULT NULL,
  `acknowledgement` json DEFAULT NULL,
  `date_of_submission` date DEFAULT NULL,
  `status` varchar(50) DEFAULT 'waiting',
  `admin_approval_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_approval_comment` text,
  `admin_approved_by` int DEFAULT NULL,
  `admin_approved_at` timestamp NULL DEFAULT NULL,
  `admin_rejected_by` int DEFAULT NULL,
  `admin_rejected_at` timestamp NULL DEFAULT NULL,
  `volume` varchar(50) DEFAULT NULL,
  `issue` varchar(50) DEFAULT NULL,
  `issue_type` varchar(50) DEFAULT NULL,
  `pages_from` int DEFAULT NULL,
  `pages_to` int DEFAULT NULL,
  `article_number` varchar(50) DEFAULT NULL,
  `abstract` text,
  `keywords` text,
  `sdgs` json DEFAULT NULL,
  `doi` varchar(255) DEFAULT NULL,
  `accepted_date` date DEFAULT NULL,
  `available_online_date` date DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_affiliation` json DEFAULT NULL,
  `external_details` json DEFAULT NULL,
  `journal_options_id` int NOT NULL,
  `driven_by` enum('faculty','student') DEFAULT 'faculty',
  `credit_to` varchar(255) DEFAULT NULL,
  `reference_number` varchar(255) DEFAULT NULL,
  `scopus_id` varchar(100) DEFAULT NULL,
  `scie_id` varchar(100) DEFAULT NULL,
  `open_access` varchar(3) DEFAULT NULL,
  `year` varchar(4) DEFAULT NULL,
  `wos_id` varchar(100) DEFAULT NULL,
  `pubmed_pmid` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_journal_options` (`journal_options_id`),
  KEY `idx_journals_admin_approval_status` (`admin_approval_status`),
  KEY `fk_journals_admin_approved_by` (`admin_approved_by`),
  KEY `fk_journals_admin_rejected_by` (`admin_rejected_by`),
  CONSTRAINT `fk_journal_options` FOREIGN KEY (`journal_options_id`) REFERENCES `journal_options` (`id`),
  CONSTRAINT `fk_journals_admin_approved_by` FOREIGN KEY (`admin_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_journals_admin_rejected_by` FOREIGN KEY (`admin_rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journals`
--


--
-- Temporary view structure for view `master_cells`
--

DROP TABLE IF EXISTS `master_cells`;
/*!50001 DROP VIEW IF EXISTS `master_cells`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `master_cells` AS SELECT 
 1 AS `id`,
 1 AS `code`,
 1 AS `name`,
 1 AS `is_active`,
 1 AS `sort_order`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `master_centres`
--

DROP TABLE IF EXISTS `master_centres`;
/*!50001 DROP VIEW IF EXISTS `master_centres`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `master_centres` AS SELECT 
 1 AS `id`,
 1 AS `code`,
 1 AS `name`,
 1 AS `is_active`,
 1 AS `sort_order`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `master_clubs`
--

DROP TABLE IF EXISTS `master_clubs`;
/*!50001 DROP VIEW IF EXISTS `master_clubs`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `master_clubs` AS SELECT 
 1 AS `id`,
 1 AS `code`,
 1 AS `name`,
 1 AS `is_active`,
 1 AS `sort_order`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `master_departments`
--

DROP TABLE IF EXISTS `master_departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(20) DEFAULT NULL COMMENT 'Short code like CSE, ECE, MBA',
  `name` varchar(255) NOT NULL COMMENT 'Full department name',
  `parent_id` int DEFAULT NULL COMMENT 'For parent department relationship (e.g., ECE under Engineering)',
  `type` enum('Academic','Administrative','Support','Research') DEFAULT 'Academic',
  `hod_name` varchar(255) DEFAULT NULL COMMENT 'Head of Department name (denormalized for quick access)',
  `email` varchar(255) DEFAULT NULL COMMENT 'Department email',
  `phone` varchar(20) DEFAULT NULL COMMENT 'Department phone',
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0' COMMENT 'For custom ordering in dropdowns',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_dept_code` (`code`),
  KEY `idx_dept_name` (`name`),
  KEY `idx_dept_parent` (`parent_id`),
  KEY `idx_dept_active` (`is_active`),
  CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parent_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_departments`
--


--
-- Table structure for table `master_employees`
--

DROP TABLE IF EXISTS `master_employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `erp_id` varchar(50) NOT NULL COMMENT 'Unique ERP/Employee ID from college system',
  `title` varchar(20) DEFAULT NULL COMMENT 'Dr., Mr., Mrs., Ms., Prof.',
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `gender` enum('Male','Female','Other') DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `alternate_email` varchar(255) DEFAULT NULL COMMENT 'Personal email',
  `designation` varchar(150) DEFAULT NULL COMMENT 'Professor, Associate Professor, Assistant Professor, etc.',
  `department_id` int DEFAULT NULL COMMENT 'FK to master_departments',
  `entity_id` int DEFAULT NULL COMMENT 'FK to master_entities for non-departmental staff',
  `parent_department_id` int DEFAULT NULL,
  `employee_type` enum('Teaching','Non-Teaching','Contract','Visiting','Guest Faculty') DEFAULT 'Teaching',
  `dob` date DEFAULT NULL COMMENT 'Date of Birth',
  `doj` date DEFAULT NULL COMMENT 'Date of Joining',
  `dor` date DEFAULT NULL COMMENT 'Date of Retirement (can be calculated or entered)',
  `status` enum('Active','Retired','Resigned','On Leave','Deputation','Terminated','Deceased','Relieved') DEFAULT 'Active',
  `orcid_id` varchar(50) DEFAULT NULL COMMENT 'ORCID ID (format: 0000-0000-0000-0000)',
  `wos_researcher_id` varchar(50) DEFAULT NULL COMMENT 'Web of Science Researcher ID',
  `scopus_id` varchar(50) DEFAULT NULL COMMENT 'Scopus Author ID',
  `google_scholar_id` varchar(100) DEFAULT NULL COMMENT 'Google Scholar Profile ID',
  `research_gate_id` varchar(100) DEFAULT NULL COMMENT 'ResearchGate profile',
  `user_id` int DEFAULT NULL COMMENT 'FK to users table if they have login access',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL COMMENT 'User who created this record',
  PRIMARY KEY (`id`),
  UNIQUE KEY `erp_id` (`erp_id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_emp_erp` (`erp_id`),
  KEY `idx_emp_email` (`email`),
  KEY `idx_emp_dept` (`department_id`),
  KEY `idx_emp_status` (`status`),
  KEY `idx_emp_designation` (`designation`),
  KEY `idx_emp_name` (`first_name`,`last_name`),
  KEY `idx_emp_doj` (`doj`),
  KEY `idx_emp_orcid` (`orcid_id`),
  KEY `idx_emp_scopus` (`scopus_id`),
  KEY `fk_emp_user` (`user_id`),
  KEY `idx_emp_parent_dept` (`parent_department_id`),
  KEY `idx_emp_entity` (`entity_id`),
  CONSTRAINT `fk_emp_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_entity` FOREIGN KEY (`entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_parent_department` FOREIGN KEY (`parent_department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=435 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_employees`
--


--
-- Table structure for table `master_entities`
--

DROP TABLE IF EXISTS `master_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_entities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type_id` int NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_entities_type_name` (`entity_type_id`,`name`),
  KEY `idx_master_entities_type` (`entity_type_id`),
  KEY `idx_master_entities_code` (`code`),
  KEY `idx_master_entities_active` (`is_active`),
  CONSTRAINT `fk_master_entities_type` FOREIGN KEY (`entity_type_id`) REFERENCES `master_entity_types` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=291 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entities`
--


--
-- Table structure for table `master_entity_contacts`
--

DROP TABLE IF EXISTS `master_entity_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_entity_contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_id` int NOT NULL,
  `role` enum('office','hod','finance','generic') NOT NULL DEFAULT 'office',
  `email` varchar(255) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_entity_contacts` (`entity_id`,`role`,`email`),
  KEY `idx_master_entity_contacts_email` (`email`),
  KEY `idx_master_entity_contacts_entity` (`entity_id`),
  CONSTRAINT `fk_master_entity_contacts_entity` FOREIGN KEY (`entity_id`) REFERENCES `master_entities` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=264 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entity_contacts`
--


--
-- Table structure for table `master_entity_types`
--

DROP TABLE IF EXISTS `master_entity_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `master_entity_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_entity_types_code` (`code`),
  KEY `idx_master_entity_types_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entity_types`
--


--
-- Temporary view structure for view `master_professional_bodies`
--

DROP TABLE IF EXISTS `master_professional_bodies`;
/*!50001 DROP VIEW IF EXISTS `master_professional_bodies`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `master_professional_bodies` AS SELECT 
 1 AS `id`,
 1 AS `code`,
 1 AS `name`,
 1 AS `is_active`,
 1 AS `sort_order`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module_key` varchar(100) NOT NULL,
  `action_key` varchar(50) NOT NULL,
  `permission_key` varchar(160) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_key` (`permission_key`),
  UNIQUE KEY `uq_permissions_module_action` (`module_key`,`action_key`)
) ENGINE=InnoDB AUTO_INCREMENT=10955 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--


--
-- Table structure for table `project_collaborators`
--

DROP TABLE IF EXISTS `project_collaborators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_collaborators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `category` varchar(100) DEFAULT NULL COMMENT 'Academic / Industry / Government / NGO / International',
  `role` varchar(255) DEFAULT NULL COMMENT 'Role played in the project',
  `organization_id` int DEFAULT NULL COMMENT 'FK to project_organizations when picked from the master',
  `organization_name` varchar(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  `city` varchar(150) DEFAULT NULL,
  `has_active_mou` tinyint(1) NOT NULL DEFAULT '0',
  `contact_name` varchar(255) DEFAULT NULL,
  `contact_designation` varchar(150) DEFAULT NULL,
  `contact_email` varchar(255) DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_project_collaborators_project` (`project_id`,`display_order`),
  KEY `idx_project_collaborators_organization` (`organization_id`),
  CONSTRAINT `fk_project_collaborators_organization` FOREIGN KEY (`organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_project_collaborators_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_collaborators`
--


--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `disbursement_id` int DEFAULT NULL COMMENT 'Set for the per-tranche document slots',
  `document_type` enum('presentation','sanction_order','project_report','utilization_certificate_soe','bill_copies','bank_statement','disbursement_sanction','disbursement_uc_soe','disbursement_report') NOT NULL,
  `file_path` varchar(500) NOT NULL COMMENT 'Path under uploads/, served at /uploads',
  `original_name` varchar(255) DEFAULT NULL,
  `file_size` int unsigned DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_documents_project` (`project_id`,`document_type`),
  KEY `idx_project_documents_disbursement` (`disbursement_id`),
  KEY `fk_project_documents_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_project_documents_disbursement` FOREIGN KEY (`disbursement_id`) REFERENCES `project_grant_disbursements` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_documents_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_documents_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_documents`
--


--
-- Table structure for table `project_finance_row_heads`
--

DROP TABLE IF EXISTS `project_finance_row_heads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_finance_row_heads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_row_id` int NOT NULL,
  `budget_head_id` int DEFAULT NULL COMMENT 'FK to budget_heads; NULL keeps a head that was later retired',
  `budget_head_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Snapshot of the head name at save time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_finance_row_heads` (`finance_row_id`,`budget_head_id`),
  KEY `idx_project_finance_row_heads_head` (`budget_head_id`),
  CONSTRAINT `fk_project_finance_row_heads_head` FOREIGN KEY (`budget_head_id`) REFERENCES `budget_heads` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_project_finance_row_heads_row` FOREIGN KEY (`finance_row_id`) REFERENCES `project_finance_rows` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_finance_row_heads`
--


--
-- Table structure for table `project_finance_rows`
--

DROP TABLE IF EXISTS `project_finance_rows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_finance_rows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `row_type` enum('contribution','sharing') NOT NULL,
  `organization_id` int DEFAULT NULL,
  `organization_name` varchar(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  `amount` decimal(15,2) DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_project_finance_rows_project` (`project_id`,`row_type`,`display_order`),
  KEY `idx_project_finance_rows_organization` (`organization_id`),
  CONSTRAINT `fk_project_finance_rows_organization` FOREIGN KEY (`organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_project_finance_rows_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_finance_rows`
--


--
-- Table structure for table `project_grant_disbursements`
--

DROP TABLE IF EXISTS `project_grant_disbursements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_grant_disbursements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `financial_year` varchar(9) DEFAULT NULL COMMENT 'e.g. 2025-26',
  `organization_id` int DEFAULT NULL,
  `organization_name` varchar(255) DEFAULT NULL COMMENT 'Snapshot / free-text organization name',
  `amount` decimal(15,2) DEFAULT NULL,
  `disbursement_date` date DEFAULT NULL,
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_grant_disbursements_project` (`project_id`,`display_order`),
  KEY `idx_project_grant_disbursements_fy` (`financial_year`),
  KEY `fk_project_grant_disbursements_organization` (`organization_id`),
  CONSTRAINT `fk_project_grant_disbursements_organization` FOREIGN KEY (`organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_project_grant_disbursements_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_grant_disbursements`
--


--
-- Table structure for table `project_investigators`
--

DROP TABLE IF EXISTS `project_investigators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_investigators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `member_type` enum('faculty','student','external') NOT NULL DEFAULT 'faculty',
  `author_id` int DEFAULT NULL COMMENT 'FK to authors.id for faculty / student / external rows',
  `name` varchar(255) DEFAULT NULL COMMENT 'Snapshot of the name at save time',
  `department` varchar(255) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `is_principal` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = Principal Investigator',
  `is_primary` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = primary (corresponding) investigator',
  `display_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_investigators_project` (`project_id`,`display_order`),
  KEY `idx_project_investigators_author` (`author_id`),
  CONSTRAINT `fk_project_investigators_author` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_project_investigators_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_investigators`
--


--
-- Table structure for table `project_organizations`
--

DROP TABLE IF EXISTS `project_organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'Full organization name (e.g. Department of Science and Technology)',
  `short_name` varchar(100) DEFAULT NULL COMMENT 'Acronym shown in compact dropdowns (e.g. DST)',
  `category` varchar(100) DEFAULT NULL COMMENT 'Government / Private / Industry / Academic / NGO / International',
  `city` varchar(150) DEFAULT NULL,
  `state` varchar(150) DEFAULT NULL,
  `country` varchar(100) NOT NULL DEFAULT 'India',
  `website` varchar(500) DEFAULT NULL,
  `is_funding_agency` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = offered in the Funding Agency dropdown',
  `is_internal` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1 = the host institution itself',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_organizations_name` (`name`),
  KEY `idx_project_organizations_active` (`is_active`),
  KEY `idx_project_organizations_funding` (`is_funding_agency`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_organizations`
--


--
-- Table structure for table `project_requests`
--

DROP TABLE IF EXISTS `project_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'Requester',
  `request_type` enum('organization','scheme') NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'Proposed organization / scheme name',
  `organization_id` int DEFAULT NULL COMMENT 'Parent organization for a scheme request',
  `organization_name` varchar(255) DEFAULT NULL COMMENT 'Free-text parent when it is not in the master yet',
  `domain` varchar(255) DEFAULT NULL,
  `category` varchar(150) DEFAULT NULL,
  `website` varchar(500) DEFAULT NULL,
  `description` text,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `admin_comment` text,
  `approved_record_id` int DEFAULT NULL COMMENT 'id created in the master table on approval',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_requests_status` (`status`),
  KEY `idx_project_requests_user` (`user_id`),
  KEY `idx_project_requests_type` (`request_type`),
  KEY `idx_project_requests_created` (`created_at`),
  KEY `fk_project_requests_organization` (`organization_id`),
  KEY `fk_project_requests_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_project_requests_organization` FOREIGN KEY (`organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_project_requests_reviewed_by` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_project_requests_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_requests`
--


--
-- Table structure for table `project_schemes`
--

DROP TABLE IF EXISTS `project_schemes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_schemes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organization_id` int NOT NULL COMMENT 'Funding organization offering the scheme',
  `name` varchar(255) NOT NULL COMMENT 'Scheme / call name (e.g. SERB-POWER, FIST, MODROB)',
  `domain` varchar(255) DEFAULT NULL COMMENT 'Research domain the call targets',
  `category` varchar(150) DEFAULT NULL COMMENT 'Scheme classification (e.g. Research Project, Infrastructure)',
  `website` varchar(500) DEFAULT NULL COMMENT 'Call / scheme landing page',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_schemes_org_name` (`organization_id`,`name`),
  KEY `idx_project_schemes_active` (`is_active`),
  CONSTRAINT `fk_project_schemes_organization` FOREIGN KEY (`organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_schemes`
--


--
-- Table structure for table `project_tags`
--

DROP TABLE IF EXISTS `project_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `tag_type` enum('national_initiative','sdg') NOT NULL,
  `tag_value` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_project_tags` (`project_id`,`tag_type`,`tag_value`),
  KEY `idx_project_tags_type_value` (`tag_type`,`tag_value`),
  CONSTRAINT `fk_project_tags_project` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_tags`
--


--
-- Table structure for table `research_projects`
--

DROP TABLE IF EXISTS `research_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `research_projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `driven_by` enum('faculty','student') NOT NULL DEFAULT 'faculty' COMMENT 'Whether the proposal is faculty- or student-driven',
  `title` varchar(500) NOT NULL,
  `project_cost` decimal(15,2) DEFAULT NULL COMMENT 'Total proposed project cost',
  `duration_years` tinyint unsigned DEFAULT NULL,
  `duration_months` tinyint unsigned DEFAULT NULL,
  `duration_days` smallint unsigned DEFAULT NULL,
  `funding_organization_id` int DEFAULT NULL,
  `scheme_id` int DEFAULT NULL,
  `collaborators_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `financial_contribution_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `finance_sharing_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `presentation_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `submitted_on` date DEFAULT NULL,
  `submission_mode` varchar(50) DEFAULT NULL COMMENT 'Online / Offline / Email / Portal / Post',
  `reference_number` varchar(150) DEFAULT NULL COMMENT 'Agency-side proposal reference number',
  `cfrd_copy_submitted` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Full proposal copy handed to CFRD',
  `cfrd_copy_submitted_on` date DEFAULT NULL,
  `proposal_status` enum('draft','submitted','accepted_for_evaluation','shortlisted','shortlisted_for_presentation','result_announced') NOT NULL DEFAULT 'draft',
  `presentation_date` date DEFAULT NULL,
  `presentation_venue` varchar(255) DEFAULT NULL,
  `presentation_panelists` varchar(1000) DEFAULT NULL,
  `result_mode` varchar(50) DEFAULT NULL COMMENT 'Email / Website / Letter / Portal',
  `result_date` date DEFAULT NULL,
  `final_result` enum('selected','not_selected') DEFAULT NULL,
  `sanction_date` date DEFAULT NULL,
  `sanction_reference_no` varchar(150) DEFAULT NULL,
  `sanction_mode` enum('installment','advance','reimbursement','advance_reimbursement') DEFAULT NULL,
  `project_start_date` date DEFAULT NULL,
  `project_closing_date` date DEFAULT NULL,
  `project_status` enum('ongoing','completed','closed') DEFAULT NULL,
  `outcome_journal_articles` int unsigned NOT NULL DEFAULT '0',
  `outcome_conferences` int unsigned NOT NULL DEFAULT '0',
  `outcome_iprs` int unsigned NOT NULL DEFAULT '0',
  `outcome_products` int unsigned NOT NULL DEFAULT '0',
  `outcome_tech_transfers` int unsigned NOT NULL DEFAULT '0',
  `outcome_startups` int unsigned NOT NULL DEFAULT '0',
  `remarks` text,
  `created_by` int DEFAULT NULL COMMENT 'users.id that created the record',
  `updated_by` int DEFAULT NULL COMMENT 'users.id of the last writer',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_research_projects_org` (`funding_organization_id`),
  KEY `idx_research_projects_scheme` (`scheme_id`),
  KEY `idx_research_projects_proposal_status` (`proposal_status`),
  KEY `idx_research_projects_project_status` (`project_status`),
  KEY `idx_research_projects_submitted_on` (`submitted_on`),
  KEY `idx_research_projects_created_by` (`created_by`),
  KEY `fk_research_projects_updated_by` (`updated_by`),
  CONSTRAINT `fk_research_projects_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_research_projects_organization` FOREIGN KEY (`funding_organization_id`) REFERENCES `project_organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_research_projects_scheme` FOREIGN KEY (`scheme_id`) REFERENCES `project_schemes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_research_projects_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `research_projects`
--


--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `granted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_role_permissions_permission` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--


--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_code` varchar(80) NOT NULL,
  `role_name` varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `is_admin_role` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_code` (`role_code`)
) ENGINE=InnoDB AUTO_INCREMENT=69108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--


--
-- Table structure for table `user_entity_roles`
--

DROP TABLE IF EXISTS `user_entity_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_entity_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `entity_id` int NOT NULL,
  `entity_type` enum('DEPARTMENT','CENTRE','CELL','CLUB','PROFESSIONAL_BODY','SECTION') COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_entity_role` (`user_id`,`entity_id`,`entity_type`,`role_id`),
  KEY `fk_uer_role` (`role_id`),
  CONSTRAINT `fk_uer_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=558 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_entity_roles`
--


--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_user_roles_role` (`role_id`),
  KEY `idx_user_roles_assigned_by` (`assigned_by`),
  CONSTRAINT `fk_user_roles_assigned_by` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--


--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `picture` varchar(512) DEFAULT NULL,
  `is_admin` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=347 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--


--
-- Temporary view structure for view `v_authors`
--

DROP TABLE IF EXISTS `v_authors`;
/*!50001 DROP VIEW IF EXISTS `v_authors`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_authors` AS SELECT 
 1 AS `author_id`,
 1 AS `author_code`,
 1 AS `author_name`,
 1 AS `email`,
 1 AS `designation`,
 1 AS `department`,
 1 AS `organization`,
 1 AS `erp_id`,
 1 AS `orcid_id`,
 1 AS `scopus_id`,
 1 AS `wos_researcher_id`,
 1 AS `google_scholar_id`,
 1 AS `author_type`,
 1 AS `employee_id`,
 1 AS `student_ref`,
 1 AS `created_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_budget_summary`
--

DROP TABLE IF EXISTS `v_budget_summary`;
/*!50001 DROP VIEW IF EXISTS `v_budget_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_budget_summary` AS SELECT 
 1 AS `id`,
 1 AS `proposal_ref`,
 1 AS `fiscal_year`,
 1 AS `beneficiary_type`,
 1 AS `beneficiary_value`,
 1 AS `beneficiary_entity_id`,
 1 AS `department_id`,
 1 AS `department`,
 1 AS `department_code`,
 1 AS `entity_name`,
 1 AS `entity_code`,
 1 AS `entity_type_name`,
 1 AS `entity_type_code`,
 1 AS `total_amount`,
 1 AS `status`,
 1 AS `current_stage`,
 1 AS `approval_flow`,
 1 AS `user_id`,
 1 AS `user_email`,
 1 AS `line_count`,
 1 AS `approval_count`,
 1 AS `calculated_total`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_employees`
--

DROP TABLE IF EXISTS `v_employees`;
/*!50001 DROP VIEW IF EXISTS `v_employees`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_employees` AS SELECT 
 1 AS `id`,
 1 AS `erp_id`,
 1 AS `full_name`,
 1 AS `first_name`,
 1 AS `last_name`,
 1 AS `email`,
 1 AS `mobile`,
 1 AS `designation`,
 1 AS `department_id`,
 1 AS `department_name`,
 1 AS `department_code`,
 1 AS `parent_department_name`,
 1 AS `entity_id`,
 1 AS `entity_name`,
 1 AS `entity_code`,
 1 AS `status`,
 1 AS `doj`,
 1 AS `orcid_id`,
 1 AS `scopus_id`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_finance_requests`
--

DROP TABLE IF EXISTS `v_finance_requests`;
/*!50001 DROP VIEW IF EXISTS `v_finance_requests`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_finance_requests` AS SELECT 
 1 AS `id`,
 1 AS `employee_id`,
 1 AS `created_by`,
 1 AS `applicant_name`,
 1 AS `designation`,
 1 AS `department`,
 1 AS `email`,
 1 AS `mobile`,
 1 AS `erp_id`,
 1 AS `is_external`,
 1 AS `request_date`,
 1 AS `description`,
 1 AS `beneficiary_type`,
 1 AS `beneficiary_value`,
 1 AS `primary_head`,
 1 AS `event_sub_head`,
 1 AS `is_budget_proposed`,
 1 AS `proposed_amount`,
 1 AS `balance_amount`,
 1 AS `total_budget`,
 1 AS `income_type`,
 1 AS `income_status`,
 1 AS `income_amount_type`,
 1 AS `credit_status`,
 1 AS `debit_status`,
 1 AS `partial_amount`,
 1 AS `enclosures`,
 1 AS `director_status`,
 1 AS `director_comment`,
 1 AS `principal_status`,
 1 AS `principal_comment`,
 1 AS `principal_priority`,
 1 AS `chairman_status`,
 1 AS `chairman_comment`,
 1 AS `overall_status`,
 1 AS `created_at`,
 1 AS `updated_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `workflow_actions`
--

DROP TABLE IF EXISTS `workflow_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_actions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `module_key` varchar(64) NOT NULL,
  `record_id` bigint NOT NULL,
  `stage` varchar(64) NOT NULL,
  `decision` enum('approved','rejected','returned','archived','deleted','resubmitted') NOT NULL,
  `feedback` text,
  `actor_user_id` int DEFAULT NULL,
  `actor_email` varchar(255) DEFAULT NULL,
  `actor_role` varchar(100) DEFAULT NULL,
  `decided_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `snapshot_before` json NOT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_workflow_actions_record` (`module_key`,`record_id`,`decided_at`),
  KEY `idx_workflow_actions_actor` (`actor_user_id`),
  KEY `idx_workflow_actions_stage` (`module_key`,`stage`,`decided_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2202 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_actions`
--


--
-- Table structure for table `workflow_stage_policies`
--

DROP TABLE IF EXISTS `workflow_stage_policies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `workflow_stage_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module_key` varchar(64) NOT NULL,
  `stage_key` varchar(64) NOT NULL,
  `scope_type` enum('global','department','entity') NOT NULL,
  `meta` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workflow_stage_policy` (`module_key`,`stage_key`),
  KEY `idx_workflow_stage_policy_module` (`module_key`),
  KEY `idx_workflow_stage_policy_scope` (`scope_type`),
  KEY `idx_workflow_stage_policy_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_stage_policies`
--


--
-- Dumping routines for database 'research'
--

--
-- Final view structure for view `master_cells`
--

/*!50001 DROP VIEW IF EXISTS `master_cells`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `master_cells` AS select `me`.`id` AS `id`,`me`.`code` AS `code`,`me`.`name` AS `name`,`me`.`is_active` AS `is_active`,`me`.`sort_order` AS `sort_order`,`me`.`created_at` AS `created_at`,`me`.`updated_at` AS `updated_at` from (`master_entities` `me` join `master_entity_types` `met` on((`me`.`entity_type_id` = `met`.`id`))) where (`met`.`code` = 'CELL') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `master_centres`
--

/*!50001 DROP VIEW IF EXISTS `master_centres`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `master_centres` AS select `me`.`id` AS `id`,`me`.`code` AS `code`,`me`.`name` AS `name`,`me`.`is_active` AS `is_active`,`me`.`sort_order` AS `sort_order`,`me`.`created_at` AS `created_at`,`me`.`updated_at` AS `updated_at` from (`master_entities` `me` join `master_entity_types` `met` on((`me`.`entity_type_id` = `met`.`id`))) where (`met`.`code` = 'CENTRE') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `master_clubs`
--

/*!50001 DROP VIEW IF EXISTS `master_clubs`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `master_clubs` AS select `me`.`id` AS `id`,`me`.`code` AS `code`,`me`.`name` AS `name`,`me`.`is_active` AS `is_active`,`me`.`sort_order` AS `sort_order`,`me`.`created_at` AS `created_at`,`me`.`updated_at` AS `updated_at` from (`master_entities` `me` join `master_entity_types` `met` on((`me`.`entity_type_id` = `met`.`id`))) where (`met`.`code` = 'CLUB') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `master_professional_bodies`
--

/*!50001 DROP VIEW IF EXISTS `master_professional_bodies`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `master_professional_bodies` AS select `me`.`id` AS `id`,`me`.`code` AS `code`,`me`.`name` AS `name`,`me`.`is_active` AS `is_active`,`me`.`sort_order` AS `sort_order`,`me`.`created_at` AS `created_at`,`me`.`updated_at` AS `updated_at` from (`master_entities` `me` join `master_entity_types` `met` on((`me`.`entity_type_id` = `met`.`id`))) where (`met`.`code` = 'PROFESSIONAL_BODY') */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_authors`
--

/*!50001 DROP VIEW IF EXISTS `v_authors`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_authors` AS select `a`.`id` AS `author_id`,`a`.`author_id` AS `author_code`,(case when (`a`.`employee_id` is not null) then trim(concat(`e`.`first_name`,' ',coalesce(`e`.`last_name`,''))) else `a`.`name` end) AS `author_name`,(case when (`a`.`employee_id` is not null) then `e`.`email` else `a`.`email` end) AS `email`,(case when (`a`.`employee_id` is not null) then `e`.`designation` else `a`.`designation` end) AS `designation`,(case when (`a`.`employee_id` is not null) then `d`.`name` else `a`.`department` end) AS `department`,(case when (`a`.`employee_id` is not null) then 'K.S.Rangasamy College of Technology' else `a`.`organization` end) AS `organization`,(case when (`a`.`employee_id` is not null) then `e`.`erp_id` else `s`.`student_unique_id` end) AS `erp_id`,`e`.`orcid_id` AS `orcid_id`,`e`.`scopus_id` AS `scopus_id`,`e`.`wos_researcher_id` AS `wos_researcher_id`,`e`.`google_scholar_id` AS `google_scholar_id`,(case when (`a`.`employee_id` is not null) then 'Internal' else 'External' end) AS `author_type`,`a`.`employee_id` AS `employee_id`,`a`.`student_ref` AS `student_ref`,`a`.`created_at` AS `created_at` from (((`authors` `a` left join `master_employees` `e` on((`a`.`employee_id` = `e`.`id`))) left join `master_departments` `d` on((`e`.`department_id` = `d`.`id`))) left join `author_students` `s` on((`a`.`student_ref` = `s`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_budget_summary`
--

/*!50001 DROP VIEW IF EXISTS `v_budget_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_budget_summary` AS select `bp`.`id` AS `id`,`bp`.`proposal_ref` AS `proposal_ref`,`bp`.`fiscal_year` AS `fiscal_year`,`bp`.`beneficiary_type` AS `beneficiary_type`,`bp`.`beneficiary_value` AS `beneficiary_value`,`bp`.`beneficiary_entity_id` AS `beneficiary_entity_id`,`bp`.`department_id` AS `department_id`,`md`.`name` AS `department`,`md`.`code` AS `department_code`,`me`.`name` AS `entity_name`,`me`.`code` AS `entity_code`,`met`.`name` AS `entity_type_name`,`met`.`code` AS `entity_type_code`,`bp`.`total_amount` AS `total_amount`,`bp`.`status` AS `status`,`bp`.`current_stage` AS `current_stage`,`bp`.`approval_flow` AS `approval_flow`,`bp`.`user_id` AS `user_id`,`bp`.`user_email` AS `user_email`,count(distinct `bpl`.`id`) AS `line_count`,count(distinct `bpa`.`id`) AS `approval_count`,sum(`bpl`.`line_total`) AS `calculated_total`,`bp`.`created_at` AS `created_at`,`bp`.`updated_at` AS `updated_at` from (((((`budget_proposals` `bp` left join `master_departments` `md` on((`bp`.`department_id` = `md`.`id`))) left join `master_entities` `me` on((`bp`.`beneficiary_entity_id` = `me`.`id`))) left join `master_entity_types` `met` on((`me`.`entity_type_id` = `met`.`id`))) left join `budget_proposal_lines` `bpl` on((`bp`.`id` = `bpl`.`budget_proposal_id`))) left join `budget_proposal_approvals` `bpa` on((`bp`.`id` = `bpa`.`budget_proposal_id`))) group by `bp`.`id`,`bp`.`proposal_ref`,`bp`.`fiscal_year`,`bp`.`beneficiary_type`,`bp`.`beneficiary_value`,`bp`.`beneficiary_entity_id`,`bp`.`department_id`,`md`.`name`,`md`.`code`,`me`.`name`,`me`.`code`,`met`.`name`,`met`.`code`,`bp`.`total_amount`,`bp`.`status`,`bp`.`current_stage`,`bp`.`approval_flow`,`bp`.`user_id`,`bp`.`user_email`,`bp`.`created_at`,`bp`.`updated_at` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_employees`
--

/*!50001 DROP VIEW IF EXISTS `v_employees`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_employees` AS select `e`.`id` AS `id`,`e`.`erp_id` AS `erp_id`,concat(coalesce(`e`.`title`,''),' ',`e`.`first_name`,' ',coalesce(`e`.`last_name`,'')) AS `full_name`,`e`.`first_name` AS `first_name`,`e`.`last_name` AS `last_name`,`e`.`email` AS `email`,`e`.`mobile` AS `mobile`,`e`.`designation` AS `designation`,`e`.`department_id` AS `department_id`,`d`.`name` AS `department_name`,`d`.`code` AS `department_code`,coalesce(`pd_emp`.`name`,`pd_dept`.`name`) AS `parent_department_name`,`e`.`entity_id` AS `entity_id`,`me`.`name` AS `entity_name`,`me`.`code` AS `entity_code`,`e`.`status` AS `status`,`e`.`doj` AS `doj`,`e`.`orcid_id` AS `orcid_id`,`e`.`scopus_id` AS `scopus_id` from ((((`master_employees` `e` left join `master_departments` `d` on((`e`.`department_id` = `d`.`id`))) left join `master_departments` `pd_emp` on((`e`.`parent_department_id` = `pd_emp`.`id`))) left join `master_departments` `pd_dept` on((`d`.`parent_id` = `pd_dept`.`id`))) left join `master_entities` `me` on((`e`.`entity_id` = `me`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_finance_requests`
--

/*!50001 DROP VIEW IF EXISTS `v_finance_requests`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`research`@`%` SQL SECURITY DEFINER */
/*!50001 VIEW `v_finance_requests` AS select `fr`.`id` AS `id`,`fr`.`employee_id` AS `employee_id`,`fr`.`created_by` AS `created_by`,coalesce(concat(coalesce(`e`.`title`,''),' ',`e`.`first_name`,' ',coalesce(`e`.`last_name`,'')),`fr`.`applicant_name`) AS `applicant_name`,coalesce(`e`.`designation`,`fr`.`designation`) AS `designation`,coalesce(`d`.`name`,`fr`.`department`) AS `department`,coalesce(`e`.`email`,`fr`.`email`) AS `email`,coalesce(`e`.`mobile`,`fr`.`mobile`) AS `mobile`,`e`.`erp_id` AS `erp_id`,(case when (`fr`.`employee_id` is null) then 1 else 0 end) AS `is_external`,`fr`.`request_date` AS `request_date`,`fr`.`description` AS `description`,`fr`.`beneficiary_type` AS `beneficiary_type`,`fr`.`beneficiary_value` AS `beneficiary_value`,`fr`.`primary_head` AS `primary_head`,`fr`.`event_sub_head` AS `event_sub_head`,`fr`.`is_budget_proposed` AS `is_budget_proposed`,`fr`.`proposed_amount` AS `proposed_amount`,`fr`.`balance_amount` AS `balance_amount`,`fr`.`total_budget` AS `total_budget`,`fr`.`income_type` AS `income_type`,`fr`.`income_status` AS `income_status`,`fr`.`income_amount_type` AS `income_amount_type`,`fr`.`credit_status` AS `credit_status`,`fr`.`debit_status` AS `debit_status`,`fr`.`partial_amount` AS `partial_amount`,`fr`.`enclosures` AS `enclosures`,`fr`.`director_status` AS `director_status`,`fr`.`director_comment` AS `director_comment`,`fr`.`principal_status` AS `principal_status`,`fr`.`principal_comment` AS `principal_comment`,`fr`.`principal_priority` AS `principal_priority`,`fr`.`chairman_status` AS `chairman_status`,`fr`.`chairman_comment` AS `chairman_comment`,`fr`.`overall_status` AS `overall_status`,`fr`.`created_at` AS `created_at`,`fr`.`updated_at` AS `updated_at` from ((`finance_requests` `fr` left join `master_employees` `e` on((`fr`.`employee_id` = `e`.`id`))) left join `master_departments` `d` on((`e`.`department_id` = `d`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-29 12:40:32
