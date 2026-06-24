-- MySQL dump 10.13  Distrib 9.5.0, for macos26.1 (arm64)
--
-- Host: localhost    Database: research
-- ------------------------------------------------------
-- Server version	9.5.0

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
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '282d57b8-e644-11f0-9663-b0390d93befd:1-4440,
87910104-9618-11f0-9b24-4e35220acde5:1-56';

--
-- Current Database: `research`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `research` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `research`;

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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_options`
--

LOCK TABLES `account_options` WRITE;
/*!40000 ALTER TABLE `account_options` DISABLE KEYS */;
INSERT INTO `account_options` VALUES (1,'PRINCIPAL GNERAL A/C | 0751301000015840',1,0,1,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(2,'KSRCT-PRINCIPAL COMMON A/C | 0751301000264891',1,0,2,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(3,'PRINCIPAL SCHOLARSHIP A/C | 0751301000001328',1,0,3,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(4,'PRINCIPAL KSRCT ASSOCIATION ACCOUNT | 0751301000028594',1,0,4,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(5,'STAFF CLUB A/C | 0751301000005664',1,0,5,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(6,'SOCIETY OF AUTOMOTIVE ENGINEERS (SAE) CLUB KSRCTA/C | 0751301000021422',1,0,6,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(7,'KSRCT IETE CHAPTER A/C | 0751301000265626',1,0,7,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(8,'KSRCT CIVIL SERB NPDF | 0751301000264860',1,0,8,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(9,'KSRCT CIVIL SERB NPDF 2 | 0751301000265593',1,0,9,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(10,'K S RANGASAMY COLLEGE OF TECHNOLOGY AUTONOMOUS | 0751302000000224',1,0,10,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(11,'KSRCT-CNST A/C | 0751301000045784',1,0,11,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(12,'CSI CHAPTER BRANCH OF KSRCT A/C | 0751301000185368',1,0,12,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(13,'KSRCT NSS CORPUS FUND | 0751301000047863',1,0,13,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(14,'PRINCIPAL NSS UNIT KSRCT | 0751301000004545',1,0,14,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(15,'IEEE Student KSRCT | 0751301000059822',1,0,15,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(16,'ISTE Student Chapter KSRCT | 0751301000023696',1,0,16,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(17,'KSRCT RPS AICTE Project | 0075133800000643',1,0,17,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(18,'KSRCT ECE SERB CRG PROJECT | 923010005584584',1,0,18,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(19,'K S RANGASAMY COLLEGE OF TECHNOLOGY CONTROLLER OF EXAMINATIONS | 925010007523846',1,0,19,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22'),(20,'KSRCT CONTROLLER OF EXAMINATIONS | CASH',1,0,20,NULL,NULL,'2026-06-01 04:50:22','2026-06-01 04:50:22');
/*!40000 ALTER TABLE `account_options` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `approval_flow_config`
--

LOCK TABLES `approval_flow_config` WRITE;
/*!40000 ALTER TABLE `approval_flow_config` DISABLE KEYS */;
INSERT INTO `approval_flow_config` VALUES (1,'Faculty',NULL,'[\"level1\", \"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(2,'Department',NULL,'[\"level1\", \"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(3,'Centre','CENTRE','[\"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(4,'Cell','CELL','[\"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(5,'Club','CLUB','[\"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(6,'Professional Body','PROFESSIONAL_BODY','[\"dof\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(7,'Institution',NULL,'[\"dof\", \"principal\"]','*',1,'2026-02-17 15:13:38','2026-03-23 05:40:53'),(8,'*',NULL,'[\"level1\", \"dof\", \"principal\"]','finance',1,'2026-03-23 05:40:53','2026-05-03 08:42:44'),(9,'*',NULL,'[\"level1\", \"dof\", \"principal\"]','finance',1,'2026-04-01 15:07:46','2026-05-03 08:42:44'),(10,'*',NULL,'[\"level1\", \"dof\", \"principal\"]','finance',1,'2026-04-01 15:45:50','2026-05-03 08:42:44'),(11,'*',NULL,'[\"level1\", \"dof\", \"principal\"]','expenditure',1,'2026-04-30 16:54:42','2026-04-30 16:54:42');
/*!40000 ALTER TABLE `approval_flow_config` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_journal`
--

LOCK TABLES `author_journal` WRITE;
/*!40000 ALTER TABLE `author_journal` DISABLE KEYS */;
INSERT INTO `author_journal` VALUES (1,1,1,'2026-01-31 06:26:05',1,1),(2,2,1,'2026-01-31 06:26:05',0,0),(3,1,2,'2026-01-31 06:29:59',1,1),(4,1,3,'2026-02-02 11:40:57',1,1),(5,1,4,'2026-02-09 05:49:33',1,1),(6,1,5,'2026-02-13 12:01:18',1,1),(7,1,6,'2026-03-18 06:16:19',1,1),(8,3,6,'2026-03-18 06:16:19',0,0),(9,1,7,'2026-04-06 11:02:40',1,1);
/*!40000 ALTER TABLE `author_journal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `author_project`
--

DROP TABLE IF EXISTS `author_project`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `author_project` (
  `id` int NOT NULL AUTO_INCREMENT,
  `author_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `is_principal` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_primary` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_author_project` (`author_id`,`project_id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_author` (`author_id`),
  CONSTRAINT `author_project_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `author_project_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_project`
--

LOCK TABLES `author_project` WRITE;
/*!40000 ALTER TABLE `author_project` DISABLE KEYS */;
/*!40000 ALTER TABLE `author_project` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `author_students` WRITE;
/*!40000 ALTER TABLE `author_students` DISABLE KEYS */;
/*!40000 ALTER TABLE `author_students` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `authors`
--

LOCK TABLES `authors` WRITE;
/*!40000 ALTER TABLE `authors` DISABLE KEYS */;
INSERT INTO `authors` VALUES (1,225,NULL,NULL,'faculty',NULL,'','','','2026-01-31 06:26:05','2026-01-31 06:26:05','',NULL),(2,105,NULL,NULL,'faculty',NULL,'','','','2026-01-31 06:26:05','2026-01-31 06:26:05','',NULL),(3,31,NULL,NULL,'faculty',NULL,'','','','2026-03-18 06:16:19','2026-03-18 06:16:19','',NULL);
/*!40000 ALTER TABLE `authors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Budget_annual`
--

DROP TABLE IF EXISTS `Budget_annual`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Budget_annual` (
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Budget_annual`
--

LOCK TABLES `Budget_annual` WRITE;
/*!40000 ALTER TABLE `Budget_annual` DISABLE KEYS */;
INSERT INTO `Budget_annual` VALUES (4,2026,'Department',NULL,2,NULL,27643300.00,27643300.00,0.00,27643300.00,0.00,30203300.00,27643300.00,'2026-03-27 18:07:04','2026-05-20 07:11:47');
/*!40000 ALTER TABLE `Budget_annual` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `budget_heads` WRITE;
/*!40000 ALTER TABLE `budget_heads` DISABLE KEYS */;
INSERT INTO `budget_heads` VALUES (1,'Civil Infrastructure','civil-infrastructure-1','Non-Recurring',0,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(2,'Electrical Infrastructure','electrical-infrastructure-2','Non-Recurring',1,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(3,'IT Infrastructure','it-infrastructure-3','Non-Recurring',2,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(4,'Furniture & Fixtures','furniture-and-fixtures-4','Non-Recurring',3,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(5,'Vehicles','vehicles-5','Non-Recurring',4,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(6,'Equipment','equipment-6','Non-Recurring',5,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(7,'Accessories & Kits','accessories-and-kits-7','Non-Recurring',6,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(8,'Library','library-8','Non-Recurring',7,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(9,'Maintenance Charges','maintenance-charges-9','Maintenance & Spares',8,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(10,'Spares','spares-10','Maintenance & Spares',9,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(11,'Annual Maintenance Charges','annual-maintenance-charges-11','Maintenance & Spares',10,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(12,'Consumables','consumables-12','Operational',11,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(13,'Software','software-13','Operational',12,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(14,'Membership & Subscriptions','membership-and-subscriptions-14','Operational',13,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(15,'College Essentials','college-essentials-15','Operational',14,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(16,'Student Essentials','student-essentials-16','Operational',15,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(17,'Printing','printing-17','Operational',16,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(18,'Stationery','stationery-18','Operational',17,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(19,'Printing & Stationery','printing-and-stationery-19','Operational',18,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(20,'Postal Expenses','postal-expenses-20','Operational',19,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(21,'Local Conveyance','local-conveyance-21','Operational',20,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(22,'Operational Expenses','operational-expenses-22','Operational',21,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(23,'Official Visits','official-visits-23','Operational',22,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(24,'Events & Competitions','events-and-competitions-24','Events & Engagement',23,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(25,'Meetings & Audits','meetings-and-audits-25','Events & Engagement',24,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(26,'Academic Events','academic-events-26','Events & Competitions',25,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(27,'Club Activities','club-activities-27','Events & Competitions',26,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(28,'College Events','college-events-28','Events & Competitions',27,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(29,'Conferences & Conclaves','conferences-and-conclaves-29','Events & Competitions',28,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(30,'Association Activities','association-activities-30','Events & Competitions',29,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(31,'Outreach Events','outreach-events-31','Events & Competitions',30,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(32,'Cultural & Celebrations','cultural-and-celebrations-32','Events & Competitions',31,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(33,'Sports','sports-33','Events & Competitions',32,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(34,'Competitions','competitions-34','Events & Competitions',33,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(35,'Institutional Governance Meetings','institutional-governance-meetings-35','Meetings & Audits',34,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(36,'Academic Governance Meetings','academic-governance-meetings-36','Meetings & Audits',35,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(37,'Institutional Audits','institutional-audits-37','Meetings & Audits',36,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(38,'Government Meetings','government-meetings-38','Meetings & Audits',37,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(39,'Faculty Empowerment','faculty-empowerment-39','Academics',38,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(40,'Staff Empowerment','staff-empowerment-40','Academics',39,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(41,'Student Empowerment','student-empowerment-41','Academics',40,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(42,'Student Capacity Building','student-capacity-building-42','Academics',41,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(43,'Ranking & Accreditation','ranking-and-accreditation-43','Academics',42,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(44,'Examination Expenses','examination-expenses-44','Academics',43,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(45,'Learning Resources','learning-resources-45','Academics',44,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(46,'Accreditation Expenses','accreditation-expenses-46','Academics',45,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(47,'Professional Body Expenses','professional-body-expenses-47','Academics',46,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(48,'Awards & Recognition','awards-and-recognition-48','Academics',47,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(49,'Advertisement & Branding','advertisement-and-branding-49','Branding & Outreach',48,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(50,'Public Relations','public-relations-50','Branding & Outreach',49,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(51,'Admissions','admissions-51','Branding & Outreach',50,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(52,'Research & Development','research-and-development-52','General',51,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(53,'Government Funded Projects','government-funded-projects-53','General',52,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(54,'Government Funded Events','government-funded-events-54','General',53,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(55,'Administrative Expenses','administrative-expenses-55','General',54,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(56,'Licenses & Taxes','licenses-and-taxes-56','General',55,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(57,'Salary','salary-57','General',56,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(58,'Bills & Payments','bills-and-payments-58','General',57,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(59,'Miscellaneous Expenses','miscellaneous-expenses-59','General',58,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00');
/*!40000 ALTER TABLE `budget_heads` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_line_month_allocations`
--

LOCK TABLES `budget_line_month_allocations` WRITE;
/*!40000 ALTER TABLE `budget_line_month_allocations` DISABLE KEYS */;
INSERT INTO `budget_line_month_allocations` VALUES (27,3,'Jun',1.00,'2026-03-14 11:01:51'),(29,3,'Aug',45.00,'2026-03-14 11:01:51'),(113,10,'Aug',122.00,'2026-03-23 05:48:02'),(121,11,'Jul',1000.00,'2026-04-02 08:26:46'),(122,12,'Aug',1000.00,'2026-04-02 08:26:46'),(123,13,'Aug',1000.00,'2026-04-02 08:26:46'),(125,15,'Aug',1999.00,'2026-04-10 04:54:10'),(126,15,'Sep',1999.00,'2026-04-10 04:54:10'),(127,16,'Aug',123.00,'2026-04-11 04:31:36'),(128,17,'Aug',22.00,'2026-04-11 04:31:36'),(129,18,'Aug',33.00,'2026-04-11 05:08:16'),(130,19,'Aug',12.00,'2026-04-16 05:19:28'),(131,20,'Aug',12222.00,'2026-04-16 11:59:14'),(132,21,'Aug',333.00,'2026-04-16 12:03:50'),(133,22,'Jul',2000.00,'2026-04-20 04:17:43'),(134,23,'Aug',2000.00,'2026-04-20 04:17:43'),(135,24,'Jun',100.00,'2026-04-22 13:50:20'),(136,25,'Sep',1200.00,'2026-04-22 13:50:20'),(137,26,'Jun',57000.00,'2026-04-27 04:18:23'),(138,26,'Aug',15000.00,'2026-04-27 04:18:23'),(139,26,'Feb',3000.00,'2026-04-27 04:18:23'),(140,27,'Aug',23.00,'2026-04-27 08:10:33'),(141,28,'Aug',12000.00,'2026-05-04 12:58:25'),(142,29,'Jul',2560000.00,'2026-05-20 06:58:57'),(143,30,'Aug',25000000.00,'2026-05-20 07:11:12');
/*!40000 ALTER TABLE `budget_line_month_allocations` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_approvals`
--

LOCK TABLES `budget_proposal_approvals` WRITE;
/*!40000 ALTER TABLE `budget_proposal_approvals` DISABLE KEYS */;
INSERT INTO `budget_proposal_approvals` VALUES (1,4,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-03-16 13:26:46'),(2,4,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-03-16 13:27:00'),(3,4,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-03-16 13:27:00'),(4,11,'coordinator',4,'maheshwaran3253@gmail.com','approved','',0,'2026-03-23 05:49:47'),(5,11,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-03-23 05:50:28'),(6,11,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-03-23 05:50:28'),(7,12,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-02 08:27:09'),(8,12,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-04-02 08:28:38'),(9,12,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-04-02 08:28:38'),(10,13,'hod',1,'maverickmyth333@gmail.com','returned','redo',1,'2026-04-10 04:53:44'),(11,13,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-10 04:55:20'),(12,10,'hod',1,'maverickmyth333@gmail.com','updated','Approved values updated for Row No. 1',0,'2026-04-11 04:29:49'),(13,13,'dof',3,'gingfreecss325@gmail.com','updated','Approved values updated for Row No. 1',0,'2026-04-11 04:33:13'),(14,10,'super_admin',1,'maverickmyth333@gmail.com','updated','Approved values updated for Row No. 1, 2',0,'2026-04-11 04:45:57'),(15,10,'super_admin',1,'maverickmyth333@gmail.com','updated','Approved values updated for Row No. 3',0,'2026-04-11 05:08:16'),(16,13,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-04-11 06:42:12'),(17,13,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-04-11 06:42:12'),(18,11,'super_admin',1,'maverickmyth333@gmail.com','deleted','Deleted by user',0,'2026-04-12 13:01:05'),(19,4,'super_admin',1,'maverickmyth333@gmail.com','deleted','Deleted by user',0,'2026-04-12 13:07:59'),(20,14,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-16 11:37:43'),(21,15,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-16 11:59:24'),(22,16,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-16 12:03:59'),(23,13,'principal',1,'maverickmyth333@gmail.com','returned','do it',1,'2026-04-16 13:03:23'),(24,13,'principal',1,'maverickmyth333@gmail.com','returned','no',1,'2026-04-18 04:50:44'),(25,17,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-20 04:18:29'),(26,17,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-04-20 04:18:51'),(27,17,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-04-20 04:18:51'),(28,18,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-22 13:50:30'),(29,18,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-04-22 13:51:28'),(30,18,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-04-22 13:51:28'),(31,19,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-04-27 04:18:30'),(32,19,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-04-27 04:22:16'),(33,19,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-04-27 04:22:16'),(34,21,'dof',3,'gingfreecss325@gmail.com','approved','Directly approved by DoF on submission',0,'2026-05-04 12:58:25'),(35,21,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-05-04 12:58:25'),(36,23,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-05-20 07:11:18'),(37,22,'hod',2,'maheshwaran325@gmail.com','approved','',0,'2026-05-20 07:11:21'),(38,23,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-05-20 07:11:45'),(39,23,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-05-20 07:11:45'),(40,22,'dof',3,'gingfreecss325@gmail.com','approved','',0,'2026-05-20 07:11:47'),(41,22,'principal',3,'system-auto@ksrct.ac.in','approved','Auto-approved after DoF clearance',0,'2026-05-20 07:11:47');
/*!40000 ALTER TABLE `budget_proposal_approvals` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_edits`
--

LOCK TABLES `budget_proposal_edits` WRITE;
/*!40000 ALTER TABLE `budget_proposal_edits` DISABLE KEYS */;
INSERT INTO `budget_proposal_edits` VALUES (1,13,1,'maverickmyth333@gmail.com','1 line(s) updated','{\"editorRole\":\"super_admin\",\"lines\":[{\"lineNo\":1,\"changes\":[\"Quantity changed from 1 to 2\",\"Month allocations changed (Sep: 0 -> 1999)\"]}],\"proposalChanges\":[]}','2026-04-10 04:54:10'),(2,10,1,'maverickmyth333@gmail.com','1 line(s) updated','{\"editorRole\":\"level1\",\"lines\":[{\"lineNo\":1,\"changes\":[\"Month allocations changed (Aug: 0 -> 123)\"]}],\"proposalChanges\":[]}','2026-04-11 04:29:49'),(3,10,4,'maheshwaran3253@gmail.com','1 line(s) updated','{\"editorRole\":\"hod\",\"lines\":[{\"lineNo\":2,\"changes\":[\"Line added\"]}],\"proposalChanges\":[]}','2026-04-11 04:31:36'),(4,13,3,'gingfreecss325@gmail.com','1 line(s) updated','{\"editorRole\":\"dof\",\"lines\":[{\"lineNo\":1,\"changes\":[\"Month allocations changed (Aug: 0 -> 1999, Sep: 0 -> 1999)\"]}],\"proposalChanges\":[]}','2026-04-11 04:33:13'),(5,10,1,'maverickmyth333@gmail.com','2 line(s) updated','{\"editorRole\":\"super_admin\",\"lines\":[{\"lineNo\":1,\"changes\":[\"Month allocations changed (Aug: 0 -> 123)\"]},{\"lineNo\":2,\"changes\":[\"Month allocations changed (Aug: 0 -> 22)\"]}],\"proposalChanges\":[]}','2026-04-11 04:45:57'),(6,10,1,'maverickmyth333@gmail.com','1 line(s) updated','{\"editorRole\":\"super_admin\",\"lines\":[{\"lineNo\":3,\"changes\":[\"Line added\"]}],\"proposalChanges\":[]}','2026-04-11 05:08:16');
/*!40000 ALTER TABLE `budget_proposal_edits` ENABLE KEYS */;
UNLOCK TABLES;

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
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_proposal_lines_proposal` (`budget_proposal_id`),
  KEY `idx_budget_proposal_lines_head` (`budget_head`),
  KEY `idx_bpl_head_id` (`budget_head_id`),
  KEY `idx_bpl_subhead_id` (`budget_sub_head_id`),
  CONSTRAINT `fk_budget_proposal_lines_proposal` FOREIGN KEY (`budget_proposal_id`) REFERENCES `budget_proposals` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_lines`
--

LOCK TABLES `budget_proposal_lines` WRITE;
/*!40000 ALTER TABLE `budget_proposal_lines` DISABLE KEYS */;
INSERT INTO `budget_proposal_lines` VALUES (3,4,'Accessories & Kits','Power Tools',7,57,46.00,46.00,1,46.00,46.00,NULL,'we','2026-03-14 11:01:51','2026-05-25 18:07:00'),(10,11,'Electrical Infrastructure','Lift Installation',2,12,122.00,122.00,1,122.00,122.00,NULL,'asd','2026-03-23 05:48:02','2026-05-25 18:07:00'),(11,12,'Civil Infrastructure','Construction Works',1,2,1000.00,1000.00,1,1000.00,1000.00,NULL,'ASAS','2026-04-02 08:26:46','2026-05-25 18:07:00'),(12,12,'Electrical Infrastructure','Electrical Wiring',2,9,1000.00,1000.00,1,1000.00,1000.00,NULL,'Dummy','2026-04-02 08:26:46','2026-05-25 18:07:00'),(13,12,'IT Infrastructure','Hardwares',3,22,1000.00,1000.00,1,1000.00,1000.00,NULL,'Dummy','2026-04-02 08:26:46','2026-05-25 18:07:00'),(15,13,'Electrical Infrastructure','Electrical Wiring',2,9,1999.00,1999.00,2,3998.00,3998.00,'{\"Apr\":0,\"May\":0,\"Jun\":0,\"Jul\":0,\"Aug\":1999,\"Sep\":1999,\"Oct\":0,\"Nov\":0,\"Dec\":0,\"Jan\":0,\"Feb\":0,\"Mar\":0}','asfaf','2026-04-10 04:54:10','2026-05-25 18:07:00'),(16,10,'Civil Infrastructure','Partition Works',1,4,123.00,123.00,1,123.00,123.00,'{\"Apr\":0,\"May\":0,\"Jun\":0,\"Jul\":0,\"Aug\":123,\"Sep\":0,\"Oct\":0,\"Nov\":0,\"Dec\":0,\"Jan\":0,\"Feb\":0,\"Mar\":0}','aaa','2026-04-11 04:31:36','2026-05-25 18:07:00'),(17,10,'Electrical Infrastructure','Lights & Fans',2,11,22.00,22.00,1,22.00,22.00,'{\"Apr\":0,\"May\":0,\"Jun\":0,\"Jul\":0,\"Aug\":22,\"Sep\":0,\"Oct\":0,\"Nov\":0,\"Dec\":0,\"Jan\":0,\"Feb\":0,\"Mar\":0}','new','2026-04-11 04:31:36','2026-05-25 18:07:00'),(18,10,'Furniture & Fixtures','Faculty Table',4,41,33.00,33.00,1,33.00,33.00,'{\"Apr\":0,\"May\":0,\"Jun\":0,\"Jul\":0,\"Aug\":33,\"Sep\":0,\"Oct\":0,\"Nov\":0,\"Dec\":0,\"Jan\":0,\"Feb\":0,\"Mar\":0}','sda','2026-04-11 05:08:16','2026-05-25 18:07:00'),(19,14,'Miscellaneous Expenses','Bank Interest',59,528,12.00,12.00,1,12.00,12.00,NULL,'sdf','2026-04-16 05:19:28','2026-05-25 18:07:00'),(20,15,'Civil Infrastructure','Plumbing Works',1,5,12222.00,12222.00,1,12222.00,12222.00,NULL,'asd','2026-04-16 11:59:14','2026-05-25 18:07:00'),(21,16,'Electrical Infrastructure','Electrical Wiring',2,9,333.00,333.00,1,333.00,333.00,NULL,'df','2026-04-16 12:03:50','2026-05-25 18:07:00'),(22,17,'Faculty Empowerment','Registration fee',39,354,2000.00,2000.00,1,2000.00,2000.00,NULL,'ada','2026-04-20 04:17:43','2026-05-25 18:07:00'),(23,17,'Faculty Empowerment','Travel Allowance',39,355,2000.00,2000.00,1,2000.00,2000.00,NULL,'ss','2026-04-20 04:17:43','2026-05-25 18:07:00'),(24,18,'Academic Events','Expert Visit',26,268,100.00,100.00,1,100.00,100.00,NULL,'sda','2026-04-22 13:50:20','2026-05-25 18:07:00'),(25,18,'Club Activities','Flash Mob',27,278,100.00,100.00,12,1200.00,1200.00,NULL,'qwe','2026-04-22 13:50:20','2026-05-25 18:07:00'),(26,19,'Civil Infrastructure','Canopy',1,1,15000.00,15000.00,5,75000.00,75000.00,NULL,'re','2026-04-27 04:18:23','2026-05-25 18:07:00'),(27,20,'Electrical Infrastructure','Battery',2,8,23.00,23.00,1,23.00,23.00,NULL,'dfg','2026-04-27 08:10:33','2026-05-25 18:07:00'),(28,21,'Electrical Infrastructure','Air Conditioner',2,7,12000.00,12000.00,1,12000.00,12000.00,NULL,'aasd','2026-05-04 12:58:25','2026-05-25 18:07:00'),(29,22,'Membership & Subscriptions','Annual Subscription Charges',14,123,2560000.00,2560000.00,1,2560000.00,2560000.00,NULL,'asd','2026-05-20 06:58:57','2026-05-25 18:07:00'),(30,23,'Furniture & Fixtures','Wooden Cup Boards',4,42,25000000.00,25000000.00,1,25000000.00,25000000.00,NULL,'ads','2026-05-20 07:11:12','2026-05-25 18:07:00');
/*!40000 ALTER TABLE `budget_proposal_lines` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=123 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposal_refs`
--

LOCK TABLES `budget_proposal_refs` WRITE;
/*!40000 ALTER TABLE `budget_proposal_refs` DISABLE KEYS */;
INSERT INTO `budget_proposal_refs` VALUES (1,NULL,2025,0,NULL,'2026-02-24 09:17:02'),(5,NULL,2026,0,NULL,'2026-02-25 09:30:50'),(84,4,2026,3,'#B-2026-0003','2026-03-14 11:01:51'),(96,10,2026,8,'#B-2026-0008','2026-03-16 15:23:03'),(98,11,2026,9,'#B-2026-0009','2026-03-23 05:48:02'),(100,12,2026,10,'#B-2026-0010','2026-04-02 08:26:46'),(102,13,2026,11,'#B-2026-0011','2026-04-10 04:52:45'),(104,14,2026,12,'#B-2026-0012','2026-04-16 05:19:28'),(106,15,2026,13,'#B-2026-0013','2026-04-16 11:59:14'),(108,16,2026,14,'#B-2026-0014','2026-04-16 12:03:50'),(110,17,2026,15,'#B-2026-0015','2026-04-20 04:17:43'),(112,18,2026,16,'#B-2026-0016','2026-04-22 13:50:20'),(114,19,2026,17,'#B-2026-0017','2026-04-27 04:18:23'),(116,20,2026,18,'#B-2026-0018','2026-04-27 08:10:33'),(118,21,2026,19,'#B-2026-0019','2026-05-04 12:58:25'),(120,22,2026,20,'#B-2026-0020','2026-05-20 06:58:57'),(122,23,2026,21,'#B-2026-0021','2026-05-20 07:11:12');
/*!40000 ALTER TABLE `budget_proposal_refs` ENABLE KEYS */;
UNLOCK TABLES;

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
  `approved_total_amount` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Sum of approved_line_total across all lines',
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_proposals`
--

LOCK TABLES `budget_proposals` WRITE;
/*!40000 ALTER TABLE `budget_proposals` DISABLE KEYS */;
INSERT INTO `budget_proposals` VALUES (4,'#B-2026-0003',2026,225,1,'maverickmyth333@gmail.com','Mr. Alex Turner','2026-03-14','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',46.00,46.00,'level1_dof_principal','deleted','deleted','2026-03-14 11:01:51','2026-04-12 13:07:59'),(10,'#B-2026-0008',2026,2,4,'maheshwaran3253@gmail.com','Giridharan N','2026-03-16','additional','Department','Artificial Intelligence & Data Science',NULL,1,NULL,'Laboratory',145.00,178.00,'level1_dof_principal','submitted','level1','2026-03-16 15:23:03','2026-04-11 05:08:16'),(11,'#B-2026-0009',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-03-23','additional','Cell','Institutions Innovation Council',1,2,NULL,'Essentials',122.00,122.00,'level1_dof_principal','deleted','deleted','2026-03-23 05:48:02','2026-04-12 13:01:05'),(12,'#B-2026-0010',2026,227,3,'gingfreecss325@gmail.com','Dr. Akil Doe','2026-04-02','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',3000.00,3000.00,'level1_dof_principal','completed','completed','2026-04-02 08:26:46','2026-04-02 08:28:38'),(13,'#B-2026-0011',2026,225,1,'maverickmyth333@gmail.com','Alex Turner','2026-04-10','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Laboratory',3998.00,3998.00,'level1_dof_principal','principal_returned','principal','2026-04-10 04:52:45','2026-04-18 04:50:44'),(14,'#B-2026-0012',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-04-16','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',12.00,12.00,'level1_dof_principal','level1_approved','dof','2026-04-16 05:19:28','2026-04-16 11:37:43'),(15,'#B-2026-0013',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-04-16','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',12222.00,12222.00,'level1_dof_principal','level1_approved','dof','2026-04-16 11:59:14','2026-04-16 11:59:24'),(16,'#B-2026-0014',2026,227,3,'gingfreecss325@gmail.com','Dr. Akil Doe','2026-04-16','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',333.00,333.00,'level1_dof_principal','level1_approved','dof','2026-04-16 12:03:50','2026-04-16 12:03:59'),(17,'#B-2026-0015',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-04-20','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Laboratory',4000.00,4000.00,'level1_dof_principal','completed','completed','2026-04-20 04:17:43','2026-04-20 04:18:51'),(18,'#B-2026-0016',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-04-22','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Laboratory',1300.00,1300.00,'level1_dof_principal','completed','completed','2026-04-22 13:50:20','2026-04-22 13:51:28'),(19,'#B-2026-0017',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-04-27','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',75000.00,75000.00,'level1_dof_principal','completed','completed','2026-04-27 04:18:23','2026-04-27 04:22:16'),(20,'#B-2026-0018',2026,2,4,'maheshwaran3253@gmail.com','Mr Giridharan N','2026-04-27','additional','Faculty','Dr Abdul Bari J',NULL,4,NULL,'Skilling',23.00,23.00,'level1_dof_principal','submitted','level1','2026-04-27 08:10:33','2026-04-27 08:10:33'),(21,'#B-2026-0019',2026,227,3,'gingfreecss325@gmail.com','Dr. Akil Doe','2026-05-04','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Association',12000.00,12000.00,'level1_dof_principal','completed','completed','2026-05-04 12:58:25','2026-05-04 12:58:25'),(22,'#B-2026-0020',2026,225,1,'maverickmyth333@gmail.com','Mr. Alex Turner','2026-05-20','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Skilling',2560000.00,2560000.00,'level1_dof_principal','completed','completed','2026-05-20 06:58:57','2026-05-20 07:11:47'),(23,'#B-2026-0021',2026,226,2,'maheshwaran325@gmail.com','Dr. Ajay Doe','2026-05-20','additional','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Skilling',25000000.00,25000000.00,'level1_dof_principal','completed','completed','2026-05-20 07:11:12','2026-05-20 07:11:45');
/*!40000 ALTER TABLE `budget_proposals` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=586 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_sub_heads`
--

LOCK TABLES `budget_sub_heads` WRITE;
/*!40000 ALTER TABLE `budget_sub_heads` DISABLE KEYS */;
INSERT INTO `budget_sub_heads` (`id`, `name`, `code`, `head_id`, `scope`, `event_type`, `group_label`, `sort_order`, `is_active`, `is_deleted`, `created_at`, `updated_at`) VALUES (1,'Canopy','canopy',1,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:54','2026-05-25 18:07:00'),(2,'Construction Works','construction-works',1,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(3,'False Ceiling Works','false-ceiling-works',1,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(4,'Partition Works','partition-works',1,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(5,'Plumbing Works','plumbing-works',1,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(6,'Water Cooler','water-cooler',1,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(7,'Air Conditioner','air-conditioner',2,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(8,'Battery','battery',2,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(9,'Electrical Wiring','electrical-wiring',2,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(10,'Generator','generator',2,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(11,'Lights & Fans','lights-and-fans',2,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(12,'Lift Installation','lift-installation',2,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(13,'UPS & Inverter','ups-and-inverter',2,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(14,'UPS Inverter','ups-inverter',2,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(15,'A/V Equipment','a-v-equipment',3,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(16,'Amplifiers','amplifiers',3,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(17,'CCTV Materials','cctv-materials',3,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(18,'CMOS Battery','cmos-battery',3,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(19,'Desktops','desktops',3,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(20,'Desktops Computers','desktops-computers',3,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(21,'Hard Disks','hard-disks',3,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(22,'Hardwares','hardwares',3,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(23,'Interactive Displays','interactive-displays',3,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(24,'Intercom','intercom',3,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(25,'Keyboard','keyboard',3,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(26,'Laptops','laptops',3,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(27,'Mic & Speakers','mic-and-speakers',3,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(28,'Mobiles & Tablet','mobiles-and-tablet',3,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(29,'Monitors','monitors',3,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(30,'Mouse','mouse',3,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(31,'Network Materials','network-materials',3,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(32,'Printers','printers',3,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(33,'Projectors','projectors',3,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(34,'Softwares','softwares',3,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(35,'Television','television',3,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(36,'Wi-fi Router','wi-fi-router',3,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(37,'Xerox Machine','xerox-machine',3,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(38,'Chair','chair',4,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(39,'Computer Table','computer-table',4,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(40,'Discussion Table','discussion-table',4,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(41,'Faculty Table','faculty-table',4,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(42,'Wooden Cup Boards','wooden-cup-boards',4,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(43,'Work Table','work-table',4,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(44,'Heavy Motor Vehicle','heavy-motor-vehicle',5,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(45,'Light Motor Vehicle','light-motor-vehicle',5,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(46,'Two Wheeler','two-wheeler',5,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(47,'Consultancy Equipment','consultancy-equipment',6,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(48,'Equipment Upgrade','equipment-upgrade',6,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(49,'Lab Equipment','lab-equipment',6,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(50,'Minor Equipment','minor-equipment',6,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(51,'Office Equipment','office-equipment',6,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(52,'Research Equipment','research-equipment',6,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(53,'Sports Equipment','sports-equipment',6,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(54,'Drilling Machine','drilling-machine',7,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(55,'Drone Kit','drone-kit',7,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(56,'Lab Accessories','lab-accessories',7,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(57,'Power Tools','power-tools',7,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(58,'Weighing Machine','weighing-machine',7,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(59,'Others','others',7,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(60,'Books','books',8,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(61,'Databases','databases',8,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(62,'E-Books','e-books',8,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(63,'E-Journals','e-journals',8,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(64,'Journals','journals',8,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(65,'Magazines','magazines',8,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(66,'Membership','membership',8,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(67,'Newspapers','newspapers',8,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(68,'Non Books (CD etc.)','non-books-(cd-etc.)',8,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(69,'Plagiarism Detection Tool','plagiarism-detection-tool',8,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(70,'Remote Access Tool','remote-access-tool',8,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(71,'AC Maintenance','ac-maintenance',9,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(72,'Annual Maintenance Charges','annual-maintenance-charges',9,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(73,'Building Maintenance','building-maintenance',9,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(74,'Computer Maintenance','computer-maintenance',9,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(75,'Electrical Maintenance','electrical-maintenance',9,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(76,'Equipment Maintenance','equipment-maintenance',9,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(77,'Farm Maintenance','farm-maintenance',9,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(78,'Furniture Maintenance','furniture-maintenance',9,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(79,'Garden Maintenance','garden-maintenance',9,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(80,'General Repairs','general-repairs',9,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(81,'Housekeeping Expenses','housekeeping-expenses',9,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(82,'Infrastructure Maintenance','infrastructure-maintenance',9,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(83,'Lift Maintenance','lift-maintenance',9,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(84,'Office Maintenance','office-maintenance',9,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(85,'Painting','painting',9,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(86,'Playground Maintenance','playground-maintenance',9,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(87,'Plumbing Maintenance','plumbing-maintenance',9,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(88,'Printer Maintenance','printer-maintenance',9,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(89,'Software Maintenance','software-maintenance',9,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(90,'UPS Maintenance','ups-maintenance',9,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(91,'Vehicle Maintenance','vehicle-maintenance',9,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(92,'Toner Refill','toner-refill',9,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(93,'Chargers','chargers',10,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(94,'Printer Donors','printer-donors',10,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(95,'Printer Toner','printer-toner',10,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(96,'SMPS','smps',10,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(97,'Equipment Maintenance','equipment-maintenance',11,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(98,'Software Maintenance','software-maintenance',11,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(99,'Carpentary Items','carpentary-items',12,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(100,'Chemicals','chemicals',12,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(101,'Construction Materials','construction-materials',12,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(102,'Cutting Tools','cutting-tools',12,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(103,'Electrical Components','electrical-components',12,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(104,'Electronic Components','electronic-components',12,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(105,'Glasswares','glasswares',12,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(106,'Mechanical Components','mechanical-components',12,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(107,'Metals & Alloys','metals-and-alloys',12,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(108,'Oils & Lubricants','oils-and-lubricants',12,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(109,'Plasticwares','plasticwares',12,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(110,'Others','others',12,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(111,'AI Tools','ai-tools',13,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(112,'Analysis','analysis',13,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(113,'Antivirus','antivirus',13,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(114,'Firewall','firewall',13,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(115,'Graphical Design','graphical-design',13,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(116,'Grammer Check','grammer-check',13,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(117,'Grievance','grievance',13,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(118,'Modelling','modelling',13,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(119,'Plagiarism','plagiarism',13,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(120,'Programming','programming',13,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(121,'Others','others',13,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(122,'Annual Membership fee','annual-membership-fee',14,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(123,'Annual Subscription Charges','annual-subscription-charges',14,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(124,'Data Subscription Charges','data-subscription-charges',14,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(125,'DELNET','delnet',14,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(126,'E-Resources','e-resources',14,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(127,'Journals','journals',14,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(128,'Magazines','magazines',14,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(129,'Membership fees','membership-fees',14,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(130,'Newspaper','newspaper',14,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(131,'Professional Body fees','professional-body-fees',14,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(132,'Books','books',15,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(133,'Note Books','note-books',15,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(134,'Log Books','log-books',15,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(135,'ID Card','id-card',15,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(136,'Student Uniform','student-uniform',15,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(137,'Others','others',15,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(138,'Note Books','note-books',16,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(139,'Log Books','log-books',16,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(140,'ID Card','id-card',16,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(141,'Others','others',16,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(142,'Badge','badge',17,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(143,'Banner','banner',17,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(144,'Beach Flag','beach-flag',17,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(145,'Binding','binding',17,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(146,'Brochure','brochure',17,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(147,'Calendar','calendar',17,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(148,'Certificates','certificates',17,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(149,'Combined Items','combined-items',17,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(150,'Diary','diary',17,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(151,'ID Card','id-card',17,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(152,'Letter Pad','letter-pad',17,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(153,'Magazines','magazines',17,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(154,'News Letters','news-letters',17,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(155,'Note Pad','note-pad',17,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(156,'Official Documents','official-documents',17,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(157,'Pamphlet','pamphlet',17,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(158,'Registers','registers',17,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(159,'Reports','reports',17,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(160,'Sign Board','sign-board',17,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(161,'Vinyl Board','vinyl-board',17,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(162,'Visiting Card','visiting-card',17,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(163,'Wiro Pad','wiro-pad',17,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(164,'Others','others',17,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(165,'Adhesive Gum','adhesive-gum',18,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(166,'Adhesive Tape','adhesive-tape',18,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(167,'Answer Booklet','answer-booklet',18,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(168,'Chalk Box','chalk-box',18,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(169,'Clips/ Pins','clips--pins',18,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(170,'Cloth Covers','cloth-covers',18,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(171,'Combined Items','combined-items',18,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(172,'Duster','duster',18,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(173,'Files/ Folders','files--folders',18,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(174,'Grade Sheet','grade-sheet',18,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(175,'Highlighter','highlighter',18,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(176,'Marker Pen','marker-pen',18,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(177,'Office Covers','office-covers',18,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(178,'Pen/ Pencil/ Eraser','pen--pencil--eraser',18,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(179,'Plastic Tray','plastic-tray',18,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(180,'Print Sheets','print-sheets',18,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(181,'Rubber Band','rubber-band',18,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(182,'Rubber Stamp','rubber-stamp',18,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(183,'Scissor/ Knife','scissor--knife',18,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(184,'Stamp Pad/ Ink','stamp-pad--ink',18,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(185,'Stapler/ Punching Machine','stapler--punching-machine',18,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(186,'Sticky Notes','sticky-notes',18,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(187,'Others','others',18,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(188,'Banner','banner',19,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(189,'Pamphlet','pamphlet',19,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(190,'Brochure','brochure',19,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(191,'Vinyl Boards','vinyl-boards',19,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(192,'Certificates','certificates',19,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(193,'Diary','diary',19,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(194,'Calendar','calendar',19,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(195,'Visitng Card','visitng-card',19,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(196,'Seal/ Stamp Pad','seal--stamp-pad',19,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(197,'Pen/ Pencil/ Eraser','pen--pencil--eraser',19,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(198,'Stapler/ Punching Machine','stapler--punching-machine',19,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(199,'Files/ Folders','files--folders',19,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(200,'Entry Registers','entry-registers',19,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(201,'Print Sheets','print-sheets',19,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(202,'Others','others',19,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(203,'Courier Charges','courier-charges',20,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(204,'Frieght Charges','frieght-charges',20,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(205,'Postal Charges','postal-charges',20,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(206,'Others','others',20,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(207,'Beta','beta',21,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(208,'Food & Refreshment','food-and-refreshment',21,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(209,'Travel Expense','travel-expense',21,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(210,'Others','others',21,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(211,'Water Bottle','water-bottle',22,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(212,'Food & Refreshment','food-and-refreshment',22,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(213,'Pooja Expenses','pooja-expenses',22,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(214,'Accessories','accessories',22,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(215,'Legal stamp paper','legal-stamp-paper',22,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(216,'Miscellaneous','miscellaneous',22,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(217,'Registration fees','registration-fees',23,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(218,'Travel','travel',23,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(219,'Accommodation','accommodation',23,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(220,'Food & Refreshment','food-and-refreshment',23,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(221,'Local Conveyance','local-conveyance',23,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(222,'Printing & Stationery','printing-and-stationery',23,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(223,'Miscellaneous','miscellaneous',23,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(224,'A/V Arrangements','a-v-arrangements',24,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(225,'Accessories','accessories',24,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(226,'Accommodation','accommodation',24,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(227,'Auditing Charge','auditing-charge',24,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(228,'Bag','bag',24,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(229,'Consumables','consumables',24,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(230,'Decorations','decorations',24,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(231,'Driver Bata','driver-bata',24,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(232,'Event Logistics','event-logistics',24,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(233,'Food & Refreshment','food-and-refreshment',24,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(234,'Give away','give-away',24,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(235,'Honorarium','honorarium',24,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(236,'Memento & Gifts','memento-and-gifts',24,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(237,'Miscellaneous','miscellaneous',24,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(238,'Printing','printing',24,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(239,'Prizes','prizes',24,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(240,'Promotions','promotions',24,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(241,'Publication Charges','publication-charges',24,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(242,'Refund','refund',24,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(243,'Registration fee','registration-fee',24,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(244,'Registration Kit','registration-kit',24,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(245,'Remuneration','remuneration',24,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(246,'Sitting Fees','sitting-fees',24,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(247,'Stationary','stationary',24,'head-specific',NULL,NULL,23,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(248,'Stationery','stationery',24,'head-specific',NULL,NULL,24,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(249,'T-Shirt','t-shirt',24,'head-specific',NULL,NULL,25,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(250,'Travel','travel',24,'head-specific',NULL,NULL,27,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(251,'Others','others',24,'head-specific',NULL,NULL,28,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(252,'Accessories','accessories',25,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(253,'Accommodation','accommodation',25,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(254,'Auditing Charge','auditing-charge',25,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(255,'Driver Bata','driver-bata',25,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(256,'Food & Refreshment','food-and-refreshment',25,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(257,'Honorarium','honorarium',25,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(258,'Memento & Gifts','memento-and-gifts',25,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(259,'Miscellaneous','miscellaneous',25,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(260,'Printing','printing',25,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(261,'Registration fee','registration-fee',25,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(262,'Remuneration','remuneration',25,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(263,'Sitting Fees','sitting-fees',25,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(264,'Stationary','stationary',25,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(265,'Stationery','stationery',25,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(266,'Travel','travel',25,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(267,'Others','others',25,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(268,'Expert Visit','expert-visit',26,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(269,'FDP (Faculty Development Programme)','fdp-(faculty-development-programme)',26,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(270,'Guest Lecture','guest-lecture',26,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(271,'Hands-on Training','hands-on-training',26,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(272,'Industry Visit','industry-visit',26,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(273,'MoU Inking','mou-inking',26,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(274,'Seminar','seminar',26,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(275,'STTP (Short-Term Training Programme)','sttp-(short-term-training-programme)',26,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(276,'Webinar','webinar',26,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(277,'Workshop','workshop',26,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(278,'Flash Mob','flash-mob',27,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(279,'Fun Events','fun-events',27,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(280,'Road show','road-show',27,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(281,'Wall Painting','wall-painting',27,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(282,'Alumni Induction Day','alumni-induction-day',28,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(283,'Annual Day','annual-day',28,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(284,'Dakshaa','dakshaa',28,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(285,'Founder Day','founder-day',28,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(286,'Graduation Day','graduation-day',28,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(287,'Orientation Session','orientation-session',28,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(288,'Science Day','science-day',28,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(289,'Student Induction Programme','student-induction-programme',28,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(290,'Womens Day','womens-day',28,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(291,'Conclave','conclave',29,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(292,'Consumables','consumables',29,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(293,'Convention','convention',29,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(294,'Industry Interaction','industry-interaction',29,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(295,'International Conference','international-conference',29,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(296,'National Conference','national-conference',29,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(297,'Networking Event','networking-event',29,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(298,'Alumni Interaction','alumni-interaction',30,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(299,'Alumni Meeting','alumni-meeting',30,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(300,'Association Function','association-function',30,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(301,'Parents Meeting','parents-meeting',30,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(302,'Awareness Program','awareness-program',31,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(303,'Campaigns','campaigns',31,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(304,'Crash Course','crash-course',31,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(305,'Education Fair','education-fair',31,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(306,'Grama Saba Meet','grama-saba-meet',31,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(307,'Mini Marathon','mini-marathon',31,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(308,'Orientation Session','orientation-session',31,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(309,'Rally','rally',31,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(310,'School Visit','school-visit',31,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(311,'Summer Internship','summer-internship',31,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(312,'Celebration','celebration',31,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(313,'Celebration Day','celebration-day',32,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(314,'Festival Celebrations','festival-celebrations',32,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(315,'Harmonicks','harmonicks',32,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(316,'Hostel Day','hostel-day',32,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(317,'Sports Day','sports-day',33,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(318,'Sports Meet','sports-meet',33,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(319,'Academic Competitions','academic-competitions',34,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(320,'Creative Competitions','creative-competitions',34,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(321,'Cultural Competitions','cultural-competitions',34,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(322,'General Competitions','general-competitions',34,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(323,'Innovation & Startup Competitions','innovation-and-startup-competitions',34,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(324,'Literary Competitions','literary-competitions',34,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(325,'Management Competitions','management-competitions',34,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(326,'Online Competitions','online-competitions',34,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(327,'Project Exhibition','project-exhibition',34,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(328,'Science Exhibition','science-exhibition',34,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(329,'Sports Competitions','sports-competitions',34,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(330,'Technical Competitions','technical-competitions',34,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(331,'Examination Committee Meeting','examination-committee-meeting',35,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(332,'Finance Committee Meeting','finance-committee-meeting',35,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(333,'Governing Body Meeting','governing-body-meeting',35,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(334,'IQAC Meeting','iqac-meeting',35,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(335,'Placement Meeting','placement-meeting',35,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(336,'Research Advisory Board Meeting','research-advisory-board-meeting',35,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(337,'Result Passing Board (RPB) Meeting','result-passing-board-(rpb)-meeting',35,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(338,'Academic Council Meeting','academic-council-meeting',36,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(339,'Board of Studies (Bos) Meeting','board-of-studies-(bos)-meeting',36,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(340,'DAB Meeting','dab-meeting',36,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(341,'Standing Committee Meeting','standing-committee-meeting',36,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(342,'Academic Audit','academic-audit',37,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(343,'Administrative Audit','administrative-audit',37,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(344,'Energy & Green Audit','energy-and-green-audit',37,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(345,'Government Meetings','government-meetings',38,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(346,'Accommodation','accommodation',39,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(347,'Daily Allowance','daily-allowance',39,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(348,'Faculty Welfare','faculty-welfare',39,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(349,'Food & Refreshment','food-and-refreshment',39,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(350,'Incentives','incentives',39,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(351,'Leadership Meet','leadership-meet',39,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(352,'Medical Expenses','medical-expenses',39,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(353,'Membership Fees','membership-fees',39,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(354,'Registration fee','registration-fee',39,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(355,'Travel Allowance','travel-allowance',39,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(356,'Accommodation','accommodation',40,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(357,'Daily Allowance','daily-allowance',40,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(358,'Food & Refreshment','food-and-refreshment',40,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(359,'Incentives','incentives',40,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(360,'Medical Expenses','medical-expenses',40,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(361,'Registration fee','registration-fee',40,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(362,'Staff Welfare','staff-welfare',40,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(363,'Travel Allowance','travel-allowance',40,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(364,'Accommodation','accommodation',41,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(365,'Certification Costs','certification-costs',41,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(366,'Food & Refreshment','food-and-refreshment',41,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(367,'Incentives','incentives',41,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(368,'Medical Expense','medical-expense',41,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(369,'Prizes','prizes',41,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(370,'Registration fee','registration-fee',41,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(371,'Student Uniform','student-uniform',41,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(372,'Student Welfare','student-welfare',41,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(373,'Travel Support','travel-support',41,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(374,'ApptitudeTraining','apptitudetraining',42,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(375,'Aptitude Training','aptitude-training',42,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(376,'Certification Programs','certification-programs',42,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(377,'Competitive Exam Coaching','competitive-exam-coaching',42,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(378,'Exposure Visit','exposure-visit',42,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(379,'Higher Education Coaching','higher-education-coaching',42,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(380,'International Connect','international-connect',42,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(381,'Internship','internship',42,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(382,'Language Proficiency Courses','language-proficiency-courses',42,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(383,'One Credit Course','one-credit-course',42,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(384,'Placement Drives','placement-drives',42,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(385,'Placement Training','placement-training',42,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(386,'Skill Development Training','skill-development-training',42,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(387,'Value Added Course','value-added-course',42,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(388,'Others','others',42,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(389,'NAAC Fees','naac-fees',43,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(390,'NAAC Inspection','naac-inspection',43,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(391,'NBA Fees','nba-fees',43,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(392,'NBA Inspection','nba-inspection',43,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(393,'QS Ranking','qs-ranking',43,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(394,'SDG Ranking','sdg-ranking',43,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(395,'Other Rankings','other-rankings',43,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(396,'Autonomous Exam Remuneration','autonomous-exam-remuneration',44,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(397,'CoE Staff Remuneration','coe-staff-remuneration',44,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(398,'Degree Recommendation','degree-recommendation',44,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(399,'Government Exam Remuneration','government-exam-remuneration',44,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(400,'Online Exam Remuneration','online-exam-remuneration',44,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(401,'QP Setting Expenses','qp-setting-expenses',44,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(402,'Text Books','text-books',45,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(403,'E-Resources','e-resources',45,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(404,'NAAC Fees','naac-fees',46,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(405,'NBA Fees','nba-fees',46,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(406,'NAAC Inspection','naac-inspection',46,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(407,'NBA Inspection','nba-inspection',46,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(408,'Membership Fees','membership-fees',47,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(409,'Annual Fees','annual-fees',47,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(410,'Accommodation','accommodation',48,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(411,'Daily Allowance','daily-allowance',48,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(412,'Driver Beta','driver-beta',48,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(413,'Food & Refreshment','food-and-refreshment',48,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(414,'Printing','printing',48,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(415,'Registration fee','registration-fee',48,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(416,'Stationery','stationery',48,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(417,'Travel Allowance','travel-allowance',48,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(418,'Others','others',48,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(419,'Digital Promotion','digital-promotion',49,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(420,'News Paper Advertisement','news-paper-advertisement',49,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(421,'Branding','branding',50,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(422,'Corporate Gift','corporate-gift',50,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(423,'CSR Activity','csr-activity',50,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(424,'Press & Media','press-and-media',50,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(425,'Promotions','promotions',50,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(426,'Sponsorship','sponsorship',50,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(427,'Consultant Charges','consultant-charges',51,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(428,'Field Visits','field-visits',51,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(429,'School Visits','school-visits',51,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(430,'Stalls','stalls',51,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(431,'Student Directory','student-directory',51,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(432,'Consultancy','consultancy',52,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(433,'HI Contribution','hi-contribution',52,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(434,'Institute Research Fellowship','institute-research-fellowship',52,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(435,'Publication Support','publication-support',52,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(436,'Research Cenre Renewal','research-cenre-renewal',52,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(437,'Research Grant','research-grant',52,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(438,'Seed Fund (Consumables)','seed-fund-(consumables)',52,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(439,'Seed Fund (IPR Charges)','seed-fund-(ipr-charges)',52,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(440,'Seed Fund (Product Development)','seed-fund-(product-development)',52,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(441,'Seed Fund (Testing)','seed-fund-(testing)',52,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(442,'Seed Fund (Travel)','seed-fund-(travel)',52,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(443,'Accessories & Peripherals','accessories-and-peripherals',53,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(444,'Accommodation','accommodation',53,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(445,'Administrative Expenses','administrative-expenses',53,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(446,'Consumables','consumables',53,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(447,'Equipment','equipment',53,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(448,'Food & Refreshment','food-and-refreshment',53,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(449,'Honorarium','honorarium',53,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(450,'Incidental Expenses','incidental-expenses',53,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(451,'IT Infrastructure','it-infrastructure',53,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(452,'Manpower','manpower',53,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(453,'Memento & Gifts','memento-and-gifts',53,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(454,'Miscellaneous','miscellaneous',53,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(455,'Overhead Expenses','overhead-expenses',53,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(456,'Printing','printing',53,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(457,'Publicity & Promotion','publicity-and-promotion',53,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(458,'Software & Licenses','software-and-licenses',53,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(459,'Stationery','stationery',53,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(460,'Travel','travel',53,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(461,'A/V Arrangements','a-v-arrangements',54,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(462,'Accessories','accessories',54,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(463,'Accommodation','accommodation',54,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(464,'Auditing Charge','auditing-charge',54,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(465,'Bag','bag',54,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(466,'Consumables','consumables',54,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(467,'Decorations','decorations',54,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(468,'Driver Bata','driver-bata',54,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(469,'Event Logistics','event-logistics',54,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(470,'Food & Refreshment','food-and-refreshment',54,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(471,'Honorarium','honorarium',54,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(472,'Memento & Gifts','memento-and-gifts',54,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(473,'Miscellaneous','miscellaneous',54,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(474,'Printing','printing',54,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(475,'Prizes','prizes',54,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(476,'Promotions','promotions',54,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(477,'Publication Charges','publication-charges',54,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(478,'Registration fee','registration-fee',54,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(479,'Registration Kit','registration-kit',54,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(480,'Remuneration','remuneration',54,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(481,'Sitting Fees','sitting-fees',54,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(482,'Stationery','stationery',54,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(483,'T-shirt','t-shirt',54,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(484,'Travel','travel',54,'head-specific',NULL,NULL,23,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(485,'Affiliation Fees','affiliation-fees',55,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(486,'AICTE Fees','aicte-fees',55,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(487,'Anna University Fees','anna-university-fees',55,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(488,'Audit Fees','audit-fees',55,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(489,'Autonomous Charges','autonomous-charges',55,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(490,'Awards & Recognitions','awards-and-recognitions',55,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(491,'Consortium Fees','consortium-fees',55,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(492,'DOTE Fees','dote-fees',55,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(493,'DTCP Approval','dtcp-approval',55,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(494,'Fee Fixation Expenses','fee-fixation-expenses',55,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(495,'Flag Day Expenses','flag-day-expenses',55,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(496,'Inspection Expenses','inspection-expenses',55,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(497,'Insurance Charges','insurance-charges',55,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(498,'International Travel','international-travel',55,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(499,'Legal Expenses','legal-expenses',55,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(500,'License Renewal','license-renewal',55,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(501,'Licenses & Taxes','licenses-and-taxes',55,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(502,'Office Expenses','office-expenses',55,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(503,'Scholarship Expenses','scholarship-expenses',55,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(504,'Spirit License','spirit-license',55,'head-specific',NULL,NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(505,'Stamp Charges','stamp-charges',55,'head-specific',NULL,NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(506,'Testing Charges','testing-charges',55,'head-specific',NULL,NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(507,'Water Charges','water-charges',55,'head-specific',NULL,NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(508,'Building Tax','building-tax',56,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(509,'DTCP Approval','dtcp-approval',56,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(510,'License Renewal','license-renewal',56,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(511,'Property Tax','property-tax',56,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(512,'Road Tax','road-tax',56,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(513,'Spirit License','spirit-license',56,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(514,'Water Tax','water-tax',56,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(515,'Allowances','allowances',57,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(516,'Emoluments','emoluments',57,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(517,'ESI Scheme','esi-scheme',57,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(518,'Monthly Salary','monthly-salary',57,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(519,'Professional Payments','professional-payments',57,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(520,'Provident Fund','provident-fund',57,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(521,'Wages','wages',57,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(522,'Diesel Expenses','diesel-expenses',58,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(523,'Electricity Charges','electricity-charges',58,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(524,'Internet Charges','internet-charges',58,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(525,'Telephone Charges','telephone-charges',58,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(526,'Audit Fees','audit-fees',59,'head-specific',NULL,NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(527,'Bank Charges','bank-charges',59,'head-specific',NULL,NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(528,'Bank Interest','bank-interest',59,'head-specific',NULL,NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(529,'Farm Expenses','farm-expenses',59,'head-specific',NULL,NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(530,'Fire Extinguisher','fire-extinguisher',59,'head-specific',NULL,NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(531,'First Aid Kit Expenses','first-aid-kit-expenses',59,'head-specific',NULL,NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(532,'General Expenses','general-expenses',59,'head-specific',NULL,NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(533,'Generator & Fuel','generator-and-fuel',59,'head-specific',NULL,NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(534,'Guest House','guest-house',59,'head-specific',NULL,NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(535,'House Keeping','house-keeping',59,'head-specific',NULL,NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(536,'Irrecovable Fee','irrecovable-fee',59,'head-specific',NULL,NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(537,'Laundry Service','laundry-service',59,'head-specific',NULL,NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(538,'Legal Expenses','legal-expenses',59,'head-specific',NULL,NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(539,'Loan Processing Charges','loan-processing-charges',59,'head-specific',NULL,NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(540,'Office Expenses','office-expenses',59,'head-specific',NULL,NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(541,'RO Mineral Water','ro-mineral-water',59,'head-specific',NULL,NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(542,'RO  Mineral Water','ro--mineral-water',59,'head-specific',NULL,NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(543,'Sewage Treatment','sewage-treatment',59,'head-specific',NULL,NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(544,'Others','others',59,'head-specific',NULL,NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(545,'A/V Arrangements','a-v-arrangements',NULL,'hoac-shared','Events & Competitions',NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(546,'Accessories','accessories',NULL,'hoac-shared','Events & Competitions',NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(547,'Accommodation','accommodation',NULL,'hoac-shared','Events & Competitions',NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(548,'Auditing Charge','auditing-charge',NULL,'hoac-shared','Events & Competitions',NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(549,'Bag','bag',NULL,'hoac-shared','Events & Competitions',NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(550,'Consumables','consumables',NULL,'hoac-shared','Events & Competitions',NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(551,'Decorations','decorations',NULL,'hoac-shared','Events & Competitions',NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(552,'Driver Bata','driver-bata',NULL,'hoac-shared','Events & Competitions',NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(553,'Event Logistics','event-logistics',NULL,'hoac-shared','Events & Competitions',NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(554,'Food & Refreshment','food-and-refreshment',NULL,'hoac-shared','Events & Competitions',NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(555,'Honorarium','honorarium',NULL,'hoac-shared','Events & Competitions',NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(556,'Memento & Gifts','memento-and-gifts',NULL,'hoac-shared','Events & Competitions',NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(557,'Miscellaneous','miscellaneous',NULL,'hoac-shared','Events & Competitions',NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(558,'Printing','printing',NULL,'hoac-shared','Events & Competitions',NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(559,'Prizes','prizes',NULL,'hoac-shared','Events & Competitions',NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(560,'Promotions','promotions',NULL,'hoac-shared','Events & Competitions',NULL,15,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(561,'Publication Charges','publication-charges',NULL,'hoac-shared','Events & Competitions',NULL,16,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(562,'Refund','refund',NULL,'hoac-shared','Events & Competitions',NULL,17,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(563,'Registration fee','registration-fee',NULL,'hoac-shared','Events & Competitions',NULL,18,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(564,'Registration Kit','registration-kit',NULL,'hoac-shared','Events & Competitions',NULL,19,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(565,'Remuneration','remuneration',NULL,'hoac-shared','Events & Competitions',NULL,20,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(566,'Sitting Fees','sitting-fees',NULL,'hoac-shared','Events & Competitions',NULL,21,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(567,'Stationery','stationery',NULL,'hoac-shared','Events & Competitions',NULL,22,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(568,'T-Shirt','t-shirt',NULL,'hoac-shared','Events & Competitions',NULL,23,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(569,'Travel','travel',NULL,'hoac-shared','Events & Competitions',NULL,24,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(570,'Others','others',NULL,'hoac-shared','Events & Competitions',NULL,25,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(571,'Accessories','accessories',NULL,'hoac-shared','Meetings & Audits',NULL,0,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(572,'Accommodation','accommodation',NULL,'hoac-shared','Meetings & Audits',NULL,1,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(573,'Auditing Charge','auditing-charge',NULL,'hoac-shared','Meetings & Audits',NULL,2,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(574,'Driver Bata','driver-bata',NULL,'hoac-shared','Meetings & Audits',NULL,3,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(575,'Food & Refreshment','food-and-refreshment',NULL,'hoac-shared','Meetings & Audits',NULL,4,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(576,'Honorarium','honorarium',NULL,'hoac-shared','Meetings & Audits',NULL,5,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(577,'Memento & Gifts','memento-and-gifts',NULL,'hoac-shared','Meetings & Audits',NULL,6,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(578,'Miscellaneous','miscellaneous',NULL,'hoac-shared','Meetings & Audits',NULL,7,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(579,'Printing','printing',NULL,'hoac-shared','Meetings & Audits',NULL,8,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(580,'Registration fee','registration-fee',NULL,'hoac-shared','Meetings & Audits',NULL,9,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(581,'Remuneration','remuneration',NULL,'hoac-shared','Meetings & Audits',NULL,10,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(582,'Sitting Fees','sitting-fees',NULL,'hoac-shared','Meetings & Audits',NULL,11,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(583,'Stationery','stationery',NULL,'hoac-shared','Meetings & Audits',NULL,12,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(584,'Travel','travel',NULL,'hoac-shared','Meetings & Audits',NULL,13,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00'),(585,'Others','others',NULL,'hoac-shared','Meetings & Audits',NULL,14,1,0,'2026-05-25 18:05:55','2026-05-25 18:07:00');
/*!40000 ALTER TABLE `budget_sub_heads` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_tags`
--

LOCK TABLES `budget_tags` WRITE;
/*!40000 ALTER TABLE `budget_tags` DISABLE KEYS */;
INSERT INTO `budget_tags` VALUES (1,'Laboratory',1,0,2,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(2,'Association',1,0,3,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(3,'Skilling',1,0,4,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(4,'Research',1,0,5,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(5,'Outreach',1,0,6,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(6,'Office',1,0,7,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(7,'Academics',1,0,8,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(8,'Essentials',1,0,9,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(9,'Events',1,0,10,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(10,'Innovation',1,0,11,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(11,'Start-up',1,0,12,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(12,'Entrepreneurship',1,0,13,'2026-03-11 08:45:43','2026-05-25 18:35:30'),(13,'IT',1,0,1,'2026-03-12 08:10:19','2026-05-25 18:35:30'),(14,'IT Infrastructure',1,0,14,'2026-03-12 09:51:00','2026-05-25 18:35:30'),(15,'CoE Claims',1,0,15,'2026-05-25 05:45:24','2026-05-25 18:35:30');
/*!40000 ALTER TABLE `budget_tags` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_time_freeze_config`
--

LOCK TABLES `budget_time_freeze_config` WRITE;
/*!40000 ALTER TABLE `budget_time_freeze_config` DISABLE KEYS */;
INSERT INTO `budget_time_freeze_config` VALUES (1,2026,'2026-03-04',1,1,'maverickmyth333@gmail.com','2026-03-09 16:37:03','2026-03-16 15:52:26');
/*!40000 ALTER TABLE `budget_time_freeze_config` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edit_requests`
--

LOCK TABLES `edit_requests` WRITE;
/*!40000 ALTER TABLE `edit_requests` DISABLE KEYS */;
INSERT INTO `edit_requests` VALUES (1,'journals',2,1,'rejected','2026-01-31 06:56:11','2026-03-18 05:30:24'),(2,'journals',1,1,'approved','2026-01-31 07:29:31','2026-03-18 05:30:55'),(3,'journals',3,1,'none','2026-02-02 11:43:55','2026-02-02 11:44:29'),(4,'journals',4,1,'rejected','2026-02-13 12:02:38','2026-03-18 05:28:19');
/*!40000 ALTER TABLE `edit_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_import_pending`
--

DROP TABLE IF EXISTS `employee_import_pending`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_import_pending` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `department_code` varchar(20) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `id_card_no` varchar(50) DEFAULT NULL,
  `prime_erp_code` varchar(50) DEFAULT NULL,
  `pending_reason` varchar(100) NOT NULL DEFAULT 'MISSING_PRIME_ERP',
  `source_file` varchar(255) DEFAULT NULL,
  `payload_json` json DEFAULT NULL,
  `resolution_status` enum('PENDING','PROMOTED','FAILED') NOT NULL DEFAULT 'PENDING',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_erp_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pending_email_employee_code` (`email`,`employee_code`),
  KEY `idx_pending_resolution_status` (`resolution_status`),
  KEY `idx_pending_prime_erp_code` (`prime_erp_code`),
  KEY `idx_pending_department_code` (`department_code`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_import_pending`
--

LOCK TABLES `employee_import_pending` WRITE;
/*!40000 ALTER TABLE `employee_import_pending` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_import_pending` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_advance_rows`
--

LOCK TABLES `expenditure_advance_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_advance_rows` DISABLE KEYS */;
INSERT INTO `expenditure_advance_rows` VALUES (1,1,NULL,19,26,'planned','Civil Infrastructure','Canopy',11000.00,NULL,100.00,11000.00,10900.00,NULL,0,'2026-05-02 14:17:58','2026-05-25 18:07:00',1,1),(5,7,NULL,19,26,'planned','Civil Infrastructure','Canopy',11000.00,NULL,100.00,11000.00,10900.00,NULL,0,'2026-05-12 17:43:24','2026-05-25 18:07:00',1,1),(6,9,NULL,19,26,'planned','Civil Infrastructure','Canopy',12000.00,NULL,1000.00,12000.00,11000.00,NULL,0,'2026-05-13 02:34:46','2026-05-25 18:07:00',1,1),(9,10,NULL,21,28,'planned','Electrical Infrastructure','Air Conditioner',10000.00,NULL,100.00,10000.00,9500.00,NULL,0,'2026-05-21 17:39:03','2026-05-25 18:07:00',2,7),(10,10,NULL,21,28,'planned','Electrical Infrastructure','Air Conditioner',10000.00,NULL,400.00,10000.00,9500.00,NULL,1,'2026-05-21 17:39:03','2026-05-25 18:07:00',2,7),(11,11,NULL,23,30,'planned','Furniture & Fixtures','Wooden Cup Boards',250000.00,NULL,60000.00,250000.00,190000.00,NULL,0,'2026-05-21 17:41:29','2026-05-25 18:07:00',4,42),(12,12,NULL,19,26,'planned','Civil Infrastructure','Canopy',16000.00,NULL,6000.00,16000.00,10000.00,NULL,0,'2026-05-22 06:52:11','2026-05-25 18:07:00',1,1);
/*!40000 ALTER TABLE `expenditure_advance_rows` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `expenditure_budget_ledger` WRITE;
/*!40000 ALTER TABLE `expenditure_budget_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_budget_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenditure_bulk_neft_files`
--

DROP TABLE IF EXISTS `expenditure_bulk_neft_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenditure_bulk_neft_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expenditure_id` int NOT NULL,
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
  CONSTRAINT `chk_expenditure_bulk_neft_excel_name` CHECK (regexp_like(lower(`original_name`),_utf8mb4'\\.(xlsx|xls)$'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_bulk_neft_files`
--

LOCK TABLES `expenditure_bulk_neft_files` WRITE;
/*!40000 ALTER TABLE `expenditure_bulk_neft_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_bulk_neft_files` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `expenditure_income_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_income_rows` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_income_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_line_rows`
--

LOCK TABLES `expenditure_line_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_line_rows` DISABLE KEYS */;
INSERT INTO `expenditure_line_rows` VALUES (2,8,NULL,19,26,'planned','Civil Infrastructure','Canopy',10900.00,'100',100.00,10900.00,10800.00,NULL,0,'2026-05-12 17:44:06','2026-05-25 18:07:00',1,1);
/*!40000 ALTER TABLE `expenditure_line_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_payee_rows`
--

LOCK TABLES `expenditure_payee_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_payee_rows` DISABLE KEYS */;
INSERT INTO `expenditure_payee_rows` VALUES (1,1,1,'KSRCT','State Bank of India','9876543210','KOP4546SDFSDF','Salem',NULL,100.00,'RTGS','Maheshwaran','12345678945','Savings','individual',NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-05-02 14:17:58','2026-05-02 14:17:58'),(7,7,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,100.00,NULL,'123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,NULL,0,'2026-05-12 17:43:24','2026-05-12 17:43:24'),(8,8,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,100.00,'RTGS','123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,NULL,0,'2026-05-12 17:44:06','2026-05-12 17:44:06'),(9,9,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,1000.00,NULL,'123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,'Yes',0,'2026-05-13 02:34:46','2026-05-13 02:34:46'),(12,10,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,100.00,'RTGS','123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,NULL,0,'2026-05-21 17:39:03','2026-05-21 17:39:03'),(13,10,5,'asdad','State Bank of India','asd','123123123','asdad1231231',NULL,400.00,'RTGS','asdad','sad','Current','individual','KSRCT',NULL,NULL,NULL,NULL,NULL,1,'2026-05-21 17:39:03','2026-05-21 17:39:03'),(14,11,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,60000.00,'RTGS','123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,'Yes',0,'2026-05-21 17:41:29','2026-05-21 17:41:29'),(15,12,3,'123123123131','Indian Bank','1231231231','123123123','fadsfsd',NULL,6000.00,'RTGS','123123123131','12313123123','Current','organization','KSREI','Partnership Firm','Yes','sfdsfdfs',NULL,'Yes',0,'2026-05-22 06:52:11','2026-05-22 06:52:11');
/*!40000 ALTER TABLE `expenditure_payee_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_payees`
--

LOCK TABLES `expenditure_payees` WRITE;
/*!40000 ALTER TABLE `expenditure_payees` DISABLE KEYS */;
INSERT INTO `expenditure_payees` VALUES (1,'KSRCT','Maheshwaran','12345678945','9876543210','Savings','State Bank of India','Salem','KOP4546SDFSDF','individual',NULL,NULL,NULL,NULL,NULL,NULL,2,1,'approved',NULL,'2026-05-04 05:05:34',2,'2026-05-02 14:16:47',NULL,'2026-05-02 14:16:47','2026-05-04 05:05:34'),(2,'Pop','Pop','98765432','23123 5987','Current','Punjab National Bank','1231456','123123','individual',NULL,NULL,NULL,NULL,NULL,NULL,2,1,'approved',2,'2026-05-04 05:13:10',3,'2026-05-05 12:35:51',NULL,'2026-05-04 05:13:10','2026-05-05 12:35:51'),(3,'123123123131','123123123131','12313123123','1231231231','Current','Indian Bank','fadsfsd','123123123','organization','KSREI','Partnership Firm','Yes','sfdsfdfs','No',NULL,2,1,'approved',2,'2026-05-05 12:38:12',3,'2026-05-05 12:38:30',NULL,'2026-05-05 12:38:12','2026-05-05 12:38:30'),(4,'asdada','asdada','123123','123123','Current','Punjab National Bank','asdadsasd','123123123','individual','KSRCT',NULL,NULL,NULL,NULL,NULL,2,1,'pending',2,'2026-05-05 12:40:49',NULL,NULL,NULL,'2026-05-05 12:40:49','2026-05-05 12:40:49'),(5,'asdad','asdad','sad','asd','Current','State Bank of India','asdad1231231','123123123','individual','KSRCT',NULL,NULL,NULL,NULL,NULL,2,1,'pending',2,'2026-05-06 10:42:11',NULL,NULL,NULL,'2026-05-06 10:42:11','2026-05-06 10:42:11'),(6,'asdad','asdad','123123123123','123123123','Savings','Punjab National Bank','asdasdasdasd','312312ASDADSDS123123','organization','KSREI','Partnership Firm','No','131231','No',NULL,2,1,'pending',2,'2026-05-06 10:43:18',NULL,NULL,NULL,'2026-05-06 10:43:18','2026-05-06 10:43:18');
/*!40000 ALTER TABLE `expenditure_payees` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `fk_expenditure_request_bills_payee_row` FOREIGN KEY (`payee_row_id`) REFERENCES `expenditure_payee_rows` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_expenditure_request_bills_request` FOREIGN KEY (`expenditure_id`) REFERENCES `expenditure_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_bills`
--

LOCK TABLES `expenditure_request_bills` WRITE;
/*!40000 ALTER TABLE `expenditure_request_bills` DISABLE KEYS */;
INSERT INTO `expenditure_request_bills` VALUES (1,1,NULL,'bill','Combined_Planogram_Audit_Report (2).pdf','1777731478404-780111826-Combined_Planogram_Audit_Report_2_.pdf','/uploads/expenditure/bills/1777731478404-780111826-Combined_Planogram_Audit_Report_2_.pdf','application/pdf',750955,0,'2026-05-02 14:17:58'),(7,7,NULL,'bill','Audit 1_Audit_Report (1).pdf','1778607804242-316182231-Audit_1_Audit_Report_1_.pdf','/uploads/expenditure/bills/1778607804242-316182231-Audit_1_Audit_Report_1_.pdf','application/pdf',605366,0,'2026-05-12 17:43:24'),(8,8,NULL,'bill','Audit 1_Audit_Report (3).pdf','1778607846073-732838955-Audit_1_Audit_Report_3_.pdf','/uploads/expenditure/bills/1778607846073-732838955-Audit_1_Audit_Report_3_.pdf','application/pdf',605370,0,'2026-05-12 17:44:06'),(9,9,NULL,'bill','Audit 1_Audit_Report (1).pdf','1778639686067-914505217-Audit_1_Audit_Report_1_.pdf','/uploads/expenditure/bills/1778639686067-914505217-Audit_1_Audit_Report_1_.pdf','application/pdf',605366,0,'2026-05-13 02:34:46'),(10,10,NULL,'bill','Audit 1_Audit_Report (2).pdf','1779158365053-953938432-Audit_1_Audit_Report_2_.pdf','/uploads/expenditure/bills/1779158365053-953938432-Audit_1_Audit_Report_2_.pdf','application/pdf',605370,0,'2026-05-19 02:39:25'),(11,11,NULL,'bill','Audit 1_Audit_Report (3).pdf','1779385289519-842254088-Audit_1_Audit_Report_3_.pdf','/uploads/expenditure/bills/1779385289519-842254088-Audit_1_Audit_Report_3_.pdf','application/pdf',605370,0,'2026-05-21 17:41:29'),(12,12,NULL,'bill','Audit 1_Audit_Report (1).pdf','1779432731181-412246448-Audit_1_Audit_Report_1_.pdf','/uploads/expenditure/bills/1779432731181-412246448-Audit_1_Audit_Report_1_.pdf','application/pdf',605366,0,'2026-05-22 06:52:11');
/*!40000 ALTER TABLE `expenditure_request_bills` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_edits`
--

LOCK TABLES `expenditure_request_edits` WRITE;
/*!40000 ALTER TABLE `expenditure_request_edits` DISABLE KEYS */;
INSERT INTO `expenditure_request_edits` VALUES (1,11,2,'maheshwaran325@gmail.com','hod',0,'Expenditure request updated','{\"updatedKeys\":[\"payment_status\",\"payment_date\",\"payment_ref_no\",\"payment_mode\",\"payment_debit_account\"],\"paymentProofFilesAdded\":0}','2026-05-21 17:51:06'),(2,11,2,'maheshwaran325@gmail.com','hod',0,'Expenditure request updated','{\"updatedKeys\":[\"payment_status\",\"payment_date\",\"payment_ref_no\",\"payment_mode\",\"payment_debit_account\"],\"paymentProofFilesAdded\":0}','2026-05-21 17:51:16'),(3,11,2,'maheshwaran325@gmail.com','hod',0,'Expenditure request updated','{\"updatedKeys\":[\"payment_status\",\"payment_date\",\"payment_ref_no\",\"payment_mode\",\"payment_debit_account\"],\"paymentProofFilesAdded\":0}','2026-05-21 17:51:24'),(4,11,2,'maheshwaran325@gmail.com','hod',0,'Expenditure request updated','{\"updatedKeys\":[\"payment_status\",\"payment_date\",\"payment_ref_no\",\"payment_mode\",\"payment_debit_account\"],\"paymentProofFilesAdded\":0}','2026-05-21 17:53:30');
/*!40000 ALTER TABLE `expenditure_request_edits` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `expenditure_request_ref_tracker` WRITE;
/*!40000 ALTER TABLE `expenditure_request_ref_tracker` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_request_ref_tracker` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_request_refs`
--

LOCK TABLES `expenditure_request_refs` WRITE;
/*!40000 ALTER TABLE `expenditure_request_refs` DISABLE KEYS */;
INSERT INTO `expenditure_request_refs` VALUES (8,7,2026,1,'#F-2026-0012-A1','2026-05-12 17:43:24'),(9,8,2026,2,'#F-2026-0012-B1','2026-05-12 17:44:06'),(10,9,2026,3,'#F-2026-0010-A1','2026-05-13 02:34:46'),(11,10,2026,4,'#F-2026-0003-A1','2026-05-19 02:39:25'),(12,11,2026,5,'#F-2026-0019-A1','2026-05-21 17:41:29'),(13,12,2026,6,'#F-2026-0016-A1','2026-05-22 06:52:11');
/*!40000 ALTER TABLE `expenditure_request_refs` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_requests`
--

LOCK TABLES `expenditure_requests` WRITE;
/*!40000 ALTER TABLE `expenditure_requests` DISABLE KEYS */;
INSERT INTO `expenditure_requests` (`id`, `finance_request_id`, `employee_id`, `applicant_name`, `designation`, `department`, `email`, `mobile`, `request_date`, `description`, `beneficiary_type`, `beneficiary_value`, `budget_tag`, `department_id`, `beneficiary_entity_id`, `primary_head`, `primary_head_id`, `event_sub_head`, `event_sub_head_id`, `request_type`, `is_budget_proposed`, `proposed_amount`, `balance_amount`, `unplanned_budget_enabled`, `unplanned_budget_amount`, `unplanned_head_of_account`, `unplanned_head_of_account_budget_line_id`, `unplanned_head_of_account_budget_proposal_id`, `unplanned_budget_head`, `unplanned_budget_sub_head`, `unplanned_budget_description`, `income_type`, `income_status`, `income_amount_type`, `credit_status`, `debit_status`, `partial_amount`, `show_bulk_neft`, `payment_mode`, `payment_ref_no`, `payment_date`, `payment_status`, `payment_debit_account`, `advance_total_amount`, `settlement_total_amount`, `expenditure_total_amount`, `settlement_remarks`, `expenditure_remarks`, `tentative_settlement_date`, `total_amount`, `approved_total_amount`, `director_status`, `director_comment`, `principal_status`, `principal_comment`, `principal_priority`, `chairman_status`, `chairman_comment`, `created_by`, `overall_status`, `workflow_state`, `created_at`, `updated_at`) VALUES (1,14,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-02','sfd','Department','CSE (Artificial Intelligence and Machine Learning)',NULL,2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'Advance','No',NULL,10900.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-02','Pending',NULL,100.00,0.00,0.00,NULL,NULL,NULL,100.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"completed\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-02T14:17:58.446Z\", \"updatedAt\": \"2026-05-06T17:21:27.647Z\", \"resolvedAt\": \"2026-05-06T17:21:27.647Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"14-blank-1\", \"workflowrowref\": \"14-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','2026-05-02 14:17:58','2026-05-25 18:07:00'),(7,12,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-12','wererwer','Department','CSE (Artificial Intelligence and Machine Learning)','Laboratory',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'Advance','No',NULL,10900.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-12','Pending',NULL,100.00,0.00,0.00,NULL,NULL,NULL,100.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"completed\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-12T17:43:24.267Z\", \"updatedAt\": \"2026-05-21T17:38:16.690Z\", \"resolvedAt\": \"2026-05-21T17:38:16.690Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": \"Auto-approved after DoF clearance\", \"dashboardRowId\": \"12-blank-1\", \"workflowrowref\": \"12-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','2026-05-12 17:43:24','2026-05-25 18:07:00'),(8,12,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-12','wererwer','Department','CSE (Artificial Intelligence and Machine Learning)','Laboratory',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'Expenditure','No',NULL,10900.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-12','Pending',NULL,0.00,0.00,100.00,NULL,NULL,NULL,100.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Expenditure\", \"status\": \"returned\", \"version\": 1, \"rowIndex\": 2, \"startedAt\": \"2026-05-12T17:44:06.091Z\", \"updatedAt\": \"2026-05-20T06:56:50.231Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": \"returned\", \"lastFeedback\": \"fok\", \"dashboardRowId\": \"12-manual-2\", \"workflowrowref\": \"12-expenditure-manual-2\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": true, \"workflowbudgetproposalid\": 19}','2026-05-12 17:44:06','2026-05-25 18:07:00'),(9,10,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-13','km;','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'Advance','No',NULL,11000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-13','Pending',NULL,1000.00,0.00,0.00,NULL,NULL,NULL,1000.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"returned\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-13T02:34:46.087Z\", \"updatedAt\": \"2026-05-20T06:56:24.345Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": \"returned\", \"lastFeedback\": \"fok\", \"dashboardRowId\": \"10-blank-1\", \"workflowrowref\": \"10-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 1000, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": true, \"workflowbudgetproposalid\": 19}','2026-05-13 02:34:46','2026-05-25 18:07:00'),(10,3,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-21','gsfqe','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Electrical Infrastructure',2,NULL,NULL,'Advance','No',500.00,10700.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-19','Pending',NULL,500.00,0.00,0.00,NULL,NULL,NULL,500.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"completed\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:39:03.620Z\", \"updatedAt\": \"2026-05-21T17:39:23.859Z\", \"resolvedAt\": \"2026-05-21T17:39:23.859Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": \"Auto-approved after DoF clearance\", \"resubmittedAt\": \"2026-05-21T17:39:03.624Z\", \"dashboardRowId\": \"3-blank-1\", \"workflowrowref\": \"3-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 500, \"workflowbudgetlineid\": 28, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 21}','2026-05-19 02:39:25','2026-05-25 18:07:00'),(11,19,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-21','adssd','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Furniture & Fixtures',4,NULL,NULL,'Advance','No',NULL,190000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-21','Cancelled',NULL,60000.00,0.00,0.00,NULL,NULL,NULL,60000.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"completed\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:41:29.541Z\", \"updatedAt\": \"2026-05-21T17:41:49.581Z\", \"resolvedAt\": \"2026-05-21T17:41:49.581Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": \"Auto-approved after DoF clearance\", \"dashboardRowId\": \"19-blank-1\", \"workflowrowref\": \"19-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 60000, \"workflowbudgetlineid\": 30, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 23}','2026-05-21 17:41:29','2026-05-25 18:07:00'),(12,16,226,'Dr. Ajay Doe','Associate Professor','CSE (Artificial Intelligence and Machine Learning)','maheshwaran325@gmail.com','9998887776','2026-05-22','sf','Department','CSE (Artificial Intelligence and Machine Learning)','Skilling',2,NULL,'Civil Infrastructure',1,NULL,NULL,'Advance','No',NULL,10000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'2026-05-22','Pending',NULL,6000.00,0.00,0.00,NULL,NULL,NULL,6000.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-22T06:52:11.224Z\", \"updatedAt\": \"2026-05-22T06:52:11.224Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"16-blank-1\", \"workflowrowref\": \"16-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 6000, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','2026-05-22 06:52:11','2026-05-25 18:07:00');
/*!40000 ALTER TABLE `expenditure_requests` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_settlement_rows`
--

LOCK TABLES `expenditure_settlement_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_settlement_rows` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_settlement_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenditure_unplanned_rows`
--

LOCK TABLES `expenditure_unplanned_rows` WRITE;
/*!40000 ALTER TABLE `expenditure_unplanned_rows` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenditure_unplanned_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_budget_breakup`
--

LOCK TABLES `finance_budget_breakup` WRITE;
/*!40000 ALTER TABLE `finance_budget_breakup` DISABLE KEYS */;
INSERT INTO `finance_budget_breakup` VALUES (2,1,11,10,'Electrical Infrastructure','Lift Installation',100.00,100.00,122.00,22.00,0,'2026-04-01 16:04:30','2026-05-25 18:07:00',2,12),(4,2,12,11,'Civil Infrastructure','Construction Works',100.00,100.00,1000.00,900.00,0,'2026-04-04 06:16:54','2026-05-25 18:07:00',1,2),(11,5,18,24,'Academic Events','Expert Visit',1.00,NULL,100.00,NULL,0,'2026-04-22 14:07:29','2026-05-25 18:07:00',26,268),(13,7,18,25,'Club Activities','Flash Mob',12.00,NULL,1200.00,NULL,0,'2026-04-22 14:29:20','2026-05-25 18:07:00',27,278),(15,9,18,24,'Academic Events','Accommodation',1.00,1.00,95.00,99.00,0,'2026-04-22 14:40:07','2026-05-25 18:07:00',26,NULL),(16,6,18,24,'Academic Events','Accommodation',1.00,NULL,96.00,NULL,0,'2026-04-22 16:01:09','2026-05-25 18:07:00',26,NULL),(17,10,19,26,'Civil Infrastructure','Canopy',12000.00,12000.00,75000.00,63000.00,0,'2026-04-27 04:23:19','2026-05-25 18:07:00',1,1),(19,11,19,26,'Civil Infrastructure','Canopy',12000.00,NULL,51000.00,NULL,0,'2026-04-27 07:36:02','2026-05-25 18:07:00',1,1),(20,12,19,26,'Civil Infrastructure','Canopy',11000.00,11000.00,51000.00,40000.00,0,'2026-04-27 08:06:41','2026-05-25 18:07:00',1,1),(21,13,19,26,'Civil Infrastructure','Canopy',1.00,NULL,40000.00,NULL,0,'2026-04-27 08:16:41','2026-05-25 18:07:00',1,1),(23,15,NULL,NULL,'Civil Infrastructure','',120.00,NULL,29899.00,NULL,0,'2026-04-28 10:32:12','2026-05-25 18:07:00',1,NULL),(29,14,19,26,'Civil Infrastructure','Canopy',11000.00,NULL,12999.00,NULL,0,'2026-05-04 12:46:45','2026-05-25 18:07:00',1,1),(30,16,19,26,'Civil Infrastructure','Canopy',16000.00,16000.00,16999.00,12101.00,0,'2026-05-04 12:47:48','2026-05-25 18:07:00',1,1),(31,3,21,28,'Electrical Infrastructure','Air Conditioner',10000.00,10000.00,12000.00,2000.00,0,'2026-05-04 13:12:56','2026-05-25 18:07:00',2,7),(32,18,19,26,'Civil Infrastructure','Construction Works',899.00,899.00,999.00,28101.00,0,'2026-05-20 07:00:01','2026-05-25 18:07:00',1,2),(33,19,23,30,'Furniture & Fixtures','Wooden Cup Boards',250000.00,250000.00,25000000.00,24750000.00,0,'2026-05-20 07:12:50','2026-05-25 18:07:00',4,42),(34,17,18,24,'Academic Events','Expert Visit',10.00,NULL,95.00,NULL,0,'2026-05-27 17:16:59','2026-05-27 17:16:59',26,268),(35,8,18,24,'Academic Events','A/V Arrangements',2.00,NULL,87.00,NULL,0,'2026-06-02 04:28:59','2026-06-02 04:28:59',26,268),(36,4,21,28,'Electrical Infrastructure','Electrical Wiring',100.00,NULL,2000.00,NULL,0,'2026-06-03 16:29:35','2026-06-03 16:29:35',2,7);
/*!40000 ALTER TABLE `finance_budget_breakup` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `finance_budget_line_usage` WRITE;
/*!40000 ALTER TABLE `finance_budget_line_usage` DISABLE KEYS */;
INSERT INTO `finance_budget_line_usage` VALUES (10,100.00,'2026-04-01 16:06:47'),(11,100.00,'2026-04-04 06:17:28'),(24,1.00,'2026-05-02 16:50:34'),(26,62899.00,'2026-05-20 07:27:16'),(28,10000.00,'2026-05-04 13:13:02'),(30,250000.00,'2026-05-20 07:30:24');
/*!40000 ALTER TABLE `finance_budget_line_usage` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_budget_usage_ledger`
--

LOCK TABLES `finance_budget_usage_ledger` WRITE;
/*!40000 ALTER TABLE `finance_budget_usage_ledger` DISABLE KEYS */;
INSERT INTO `finance_budget_usage_ledger` VALUES (1,1,2,10,'consume',100.00,100.00,1,'Principal approval committed amount','2026-04-01 16:06:47'),(2,2,4,11,'consume',100.00,100.00,1,'Principal approval committed amount','2026-04-04 06:17:28'),(3,10,17,26,'consume',12000.00,12000.00,4,'Principal approval committed amount','2026-04-27 05:34:18'),(4,11,NULL,26,'consume',12000.00,24000.00,4,'Principal approval committed amount','2026-04-27 07:25:57'),(5,12,20,26,'consume',11000.00,35000.00,4,'Principal approval committed amount','2026-04-27 08:09:46'),(6,14,NULL,26,'consume',11000.00,46000.00,4,'Principal approval committed amount','2026-04-27 09:24:57'),(7,9,15,24,'consume',1.00,1.00,4,'Principal approval committed amount','2026-05-02 16:50:34'),(8,3,31,28,'consume',10000.00,10000.00,4,'Principal approval committed amount','2026-05-04 13:13:02'),(9,18,32,26,'consume',899.00,46899.00,4,'Principal approval committed amount','2026-05-20 07:01:46'),(10,16,30,26,'consume',16000.00,62899.00,4,'Principal approval committed amount','2026-05-20 07:27:16'),(11,19,33,30,'consume',250000.00,250000.00,4,'Principal approval committed amount','2026-05-20 07:30:24');
/*!40000 ALTER TABLE `finance_budget_usage_ledger` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_carry_forward_allocations`
--

LOCK TABLES `finance_carry_forward_allocations` WRITE;
/*!40000 ALTER TABLE `finance_carry_forward_allocations` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_carry_forward_allocations` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_income_rows`
--

LOCK TABLES `finance_income_rows` WRITE;
/*!40000 ALTER TABLE `finance_income_rows` DISABLE KEYS */;
INSERT INTO `finance_income_rows` VALUES (2,1,'Registration Fees','Partial',19.00,'Credited',NULL,'KSRCT-PRINCIPAL COMMON A/C | 0751301000264891',0,'2026-04-01 16:04:30','2026-04-01 16:04:30');
/*!40000 ALTER TABLE `finance_income_rows` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_annexures`
--

LOCK TABLES `finance_request_annexures` WRITE;
/*!40000 ALTER TABLE `finance_request_annexures` DISABLE KEYS */;
INSERT INTO `finance_request_annexures` VALUES (7,5,'Proforma Invoice','Tblock.png','finance-annexure-1776866849824-230377193.png','/uploads/finance-annexures/finance-annexure-1776866849824-230377193.png','image/png',25849,0,'2026-04-22 14:07:29'),(9,7,'Invoice','Tresult.png','finance-annexure-1776868160772-137960372.png','/uploads/finance-annexures/finance-annexure-1776868160772-137960372.png','image/png',20550,0,'2026-04-22 14:29:20'),(11,9,'Invoice','Tresult.png','finance-annexure-1776868807779-872374888.png','/uploads/finance-annexures/finance-annexure-1776868807779-872374888.png','image/png',20550,0,'2026-04-22 14:40:07'),(12,6,'Proforma Invoice','Tblock.png','finance-annexure-1776867461383-939558420.png','/uploads/finance-annexures/finance-annexure-1776867461383-939558420.png','image/png',25849,0,'2026-04-22 16:01:09'),(13,10,'Proforma Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777263799083-821915584.pdf','/uploads/finance-annexures/finance-annexure-1777263799083-821915584.pdf','application/pdf',37403,0,'2026-04-27 04:23:19'),(15,11,'Proforma Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777274712561-45971169.pdf','/uploads/finance-annexures/finance-annexure-1777274712561-45971169.pdf','application/pdf',37403,0,'2026-04-27 07:36:02'),(16,12,'Quotation','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777277201944-251360204.pdf','/uploads/finance-annexures/finance-annexure-1777277201944-251360204.pdf','application/pdf',37403,0,'2026-04-27 08:06:41'),(17,12,'principal_approval','TESTAUDIT1_Audit_Report.pdf','finance-principal-12-1777277386823-119046018.pdf','/uploads/finance-principal-documents/finance-principal-12-1777277386823-119046018.pdf','application/pdf',613221,0,'2026-04-27 08:09:46'),(18,13,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777277801737-874439735.pdf','/uploads/finance-annexures/finance-annexure-1777277801737-874439735.pdf','application/pdf',37403,0,'2026-04-27 08:16:41'),(21,15,'Quotation','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777372332921-219742517.pdf','/uploads/finance-annexures/finance-annexure-1777372332921-219742517.pdf','application/pdf',37403,0,'2026-04-28 10:32:12'),(25,14,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777281864808-55494516.pdf','/uploads/finance-annexures/finance-annexure-1777281864808-55494516.pdf','application/pdf',37403,0,'2026-05-04 12:46:45'),(26,14,'principal_approval','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-principal-14-1777281897669-262979876.pdf','/uploads/finance-principal-documents/finance-principal-14-1777281897669-262979876.pdf','application/pdf',37403,1,'2026-05-04 12:46:45'),(27,16,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777372447840-129645896.pdf','/uploads/finance-annexures/finance-annexure-1777372447840-129645896.pdf','application/pdf',37403,0,'2026-05-04 12:47:48'),(28,3,'Proforma Invoice','Tresult.png','finance-annexure-1775908778824-321089435.png','/uploads/finance-annexures/finance-annexure-1775908778824-321089435.png','image/png',20550,0,'2026-05-04 13:12:56'),(29,8,'Invoice','Tresult.png','finance-annexure-1776868475836-888060272.png','/uploads/finance-annexures/finance-annexure-1776868475836-888060272.png','image/png',20550,0,'2026-06-02 04:28:59'),(30,4,'Invoice','Tresult.png','finance-annexure-1776341177184-353926778.png','/uploads/finance-annexures/finance-annexure-1776341177184-353926778.png','image/png',20550,0,'2026-06-03 16:29:35');
/*!40000 ALTER TABLE `finance_request_annexures` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_edits`
--

LOCK TABLES `finance_request_edits` WRITE;
/*!40000 ALTER TABLE `finance_request_edits` DISABLE KEYS */;
INSERT INTO `finance_request_edits` VALUES (1,1,2,'maheshwaran325@gmail.com','hod',0,'3 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (1 row(s))','{\"changedFields\":[{\"key\":\"request_date\",\"label\":\"Request date\",\"before\":\"Wed Apr 01 2026 00:00:00 GMT+0530 (India Standard Time)\",\"after\":\"2026-03-31\"},{\"key\":\"description\",\"label\":\"Description\",\"before\":\"-\",\"after\":\"okay\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"100.00\",\"after\":\"100\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":1,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-01 16:04:30'),(2,2,2,'maheshwaran325@gmail.com','hod',0,'3 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"request_date\",\"label\":\"Request date\",\"before\":\"Sat Apr 04 2026 00:00:00 GMT+0530 (India Standard Time)\",\"after\":\"2026-04-03\"},{\"key\":\"description\",\"label\":\"Description\",\"before\":\"asd\",\"after\":\"aoof\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"100.00\",\"after\":\"100\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-04 06:16:54'),(3,3,2,'maheshwaran325@gmail.com','hod',0,'4 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"unplanned_budget_enabled\",\"label\":\"Unplanned budget enabled\",\"before\":\"-\",\"after\":\"1\"},{\"key\":\"unplanned_budget_amount\",\"label\":\"Unplanned budget amount\",\"before\":\"-\",\"after\":\"122\"},{\"key\":\"unplanned_budget_description\",\"label\":\"Unplanned budget description\",\"before\":\"-\",\"after\":\"new\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"100.00\",\"after\":\"222\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-11 12:01:57'),(4,3,2,'maheshwaran325@gmail.com','hod',0,'2 field(s) updated | Budget breakup updated (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"unplanned_budget_amount\",\"label\":\"Unplanned budget amount\",\"before\":\"122.00\",\"after\":\"122\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"222.00\",\"after\":\"132\"}],\"budgetRowsChanged\":true,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-11 12:17:14'),(5,3,2,'maheshwaran325@gmail.com','hod',0,'2 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"unplanned_budget_amount\",\"label\":\"Unplanned budget amount\",\"before\":\"122.00\",\"after\":\"1200\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"132.00\",\"after\":\"1210\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-11 12:39:46'),(6,4,2,'maheshwaran325@gmail.com','hod',0,'2 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"description\",\"label\":\"Description\",\"before\":\"ads\",\"after\":\"adsd\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"100.00\",\"after\":\"100\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-16 12:08:00'),(7,6,2,'maheshwaran325@gmail.com','hod',0,'1 field(s) updated | Budget breakup updated (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"2.00\",\"after\":\"1\"}],\"budgetRowsChanged\":true,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-22 16:01:09'),(8,11,2,'maheshwaran325@gmail.com','hod',0,'2 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"description\",\"label\":\"Description\",\"before\":\"wef\",\"after\":\"wefff\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"12000.00\",\"after\":\"12000\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-04-27 07:36:02'),(9,17,1,'maverickmyth333@gmail.com','super_admin',1,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"10.00\",\"after\":\"10\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"super_admin\",\"actorEmail\":\"maverickmyth333@gmail.com\",\"actorIsAdmin\":true}','2026-05-03 08:53:16'),(10,16,2,'maheshwaran325@gmail.com','hod',0,'1 field(s) updated | Budget breakup updated (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"100.00\",\"after\":\"10000\"}],\"budgetRowsChanged\":true,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-05-04 12:42:30'),(11,16,2,'maheshwaran325@gmail.com','hod',0,'1 field(s) updated | Budget breakup updated (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"10000.00\",\"after\":\"16000\"}],\"budgetRowsChanged\":true,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-05-04 12:42:47'),(12,14,1,'maverickmyth333@gmail.com','super_admin',1,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"11000.00\",\"after\":\"11000\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"super_admin\",\"actorEmail\":\"maverickmyth333@gmail.com\",\"actorIsAdmin\":true}','2026-05-04 12:46:45'),(13,16,1,'maverickmyth333@gmail.com','super_admin',1,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"16000.00\",\"after\":\"16000\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"super_admin\",\"actorEmail\":\"maverickmyth333@gmail.com\",\"actorIsAdmin\":true}','2026-05-04 12:47:48'),(14,3,4,'maheshwaran3253@gmail.com','principal',0,'2 field(s) updated | Budget breakup updated (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"unplanned_budget_amount\",\"label\":\"Unplanned budget amount\",\"before\":\"1200.00\",\"after\":\"1200\"},{\"key\":\"total_budget\",\"label\":\"Total budget\",\"before\":\"1210.00\",\"after\":\"11200\"}],\"budgetRowsChanged\":true,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"principal\",\"actorEmail\":\"maheshwaran3253@gmail.com\",\"actorIsAdmin\":false}','2026-05-04 13:12:56'),(15,17,2,'maheshwaran325@gmail.com','hod',0,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"description\",\"label\":\"Description\",\"before\":\"ok\",\"after\":\"okasd\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-05-27 17:16:59'),(16,8,1,'maverickmyth333@gmail.com','super_admin',1,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"description\",\"label\":\"Description\",\"before\":\"sfd\",\"after\":\"sfdafsdsfafdaasfasf\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"super_admin\",\"actorEmail\":\"maverickmyth333@gmail.com\",\"actorIsAdmin\":true}','2026-06-02 04:28:59'),(17,4,2,'maheshwaran325@gmail.com','hod',0,'1 field(s) updated | Budget breakup reviewed (1 row(s)) | Income rows reviewed (0 row(s))','{\"changedFields\":[{\"key\":\"description\",\"label\":\"Description\",\"before\":\"adsd\",\"after\":\"adsdsdasdasdasda\"}],\"budgetRowsChanged\":false,\"incomeRowsChanged\":false,\"budgetRowsCount\":1,\"incomeRowsCount\":0,\"actorRole\":\"hod\",\"actorEmail\":\"maheshwaran325@gmail.com\",\"actorIsAdmin\":false}','2026-06-03 16:29:35');
/*!40000 ALTER TABLE `finance_request_edits` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `finance_request_ref_tracker` WRITE;
/*!40000 ALTER TABLE `finance_request_ref_tracker` DISABLE KEYS */;
INSERT INTO `finance_request_ref_tracker` VALUES (2026,19,'2026-05-20 07:12:50');
/*!40000 ALTER TABLE `finance_request_ref_tracker` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_request_refs`
--

LOCK TABLES `finance_request_refs` WRITE;
/*!40000 ALTER TABLE `finance_request_refs` DISABLE KEYS */;
INSERT INTO `finance_request_refs` VALUES (1,1,2026,1,'#F-2026-0001','2026-04-01 15:47:12'),(2,2,2026,2,'#F-2026-0002','2026-04-04 06:15:38'),(3,3,2026,3,'#F-2026-0003','2026-04-11 11:59:38'),(4,4,2026,4,'#F-2026-0004','2026-04-16 12:06:17'),(5,5,2026,5,'#F-2026-0005','2026-04-22 14:07:29'),(6,6,2026,6,'#F-2026-0006','2026-04-22 14:17:41'),(7,7,2026,7,'#F-2026-0007','2026-04-22 14:29:20'),(8,8,2026,8,'#F-2026-0008','2026-04-22 14:34:35'),(9,9,2026,9,'#F-2026-0009','2026-04-22 14:40:07'),(10,10,2026,10,'#F-2026-0010','2026-04-27 04:23:19'),(11,11,2026,11,'#F-2026-0011','2026-04-27 07:25:12'),(12,12,2026,12,'#F-2026-0012','2026-04-27 08:06:41'),(13,13,2026,13,'#F-2026-0013','2026-04-27 08:16:41'),(14,14,2026,14,'#F-2026-0014','2026-04-27 09:24:24'),(15,15,2026,15,'#F-2026-0015','2026-04-28 10:32:12'),(16,16,2026,16,'#F-2026-0016','2026-04-28 10:34:07'),(17,17,2026,17,'#F-2026-0017','2026-05-02 16:46:08'),(18,18,2026,18,'#F-2026-0018','2026-05-20 07:00:01'),(19,19,2026,19,'#F-2026-0019','2026-05-20 07:12:50');
/*!40000 ALTER TABLE `finance_request_refs` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `fk_finance_requests_department` FOREIGN KEY (`department_id`) REFERENCES `master_departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `master_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_entity` FOREIGN KEY (`beneficiary_entity_id`) REFERENCES `master_entities` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_finance_requests_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_requests`
--

LOCK TABLES `finance_requests` WRITE;
/*!40000 ALTER TABLE `finance_requests` DISABLE KEYS */;
INSERT INTO `finance_requests` (`id`, `employee_id`, `applicant_name`, `designation`, `department`, `email`, `mobile`, `request_date`, `description`, `beneficiary_type`, `beneficiary_value`, `budget_tag`, `department_id`, `beneficiary_entity_id`, `primary_head`, `primary_head_id`, `event_sub_head`, `event_sub_head_id`, `is_budget_proposed`, `proposed_amount`, `balance_amount`, `unplanned_budget_enabled`, `unplanned_budget_amount`, `unplanned_budget_description`, `income_type`, `income_status`, `income_amount_type`, `credit_status`, `debit_status`, `partial_amount`, `enclosures`, `annexure_type`, `annexure_file_name`, `annexure_storage_name`, `annexure_file_path`, `annexure_mime_type`, `annexure_file_size`, `total_budget`, `approved_total_amount`, `director_status`, `director_comment`, `principal_status`, `principal_comment`, `principal_priority`, `chairman_status`, `chairman_comment`, `created_by`, `overall_status`, `workflow_state`, `created_at`, `updated_at`) VALUES (1,226,NULL,NULL,NULL,NULL,NULL,'2026-03-31','okay','Cell','Institutions Innovation Council','Essentials',2,1,'Electrical Infrastructure',2,NULL,NULL,'No',NULL,22.00,0,NULL,NULL,'Registration Fees','KSRCT-PRINCIPAL COMMON A/C | 0751301000264891','Partial','Credited',NULL,19.00,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100.00,100.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'deleted','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"deleted\", \"version\": 1, \"deletedAt\": \"2026-04-12T13:08:36.339Z\", \"startedAt\": \"2026-04-01T16:04:30.810Z\", \"updatedAt\": \"2026-04-12T13:08:36.339Z\", \"resolvedAt\": \"2026-04-12T13:08:36.339Z\", \"currentStage\": \"deleted\", \"lastDecision\": \"deleted\", \"lastFeedback\": \"Deleted by user\", \"resubmittedAt\": \"2026-04-01T16:04:30.811Z\", \"deletedByEmail\": \"maverickmyth333@gmail.com\", \"deletedByUserId\": 1, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','2026-04-01 15:47:12','2026-05-25 18:07:00'),(2,226,NULL,NULL,NULL,NULL,NULL,'2026-04-03','aoof','Cell','Institutions Innovation Council','Essentials',2,1,'Civil Infrastructure',1,NULL,NULL,'No',NULL,900.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,100.00,100.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'deleted','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"deleted\", \"version\": 1, \"deletedAt\": \"2026-04-16T06:51:32.855Z\", \"startedAt\": \"2026-04-04T06:16:54.981Z\", \"updatedAt\": \"2026-04-16T06:51:32.855Z\", \"resolvedAt\": \"2026-04-16T06:51:32.855Z\", \"currentStage\": \"deleted\", \"lastDecision\": \"deleted\", \"lastFeedback\": \"Deleted by user\", \"resubmittedAt\": \"2026-04-04T06:16:54.983Z\", \"deletedByEmail\": \"maverickmyth333@gmail.com\", \"deletedByUserId\": 1, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','2026-04-04 06:15:38','2026-05-25 18:07:00'),(3,226,NULL,NULL,NULL,NULL,NULL,'2026-04-11','gsf','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Electrical Infrastructure',2,NULL,NULL,'No',NULL,2000.00,1,1200.00,'new',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Proforma Invoice','Tresult.png','finance-annexure-1775908778824-321089435.png','/uploads/finance-annexures/finance-annexure-1775908778824-321089435.png','image/png',20550,11200.00,11200.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-11T12:39:46.586Z\", \"updatedAt\": \"2026-05-04T13:13:02.166Z\", \"resolvedAt\": \"2026-05-04T13:13:02.166Z\", \"financeMeta\": {\"unplannedBudgetAmount\": 1200, \"unplannedBudgetEnabled\": true}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:39:46.588Z\", \"submittedTotalBudget\": 1210, \"isEditableByApplicant\": false}','2026-04-11 11:59:38','2026-05-25 18:07:00'),(4,226,NULL,NULL,NULL,NULL,NULL,'2026-04-16','adsdsdasdasdasda','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Electrical Infrastructure',2,NULL,NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','Tresult.png','finance-annexure-1776341177184-353926778.png','/uploads/finance-annexures/finance-annexure-1776341177184-353926778.png','image/png',20550,100.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-16T12:08:00.216Z\", \"updatedAt\": \"2026-04-16T12:08:00.218Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-16T12:08:00.218Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','2026-04-16 12:06:17','2026-06-03 16:29:35'),(5,226,NULL,NULL,NULL,NULL,NULL,'2026-04-22','asd','Department','CSE (Artificial Intelligence and Machine Learning)','Skilling',2,NULL,'Academic Events',26,'Expert Visit',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Proforma Invoice','Tblock.png','finance-annexure-1776866849824-230377193.png','/uploads/finance-annexures/finance-annexure-1776866849824-230377193.png','image/png',25849,1.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:07:29.871Z\", \"updatedAt\": \"2026-04-22T14:07:29.871Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','2026-04-22 14:07:29','2026-05-25 18:07:00'),(6,226,NULL,NULL,NULL,NULL,NULL,'2026-04-22','ad','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Academic Events',26,'Expert Visit',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Proforma Invoice','Tblock.png','finance-annexure-1776867461383-939558420.png','/uploads/finance-annexures/finance-annexure-1776867461383-939558420.png','image/png',25849,1.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:17:41.407Z\", \"updatedAt\": \"2026-04-22T14:17:41.407Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 2, \"isEditableByApplicant\": false}','2026-04-22 14:17:41','2026-05-25 18:07:00'),(7,226,NULL,NULL,NULL,NULL,NULL,'2026-04-22','sdf','Department','CSE (Artificial Intelligence and Machine Learning)','Skilling',2,NULL,'Club Activities',27,'Flash Mob',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','Tresult.png','finance-annexure-1776868160772-137960372.png','/uploads/finance-annexures/finance-annexure-1776868160772-137960372.png','image/png',20550,12.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:29:20.800Z\", \"updatedAt\": \"2026-04-22T14:29:20.800Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 12, \"isEditableByApplicant\": false}','2026-04-22 14:29:20','2026-05-25 18:07:00'),(8,226,NULL,NULL,NULL,NULL,NULL,'2026-04-22','sfdafsdsfafdaasfasf','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Academic Events',26,'Expert Visit',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','Tresult.png','finance-annexure-1776868475836-888060272.png','/uploads/finance-annexures/finance-annexure-1776868475836-888060272.png','image/png',20550,2.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:34:35.883Z\", \"updatedAt\": \"2026-04-22T14:34:35.883Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 2, \"isEditableByApplicant\": false}','2026-04-22 14:34:35','2026-06-02 04:28:59'),(9,226,NULL,NULL,NULL,NULL,NULL,'2026-04-22','sfd','Department','CSE (Artificial Intelligence and Machine Learning)','Laboratory',2,NULL,'Academic Events',26,'Expert Visit',NULL,'No',NULL,99.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','Tresult.png','finance-annexure-1776868807779-872374888.png','/uploads/finance-annexures/finance-annexure-1776868807779-872374888.png','image/png',20550,1.00,1.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-22T14:40:07.807Z\", \"updatedAt\": \"2026-05-02T16:50:34.008Z\", \"resolvedAt\": \"2026-05-02T16:50:34.008Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','2026-04-22 14:40:07','2026-05-25 18:07:00'),(10,226,NULL,NULL,NULL,NULL,NULL,'2026-04-27','km;','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'No',NULL,63000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Proforma Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777263799083-821915584.pdf','/uploads/finance-annexures/finance-annexure-1777263799083-821915584.pdf','application/pdf',37403,12000.00,12000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-27T04:23:19.113Z\", \"updatedAt\": \"2026-04-27T05:34:18.379Z\", \"resolvedAt\": \"2026-04-27T05:34:18.379Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','2026-04-27 04:23:19','2026-05-25 18:07:00'),(11,226,NULL,NULL,NULL,NULL,NULL,'2026-04-27','wefff','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'No',NULL,51000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Proforma Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777274712561-45971169.pdf','/uploads/finance-annexures/finance-annexure-1777274712561-45971169.pdf','application/pdf',37403,12000.00,12000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"returned\", \"version\": 1, \"startedAt\": \"2026-04-27T07:36:02.152Z\", \"updatedAt\": \"2026-05-04T12:47:38.814Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"null\", \"lastDecision\": \"returned\", \"lastFeedback\": \"pojo\", \"resubmittedAt\": \"2026-04-27T07:36:02.154Z\", \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": true}','2026-04-27 07:25:12','2026-05-25 18:07:00'),(12,226,NULL,NULL,NULL,NULL,NULL,'2026-04-27','wererwer','Department','CSE (Artificial Intelligence and Machine Learning)','Laboratory',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'No',NULL,40000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Quotation','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777277201944-251360204.pdf','/uploads/finance-annexures/finance-annexure-1777277201944-251360204.pdf','application/pdf',37403,11000.00,11000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-27T08:06:41.987Z\", \"updatedAt\": \"2026-04-27T08:09:46.842Z\", \"resolvedAt\": \"2026-04-27T08:09:46.842Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','2026-04-27 08:06:41','2026-05-25 18:07:00'),(13,226,NULL,NULL,NULL,NULL,NULL,'2026-04-27','asd','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777277801737-874439735.pdf','/uploads/finance-annexures/finance-annexure-1777277801737-874439735.pdf','application/pdf',37403,1.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"returned\", \"version\": 1, \"startedAt\": \"2026-04-27T08:16:41.765Z\", \"updatedAt\": \"2026-05-27T17:16:20.825Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": \"returned\", \"lastFeedback\": \"re do\", \"submittedTotalBudget\": 1, \"isEditableByApplicant\": true}','2026-04-27 08:16:41','2026-05-27 17:16:20'),(14,226,NULL,NULL,NULL,NULL,NULL,'2026-04-27','sfd','Department','CSE (Artificial Intelligence and Machine Learning)','Laboratory',2,NULL,'Civil Infrastructure',1,'Canopy',NULL,'No',NULL,29000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777281864808-55494516.pdf','/uploads/finance-annexures/finance-annexure-1777281864808-55494516.pdf','application/pdf',37403,11000.00,11000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-27T09:24:24.869Z\", \"updatedAt\": \"2026-04-27T09:24:57.694Z\", \"resolvedAt\": \"2026-04-27T09:24:57.694Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','2026-04-27 09:24:24','2026-05-25 18:07:00'),(15,226,NULL,NULL,NULL,NULL,NULL,'2026-04-28','sdf','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Civil Infrastructure',1,NULL,NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Quotation','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777372332921-219742517.pdf','/uploads/finance-annexures/finance-annexure-1777372332921-219742517.pdf','application/pdf',37403,120.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-28T10:32:12.972Z\", \"updatedAt\": \"2026-05-06T12:29:21.324Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 120, \"isEditableByApplicant\": false}','2026-04-28 10:32:12','2026-05-25 18:07:00'),(16,226,NULL,NULL,NULL,NULL,NULL,'2026-04-28','sf','Department','CSE (Artificial Intelligence and Machine Learning)','Skilling',2,NULL,'Civil Infrastructure',1,NULL,NULL,'No',NULL,12101.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Invoice','OLY_2026-04-23_2026-04-24_UserActivity.pdf','finance-annexure-1777372447840-129645896.pdf','/uploads/finance-annexures/finance-annexure-1777372447840-129645896.pdf','application/pdf',37403,16000.00,16000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-28T10:34:07.873Z\", \"updatedAt\": \"2026-05-20T07:27:16.695Z\", \"resolvedAt\": \"2026-05-20T07:27:16.695Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','2026-04-28 10:34:07','2026-05-25 18:07:00'),(17,226,NULL,NULL,NULL,NULL,NULL,'2026-05-02','okasd','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Academic Events',26,'Workshop',NULL,'No',NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,10.00,0.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'pending','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-27T17:16:59.166Z\", \"updatedAt\": \"2026-05-27T17:19:33.785Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-05-27T17:16:59.167Z\", \"submittedTotalBudget\": 10, \"isEditableByApplicant\": false}','2026-05-02 16:46:08','2026-05-27 17:19:33'),(18,226,NULL,NULL,NULL,NULL,NULL,'2026-05-20','adsad','Department','CSE (Artificial Intelligence and Machine Learning)','Skilling',2,NULL,'Civil Infrastructure',1,NULL,NULL,'No',NULL,28101.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,899.00,899.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-05-20T07:00:01.677Z\", \"updatedAt\": \"2026-05-20T07:01:46.659Z\", \"resolvedAt\": \"2026-05-20T07:01:46.659Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 899, \"isEditableByApplicant\": false}','2026-05-20 07:00:01','2026-05-25 18:07:00'),(19,226,NULL,NULL,NULL,NULL,NULL,'2026-05-20','adssd','Department','CSE (Artificial Intelligence and Machine Learning)','Association',2,NULL,'Furniture & Fixtures',4,NULL,NULL,'No',NULL,24750000.00,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,250000.00,250000.00,'pending',NULL,'pending',NULL,NULL,'pending',NULL,2,'approved','{\"flow\": [\"level1\", \"dof\", \"principal\", \"chairman\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-05-20T07:12:50.298Z\", \"updatedAt\": \"2026-05-20T07:30:24.965Z\", \"resolvedAt\": \"2026-05-20T07:30:24.965Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 250000, \"isEditableByApplicant\": false}','2026-05-20 07:12:50','2026-05-25 18:07:00');
/*!40000 ALTER TABLE `finance_requests` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `finance_status_updates` WRITE;
/*!40000 ALTER TABLE `finance_status_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_status_updates` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_indexes`
--

LOCK TABLES `journal_indexes` WRITE;
/*!40000 ALTER TABLE `journal_indexes` DISABLE KEYS */;
INSERT INTO `journal_indexes` VALUES (1,1,'SCIE'),(2,2,'Scopus'),(3,1,'SCIE'),(4,3,'SCIE'),(5,3,'SCIE'),(6,4,'Scopus'),(7,4,'PubMed'),(8,5,'SCIE'),(9,5,'SCIE'),(10,5,'SCIE'),(11,5,'SCIE'),(12,6,'Scopus'),(13,6,'Scopus'),(14,7,'Scopus'),(15,7,'Scopus'),(16,7,'Scopus'),(17,7,'Scopus'),(18,7,'Scopus'),(19,7,'PubMed'),(20,7,'Scopus'),(21,7,'PubMed');
/*!40000 ALTER TABLE `journal_indexes` ENABLE KEYS */;
UNLOCK TABLES;

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
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` enum('National','International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (`id`),
  KEY `idx_journal_options_name` (`journal_name`),
  KEY `idx_journal_options_publisher` (`publisher`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_options`
--

LOCK TABLES `journal_options` WRITE;
/*!40000 ALTER TABLE `journal_options` DISABLE KEYS */;
INSERT INTO `journal_options` VALUES (1,'New SAlem','Salem in','statix.pro','123123','921290134',4.521,3.200,'2024-12-10 05:40:33','2026-01-23 10:55:53','National'),(7,'New SAlem','Global Academic Publications Pvt. Ltd.','https://www.ijari-journal.org','qeqwe','12adsa',12.000,424.400,'2026-01-23 11:35:03','2026-02-02 11:44:29','International');
/*!40000 ALTER TABLE `journal_options` ENABLE KEYS */;
UNLOCK TABLES;

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
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` enum('National','International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `journal_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_requests`
--

LOCK TABLES `journal_requests` WRITE;
/*!40000 ALTER TABLE `journal_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_requests` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_status_updates`
--

LOCK TABLES `journal_status_updates` WRITE;
/*!40000 ALTER TABLE `journal_status_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `journal_status_updates` ENABLE KEYS */;
UNLOCK TABLES;

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
  `anna_university_listed` tinyint(1) DEFAULT NULL,
  `anna_university_annexure_no` varchar(50) DEFAULT NULL,
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
  PRIMARY KEY (`id`),
  KEY `fk_journal_options` (`journal_options_id`),
  KEY `idx_journals_admin_approval_status` (`admin_approval_status`),
  KEY `fk_journals_admin_approved_by` (`admin_approved_by`),
  KEY `fk_journals_admin_rejected_by` (`admin_rejected_by`),
  CONSTRAINT `fk_journal_options` FOREIGN KEY (`journal_options_id`) REFERENCES `journal_options` (`id`),
  CONSTRAINT `fk_journals_admin_approved_by` FOREIGN KEY (`admin_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_journals_admin_rejected_by` FOREIGN KEY (`admin_rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journals`
--

LOCK TABLES `journals` WRITE;
/*!40000 ALTER TABLE `journals` DISABLE KEYS */;
INSERT INTO `journals` VALUES (1,'National','NEW 1 Published',NULL,NULL,'Erratum','Q2',12.000,424.400,0,NULL,'{\"Nil\": true}','2026-01-05','published','approved','Backfilled during publication approval workflow rollout',NULL,'2026-01-31 07:40:24',NULL,NULL,NULL,NULL,NULL,12,33,NULL,'Skip to main contentSkip to footer\nNYC Open Data logo\nDOB After Hour Variance Permits\nHousing & Development\nList of all after-hours variances issued in DOB NOW\nLast Updated\nApril 19, 2023\nData Provided By\nDepartment of Buildings (DOB)\nAbout this Dataset\nUpdated\nApril 19, 2023\nData Last Updated\nApril 19, 2023\nMetadata Last Updated\nNovember 30, 2020\nDate Created\nSeptember 17, 2020\nViews\n5,451\nDownloads\n2,432\nData Provided by\nDepartment of Buildings (DOB)\nDataset Owner\nNYC OpenData\nDataset Information\nAgency	Department of Buildings (DOB)\nUpdate\nUpdate Frequency	Daily\nAutomation	Yes\nDate Made Public	11/30/2020\nAttachments\nData Dictionary - DOB NOW Buil - After Hour Variances.xlsxThis file has not been scanned for security.\nTopics\nCategory	Housing & Development\nTags	\ndob,ahv,variances,buildings\nWhat\'s in this Dataset?\nRows\n255K\nColumns\n24\nColumns (24)\n\nColumn Name\nDescription\n\nAPI Field Name\n\nData Type\nBIN\nBuilding Identification Number assigned by Department of City Planning.\nbin\nText\nHouseNumber\nThe house number for the building owner\'s address.\nhousenumber\nText\nStreetName\nThe street name for the building owner\'s address.\nstreetname\nText\nBorough\nA number to indicate the NYC borough where the proposed work will take place.\nborough\nText\nCBNo\nA number to indicate the NYC borough where the proposed work will take place.\ncbno\nNumber\nJob Number\nThe DOB job number(s) assigned when the applicant begins the application.\njob_number\nText\nWorkPermitNumber\nThe DOB work permit(s) associated with the after hours variance\nworkpermitnumber\nText\nAHV Permit Number\nThe DOB AHV Permit Number assigned when the after hours variance is issued\nahv_permit_number\nText\nAHVPermitStatus\nThe status of the after hours variance\nahvpermitstatus\nText\nVarianceType\nThe type of variance issued (initial or renewal)\nvariancetype\nText\nreasonforvariance\nThe reason the after hours variance has been sought\nreasonforvariance\nText\nVariance Start Date-Time\nDate when the after hours variance initiates\nvariance_start_date_time\nFloating Timestamp\nVariance End Date-Time\nDate when the after hours variance expires\nvariance_end_date_time\nFloating Timestamp\nIs_a_residence_within_200feet_of_the_site\nIndicates whether or not a residence is located within 200 feet of the address of the after hours variance\nresidence_200ft\nCheckbox\nIs_all_the_work_within_an_enclosed_building\nIndicates whether or not the after hours variance applies to work being done in an enclosed building\nenclosed_work\nCheckbox\nRows per page:\n15\n1-15 of 24\nGo to the previous page\nGo to the next page\nDataset Changelog\nNo changes have been archived yet','asd, asda,asdasd','[\"2. Zero Hunger\", \"3. Good Health and Well-being\"]',NULL,'2026-01-20','2026-01-30','/uploads/journalform-articles/1769840765492-letter_for_internship.pdf','2026-01-31 06:26:05','2026-02-13 11:57:54','[\"International\"]',NULL,7,'faculty','[]','',NULL,NULL),(2,'National','Mom',NULL,NULL,'Note','Q4',12.000,424.400,0,NULL,'{\"DST-FIST\": true}','2026-01-20','waiting','approved','Backfilled during publication approval workflow rollout',NULL,'2026-01-31 06:29:59',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"1. No Poverty\"]',NULL,NULL,NULL,NULL,'2026-01-31 06:29:59','2026-02-13 11:57:54','[\"International\"]',NULL,7,'faculty','[]','',NULL,NULL),(3,'National','aaa',NULL,NULL,'Article','Q3',4.521,3.200,0,NULL,'{\"DST-FIST\": true}',NULL,'waiting','approved','Backfilled during publication approval workflow rollout',NULL,'2026-02-02 11:44:29',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"3. Good Health and Well-being\"]',NULL,NULL,NULL,NULL,'2026-02-02 11:40:57','2026-02-13 11:57:54','[\"IITs\"]',NULL,7,'faculty','[]','',NULL,NULL),(4,'National','09022026',NULL,NULL,'Note','Q2',4.521,3.200,0,NULL,'{\"Nil\": true}',NULL,'published','approved',NULL,1,'2026-03-17 17:22:50',NULL,NULL,'12','12','Proceedings',1,2,NULL,'K.S.RANGASAMY COLLEGE OF TECHNOLOGY\nResearch\nBookings\nProfile\nTask\nReports\nLogout\nForm\nUpdates\nAuthor(s)\nDriven by:\nFaculty\nStudent\n\nFaculty\n23300853456\nMr. Alex Turner\nArtificial Intelligence & Data Science\nK.S.Rangasamy College of Technology\nTitle\n09022026\nType\nNote\nQuartile\nQ1\nQ2\nQ3\nQ4\nNil\nIndex\nScopus\nPubMed\nCollaboration\nIITs\nListed in Anna university CFR Annexure\nYes\nNo\nAcknowledgement\nNil\nSustainable Development Goals (SDGs)\n3\nJournal Name\nNew SAlem\nLevel\nNational\nPublisher\nSalem in\nWebsite\nstatix.pro\nPrint ISSN\n123123\nOnline ISSN\n921290134\nImpact Factor\n4.521\nCite Score\n3.200\nSubmitted on\n\n\ndd/mm/yyyy\nStatus\n\nPublished\nAbstract','asd; asda; asdasd','[\"3. Good Health and Well-being\"]',NULL,'2026-02-04','2026-02-12',NULL,'2026-02-09 05:49:33','2026-03-17 17:22:50','[\"IITs\"]',NULL,1,'faculty','[\"23300853456\"]','1, 2, 3',NULL,NULL),(5,'National','Flemboda artificial intelligence: hybrid fuzzy-convolutional neural network for efficient chromosome abnormality classification',NULL,NULL,'Note','Q3',4.521,3.200,0,NULL,'{\"DST-FIST\": true}','2026-02-15','waiting','approved',NULL,1,'2026-04-06 11:30:25',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2026-02-13 12:01:18','2026-04-06 11:30:25','[\"NITs\"]',NULL,1,'faculty','[]','',NULL,NULL),(6,'National','Flemboda artificial intelligence: hybrid fuzzy-convolutional neural network for efficient chromosome abnormality',NULL,NULL,'Note','Q3',4.521,3.200,0,NULL,'{\"MODROBS\": true}','2026-03-10','waiting','rejected',NULL,NULL,NULL,1,'2026-04-06 11:30:19',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"1. No Poverty\"]',NULL,NULL,NULL,NULL,'2026-03-18 06:16:19','2026-04-06 11:30:19','[\"IITs\"]',NULL,1,'faculty','[]','','',''),(7,'National','New dope medicen win',NULL,NULL,'Editorial','Q3',4.521,3.200,0,NULL,'{\"MODROBS\": true}','2026-04-07','waiting','approved',NULL,1,'2026-04-06 11:17:25',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2026-04-06 11:02:40','2026-04-06 11:17:25','[\"International\"]',NULL,1,'faculty','[]','','',''),(8,'National','Test Journal Article',NULL,NULL,'Article','Q1',NULL,NULL,NULL,NULL,NULL,NULL,'waiting','pending',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Test abstract',NULL,NULL,NULL,NULL,NULL,NULL,'2026-04-20 09:52:42','2026-04-20 09:52:42',NULL,NULL,1,'faculty',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `journals` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_departments`
--

LOCK TABLES `master_departments` WRITE;
/*!40000 ALTER TABLE `master_departments` DISABLE KEYS */;
INSERT INTO `master_departments` VALUES (1,'AIDS','Artificial Intelligence & Data Science',NULL,'Academic',NULL,'hodaids@ksrct.ac.in',NULL,1,1,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(2,'AIML','CSE (Artificial Intelligence and Machine Learning)',NULL,'Academic',NULL,'maheshwaran325@gmail.com',NULL,1,2,'2026-01-19 07:08:05','2026-02-24 10:29:30'),(3,'BT','Biotechnology',NULL,'Academic',NULL,'hodbt@ksrct.ac.in',NULL,1,3,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(4,'CIVIL','Civil Engineering',NULL,'Academic',NULL,'hodcivil@ksrct.ac.in',NULL,1,4,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(5,'CSE','Computer Science and Engineering',NULL,'Academic',NULL,'hodcse@ksrct.ac.in',NULL,1,5,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(6,'CSBS','Computer Science and Business Systems',NULL,'Academic',NULL,'hodcsbs@ksrct.ac.in',NULL,1,6,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(7,'ECE','Electronics and Communication Engineering',NULL,'Academic',NULL,'hodece@ksrct.ac.in',NULL,1,7,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(8,'EEE','Electrical and Electronics Engineering',NULL,'Academic',NULL,'hodeee@ksrct.ac.in',NULL,1,8,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(9,'FT','Food Technology',NULL,'Academic',NULL,'hodft@ksrct.ac.in',NULL,1,9,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(10,'IT','Information Technology',NULL,'Academic',NULL,'hodit@ksrct.ac.in',NULL,1,10,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(11,'MCT','Mechatronics Engineering',NULL,'Academic',NULL,'hodmct@ksrct.ac.in',NULL,1,11,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(12,'MECH','Mechanical Engineering',NULL,'Academic',NULL,'hodmech@ksrct.ac.in',NULL,1,12,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(14,'VLSI','Electronics Engineering (VLSI Design & Technology)',NULL,'Academic',NULL,'hodvlsi@ksrct.ac.in',NULL,1,14,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(15,'NST','Nano Science and Technology',NULL,'Academic',NULL,'hodnano@ksrct.ac.in',NULL,1,15,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(16,'MBA','Master of Business Administration',NULL,'Academic',NULL,'hodmba@ksrct.ac.in',NULL,1,20,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(17,'MCA','Master of Computer Application',NULL,'Academic',NULL,'hodmca@ksrct.ac.in',NULL,1,21,'2026-01-19 07:08:05','2026-02-28 06:09:47'),(23,'ADMIN','Administration',NULL,'Administrative',NULL,NULL,NULL,1,50,'2026-01-19 07:08:05','2026-02-24 12:33:20'),(24,'ALUMNI','Alumni Relations Cell',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(25,'AUS','Auxiliary Services Unit',NULL,'Support',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(26,'CHE','Chemistry',NULL,'Academic',NULL,'hodchemistry@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(27,'COE','Controller of Examinations',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(28,'E-GOV','e-Governance Cell',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(29,'ENG','English',NULL,'Academic',NULL,'hodenglish@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(30,'EXAM CELL','Examination Cell',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(31,'HOSTEL','Hostel Administration',NULL,'Support',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(32,'IDEALAB','IDEA Lab (Innovation and Design)',NULL,'Research',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(33,'IPR','Intellectual Property Rights Cell',NULL,'Research',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(34,'IQAC','Internal Quality Assurance Cell',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(35,'LIB','Library',NULL,'Academic',NULL,'library@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(36,'MAT','Mathematics',NULL,'Academic',NULL,'hodmaths@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(37,'MSME','MSME Cell',NULL,'Research',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(38,'PE','Physical Education',NULL,'Academic',NULL,'pd@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(39,'PHY','Physics',NULL,'Academic',NULL,'hodphysics@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(40,'PL','Placement Cell',NULL,'Support',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(41,'PO','Placement Office',NULL,'Administrative',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(42,'SYS','Systems and IT Services',NULL,'Support',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(43,'TAM','Tamil',NULL,'Academic',NULL,'training@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(44,'TR','Training and Recruitment Cell',NULL,'Support',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20'),(45,'TXT','Textile Technology',NULL,'Academic',NULL,'hodtextile@ksrct.ac.in',NULL,1,0,'2026-02-24 07:20:09','2026-02-28 06:09:47'),(46,'VLSIDT','Electronics Engineering (VLSI Design and Technology)',NULL,'Academic',NULL,NULL,NULL,1,0,'2026-02-24 07:20:09','2026-02-24 12:33:20');
/*!40000 ALTER TABLE `master_departments` ENABLE KEYS */;
UNLOCK TABLES;

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
  CONSTRAINT `fk_emp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_parent_department` FOREIGN KEY (`parent_department_id`) REFERENCES `master_departments` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=600 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_employees`
--

LOCK TABLES `master_employees` WRITE;
/*!40000 ALTER TABLE `master_employees` DISABLE KEYS */;
INSERT INTO `master_employees` VALUES (1,'2330115','Ms','Bhuvaneshwari','N','Female','nbhuvaneshwari@ksrct.ac.in','+919843264285',NULL,'Assistant Professor',1,NULL,29,'Teaching','1983-08-20','2012-10-06',NULL,'Active','0009-0008-9426-6884','PDX-5526-2025',NULL,NULL,NULL,NULL,'2026-01-19 08:27:36','2026-02-24 12:33:20',NULL),(2,'2330005','Mr','Giridharan','N','Male','maheshwaran3253@gmail.com','+918925325252',NULL,'Assistant Professor',1,NULL,1,'Teaching','1990-09-19','2015-05-31',NULL,'Active','0000-0003-0086-7010','PDW-6332-2025','59222280800','7PNkFrUAAAAJ',NULL,4,'2026-01-19 08:27:36','2026-02-25 15:17:24',NULL),(3,'2330314','Mr','Karthick','J','Male','karthickj@ksrct.ac.in','+918056408054',NULL,'Assistant Professor',1,NULL,1,'Teaching','1990-05-25','2025-06-30',NULL,'Active','0009-0000-5459-6741','PDX-0683-2025','59993399100','MmnP-QYAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(4,'2330004','Mr','Raja','S','Male','rajas@ksrct.ac.in','+917502821440',NULL,'Assistant Professor',1,NULL,1,'Teaching','1987-08-28','2021-12-07',NULL,'Active','0009-0007-3260-2283','PDX-2364-2025','59155750700','hl8evKsAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(5,'2330006','Dr','Sarumathi','S','Female','sarumathi@ksrct.ac.in','+919443321692',NULL,'Professor',1,NULL,1,'Teaching','1973-05-02','1998-05-31',NULL,'Active','0009-0007-2042-5902','AAB-3453-2021','59422865200','zIeq7f4AAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(6,'2330160','Dr','Tamizharasan','D','Male','tamizharasan@ksrct.ac.in','+919965873744',NULL,'Assistant Professor',1,NULL,36,'Teaching','1983-07-23','2009-07-09',NULL,'Active','0000-0001-8981-0963','AAV-4641-2021','57225033511','D96ZU_gAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 12:33:20',NULL),(7,'2330304','Mr','Balakrishnan','D','Male','balakrishnan@ksrct.ac.in','+919489796499',NULL,'Assistant Professor',2,NULL,2,'Teaching','1990-01-01','2025-05-11',NULL,'Active','0000-0001-6540-3706','NHP-3972-2025','58524936000','2Oziw1YAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(8,'2330263','Ms','Harshini','R P','Female','harshinirp@ksrct.ac.in','+919361446506',NULL,'Assistant Professor',2,NULL,2,'Teaching','2000-02-17','2024-04-21',NULL,'Active','0009-0004-5116-4731','PDX-2256-2025',NULL,'u4SomCsAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(9,'10450','Ms','Indumathi','M S','Female','indumathims@ksrct.ac.in','+919790111992',NULL,'Assistant Professor',2,NULL,2,'Teaching','1988-09-29','2025-07-31',NULL,'Active','0000-0003-3007-5102','PDX-2284-2025',NULL,'B2NYgOoAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(10,'2330266','Mr','Insol Rajasekar','S','Male','insolrajasekar@ksrct.ac.in','+918220512436',NULL,'Assistant Professor',2,NULL,2,'Teaching','1988-06-24','2024-06-04',NULL,'Active','0009-0006-3225-3573','PDW-6580-2025','59969015400','eKRw1REAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(11,'2330265','Ms','Janani','C','Female','jananic@ksrct.ac.in','+919445895734',NULL,'Assistant Professor',2,NULL,2,'Teaching','1983-05-19','2024-05-19',NULL,'Active','0009-0001-1860-9012','PFI-4905-2025','59969304500','yjC3wp0AAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(12,'2330011','Dr','Meenachi','S','Female','meenachi@ksrct.ac.in','+919788611050',NULL,'Associate Professor',2,NULL,26,'Teaching','1981-10-26','2021-10-07',NULL,'Active','0000-0003-0265-2021','AAY-3903-2021','57200094341','Bwr_ig4AAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 12:33:20',NULL),(13,'2330257','Mr','Praveen','K','Male','praveen@ksrct.ac.in','+919500918101',NULL,'Assistant Professor',2,NULL,2,'Teaching','1990-03-14','2024-02-18',NULL,'Active','0009-0009-5091-4015','PDW-8439-2025',NULL,'q6_dRTQAAAAJ',NULL,NULL,'2026-01-19 08:27:36','2026-02-24 08:57:23',NULL),(14,'2330142','Dr','Rajan','C','Male','rajan@ksrct.ac.in','+919865090665',NULL,'Professor',2,NULL,2,'Teaching','1982-03-25','2007-05-31',NULL,'Active','0000-0002-7834-8563','C-4625-2016','55619939300','8PMZZcsAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(15,'2330312','Ms','Suthi','G','Female','suthig@ksrct.ac.in','+919786666941',NULL,'Assistant Professor',2,NULL,2,'Teaching','2001-07-22','2025-06-30',NULL,'Active','0009-0005-4734-7137','PFI-4820-2025',NULL,'Fc79O0kAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(16,'2330164','Ms','Thivya','V','Female','thivya@ksrct.ac.in','+917373027227',NULL,'Assistant Professor',2,NULL,36,'Teaching','1986-06-15','2021-10-24',NULL,'Active','0009-0002-3298-9194','PDX-2305-2025','58990792400','nf8DhGgAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 12:33:20',NULL),(17,'2330273','Mr','Arulvel','R','Male','arulvelr@ksrct.ac.in','+918870921600',NULL,'Assistant Professor',3,NULL,3,'Teaching','1982-12-05','2024-07-02',NULL,'Active','0000-0003-2307-1031','AAI-2016-2021','56985535900','5KqJn9kAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(18,'2330288','Dr','Ayyappadasan','G','Male','ayyappadasan@ksrct.ac.in','+919944528382',NULL,'Associate Professor',3,NULL,3,'Teaching','1986-03-19','2010-12-20',NULL,'Active','0000-0003-2533-7796','AAC-6679-2021','56754759700','b3HSWnIAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(19,'2330088','Dr','Kalpana','B','Female','kalpana@ksrct.ac.in','+919894332421',NULL,'Associate Professor',3,NULL,3,'Teaching','1981-11-17','2004-10-12',NULL,'Active','0000-0003-2313-7264','AAF-7720-2021','57220166054','4eHn_WcAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(20,'2330080','Ms','Krishnaveni','R','Female','rkrishnaveni@ksrct.ac.in','+919976899069',NULL,'Assistant Professor',3,NULL,3,'Teaching','1995-06-08','2019-08-04',NULL,'Active','0000-0003-2937-4981','PFJ-8007-2025','59949284400','XJ_cU4cAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(21,'2330084','Dr','Mythili Gnanamangai','B','Female','mythilignanamangai@ksrct.ac.in','+919487088678',NULL,'Associate Professor',3,NULL,3,'Teaching','1985-04-01','2012-05-31',NULL,'Active','0000-0001-9681-2318','I-2948-2019','38761310200','NXLyUF4AAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(22,'2330087','Dr','Nithya','M','Female','nithyam@ksrct.ac.in','+917708844446',NULL,'Assistant Professor',3,NULL,3,'Teaching','1978-11-30','2011-05-15',NULL,'Active','0000-0001-6634-4146',NULL,'57208209458','10_1dJIAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(23,'2330086','Dr','Poornima','S','Female','spoornima@ksrct.ac.in','+919994625815',NULL,'Associate Professor',3,NULL,3,'Teaching','1981-07-21','2011-05-15',NULL,'Active','0000-0002-1422-4975','AAC-5680-2021','57208670582','8MotKNgAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(24,'2330305','Dr','Rahul','Chauhan','Male','rahulchauhan@ksrct.ac.in','+919493754953',NULL,'Assistant Professor',3,NULL,3,'Teaching','1993-12-09','2025-05-25',NULL,'Active','0000-0003-1318-0920','MGV-2335-2025','57497406000','f5UqyX0AAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(25,'2330289','Ms','Rubavathi','S','Female','rubavathis@ksrct.ac.in','+919566268832',NULL,'Assistant Professor',3,NULL,3,'Teaching','1991-11-06','2017-05-31',NULL,'Active','0000-0003-1910-315X','AAC-6673-2021','57103565900','hMN-q3AAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(26,'2330309','Ms','Sathviga','S','Male','sathvigas@ksrct.ac.in','+918870276967',NULL,'Assistant Professor',3,NULL,3,'Teaching','1999-09-27','2025-07-01',NULL,'Active','0009-0006-1855-138X','PFJ-5133-2025',NULL,'HCgQ7KcAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(27,'2330082','Dr','Sidhra','S','Female','sidhra@ksrct.ac.in','+918870681797',NULL,'Professor',3,NULL,3,'Teaching','1982-06-10','2007-06-10',NULL,'Active','0000-0002-2834-0889','AAC-5404-2021','57211982016','DYziMrEAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(28,'10448','Dr','Suganthi','C','Female','suganthic@ksrct.ac.in','+919865237279',NULL,'Assistant Professor',3,NULL,36,'Teaching','1988-04-16','2025-08-10',NULL,'Active','0009-0003-7555-5617',NULL,NULL,'jd3iG8EAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 12:33:20',NULL),(29,'2330013','Dr','Sukantha','T A','Female','sukantha@ksrct.ac.in','+919894294908',NULL,'Professor',3,NULL,26,'Teaching','1971-06-16','2007-09-12',NULL,'Active','0000-0002-8864-4702','rid17799','54886494200','JYyphyIAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 12:33:20',NULL),(30,'2330081','Dr','Syed Zameer Ahmed','K','Male','syedzameerahmed@ksrct.ac.in','+918925606633',NULL,'Associate Professor',3,NULL,3,'Teaching','1981-06-30','2015-07-12',NULL,'Active','0000-0002-7334-4483','L-5136-2019','60108325700','UjiXqaMAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(31,'2330022','Dr','Abdul Bari','J','Male','abdulbari@ksrct.ac.in','+919965010624',NULL,'Associate Professor',4,NULL,4,'Teaching','1983-05-09','2008-11-30',NULL,'Active','0000-0002-6502-296X','AAB-5567-2021','57209431331','eHkcORUAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(32,'2330028','Mr','Angu Senthil','K','Male','angusenthil@ksrct.ac.in','+919942363990',NULL,'Assistant Professor',4,NULL,4,'Teaching','1986-06-27','2013-12-17',NULL,'Active','0000-0001-7826-6413','AAE-1576-2021','1612280000000','SDjIdzIAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(33,'2330026','Dr','Gunasekar','S','Male','gunasekar@ksrct.ac.in','+919976876238',NULL,'Assistant Professor',4,NULL,4,'Teaching','1987-06-27','2011-05-15',NULL,'Active','0000-0002-2305-471X','AAD-9064-2021','57215652939','52jZUEAAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(34,'2330021','Dr','Jagadeesan','R','Male','jagadeesan@ksrct.ac.in','+919842719542',NULL,'Assistant Professor',4,NULL,4,'Teaching','1984-09-05','2009-07-22',NULL,'Active',NULL,NULL,'57202046242','7JRwNVwAAAAJ',NULL,NULL,'2026-01-19 08:27:37','2026-02-24 08:57:23',NULL),(35,'2330027','Dr','Mageshkumar','P','Male','mageshkumarp@ksrct.ac.in','+919894985719',NULL,'Associate Professor',4,NULL,4,'Teaching','1985-06-25','2012-05-22',NULL,'Active','0000-0002-7172-1804','E-9618-2018','51964145800','ex6CFlYAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(36,'2330113','Dr','Palaniappan','A','Male','palaniappan@ksrct.ac.in','+919894366121',NULL,'Professor',4,NULL,29,'Teaching','1971-07-15','2006-05-31',NULL,'Active','0000-0002-0827-399X','PDW-8851-2025',NULL,'xADkeKAAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 12:33:20',NULL),(37,'2330029','Dr','Ramesh','N','Male','rameshn@ksrct.ac.in','+919443916232',NULL,'Professor',4,NULL,4,'Teaching','1972-05-14','2002-09-01',NULL,'Active','0000-0002-7057-5681','AAE-1658-2021','56938146700','GVcEMVIAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(38,'2330020','Dr','Ramesh','S','Male','rameshs@ksrct.ac.in','+919976872912',NULL,'Professor',4,NULL,4,'Teaching','1978-06-06','2005-06-30',NULL,'Active','0000-0001-7835-4501','AAC-6825-2021','57218539832','XUG9EwkAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(39,'2330016','Mr','Tamilarasu','K','Male','tamilarasu@ksrct.ac.in','+919788954770',NULL,'Assistant Professor',4,NULL,26,'Teaching','1979-10-16','2006-02-09',NULL,'Active','0000-0002-8864-4702','PFJ-8239-2025','58613969400','W6HQ7nEAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 12:33:20',NULL),(40,'2330023','Dr','Velumani','M','Male','velumani@ksrct.ac.in','+919787978886',NULL,'Assistant Professor',4,NULL,4,'Teaching','1984-03-13','2010-05-27',NULL,'Active','0000-0001-8123-3751','AAE-2729-2021','57194554894','r6eg2DAAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(41,'2330018','Dr','Vennila','G','Female','vennila@ksrct.ac.in','+919443770653',NULL,'Professor',4,NULL,4,'Teaching','1967-06-05','2003-05-27',NULL,'Active','0000-0002-1947-1043','AAE-4072-2021','55512187100','zxXsn6EAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(42,'2330019','Dr','Vijaya Sundravel','K','Male','vijayasundravel@ksrct.ac.in','+919688676665',NULL,'Assistant Professor',4,NULL,4,'Teaching','1986-07-24','2015-05-31',NULL,'Active','0000-0002-4311-6076','AAE-3490-2021','58525165700','7NJYaOIAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(43,'2330024','Dr','Yuvaraj','K','Male','yuvarajk@ksrct.ac.in','+919842406571',NULL,'Assistant Professor',4,NULL,4,'Teaching','1991-07-15','2014-06-01',NULL,'Active','0000-0001-8671-9216','AAE-2763-2021','57302449700','1Nwzy_AAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(44,'2330035','Mr','Baskar','R','Male','rbaskar@ksrct.ac.in','+919994009680',NULL,'Assistant Professor',5,NULL,5,'Teaching','1988-06-14','2014-06-01',NULL,'Active','0000-0002-7642-0955','MBH-8793-2025','58988789800','xmL6B6YAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(45,'2330042','Dr','Chithra','R','Female','chithra@ksrct.ac.in','+919994312842',NULL,'Professor',5,NULL,5,'Teaching','1979-11-02','2002-11-19',NULL,'Active','0000-0003-0421-4252','AAB-7481-2021','57213486683','jlz8OTEAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(46,'2330037','Mr','Dinesh Kumar','K','Male','dineshkumark@ksrct.ac.in','+917708735602',NULL,'Assistant Professor',5,NULL,5,'Teaching','1983-07-21','2023-06-20',NULL,'Active','0009-0007-2094-9650','PFI-5805-2025','60214007300','h_X3F8AAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(47,'2330038','Dr','Geetha','B G','Female','geetha@ksrct.ac.in','+919894688866',NULL,'Professor',5,NULL,5,'Teaching','1971-05-17','1994-10-06',NULL,'Active','0000-0001-7157-9134','GWC-5963-2022','24449220900','E0tqfPkAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(48,'2330052','Dr','Gnanabaskaran','A','Male','gnanabaskarana@ksrct.ac.in','+919626335995',NULL,'Professor',5,NULL,5,'Teaching','1970-02-04','2001-06-12',NULL,'Active','0000-0003-0699-9065','AAR-6884-2021','36052610100','5FPwGZ0AAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(49,'2330032','Dr','Gopinath','R','Male','gopinath@ksrct.ac.in','+919865978725',NULL,'Associate Professor',2,NULL,2,'Teaching','1977-11-30','2010-06-01',NULL,'Active','0000-0002-7287-2516',NULL,'56594634800','DAAj5UwAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(50,'2330047','Dr','Kaladevi','P','Female','kaladevi@ksrct.ac.in','+919952555970',NULL,'Associate Professor',5,NULL,5,'Teaching','1983-05-12','2005-07-03',NULL,'Active','0000-0003-4614-5363','PFI-6079-2025','57200696934','8JQhJh4AAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 08:57:23',NULL),(51,'2330014','Ms','Kirthiga','D','Female','kiruthiga@ksrct.ac.in','+919952216364',NULL,'Assistant Professor',5,NULL,26,'Teaching','1986-06-08','2014-08-03',NULL,'Active','0009-0003-8343-3812','PDW-8306-2025','58244645400','tvX3ZBsAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 12:33:20',NULL),(52,'2330159','Dr','Kiruthika','K','Female','kiruthika@ksrct.ac.in','+919842308326',NULL,'Associate Professor',5,NULL,36,'Teaching','1981-04-28','2008-06-03',NULL,'Active','0000-0002-1740-3362','AFI-3985-2022','60031107200','Yq6fyssAAAAJ',NULL,NULL,'2026-01-19 08:27:38','2026-02-24 12:33:20',NULL),(53,'2330045','Dr','Madhavi','S','Female','madhavis@ksrct.ac.in','+919095060950',NULL,'Professor/HOD',5,NULL,5,'Teaching','1976-06-25','2000-06-07',NULL,'Active','0000-0003-3218-533X','AAR-6693-2021',NULL,'oyaJ678AAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(54,'2330277','Ms','Mithuna','S','Female','mithuna@ksrct.ac.in','+919952665042',NULL,'Assistant Professor',5,NULL,5,'Teaching','1998-05-16','2024-07-02',NULL,'Active',NULL,'PFI-4830-2025','59348940200','ET2L_WgAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(55,'2330001','Dr','Muthusankar','D','Male','muthusankar@ksrct.ac.in','+919566554400',NULL,'Professor',5,NULL,5,'Teaching','1984-08-29','2005-07-03',NULL,'Active','0000-0003-2201-8319',NULL,'57200703395','Zi52JlcAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(56,'2330046','Ms','Mythili','J','Female','mythili@ksrct.ac.in','+918838318567',NULL,'Assistant Professor',5,NULL,5,'Teaching','1987-07-17','2021-08-03',NULL,'Active','0009-0005-0523-7167','PFJ-2988-2025','58512198100','xyRyFOAAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(57,'2330050','Dr','Poongodi','K','Female','poongodik@ksrct.ac.in','+919788680616',NULL,'Assistant Professor',5,NULL,5,'Teaching','1980-04-19','2009-05-26',NULL,'Active','0000-0002-8668-7362','PFI-5573-2025',NULL,'qlCU51YAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(58,'2330036','Mr','Rajkumar','S','Male','rajkumars@ksrct.ac.in','+919003718103',NULL,'Assistant Professor',5,NULL,5,'Teaching','1987-11-23','2011-05-15',NULL,'Active','0000-0003-3126-3068','PFI-5268-2025','57202196539','4fzAfVMAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(59,'2330313','Ms','Revathi','R','Female','revathir@ksrct.ac.in','+918072496931',NULL,'Assistant Professor',5,NULL,5,'Teaching','1996-08-20','2025-06-15',NULL,'Active','0009-0003-8226-8405','PEX-7906-2025','58265371900','54faQZMAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(60,'2330051','Ms','Saradha','M','Female','saradha@ksrct.ac.in','+919942443379',NULL,'Assistant Professor',5,NULL,5,'Teaching','1991-09-11','2021-03-10',NULL,'Active','0000-0001-7566-1370','PFF-6632-2025','59517364100','Pf1Lf7cAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(61,'2330282','Ms','Saveetha','S','Other','saveethas@ksrct.ac.in','+919486310495',NULL,'Assistant Professor',5,NULL,39,'Teaching',NULL,'2024-12-01',NULL,'Active','0000-0002-6929-2609','PFJ-2942-2025','57222964416','e-nKhbgAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 12:33:20',NULL),(62,'2330041','Dr','Senthil Raja','P','Male','senthilraja@ksrct.ac.in','+919994049209',NULL,'Associate Professor',5,NULL,5,'Teaching','1978-06-02','2007-07-10',NULL,'Active','0000-0002-5843-961X','AAC-5312-2021','57197782391','amuyl2jCkZgC',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(63,'2330150','Dr','Senthilvadivu','K','Female','senthilvadivu@ksrct.ac.in','+919865024343',NULL,'Professor',5,NULL,36,'Teaching','1969-09-04','1995-08-20',NULL,'Active','0000-0002-3431-9541','AAC-5547-2021','37081825300','PqQIdNEAAAA',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 12:33:20',NULL),(64,'2330048','Mr','Vadivel','S','Male','vadivels@ksrct.ac.in','+919790632171',NULL,'Assistant Professor',5,NULL,5,'Teaching','1988-05-16','2021-07-21',NULL,'Active','0009-0009-4345-396X','PFI-6112-2025',NULL,'TQefo8YAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(65,'2330031','Ms','Varshana Devi','M','Female','varshanadevi@ksrct.ac.in','+919597604228',NULL,'Assistant Professor',5,NULL,5,'Teaching','1990-08-15','2022-06-30',NULL,'Active','0009-0000-3849-7679','PEX-8244-2025','59265371900','rhBXdfsAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(66,'2330049','Mr','Vijay Sai','R','Male','vijaysair@ksrct.ac.in','+919952448589',NULL,'Assistant Professor',5,NULL,5,'Teaching','1983-05-07','2008-06-04',NULL,'Active','0000-0001-9622-5877',NULL,'54783724300','RFdF5Z4AAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(67,'2330117','Ms','Vijayapriya','C','Female','vijayapriya@ksrct.ac.in','+916383887925',NULL,'Assistant Professor',5,NULL,29,'Teaching','1992-04-01','2021-02-26',NULL,'Active','0000-0002-2532-2298','PDX-6430-2025',NULL,NULL,NULL,NULL,'2026-01-19 08:27:39','2026-02-24 12:33:20',NULL),(68,'2330162','Ms','Geetha','K','Female','geethak@ksrct.ac.in','+917402461799',NULL,'Assistant Professor',6,NULL,36,'Teaching','1984-11-01','2013-06-02',NULL,'Active','0000-0001-7553-702X','PDX-1895-2025',NULL,'tYUsjD4AAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 12:33:20',NULL),(69,'2330242','Mr','Karthikeyan','K','Male','karthikeyank@ksrct.ac.in','+919952475246',NULL,'Assistant Professor',6,NULL,6,'Teaching','1989-05-08','2022-06-05',NULL,'Active','0009-0002-1950-7824','PDW-7776-2025','59155491600','Kgp0nrYAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(70,'2330239','Dr','Sakthivel','K','Male','sakthivelk@ksrct.ac.in','+919942166425',NULL,'Professor',6,NULL,6,'Teaching','1972-04-20','1998-11-19',NULL,'Active','0000-0002-7599-6258','ABD-9319-2022','15027512900','V9yxDeMAAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(71,'2330241','Dr','Tamilarasi','M','Female','tamilarasi@ksrct.ac.in','+919750037023',NULL,'Associate Professor',6,NULL,6,'Teaching','1984-01-27','2021-02-28',NULL,'Active','0000-0002-4687-9634','AAR-2834-2021','59292085200','C6xENR0AAAAJ',NULL,NULL,'2026-01-19 08:27:39','2026-02-24 08:57:23',NULL),(72,'2330278','Ms','Udhaya','T','Female','udhaya@ksrct.ac.in','+918675587180',NULL,'Assistant Professor',6,NULL,6,'Teaching','1989-06-27','2024-07-02',NULL,'Active','0009-0009-3796-3322','PDW-7107-2025','59486392300','Rsj5o84AAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(73,'2330220','Dr','Vasudevan','V','Male','vasudevanv@ksrct.ac.in','+919965006192',NULL,'Associate Professor',6,NULL,39,'Teaching','1980-06-07','2013-06-02',NULL,'Active','0000-0003-0198-1982','AEO-6575-2022','57198036240','DioHaR4AAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 12:33:20',NULL),(74,'2330240','Mr','Vignesh','S','Male','vigneshs@ksrct.ac.in','+919944820102',NULL,'Assistant Professor',6,NULL,6,'Teaching','1989-01-31','2023-06-06',NULL,'Active','0009-0007-9723-0046','PDW-7277-2025','57221234211','PWAd8YQAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(75,'2330074','Dr','Babu','P','Male','pbabu@ksrct.ac.in','+919443546483',NULL,'Professor',7,NULL,7,'Teaching','1977-05-17','2002-04-23',NULL,'Active','0000-0003-2951-7567','AAA-9343-2021','57198002057','xqKaC9sAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(76,'2330066','Mr','Balachandran','A','Male','abalachandran@ksrct.ac.in','+919443072641',NULL,'Assistant Professor',7,NULL,7,'Teaching','1989-07-29','2013-12-15',NULL,'Active','0000-0001-9276-4953','AAA-8082-2021','58198685900','JvYsBeUAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(77,'2330076','Mr','Balamurugan','P','Male','pbalamurugan@ksrct.ac.in','+919566645937',NULL,'Assistant Professor',7,NULL,7,'Teaching','1990-06-05','2013-12-15',NULL,'Active','0000-0003-0718-3973','AAC-5294-2021',NULL,'sNyAx6MAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(78,'2330073','Dr','Baranidharan','T','Male','baranidharan@ksrct.ac.in','+919094335811',NULL,'Professor',7,NULL,7,'Teaching','1980-11-21','2010-05-04',NULL,'Active','0000-0002-2403-7882','AAP-5046-2021','55199882900','4b2WxW0AAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(79,'2330068','Ms','Devaki','M','Female','devaki@ksrct.ac.in','+919095059424',NULL,'Assistant Professor',7,NULL,7,'Teaching','1985-02-12','2007-07-01',NULL,'Active','0000-0002-2506-5850','AAA-9569-2021','59229729500','7-646FoAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(80,'2330055','Mr','Dhanasekaran','D','Male','dhanasekarand@ksrct.ac.in','+919698691234',NULL,'Assistant Professor',7,NULL,7,'Teaching','1986-05-25','2021-08-10',NULL,'Active','0009-0003-2135-2451','PDW-8567-2025','58502142400','xQkO_5EAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(81,'2330077','Ms','Gogila Devi','K','Female','gogiladevi@ksrct.ac.in','+919715205353',NULL,'Assistant Professor',7,NULL,7,'Teaching','1990-04-21','2013-06-02',NULL,'Active','0000-0002-4782-9807','AAA-9385-2021','59983128600','f0s8iYkAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(82,'2330061','Mr','Jayamani','S','Male','jayamani@ksrct.ac.in','+919629297054',NULL,'Assistant Professor',7,NULL,7,'Teaching','1985-07-31','2011-05-12',NULL,'Active','0000-0002-3877-2984','AAA-8003-2021','35145931600','WIk_ZwkAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(83,'2330058','Dr.','Jayanthi','K B','Female','jayanthikb@ksrct.ac.in','9443471811',NULL,'Professor',7,NULL,7,'Teaching','1973-01-04','1995-06-11',NULL,'Active','0000-0002-6394-4602','AAC-4301-2021','57206421967','QIgoea8AAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 05:42:37',NULL),(84,'2330062','Ms','Kalaiyarasi','V P','Female','kalaiyarasivp@ksrct.ac.in','+919500241234',NULL,'Assistant Professor',7,NULL,7,'Teaching','1990-08-24','2023-05-31',NULL,'Active','0009-0009-4552-9999','PFI-6412-2025','59936352300','79QLbusAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(85,'2330056','Ms','Kausalya','S','Female','kausalya@ksrct.ac.in','+919500966007',NULL,'Assistant Professor',7,NULL,7,'Teaching','1994-11-22','2023-05-31',NULL,'Active','0009-0001-8567-2353','PFI-9661-2025','59155741800','Ubm92cwAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(86,'2330057','Dr','Malarkhodi','S','Female','malarkhodi@ksrct.ac.in','+919442992650',NULL,'Professor',7,NULL,7,'Teaching','1971-06-02','1995-11-09',NULL,'Active','0000-0002-7922-8600','AAC-1152-2021','36632821700','zUQ_YvoAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(87,'2330223','Dr','Malarvizhi','M','Female','malarvizhi@ksrct.ac.in','+919095792265',NULL,'Assistant Professor',7,NULL,39,'Teaching','1983-04-27','2021-07-15',NULL,'Active','0000-0003-0052-6881',NULL,NULL,'7Y0FuPMAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 12:33:20',NULL),(88,'2330218','Mr','Mohanraj','R','Male','mohanrajr@ksrct.ac.in','+918056575711',NULL,'Assistant Professor',7,NULL,7,'Teaching','1990-01-01','2018-06-12',NULL,'Active','0000-0002-2843-8712','AAD-9795-2021','57925312000','EqltgNYAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(89,'2330063','Mr','Mugilan','D','Male','mugilan@ksrct.ac.in','+919894607523',NULL,'Assistant Professor',7,NULL,7,'Teaching','1984-05-25','2010-05-31',NULL,'Active','0000-0001-5249-483X','AAA-7981-2021','56623094200','ZYZz4XsAAAAJ',NULL,NULL,'2026-01-19 08:27:40','2026-02-24 08:57:23',NULL),(90,'2330156','Ms','Padmavathi','D','Female','padmavathi@ksrct.ac.in','+919942868893',NULL,'Assistant Professor',7,NULL,36,'Teaching','1978-05-17','2005-09-14',NULL,'Active','0009-0006-2606-4020','PFJ-5121-2025',NULL,'dK0b0Z4AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 12:33:20',NULL),(91,'2330015','Dr','Palanivelu','R','Male','palanivelu@ksrct.ac.in','+919865235165',NULL,'Professor',7,NULL,26,'Teaching','1966-05-13','1994-08-18',NULL,'Active','0000-0003-0265-2021','AAA-1156-2021','5720009434','SMtGpFwAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 12:33:20',NULL),(92,'2330064','Mr','Poovarasan','R','Male','poovarasan@ksrct.ac.in','+919566374935',NULL,'Assistant Professor',7,NULL,7,'Teaching','1990-05-31','2022-08-31',NULL,'Active','0009-0002-3992-2929','PDX-5243-2025','60045844200','agzF7Q8AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(93,'2330059','Mr','Raguvaran','K','Male','raguvaran@ksrct.ac.in','+919994666307',NULL,'Assistant Professor',7,NULL,7,'Teaching','1992-03-25','2015-06-04',NULL,'Active','0000-0002-4114-5957','AAA-9337-2021','56707328800','l1bDmU4AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(94,'2330060','Dr','Rajasekaran','C','Male','rajasekaran@ksrct.ac.in','+919942483404',NULL,'Professor',7,NULL,7,'Teaching','1979-05-31','2002-04-23',NULL,'Active','0000-0003-0951-3980','AAC-4306-2021','55314930400','O6hHj-wAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(95,'2330069','Ms','Ramya','R','Female','rramya@ksrct.ac.in','+919787903008',NULL,'Assistant Professor',7,NULL,7,'Teaching','1988-06-02','2012-05-31',NULL,'Active','0000-0002-7841-4129','AAA-8606-2021','57214386779','aVykCTAAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(96,'2330072','Ms','Saraswathy','C','Female','saraswathy@ksrct.ac.in','+918220415342',NULL,'Assistant Professor',7,NULL,7,'Teaching','1980-05-24','2005-05-22',NULL,'Active','0000-0002-1585-1364','AAA-8008-2021','55662373500','11uR5L0AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(97,'2330166','Mr','Saravanan','P M','Male','saravananpm@ksrct.ac.in','+919952724697',NULL,'Assistant Professor',7,NULL,36,'Teaching','1983-06-27','2023-10-08',NULL,'Active','0009-0000-7950-0734','PFJ-5100-2025',NULL,'5iFkasYAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 12:33:20',NULL),(98,'2330065','Mr','Saravanan','S','Male','saravanan.s@ksrct.ac.in','+919894887631',NULL,'Assistant Professor',7,NULL,7,'Teaching','1984-03-03','2013-12-15',NULL,'Active','0000-0002-4276-0572','AAA-7979-2021','57817077700','hOpVIkUAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(99,'2330070','Mr','Satheesh Kumar','R','Male','satheeshkumar@ksrct.ac.in','+919043974356',NULL,'Assistant Professor',7,NULL,7,'Teaching','1984-10-16','2013-12-15',NULL,'Active','0000-0002-3581-3197','AAA-6602-2021','59536341700','XEo5RR8AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(100,'2330217','Dr','Satheeskumar','S','Male','satheeskumars@ksrct.ac.in','+919842008191',NULL,'Professor',7,NULL,39,'Teaching','1972-06-07','2018-12-02',NULL,'Active','0000-0001-7844-0565','AAF-6350-2021','57203833125','n0-cMYcAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 12:33:20',NULL),(101,'2330274','Ms','Shyamala Devi','U','Female','shyamaladeviu@ksrct.ac.in','+919566356428',NULL,'Assistant Professor',7,NULL,7,'Teaching','1992-12-16','2024-07-07',NULL,'Active','0009-0007-3587-2385','PDX-2337-2025','59420536200','pFpZCUMAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(102,'2330075','Ms','Thamilselvi','S S','Female','sstamilselvi@ksrct.ac.in','+919865979439',NULL,'Assistant Professor',7,NULL,7,'Teaching','1975-11-15','2012-06-06',NULL,'Active','0000-0002-9575-3536','AAC-1230-2021','57095020900','GliDmMUAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(103,'2330078','Ms','Vanitha','K','Female','vanitha@ksrct.ac.in','+919865028854',NULL,'Assistant Professor',7,NULL,7,'Teaching','1982-05-09','2008-06-02',NULL,'Active','0000-0002-0406-3215','KFA-8203-2024','57201914510','fh2Ajh8AAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(104,'2330284','Dr','Vasanthi','S','Other','vasanthi@ksrct.ac.in','+9180722821948',NULL,'Professor',7,NULL,7,'Teaching',NULL,'2001-06-10',NULL,'Active','0000-0002-5739-2397','AAC-1719-2021','46662132100','akDxX3EAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(105,'2330108','Dr','Aravindan','P','Male','aravindan@ksrct.ac.in','+919952425269',NULL,'Professor',8,NULL,8,'Teaching','1971-06-15','2003-05-25',NULL,'Active','0000-0003-0715-6449','AAE-1360-2021','53876842800','oudogsAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(106,'2330110','Dr','Balamurugan','R','Male','balamurugan@ksrct.ac.in','+919790031900',NULL,'Associate Professor',8,NULL,8,'Teaching','1984-05-11','2007-05-29',NULL,'Active','0000-0002-1040-7731','AAC-5311-2021','57210867788','1wxC_fUAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(107,'2330103','Mr','Chandra Kumar','E','Male','chandrakumar@ksrct.ac.in','+919445995564',NULL,'Assistant Professor',8,NULL,8,'Teaching','1998-05-22','2021-08-22',NULL,'Active','0009-0002-7788-2657','PDX-0923-2025','59155928200','64mx41gAAAAJ',NULL,NULL,'2026-01-19 08:27:41','2026-02-24 08:57:23',NULL),(108,'2330107','Mr','Dhanapal','M','Male','dhanapalm@ksrct.ac.in','+918012181649',NULL,'Assistant Professor',8,NULL,8,'Teaching','1986-04-02','2013-06-02',NULL,'Active','0000-0002-0616-8635','AAG-5671-2021','55816950300','9j4GD8IAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(109,'2330104','Dr','Elango','M K','Male','elango@ksrct.ac.in','+919952493666',NULL,'Professor',8,NULL,8,'Teaching','1976-05-21','1997-06-22',NULL,'Active','0000-0002-4545-7173','AAC-5274-2021','37664862800','d7U8jZ4AAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(110,'2330112','Dr','Gopalakrishnan','R','Male','principal@ksrct.ac.in','+919994150505',NULL,'Professor',8,NULL,8,'Teaching','1978-07-31','2019-02-14',NULL,'Active','0000-0002-5982-8983',NULL,'54401107200','1dmuG7kAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(111,'2330098','Ms','Jaividhya','S','Female','jaividhya@ksrct.ac.in','+919585304763',NULL,'Assistant Professor',8,NULL,8,'Teaching','1988-07-01','2012-05-31',NULL,'Active','0000-0003-3935-9371','PDX-3588-2025','58193727700','J0-5MDYAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(112,'2330097','Mr','Karthik','P','Male','karthikp@ksrct.ac.in','+916380324452',NULL,'Assistant Professor',8,NULL,8,'Teaching','1993-03-19','2023-06-30',NULL,'Active','0009-0001-1664-1473','PDX-4828-2025','56915789100','2kQzgqwAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(113,'2330096','Ms','Kayalvizhi','N','Female','kayalvizhi@ksrct.ac.in','+919994547837',NULL,'Assistant Professor',8,NULL,8,'Teaching','1979-05-31','2009-12-06',NULL,'Active','0000-0003-0232-6138','PDW-8440-2025','57190130862','sbujKlwAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(114,'2330093','Ms','Radhamani','R','Female','radhamani@ksrct.ac.in','+919543167875',NULL,'Assistant Professor',8,NULL,8,'Teaching','1982-06-15','2007-05-29',NULL,'Active','0000-0003-1082-4487','PDX-3760-2025','58244947300','ahCY81kAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(115,'2330101','Mr','Rajasekaran','N','Male','rajasekaran.n@ksrct.ac.in','+918056975723',NULL,'Assistant Professor',8,NULL,8,'Teaching','1987-06-20','2011-05-15',NULL,'Active','0000-0001-9548-9168','PDX-0590-2025','58245816600','7bER3OYAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(116,'2330102','Mr','Shree Ram Senthil','S','Male','shreeramsenthil@ksrct.ac.in','+919442796968',NULL,'Assistant Professor',8,NULL,8,'Teaching','1987-12-15','2013-12-15',NULL,'Active','0000-0001-6739-9085','PEX-7680-2025','60064865000','uwC0J0cAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(117,'2330311','Dr','Shyamalagowri','M','Female','mshyamalagowri@ksrct.ac.in','+919842660908',NULL,'Associate Professor',8,NULL,8,'Teaching','1980-07-11','2025-07-15',NULL,'Active','0000-0001-5071-4851','GYQ-8467-2022','56274279300','ywlcrOcAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(118,'2330100','Dr','Sri Vidhya','D','Female','srividhya@ksrct.ac.in','+919952134526',NULL,'Associate Professor',8,NULL,8,'Teaching','1982-11-22','2009-05-26',NULL,'Active','0000-0002-8882-9459','AAC-5098-2021','57120090200','zXKMzNoAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(119,'2330111','Mr','Srinivasan','S','Male','srinivasan@ksrct.ac.in','+919994143687',NULL,'Assistant Professor',8,NULL,8,'Teaching','1974-01-15','1998-05-31',NULL,'Active','0000-0001-5863-1882','PDX-4976-2025','59948887900','dQ0ogjUAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(120,'2330017','Dr','Tamilvanan','M','Male','tamilvananm@ksrct.ac.in','+916384079199',NULL,'Associate Professor',8,NULL,26,'Teaching','1979-07-05','2022-06-02',NULL,'Active','0000-0002-3288-2074','PDX-0619-2025','15754924800','QkVYrlwAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 12:33:20',NULL),(121,'2330092','Mr','Thangadurai','A','Male','thangaduraia@ksrct.ac.in','+919095322233',NULL,'Assistant Professor',8,NULL,8,'Teaching','1985-09-30','2011-05-01',NULL,'Active','0000-0003-4956-1020','AAC-6605-2021','59651778900','F8ZJNDcAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(122,'2330153','Dr','Uthirasamy','N','Male','uthirasamy@ksrct.ac.in','+919865838747',NULL,'Professor',8,NULL,36,'Teaching','1976-03-10','2005-05-22',NULL,'Active','0000-0002-4395-6657','AAY-3903-2021','57209200818','MfV1IAQAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 12:33:20',NULL),(123,'2330106','Dr','Venkatesan','T','Male','venkatesan@ksrct.ac.in','+919942012455',NULL,'Professor',8,NULL,8,'Teaching','1971-06-20','2003-05-27',NULL,'Active','0000-0003-4734-1665','AAE-1284-2021','57215814483','q0EECDoAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(124,'2330094','Dr','Vijaya Gowri','G','Female','vijayagowri@ksrct.ac.in','+919442258906',NULL,'Professor',8,NULL,8,'Teaching','1977-10-22','2000-06-06',NULL,'Active','0000-0002-1266-1944','GVR-9866-2022','57195979878','XtnUukYAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(125,'2330271','Dr','Balasubramani','K','Male','balasubramanik@ksrct.ac.in','+919789252952',NULL,'Associate Professor',9,NULL,9,'Teaching','1986-08-08','2024-06-30',NULL,'Active','0000-0002-4609-6920','ABE-2467-2021','57194595917','UJtg5eYAAAAJ',NULL,NULL,'2026-01-19 08:27:42','2026-02-24 08:57:23',NULL),(126,'2330122','Mr','Kalai Rajan','P','Male','kalairajan@ksrct.ac.in','+917010841881',NULL,'Assistant Professor',9,NULL,9,'Teaching','1998-10-06','2022-06-05',NULL,'Active','0009-0004-2588-4639','PFJ-9215-2025',NULL,'XlnX_vkAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(127,'2330275','Dr','Kavitha','K','Female','kavithakandiah@ksrct.ac.in','+919487384333',NULL,'Associate Professor',9,NULL,9,'Teaching','1987-06-25','2024-07-14',NULL,'Active','0000-0003-1711-1535','HHM-4869-2022','55337792100','ODd7GqQAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(128,'2330283','Dr','Muthusamy','P','Other','muthusamyp@ksrct.ac.in','+919626995761',NULL,'Professor',9,NULL,9,'Teaching',NULL,'2024-12-03',NULL,'Active','0009-0000-7581-9248',NULL,'59285642400','Q_rDL9wAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(129,'2330270','Mr','Nagarjun','T G N','Male','nagarjun@ksrct.ac.in','+918754394242',NULL,'Assistant Professor',9,NULL,9,'Teaching','1996-01-19','2024-06-30',NULL,'Active','0000-0003-2229-8541','AAC-5904-2021','57210558286','kpR-_ZgAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(130,'2330127','Mr','Nithishkumar','S','Male','nithishkumar@ksrct.ac.in','+918973333396',NULL,'Assistant Professor',9,NULL,9,'Teaching','1999-06-22','2022-06-05',NULL,'Active','0009-0000-9315-0072','PFJ-8044-2025',NULL,'8J1POf8AAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(131,'2330010','Dr','Prabha','K','Female','prabhak@ksrct.ac.in','+919865972521',NULL,'Associate Professor',9,NULL,26,'Teaching','1985-05-08','2014-08-03',NULL,'Active','0000-0003-4533-7259','ACT-5593-2022','36163232100','PdAh8aAAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 12:33:20',NULL),(132,'2330296','Ms','Srinithi Priya','B','Female','srinithipriya@ksrct.ac.in','+919597621737',NULL,'Assistant Professor',9,NULL,9,'Teaching','2000-10-30','2025-03-18',NULL,'Active','0009-0002-1529-5270','PFJ-7963-2025',NULL,'yjz1D5IAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(133,'2330116','Dr','Umai Arasi','M','Female','umaiarasi@ksrct.ac.in','+919025739758',NULL,'Associate Professor',9,NULL,29,'Teaching','1961-06-01','2009-07-13',NULL,'Active','0000-0002-4768-8186',NULL,NULL,'UOFvKnkAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 12:33:20',NULL),(134,'2330221','Mr','Vanchinathan','S','Male','vanchinathan@ksrct.ac.in','+919788811777',NULL,'Assistant Professor',9,NULL,39,'Teaching','1984-06-07','2017-09-03',NULL,'Active','0009-0002-7610-6461','PWD-8952-2025','59220666300','VqvoCgIAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 12:33:20',NULL),(135,'2330163','Ms','Annapoorani','S','Female','annapoorani@ksrct.ac.in','+919942220265',NULL,'Assistant Professor',10,NULL,36,'Teaching','1984-02-09','2021-06-13',NULL,'Active','0009-0001-3614-0174','PFG-2048-2025',NULL,'L5gPcnAAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 12:33:20',NULL),(136,'2330134','Mr','Arulmurugan','S','Male','arulmurugans@ksrct.ac.in','+917502392760',NULL,'Assistant Professor',10,NULL,10,'Teaching','1986-11-12','2022-02-03',NULL,'Active','0009-0004-3694-1096','PEX-7939-2025','59174106700','3LmSXxgAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(137,'2330148','Mr','Dinesh Kumar','R T','Male','dineshkumarrt@ksrct.ac.in','+919952762214',NULL,'Assistant Professor',10,NULL,10,'Teaching','1984-08-05','2022-08-16',NULL,'Active','0009-0008-6830-6117','PFI-5206-2025','59262034700','Arc4blIAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(138,'2330128','Mr','Dineshkumar','P','Male','p.dineshkumar@ksrct.ac.in','+919688837873',NULL,'Assistant Professor',10,NULL,10,'Teaching','1990-12-24','2022-07-31',NULL,'Active','0009-0000-4080-0502','PDW-6538-2025','59668803200','wXtR0VAAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(139,'2330267','Ms','Hemalatha','E','Female','hemalathae@ksrct.ac.in','+919994816698',NULL,'Assistant Professor',10,NULL,10,'Teaching','1988-09-21','2024-06-09',NULL,'Active','0009-0006-5590-1510','PEX-8205-2025','60021714400','v17y5rMAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(140,'2330143','Ms','Keerthana','S','Female','keerthanas@ksrct.ac.in','+918870617746',NULL,'Assistant Professor',10,NULL,10,'Teaching','1991-06-02','2023-05-31',NULL,'Active','0009-0007-3848-0045','PEX-7790-2025','57193089271','FZ4p4NEAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(141,'2330141','Ms','Mahalakshmi','K','Female','mahalakshmik@ksrct.ac.in','+919944286457',NULL,'Assistant Professor',10,NULL,10,'Teaching','1981-05-20','2023-07-02',NULL,'Active','0009-0009-0304-538X','PDY-0818-2025','60184500500','iKF9m8wAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(142,'2330130','Mr','Mohanraj','K C','Male','mohanrajkc@ksrct.ac.in','+919865370531',NULL,'Assistant Professor',10,NULL,10,'Teaching','1983-07-23','2021-11-30',NULL,'Active','0009-0002-5101-1175','PDW-7148-2025','59173489000','USmEBkIAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(143,'2330157','Dr','Muthukumar','S','Male','muthukumar@ksrct.ac.in','+919788285608',NULL,'Associate Professor',10,NULL,36,'Teaching','1983-06-05','2006-07-03',NULL,'Active','0000-0003-1810-7300','AAQ-5143-2020','57211811388','d3exjVgAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 12:33:20',NULL),(144,'2330140','Dr','Nallusamy','C','Male','nallusamyc@ksrct.ac.in','+918754254805',NULL,'Professor',10,NULL,10,'Teaching','1980-05-05','2010-05-25',NULL,'Active','0000-0001-6100-0088','AAC-6658-2021','57195555439','1IdgwY4AAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(145,'2330132','Dr','Nithya','J','Female','nithyaj@ksrct.ac.in','+919443846125',NULL,'Professor',10,NULL,10,'Teaching','1978-10-08','1999-06-30',NULL,'Active','0000-0002-0328-4294','AAC-3306-2021','58360210900','3TC49wAAAAJ',NULL,NULL,'2026-01-19 08:27:43','2026-02-24 08:57:23',NULL),(146,'2330276','Ms','Pavithra','S','Female','spavithra@ksrct.ac.in','+916382480391',NULL,'Assistant Professor',10,NULL,10,'Teaching','1996-04-10','2024-07-02',NULL,'Active','0009-0000-8884-9049','PEX-7650-2025','59483380700','BMvQlDoAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(147,'2330139','Dr','Poonkuzhali','R','Female','poonkuzhali@ksrct.ac.in','+919597612312',NULL,'Professor',10,NULL,10,'Teaching','1973-11-01','1998-02-01',NULL,'Active','0000-0002-9811-8597','AAA-7222-2021','55993862900','WpPRUv8AAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(148,'2330129','Dr','Sadasivam','V R','Male','sadasivam@ksrct.ac.in','+919688688555',NULL,'Professor',10,NULL,10,'Teaching','1976-05-23','2000-06-07',NULL,'Active','0000-0001-7443-8046','AAD-1289-2021','55792857200','ePEHqHoAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(149,'2330145','Dr','Sangeetha','M','Female','sangeetham@ksrct.ac.in','+919994670017',NULL,'Professor',10,NULL,10,'Teaching','1982-05-03','2010-07-14',NULL,'Active','0000-0003-4648-4242','AAC-5331-2021','59453160800','hlM5h08AAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(150,'2330147','Mr','Saravanan','K','Male','saravanank@ksrct.ac.in','+919677551893',NULL,'Assistant Professor',10,NULL,10,'Teaching','1989-10-11','2021-12-16',NULL,'Active','0009-0004-6993-8571','PEX-7856-2025','57202098322','B1PQCnMAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(151,'2330118','Mr','Selvarasu','R','Male','selvarasur@ksrct.ac.in','+918838080210',NULL,'Assistant Professor',10,NULL,29,'Teaching','1992-05-15','2023-09-04',NULL,'Active','0009-0006-2730-9608','PFI-6220-2025',NULL,'nTPFD04AAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 12:33:20',NULL),(152,'2330012','Dr','Srividhya','B','Female','srividhyab@ksrct.ac.in','+919486153434',NULL,'Professor',10,NULL,26,'Teaching','1969-10-27','2019-07-16',NULL,'Active','0000-0002-7914-9072',NULL,'57208900288','1P8QNHAAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 12:33:20',NULL),(153,'2330133','Mr','Thilakraj','M','Male','mthilakraj@ksrct.ac.in','+919842815665',NULL,'Assistant Professor',10,NULL,10,'Teaching','1985-11-12','2011-12-11',NULL,'Active','0000-0002-7029-8258','ADU-6265-2022','59155823900','jOnvuBcAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(154,'2330178','Dr','Baskaran','M','Male','baskaranm@ksrct.ac.in','+919698999756',NULL,'Assistant Professor',11,NULL,11,'Teaching','1981-06-05','2010-05-26',NULL,'Active','0000-0001-8787-3004','PDX-2131-2025','57207842303','pvC7UaEAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(155,'2330187','Mr','Hari Prasadh','S','Male','hariprasadh@ksrct.ac.in','+917092821630',NULL,'Assistant Professor',11,NULL,11,'Teaching','1997-07-25','2021-08-01',NULL,'Active','0009-0004-9679-8615','PDX-2063-2025','59129519000','95pIRdkAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(156,'2330180','Ms','Indumathi','V','Female','indumathi@ksrct.ac.in','+919965137001',NULL,'Assistant Professor',11,NULL,11,'Teaching','1986-05-09','2011-05-15',NULL,'Active','0000-0003-3007-5102',NULL,'59460650100','N5rC2sAAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(157,'2330155','Mr','Mohan','G','Male','mohang@ksrct.ac.in','+919597199771',NULL,'Assistant Professor',11,NULL,36,'Teaching','1970-10-02','2005-08-31',NULL,'Active','0000-0002-9873-1762','PDX-1958-2025','59157637000','Jx0P2sgAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 12:33:20',NULL),(158,'2330185','Dr','Mohanram','P','Male','mohanram@ksrct.ac.in','+919842558121',NULL,'Professor',11,NULL,11,'Teaching','1978-06-19','2021-05-31',NULL,'Active','0000-0001-8777-7207','PDX-1970-2025','57194165600','-1jnfLgAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(159,'2330114','Dr','Rajmohan','R','Male','rajmohan@ksrct.ac.in','+919944976518',NULL,'Associate Professor',11,NULL,29,'Teaching','1983-12-15','2015-01-11',NULL,'Active','0009-0009-7239-0558','IDPFJ-4695-2025','59304922100','1mPEAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 12:33:20',NULL),(160,'2330186','Dr','Ramesh Kumar','A','Male','rameshkumar@ksrct.ac.in','+919390063776',NULL,'Professor',11,NULL,11,'Teaching','1974-02-11','2021-06-10',NULL,'Active','0000-0001-9182-8054','PDW-8048-2025','56974090600','2CmP99sAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(161,'2330179','Mr','Sanjay','M','Male','sanjaym@ksrct.ac.in','+916382566247',NULL,'Assistant Professor',11,NULL,11,'Teaching','1998-09-22','2023-04-14',NULL,'Active','0009-0008-0168-7285','CM-251219-8485690','59224916600','A2r8GTUAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(162,'2330182','Dr','Sasikumar','M','Male','sasikumarm@ksrct.ac.in','+919965167895',NULL,'Assistant Professor',11,NULL,11,'Teaching','1984-12-28','2009-12-06',NULL,'Active','0000-0002-2888-3971','ADQ-1146-2022','57214715094','uJgK82cAAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(163,'2330183','Dr','Senthilmurugan','R','Male','senthilmurugan@ksrct.ac.in','+919843488996',NULL,'Professor',11,NULL,11,'Teaching','1973-06-15','2007-05-30',NULL,'Active','0000-0001-9325-3741','AAC-6197-2021','57148247600','IXKUG-0AAAAJ',NULL,NULL,'2026-01-19 08:27:44','2026-02-24 08:57:23',NULL),(164,'2330176','Dr','Tiruvenkadam','N','Male','tiruvenkadam@ksrct.ac.in','+919944672671',NULL,'Professor',11,NULL,11,'Teaching','1974-06-25','2008-06-02',NULL,'Active','0000-0003-4460-3877','RID-13424','55810894900','X3AblaEAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(165,'2330181','Dr','Vijayakumar','C','Male','vijayakumarc@ksrct.ac.in','+919994141857',NULL,'Associate Professor',11,NULL,11,'Teaching','1983-06-10','2008-06-04',NULL,'Active','0000-0002-9952-188X','B-6059-2018','57188747823','0mO-JK0AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(166,'2330184','Mr','Vivek','R','Male','vivekr@ksrct.ac.in','+918072952003',NULL,'Assistant Professor',11,NULL,11,'Teaching','1991-06-12','2021-06-06',NULL,'Active','0009-0008-5746-9105','PDA-2943-2025',NULL,'4wX3OdUAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(167,'2330203','Dr','Arthanarieswaran','V P','Male','arthanarieswaran@ksrct.ac.in','+919942522923',NULL,'Professor',12,NULL,12,'Teaching','1975-05-17','2006-05-31',NULL,'Active','0000-0002-8794-4295','ABG-4959-2020','56392997200','nQwqw58AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(168,'2330216','Mr','Balaji','B','Male','balajib@ksrct.ac.in','+917373557060',NULL,'Assistant Professor',12,NULL,12,'Teaching','1991-08-13','2015-05-31',NULL,'Active','0000-0001-5885-1164','PFJ-5001-2025','58142701600','dda34x4AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(169,'2330151','Dr','Chandran','C','Male','cchandran@ksrct.ac.in','+919942940500',NULL,'Professor',12,NULL,36,'Teaching','1965-07-27','1994-08-09',NULL,'Active','0009-0003-2666-8906','PDX-1365-2025','57212851199','toxomM4AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 12:33:20',NULL),(170,'2330214','Dr','Gnanasekaran','M','Male','gnanasekaran@ksrct.ac.in','+919894404279',NULL,'Associate Professor',12,NULL,12,'Teaching','1973-06-15','2007-05-31',NULL,'Active','0000-0002-7769-5117','PFJ-4980-2025','56001136500','2Kw2I54AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(171,'2330205','Dr','Gopalakrishnan','S','Male','sgopalakrishnan@ksrct.ac.in','+919944059444',NULL,'Professor',12,NULL,12,'Teaching','1966-01-24','1998-04-26',NULL,'Active','0000-0003-2557-5946','PFJ-5303-2025','7103126842','c_Io8IkAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(172,'2330199','Dr','Jeyaprakasam','S','Male','sjeyaprakasam@ksrct.ac.in','+919894694658',NULL,'Assistant Professor',12,NULL,12,'Teaching','1980-07-23','2012-07-01',NULL,'Active','0000-0003-1881-825X','AAA-3192-2021','57201427362','xsIhVcMAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(173,'2330208','Mr','Karthick','S','Male','skarthick@ksrct.ac.in','+919790667321',NULL,'Assistant Professor',12,NULL,12,'Teaching','1987-06-08','2011-05-15',NULL,'Active','0000-0001-8357-770X','PDX-2430-2025','60009154200','OvuhJV0AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(174,'2330197','Mr.','Karthikeyan','S','Male','karthikeyan.s@ksrct.ac.in','9629023042',NULL,'Assistant Professor',12,NULL,12,'Teaching','1990-12-27','2016-02-02',NULL,'Active','0000-0002-9746-3129','PFJ-5342-2025','59759479200','1UChKqEAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 05:42:42',NULL),(175,'2330206','Dr','Kathirselvam','M','Male','mkathirselvam@ksrct.ac.in','+919042897228',NULL,'Associate Professor',12,NULL,12,'Teaching','1990-05-27','2014-06-01',NULL,'Active','0000-0002-4142-3937','ABG-4891-2020','56392988900','o44SYXYAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(176,'2330200','Dr','Kumaravel','A','Male','kumaravel@ksrct.ac.in','+919443553626',NULL,'Professor',12,NULL,12,'Teaching','1969-05-14','2008-06-01',NULL,'Active','0000-0002-7624-9748','IZE-1766-2023','57210673099','u8SJj5sAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(177,'2330210','Dr','Mohan','K','Male','mohank@ksrct.ac.in','+919688664460',NULL,'Professor',12,NULL,12,'Teaching','1971-06-05','2006-05-31',NULL,'Active','0000-0002-7207-5461','PFJ-5173-2025',NULL,'ZhJmvJ0AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(178,'2330196','Dr','Murugesan','A','Male','murugesana@ksrct.ac.in','+919443090331',NULL,'Professor',12,NULL,12,'Teaching','1970-04-15','1996-05-09',NULL,'Active','0000-0002-6753-5590','AAA-3331-2021','6602648343','Pb6MHvEAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(179,'2330194','Dr.','Mylsami','G','Male','mylsamig@ksrct.ac.in','9442926820',NULL,'Professor',12,NULL,12,'Teaching','1965-05-31','1996-04-25',NULL,'Active','0000-0003-0179-4431','PFJ-4572-2025','55258731900','iTdCR74AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 05:42:43',NULL),(180,'2330207','Mr','Prakash','P','Male','pprakash@ksrct.ac.in','+918012663913',NULL,'Assistant Professor',12,NULL,12,'Teaching','1992-07-03','2015-05-31',NULL,'Active','0000-0001-5936-9417','AEB-3912-2022','59704247400','5UaqIm0AAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(181,'2330193','Mr','Prakash','R','Male','prakashr@ksrct.ac.in','+919788309406',NULL,'Assistant Professor',12,NULL,12,'Teaching','1989-10-06','2015-05-31',NULL,'Active','0000-0002-4607-9928','AAE-9565-2021','59174209000','B645MAYAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(182,'2330213','Mr','Prasath','M','Male','prasathm@ksrct.ac.in','+919788206877',NULL,'Assistant Professor',12,NULL,12,'Teaching','1986-05-09','2013-06-02',NULL,'Active','0000-0003-4641-3241','AAE-9684-2023','59976273300','HU2dQpsAAAAJ',NULL,NULL,'2026-01-19 08:27:45','2026-02-24 08:57:23',NULL),(183,'2330211','Dr','Raja','K','Male','rajak@ksrct.ac.in','+919842314481',NULL,'Assistant Professor',12,NULL,12,'Teaching','1980-01-05','2010-06-09',NULL,'Active','0000-0002-9905-5460','PFJ-3312-2025','57225844882','815Yo9gAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(184,'2330202','Mr','Ramesh','C','Male','rameshc@ksrct.ac.in','+919629767778',NULL,'Assistant Professor',12,NULL,12,'Teaching','1992-05-23','2015-05-31',NULL,'Active','0000-0002-7505-4076','PEX-7626-2025','59657823655','ExcP9dEAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(185,'2330195','Mr','Sakthivel','S','Male','sakthivel_s@ksrct.ac.in','+919790663185',NULL,'Assistant Professor',12,NULL,12,'Teaching','1985-07-14','2011-05-15',NULL,'Active','0000-0002-8543-7011','PDX-1242-2025','59418328700','7-h07XoAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(186,'2330204','Dr','Sampath','P S','Male','sampathps@ksrct.ac.in','+919962116570',NULL,'Professor',12,NULL,12,'Teaching','1973-05-12','2010-05-30',NULL,'Active','0000-0002-9975-5344','AAA-3386-2021','7003857211','MV0wAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(187,'2330198','Dr','Santhanam','K','Male','santhanam@ksrct.ac.in','+919842887155',NULL,'Professor',12,NULL,12,'Teaching','1980-06-15','2005-12-13',NULL,'Active','0000-0003-1222-256X','PEV-6340-2025','59670196400','fobpIi4AAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(188,'2330201','Ms','Srinithi','S','Female','srinithi@ksrct.ac.in','+919600404607',NULL,'Assistant Professor',12,NULL,12,'Teaching','1996-09-27','2021-11-15',NULL,'Active','0000-0002-7992-098X','AEB-5686-2023','54756236588','82o_5OsAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(189,'2330212','Mr','Tamil Arasu','P','Male','tamilarasup@ksrct.ac.in','+919600792888',NULL,'Assistant Professor',12,NULL,12,'Teaching','1989-05-24','2013-06-02',NULL,'Active','0000-0001-9670-996X','PEX-7677-2025','57216329320','iqG88CwAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(190,'2330209','Dr','Vasudevan','D','Male','vasudevand@ksrct.ac.in','+919659473224',NULL,'Assistant Professor',12,NULL,12,'Teaching','1984-06-20','2015-05-31',NULL,'Active','0000-0003-3574-9946','AAA-3157-2021','57215872067','073jihwAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(191,'2330192','Dr','Venkatachalam','G','Male','venkatachalam@ksrct.ac.in','+919442335001',NULL,'Professor',12,NULL,12,'Teaching','1969-07-03','2008-06-01',NULL,'Active','0000-0003-3163-6194','PDX-2012-2025','60019886100','ueuBzSoAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(192,'2330191','Mr','Venkatesan','S','Male','venkatesans@ksrct.ac.in','+919443015463',NULL,'Assistant Professor',12,NULL,12,'Teaching','1977-06-13','2001-08-30',NULL,'Active','0000-0001-5001-6594','PDX-2517-2025','59422135400','X5LAb3EAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(193,'2330215','Mr','Vivek','U','Male','viveku@ksrct.ac.in','+918148442364',NULL,'Assistant Professor',12,NULL,12,'Teaching','1990-03-19','2013-06-02',NULL,'Active','0000-0002-7539-9285','AAA-3357-2021','56515349900','USo9ne8AAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 08:57:23',NULL),(194,'2330229','Mr','Arunkumar','M','Male','arunkumar@ksrct.ac.in','+919842738598',NULL,'Assistant Professor',45,NULL,45,'Teaching','1987-06-04','2017-11-30',NULL,'Active','0000-0002-8339-9904','PFJ-8591-2025',NULL,'GRJWIw0AAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(195,'2330234','Mr','Devanand','G','Male','devanandg@ksrct.ac.in','+919952841869',NULL,'Assistant Professor',45,NULL,45,'Teaching','1979-12-11','2008-06-01',NULL,'Active','0000-0002-0459-0269','PFJ-8524-2025','57208206690','QLMyx8AAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(196,'2330231','Dr','Karthikeyan','G','Male','karthikeyang@ksrct.ac.in','+919842840809',NULL,'Professor',45,NULL,45,'Teaching','1977-06-10','2010-05-18',NULL,'Active','0000-0003-1970-2857','AAC-5987-2021','57217110561','3zanszgAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(197,'2330236','Dr','Nandagopal','K R','Male','nandagopal@ksrct.ac.in','+919003436705',NULL,'Assistant Professor',45,NULL,45,'Teaching','1969-05-24','2023-07-02',NULL,'Active','0000-0002-8660-9874','PEX-8431-2025','57226612209','x9RToyMAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(198,'2330152','Dr','Prabakaran','K','Male','prabakaran@ksrct.ac.in','+919043678079',NULL,'Professor',45,NULL,36,'Teaching','1978-01-12','2006-06-22',NULL,'Active','0000-0003-3391-731X','ACX-0272-2022','57197165805','0foWv10AAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(199,'2330235','Dr','Premalatha','C','Female','premalatha@ksrct.ac.in','+919750206161',NULL,'Assistant Professor',45,NULL,45,'Teaching','1981-05-21','2021-08-04',NULL,'Active','0000-0003-0599-0464','PEX-8091-2025','58081158200','oAbGNdwAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(200,'2330237','Dr','Sampath','M B','Male','sampath@ksrct.ac.in','+919003920300',NULL,'Professor',45,NULL,45,'Teaching','1958-01-12','2019-06-02',NULL,'Active','0000-0001-6734-8181','PFJ-8559-2025','57220398012','9yk2KQsAAAAJ',NULL,NULL,'2026-01-19 08:27:46','2026-02-24 12:33:20',NULL),(201,'2330230','Dr','Saravanan','K','Male','saravanan.k@ksrct.ac.in','+919842103201',NULL,'Professor',45,NULL,45,'Teaching','1975-01-27','2022-11-27',NULL,'Active','0000-0002-7753-601X','AFU-1718-2022','24528710400','V20_-DoAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(202,'2330268','Dr','Satheeshkumar','R','Male','satheeshkumarr@ksrct.ac.in','+919952658525',NULL,'Assistant Professor',45,NULL,26,'Teaching','1988-06-15','2024-06-18',NULL,'Active','0000-0002-3581-3197','AAA-6602-2021',NULL,'XEo5RR8AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(203,'2330233','Mr','Subburaayasaran','A S','Male','subburaayasaran@ksrct.ac.in','+919965515305',NULL,'Assistant Professor',45,NULL,45,'Teaching','1973-05-06','2022-06-30',NULL,'Active','0009-0001-9810-2229','PFJ-8359-2025','57425525900','8AD8mu0AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(204,'2330227','Dr','Sukumar','N','Male','sukumar@ksrct.ac.in','+919629558562',NULL,'Professor',45,NULL,45,'Teaching','1976-05-09','2021-12-19',NULL,'Active','0000-0003-0986-8714','AFL-0999-2022','56090919200','zxSGKfoAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(205,'2330109','Dr','Gomathi','S','Female','gomathi@ksrct.ac.in','+919894279244',NULL,'Associate Professor',46,NULL,46,'Teaching','1979-05-07','2000-06-07',NULL,'Active','0000-0003-1048-4494','AAC-5228-2021','57467298100','G614RBwAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(206,'2330067','Dr','Kumar','P','Male','kumar@ksrct.ac.in','+919750038774',NULL,'Professor',46,NULL,46,'Teaching','1976-05-30','2001-06-10',NULL,'Active','0000-0002-3274-2098','AAC-5504-2021','26423006100','ZuDX8qAAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(207,'2330154','Dr','Lalithamani','N','Female','lalithamani@ksrct.ac.in','+918925568867',NULL,'Professor',46,NULL,36,'Teaching','1975-05-07','2020-03-01',NULL,'Active','0000-0002-2655-6248','PDX-0596-2025','59157594500','Qhhe8XcAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(208,'2330071','Mr','Poornakumar','D','Male','poornakumard@ksrct.ac.in','+919003645614',NULL,'Assistant Professor',46,NULL,46,'Teaching','1988-06-05','2013-06-02',NULL,'Active','0000-0002-7529-1573','AAA-7939-2021','58670765200','k_BxNz4AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(209,'2330054','Mr','Pradeep','S','Male','pradeeps@ksrct.ac.in','+918122139862',NULL,'Assistant Professor',46,NULL,46,'Teaching','1991-08-20','2022-06-19',NULL,'Active','0000-0002-8643-6248','AAQ-5411-2020','57202473696','x72pu24AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(210,'2330099','Mr','Rajavenkatesan','T','Male','rajavenkatesan@ksrct.ac.in','+919488307798',NULL,'Assistant Professor',46,NULL,46,'Teaching','1985-04-11','2011-05-26',NULL,'Active','0000-0001-8952-967X','ACW-1224-2022','59693652400','WkVCoe0AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(211,'2330079','Ms','Saranya','C','Female','saranyac@ksrct.ac.in','+919994588990',NULL,'Assistant Professor',46,NULL,46,'Teaching','1984-06-01','2007-01-02',NULL,'Active','0000-0002-7640-3709','AAA-8064-2021','57215918065','uFWigNkAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(212,'2330306','Mr','Suresh Kumar','A','Male','sureshkumara@ksrct.ac.in','+919500371772',NULL,'Assistant Professor',46,NULL,46,'Teaching','1990-01-01','2025-06-02',NULL,'Active','0009-0007-6900-7605','IVV-5906-2023','56803858700','UrIOiVUAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(213,'2330222','Dr','Suthanthira Kumar','P','Male','suthanthirakumar@ksrct.ac.in','+919500825738',NULL,'Assistant Professor',46,NULL,39,'Teaching','1989-03-07','2022-06-02',NULL,'Active','0000-0001-6800-0419','GYV-2170-2022','56459015800','fvsm3B4AAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 12:33:20',NULL),(214,'2330261','Dr','Hemamalini','R','Female','hemamalini@ksrct.ac.in','+919487253243',NULL,'Professor',16,NULL,16,'Teaching','1973-10-19','1998-06-30',NULL,'Active','0000-0002-7986-4156','ACA-4573-2022','55307681300','3Di943sAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 08:57:23',NULL),(215,'2330174','Dr','Kalaiarasi','H','Female','kalaiarasi@ksrct.ac.in','+919894973129',NULL,'Professor',16,NULL,16,'Teaching','1979-05-04','2021-08-11',NULL,'Active','0000-0002-5747-8406','PEX-7873-2025','55513030200','MfH8EvUAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 08:57:23',NULL),(216,'2330173','Dr','Kalaivani','E','Female','kalaivanie@ksrct.ac.in','+919842768012',NULL,'Assistant Professor',16,NULL,16,'Teaching','1980-04-11','2016-09-18',NULL,'Active','0000-0003-3451-3640','LSJ-8035-2024','57031854800','QiAiedkAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 08:57:23',NULL),(217,'2330172','Dr','Mohanraj','M','Male','mohanrajm@ksrct.ac.in','+918807515919',NULL,'Assistant Professor',16,NULL,16,'Teaching','1992-09-23','2022-12-01',NULL,'Active','0009-0003-5033-9416','8214-2024',NULL,'rYoIWmsAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 08:57:23',NULL),(218,'2330167','Dr','Ramakrishnan','M','Male','ramakrishnan@ksrct.ac.in','+919894385805',NULL,'Professor',16,NULL,16,'Teaching','1976-06-05','2005-08-07',NULL,'Active','0000-0001-6591-0281','AAC-4782-2021','57208774747','BoLcyDAAAAAJ',NULL,NULL,'2026-01-19 08:27:47','2026-02-24 08:57:23',NULL),(219,'2330169','Mr','Vijayachander','V S','Male','vijayachander@ksrct.ac.in','+918870843330',NULL,'Assistant Professor',16,NULL,16,'Teaching','1973-11-10','2008-06-05',NULL,'Active','0009-0006-6284-3443','PEX-8003-2025','59761867200','cF9d38UAAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(220,'2330168','Dr','Vijayakumar','M','Male','mvijayakumar@ksrct.ac.in','+919842052113',NULL,'Professor',16,NULL,16,'Teaching','1978-05-29','2000-12-13',NULL,'Active','0000-0002-9845-3467','ACP-2150-2022','58995564700','Il8FIAMAAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(221,'2310102','Dr','Kiruthika','K','Male','kiruthikak@ksrct.ac.in','+919842661683',NULL,'Assistant Professor',17,NULL,17,'Teaching','1980-08-31','2023-05-02',NULL,'Active','0000-0002-3107-4008',NULL,NULL,'SgTMQ38AAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(222,'2310116','Ms','Megala','U','Male','megala@ksrct.ac.in','+917402251330',NULL,'Assistant Professor',17,NULL,17,'Teaching','1993-10-12','2023-06-04',NULL,'Active','0000-0002-9415-1154',NULL,NULL,'uNwYN4QAAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(223,'10452','Mr','Mohankumar','R','Male','mohankumar@ksrct.ac.in','+919790070708',NULL,'Assistant Professor',17,NULL,17,'Teaching','1984-05-21','2025-09-11',NULL,'Active','0000-0002-1318-8386','GNQ-8324-2022',NULL,'un7jUIAAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(224,'2330085','Dr','Puniethaa','Prabhu','Female','punithaa@ksrct.ac.in','+919443486922',NULL,'Professor',17,NULL,17,'Teaching','1975-07-14','1998-12-14',NULL,'Active','0000-0002-7642-1285','AAC-6681-2021','57203103777','2TFUsiQAAAAJ',NULL,NULL,'2026-01-19 08:27:48','2026-02-24 08:57:23',NULL),(225,'23300853456','Mr.','Alex','Turner','Male','maverickmyth333@gmail.com','3334445555','alexturner@gmail.com','Assistant Professor',1,NULL,2,'Teaching','1992-04-20','2019-01-15',NULL,'Active','0000-0006-7890-1234',NULL,NULL,'GOOGLE005','RESEARCH005',1,'2026-01-19 09:41:26','2026-02-24 09:53:33',1),(226,'99887766554','Dr.','Ajay','Doe','Male','maheshwaran325@gmail.com','9998887776','john.alt@testmail.com','Associate Professor',2,NULL,4,'Teaching','1987-09-15','2020-08-01',NULL,'Active','0000-0002-3456-7890','WOS-226','SCOPUS-226','GOOGLE-226','RG-226',2,'2026-02-24 06:00:00','2026-02-24 09:53:33',2),(227,'99887723554','Dr.','Akil','Doe','Male','gingfreecss325@gmail.com','9998887776','john.alt@testmail.com','Associate Professor',3,NULL,5,'Teaching','1987-09-15','2020-08-01',NULL,'Active','0000-0002-3456-7890','WOS-226','SCOPUS-226','GOOGLE-226','RG-226',2,'2026-02-24 06:00:00','2026-02-24 09:53:33',2),(401,'2310213','Ms','Eswari','A','Female','eswaria@ksrct.ac.in','+918248337533',NULL,NULL,1,NULL,1,'Non-Teaching','1996-11-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(402,'2310003','Mr','Ganesan','R P','Male','ganesanrp@ksrct.ac.in','+919865455334',NULL,NULL,1,NULL,1,'Non-Teaching','1962-01-26',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(403,'2310216','Ms','Janani','A P','Other','jananiap@ksrct.ac.in','8838942548',NULL,NULL,1,NULL,1,'Non-Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(404,'2110084','Mr','Pavithra','K','Male','pavithrak@ksrct.ac.in','+918248497300',NULL,NULL,1,NULL,1,'Non-Teaching','2001-09-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(405,'2310109','Mr','Saraswathi','P','Male','saraswathi@ksrct.ac.in','+91',NULL,NULL,1,NULL,1,'Non-Teaching','1976-08-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(406,'2330281','Mr','Shalini','J K','Male','shalinijk@ksrct.ac.in',NULL,NULL,NULL,1,NULL,1,'Non-Teaching','2002-02-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(407,'2310106','Ms','Bakkiyam','P','Female','p.bakkiyam@ksrct.ac.in','+919865726519',NULL,NULL,2,NULL,2,'Non-Teaching','1971-06-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(408,'2310042','Mr','Senthil Kumar','M','Male','senthilkumarm@ksrct.ac.in','+919965054605',NULL,NULL,2,NULL,2,'Non-Teaching','1977-06-08',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(409,'2310132','Ms','Shigamani','S','Female','shigamani@ksrct.ac.in','+919788286688',NULL,NULL,2,NULL,2,'Non-Teaching','1975-03-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(410,'10451','Mr','Surendar','K','Male','surendark@ksrct.ac.in','+919342558918',NULL,NULL,2,NULL,2,'Non-Teaching','2004-07-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(411,'2310137','Mr','Kalaiselvan','S','Male','kalaiselvan@ksrct.ac.in','+919080894855',NULL,NULL,24,NULL,24,'Non-Teaching','1986-05-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(412,'2310023','Mr','Sundaravathani','S','Male','sundaravathanis@ksrct.ac.in','+919894332829',NULL,NULL,25,NULL,25,'Non-Teaching','1979-05-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(413,'2310103','Mr','Manimekalai','M','Male','manimekalai@ksrct.ac.in','+919578587320',NULL,NULL,3,NULL,3,'Non-Teaching','1983-03-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(414,'2310107','Mr','Mohanambal','R','Male','mohanambalr@ksrct.ac.in','+919095149912',NULL,NULL,3,NULL,3,'Non-Teaching','1981-07-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(415,'2310110','Mr','Neelakandan','S','Male','s.neelakandan@ksrct.ac.in','+917397191030',NULL,NULL,3,NULL,3,'Non-Teaching','1997-05-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(416,'2310104','Mr','Revathi','R','Male','rrevathi@ksrct.ac.in','+91',NULL,NULL,3,NULL,3,'Non-Teaching','1976-06-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(417,'2310108','Mr','Swetha','R','Male','swethar@ksrct.ac.in','+917604928575',NULL,NULL,3,NULL,3,'Non-Teaching','2002-08-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(418,'2310105','Mr','Vijayalakshmi','S','Male','vijayalakshmis@ksrct.ac.in','+919976656660',NULL,NULL,3,NULL,3,'Non-Teaching','1975-06-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(419,'2310171','Mr','Renuka','P','Male','renukap@ksrct.ac.in','+918524098828',NULL,NULL,26,NULL,26,'Non-Teaching','1984-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(420,'2310024','Mr','Sowthamani','R','Male','sowthamani@ksrct.ac.in','+919865365785',NULL,NULL,26,NULL,26,'Non-Teaching','1969-05-24',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(421,'2310025','Mr','Dharini','S','Male','dharini@ksrct.ac.in','+919043582492',NULL,NULL,4,NULL,4,'Non-Teaching','1995-06-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(422,'2110074','Mr','Gowtham','S','Male','gowtham@ksrct.ac.in','+918056776172',NULL,NULL,4,NULL,4,'Non-Teaching','1996-08-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(423,'2310026','Mr','Mohankumar','C','Male','mohankumarc@ksrct.ac.in','+919942896192',NULL,NULL,4,NULL,4,'Non-Teaching','1982-08-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(424,'2310185','Mr','Raguvaran','S','Male','raguvarans@ksrct.ac.in',NULL,NULL,NULL,4,NULL,4,'Non-Teaching','1987-06-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(425,'2110075','Mr','Revathi','T','Male','revathit@ksrct.ac.in','+919865468062',NULL,NULL,4,NULL,4,'Non-Teaching','1972-05-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(426,'2310027','Mr','Suganthi','G','Male','suganthi@ksrct.ac.in','+919688011184',NULL,NULL,4,NULL,4,'Non-Teaching','1969-04-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(427,'2310029','Mr','Karthick','S','Male','karthicks@ksrct.ac.in','+919788150154',NULL,NULL,27,NULL,27,'Non-Teaching','1989-06-24',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(428,'2310030','Mr','Lalitha','S','Male','lalitha@ksrct.ac.in','+919715570271',NULL,NULL,27,NULL,27,'Non-Teaching','1980-06-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(429,'2110076','Mr','Sathiskumar','M','Male','sathiskumar@ksrct.ac.in','+919750228759',NULL,NULL,27,NULL,27,'Non-Teaching','1988-01-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(430,'2310155','Mr','Sivamathi','R','Male','sivamathi.r@ksrct.ac.in','+919028484595',NULL,NULL,27,NULL,27,'Non-Teaching','2002-09-23',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(431,'2310032','Mr','Sneha','S','Male','snehas@ksrct.ac.in','+918754685323',NULL,NULL,27,NULL,27,'Non-Teaching','2001-04-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(432,'2310031','Mr','Uma','E','Male','umae@ksrct.ac.in','+918056610886',NULL,NULL,27,NULL,27,'Non-Teaching','1979-07-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(433,'2310133','Mr','Ambiga','C','Male','ambiga@ksrct.ac.in','+919003675296',NULL,NULL,6,NULL,6,'Non-Teaching','1968-05-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(434,'2310118','Mr','Porkodi','K','Male','porkodi@ksrct.ac.in','+919865632461',NULL,NULL,6,NULL,6,'Non-Teaching','1977-06-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(435,'2310193','Mr','Sowmiya','V','Male','sowmiyav@ksrct.ac.in',NULL,NULL,NULL,6,NULL,6,'Non-Teaching','1991-08-31',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(436,'2310119','Mr','Vaideki','P','Male','vaidekip@ksrct.ac.in','+919894950205',NULL,NULL,6,NULL,6,'Non-Teaching','1997-11-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(437,'2310192','Mr','Karthi','K','Male','karthikittusamy@ksrct.ac.in',NULL,NULL,NULL,5,NULL,5,'Non-Teaching','1989-04-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(438,'10445','Ms','Mangaiyarkarasi','R','Female','mangaiyarkarasir@ksrct.ac.in','+918807401541',NULL,NULL,5,NULL,5,'Non-Teaching','2004-08-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(439,'2310034','Mr','Mythili','R','Male','mythilir@ksrct.ac.in','+918883739945',NULL,NULL,5,NULL,5,'Non-Teaching','1990-05-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(440,'2310035','Mr','Sudha','K','Male','k.sudha@ksrct.ac.in','+919942599134',NULL,NULL,5,NULL,5,'Non-Teaching','1976-04-26',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(441,'2310037','Mr','Vinoth','S','Male','vinoth@ksrct.ac.in','+919894550554',NULL,NULL,5,NULL,5,'Non-Teaching','1982-12-24',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(442,'2310040','Mr','Geetha','D','Male','geethad@ksrct.ac.in','+919788450623',NULL,NULL,7,NULL,7,'Non-Teaching','1975-05-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(443,'2310002','Mr','Indrani','T','Male','indranit@ksrct.ac.in','+919842193621',NULL,NULL,7,NULL,7,'Non-Teaching','1975-10-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(444,'2310039','Mr','Kandasamy','S','Male','kandasamy@ksrct.ac.in','+919865653953',NULL,NULL,7,NULL,7,'Non-Teaching','1973-07-19',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(445,'2310044','Mr','Magalingam','S','Male','mahalingam@ksrct.ac.in','+919788623925',NULL,NULL,7,NULL,7,'Non-Teaching','1981-07-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(446,'2310038','Mr','Manikandan','K','Male','manikandank@ksrct.ac.in','+919659724870',NULL,NULL,7,NULL,7,'Non-Teaching','1993-03-21',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(447,'2310041','Mr','Rajeswari','B','Male','rajeshwari@ksrct.ac.in','+919965261607',NULL,NULL,7,NULL,7,'Non-Teaching','1985-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(448,'2310146','Mr','Arulappan','S','Male','arulappan@ksrct.ac.in','+919791803988',NULL,NULL,8,NULL,8,'Non-Teaching','1962-03-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(449,'2310145','Mr','Indhuja','B','Male','indhuja@ksrct.ac.in','+918667652544',NULL,NULL,8,NULL,8,'Non-Teaching','2001-06-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(450,'2310147','Mr','Jayamurugan','V','Male','jayamurugan@ksrct.ac.in','+919787558146',NULL,NULL,8,NULL,8,'Non-Teaching','1977-06-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(451,'10303','Mr','Kaladevi','V','Male','kaladeviv@ksrct.ac.in','+918220429215',NULL,NULL,8,NULL,8,'Non-Teaching','1987-06-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(452,'2310148','Mr','Ramasamy','P','Male','p.ramasamy@ksrct.ac.in','+919942038534',NULL,NULL,8,NULL,8,'Non-Teaching','1973-04-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(453,'2310201','Mr','Saravanaraj','M','Male','saravanarajm@ksrct.ac.in','+919715557948',NULL,NULL,8,NULL,8,'Non-Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(454,'2110218','Mr','Nataraj','M','Male','natarajm@ksrct.ac.in','+918903097393',NULL,NULL,28,NULL,28,'Non-Teaching','2003-04-19',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(455,'2310045','Mr','Kavitha','R','Male','kavithar@ksrct.ac.in','+919842275699',NULL,NULL,29,NULL,29,'Non-Teaching','1981-04-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(456,'2310047','Mr','Maheswari','M','Male','maheswari@ksrct.ac.in','+919150582500',NULL,NULL,30,NULL,30,'Non-Teaching','1981-02-08',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(457,'2310046','Mr','Mathiyazhagan','M','Male','mathiyazhagan@ksrct.ac.in','+919788676965',NULL,NULL,30,NULL,30,'Non-Teaching','1995-05-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(458,'2310209','Mr','Sathishkumar','V C','Male','sathishkumarvc@ksrct.ac.in','+919976137355',NULL,NULL,30,NULL,30,'Non-Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(459,'2310197','Mr','Sureshkumar','C','Male','sureshkumarc@ksrct.ac.in',NULL,NULL,NULL,30,NULL,30,'Non-Teaching','1985-05-05',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(460,'2310048','Mr','Abitha','A','Male','abitha@ksrct.ac.in','+919655688388',NULL,NULL,9,NULL,9,'Non-Teaching','1986-06-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(461,'2310004','Mr','Amudhavalli','K','Male','amudhavalli@ksrct.ac.in','+919965741320',NULL,NULL,9,NULL,9,'Non-Teaching','1976-06-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(462,'2310180','Mr','Jamuna Devi','K','Male','jamunadevi@ksrct.ac.in','+917502402291',NULL,NULL,9,NULL,9,'Non-Teaching','1992-03-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(463,'2310052','Mr','Saranya','S','Male','saranya.s@ksrct.ac.in','+919384177439',NULL,NULL,9,NULL,9,'Non-Teaching','1987-06-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(464,'2310050','Mr','Soniya','C','Male','soniya@ksrct.ac.in','+916379412934',NULL,NULL,9,NULL,9,'Non-Teaching','2000-06-05',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(465,'2310051','Mr','Srinivasan','A','Male','srinivasana@ksrct.ac.in','+919788873779',NULL,NULL,9,NULL,9,'Non-Teaching','1973-07-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(466,'2310053','Mr','Duraipandi','V','Male','duraipandi@ksrct.ac.in','+918148433391',NULL,NULL,31,NULL,31,'Non-Teaching','1961-04-16',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(467,'2310054','Mr','Karthikraja','M','Male','karthikraja@ksrct.ac.in',NULL,NULL,NULL,31,NULL,31,'Non-Teaching','1992-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(468,'2310081','Mr','Manikandeswari','M','Male','manikandeswari@ksrct.ac.in','+919842651066',NULL,NULL,32,NULL,32,'Non-Teaching','1974-06-02',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(469,'2310079','Mr','Ravikumar','T','Male','ravikumart@ksrct.ac.in','+919791772868',NULL,NULL,33,NULL,33,'Non-Teaching','1983-03-19',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(470,'2310151','Mr','Kalaiselvi','K','Male','kalaiselvi@ksrct.ac.in','+917373555981',NULL,NULL,34,NULL,34,'Non-Teaching','1990-07-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(471,'2310152','Mr','Sumathi','M','Male','sumathim@ksrct.ac.in','+919942839111',NULL,NULL,34,NULL,34,'Non-Teaching','1966-02-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(472,'10446','Ms','Anisha','M','Female','anisham@ksrct.ac.in','+919345881744',NULL,NULL,10,NULL,10,'Non-Teaching','2025-08-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(473,'2310055','Mr','Chithra','T','Male','chitrat@ksrct.ac.in','+919486340291',NULL,NULL,10,NULL,10,'Non-Teaching','1972-06-21',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(474,'10447','Ms','Kamala Lakshmi Priya','M A','Female','kamalalakshmipriyama@ksrct.ac.in','+917598370553',NULL,NULL,10,NULL,10,'Non-Teaching','2025-08-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(475,'2110080','Mr','Mohanraj','P','Male','mohanrajp@ksrct.ac.in',NULL,NULL,NULL,10,NULL,10,'Non-Teaching','1997-06-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(476,'2310214','Mr','Pradeepkanna','D','Male','pradeepkannad@ksrct.ac.in','+917708773028',NULL,NULL,10,NULL,10,'Non-Teaching','1996-10-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(477,'2310188','Mr','Sathyaraj','A','Male','sathyaraja@ksrct.ac.in',NULL,NULL,NULL,10,NULL,10,'Non-Teaching','1985-06-19',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(478,'2310060','Mr','Sowmiya','P','Male','sowmiya@ksrct.ac.in','+916380776038',NULL,NULL,10,NULL,10,'Non-Teaching','1996-06-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(479,'10454','Ms','Srimirnaaliny','B','Female','srimirnaalinyb@ksrct.ac.in','+919994812748',NULL,NULL,10,NULL,10,'Non-Teaching','2003-02-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(480,'2310057','Mr','Suresh','N','Male','sureshn@ksrct.ac.in','+919942921856',NULL,NULL,10,NULL,10,'Non-Teaching','1975-07-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(481,'2310184','Mr','Ajithkumar','V','Male','ajithkumarv@ksrct.ac.in','+919384164436',NULL,NULL,35,NULL,35,'Non-Teaching','2000-10-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(482,'2310065','Mr','Mohanraj','S','Male','mohanrajs@ksrct.ac.in','+919865976663',NULL,NULL,35,NULL,35,'Non-Teaching','1980-01-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(483,'2310067','Ms','Nandhini','M','Male','nandhini@ksrct.ac.in','+917708849476',NULL,NULL,35,NULL,35,'Non-Teaching','1998-05-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(484,'2310064','Ms','Nishalini','R','Male','nishalinir@ksrct.ac.in','+919789451434',NULL,NULL,35,NULL,35,'Non-Teaching','2001-04-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(485,'2310062','Ms','Sabiyama','A','Male','sabiyama@ksrct.ac.in','+919344186061',NULL,NULL,35,NULL,35,'Non-Teaching','1988-06-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(486,'2310063','Ms','Salomi','S','Male','salomi@ksrct.ac.in','+919715018002',NULL,NULL,35,NULL,35,'Non-Teaching','1986-04-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(487,'2310061','Mr','Velusamy','T','Male','velusamy@ksrct.ac.in','+919025280205',NULL,NULL,35,NULL,35,'Non-Teaching','1996-05-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(488,'2330149','Dr','Venkatachalam','A M','Male','amvenku@ksrct.ac.in','+919994250222',NULL,NULL,35,NULL,35,'Non-Teaching','1975-05-27',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(489,'2110081','Mr','Vinoth Kumar','J','Male','vinothkumarj@ksrct.ac.in','+919842249028',NULL,NULL,35,NULL,35,'Non-Teaching','1988-04-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(490,'2310196','Ms','Jeevitha','K','Female','jeevithak@ksrct.ac.in','+919042667228',NULL,NULL,NULL,NULL,NULL,'Non-Teaching','1991-02-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(491,'2310070','Mr','Maruthambiga','A','Male','m.maruthambiga@ksrct.ac.in','+919976741505',NULL,NULL,16,NULL,16,'Non-Teaching','1966-04-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(492,'2310071','Mr','Ragunathan','N','Male','n.ragunathan@ksrct.ac.in','+918754664690',NULL,NULL,16,NULL,16,'Non-Teaching','1976-04-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(493,'2110082','Mr','Revathi','K','Male','revathik@ksrct.ac.in','+918056887531',NULL,NULL,16,NULL,16,'Non-Teaching','1983-07-27',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(494,'2310111','Mr','Shanthi','K E','Male','keshanthi@ksrct.ac.in','+919976492684',NULL,NULL,17,NULL,17,'Non-Teaching','1975-05-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(495,'2310075','Mr','Geetha','C','Male','geethac@ksrct.ac.in','+919345450817',NULL,NULL,11,NULL,11,'Non-Teaching','1975-03-22',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(496,'2310074','Mr','Gomathi','S','Male','s.gomathi@ksrct.ac.in','+919976511362',NULL,NULL,11,NULL,11,'Non-Teaching','1982-04-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(497,'2310076','Mr','Padmavathi','P','Male','padmavathip@ksrct.ac.in','+919942882714',NULL,NULL,11,NULL,11,'Non-Teaching','1973-07-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(498,'2310073','Mr','Saravanan','S','Male','ssaravanan@ksrct.ac.in','+919894791088',NULL,NULL,11,NULL,11,'Non-Teaching','1967-05-30',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(499,'2310072','Mr','Senthil','S','Male','senthils@ksrct.ac.in','+918838042537',NULL,NULL,11,NULL,11,'Non-Teaching','1986-04-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(500,'2310088','Mr','Ayyavu','A','Male','ayyavu@ksrct.ac.in','+919842636477',NULL,NULL,12,NULL,12,'Non-Teaching','1970-03-16',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(501,'2310089','Mr','Dhanakumar','S','Male','dhanakumar@ksrct.ac.in','+919865651561',NULL,NULL,12,NULL,12,'Non-Teaching','1986-03-31',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(502,'2310087','Mr','Dhanasekaran','R','Male','dhanasekaranr@ksrct.ac.in','+919865994882',NULL,NULL,12,NULL,12,'Non-Teaching','1974-04-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(503,'2310083','Mr','Jeevitha','R','Male','jeevitha@ksrct.ac.in','+917402292435',NULL,NULL,12,NULL,12,'Non-Teaching','1992-06-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(504,'2310080','Mr','Kathirvel','K','Male','kathirvelk@ksrct.ac.in','+919976450937',NULL,NULL,12,NULL,12,'Non-Teaching','1968-05-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(505,'2110223','Mr','Manikandan','P','Male','manikandanp@ksrct.ac.in','+919840401742',NULL,NULL,12,NULL,12,'Non-Teaching','1975-06-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(506,'2310086','Mr','Murugesan','N','Male','murugesann@ksrct.ac.in','+919865468228',NULL,NULL,12,NULL,12,'Non-Teaching','1990-04-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(507,'2310082','Mr','Shanmugam','S','Male','shanmugams@ksrct.ac.in','+916380714090',NULL,NULL,12,NULL,12,'Non-Teaching','1991-03-16',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(508,'2310085','Ms','Tamilselvi','D','Male','tamilselvi@ksrct.ac.in','+917502215299',NULL,NULL,12,NULL,12,'Non-Teaching','1982-05-14',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(509,'2310078','Ms','Aiswaraya','S','Male','s.aiswarya@ksrct.ac.in','+919080304295',NULL,NULL,37,NULL,37,'Non-Teaching','2001-02-14',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(510,'2310091','Mr','Gayathri','M','Male','gayathrim@ksrct.ac.in','+919965822934',NULL,NULL,15,NULL,15,'Non-Teaching','1986-04-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(511,'2310092','Mr','Kokila','R','Male','kokila@ksrct.ac.in','+919095768952',NULL,NULL,15,NULL,15,'Non-Teaching','1984-06-26',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(512,'2310090','Mr','Manojkumar','P','Male','pmanojkumar@ksrct.ac.in','+919944321999',NULL,NULL,15,NULL,15,'Non-Teaching','1993-01-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(513,'2310172','Mr','Savitha','S','Male','savitha2919@gmail.com','+918883336326',NULL,NULL,15,NULL,15,'Non-Teaching','1998-01-05',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(514,'2110083','Mr','Surendhiran','S','Male','surendhiran@ksrct.ac.in','+919715475217',NULL,NULL,15,NULL,15,'Non-Teaching','1993-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 08:57:23',NULL),(515,'10386','Mr','Dhanalakshmi','C','Male','c.dhanalakshmi@ksrct.ac.in','+917904949395',NULL,NULL,38,NULL,38,'Non-Teaching','1977-09-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(516,'2310120','Mr','Kajendiran','P','Male','kajendiranp@ksrct.ac.in','+919003818886',NULL,NULL,38,NULL,38,'Non-Teaching','1984-06-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(517,'2310095','Mr','Gandhimathi','R','Male','gandhimathi@ksrct.ac.in','+919095507503',NULL,NULL,39,NULL,39,'Non-Teaching','1977-11-27',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(518,'2310096','Ms','Nirmala','S','Male','nirmala@ksrct.ac.in','+919360437317',NULL,NULL,40,NULL,40,'Non-Teaching','1999-12-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(519,'2110085','Mr','Priyanka','S S','Male','priyanka@ksrct.ac.in','+919360342784',NULL,NULL,40,NULL,40,'Non-Teaching','1998-06-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(520,'2310122','Mr','Amsavalli','R','Male','amsavalli@ksrct.ac.in','+919944506935',NULL,NULL,41,NULL,41,'Non-Teaching','1979-05-26',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(521,'2310123','Mr','Arunadevi','B','Male','arunadevi@ksrct.ac.in','+919843711179',NULL,NULL,41,NULL,41,'Non-Teaching','1981-07-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(522,'10455','Mr','Hariharan','S','Male','hariharans@ksrct.ac.in','+919944616964',NULL,NULL,41,NULL,41,'Non-Teaching','1996-06-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(523,'2310128','Mr','Karthik','N','Male','principalsecretary@ksrct.ac.in','+919654708547',NULL,NULL,41,NULL,41,'Non-Teaching','1995-12-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(524,'2310208','Mr','Madhavan','S','Male','madhavans@ksrct.ac.in','+919942250108',NULL,NULL,41,NULL,41,'Non-Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(525,'2310130','Mr','Murugesan','M','Male','m.murugesan@ksrct.ac.in','+919940953535',NULL,NULL,41,NULL,41,'Non-Teaching','1990-04-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(526,'2310125','Mr','Saravanan','G','Male','saravananpa@ksrct.ac.in','+919994410707',NULL,NULL,41,NULL,41,'Non-Teaching','1967-07-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(527,'2310154','Mr','Sasimitha','M','Male','sasimitha.m@ksrct.ac.in','+919597846762',NULL,NULL,41,NULL,41,'Non-Teaching','2001-05-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(528,'2310186','Mr','Selvakumar','K','Male','selvakumark@ksrct.ac.in',NULL,NULL,NULL,41,NULL,41,'Non-Teaching','1997-06-24',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(529,'2310126','Mr','Sudhakar','C','Male','sudhakarc@ksrct.ac.in','+919965709441',NULL,NULL,41,NULL,41,'Non-Teaching','1986-08-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(530,'2310127','Mr','Thanapal','K','Male','k.thanabal@ksrct.ac.in','+918870317617',NULL,NULL,41,NULL,41,'Non-Teaching','1997-05-02',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(531,'2310121','Mr','Umaa Maheaswari','J','Male','umaamaheaswari@ksrct.ac.in','+919750038090',NULL,NULL,41,NULL,41,'Non-Teaching','1980-10-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(532,'2310124','Ms','Vasanthi','V','Male','vasanthiv@ksrct.ac.in','+919442334578',NULL,NULL,41,NULL,41,'Non-Teaching','1969-01-05',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(533,'2310135','Mr','Balaji','N','Male','nbalaji@ksrct.ac.in','+919442177737',NULL,NULL,42,NULL,42,'Non-Teaching','1975-11-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(534,'2310136','Mr','Bhoopathi Rajan','P','Male','bhoopathirajan@ksrct.ac.in','+918760987654',NULL,NULL,42,NULL,42,'Non-Teaching','1997-04-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(535,'2310058','Mr','Karthikeyan','M','Male','karthikeyanm@ksrct.ac.in','+919786357501',NULL,NULL,42,NULL,42,'Non-Teaching','1981-03-30',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(536,'2310190','Mr','Murugesan','R','Male','murugesanrathinam@ksrct.ac.in',NULL,NULL,NULL,42,NULL,42,'Non-Teaching','1978-07-23',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(537,'2310144','Mr','Padmapriya','S','Male','padmapriya@ksrct.ac.in','+919790355640',NULL,NULL,42,NULL,42,'Non-Teaching','1997-11-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(538,'2110087','Mr','Sakthivel','S','Male','sakthivel.s@ksrct.ac.in','+919659473837',NULL,NULL,42,NULL,42,'Non-Teaching','1979-05-14',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(539,'2110088','Mr','Sudhakar','S','Male','sudhakar@ksrct.ac.in','+919488465365',NULL,NULL,42,NULL,42,'Non-Teaching','2022-03-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(540,'2310114','Mr','Damotharan','G','Male','damotharan@ksrct.ac.in','+916383868090',NULL,NULL,44,NULL,44,'Non-Teaching','1997-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(541,'2310191','Ms','Gomathi','S','Female','gomathisubramaniam@ksrct.ac.in',NULL,NULL,NULL,44,NULL,44,'Non-Teaching','1996-08-20',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(542,'2310098','Ms','Prema','S','Male','prema@ksrct.ac.in','+919965994425',NULL,NULL,44,NULL,44,'Non-Teaching','1984-04-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(543,'2310097','Mr','Raja','S','Male','sraja@ksrct.ac.in','+919047241741',NULL,NULL,44,NULL,44,'Non-Teaching','1984-09-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(544,'2310099','Mr','Ramesh','D','Male','rameshd@ksrct.ac.in','+919600815768',NULL,NULL,44,NULL,44,'Non-Teaching','1975-05-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(545,'2310138','Mr','Avinasilingam','N','Male','avanashilingam@ksrct.ac.in','+919344765503',NULL,NULL,45,NULL,45,'Non-Teaching','1969-07-27',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(546,'2310084','Mr','Dharmaraj','S','Male','dharmaraj@ksrct.ac.in','+919842399240',NULL,NULL,45,NULL,45,'Non-Teaching','1972-05-17',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(547,'2310203','Mr','Ramesh','N','Male','rameshnagaraj@ksrct.ac.in','+919543439995',NULL,NULL,45,NULL,45,'Non-Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(548,'2310141','Mr','Sathiya','S','Male','sathiyas@ksrct.ac.in','+917502261799',NULL,NULL,45,NULL,45,'Non-Teaching','1988-05-25',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(549,'2310142','Mr','Sudha','S','Male','sudha.s@ksrct.ac.in','+919655494100',NULL,NULL,45,NULL,45,'Non-Teaching','1979-06-10',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(550,'2310139','Mr','Umarani','P','Male','umarani@ksrct.ac.in','+919443214772',NULL,NULL,45,NULL,45,'Non-Teaching','1979-05-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(551,'2310043','Mr','Chitra','V','Male','chitrav@ksrct.ac.in','+918508379410',NULL,NULL,46,NULL,46,'Non-Teaching','1977-05-07',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(552,'2310183','Mr','Dineshbabu','B','Male','dineshbabub@ksrct.ac.in','+916383978542',NULL,NULL,46,NULL,7,'Non-Teaching','2000-10-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(553,'10437','Mr','Elango','A','Male','elangoa@ksrct.ac.in','+917904375431',NULL,NULL,46,NULL,46,'Non-Teaching','1996-03-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(554,'2310211','Mr','Gokul','S','Male','gokuls@ksrct.ac.in','+917845781000',NULL,NULL,46,NULL,46,'Non-Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(555,'10449','Ms','Rubasree','D','Female','rubasreed@ksrct.ac.in','+918870672577',NULL,NULL,46,NULL,46,'Non-Teaching','2003-05-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(556,'2310178','Mr','Tharani','G','Male','tharani.g@ksrct.ac.in','+918754634837',NULL,NULL,46,NULL,46,'Non-Teaching','1995-01-06',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:43:47','2026-02-24 12:33:20',NULL),(557,'2330002','Ms','Kalaimani','I','Female','kalaimani@ksrct.ac.in','+919688224088',NULL,NULL,1,NULL,1,'Teaching','1986-05-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(558,'2310176','MS','Mohana','G','Female','mohana.g@ksrct.ac.in','+916380210034',NULL,NULL,1,NULL,1,'Teaching','2000-08-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(559,'2330279','Ms','Sivaranjani','R S','Female','sivaranjani.rs@ksrct.ac.in','+919677055783',NULL,NULL,2,NULL,2,'Teaching','1993-12-22',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(560,'2330252','Mr','Thamizharasu','V','Male','thamizharasu@ksrct.ac.in','+919655454000',NULL,NULL,2,NULL,2,'Teaching','1989-10-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(561,'10456','Mr','Vinothkumar','S','Male','vinothkumars@ksrct.ac.in','+917548898727',NULL,NULL,2,NULL,2,'Teaching','1989-06-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(562,'10252','Ms','Kalaiarasi','M S','Female','kalaiarasims@ksrct.ac.in','+919629426581',NULL,NULL,3,NULL,3,'Teaching','1998-06-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(563,'2330272','Dr','Nadana Sabapathi','S','Male','nadanasabapathi@ksrct.ac.in','+919042668909',NULL,NULL,3,NULL,3,'Teaching','2001-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(564,'2330025','Dr','Siva Kumar','D','Male','sivakumard@ksrct.ac.in','+919003807090',NULL,NULL,4,NULL,4,'Teaching','1984-06-23',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(565,'2330245','Dr','Manimaran','P','Male','manimaran@ksrct.ac.in','+919894279891',NULL,NULL,6,NULL,6,'Teaching','1981-06-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(566,'2330243','Mr','Venkatesh','P','Male','venkateshp@ksrct.ac.in','+918903366916',NULL,NULL,6,NULL,6,'Teaching','1982-05-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(567,'2330040','Ms','Thamarai Selvi','S B','Female','thamaraiselvi@ksrct.ac.in','+918754673833',NULL,NULL,5,NULL,5,'Teaching','1992-11-23',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(568,'10420','Dr','Mahabubbasha','A','Other','mahabubbashaece@ksrct.ac.in','+9199541385715',NULL,NULL,7,NULL,7,'Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(569,'10458','Dr','Meenakshi Sundaram','G','Male','meenakshisundaramg@ksrct.ac.in','+919025773920',NULL,NULL,7,NULL,7,'Teaching','1979-05-12',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(570,'10419','Dr','Santhosh Kumar','C','Other','csanthoshkumarece@ksrct.ac.in','+9198645431844',NULL,NULL,7,NULL,7,'Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(571,'10421','Dr','Sivasubramanian','K','Other','ksivasubramanianece@ksrct.ac.in','+9178346713871',NULL,NULL,7,NULL,7,'Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(572,'2330224','Mr','Mohan','V','Male','mohan@ksrct.ac.in','+919894641414',NULL,NULL,8,NULL,39,'Teaching','1961-07-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(573,'10125','Ms','Aarthi','P','Female','aarthi@ksrct.ac.in','+918270598376',NULL,'',9,22,9,'Teaching','1999-08-22',NULL,NULL,'Active','','','','',NULL,NULL,'2026-02-24 08:54:18','2026-03-14 04:48:05',NULL),(574,'10126','Dr','Balachandra Mohan','J','Male','balachandramohan@ksrct.ac.in','+919445160343',NULL,NULL,9,NULL,9,'Teaching','1980-05-16',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(575,'2330308','Ms','Savitha Sangami','K','Male','savithasangamik@ksrct.ac.in','+918012962464',NULL,NULL,9,NULL,9,'Teaching','2001-05-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(576,'10135','Ms','Swathy','T','Female','swathyt@ksrct.ac.in','+918248237589',NULL,NULL,9,NULL,9,'Teaching','1998-10-31',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(577,'2330144','Ms','Dhivya','V P','Female','dhivyavp@ksrct.ac.in','+919443696777',NULL,NULL,10,NULL,10,'Teaching','1981-09-29',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(578,'2330136','Ms','Geetha','S','Female','geethas@ksrct.ac.in','+916369000175',NULL,NULL,10,NULL,10,'Teaching','1992-12-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(579,'10143','Ms','Keerthana','P','Female','keerthanap@ksrct.ac.in','+919677805384',NULL,NULL,10,NULL,10,'Teaching','1994-04-05',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(580,'2330131','Ms','Sathiyapriya','N','Female','sathiyapriyan@ksrct.ac.in','+919942761818',NULL,NULL,10,NULL,10,'Teaching','1988-01-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(581,'2310068','Mr','Manoj Kumar','T','Male','manojkumart@ksrct.ac.in','+918056469500',NULL,NULL,35,NULL,11,'Teaching','1991-02-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(582,'2330310','Mr','Jeeva','N','Male','jeevan@ksrct.ac.in','+918098050814',NULL,NULL,36,NULL,36,'Teaching','1999-10-18',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(583,'2330315','Mr','Arulnandhisivam','S','Male','arulnandhisivams@ksrct.ac.in','+917094368434',NULL,NULL,16,NULL,16,'Teaching','1993-07-16',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(584,'10459','Ms','Manjari','M','Female','manjarim@ksrct.ac.in','+917010039749',NULL,NULL,16,NULL,16,'Teaching','1998-12-09',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(585,'10453','Dr','Sutha','S','Female','suthas@ksrct.ac.in','+919443324103',NULL,NULL,17,NULL,17,'Teaching','1981-05-11',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(586,'2330190','Dr','Sundararaju','V','Male','sundararaju@ksrct.ac.in','+919843324025',NULL,NULL,11,NULL,11,'Teaching','1949-07-08',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(587,'2330219','Dr','Karthik','A','Male','karthik@ksrct.ac.in','+919789111450',NULL,NULL,15,NULL,15,'Teaching','1985-05-15',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 08:57:23',NULL),(588,'2330307','Dr','Devarajan','V P','Male','devarajanvp@ksrct.ac.in','+918428837932',NULL,NULL,39,NULL,39,'Teaching','1984-02-22',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(589,'2330302','Mr','Nithiyanantham','U','Male','nithiyananthamu@ksrct.ac.in','+917604801885',NULL,NULL,39,NULL,39,'Teaching','1990-01-01',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(590,'2330226','Mr','Saravanan','S P','Male','saravanansp@ksrct.ac.in','+919994228580',NULL,NULL,40,NULL,17,'Teaching','1983-07-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(591,'2330246','Ms','Kiruthika','S','Female','kiruthikas@ksrct.ac.in','+919698699928',NULL,NULL,43,NULL,43,'Teaching','1995-01-04',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(592,'2330280','Ms','Narmatha','P','Other','narmatha@ksrct.ac.in',NULL,NULL,NULL,43,NULL,43,'Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(593,'2330247','Ms','Sathya','S','Female','sathya@ksrct.ac.in','+917708416977',NULL,NULL,43,NULL,43,'Teaching','1994-07-02',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(594,'10236','Ms','Dhanapriya','G','Female','dhanapriya@ksrct.ac.in','+919360422216',NULL,NULL,45,NULL,45,'Teaching','1989-10-30',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(595,'2330228','Mr','Maheswaran','P','Male','pmaheswaran@ksrct.ac.in','+919600589068',NULL,NULL,45,NULL,45,'Teaching','1988-06-21',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(596,'2310140','Mr','Sakthivel','V','Male','sakthivelv@ksrct.ac.in','+919791262320',NULL,NULL,45,NULL,45,'Teaching','1983-05-13',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(597,'2330161','Ms','Sripadma','S','Female','sripadma@ksrct.ac.in','+919865690200',NULL,NULL,45,NULL,36,'Teaching','1984-02-28',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(598,'10457','Ms','Arulpriya','S','Female','arulpriyas@ksrct.ac.in','+919943440403',NULL,NULL,46,NULL,46,'Teaching','1986-05-03',NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-02-24 08:54:18','2026-02-24 12:33:20',NULL),(599,'1222222','Mr.','keerthana','s','Female','keerthan@gmail.com','a2131241',NULL,NULL,NULL,64,NULL,'Teaching',NULL,NULL,NULL,'Active',NULL,NULL,NULL,NULL,NULL,NULL,'2026-03-16 06:21:27','2026-03-16 06:21:27',NULL);
/*!40000 ALTER TABLE `master_employees` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entities`
--

LOCK TABLES `master_entities` WRITE;
/*!40000 ALTER TABLE `master_entities` DISABLE KEYS */;
INSERT INTO `master_entities` VALUES (1,2,'IIC','Institutions Innovation Council',1,1,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(2,2,'IPR','Intellectual Property Rights Cell',1,2,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(3,2,'CON','Consultancy',1,3,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(4,2,'EDC','Entrepreneurship Development Cell',1,4,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(5,2,'HEC','Higher Education Cell',1,5,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(6,2,'ALM','Alumni Cell',1,6,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(7,2,'NCCAR','National Cadet Corps (NCC) Army Wing',1,7,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(8,2,'NCCAI','National Cadet Corps (NCC) Air Wing',1,8,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(9,2,'NSS','National Service Scheme (NSS)',1,9,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(10,2,'YRC','Youth Red Cross (YRC)',1,10,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(11,2,'RRC','Red Ribbon Club (RRC)',1,11,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(12,2,'UBA','Unnat Bharat Abhiyan (UBA)',1,12,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(13,2,'AUT','Autonomous',1,13,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(14,2,'IQAC','Internal Quality Assurance Cell',1,14,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(15,2,'TRA','Training',1,15,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(16,2,'PLC','Placement',1,16,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(17,2,'EXC','Exam Cell',1,17,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(18,2,'ADM','Admission',1,18,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(19,2,'NPT','NPTEL',1,19,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(20,2,'WEC','Women Empowerment Cell',1,20,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(21,2,'PAM','Press & Media',1,21,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(22,1,'CFRD','Centre for Research & Development',1,1,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(23,1,'CSDG','Centre for Sustainable Development Goals',1,2,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(24,1,'CSD','Centre for Skill Development',1,3,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(25,1,'IDEA','AICTE IDEA Lab',1,4,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(26,1,'CGA','Career Guidance Academy',1,5,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(27,1,'CSA','Centre for Student Affairs',1,6,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(28,1,'CIT','Centre for IT Infrastructure',1,7,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(29,1,'MSME','KSRCT MSME Business Incubator',1,8,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(30,1,'ACIC','KSRCT ACIC Incubation Foundation',1,9,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(31,3,'CUL','Cultural Club',1,1,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(32,3,'RDR','Readers Club',1,2,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(33,3,'NDLI','NDLI Club',1,3,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(34,3,'SMV','Service Motto Volunteers',1,4,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(35,3,'LIFX','LifX Club',1,5,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(36,3,'BULD','Build Club',1,6,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(37,3,'ECO','Eco Care Club',0,7,'2026-02-17 15:13:38','2026-03-03 06:36:13'),(38,3,'DRO','Drone Club',1,8,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(39,3,NULL,'Neomutant Association',1,9,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(40,3,'PAC','PAC PMC Club',1,10,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(41,3,'TMA','Tamil Mandram',1,11,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(42,3,'YI','Young Indians',1,12,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(43,3,'RTC','Rotaract Club',1,13,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(44,4,'ICTA','ICT Academy',1,1,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(45,4,'ISTE','Indian Society for Technical Education',1,2,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(46,4,'IEI','The Institution of Engineers (India)',1,3,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(47,4,'IEEE','Institute of Electrical and Electronics Engineers',1,4,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(48,4,'IETE','Institution of Electronics and Telecommunication Engineers',1,5,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(49,4,'IWS','Indian Welding Society',1,6,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(50,4,'ASME','American Society of Mechanical Engineers',1,7,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(51,4,'SAE','SAE Collegiate Club',1,8,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(52,4,'TAI','Textile Association of India',1,9,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(53,4,'MMA','Madras Management Association',1,10,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(54,4,'IEEEEM','IEEE Engineering in Medicine and Biology Society',1,11,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(55,4,'CII','Confederation of Indian Industry',1,12,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(56,4,'ICI','Indian Concrete Institute',1,13,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(57,4,'IGS','Indian Geotechnical Society',1,14,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(58,4,'AFST','Association of Food Scientist & Technologists (India)',1,15,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(59,4,'MBS','Microbiologists Society, India',1,16,'2026-02-17 15:13:38','2026-02-26 17:48:57'),(60,4,NULL,'The Indian Society of Heating, Refrigerating and Air Conditioning Engineers (ISHRAE)',1,17,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(61,4,NULL,'The Indian Institute of Welding (IIW - India)',1,18,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(62,4,NULL,'The Institute of Indian Foundrymen (IIF)',1,19,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(63,2,'OPC','Overall Project Coordination',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(64,1,'CFRD','Centre for Research and Development',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(65,1,'NICE','National Instruments Centre of Excellence',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(66,3,'MLC','Movie & Literary Club',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(67,3,'CDC','Coders Club',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(68,4,'ISHRAE','The Indian Society of Heating, Refrigerating and Air Conditioning Engineers',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(69,4,'IIW','The Indian Institute of Welding',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(70,4,'IIF','The Institute of Indian Foundrymen',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(71,4,'ASMESS','American Society of Mechanical Engineers (Student Chapter)',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(72,4,'SALIS','Society for the Advancement of Library and Information Science',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(73,4,'ESF','Erode Salaram Foundation',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(74,4,'LLAEN','Local Library Authority, Erode & Namakkal',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(75,4,'CSI','Computer Society of India',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(76,4,'TRS','The Robotics Society',1,0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(77,1,'coo','as',1,0,'2026-03-12 09:49:21','2026-03-12 09:49:21'),(78,5,'sat','Section-state',1,0,'2026-04-11 11:20:14','2026-04-11 11:20:14');
/*!40000 ALTER TABLE `master_entities` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entity_contacts`
--

LOCK TABLES `master_entity_contacts` WRITE;
/*!40000 ALTER TABLE `master_entity_contacts` DISABLE KEYS */;
INSERT INTO `master_entity_contacts` VALUES (3,22,'office','headcfrd@ksrct.ac.in',1,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(26,1,'office','maheshwaran3253@gmail.com',1,'2026-02-26 17:48:57','2026-02-27 15:38:12'),(27,2,'office','iprpolicy@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(28,3,'office','consultancy@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(29,4,'office','edc@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(30,5,'office','hec@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(31,6,'office','alumni@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(32,7,'office','nccarmy@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(33,8,'office','nccairwing@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(34,9,'office','nss@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(35,10,'office','yrc@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(36,11,'office','rrc@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(37,12,'office','uba@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(38,13,'office','autonomous@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(39,14,'office','iqac@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(40,15,'office','training@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(41,16,'office','placement@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(42,17,'office','examcell@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(43,18,'office','admission@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(44,19,'office','spocnptel@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(45,20,'office','wec@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(46,21,'office','press@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(47,63,'office','opc@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(48,64,'office','headcfrd@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(49,23,'office','sdg@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(50,24,'office','csd@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(51,25,'office','idealab@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(52,26,'office','cga@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(53,27,'office','csa@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(54,28,'office','directoritim@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(55,29,'office','msme@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(56,30,'office','acic@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(57,65,'office','nice@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(58,31,'office','culturalclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(59,32,'office','readersclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(60,33,'office','ndliclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(61,34,'office','smvolunteers@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(62,35,'office','lifxclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(63,36,'office','buildclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(64,37,'office','ecocareclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(65,38,'office','droneclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(66,40,'office','pacpmc@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(67,41,'office','tamilmandram@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(68,42,'office','youngindians@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(69,43,'office','rotractclub@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(70,66,'office','library@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(71,67,'office','karthickj@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(72,44,'office','ictacademy@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(73,45,'office','iste@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(74,46,'office','iei@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(75,47,'office','ieee@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(76,48,'office','iete@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(77,49,'office','iws@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(78,50,'office','asme@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(79,51,'office','sae@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(80,52,'office','tai@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(81,53,'office','mma@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(82,54,'office','ieeeembs@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(83,55,'office','cii@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(84,56,'office','ici@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(85,57,'office','igs@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(86,58,'office','afst@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(87,59,'office','mbs@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(88,68,'office','ishrae@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(89,69,'office','iiw@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(90,70,'office','iif@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(91,71,'office','asmess@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(92,72,'office','library@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(93,73,'office','library@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(94,74,'office','library@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(95,75,'office','office@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(96,75,'office','dineshkumarrt@ksrct.ac.in',0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(97,76,'office','indumathi@ksrct.ac.in',1,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(98,76,'office','sasikumarm@ksrct.ac.in',0,'2026-02-26 17:48:57','2026-02-26 17:48:57'),(99,77,'office','Mom@gmai.com',1,'2026-03-12 09:49:21','2026-03-12 09:49:21');
/*!40000 ALTER TABLE `master_entity_contacts` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `master_entity_types`
--

LOCK TABLES `master_entity_types` WRITE;
/*!40000 ALTER TABLE `master_entity_types` DISABLE KEYS */;
INSERT INTO `master_entity_types` VALUES (1,'CENTRE','Centre',1,1,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(2,'CELL','Cell',1,2,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(3,'CLUB','Club',1,3,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(4,'PROFESSIONAL_BODY','Professional Body',1,4,'2026-02-17 15:13:38','2026-02-17 15:13:38'),(5,'SECTION','Section',1,100,'2026-04-11 11:02:19','2026-04-11 11:02:19');
/*!40000 ALTER TABLE `master_entity_types` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=11441 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'admin_dashboard','read','admin_dashboard.read','View admin dashboard data',1,'2026-02-06 13:11:12'),(2,'admin_dashboard','edit','admin_dashboard.edit','Edit admin-managed records',1,'2026-02-06 13:11:12'),(3,'admin_dashboard','approve','admin_dashboard.approve','Approve and reject admin workflows',1,'2026-02-06 13:11:12'),(4,'admin_dashboard','manage','admin_dashboard.manage','Full admin dashboard access',1,'2026-02-06 13:11:12'),(5,'form_options','read','form_options.read','View form option masters',1,'2026-02-06 13:11:12'),(6,'form_options','edit','form_options.edit','Create and update form options',1,'2026-02-06 13:11:12'),(7,'form_options','manage','form_options.manage','Full control over form options',1,'2026-02-06 13:11:12'),(8,'finance','read','finance.read','View finance requests',1,'2026-02-06 13:11:12'),(9,'finance','edit','finance.edit','Edit finance requests',1,'2026-02-06 13:11:12'),(10,'finance','approve','finance.approve','Approve finance requests',1,'2026-02-06 13:11:12'),(11,'publications','read','publications.read','View publication records',1,'2026-02-06 13:11:12'),(12,'publications','edit','publications.edit','Edit publication records',1,'2026-02-06 13:11:12'),(13,'projects','read','projects.read','View project records',1,'2026-02-06 13:11:12'),(14,'projects','edit','projects.edit','Edit project records',1,'2026-02-06 13:11:12'),(15,'events','read','events.read','View events',1,'2026-02-06 13:11:12'),(16,'events','edit','events.edit','Create and edit events',1,'2026-02-06 13:11:12'),(17,'reports','read','reports.read','View reports',1,'2026-02-06 13:11:12'),(18,'reports','manage','reports.manage','Manage report access and exports',1,'2026-02-06 13:11:12'),(19,'access_control','read','access_control.read','View roles and permissions',1,'2026-02-06 13:11:12'),(20,'access_control','manage','access_control.manage','Create roles and assign access',1,'2026-02-06 13:11:12'),(29,'budget_proposal','manage','budget.proposal.manage','Create, edit, delete, and view own budget proposals',1,'2026-02-17 13:59:38'),(31,'budget_workflow','dof','budget.workflow.dof','View DoF queue and process DoF-stage approvals',1,'2026-02-17 13:59:39'),(32,'budget_workflow','principal','budget.workflow.principal','View Principal queue and process Principal-stage approvals',1,'2026-02-17 13:59:39'),(33,'budget_admin','view','budget.admin.view','View budget admin dashboards, reports, and exports',1,'2026-02-17 13:59:39'),(34,'budget_admin','manage','budget.admin.manage','Manage budget approval configuration and entity masters',1,'2026-02-17 13:59:39'),(1510,'budget_workflow','level1','budget.workflow.level1','View Level-1 queue and process HOD/Coordinator approvals',1,'2026-02-26 17:23:24'),(5688,'budget_workflow','ithead','budget.workflow.ithead','View IT Head queue and process IT Head-stage approvals',1,'2026-03-12 08:10:18'),(6573,'finance_workflow','level1','finance.workflow.level1','Process finance Level-1 approvals',1,'2026-03-23 05:40:53'),(6574,'finance_workflow','dof','finance.workflow.dof','Process finance DoF-stage approvals',1,'2026-03-23 05:40:53'),(6575,'finance_workflow','principal','finance.workflow.principal','Process finance Principal-stage approvals',1,'2026-03-23 05:40:53'),(6895,'budget_workflow','manage','budget.workflow.manage','Manage Budget workflow access',1,'2026-03-23 06:26:45'),(6897,'finance_workflow','manage','finance.workflow.manage','Manage Finance workflow access',1,'2026-03-23 06:26:46'),(10984,'expenditure_workflow','level1','expenditure.workflow.level1','Process expenditure Level-1 approvals',1,'2026-04-30 16:54:42'),(10985,'expenditure_workflow','dof','expenditure.workflow.dof','Process expenditure DoF-stage approvals',1,'2026-04-30 16:54:42'),(10986,'expenditure_workflow','principal','expenditure.workflow.principal','Process expenditure Principal-stage approvals',1,'2026-04-30 16:54:42'),(11017,'finance_workflow','chairman','finance.workflow.chairman','Process finance Chairman-stage approvals',1,'2026-05-03 08:42:27');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_agency_options`
--

DROP TABLE IF EXISTS `project_agency_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_agency_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_agency_options`
--

LOCK TABLES `project_agency_options` WRITE;
/*!40000 ALTER TABLE `project_agency_options` DISABLE KEYS */;
INSERT INTO `project_agency_options` VALUES (1,'New Salem Agency','2024-12-22 12:34:15','2024-12-22 12:34:15'),(2,'dsj','2025-01-20 17:06:36','2025-01-20 17:06:36');
/*!40000 ALTER TABLE `project_agency_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_agency_type_options`
--

DROP TABLE IF EXISTS `project_agency_type_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_agency_type_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_agency_type_options`
--

LOCK TABLES `project_agency_type_options` WRITE;
/*!40000 ALTER TABLE `project_agency_type_options` DISABLE KEYS */;
INSERT INTO `project_agency_type_options` VALUES (1,'New','2024-12-22 12:33:52','2024-12-22 12:33:52'),(2,'Koll','2025-01-05 13:33:13','2025-01-21 12:51:35'),(3,'asd','2025-02-27 13:48:21','2025-02-27 13:48:21'),(4,'k','2025-02-28 17:36:54','2025-02-28 17:36:54'),(5,'Agerncy','2025-03-24 05:04:10','2025-03-24 05:04:10'),(6,'Type','2025-03-24 10:23:02','2025-03-24 10:23:02'),(7,'Gency','2025-04-04 06:26:44','2025-04-04 06:26:44'),(8,'1','2025-04-06 15:12:31','2025-04-06 15:12:31'),(9,'NEW AGENCY','2025-08-05 13:47:42','2025-08-05 13:47:42');
/*!40000 ALTER TABLE `project_agency_type_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_collaborations`
--

DROP TABLE IF EXISTS `project_collaborations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_collaborations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `partner` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `support` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_collaborations_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_collaborations`
--

LOCK TABLES `project_collaborations` WRITE;
/*!40000 ALTER TABLE `project_collaborations` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_collaborations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_details`
--

DROP TABLE IF EXISTS `project_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `date_of_presentation` date DEFAULT NULL,
  `date_of_result_announcement` date DEFAULT NULL,
  `sanction_order_amount` decimal(15,2) DEFAULT NULL,
  `sanction_order_date` date DEFAULT NULL,
  `project_duration_start_date` date DEFAULT NULL,
  `project_duration_end_date` date DEFAULT NULL,
  `outcome_type` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_details_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_details`
--

LOCK TABLES `project_details` WRITE;
/*!40000 ALTER TABLE `project_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `document_type` enum('sanctionOrder','utilizationCertificate','statementOfExpenditure','projectReport','bankStatement','sanctionLetter','ucAndSoe') DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_documents`
--

LOCK TABLES `project_documents` WRITE;
/*!40000 ALTER TABLE `project_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_financial_contributions`
--

DROP TABLE IF EXISTS `project_financial_contributions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_financial_contributions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `agency` varchar(255) DEFAULT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `agency_type_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `fk_agency_type_id` (`agency_type_id`),
  CONSTRAINT `fk_agency_type_id` FOREIGN KEY (`agency_type_id`) REFERENCES `project_agency_type_options` (`id`),
  CONSTRAINT `project_financial_contributions_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_financial_contributions`
--

LOCK TABLES `project_financial_contributions` WRITE;
/*!40000 ALTER TABLE `project_financial_contributions` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_financial_contributions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_grant_disbursements`
--

DROP TABLE IF EXISTS `project_grant_disbursements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_grant_disbursements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `fiscal_year` varchar(10) DEFAULT NULL,
  `agency` varchar(255) DEFAULT NULL,
  `amount` decimal(15,2) DEFAULT NULL,
  `disbursement_date` date DEFAULT NULL,
  `sanction_letter_path` varchar(255) DEFAULT NULL,
  `uc_and_soe_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_project_disbursement` (`project_id`,`fiscal_year`,`agency`,`amount`,`disbursement_date`),
  CONSTRAINT `project_grant_disbursements_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `research_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_grant_disbursements`
--

LOCK TABLES `project_grant_disbursements` WRITE;
/*!40000 ALTER TABLE `project_grant_disbursements` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_grant_disbursements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_requests`
--

DROP TABLE IF EXISTS `project_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `request_type` enum('agency','scheme','agency_type') NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `admin_comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_request_type` (`request_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `project_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_requests`
--

LOCK TABLES `project_requests` WRITE;
/*!40000 ALTER TABLE `project_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `project_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_scheme_options`
--

DROP TABLE IF EXISTS `project_scheme_options`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_scheme_options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_scheme_options`
--

LOCK TABLES `project_scheme_options` WRITE;
/*!40000 ALTER TABLE `project_scheme_options` DISABLE KEYS */;
INSERT INTO `project_scheme_options` VALUES (1,'First Schema','2024-12-22 12:34:07','2024-12-22 12:34:07'),(3,'1','2025-02-02 11:41:21','2025-02-02 11:41:21'),(4,'SCHEMa','2025-08-05 13:41:56','2025-08-05 13:41:56');
/*!40000 ALTER TABLE `project_scheme_options` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `research_projects`
--

DROP TABLE IF EXISTS `research_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `research_projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_category` varchar(50) NOT NULL,
  `category` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `duration_years` int DEFAULT NULL,
  `duration_months` int DEFAULT NULL,
  `duration_days` int DEFAULT NULL,
  `date_of_submission` date DEFAULT NULL,
  `submission_status` varchar(50) DEFAULT 'waiting',
  `is_collaboration_enabled` tinyint(1) DEFAULT '0',
  `file_path` varchar(255) DEFAULT NULL,
  `application_number` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `agency_id` int DEFAULT NULL,
  `scheme_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_agency_id` (`agency_id`),
  KEY `fk_scheme_id` (`scheme_id`),
  CONSTRAINT `fk_agency_id` FOREIGN KEY (`agency_id`) REFERENCES `project_agency_options` (`id`),
  CONSTRAINT `fk_scheme_id` FOREIGN KEY (`scheme_id`) REFERENCES `project_scheme_options` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `research_projects`
--

LOCK TABLES `research_projects` WRITE;
/*!40000 ALTER TABLE `research_projects` DISABLE KEYS */;
/*!40000 ALTER TABLE `research_projects` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1,'2026-02-06 13:11:12'),(1,2,'2026-02-06 13:11:12'),(1,3,'2026-02-06 13:11:12'),(1,4,'2026-02-06 13:11:12'),(1,5,'2026-02-06 13:11:12'),(1,6,'2026-02-06 13:11:12'),(1,7,'2026-02-06 13:11:12'),(1,8,'2026-02-06 13:11:12'),(1,9,'2026-02-06 13:11:12'),(1,10,'2026-02-06 13:11:12'),(1,11,'2026-02-06 13:11:12'),(1,12,'2026-02-06 13:11:12'),(1,13,'2026-02-06 13:11:12'),(1,14,'2026-02-06 13:11:12'),(1,15,'2026-02-06 13:11:12'),(1,16,'2026-02-06 13:11:12'),(1,17,'2026-02-06 13:11:12'),(1,18,'2026-02-06 13:11:12'),(1,19,'2026-02-06 13:11:12'),(1,20,'2026-02-06 13:11:12'),(1,29,'2026-02-17 15:15:12'),(1,31,'2026-02-17 15:15:12'),(1,32,'2026-02-17 15:15:12'),(1,33,'2026-02-17 15:15:12'),(1,34,'2026-02-17 15:15:12'),(1,1510,'2026-02-17 15:15:12'),(1,5688,'2026-03-12 08:10:19'),(1,6573,'2026-03-23 05:40:53'),(1,6574,'2026-03-23 05:40:53'),(1,6575,'2026-03-23 05:40:53'),(1,11017,'2026-05-03 08:42:27'),(2,1,'2026-02-06 13:11:12'),(2,2,'2026-02-06 13:11:12'),(2,3,'2026-02-06 13:11:12'),(2,5,'2026-02-06 13:11:12'),(2,6,'2026-02-06 13:11:12'),(2,11,'2026-02-06 13:11:12'),(2,13,'2026-02-06 13:11:12'),(2,15,'2026-02-06 13:11:12'),(2,17,'2026-02-06 13:11:12'),(2,19,'2026-02-17 15:14:50'),(2,20,'2026-02-17 15:14:50'),(2,29,'2026-02-17 15:15:12'),(2,33,'2026-02-17 15:15:12'),(2,34,'2026-02-17 15:15:12'),(3,1,'2026-02-06 13:11:12'),(3,11,'2026-02-06 13:11:12'),(3,12,'2026-02-06 13:11:12'),(3,13,'2026-02-06 13:11:12'),(3,14,'2026-02-06 13:11:12'),(3,17,'2026-02-06 13:11:12'),(3,29,'2026-02-17 15:15:12'),(3,1510,'2026-02-17 15:15:12'),(3,6573,'2026-03-23 05:40:53'),(4,1,'2026-02-28 05:21:23'),(4,8,'2026-02-28 05:21:23'),(4,9,'2026-02-28 05:21:23'),(4,10,'2026-02-28 05:21:23'),(4,17,'2026-02-28 05:21:23'),(4,31,'2026-02-28 05:21:23'),(4,6574,'2026-03-23 05:40:53'),(5,1,'2026-02-06 13:11:12'),(5,3,'2026-02-06 13:11:12'),(5,8,'2026-02-06 13:11:12'),(5,11,'2026-02-06 13:11:12'),(5,13,'2026-02-06 13:11:12'),(5,17,'2026-02-06 13:11:12'),(5,32,'2026-02-17 15:15:12'),(5,33,'2026-02-17 15:15:12'),(5,34,'2026-02-17 15:15:12'),(5,6575,'2026-03-23 05:40:53'),(13,1,'2026-02-27 19:17:17'),(13,17,'2026-02-27 19:17:17'),(13,29,'2026-02-27 19:17:17'),(13,1510,'2026-02-27 19:17:17'),(13,6573,'2026-04-01 15:46:33'),(14,29,'2026-03-12 08:10:19'),(14,5688,'2026-03-12 08:10:19');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=2271 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'super_admin','Super Admin','Global access to all modules and access control',1,1,'2026-02-06 13:11:12','2026-02-06 13:11:12'),(2,'admin','Admin','Standard admin access for current dashboard workflows',1,1,'2026-02-06 13:11:12','2026-02-06 13:11:12'),(3,'hod','Head of Department','Department-level review and approval role',1,1,'2026-02-06 13:11:12','2026-02-06 13:11:12'),(4,'finance_admin','Finance Admin','Finance-focused workflow access',1,1,'2026-02-06 13:11:12','2026-02-06 13:11:12'),(5,'principal','Principal','Institute-level review and approval role',1,1,'2026-02-06 13:11:12','2026-02-06 13:11:12'),(13,'coordinator','Coordinator','Generic role for club, cell, and center coordinators',1,1,'2026-02-27 18:46:09','2026-02-27 18:46:09'),(14,'it_head','IT Head','Head of IT Department – approves IT-tagged budget proposals',0,1,'2026-03-12 08:10:19','2026-03-12 08:10:19'),(15,'user','User','Base role assigned to all authenticated users',1,0,'2026-05-03 08:42:35','2026-05-03 08:42:35'),(38,'chairman','Chairman','Finance chairman-stage approver role',1,1,'2026-05-03 08:47:26','2026-05-03 08:47:26');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

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
  `entity_type` enum('DEPARTMENT','CENTRE','CELL','CLUB','PROFESSIONAL_BODY') COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_entity_role` (`user_id`,`entity_id`,`entity_type`,`role_id`),
  KEY `fk_uer_role` (`role_id`),
  CONSTRAINT `fk_uer_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_uer_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_entity_roles`
--

LOCK TABLES `user_entity_roles` WRITE;
/*!40000 ALTER TABLE `user_entity_roles` DISABLE KEYS */;
INSERT INTO `user_entity_roles` VALUES (17,2,2,'DEPARTMENT',3,'2026-03-23 06:36:10','2026-03-23 06:36:10');
/*!40000 ALTER TABLE `user_entity_roles` ENABLE KEYS */;
UNLOCK TABLES;

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

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,NULL,'2026-02-06 13:11:12'),(1,15,NULL,'2026-05-03 08:42:35'),(2,15,NULL,'2026-05-03 08:42:35'),(3,4,1,'2026-04-13 05:15:45'),(3,14,1,'2026-04-13 05:15:45'),(3,15,NULL,'2026-05-03 08:42:35'),(4,5,1,'2026-05-20 06:54:24'),(4,15,1,'2026-05-20 06:54:24'),(4,38,1,'2026-05-20 06:54:24'),(5,15,NULL,'2026-05-07 17:47:55');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'maverickmyth333@gmail.com','Maverick','https://lh3.googleusercontent.com/a/ACg8ocI2OH7zkLRTjrHISc-UBxmeidCElHSlWN74yFCo03s-9Hiecfy7=s96-c',0,'2026-01-31 06:27:47',NULL),(2,'maheshwaran325@gmail.com','Maheshwaran A K','https://lh3.googleusercontent.com/a/ACg8ocI3s9aKpet0FoIojcVmQo5GToY0L2oHF4zwIXiKZcltqPsaOz3Z4A=s96-c',0,'2026-02-19 09:36:08',NULL),(3,'gingfreecss325@gmail.com','Ging Freecss','https://lh3.googleusercontent.com/a/ACg8ocLza7_Kha438C2ne7XH06bAmW_gQQLwCfZDOqJsfu-n_Mg24A=s96-c',1,'2026-02-24 09:12:44',NULL),(4,'maheshwaran3253@gmail.com','Maheshwaran','https://lh3.googleusercontent.com/a/ACg8ocKh6PeOIiVqwZJeJMy0ans5upRgJ5uXdAojcAJ-AZYYdDFzcA=s96-c',1,'2026-02-25 15:17:24',NULL),(5,'cfrd@ksrct.ac.in','CFRD KSRCT','https://lh3.googleusercontent.com/a/ACg8ocKgjSEpLAib5D3olsTYPQ6BRXCy1BwLlB8EgueS-7ECaN-_hA=s96-c',0,'2026-05-07 17:47:55',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_actions`
--

LOCK TABLES `workflow_actions` WRITE;
/*!40000 ALTER TABLE `workflow_actions` DISABLE KEYS */;
INSERT INTO `workflow_actions` VALUES (1,'finance',1,'level1','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-01 16:03:53','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-01T15:47:12.134Z\", \"updatedAt\": \"2026-04-01T15:47:12.134Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(2,'finance',1,'dof','returned','redo',1,'maverickmyth333@gmail.com','super_admin','2026-04-01 16:04:08','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-01T15:47:12.134Z\", \"updatedAt\": \"2026-04-01T16:03:53.473Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(3,'finance',1,'level1','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-01 16:04:40','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-01T16:04:30.810Z\", \"updatedAt\": \"2026-04-01T16:04:30.811Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-01T16:04:30.811Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(4,'finance',1,'dof','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-01 16:06:34','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-01T16:04:30.810Z\", \"updatedAt\": \"2026-04-01T16:04:40.490Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-01T16:04:30.811Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(5,'finance',1,'principal','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-01 16:06:47','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-01T16:04:30.810Z\", \"updatedAt\": \"2026-04-01T16:06:34.438Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-01T16:04:30.811Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(6,'finance',2,'level1','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-04 06:16:17','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-04T06:15:38.608Z\", \"updatedAt\": \"2026-04-04T06:15:38.608Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(7,'finance',2,'dof','returned','Head change',1,'maverickmyth333@gmail.com','super_admin','2026-04-04 06:16:28','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-04T06:15:38.608Z\", \"updatedAt\": \"2026-04-04T06:16:17.439Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(8,'finance',2,'level1','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-04 06:17:19','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-04T06:16:54.981Z\", \"updatedAt\": \"2026-04-04T06:16:54.983Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-04T06:16:54.983Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(9,'finance',2,'dof','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-04 06:17:23','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-04T06:16:54.981Z\", \"updatedAt\": \"2026-04-04T06:17:19.171Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-04T06:16:54.983Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(10,'finance',2,'principal','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-04 06:17:28','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-04T06:16:54.981Z\", \"updatedAt\": \"2026-04-04T06:17:23.738Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-04T06:16:54.983Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(11,'finance',3,'level1','approved',NULL,1,'maverickmyth333@gmail.com','super_admin','2026-04-11 12:02:36','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T11:59:38.860Z\", \"updatedAt\": \"2026-04-11T11:59:38.860Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(12,'finance',3,'dof','archived',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-11 12:13:53','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T11:59:38.860Z\", \"updatedAt\": \"2026-04-11T12:02:36.239Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/archive-toggle\"}, \"moduleMetaVersion\": 1}'),(13,'finance',3,'dof','returned','redo',3,'gingfreecss325@gmail.com','finance_admin','2026-04-11 12:14:37','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T11:59:38.860Z\", \"updatedAt\": \"2026-04-11T12:02:36.239Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(14,'finance',3,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-11 12:25:28','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:17:14.390Z\", \"updatedAt\": \"2026-04-11T12:17:14.393Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 122, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:17:14.393Z\", \"submittedTotalBudget\": 132, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(15,'finance',3,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-11 12:25:46','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:17:14.390Z\", \"updatedAt\": \"2026-04-11T12:25:28.132Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 122, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:17:14.393Z\", \"submittedTotalBudget\": 132, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(16,'finance',3,'principal','returned','redo',1,'maverickmyth333@gmail.com','super_admin','2026-04-11 12:38:34','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:17:14.390Z\", \"updatedAt\": \"2026-04-11T12:25:46.804Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 122, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:17:14.393Z\", \"submittedTotalBudget\": 132, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(17,'finance',1,'level1','deleted','Deleted by user',1,'maverickmyth333@gmail.com','super_admin','2026-04-12 13:08:36','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-01T16:04:30.810Z\", \"updatedAt\": \"2026-04-01T16:06:47.156Z\", \"resolvedAt\": \"2026-04-01T16:06:47.156Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-01T16:04:30.811Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"DELETE /api/finance-requests/:id\", \"trigger\": \"soft_delete\"}, \"moduleMetaVersion\": 1}'),(18,'finance',2,'level1','deleted','Deleted by user',1,'maverickmyth333@gmail.com','super_admin','2026-04-16 06:51:32','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-04T06:16:54.981Z\", \"updatedAt\": \"2026-04-04T06:17:28.375Z\", \"resolvedAt\": \"2026-04-04T06:17:28.375Z\", \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-04T06:16:54.983Z\", \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"DELETE /api/finance-requests/:id\", \"trigger\": \"soft_delete\"}, \"moduleMetaVersion\": 1}'),(19,'finance',3,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-16 11:42:00','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:39:46.586Z\", \"updatedAt\": \"2026-04-11T12:39:46.588Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 1200, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:39:46.588Z\", \"submittedTotalBudget\": 1210, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(20,'finance',3,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-16 12:00:00','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:39:46.586Z\", \"updatedAt\": \"2026-04-16T11:42:00.006Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 1200, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:39:46.588Z\", \"submittedTotalBudget\": 1210, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(21,'finance',3,'principal','returned','goo',1,'maverickmyth333@gmail.com','super_admin','2026-04-16 12:01:26','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-11T12:39:46.586Z\", \"updatedAt\": \"2026-04-16T12:00:00.057Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 1200, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-11T12:39:46.588Z\", \"submittedTotalBudget\": 1210, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(22,'finance',4,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-16 12:06:25','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-16T12:06:17.219Z\", \"updatedAt\": \"2026-04-16T12:06:17.219Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(23,'finance',4,'dof','returned','nop',3,'gingfreecss325@gmail.com','finance_admin','2026-04-16 12:07:31','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-16T12:06:17.219Z\", \"updatedAt\": \"2026-04-16T12:06:25.262Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(24,'finance',10,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 04:24:26','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T04:23:19.113Z\", \"updatedAt\": \"2026-04-27T04:23:19.113Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(25,'finance',10,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-27 04:24:32','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T04:23:19.113Z\", \"updatedAt\": \"2026-04-27T04:24:26.980Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(26,'finance',10,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','coordinator','2026-04-27 05:34:18','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T04:23:19.113Z\", \"updatedAt\": \"2026-04-27T04:24:32.004Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(27,'finance',11,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 07:25:17','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:25:12.598Z\", \"updatedAt\": \"2026-04-27T07:25:12.598Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(28,'finance',11,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-27 07:25:34','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:25:12.598Z\", \"updatedAt\": \"2026-04-27T07:25:17.636Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(29,'finance',11,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-04-27 07:25:57','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:25:12.598Z\", \"updatedAt\": \"2026-04-27T07:25:34.242Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(30,'finance',11,'null','returned','we',1,'maverickmyth333@gmail.com','super_admin','2026-04-27 07:26:42','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-27T07:25:12.598Z\", \"updatedAt\": \"2026-04-27T07:25:57.217Z\", \"resolvedAt\": \"2026-04-27T07:25:57.217Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\", \"trigger\": \"super_admin_forced_transition\"}, \"moduleMetaVersion\": 1}'),(31,'finance',11,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 07:36:19','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:36:02.152Z\", \"updatedAt\": \"2026-04-27T07:36:02.154Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-27T07:36:02.154Z\", \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(32,'finance',11,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-27 07:39:13','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:36:02.152Z\", \"updatedAt\": \"2026-04-27T07:36:19.734Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-27T07:36:02.154Z\", \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(33,'finance',11,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-04-27 07:42:21','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T07:36:02.152Z\", \"updatedAt\": \"2026-04-27T07:39:13.344Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-27T07:36:02.154Z\", \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(34,'finance',12,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 08:09:14','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T08:06:41.987Z\", \"updatedAt\": \"2026-04-27T08:06:41.987Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(35,'finance',12,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-27 08:09:32','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T08:06:41.987Z\", \"updatedAt\": \"2026-04-27T08:09:14.709Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(36,'finance',12,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-04-27 08:09:46','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T08:06:41.987Z\", \"updatedAt\": \"2026-04-27T08:09:32.750Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(37,'finance',9,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 08:16:19','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:40:07.807Z\", \"updatedAt\": \"2026-04-22T14:40:07.807Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(38,'finance',14,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-04-27 09:24:29','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T09:24:24.869Z\", \"updatedAt\": \"2026-04-27T09:24:24.869Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(39,'finance',14,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-04-27 09:24:38','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T09:24:24.869Z\", \"updatedAt\": \"2026-04-27T09:24:29.725Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(40,'finance',14,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-04-27 09:24:57','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T09:24:24.869Z\", \"updatedAt\": \"2026-04-27T09:24:38.933Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 11000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(41,'finance',17,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-02 16:46:55','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-02T16:46:08.634Z\", \"updatedAt\": \"2026-05-02T16:46:08.634Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 10, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(42,'finance',17,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-02 16:50:00','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-02T16:46:08.634Z\", \"updatedAt\": \"2026-05-02T16:46:55.965Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 10, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(43,'finance',9,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-02 16:50:05','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:40:07.807Z\", \"updatedAt\": \"2026-04-27T08:16:19.159Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(44,'finance',9,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-05-02 16:50:34','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-22T14:40:07.807Z\", \"updatedAt\": \"2026-05-02T16:50:05.273Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(45,'finance',16,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-04 12:43:02','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-28T10:34:07.873Z\", \"updatedAt\": \"2026-04-28T10:34:07.873Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(46,'finance',11,'null','returned','pojo',1,'maverickmyth333@gmail.com','super_admin','2026-05-04 12:47:38','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"completed\", \"version\": 1, \"startedAt\": \"2026-04-27T07:36:02.152Z\", \"updatedAt\": \"2026-04-27T07:42:21.494Z\", \"resolvedAt\": \"2026-04-27T07:42:21.494Z\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": null, \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-04-27T07:36:02.154Z\", \"submittedTotalBudget\": 12000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\", \"trigger\": \"super_admin_forced_transition\"}, \"moduleMetaVersion\": 1}'),(47,'finance',3,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-05-04 13:13:02','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"returned\", \"version\": 1, \"startedAt\": \"2026-04-11T12:39:46.586Z\", \"updatedAt\": \"2026-04-16T12:01:26.124Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": 1200, \"unplannedBudgetEnabled\": true}, \"currentStage\": \"principal\", \"lastDecision\": \"returned\", \"lastFeedback\": \"goo\", \"resubmittedAt\": \"2026-04-11T12:39:46.588Z\", \"submittedTotalBudget\": 1210, \"isEditableByApplicant\": true}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(48,'expenditure',1,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-06 10:40:33','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-02T14:17:58.446Z\", \"updatedAt\": \"2026-05-02T14:17:58.446Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"14-blank-1\", \"workflowrowref\": \"14-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(49,'finance',15,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-06 12:29:21','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-28T10:32:12.972Z\", \"updatedAt\": \"2026-04-28T10:32:12.972Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 120, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(50,'finance',16,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-06 12:29:34','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-28T10:34:07.873Z\", \"updatedAt\": \"2026-05-04T12:43:02.440Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(51,'finance',17,'principal','returned','sad',4,'maheshwaran3253@gmail.com','principal','2026-05-06 12:30:35','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-02T16:46:08.634Z\", \"updatedAt\": \"2026-05-02T16:50:00.590Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 10, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(52,'expenditure',1,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-06 17:18:39','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-02T14:17:58.446Z\", \"updatedAt\": \"2026-05-06T10:40:33.216Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"14-blank-1\", \"workflowrowref\": \"14-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(53,'expenditure',1,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','principal','2026-05-06 17:21:27','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-02T14:17:58.446Z\", \"updatedAt\": \"2026-05-06T17:18:39.951Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"14-blank-1\", \"workflowrowref\": \"14-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(54,'expenditure',10,'level1','returned','fok',1,'maverickmyth333@gmail.com','super_admin','2026-05-20 06:56:16','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-19T02:39:25.082Z\", \"updatedAt\": \"2026-05-19T02:39:25.082Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"3-blank-1\", \"workflowrowref\": \"3-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 500, \"workflowbudgetlineid\": 28, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 21}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(55,'expenditure',9,'level1','returned','fok',1,'maverickmyth333@gmail.com','super_admin','2026-05-20 06:56:24','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-13T02:34:46.087Z\", \"updatedAt\": \"2026-05-13T02:34:46.087Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"10-blank-1\", \"workflowrowref\": \"10-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 1000, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(56,'expenditure',8,'level1','returned','fok',1,'maverickmyth333@gmail.com','super_admin','2026-05-20 06:56:50','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Expenditure\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 2, \"startedAt\": \"2026-05-12T17:44:06.091Z\", \"updatedAt\": \"2026-05-12T17:44:06.091Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"12-manual-2\", \"workflowrowref\": \"12-expenditure-manual-2\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(57,'finance',18,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-20 07:00:12','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:00:01.677Z\", \"updatedAt\": \"2026-05-20T07:00:01.677Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 899, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(58,'finance',18,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-20 07:00:26','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:00:01.677Z\", \"updatedAt\": \"2026-05-20T07:00:12.606Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 899, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(59,'finance',18,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','chairman','2026-05-20 07:01:46','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:00:01.677Z\", \"updatedAt\": \"2026-05-20T07:00:26.954Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 899, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(60,'finance',19,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-20 07:12:57','{\"flow\": [\"level1\", \"dof\", \"principal\", \"chairman\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:12:50.298Z\", \"updatedAt\": \"2026-05-20T07:12:50.298Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 250000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(61,'finance',19,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-20 07:14:26','{\"flow\": [\"level1\", \"dof\", \"principal\", \"chairman\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:12:50.298Z\", \"updatedAt\": \"2026-05-20T07:12:57.724Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 250000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(62,'finance',19,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','chairman','2026-05-20 07:14:38','{\"flow\": [\"level1\", \"dof\", \"principal\", \"chairman\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:12:50.298Z\", \"updatedAt\": \"2026-05-20T07:14:26.408Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 250000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(63,'finance',16,'principal','approved',NULL,4,'maheshwaran3253@gmail.com','chairman','2026-05-20 07:27:16','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-28T10:34:07.873Z\", \"updatedAt\": \"2026-05-06T12:29:34.141Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 100, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(64,'finance',19,'chairman','approved',NULL,4,'maheshwaran3253@gmail.com','chairman','2026-05-20 07:30:24','{\"flow\": [\"level1\", \"dof\", \"principal\", \"chairman\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-20T07:12:50.298Z\", \"updatedAt\": \"2026-05-20T07:14:38.551Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"chairman\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"submittedTotalBudget\": 250000, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(65,'expenditure',7,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-21 17:37:35','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-12T17:43:24.267Z\", \"updatedAt\": \"2026-05-12T17:43:24.267Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"12-blank-1\", \"workflowrowref\": \"12-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(66,'expenditure',7,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-21 17:38:16','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-12T17:43:24.267Z\", \"updatedAt\": \"2026-05-21T17:37:35.638Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"12-blank-1\", \"workflowrowref\": \"12-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(67,'expenditure',7,'principal','approved','Auto-approved after DoF clearance',3,'system-auto@ksrct.ac.in','principal','2026-05-21 17:38:16','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-12T17:43:24.267Z\", \"updatedAt\": \"2026-05-21T17:38:16.680Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"12-blank-1\", \"workflowrowref\": \"12-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 100, \"workflowbudgetlineid\": 26, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 19}','{\"origin\": \"system\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\", \"trigger\": \"auto_principal_approval_after_dof\"}, \"moduleMetaVersion\": 1}'),(68,'expenditure',10,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-21 17:39:10','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:39:03.620Z\", \"updatedAt\": \"2026-05-21T17:39:03.624Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-05-21T17:39:03.624Z\", \"dashboardRowId\": \"3-blank-1\", \"workflowrowref\": \"3-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 500, \"workflowbudgetlineid\": 28, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 21}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(69,'expenditure',10,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-21 17:39:23','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:39:03.620Z\", \"updatedAt\": \"2026-05-21T17:39:10.412Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-05-21T17:39:03.624Z\", \"dashboardRowId\": \"3-blank-1\", \"workflowrowref\": \"3-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 500, \"workflowbudgetlineid\": 28, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 21}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(70,'expenditure',10,'principal','approved','Auto-approved after DoF clearance',3,'system-auto@ksrct.ac.in','principal','2026-05-21 17:39:23','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:39:03.620Z\", \"updatedAt\": \"2026-05-21T17:39:23.854Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-05-21T17:39:03.624Z\", \"dashboardRowId\": \"3-blank-1\", \"workflowrowref\": \"3-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 500, \"workflowbudgetlineid\": 28, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 21}','{\"origin\": \"system\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\", \"trigger\": \"auto_principal_approval_after_dof\"}, \"moduleMetaVersion\": 1}'),(71,'expenditure',11,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-21 17:41:36','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:41:29.541Z\", \"updatedAt\": \"2026-05-21T17:41:29.541Z\", \"resolvedAt\": null, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"dashboardRowId\": \"19-blank-1\", \"workflowrowref\": \"19-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 60000, \"workflowbudgetlineid\": 30, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 23}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(72,'expenditure',11,'dof','approved',NULL,3,'gingfreecss325@gmail.com','finance_admin','2026-05-21 17:41:49','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:41:29.541Z\", \"updatedAt\": \"2026-05-21T17:41:36.276Z\", \"resolvedAt\": null, \"currentStage\": \"dof\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"19-blank-1\", \"workflowrowref\": \"19-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 60000, \"workflowbudgetlineid\": 30, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 23}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(73,'expenditure',11,'principal','approved','Auto-approved after DoF clearance',3,'system-auto@ksrct.ac.in','principal','2026-05-21 17:41:49','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"module\": \"Advance\", \"status\": \"in_progress\", \"version\": 1, \"rowIndex\": 1, \"startedAt\": \"2026-05-21T17:41:29.541Z\", \"updatedAt\": \"2026-05-21T17:41:49.576Z\", \"resolvedAt\": null, \"currentStage\": \"principal\", \"lastDecision\": \"approved\", \"lastFeedback\": null, \"dashboardRowId\": \"19-blank-1\", \"workflowrowref\": \"19-advance-blank-1\", \"sourceRequestId\": null, \"submittedTotalBudget\": 60000, \"workflowbudgetlineid\": 30, \"isEditableByApplicant\": false, \"workflowbudgetproposalid\": 23}','{\"origin\": \"system\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/expenditure-requests/:id/approval\", \"trigger\": \"auto_principal_approval_after_dof\"}, \"moduleMetaVersion\": 1}'),(74,'finance',13,'level1','returned','re do',2,'maheshwaran325@gmail.com','hod','2026-05-27 17:16:20','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-04-27T08:16:41.765Z\", \"updatedAt\": \"2026-04-27T08:16:41.765Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": null, \"lastFeedback\": null, \"submittedTotalBudget\": 1, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}'),(75,'finance',17,'level1','resubmitted','CAnt do',2,'maheshwaran325@gmail.com','hod','2026-05-27 17:16:59','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"returned\", \"version\": 1, \"startedAt\": \"2026-05-02T16:46:08.634Z\", \"updatedAt\": \"2026-05-06T12:30:35.128Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"principal\", \"lastDecision\": \"returned\", \"lastFeedback\": \"sad\", \"submittedTotalBudget\": 10, \"isEditableByApplicant\": true}','{\"origin\": \"resubmit\", \"requestId\": null, \"moduleMeta\": {\"route\": \"POST /api/finance-requests/:id/resubmit\", \"trigger\": \"applicant_resubmit\", \"amountBand\": \"lte_10k\", \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false, \"unplannedBudgetDescription\": null}, \"beneficiaryType\": \"Department\"}, \"moduleMetaVersion\": 1}'),(76,'finance',17,'level1','approved',NULL,2,'maheshwaran325@gmail.com','hod','2026-05-27 17:19:33','{\"flow\": [\"level1\", \"dof\", \"principal\"], \"status\": \"in_progress\", \"version\": 1, \"startedAt\": \"2026-05-27T17:16:59.166Z\", \"updatedAt\": \"2026-05-27T17:16:59.167Z\", \"resolvedAt\": null, \"financeMeta\": {\"unplannedBudgetAmount\": null, \"unplannedBudgetEnabled\": false}, \"currentStage\": \"level1\", \"lastDecision\": \"resubmitted\", \"lastFeedback\": null, \"resubmittedAt\": \"2026-05-27T17:16:59.167Z\", \"submittedTotalBudget\": 10, \"isEditableByApplicant\": false}','{\"origin\": \"api\", \"requestId\": null, \"moduleMeta\": {\"route\": \"PATCH /api/finance-requests/:id/approval\"}, \"moduleMetaVersion\": 1}');
/*!40000 ALTER TABLE `workflow_actions` ENABLE KEYS */;
UNLOCK TABLES;

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
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workflow_stage_policies`
--

LOCK TABLES `workflow_stage_policies` WRITE;
/*!40000 ALTER TABLE `workflow_stage_policies` DISABLE KEYS */;
INSERT INTO `workflow_stage_policies` VALUES (1,'finance','level1','department','{\"requireAssignment\": false, \"assignmentRoleCodes\": [\"hod\", \"coordinator\", \"entity_approver\"]}',1,'2026-03-23 05:40:53','2026-04-01 15:46:33'),(2,'finance','dof','global',NULL,1,'2026-03-23 05:40:53','2026-04-01 15:45:50'),(3,'finance','principal','global',NULL,1,'2026-03-23 05:40:53','2026-04-01 15:45:50'),(11,'expenditure','level1','department','{\"requireAssignment\": false, \"assignmentRoleCodes\": [\"hod\", \"coordinator\", \"entity_approver\"]}',1,'2026-04-30 16:54:42','2026-04-30 16:54:42'),(12,'expenditure','dof','global',NULL,1,'2026-04-30 16:54:42','2026-04-30 16:54:42'),(13,'expenditure','principal','global',NULL,1,'2026-04-30 16:54:42','2026-04-30 16:54:42'),(14,'finance','chairman','global',NULL,1,'2026-05-03 08:42:27','2026-05-03 08:42:27');
/*!40000 ALTER TABLE `workflow_stage_policies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Current Database: `research`
--

USE `research`;

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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
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
/*!50013 DEFINER=`dev`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_finance_requests` AS select `fr`.`id` AS `id`,`fr`.`employee_id` AS `employee_id`,`fr`.`created_by` AS `created_by`,coalesce(concat(coalesce(`e`.`title`,''),' ',`e`.`first_name`,' ',coalesce(`e`.`last_name`,'')),`fr`.`applicant_name`) AS `applicant_name`,coalesce(`e`.`designation`,`fr`.`designation`) AS `designation`,coalesce(`d`.`name`,`fr`.`department`) AS `department`,coalesce(`e`.`email`,`fr`.`email`) AS `email`,coalesce(`e`.`mobile`,`fr`.`mobile`) AS `mobile`,`e`.`erp_id` AS `erp_id`,(case when (`fr`.`employee_id` is null) then 1 else 0 end) AS `is_external`,`fr`.`request_date` AS `request_date`,`fr`.`description` AS `description`,`fr`.`beneficiary_type` AS `beneficiary_type`,`fr`.`beneficiary_value` AS `beneficiary_value`,`fr`.`primary_head` AS `primary_head`,`fr`.`event_sub_head` AS `event_sub_head`,`fr`.`is_budget_proposed` AS `is_budget_proposed`,`fr`.`proposed_amount` AS `proposed_amount`,`fr`.`balance_amount` AS `balance_amount`,`fr`.`total_budget` AS `total_budget`,`fr`.`income_type` AS `income_type`,`fr`.`income_status` AS `income_status`,`fr`.`income_amount_type` AS `income_amount_type`,`fr`.`credit_status` AS `credit_status`,`fr`.`debit_status` AS `debit_status`,`fr`.`partial_amount` AS `partial_amount`,`fr`.`enclosures` AS `enclosures`,`fr`.`director_status` AS `director_status`,`fr`.`director_comment` AS `director_comment`,`fr`.`principal_status` AS `principal_status`,`fr`.`principal_comment` AS `principal_comment`,`fr`.`principal_priority` AS `principal_priority`,`fr`.`chairman_status` AS `chairman_status`,`fr`.`chairman_comment` AS `chairman_comment`,`fr`.`overall_status` AS `overall_status`,`fr`.`created_at` AS `created_at`,`fr`.`updated_at` AS `updated_at` from ((`finance_requests` `fr` left join `master_employees` `e` on((`fr`.`employee_id` = `e`.`id`))) left join `master_departments` `d` on((`e`.`department_id` = `d`.`id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-06  1:34:30
