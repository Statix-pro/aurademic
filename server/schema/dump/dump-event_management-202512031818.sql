-- MySQL dump 10.13  Distrib 9.5.0, for macos26.0 (arm64)
--
-- Host: localhost    Database: event_management
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

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '87910104-9618-11f0-9b24-4e35220acde5:1-56';

--
-- Table structure for table `budgets`
--

DROP TABLE IF EXISTS `budgets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budgets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `head` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `budgets_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budgets`
--

LOCK TABLES `budgets` WRITE;
/*!40000 ALTER TABLE `budgets` DISABLE KEYS */;
/*!40000 ALTER TABLE `budgets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `collaborations`
--

DROP TABLE IF EXISTS `collaborations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collaborations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `collaborator` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `collaborations_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `collaborations`
--

LOCK TABLES `collaborations` WRITE;
/*!40000 ALTER TABLE `collaborations` DISABLE KEYS */;
/*!40000 ALTER TABLE `collaborations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `coordinators`
--

DROP TABLE IF EXISTS `coordinators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `coordinators` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `mobile` varchar(15) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  KEY `idx_coordinators_department` (`department`),
  CONSTRAINT `coordinators_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `coordinators`
--

LOCK TABLES `coordinators` WRITE;
/*!40000 ALTER TABLE `coordinators` DISABLE KEYS */;
/*!40000 ALTER TABLE `coordinators` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `documents`
--

DROP TABLE IF EXISTS `documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `doc_name` varchar(255) NOT NULL,
  `active` tinyint(1) DEFAULT '0',
  `upload_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_active` (`active`),
  KEY `idx_documents_upload_id` (`upload_id`),
  KEY `idx_documents_event_id` (`event_id`),
  CONSTRAINT `documents_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `documents_ibfk_2` FOREIGN KEY (`upload_id`) REFERENCES `events_uploads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `documents`
--

LOCK TABLES `documents` WRITE;
/*!40000 ALTER TABLE `documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `event_types`
--

DROP TABLE IF EXISTS `event_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `event_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `type_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `event_types_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `event_types`
--

LOCK TABLES `event_types` WRITE;
/*!40000 ALTER TABLE `event_types` DISABLE KEYS */;
/*!40000 ALTER TABLE `event_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT 'Untitled Event',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events_uploads`
--

DROP TABLE IF EXISTS `events_uploads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events_uploads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int DEFAULT NULL,
  `filename` varchar(512) NOT NULL,
  `original_name` varchar(512) NOT NULL,
  `mime` varchar(255) DEFAULT NULL,
  `size` bigint DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_events_uploads_event_id` (`event_id`),
  CONSTRAINT `events_uploads_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events_uploads`
--

LOCK TABLES `events_uploads` WRITE;
/*!40000 ALTER TABLE `events_uploads` DISABLE KEYS */;
/*!40000 ALTER TABLE `events_uploads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finance`
--

DROP TABLE IF EXISTS `finance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `finance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance`
--

LOCK TABLES `finance` WRITE;
/*!40000 ALTER TABLE `finance` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finance_docs`
--

DROP TABLE IF EXISTS `finance_docs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_docs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `filename` varchar(512) NOT NULL,
  `original_name` varchar(512) NOT NULL,
  `mime` varchar(255) DEFAULT NULL,
  `size` bigint DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `finance_id` (`finance_id`),
  CONSTRAINT `finance_docs_ibfk_1` FOREIGN KEY (`finance_id`) REFERENCES `finance` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_docs`
--

LOCK TABLES `finance_docs` WRITE;
/*!40000 ALTER TABLE `finance_docs` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_docs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finance_expenditure`
--

DROP TABLE IF EXISTS `finance_expenditure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_expenditure` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `category` varchar(255) NOT NULL,
  `amount_proposed` decimal(12,2) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `upload_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `finance_id` (`finance_id`),
  KEY `idx_finance_expenditure_upload` (`upload_id`),
  CONSTRAINT `finance_expenditure_ibfk_1` FOREIGN KEY (`finance_id`) REFERENCES `finance` (`id`) ON DELETE CASCADE,
  CONSTRAINT `finance_expenditure_ibfk_2` FOREIGN KEY (`upload_id`) REFERENCES `events_uploads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_expenditure`
--

LOCK TABLES `finance_expenditure` WRITE;
/*!40000 ALTER TABLE `finance_expenditure` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_expenditure` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finance_income`
--

DROP TABLE IF EXISTS `finance_income`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_income` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `source` varchar(255) NOT NULL,
  `agency_name` varchar(255) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `finance_id` (`finance_id`),
  KEY `idx_finance_income_agency` (`agency_name`),
  CONSTRAINT `finance_income_ibfk_1` FOREIGN KEY (`finance_id`) REFERENCES `finance` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_income`
--

LOCK TABLES `finance_income` WRITE;
/*!40000 ALTER TABLE `finance_income` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_income` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `finance_sponsors`
--

DROP TABLE IF EXISTS `finance_sponsors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `finance_sponsors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `finance_id` int NOT NULL,
  `agency_name` varchar(255) NOT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `finance_id` (`finance_id`),
  CONSTRAINT `finance_sponsors_ibfk_1` FOREIGN KEY (`finance_id`) REFERENCES `finance` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `finance_sponsors`
--

LOCK TABLES `finance_sponsors` WRITE;
/*!40000 ALTER TABLE `finance_sponsors` DISABLE KEYS */;
/*!40000 ALTER TABLE `finance_sponsors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `important_links`
--

DROP TABLE IF EXISTS `important_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `important_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `registration_enabled` tinyint(1) DEFAULT '0',
  `registration_url` varchar(500) DEFAULT NULL,
  `feedback_enabled` tinyint(1) DEFAULT '0',
  `feedback_url` varchar(500) DEFAULT NULL,
  `youtube_enabled` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `important_links_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `important_links`
--

LOCK TABLES `important_links` WRITE;
/*!40000 ALTER TABLE `important_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `important_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `letters`
--

DROP TABLE IF EXISTS `letters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `letters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `section_name` varchar(255) NOT NULL,
  `active` tinyint(1) DEFAULT '0',
  `mode` enum('Letter','Email','Letter/ Email') DEFAULT 'Letter/ Email',
  `letter_date` date DEFAULT NULL,
  `upload_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `idx_letters_section` (`section_name`),
  CONSTRAINT `letters_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `letters`
--

LOCK TABLES `letters` WRITE;
/*!40000 ALTER TABLE `letters` DISABLE KEYS */;
/*!40000 ALTER TABLE `letters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `participants`
--

DROP TABLE IF EXISTS `participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `participants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `type` enum('internal-students','external-students','faculty','research-scholars','industry-experts','alumni','general-public') NOT NULL,
  `count` int DEFAULT '0',
  `count_verified` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_participants_type` (`type`),
  KEY `idx_participants_event_id` (`event_id`),
  CONSTRAINT `participants_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `participants`
--

LOCK TABLES `participants` WRITE;
/*!40000 ALTER TABLE `participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pre_events`
--

DROP TABLE IF EXISTS `pre_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `inaugural_date` date DEFAULT NULL,
  `inaugural_time` time DEFAULT NULL,
  `inaugural_venue` varchar(255) DEFAULT NULL,
  `valedictory_date` date DEFAULT NULL,
  `valedictory_time` time DEFAULT NULL,
  `valedictory_venue` varchar(255) DEFAULT NULL,
  `mode` enum('Physical','Virtual','Hybrid') DEFAULT NULL,
  `meeting_link` varchar(500) DEFAULT NULL,
  `level` enum('international','national','state','district','intra_college') DEFAULT NULL,
  `description` text,
  `expected_participants` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pre_events_level` (`level`),
  KEY `idx_pre_events_mode` (`mode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pre_events`
--

LOCK TABLES `pre_events` WRITE;
/*!40000 ALTER TABLE `pre_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `pre_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `publicity`
--

DROP TABLE IF EXISTS `publicity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `publicity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `website_enabled` tinyint(1) DEFAULT '0',
  `website_date` date DEFAULT NULL,
  `newspaper_enabled` tinyint(1) DEFAULT '0',
  `newspaper_date` date DEFAULT NULL,
  `newspaper_upload_id` int DEFAULT NULL,
  `press_enabled` tinyint(1) DEFAULT '0',
  `press_date` date DEFAULT NULL,
  `press_upload_id` int DEFAULT NULL,
  `facebook_link` varchar(500) DEFAULT NULL,
  `x_link` varchar(500) DEFAULT NULL,
  `instagram_link` varchar(500) DEFAULT NULL,
  `linkedin_link` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `publicity_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `publicity`
--

LOCK TABLES `publicity` WRITE;
/*!40000 ALTER TABLE `publicity` DISABLE KEYS */;
/*!40000 ALTER TABLE `publicity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `resource_persons`
--

DROP TABLE IF EXISTS `resource_persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resource_persons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `name` varchar(255) DEFAULT '',
  `designation` varchar(255) DEFAULT '',
  `organization` varchar(255) DEFAULT '',
  `email` varchar(255) DEFAULT '',
  `linkedin` varchar(500) DEFAULT '',
  `location` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `idx_resource_persons_location` (`location`),
  CONSTRAINT `resource_persons_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `resource_persons`
--

LOCK TABLES `resource_persons` WRITE;
/*!40000 ALTER TABLE `resource_persons` DISABLE KEYS */;
/*!40000 ALTER TABLE `resource_persons` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sdgs`
--

DROP TABLE IF EXISTS `sdgs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sdgs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `sdg_name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `sdgs_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sdgs`
--

LOCK TABLES `sdgs` WRITE;
/*!40000 ALTER TABLE `sdgs` DISABLE KEYS */;
/*!40000 ALTER TABLE `sdgs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `target_audience`
--

DROP TABLE IF EXISTS `target_audience`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `target_audience` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `audience` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `target_audience_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `target_audience`
--

LOCK TABLES `target_audience` WRITE;
/*!40000 ALTER TABLE `target_audience` DISABLE KEYS */;
/*!40000 ALTER TABLE `target_audience` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `themes`
--

DROP TABLE IF EXISTS `themes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `themes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pre_event_id` int NOT NULL,
  `theme` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `pre_event_id` (`pre_event_id`),
  CONSTRAINT `themes_ibfk_1` FOREIGN KEY (`pre_event_id`) REFERENCES `pre_events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `themes`
--

LOCK TABLES `themes` WRITE;
/*!40000 ALTER TABLE `themes` DISABLE KEYS */;
/*!40000 ALTER TABLE `themes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `youtube_links`
--

DROP TABLE IF EXISTS `youtube_links`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `youtube_links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `url` varchar(500) NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  CONSTRAINT `youtube_links_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `youtube_links`
--

LOCK TABLES `youtube_links` WRITE;
/*!40000 ALTER TABLE `youtube_links` DISABLE KEYS */;
/*!40000 ALTER TABLE `youtube_links` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'event_management'
--
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-03 18:18:46
