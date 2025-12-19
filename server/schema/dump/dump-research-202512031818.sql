-- MySQL dump 10.13  Distrib 9.5.0, for macos26.0 (arm64)
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

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '87910104-9618-11f0-9b24-4e35220acde5:1-56';

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
) ENGINE=InnoDB AUTO_INCREMENT=91 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_journal`
--

LOCK TABLES `author_journal` WRITE;
/*!40000 ALTER TABLE `author_journal` DISABLE KEYS */;
INSERT INTO `author_journal` VALUES (1,30,2,'2024-12-25 15:22:13',1,0),(2,25,2,'2024-12-25 15:22:13',0,1),(3,25,3,'2025-02-01 11:09:08',1,0),(4,30,3,'2025-02-01 11:09:08',0,1),(5,26,3,'2025-02-01 11:09:09',0,0),(6,25,4,'2025-02-01 13:44:32',1,0),(7,30,4,'2025-02-01 13:44:32',0,1),(8,26,4,'2025-02-01 13:44:32',0,0),(9,25,5,'2025-02-01 13:44:43',1,0),(10,30,5,'2025-02-01 13:44:43',0,1),(11,30,6,'2025-02-01 16:25:38',1,1),(12,30,7,'2025-02-01 16:26:32',1,1),(13,25,7,'2025-02-01 16:26:32',0,0),(14,27,2,'2025-02-01 17:19:12',0,0),(15,25,8,'2025-02-02 03:10:36',1,0),(16,30,8,'2025-02-02 03:10:36',0,1),(17,25,9,'2025-02-02 04:19:26',1,1),(18,25,10,'2025-04-12 11:57:06',1,1),(19,30,10,'2025-04-12 11:57:09',0,0),(20,25,12,'2025-04-12 12:45:57',1,1),(21,30,12,'2025-04-12 12:45:59',0,0),(22,25,13,'2025-04-12 12:47:05',1,1),(23,25,14,'2025-04-12 16:05:37',1,1),(24,30,14,'2025-04-12 16:05:37',0,0),(25,25,15,'2025-04-12 16:08:02',1,1),(26,30,15,'2025-04-12 16:08:04',0,0),(27,25,16,'2025-04-13 15:40:55',1,1),(28,30,16,'2025-04-13 15:40:55',0,0),(29,25,17,'2025-04-13 17:18:37',1,1),(30,25,18,'2025-04-13 17:22:18',1,1),(31,25,19,'2025-04-13 17:38:00',1,1),(32,25,20,'2025-04-13 17:47:24',1,1),(33,25,21,'2025-04-14 06:46:16',1,0),(34,30,21,'2025-04-14 06:46:16',0,1),(35,30,22,'2025-04-14 06:49:45',1,1),(36,30,23,'2025-04-14 06:54:01',1,1),(37,30,24,'2025-04-14 07:04:52',1,1),(38,25,25,'2025-04-14 07:09:57',1,1),(39,25,26,'2025-04-14 07:23:07',1,1),(40,25,27,'2025-04-14 07:43:09',1,1),(41,25,28,'2025-04-14 07:47:30',1,1),(42,25,29,'2025-04-14 08:00:09',1,1),(43,25,30,'2025-04-14 08:14:01',1,1),(44,25,34,'2025-04-14 08:30:50',1,1),(45,30,34,'2025-04-14 08:30:51',0,0),(46,30,35,'2025-04-14 08:41:24',1,1),(47,30,36,'2025-07-06 15:03:20',1,1),(48,25,36,'2025-07-06 15:03:20',0,0),(49,30,37,'2025-07-06 15:09:58',1,1),(50,30,38,'2025-07-06 15:51:46',1,1),(51,30,39,'2025-07-07 06:04:49',1,1),(52,30,40,'2025-07-07 06:11:39',1,1),(53,30,41,'2025-07-07 06:57:38',1,1),(54,30,42,'2025-07-07 07:25:00',1,1),(55,30,43,'2025-07-08 05:15:45',1,1),(56,25,43,'2025-07-08 05:15:45',0,0),(57,30,45,'2025-08-12 06:10:05',1,1),(58,30,46,'2025-08-12 06:15:56',1,1),(59,30,47,'2025-08-12 06:22:16',1,1),(60,25,48,'2025-08-12 06:34:54',1,1),(61,25,50,'2025-08-12 09:05:26',1,1),(62,25,49,'2025-08-12 09:05:26',1,1),(63,25,51,'2025-08-12 10:28:13',1,1),(64,80,51,'2025-08-12 10:28:13',0,0),(65,25,52,'2025-08-21 06:26:01',1,1),(66,25,53,'2025-08-21 06:30:38',1,1),(67,81,53,'2025-08-21 06:30:38',0,0),(68,30,54,'2025-08-28 09:50:53',1,1),(69,30,55,'2025-08-28 09:52:12',1,1),(70,82,55,'2025-08-28 09:52:12',0,0),(71,30,56,'2025-08-28 09:54:11',1,1),(72,83,56,'2025-08-28 09:54:11',0,0),(73,30,57,'2025-08-28 10:20:58',1,1),(74,84,57,'2025-08-28 10:20:59',0,0),(75,30,58,'2025-11-29 04:26:55',1,1),(76,27,58,'2025-11-29 04:26:56',0,0),(77,30,59,'2025-11-29 04:58:49',1,1),(78,25,59,'2025-11-29 04:58:49',0,0),(79,30,60,'2025-11-29 05:00:14',1,1),(80,30,61,'2025-12-01 05:23:42',1,1),(81,30,62,'2025-12-01 06:37:41',1,1),(82,30,63,'2025-12-01 07:39:30',1,1),(83,30,64,'2025-12-01 08:25:17',1,1),(84,30,65,'2025-12-01 09:01:54',1,1),(85,85,65,'2025-12-01 09:01:55',0,0),(86,30,66,'2025-12-01 09:17:35',1,1),(87,30,67,'2025-12-01 09:38:07',1,0),(88,85,67,'2025-12-01 09:38:07',0,1),(89,30,68,'2025-12-01 09:40:39',1,1),(90,27,68,'2025-12-01 09:40:39',0,0);
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
) ENGINE=InnoDB AUTO_INCREMENT=217 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_project`
--

LOCK TABLES `author_project` WRITE;
/*!40000 ALTER TABLE `author_project` DISABLE KEYS */;
INSERT INTO `author_project` VALUES (33,29,24,NULL,'2025-01-05 17:08:29',0),(34,30,24,NULL,'2025-01-05 17:08:29',1),(60,26,49,1,'2025-01-20 16:05:17',0),(61,30,49,NULL,'2025-01-20 16:05:17',1),(66,26,55,NULL,'2025-01-21 04:08:36',1),(79,26,70,1,'2025-01-21 05:48:31',0),(80,30,70,0,'2025-01-21 05:48:31',1),(81,33,70,NULL,'2025-01-21 05:48:31',0),(82,30,71,NULL,'2025-01-21 12:55:44',0),(83,34,71,NULL,'2025-01-21 12:55:44',1),(84,25,72,1,'2025-02-02 06:54:55',0),(85,30,72,0,'2025-02-02 06:54:55',1),(86,27,72,NULL,'2025-02-02 06:54:55',0),(87,25,73,NULL,'2025-02-02 07:30:27',1),(88,30,73,NULL,'2025-02-02 07:30:27',0),(89,25,74,1,'2025-02-02 11:41:24',0),(90,30,74,0,'2025-02-02 11:41:24',1),(91,27,74,0,'2025-02-02 11:41:25',0),(96,33,74,NULL,'2025-02-02 13:14:00',0),(97,25,93,NULL,'2025-02-27 15:23:56',1),(98,25,94,NULL,'2025-02-27 18:09:47',1),(99,25,95,1,'2025-02-28 04:14:55',1),(100,30,95,NULL,'2025-02-28 04:14:56',0),(101,25,96,1,'2025-02-28 12:51:55',1),(102,30,96,NULL,'2025-02-28 12:51:55',0),(103,25,97,NULL,'2025-02-28 14:11:08',1),(104,25,98,NULL,'2025-02-28 16:38:55',1),(105,25,99,1,'2025-03-18 05:47:40',1),(106,30,99,NULL,'2025-03-18 05:47:41',0),(107,25,100,NULL,'2025-03-18 08:03:49',1),(108,25,101,NULL,'2025-03-18 08:07:21',1),(109,25,102,NULL,'2025-03-18 08:17:43',1),(110,25,103,NULL,'2025-03-18 16:51:08',1),(112,25,105,NULL,'2025-03-24 09:39:44',1),(113,25,106,NULL,'2025-03-24 10:23:03',1),(114,25,107,NULL,'2025-03-24 13:21:16',1),(115,25,108,NULL,'2025-03-24 13:28:07',1),(116,25,109,NULL,'2025-03-24 13:37:32',1),(117,25,110,NULL,'2025-03-24 14:00:28',1),(118,25,111,1,'2025-04-03 07:20:35',0),(119,30,111,NULL,'2025-04-03 07:20:35',1),(120,25,112,1,'2025-04-04 06:25:23',1),(121,30,112,NULL,'2025-04-04 06:25:23',0),(122,25,113,NULL,'2025-04-04 06:26:45',1),(123,25,114,NULL,'2025-04-04 06:43:09',1),(124,30,116,NULL,'2025-04-06 13:37:29',1),(125,25,116,NULL,'2025-04-06 13:37:29',0),(126,30,117,1,'2025-04-06 13:44:01',1),(127,25,117,NULL,'2025-04-06 13:44:01',0),(128,30,118,NULL,'2025-04-06 13:59:37',1),(131,30,120,NULL,'2025-04-06 14:55:17',1),(132,25,120,NULL,'2025-04-06 14:55:17',0),(133,25,121,1,'2025-04-06 15:08:36',0),(134,25,123,1,'2025-04-06 15:12:31',0),(135,30,123,NULL,'2025-04-06 15:12:31',1),(136,25,124,1,'2025-04-06 15:13:51',0),(137,30,124,NULL,'2025-04-06 15:13:51',1),(138,25,125,1,'2025-04-06 15:29:10',0),(139,30,125,NULL,'2025-04-06 15:29:10',1),(140,25,126,1,'2025-04-06 15:47:34',1),(141,30,126,NULL,'2025-04-06 15:47:34',0),(142,25,127,1,'2025-04-06 16:13:19',0),(143,30,127,NULL,'2025-04-06 16:13:19',1),(144,25,128,NULL,'2025-04-06 16:22:38',1),(145,25,129,NULL,'2025-04-06 16:45:16',1),(146,25,130,0,'2025-04-06 17:59:57',1),(147,25,131,NULL,'2025-04-08 10:23:58',1),(148,25,132,1,'2025-04-09 04:01:41',1),(149,30,132,NULL,'2025-04-09 04:01:41',0),(150,25,133,NULL,'2025-04-09 04:40:48',1),(151,25,134,NULL,'2025-04-09 05:02:59',1),(153,25,136,NULL,'2025-04-09 05:21:22',1),(154,25,137,NULL,'2025-04-09 05:28:25',1),(155,25,138,NULL,'2025-04-09 05:44:26',1),(156,30,139,NULL,'2025-04-14 14:32:45',1),(157,30,140,NULL,'2025-04-14 14:57:15',1),(158,30,141,NULL,'2025-04-14 15:13:01',1),(159,30,142,NULL,'2025-04-14 15:27:25',1),(160,30,143,NULL,'2025-04-14 16:17:11',1),(161,25,145,NULL,'2025-04-14 16:55:34',1),(162,30,146,NULL,'2025-04-14 17:04:43',1),(163,30,147,NULL,'2025-04-14 17:16:01',1),(164,30,148,NULL,'2025-04-14 17:33:27',1),(165,30,149,NULL,'2025-04-14 17:41:27',1),(166,30,150,NULL,'2025-04-14 17:51:17',1),(167,30,151,NULL,'2025-04-14 18:13:50',1),(168,30,152,NULL,'2025-04-14 18:21:09',1),(169,30,153,NULL,'2025-04-14 18:29:51',1),(170,25,154,1,'2025-04-14 18:42:17',1),(171,28,154,NULL,'2025-04-14 18:42:17',0),(172,30,155,NULL,'2025-04-14 18:53:12',1),(173,25,156,1,'2025-04-29 06:21:39',1),(174,26,156,NULL,'2025-04-29 06:21:39',0),(175,25,157,1,'2025-05-07 13:14:15',0),(176,30,157,NULL,'2025-05-07 13:14:15',1),(177,30,158,NULL,'2025-05-08 07:26:58',1),(178,30,159,NULL,'2025-05-08 08:14:08',1),(179,30,160,NULL,'2025-05-08 09:02:28',1),(180,30,161,NULL,'2025-05-08 09:41:39',1),(181,30,162,NULL,'2025-05-08 10:25:58',1),(182,30,163,NULL,'2025-05-08 13:42:51',1),(183,30,164,NULL,'2025-05-10 04:42:38',1),(188,30,169,NULL,'2025-05-10 05:56:28',1),(189,30,170,NULL,'2025-05-10 06:46:11',1),(190,30,171,NULL,'2025-05-10 07:01:58',1),(191,30,172,NULL,'2025-05-10 07:41:00',1),(192,30,173,NULL,'2025-05-12 05:22:14',1),(193,30,174,NULL,'2025-05-12 05:38:43',1),(194,30,175,NULL,'2025-05-12 05:48:06',1),(195,30,176,NULL,'2025-05-12 05:54:46',1),(196,30,177,NULL,'2025-05-12 06:23:34',1),(197,30,178,NULL,'2025-05-12 06:27:31',1),(198,30,179,NULL,'2025-05-12 06:41:03',1),(199,30,180,NULL,'2025-05-12 06:50:12',1),(200,30,181,NULL,'2025-05-12 06:55:40',1),(201,30,182,NULL,'2025-05-13 06:34:02',1),(202,30,183,NULL,'2025-05-13 06:47:27',1),(203,30,184,NULL,'2025-05-13 06:55:59',1),(204,30,185,NULL,'2025-05-13 07:08:36',1),(205,30,186,NULL,'2025-05-13 07:28:40',1),(206,30,187,NULL,'2025-05-13 09:56:10',1),(207,30,188,NULL,'2025-05-14 05:31:33',1),(208,30,189,NULL,'2025-05-14 05:44:20',1),(209,28,190,NULL,'2025-05-14 05:45:50',1),(210,30,191,NULL,'2025-05-14 06:21:19',1),(211,30,192,NULL,'2025-05-14 06:30:09',1),(212,30,193,NULL,'2025-05-14 06:44:38',1),(213,30,194,NULL,'2025-05-14 07:09:51',1),(214,30,195,NULL,'2025-05-14 07:39:59',1),(215,30,196,1,'2025-07-17 07:32:29',1),(216,25,196,NULL,'2025-07-17 07:32:29',0);
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `author_students`
--

LOCK TABLES `author_students` WRITE;
/*!40000 ALTER TABLE `author_students` DISABLE KEYS */;
INSERT INTO `author_students` VALUES (1,'111231','Mahesh','IT','K.S.Rangasamy College of Technology','2025-12-01 09:01:55','2025-12-01 09:01:55');
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
  `email` varchar(255) DEFAULT NULL,
  `author_id` varchar(255) DEFAULT NULL,
  `designation` varchar(100) DEFAULT '',
  `name` varchar(255) NOT NULL,
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
  CONSTRAINT `fk_authors_student_ref` FOREIGN KEY (`student_ref`) REFERENCES `author_students` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=86 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `authors`
--

LOCK TABLES `authors` WRITE;
/*!40000 ALTER TABLE `authors` DISABLE KEYS */;
INSERT INTO `authors` VALUES (25,'gingfreecss325@gmail.com','111KSRCT002','faculty','Dr. Sarah Wilson','Engineering','University D','UK','2024-11-07 06:53:14','2025-01-27 06:51:44','',NULL),(26,'david.lee@gmail.com','111KSRCT003','student','David Lee','Mathematics','University A','USA','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(27,'prof.michael.brown@gmail.com','111KSRCT004','faculty','Prof. Michael Brown','Physics','University E','Australia','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(28,'emma.white@gmail.com','111KSRCT005','student','Emma White','Computer Science','University A','USA','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(29,'dr.olivia.green@gmail.com','111KSRCT006','faculty','Dr. Olivia Green','Biology','University F','Germany','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(30,'maverickmyth333@gmail.com','111KSRCT007','student','Maverick Myth','Chemistry','University A','USA','2024-11-07 06:53:14','2024-12-25 14:55:54','',NULL),(31,'prof.sophia.martinez@gmail.com','111KSRCT008','faculty','Prof. Sophia Martinez','Literature','University G','Spain','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(32,'noah.anderson@gmail.com','111KSRCT009','student','Noah Anderson','History','University A','USA','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(33,'dr.isabella.thomas@gmail.com','111KSRCT010','faculty','Dr. Isabella Thomas','Philosophy','University H','Italy','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(34,'mia.jackson@gmail.com','111KSRCT011','student','Mia Jackson','Art','University A','USA','2024-11-07 06:53:14','2024-12-23 04:43:33','',NULL),(80,'student@temp.com','111231','student','MAhesh','IT','KSRCT','INDIA','2025-08-12 10:28:13','2025-08-12 10:28:13','',NULL),(81,NULL,NULL,'student','Maheshwaran A K','Mop','asd','India','2025-08-21 06:30:38','2025-08-21 06:30:38','',NULL),(82,NULL,NULL,'student','zxcasd','Mop','Statix pro','India','2025-08-28 09:52:12','2025-08-28 09:52:12','',NULL),(83,NULL,NULL,'student','K S Rangasamy College of Technology','IT','Statix pro','India','2025-08-28 09:54:11','2025-08-28 09:54:11','',NULL),(84,NULL,NULL,'student','K S Rangasamy College of Technology','asd','Statix pro','India','2025-08-28 10:20:59','2025-08-28 10:20:59','',NULL),(85,NULL,NULL,'student','Maheshwaran A K','IT','K.S.Rangasamy College of Technology','','2025-12-01 09:01:55','2025-12-01 09:38:07','',1);
/*!40000 ALTER TABLE `authors` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edit_requests`
--

LOCK TABLES `edit_requests` WRITE;
/*!40000 ALTER TABLE `edit_requests` DISABLE KEYS */;
INSERT INTO `edit_requests` VALUES (9,'journals',2,2,'approved','2025-01-27 18:07:56','2025-01-31 19:03:09'),(12,'research_projects',53,2,'pending','2025-01-27 18:25:32','2025-01-27 18:25:32'),(13,'research_projects',71,1,'rejected','2025-01-31 06:14:42','2025-01-31 19:03:01'),(18,'research_projects',69,1,'pending','2025-01-31 08:48:47','2025-01-31 08:48:47'),(19,'research_projects',4,2,'rejected','2025-02-01 11:11:50','2025-04-03 14:34:24'),(20,'journals',3,2,'rejected','2025-02-01 13:44:29','2025-04-03 14:34:21'),(21,'journals',4,2,'rejected','2025-02-01 13:44:41','2025-04-03 14:34:24'),(22,'journals',2,2,'approved','2025-02-01 14:13:16','2025-02-01 14:13:47'),(23,'research_projects',5,2,'none','2025-02-01 19:03:03','2025-02-03 06:46:20'),(24,'research_projects',50,2,'none','2025-02-01 19:06:29','2025-02-03 06:46:20'),(25,'research_projects',3,2,'rejected','2025-02-01 19:10:47','2025-04-03 14:34:21'),(26,'journals',5,2,'none','2025-02-02 03:07:04','2025-02-03 06:46:20'),(27,'journals',9,2,'none','2025-02-02 05:29:43','2025-02-02 05:29:43'),(31,'research_projects',72,2,'none','2025-02-02 08:14:29','2025-02-27 09:02:28'),(32,'research_projects',74,2,'none','2025-02-02 13:11:34','2025-02-28 17:45:05'),(34,'research_projects',73,2,'approved','2025-02-02 18:28:09','2025-02-27 05:06:05'),(35,'research_projects',93,2,'approved','2025-02-27 15:47:48','2025-02-28 16:00:40'),(36,'research_projects',93,2,'approved','2025-02-27 16:48:50','2025-02-28 16:00:40'),(37,'research_projects',94,2,'none','2025-02-27 18:10:42','2025-02-27 19:08:33'),(38,'research_projects',95,2,'approved','2025-02-28 04:17:26','2025-02-28 12:19:01'),(39,'research_projects',96,2,'none','2025-02-28 12:52:26','2025-02-28 17:20:57'),(40,'research_projects',98,2,'none','2025-02-28 16:39:22','2025-02-28 16:40:26'),(41,'research_projects',125,2,'none','2025-04-06 15:30:35','2025-04-06 15:31:54'),(42,'journals',14,2,'approved','2025-04-12 16:10:42','2025-04-12 17:55:05'),(43,'research_projects',158,1,'none','2025-05-08 07:33:15','2025-05-08 07:34:58'),(44,'research_projects',159,1,'none','2025-05-08 08:16:09','2025-05-08 09:00:28'),(45,'research_projects',160,1,'none','2025-05-08 09:37:52','2025-05-08 09:38:42'),(46,'research_projects',182,1,'none','2025-05-13 06:53:03','2025-05-13 06:53:31'),(47,'journals',42,1,'none','2025-07-07 09:31:24','2025-07-07 09:32:16'),(48,'journals',43,1,'pending','2025-08-07 04:39:21','2025-08-07 04:39:21'),(49,'journals',57,1,'rejected','2025-09-27 05:58:25','2025-11-16 15:55:14'),(50,'journals',58,1,'pending','2025-11-29 04:27:03','2025-11-29 04:27:03'),(51,'journals',63,1,'approved','2025-12-01 07:39:56','2025-12-01 07:40:08');
/*!40000 ALTER TABLE `edit_requests` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_indexes`
--

LOCK TABLES `journal_indexes` WRITE;
/*!40000 ALTER TABLE `journal_indexes` DISABLE KEYS */;
INSERT INTO `journal_indexes` VALUES (1,2,'SCIE'),(2,3,'Scopus'),(3,4,'Scopus'),(4,5,'Scopus'),(5,6,'SCIE'),(6,7,'SCIE'),(7,2,'SCIE'),(8,2,'SCIE'),(9,2,'SCIE'),(10,2,'SCIE'),(11,2,'SCIE'),(12,2,'SCIE'),(13,5,'Scopus'),(14,8,'SCI'),(15,5,'Scopus'),(16,5,'Scopus'),(17,5,'Scopus'),(18,5,'Scopus'),(19,5,'Scopus'),(20,5,'Scopus'),(21,5,'Scopus'),(22,5,'Scopus'),(23,5,'Scopus'),(24,5,'Scopus'),(25,5,'Scopus'),(26,5,'Scopus'),(27,9,'SCIE'),(28,10,'SCI'),(29,12,'SCI'),(30,13,'SCIE'),(31,14,'SCIE'),(32,15,'Scopus'),(33,14,'SCIE'),(34,14,'SCIE'),(35,16,'Scopus'),(36,17,'SCI'),(37,18,'SCIE'),(38,19,'SCI'),(39,20,'Scopus'),(40,22,'SCIE'),(41,23,'SCIE'),(42,24,'SCIE'),(43,26,'SCIE'),(44,27,'Scopus'),(45,28,'Scopus'),(46,29,'Scopus'),(47,34,'Scopus'),(48,35,'SCIE'),(49,38,'Scopus'),(50,38,'Google Scholar'),(51,39,'SCIE'),(52,40,'SCIE'),(53,41,'Scopus'),(54,41,'UGC Care'),(55,42,'Scopus'),(56,42,'Scopus'),(57,43,'SCIE'),(58,51,'Scopus'),(59,53,'Scopus'),(60,55,'Scopus'),(61,56,'SCI'),(62,57,'UGC Care'),(63,58,'Scopus'),(64,59,'SCIE'),(65,60,'Scopus'),(66,61,'Scopus'),(67,62,'SCIE'),(68,62,'PubMed'),(69,63,'PubMed'),(70,64,'SCIE'),(71,65,'Scopus'),(72,66,'Scopus'),(73,67,'SCIE'),(74,68,'Scopus');
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
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` enum('National','International') NOT NULL DEFAULT 'National',
  PRIMARY KEY (`id`),
  KEY `idx_journal_options_name` (`journal_name`),
  KEY `idx_journal_options_publisher` (`publisher`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_options`
--

LOCK TABLES `journal_options` WRITE;
/*!40000 ALTER TABLE `journal_options` DISABLE KEYS */;
INSERT INTO `journal_options` VALUES (1,'New SAlem','Salem in','statix.pro','123123','921290134','2024-12-10 05:40:33','2025-02-02 03:08:19','National'),(2,'Tiruchengode','Publication of TCH','ksrct.ac.in','21597744','99877666','2024-12-13 12:09:59','2025-09-13 09:29:18','International'),(3,'xz','AS','https://supabase-cache-helpers.vercel.app/','asda','asd','2025-08-04 17:10:30','2025-08-04 17:10:30','National'),(4,'BOOKIE','','','','','2025-11-29 05:00:14','2025-11-29 05:00:14','National'),(5,'BOOK CHAPTER','','','','','2025-12-01 05:23:42','2025-12-01 05:23:42','National');
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_requests`
--

LOCK TABLES `journal_requests` WRITE;
/*!40000 ALTER TABLE `journal_requests` DISABLE KEYS */;
INSERT INTO `journal_requests` VALUES (1,1,'xz','AS','https://supabase-cache-helpers.vercel.app/','asda','asd','approved','Journal approved and added to options','2025-08-04 17:10:04','2025-08-04 17:10:31','National'),(2,1,'Mompi','Noational','ksrct.ac.in','22','11','pending',NULL,'2025-11-26 05:34:13','2025-11-26 05:34:13','National');
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_status_updates`
--

LOCK TABLES `journal_status_updates` WRITE;
/*!40000 ALTER TABLE `journal_status_updates` DISABLE KEYS */;
INSERT INTO `journal_status_updates` VALUES (1,57,1,'revision_requested','gf',NULL,'2025-10-06 05:40:37','2025-10-06 05:40:37');
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
  PRIMARY KEY (`id`),
  KEY `fk_journal_options` (`journal_options_id`),
  CONSTRAINT `fk_journal_options` FOREIGN KEY (`journal_options_id`) REFERENCES `journal_options` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journals`
--

LOCK TABLES `journals` WRITE;
/*!40000 ALTER TABLE `journals` DISABLE KEYS */;
INSERT INTO `journals` VALUES (1,'National','New One',NULL,NULL,'Review Article','Q2',12.000,33.000,1,'123','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2024-11-30','submitted','adas','asdasd','Special Issue',12,12,NULL,NULL,NULL,NULL,'DoiI','2024-01-02','2027-02-03',NULL,'2024-12-25 15:20:12','2024-12-25 15:20:12','[\"national\"]',NULL,1,'faculty',NULL,NULL),(2,'National','New One @ 33',NULL,NULL,'Review Article','Q2',12.000,33.000,1,'123','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2024-11-23','submitted','adas','asdasd','Special Issue',12,12,NULL,NULL,NULL,NULL,'DoiI','2023-12-26','2027-01-27','/uploads/1738433551053-Agil\'s Offer letter.pdf','2024-12-25 15:22:13','2025-02-01 18:12:31','[\"national\"]',NULL,1,'faculty',NULL,NULL),(3,'National','Monpoly',NULL,NULL,'Review Article','Q3',12.000,23.000,1,'22','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-01-09','submitted','Volume 2','Issue 232','Special Issue',12,33,NULL,NULL,NULL,NULL,'DoiI','2025-01-01','2025-03-06','/uploads/1738408150646-Whatsapp Automation Comparison table.pdf','2025-02-01 11:09:08','2025-02-01 11:09:10','[\"national\"]',NULL,1,'faculty',NULL,NULL),(4,'National','Monpoly',NULL,NULL,'Review Article','Q3',12.000,23.000,1,'22','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-01-08','submitted','Volume 2','Issue 232','Special Issue',12,33,NULL,NULL,NULL,NULL,'DoiI','2024-12-31','2025-03-05',NULL,'2025-02-01 13:44:30','2025-02-01 13:44:30','[\"national\"]',NULL,1,'faculty',NULL,NULL),(5,'National','Monpoly1',NULL,NULL,'Review Article','Q3',12.000,23.000,1,'22','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2024-12-25','submitted','Volume 2','Issue 232','Special Issue',12,33,NULL,NULL,NULL,NULL,'DoiI','2024-12-17','2025-02-19','/uploads/1738467951559-Dharani\'s Offer letter.pdf','2025-02-01 13:44:41','2025-02-02 04:18:27','[\"national\"]',NULL,1,'faculty',NULL,NULL),(6,'National','New One @ 2 ONe',NULL,NULL,'Review Article','Q2',12.000,33.000,1,'123','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2024-11-29','submitted','adas','asdasd','Special Issue',12,12,NULL,NULL,NULL,NULL,'DoiI','2024-01-01','2027-02-02',NULL,'2025-02-01 16:25:38','2025-02-01 16:25:38','[\"national\"]',NULL,1,'faculty',NULL,NULL),(7,'National','New One 3',NULL,NULL,'Review Article','Q2',12.000,33.000,1,'123','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2024-11-29','submitted','adas','asdasd','Special Issue',12,12,NULL,NULL,NULL,NULL,'DoiI','2024-01-01','2027-02-02',NULL,'2025-02-01 16:26:32','2025-02-01 16:26:32','[\"national\"]',NULL,1,'faculty',NULL,NULL),(8,'National','123456',NULL,NULL,'Review Article','Q2',123.000,NULL,1,'22','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-02-02 03:10:36','2025-02-02 03:10:36','[\"state\"]',NULL,1,'faculty',NULL,NULL),(9,'National','as',NULL,NULL,'Review Article','Q2',11.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-02-02 04:19:26','2025-02-02 04:19:26','[\"national\"]',NULL,1,'faculty',NULL,NULL),(10,'National','New 1204',NULL,NULL,'Review Article','Q2',15.000,NULL,1,'10','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-03','submitted','52','asdasd','Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,'asd',NULL,NULL,NULL,'2025-04-12 11:57:06','2025-04-12 11:57:06','[\"national\"]',NULL,1,'faculty',NULL,NULL),(11,'National','New',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-05','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-12 12:40:03','2025-04-12 12:40:03','[\"international\"]',NULL,1,'faculty',NULL,NULL),(12,'National','Test 1204',NULL,NULL,'Research Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"','2025-04-03','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/1744461960629-858570246-hostl.pdf','2025-04-12 12:45:56','2025-04-12 12:46:00','[\"national\"]',NULL,1,'faculty',NULL,NULL),(13,'National','Test 2',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-03','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/1744462026176-844087702-Whatsapp Automation (1).pdf','2025-04-12 12:47:05','2025-04-12 12:47:06','[\"national\"]',NULL,1,'faculty',NULL,NULL),(14,'National','mop',NULL,NULL,'Review Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-30','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744480418726-Whatsapp_Automation__1_.pdf','2025-04-12 16:05:37','2025-04-12 17:53:38','[\"international\"]',NULL,1,'faculty',NULL,NULL),(15,'National','pop',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-02','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744474085518-hostl.pdf','2025-04-12 16:08:00','2025-04-12 16:08:05','[\"state\"]',NULL,1,'faculty',NULL,NULL),(16,'National','New Title',NULL,NULL,'Review Article','Q3',12.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-02','submitted',NULL,'asdasd','Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-03-25','/uploads/journalform-articles/1744558856042-Earthy_Origins.pdf','2025-04-13 15:40:55','2025-04-13 15:40:56','[\"national\"]',NULL,1,'faculty',NULL,NULL),(17,'National','delete',NULL,NULL,'Research Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-13','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-13 17:18:36','2025-04-13 17:18:36','[\"international\"]',NULL,1,'faculty',NULL,NULL),(18,'National','Delete2',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-21','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744564939855-hostl.pdf','2025-04-13 17:22:17','2025-04-13 17:22:19','[\"international\"]',NULL,1,'faculty',NULL,NULL),(19,'National','delete 3',NULL,NULL,'Research Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-04','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-13 17:37:59','2025-04-13 17:37:59','[\"national\"]',NULL,1,'faculty',NULL,NULL),(20,'National','delete',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"','2025-04-05','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744566445409-Mahesh_Final__Resume.pdf','2025-04-13 17:47:24','2025-04-13 17:47:25','[\"state\"]',NULL,1,'faculty',NULL,NULL),(21,'National','Today Delete',NULL,NULL,'Review Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-14','submitted',NULL,NULL,'Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 06:46:15','2025-04-14 06:46:15','[\"international\"]',NULL,1,'faculty',NULL,NULL),(22,'National','delete',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-10','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 06:49:44','2025-04-14 06:49:44','[\"international\"]',NULL,1,'faculty',NULL,NULL),(23,'National','delete 2',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-03','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744613642448-resume__3_.pdf','2025-04-14 06:54:01','2025-04-14 06:54:02','[\"national\"]',NULL,1,'faculty',NULL,NULL),(24,'National','delete',NULL,NULL,'Review Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-03','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744614300411-Blue_and_Gray_Simple_Professional_CV_Resume.pdf','2025-04-14 07:04:52','2025-04-14 07:05:00','[\"state\"]',NULL,1,'faculty',NULL,NULL),(25,'National','delete',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-13','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 07:09:57','2025-04-14 07:09:57','[\"international\"]',NULL,1,'faculty',NULL,NULL),(26,'National','New delete',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-04','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744615390494-Final_Digital_Marketing_Campaign_Strategy_for_KSRCT_College_Using_Meta_Ads.pdf','2025-04-14 07:23:06','2025-04-14 07:23:11','[\"national\"]',NULL,1,'faculty',NULL,NULL),(27,'National','New deelte',NULL,NULL,'Review Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-04','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744616590820-Content_Ideas_List.pdf','2025-04-14 07:43:07','2025-04-14 07:43:10','[\"international\"]',NULL,1,'faculty',NULL,NULL),(28,'National','delete4',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-04','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744616851913-hostl.pdf','2025-04-14 07:47:30','2025-04-14 07:47:31','[\"international\"]',NULL,1,'faculty',NULL,NULL),(29,'National','New delete 4',NULL,NULL,'Review Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-02','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744617611028-Dinesh_Resume__1_.pdf','2025-04-14 07:59:58','2025-04-14 08:00:11','[\"international\"]',NULL,1,'faculty',NULL,NULL),(30,'National','New',NULL,NULL,'Review Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"','2025-03-08','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 08:14:00','2025-04-14 08:14:00','[\"state\"]',NULL,1,'faculty',NULL,NULL),(31,'National','National',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-02','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 08:17:22','2025-04-14 08:17:22','[\"national\"]',NULL,1,'faculty',NULL,NULL),(32,'National','Delete fin',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-09','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 08:24:12','2025-04-14 08:24:12','[\"international\"]',NULL,1,'faculty',NULL,NULL),(33,'National','Dewleter',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-03-27','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-04-14 08:28:17','2025-04-14 08:28:17','[\"international\"]',NULL,1,'faculty',NULL,NULL),(34,'National','New delete',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-02','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744619452212-Whatsapp_Automation__1_.pdf','2025-04-14 08:30:50','2025-04-14 08:30:52','[\"international\"]',NULL,1,'faculty',NULL,NULL),(35,'National','mop',NULL,NULL,'Research Article','Q1',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-04-05','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1744620085923-Earthy_Origins.pdf','2025-04-14 08:41:24','2025-04-14 08:41:25','[\"international\"]',NULL,1,'faculty',NULL,NULL),(36,'National','06072025',NULL,NULL,'Review Article','Q3',NULL,NULL,1,'22','\"\\\"DST-FIST\\\"\"','2025-07-12','submitted',NULL,NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1751814201871-competitive_landscape_analysis.pdf','2025-07-06 15:03:20','2025-07-06 15:03:21','[]',NULL,1,'faculty',NULL,NULL),(37,'National','06072025',NULL,NULL,'Research Article','Q2',NULL,NULL,1,'32','\"\\\"MODROBS\\\"\"','2025-07-09','submitted',NULL,NULL,'Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1751814599153-competitive_landscape_analysis.pdf','2025-07-06 15:09:57','2025-07-06 15:09:59','[]',NULL,1,'faculty',NULL,NULL),(38,'National','0607000',NULL,NULL,'Research Article','Q1',153.000,9.000,0,NULL,'\"\\\"DST-FIST\\\"\"','2025-07-24','submitted',NULL,NULL,'Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'/uploads/journalform-articles/1751817108374-competitive_landscape_analysis.pdf','2025-07-06 15:51:46','2025-07-06 15:51:48','[]',NULL,1,'faculty',NULL,NULL),(39,'International','07072025',NULL,NULL,'Review Article','Q2',7.000,72.000,0,NULL,'\"\\\"MODROBS\\\"\"','2025-07-02','submitted',NULL,NULL,'Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-07-07 06:04:49','2025-07-07 06:04:49','[]',NULL,1,'faculty',NULL,NULL),(40,'National','07072025',NULL,NULL,'Research Article','Q3',12.000,12.000,0,NULL,'\"\\\"DST-FIST\\\"\"','2025-07-04','submitted',NULL,NULL,'Special Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-07-07 06:11:39','2025-07-07 06:11:39','[]',NULL,1,'faculty',NULL,NULL),(41,'National','07NewFOrm',NULL,NULL,'Review Article','Q1',12.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-07-10','submitted','as',NULL,'Regular Issue',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-07-11','2025-07-10',NULL,'2025-07-07 06:57:38','2025-07-07 06:57:38','[]',NULL,1,'faculty',NULL,NULL),(42,'National','070\\Afernoon',NULL,NULL,'Review Article','Q2',2.000,23.000,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"','2025-07-24','submitted','qwe','qw','Special Issue',12,12,NULL,NULL,NULL,NULL,'12','2025-07-02',NULL,NULL,'2025-07-07 07:25:00','2025-07-07 09:32:16','[]',NULL,1,'faculty',NULL,NULL),(43,'International','Newform 08072025',NULL,NULL,'Review Article','Q2',12.000,30.000,1,'123','\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"','2025-07-04','submitted','123','12','Special Issue',12,23,NULL,NULL,NULL,NULL,'50','2025-07-03','2025-07-13','/uploads/journalform-articles/1751951746632-competitive_landscape_analysis.pdf','2025-07-08 05:15:44','2025-07-08 05:15:46','[\"national\", \"state\"]',NULL,1,'faculty',NULL,NULL),(44,'National','NEW 12082025',NULL,NULL,'Research Article','Q2',21.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 05:54:55','2025-08-12 05:54:55','[\"national\"]',NULL,1,'faculty',NULL,NULL),(45,'National','NEW 120820255',NULL,NULL,'Research Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 06:10:05','2025-08-12 06:10:05','[\"national\"]',NULL,1,'faculty',NULL,NULL),(46,'National','NEWASDAs',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 06:15:56','2025-08-12 06:15:56','[\"national-research-labs\"]',NULL,1,'faculty',NULL,NULL),(47,'National','New INdto',NULL,NULL,'Research Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 06:22:16','2025-08-12 06:22:16','[\"state\"]',NULL,1,'faculty',NULL,NULL),(48,'National','NEWASd',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 06:34:54','2025-08-12 06:34:54','[\"national\"]',NULL,1,'faculty',NULL,NULL),(49,'National','Mopo',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 09:05:26','2025-08-12 09:05:26','[\"iits\"]',NULL,1,'faculty',NULL,NULL),(50,'National','Mopo',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 09:05:26','2025-08-12 09:05:26','[\"iits\"]',NULL,1,'faculty',NULL,NULL),(51,'National','M=NEw AUthor Fearute',NULL,NULL,'Review Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-12 10:28:13','2025-08-12 10:28:13','[\"national\"]',NULL,1,'faculty',NULL,NULL),(52,'National','Title',NULL,NULL,'Review Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":true,\\\"MODROBS\\\":false,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-21 06:25:59','2025-08-21 06:25:59','[\"state\"]',NULL,1,'faculty',NULL,NULL),(53,'National','asd',NULL,NULL,'Review Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-21 06:30:38','2025-08-21 06:30:38','[\"national\"]',NULL,1,'faculty',NULL,NULL),(54,'National','Titlr',NULL,NULL,'Article','Q2',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-28 09:50:52','2025-08-28 09:50:52','[\"national\"]',NULL,1,'faculty',NULL,NULL),(55,'National','ads',NULL,NULL,'Book Chapter','Q2',11.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-28 09:52:10','2025-08-28 09:52:10','[\"state\"]',NULL,1,'faculty',NULL,NULL),(56,'National','28082025',NULL,NULL,'Erratum','Q3',12.000,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-28 09:54:11','2025-08-28 09:54:11','[\"national\"]',NULL,1,'faculty',NULL,NULL),(57,'National','NEOPW280825',NULL,NULL,'Article','Q3',NULL,NULL,0,NULL,'\"{\\\"Nil\\\":false,\\\"DST-FIST\\\":false,\\\"MODROBS\\\":true,\\\"Others\\\":false}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-08-28 10:20:58','2025-08-28 10:20:58','[\"national\"]',NULL,1,'faculty',NULL,NULL),(58,'National','NEW DECEMBER',NULL,NULL,'Article','Q3',NULL,NULL,0,NULL,'\"{\\\"DST-FIST\\\":true}\"',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2025-11-29 04:26:55','2025-11-29 04:26:55','[\"IITs\"]',NULL,1,'faculty','[]',''),(59,'National','asd',NULL,NULL,'Editorial',NULL,NULL,NULL,NULL,NULL,'\"{\\\"DST-FIST\\\":true}\"','2025-11-03','underReview',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"1. No Poverty\", \"3. Good Health and Well-being\"]',NULL,NULL,NULL,NULL,'2025-11-29 04:58:49','2025-11-29 04:58:49','[\"International\", \"IITs\"]',NULL,1,'faculty','[]',''),(60,'National','NEW','TTILE',NULL,'Book Chapter',NULL,NULL,NULL,NULL,NULL,'\"{\\\"DST-FIST\\\":true}\"','2025-11-25','waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2025-11-29 05:00:14','2025-11-29 05:00:14','[\"IITs\"]',NULL,4,'faculty','[]',''),(61,'National','BOOK CHAPTER','Boook','{\"source\": \"AJANTa\", \"publisher\": \"NEWq\", \"print_isbn\": \"1231\", \"online_isbn\": \"123\"}','Book Chapter',NULL,NULL,NULL,NULL,NULL,'\"{\\\"DST-FIST\\\":true}\"','2025-12-24','waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2025-12-01 05:23:42','2025-12-01 05:23:42','[\"IITs\"]',NULL,5,'faculty','[]',''),(62,'National','TITLE',NULL,NULL,'Editorial',NULL,NULL,NULL,NULL,NULL,'\"{\\\"DST-FIST\\\":true}\"','2025-12-09','published','123',NULL,'Special Issue',NULL,NULL,'asasd','asDASDasd ASD:Knaksjdnkasjd asdkansdkjansdjknasdasdamn mnasdlknkjnkjnasd, asDASDasd ASD:Knaksjdnkasjd asdkansdkjansdjknasdasdamn mnasdlknkjnkjnasdasDASDasd ASD:Knaksjdnkasjd asdkansdkjansdjknasdasdamn mnasdlknkjnkjnasdasDASDasd ASD:Knaksjdnkasjd asdkansdkjansdjknasdasdamn mnasdlknkjnkjnasdasDASDasd ASD:Knaksjdnkasjd asdkansdkjansdjknasdasdamn mnasdlknkjnkjnasd','asd, asda,asdasd','[\"1. No Poverty\", \"6. Clean Water and Sanitation\"]','10.1109/ICACCS60874.2024.10717004','2025-12-10','2025-12-17','/uploads/journalform-articles/1764571061195-Tamil_paper__2_.pdf','2025-12-01 06:37:41','2025-12-01 06:37:41','[\"International\"]',NULL,1,'faculty','[\"111KSRCT007\"]','1 2, 3'),(63,'National','POP',NULL,NULL,'Erratum',NULL,NULL,NULL,NULL,NULL,'\"{\\\"DST-FIST\\\":true}\"','2025-12-01','published','123','nkjn','Special Issue',1,3,NULL,'asasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnasasasdaslkdaskjdnas','asd, asda,asdasd','[\"2. Zero Hunger\"]','10.1109/ICACCS60874.2024.10717004','2025-12-09','2025-12-11',NULL,'2025-12-01 07:39:30','2025-12-01 07:39:30','[\"NITs\"]',NULL,1,'faculty','[]','1, 2, 3'),(64,'National','JUST TEST',NULL,NULL,'Note',NULL,NULL,NULL,NULL,NULL,'{\"DST-FIST\": true}','2025-12-02','waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2025-12-01 08:25:17','2025-12-01 08:25:17','[\"International\"]',NULL,1,'student','[]',''),(65,'National','MOPOE',NULL,NULL,'Editorial',NULL,NULL,NULL,NULL,NULL,'{\"DST-FIST\": true}',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\"]',NULL,NULL,NULL,NULL,'2025-12-01 09:01:54','2025-12-01 09:01:54','[\"IITs\"]',NULL,1,'faculty','[]',''),(66,'National','MOPe',NULL,NULL,'Erratum',NULL,NULL,NULL,NULL,NULL,'{\"DST-FIST\": true}',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"2. Zero Hunger\", \"3. Good Health and Well-being\"]',NULL,NULL,NULL,NULL,'2025-12-01 09:17:35','2025-12-01 09:17:35','[\"International\"]','[{\"name\": \"Maheshwaran A K\", \"email\": null, \"state\": \"\", \"country\": \"India\", \"department\": \"IT\", \"is_primary\": false, \"organization\": \"Statix pro\", \"is_first_author\": false}]',1,'faculty','[]',''),(67,'National','NOPE',NULL,NULL,'Editorial','Q4',12.000,32.000,1,'123','{\"DST-FIST\": true}',NULL,'waiting',NULL,NULL,NULL,NULL,NULL,NULL,'','','[\"1. No Poverty\"]',NULL,NULL,NULL,NULL,'2025-12-01 09:38:07','2025-12-01 09:38:07','[\"IITs\"]','[{\"name\": \"Maheshwaran A K\", \"email\": null, \"state\": \"\", \"country\": \"India\", \"department\": \"asd\", \"is_primary\": false, \"organization\": \"Statix pro\", \"is_first_author\": false}]',1,'faculty','[]',''),(68,'National','Nope',NULL,NULL,'Editorial','Q3',12.000,33.000,0,NULL,'{\"DST-FIST\": true}','2025-12-04','published','123','133','Special Issue',3,4,NULL,'AI-powered helpdesk software for teams of all sizes\nEmpower your agents to enhance productivity, automate workflows, and deliver exceptional customer experiences – within Microsoft Teams or any tools you already use. Desk365 stands for better service, better products, and AI that truly delivers.  AI-powered helpdesk software for teams of all sizes\nEmpower your agents to enhance productivity, automate workflows, and deliver exceptional customer experiences – within Microsoft Teams or any tools you already use. Desk365 stands for better service, better products, and AI that truly delivers.  ','asd, asda,asdasd','[\"2. Zero Hunger\"]','10.1109/ICACCS60874.2024.10717004','2025-12-09','2025-12-04','/uploads/journalform-articles/1764582039602-Tamil_paper__2_.pdf','2025-12-01 09:40:39','2025-12-01 09:40:39','[\"International\"]',NULL,1,'faculty','[\"111KSRCT007\",\"111KSRCT004\"]','1, 2, 3');
/*!40000 ALTER TABLE `journals` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_collaborations`
--

LOCK TABLES `project_collaborations` WRITE;
/*!40000 ALTER TABLE `project_collaborations` DISABLE KEYS */;
INSERT INTO `project_collaborations` VALUES (32,24,'Agency PArtner','179-1, Kathayammal Nagar ,','Financial'),(33,24,'Agency PArtner','179-1, Kathayammal Nagar ,','Financial'),(74,49,'Industry','179-1, Kathayammal Nagar ,','Financial'),(77,70,'asd','179-1, Kathayammal Nagar ,','Technical'),(78,71,'Institute/Agency/Partner','Address','Financial'),(79,71,'Industry/I','AddressAddress','Other'),(81,74,'Industry','179-1, Kathayammal Nagar ,','Financial'),(90,74,'Industry','179-1, Kathayammal Nagar ,','Financial'),(133,73,'asd','asd','Financial'),(134,73,'zxc','qwqw','Other'),(135,73,'asd','asd','Financial'),(136,73,'zxc','qwqw','Other'),(137,73,'asd','asd','Financial'),(147,73,'zxc','qwqw','Other'),(168,73,'zxc','qwqw','Other'),(169,72,'Industry','179-1, Kathayammal Nagar ,','Financial'),(177,93,'Agency/Partner','161/94,Malaiadikuttai, Namakkal Road','Financial'),(178,93,'Agency/Partner','161/94,Malaiadikuttai, Namakkal Road','Financial'),(179,93,'Agency/Partner','161/94,Malaiadikuttai, Namakkal Road','Financial'),(180,93,'Agency/Partner','161/94,Malaiadikuttai, Namakkal Road','Financial'),(181,94,'Collaboreation','161/94,Malaiadikuttai, Namakkal Road','Financial'),(182,94,'Collaboreation','161/94,Malaiadikuttai, Namakkal Road','Financial'),(183,95,'Institute','Kathayammal Nagar ,','Financial'),(184,95,'Partner','161/94,Malaiadikuttai, Namakkal Road','Other'),(185,96,'asd','aaaaa','Financial'),(186,117,'Agency','161/94,Malaiadikuttai, Namakkal Road','Financial'),(187,140,'Institute','161/94,Malaiadikuttai, Namakkal Road','Financial'),(188,156,'Institute','Institute/Institute','Financial'),(189,196,'as','asda','Financial');
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
) ENGINE=InnoDB AUTO_INCREMENT=195 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_details`
--

LOCK TABLES `project_details` WRITE;
/*!40000 ALTER TABLE `project_details` DISABLE KEYS */;
INSERT INTO `project_details` VALUES (24,24,'2021-12-31','2025-10-22',1223.00,'2025-01-02','2024-07-13','2025-01-24','conference'),(48,49,'2025-01-01',NULL,12.00,NULL,NULL,NULL,'ipr'),(54,55,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(68,70,'2025-01-03',NULL,123.00,'2023-06-07',NULL,NULL,'conference'),(69,71,'2024-02-04','2023-06-10',123.00,'2023-07-21','2024-11-16','2025-02-07','conference'),(70,72,'2024-12-24','2025-02-01',13333.00,'2025-01-16','2025-01-21','2024-12-31','conference'),(71,73,'2025-01-28',NULL,NULL,'2025-02-03','2025-02-02',NULL,''),(72,74,'2024-12-24','2025-02-01',13333.00,'2025-01-16','2025-01-21','2024-12-31','conference'),(75,77,NULL,NULL,NULL,NULL,NULL,NULL,''),(77,79,NULL,NULL,NULL,NULL,NULL,NULL,''),(79,81,NULL,NULL,NULL,NULL,NULL,NULL,''),(80,82,NULL,NULL,NULL,NULL,NULL,NULL,''),(81,83,NULL,NULL,NULL,NULL,NULL,NULL,''),(82,84,NULL,NULL,NULL,NULL,NULL,NULL,''),(83,85,'2025-01-31',NULL,32.00,NULL,NULL,'2025-02-07','conference'),(86,88,NULL,NULL,NULL,NULL,NULL,NULL,''),(87,89,NULL,NULL,NULL,NULL,NULL,NULL,''),(88,90,NULL,NULL,NULL,NULL,NULL,NULL,''),(89,91,NULL,NULL,NULL,NULL,NULL,NULL,''),(90,92,NULL,NULL,NULL,NULL,NULL,NULL,''),(91,93,'2025-01-26',NULL,NULL,'2025-01-03',NULL,NULL,''),(92,94,NULL,NULL,122.00,NULL,NULL,NULL,'conference'),(93,95,'2024-11-25',NULL,NULL,'2023-05-27',NULL,NULL,'conference'),(94,96,'2025-01-21',NULL,55.00,NULL,NULL,'2025-01-06','conference'),(95,97,'2025-01-30',NULL,120.00,NULL,NULL,NULL,'technologyTransfer'),(96,98,'2025-01-29',NULL,NULL,NULL,NULL,NULL,'ipr'),(97,99,'2025-03-09',NULL,NULL,NULL,NULL,'2024-11-30','technologyTransfer'),(98,100,'2022-02-03',NULL,22.00,NULL,NULL,NULL,'ipr'),(99,101,NULL,NULL,NULL,'2025-02-27',NULL,NULL,'technologyTransfer'),(100,102,NULL,NULL,-1.00,NULL,NULL,NULL,'conference'),(101,103,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(103,105,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(104,106,'2025-02-26',NULL,NULL,NULL,NULL,NULL,'ipr'),(105,107,NULL,NULL,NULL,NULL,NULL,NULL,'conference, ipr'),(106,108,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(107,109,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(108,110,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(109,111,NULL,'2025-03-09',22.00,'2024-12-03',NULL,NULL,'technologyTransfer'),(110,112,NULL,NULL,NULL,NULL,NULL,NULL,''),(111,113,NULL,NULL,NULL,NULL,NULL,NULL,''),(112,114,NULL,NULL,NULL,NULL,NULL,NULL,''),(113,115,'2025-03-06','2025-04-17',3.00,'2025-02-28','2025-05-09','2025-04-25','conference'),(114,116,'2025-03-06','2025-04-17',3.00,'2025-02-28','2025-05-09','2025-04-25','conference'),(115,117,'2025-04-04','2025-04-08',8.00,'2025-04-11','2025-03-28','2025-04-17','conference'),(116,118,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(118,120,'2025-03-19',NULL,NULL,NULL,NULL,NULL,'conference'),(119,121,NULL,NULL,NULL,NULL,NULL,NULL,''),(120,122,NULL,NULL,NULL,NULL,NULL,NULL,''),(121,123,NULL,NULL,NULL,NULL,NULL,NULL,''),(122,124,NULL,NULL,NULL,NULL,NULL,NULL,''),(123,125,NULL,NULL,NULL,NULL,NULL,NULL,''),(124,126,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(125,127,'2025-04-10',NULL,NULL,NULL,NULL,NULL,'conference'),(126,128,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(127,129,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(128,130,NULL,NULL,NULL,NULL,NULL,NULL,''),(129,131,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(130,132,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(131,133,'2025-04-04',NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(132,134,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(134,136,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(135,137,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(136,138,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(137,139,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(138,140,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(139,141,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(140,142,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(141,143,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(142,144,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(143,145,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(144,146,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(145,147,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(146,148,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(147,149,NULL,NULL,NULL,NULL,NULL,NULL,''),(148,150,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(149,151,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(150,152,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(151,153,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(152,154,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(153,155,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(154,156,'2025-04-11','2025-04-11',4.00,'2025-03-20',NULL,NULL,'conference, technologyTransfer'),(155,157,'2025-05-01','2025-05-09',4.00,'2025-05-15','2025-05-09',NULL,'conference'),(156,158,NULL,NULL,22.00,NULL,NULL,NULL,'conference'),(157,159,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(158,160,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(159,161,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(160,162,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(161,163,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(162,164,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(167,169,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(168,170,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(169,171,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(170,172,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(171,173,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(172,174,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(173,175,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(174,176,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(175,177,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(176,178,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(177,179,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(178,180,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(179,181,NULL,NULL,NULL,NULL,NULL,NULL,'journals'),(180,182,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(181,183,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(182,184,NULL,NULL,NULL,NULL,NULL,NULL,'technologyTransfer'),(183,185,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(184,186,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(185,187,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(186,188,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(187,189,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(188,190,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(189,191,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(190,192,NULL,NULL,NULL,NULL,NULL,NULL,'journals'),(191,193,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(192,194,NULL,NULL,NULL,NULL,NULL,NULL,'conference'),(193,195,NULL,NULL,NULL,NULL,NULL,NULL,'ipr'),(194,196,'2025-07-19','2025-07-17',5.00,'2025-07-12','2025-04-11','2025-07-06','ipr');
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
) ENGINE=InnoDB AUTO_INCREMENT=217 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_documents`
--

LOCK TABLES `project_documents` WRITE;
/*!40000 ALTER TABLE `project_documents` DISABLE KEYS */;
INSERT INTO `project_documents` VALUES (10,24,'sanctionOrder','uploads/sanctionOrder/Vasanth Experience Letter.pdf'),(11,24,'utilizationCertificate','uploads/utilizationCertificate/Siva M - May Internship Offer .pdf'),(12,24,'statementOfExpenditure','uploads/statementOfExpenditure/Umesh Offer letter.pdf'),(13,24,'projectReport','uploads/projectReport/Savith Krishnan\'s Offer letter.pdf'),(14,24,'bankStatement','uploads/bankStatement/Sneha\'s Internship Offer Letter.pdf'),(27,70,'statementOfExpenditure','uploads/statementOfExpenditure/Dinesh Resume (1).pdf'),(28,71,'sanctionOrder','uploads/sanctionOrder/entropy-22-00522.pdf'),(29,71,'utilizationCertificate','uploads/utilizationCertificate/entropy-22-00522.pdf'),(30,71,'statementOfExpenditure','uploads/statementOfExpenditure/m.pdf'),(31,71,'projectReport','uploads/projectReport/sustainability-12-09490-v2.pdf'),(32,71,'bankStatement','uploads/bankStatement/Hari Kumaran Jadhagam.pdf'),(38,74,'sanctionOrder','uploads/sanctionOrder/Praveen Kumar G Offer Letter.pdf'),(39,74,'utilizationCertificate','uploads/utilizationCertificate/Savith Krishnan\'s Offer letter.pdf'),(40,74,'statementOfExpenditure','uploads/statementOfExpenditure/Siva M - May Internship Offer .pdf'),(41,74,'projectReport','uploads/projectReport/Umesh Offer letter.pdf'),(42,74,'bankStatement','uploads/bankStatement/Sneha\'s Internship Offer Letter.pdf'),(48,85,'statementOfExpenditure','uploads/statementOfExpenditure/Whatsapp Automation Comparison table.pdf'),(51,94,'statementOfExpenditure','uploads/statementOfExpenditure/neethikrishnan.pdf'),(52,95,'sanctionOrder','uploads/sanctionOrder/m.pdf'),(53,95,'projectReport','uploads/projectReport/DocScanner 27-Nov-2024 11-24 am.pdf'),(54,98,'statementOfExpenditure','uploads/statementOfExpenditure/Dinesh Resume (1).pdf'),(55,99,'sanctionOrder','uploads/sanctionOrder/resume.pdf'),(56,99,'projectReport','uploads/projectReport/KSRCT ADMISSION strategy.pdf'),(57,99,'bankStatement','uploads/bankStatement/Finalized Content Ideas- KSRCT - Google Sheets.pdf'),(58,100,'utilizationCertificate','uploads/utilizationCertificate/Earthy Origins.pdf'),(59,100,'statementOfExpenditure','uploads/statementOfExpenditure/MaheshwaranAkResume.pdf'),(60,100,'bankStatement','uploads/bankStatement/resume.pdf'),(61,101,'projectReport','uploads/projectReport/Content Ideas List.pdf'),(62,101,'bankStatement','uploads/bankStatement/neethikrishnan.pdf'),(63,102,'utilizationCertificate','uploads/utilizationCertificate/resume (1).pdf'),(64,102,'statementOfExpenditure','uploads/statementOfExpenditure/resume (2).pdf'),(65,103,'statementOfExpenditure','uploads/statementOfExpenditure/Mahesh Final  Resume.pdf'),(68,105,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(69,105,'projectReport','uploads/projectReport/AI Career Roadmap.pdf'),(70,106,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(71,106,'bankStatement','uploads/bankStatement/AI Career Roadmap.pdf'),(72,107,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(73,107,'projectReport','uploads/projectReport/hostl.pdf'),(74,108,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(75,108,'projectReport','uploads/projectReport/AI Career Roadmap.pdf'),(76,109,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(77,109,'projectReport','uploads/projectReport/AI Career Roadmap.pdf'),(78,110,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(79,110,'projectReport','uploads/projectReport/AI Career Roadmap.pdf'),(80,110,'statementOfExpenditure','uploads/statementOfExpenditure/1742824828982-215074270-hostl.pdf'),(81,110,'projectReport','uploads/projectReport/1742824829271-672134158-AI Career Roadmap.pdf'),(82,111,'utilizationCertificate','uploads/utilizationCertificate/Review Paper Suthi.pdf'),(83,111,'statementOfExpenditure','uploads/statementOfExpenditure/Banking System_dbms_mini project.pdf'),(84,111,'utilizationCertificate','uploads/utilizationCertificate/1743664835992-686007609-Review Paper Suthi.pdf'),(85,111,'statementOfExpenditure','uploads/statementOfExpenditure/1743664836628-51201905-Banking System_dbms_mini project.pdf'),(86,115,'sanctionOrder','uploads/sanctionOrder/Whatsapp Automation (1).pdf'),(87,115,'utilizationCertificate','uploads/utilizationCertificate/Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(88,115,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(89,115,'projectReport','uploads/projectReport/Mahesh Final  Resume.pdf'),(90,115,'bankStatement','uploads/bankStatement/Blue and Gray Simple Professional CV Resume.pdf'),(91,116,'sanctionOrder','uploads/sanctionOrder/Whatsapp Automation (1).pdf'),(92,116,'utilizationCertificate','uploads/utilizationCertificate/Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(93,116,'statementOfExpenditure','uploads/statementOfExpenditure/hostl.pdf'),(94,116,'projectReport','uploads/projectReport/Mahesh Final  Resume.pdf'),(95,116,'bankStatement','uploads/bankStatement/Blue and Gray Simple Professional CV Resume.pdf'),(96,117,'sanctionOrder','uploads/sanctionOrder/AI Career Roadmap.pdf'),(97,117,'utilizationCertificate','uploads/utilizationCertificate/Blue and Gray Simple Professional CV Resume.pdf'),(98,117,'statementOfExpenditure','uploads/statementOfExpenditure/Mahesh Final  Resume.pdf'),(99,117,'projectReport','uploads/projectReport/Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(100,117,'bankStatement','uploads/bankStatement/AI Career Roadmap.pdf'),(101,118,'statementOfExpenditure','uploads/statementOfExpenditure/Whatsapp Automation (1).pdf'),(102,118,'projectReport','uploads/projectReport/hostl.pdf'),(103,118,'bankStatement','uploads/bankStatement/Whatsapp Automation.pdf'),(107,120,'sanctionOrder','uploads/sanctionOrder/hostl.pdf'),(108,120,'projectReport','uploads/projectReport/Whatsapp Automation (1).pdf'),(109,120,'bankStatement','uploads/bankStatement/AI Career Roadmap.pdf'),(110,126,'utilizationCertificate','uploads/utilizationCertificate/hostl.pdf'),(111,126,'statementOfExpenditure','uploads/statementOfExpenditure/Mahesh Final  Resume.pdf'),(112,126,'projectReport','uploads/projectReport/Blue and Gray Simple Professional CV Resume.pdf'),(113,126,'bankStatement','uploads/bankStatement/AI Career Roadmap.pdf'),(114,127,'statementOfExpenditure','uploads/statementOfExpenditure/Mahesh Final  Resume.pdf'),(115,127,'projectReport','uploads/projectReport/Blue and Gray Simple Professional CV Resume.pdf'),(116,127,'bankStatement','uploads/bankStatement/AI Career Roadmap.pdf'),(117,128,'sanctionOrder','uploads/sanctionOrder/Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(118,128,'statementOfExpenditure','uploads/statementOfExpenditure/Mahesh Final  Resume.pdf'),(119,128,'projectReport','uploads/projectReport/MaheshwaranAkResume.pdf'),(120,129,'sanctionOrder','uploads/sanctionOrder/Whatsapp Automation (1).pdf'),(121,129,'bankStatement','uploads/bankStatement/hostl.pdf'),(122,129,'sanctionOrder','uploads/sanctionOrder/1743957916328-410923253-Whatsapp Automation (1).pdf'),(123,129,'bankStatement','uploads/bankStatement/1743957916466-267789278-hostl.pdf'),(124,130,'sanctionOrder','uploads/sanctionOrder/1743962398318-149437241-hostl.pdf'),(125,132,'projectReport','uploads/projectReport/Whatsapp Automation.pdf'),(126,132,'projectReport','uploads/projectReport/1744171302172-543031805-Whatsapp Automation.pdf'),(127,133,'bankStatement','uploads/bankStatement/Mahesh Final  Resume.pdf'),(128,133,'bankStatement','uploads/bankStatement/1744173649312-275419368-Mahesh Final  Resume.pdf'),(129,138,'sanctionLetter','uploads/sanctionLetter/1744177471195-454254802-Whatsapp Automation (1).pdf'),(130,138,'ucAndSoe','uploads/ucAndSoE/1744177472751-194735937-hostl.pdf'),(131,139,'sanctionOrder','uploads/sanctionOrder/AI Career Roadmap.pdf'),(132,139,'sanctionOrder','uploads/sanctionOrder/1744641166242-655659303-AI Career Roadmap.pdf'),(133,139,'sanctionLetter','uploads/sanctionLetter/1744641166548-449509220-AI Career Roadmap.pdf'),(134,139,'ucAndSoe','uploads/ucAndSoE/1744641166719-328666509-Meha 1.pdf'),(135,140,'projectReport','uploads/projectReport/hostl.pdf'),(136,140,'bankStatement','uploads/bankStatement/Mahesh Final  Resume.pdf'),(137,140,'projectReport','uploads/projectReport/1744642635493-150122797-hostl.pdf'),(138,140,'bankStatement','uploads/bankStatement/1744642635751-969949946-Mahesh Final  Resume.pdf'),(139,140,'sanctionLetter','uploads/sanctionLetter/1744642635982-984246272-hostl.pdf'),(140,140,'ucAndSoe','uploads/ucAndSoE/1744642636309-711728896-Whatsapp Automation (1).pdf'),(141,141,'statementOfExpenditure','uploads/statementOfExpenditure/1744643577263-565475273-Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(142,141,'statementOfExpenditure','uploads/statementOfExpenditure/1744643582493-76372787-Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(143,141,'sanctionLetter','uploads/sanctionLetter/1744643582671-151419462-Earthy Origins.pdf'),(144,142,'statementOfExpenditure','uploads/statementOfExpenditure/1744644425358-471720555-Permission_for_Girls_Student.pdf'),(145,142,'statementOfExpenditure','uploads/statementOfExpenditure/1744644445960-363719750-Permission for Girls Student.pdf'),(146,142,'sanctionLetter','uploads/sanctionLetter/1744644446411-605477915-Guruprasad\'s Offer Letter.pdf'),(147,142,'ucAndSoe','uploads/ucAndSoE/1744644446636-423710783-Vasanthakumaran\'s Offer Letter.pdf'),(148,143,'bankStatement','uploads/bankStatement/1744647418611-840490658-Siva M - May Internship Offer .pdf'),(149,143,'bankStatement','uploads/bankStatement/1744647432351-277816619-Siva M - May Internship Offer .pdf'),(150,143,'sanctionLetter','uploads/sanctionLetter/1744647432849-94132395-Subithra Offer Permission Letter.pdf'),(151,143,'ucAndSoe','uploads/ucAndSoE/1744647433119-120207936-Vasanth Experience Letter.pdf'),(152,144,'bankStatement','uploads/bankStatement/Sanjunaa\'s Internship Offer Letter.pdf'),(153,145,'bankStatement','uploads/bankStatement/Sanjunaa\'s Internship Offer Letter.pdf'),(154,145,'bankStatement','uploads/bankStatement/1744649735265-218507475-Sanjunaa\'s Internship Offer Letter.pdf'),(155,145,'sanctionLetter','uploads/sanctionLetter/1744649735408-510619571-Sahana\'s Offer letter.pdf'),(156,145,'ucAndSoe','uploads/ucAndSoE/1744649735771-513151909-Internship Offer Letter Statixpro - Feb.pdf'),(157,146,'sanctionLetter','uploads/sanctionLetter/1744650284048-548462767-Siva M - May Internship Offer .pdf'),(158,148,'statementOfExpenditure','uploads/statementOfExpenditure/1744651998345-819913421-Harini S K Internship Certificate.pdf'),(159,148,'statementOfExpenditure','uploads/statementOfExpenditure/1744652007972-877930204-Harini S K Internship Certificate.pdf'),(160,149,'statementOfExpenditure','uploads/statementOfExpenditure/1744652489188-312159285-Pavithra S Nov-Dec Internship Certificate.pdf'),(161,150,'sanctionOrder','uploads/sanctionOrder/1744653069407-899102443-Kavipriya V Internship Certificate.pdf'),(162,150,'sanctionOrder','uploads/sanctionOrder/1744653078530-666256919-Kavipriya V Internship Certificate.pdf'),(163,150,'sanctionLetter','uploads/sanctionLetter/1744653078620-986285061-Meha Sri M A Internship Certificate.pdf'),(164,151,'utilizationCertificate','uploads/utilizationCertificate/1744654424215-187821143-Praveen Kumar G Internship Certificate.pdf'),(165,151,'utilizationCertificate','uploads/utilizationCertificate/1744654432275-889836484-Praveen Kumar G Internship Certificate.pdf'),(166,151,'sanctionLetter','uploads/sanctionLetter/1744654432789-639763571-Lokesh S Internship Certificate.pdf'),(167,151,'ucAndSoe','uploads/ucAndSoE/1744654433006-935265504-Manikandan V Internship Certificate.pdf'),(168,152,'statementOfExpenditure','uploads/statementOfExpenditure/1744654857855-491030336-Manikandan V Internship Certificate.pdf'),(169,152,'statementOfExpenditure','uploads/statementOfExpenditure/1744654869894-788302961-Manikandan V Internship Certificate.pdf'),(170,152,'sanctionLetter','uploads/sanctionLetter/1744654870174-60325761-Yuvaraj P Internship Certificate.pdf'),(171,153,'sanctionLetter','uploads/sanctionLetter/1744655392343-44363585-Nithesh T  Internship Certificate.pdf'),(172,154,'projectReport','uploads/projectReport/1744656135688-870335099-Subithra S S Internship Certificate.pdf'),(173,154,'projectReport','uploads/projectReport/1744656138185-209665151-Subithra S S Internship Certificate.pdf'),(174,155,'statementOfExpenditure','uploads/statementOfExpenditure/1744656774768-535963845-Subithra S S Internship Certificate.pdf'),(175,156,'sanctionOrder','uploads/sanctionOrder/1745907676197-447008889-MAHESHWARAN A K.pdf'),(176,156,'projectReport','uploads/projectReport/1745907684553-128842108-Maheshwaran_AK_Resume_Final.pdf'),(177,156,'bankStatement','uploads/bankStatement/1745907698018-451344386-b5f2fdd6-91b5-4765-a139-ffd226054263.pdf'),(178,156,'sanctionOrder','uploads/sanctionOrder/1745907699797-993122425-MAHESHWARAN A K.pdf'),(179,156,'projectReport','uploads/projectReport/1745907699924-790648040-Maheshwaran_AK_Resume_Final.pdf'),(180,156,'bankStatement','uploads/bankStatement/1745907700008-955681295-b5f2fdd6-91b5-4765-a139-ffd226054263.pdf'),(181,156,'sanctionLetter','uploads/sanctionLetter/1745907700124-864645706-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf'),(182,156,'ucAndSoe','uploads/ucAndSoE/1745907700372-956907137-Untitled document (1).pdf'),(183,157,'sanctionOrder','uploads/sanctionOrder/1746623613261-482208990-Untitled document (1).pdf'),(184,157,'utilizationCertificate','uploads/utilizationCertificate/1746623628336-462924449-MAHESHWARAN A K.pdf'),(185,157,'statementOfExpenditure','uploads/statementOfExpenditure/1746623636922-360954119-Maheshwaran_AK_Resume_Final.pdf'),(186,157,'projectReport','uploads/projectReport/1746623623029-711189511-Untitled document (1).pdf'),(187,157,'bankStatement','uploads/bankStatement/1746623644167-835961221-hostl.pdf'),(188,157,'sanctionOrder','uploads/sanctionOrder/1746623655454-293546222-Untitled document (1).pdf'),(189,157,'utilizationCertificate','uploads/utilizationCertificate/1746623655563-575905932-MAHESHWARAN A K.pdf'),(190,157,'statementOfExpenditure','uploads/statementOfExpenditure/1746623655702-398129790-Maheshwaran_AK_Resume_Final.pdf'),(191,157,'projectReport','uploads/projectReport/1746623655749-696481141-Untitled document (1).pdf'),(192,157,'bankStatement','uploads/bankStatement/1746623655848-766542444-hostl.pdf'),(193,157,'sanctionLetter','uploads/sanctionLetter/1746623656139-5047019-Suthi Invoice .pdf'),(194,157,'ucAndSoe','uploads/ucAndSoE/1746623656364-160228959-Suthi Bill.pdf'),(195,158,'projectReport','uploads/projectReport/1746689209054-784779448-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf'),(196,158,'projectReport','uploads/projectReport/1746689218817-982989291-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf'),(197,158,'sanctionLetter','uploads/sanctionLetter/1746689219113-373147281-Suthi Invoice .pdf'),(198,159,'sanctionLetter','uploads/sanctionLetter/1746692049048-385472999-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf'),(199,159,'ucAndSoe','uploads/ucAndSoE/1746692196420-750602600-Untitled document (1).pdf'),(200,159,'ucAndSoe','uploads/ucAndSoe/1746694563098-586820396-hostl.pdf'),(201,159,'ucAndSoe','uploads/ucAndSoE/1746694827455-17884772-Untitled document (1).pdf'),(202,160,'sanctionLetter','uploads/sanctionLetter/1746694948823-798359634-Suthi Invoice .pdf'),(203,160,'ucAndSoe','uploads/ucAndSoE/1746694948894-449384777-Suthi Bill.pdf'),(204,160,'sanctionLetter','uploads/sanctionLetter/1746697122632-754398524-Whatsapp Automation.pdf'),(205,160,'ucAndSoe','uploads/ucAndSoE/1746697122789-851138642-Mahesh Final  Resume.pdf'),(206,161,'utilizationCertificate','uploads/utilizationCertificate/1746697293330-85033024-MAHESHWARAN A K.pdf'),(207,161,'utilizationCertificate','uploads/utilizationCertificate/1746697299612-424650008-MAHESHWARAN A K.pdf'),(208,161,'sanctionLetter','uploads/sanctionLetter/1746697299656-856202058-Todo.pdf'),(209,161,'ucAndSoe','uploads/ucAndSoE/1746697299700-862138917-Suthi Invoice .pdf'),(210,162,'sanctionLetter','uploads/sanctionLetter/1746699958767-625047926-Suthi Invoice .pdf'),(211,162,'ucAndSoe','uploads/ucAndSoE/1746699958955-443341315-Suthi Bill.pdf'),(212,163,'sanctionLetter','uploads/sanctionLetter/1746711771173-40790541-Todo.pdf'),(215,196,'sanctionOrder','uploads/sanctionOrder/1752737549203-726042144-Agricultural Drone.pdf'),(216,196,'projectReport','uploads/projectReport/1752737549408-956046289-AixonAI - The 90-Day Career Breakthrough System.pdf');
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
) ENGINE=InnoDB AUTO_INCREMENT=1365 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_financial_contributions`
--

LOCK TABLES `project_financial_contributions` WRITE;
/*!40000 ALTER TABLE `project_financial_contributions` DISABLE KEYS */;
INSERT INTO `project_financial_contributions` VALUES (33,24,'Agency Name',1256.00,1),(58,49,'Mona',998.00,1),(59,49,'aseynt',55.00,1),(65,55,'ase',333.00,1),(80,70,'qwedf',12.00,1),(81,71,'DuckDuckGo AI Chat',1230.00,1),(82,71,'Aiop',546.00,2),(90,77,'21',12.00,1),(92,79,'asda',12.00,1),(94,81,'asd',12.00,2),(95,82,'asd',12.00,2),(96,83,'asd',12.00,1),(97,84,'sa',12.00,2),(962,73,'New agency',5000.00,NULL),(1249,72,'SAlem Branch',14994.00,1),(1250,72,'NOpe Branch',5000.00,2),(1251,85,'Mokl',100.00,NULL),(1252,85,'Agency',200.00,NULL),(1255,88,'ads',1221.00,NULL),(1256,89,'asd',-2.00,NULL),(1257,90,'s',198.00,NULL),(1258,91,'asd',100.00,NULL),(1259,92,'asd',99.00,NULL),(1260,93,'21asd',1220.00,1),(1261,94,'asdasd',100.00,1),(1262,95,'New Agency',1200.00,1),(1263,96,'saf',10.00,1),(1264,97,'sadasd',1222.00,1),(1265,98,'neq',100.00,1),(1266,74,'saaa',2565.00,1),(1267,99,'dss',100.00,1),(1268,100,'Agency',100.00,1),(1269,101,'Agency',100.00,1),(1270,102,'22',22.00,1),(1271,103,'Agency',3.00,1),(1273,105,'Agency',115.00,1),(1274,106,'Type',118.00,6),(1275,107,'Agency',15475.00,1),(1276,108,'Agency',122.00,1),(1277,109,'Agency',100.00,1),(1278,110,'wae',-1.00,5),(1279,111,'Type',117.00,5),(1280,112,'Montenry',141.00,5),(1281,113,'Product',1234.00,7),(1282,114,'Montiry',1450.00,5),(1283,115,'asd',100.00,NULL),(1284,116,'asd',100.00,5),(1285,117,'Mop',119.00,5),(1286,118,'xzc',12.00,5),(1288,120,'2',12.00,5),(1289,121,'12',100.00,5),(1290,122,'wsd',123.00,NULL),(1291,123,'asd',100.00,NULL),(1292,124,'asd',100.00,8),(1293,125,'1',-4.00,8),(1294,126,'Moas',45.00,2),(1295,127,'123',1230.00,5),(1296,128,'1',1.00,5),(1297,129,'op',12.00,5),(1298,130,'sa',2.00,5),(1299,131,'km',123.00,5),(1300,132,'sfd',12.00,5),(1301,133,'14',10.00,5),(1302,134,'120',96.00,5),(1304,136,'14',3.00,5),(1305,137,'m',10.00,5),(1306,138,'mop',3.00,5),(1307,139,'100',200.00,5),(1308,140,'14',100.00,5),(1309,141,'12',10.00,5),(1310,142,'55',22.00,5),(1311,143,'sa',12.00,5),(1312,144,'on',12.00,NULL),(1313,145,'on',12.00,5),(1314,146,'oas',12.00,5),(1315,147,'123',123.00,5),(1316,148,'123',21.00,5),(1317,149,'asd',104.00,3),(1318,150,'asd',100.00,5),(1319,151,'213',21.00,5),(1320,152,'as',100.00,5),(1321,153,'km',10.00,5),(1322,154,'12',10.00,5),(1323,155,'12',323.00,5),(1324,156,'Agency',1196.00,1),(1325,157,'120',16.00,3),(1326,158,'mki',120.00,5),(1327,159,'102',4.00,5),(1328,160,'Mopuert',11995.00,7),(1329,161,'Mopo',2.00,7),(1330,162,'aert',123.00,5),(1331,163,'Mopo',123.00,5),(1332,164,'Mopo',123.00,5),(1337,169,'mop',102.00,5),(1338,170,'Ageny',120.00,5),(1339,171,'s',2.00,7),(1340,172,'asd',120.00,5),(1341,173,'Agency Noone',1200.00,5),(1342,174,'Mopo',4.00,5),(1343,175,'Agent',3.00,5),(1344,176,'12',21.00,5),(1345,177,'mo',120.00,5),(1346,178,'Nop',3.00,5),(1347,179,'agent',111.00,1),(1348,180,'aser',123.00,5),(1349,181,'Agent',4.00,1),(1350,182,'agen',1203.00,5),(1351,183,'Agent',20.00,5),(1352,184,'Nop',12.00,5),(1353,185,'12',100.00,5),(1354,186,'asd',12.00,5),(1355,187,'asmo',123.00,5),(1356,188,'f',3.00,5),(1357,189,'w',32.00,5),(1358,190,'as',123.00,5),(1359,191,'qw',1.00,5),(1360,192,'12',4.00,5),(1361,193,'wer',23.00,5),(1362,194,'f',3.00,5),(1363,195,'as',23.00,5),(1364,196,'sdasd',120.00,5);
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
) ENGINE=InnoDB AUTO_INCREMENT=290 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_grant_disbursements`
--

LOCK TABLES `project_grant_disbursements` WRITE;
/*!40000 ALTER TABLE `project_grant_disbursements` DISABLE KEYS */;
INSERT INTO `project_grant_disbursements` VALUES (13,24,'2012','Agency Name',1234.00,'2025-01-24','uploads/sanctionLetter1/Kiruthikaa\'s Internship Offer Letter.pdf','uploads/ucAndSoE1/Praveen Kumar G Offer Letter.pdf'),(14,24,NULL,'Agency Name',1234.00,NULL,NULL,NULL),(78,49,'2002','Agency in',21.00,'2024-12-31',NULL,NULL),(79,49,'2003','Agencyop',112.00,'2021-05-04',NULL,NULL),(80,49,NULL,'Agency in',21.00,NULL,NULL,NULL),(81,49,NULL,'Agencyop',112.00,NULL,NULL,NULL),(93,55,'23','amboo',1222.00,'2024-12-25',NULL,NULL),(94,55,NULL,'amboo',1222.00,NULL,NULL,NULL),(120,70,'222','asd',12.00,'2024-12-31','uploads/sanctionLetter1/m.pdf',NULL),(121,71,'32','open-source Llama ',123.00,'2024-03-29','uploads/sanctionLetter1/m.pdf','uploads/ucAndSoE1/Skill Training Schedule - SCS.pdf'),(122,71,'2018','No AI training on',529.00,'2023-03-16',NULL,NULL),(125,74,'121','Agency',100.00,'2025-01-16','uploads/sanctionLetter1/Dharani\'s Offer letter.pdf','uploads/ucAndSoE1/Kiruthikaa\'s Internship Offer Letter.pdf'),(128,77,NULL,NULL,NULL,NULL,NULL,NULL),(130,79,NULL,NULL,NULL,NULL,NULL,NULL),(132,81,NULL,NULL,NULL,NULL,NULL,NULL),(133,82,NULL,NULL,NULL,NULL,NULL,NULL),(134,83,NULL,NULL,NULL,NULL,NULL,NULL),(135,84,NULL,NULL,NULL,NULL,NULL,NULL),(148,73,NULL,'sdf',23.00,NULL,NULL,NULL),(149,72,NULL,'Agency',100.00,NULL,NULL,NULL),(150,85,'100','Agency',100.00,'2025-01-17','uploads/sanctionLetter1/Dinesh Resume (1).pdf',NULL),(153,88,NULL,NULL,NULL,NULL,NULL,NULL),(154,89,NULL,NULL,NULL,NULL,NULL,NULL),(155,90,NULL,NULL,NULL,NULL,NULL,NULL),(156,91,NULL,NULL,NULL,NULL,NULL,NULL),(157,92,NULL,NULL,NULL,NULL,NULL,NULL),(158,93,NULL,NULL,NULL,NULL,NULL,NULL),(159,93,NULL,'Moaka',123.00,NULL,NULL,NULL),(160,94,'1','asda',7.00,'2024-12-12','uploads/sanctionLetter1/Dinesh Resume (1).pdf',NULL),(161,95,'2002','Agency 2',13.00,'2025-01-09','uploads/sanctionLetter1/Dinesh Resume (1).pdf',NULL),(163,95,'2023','Two Agency',500.00,'2024-12-18',NULL,'uploads/ucAndSoE2/Dinesh Resume (1).pdf'),(168,95,'12','asdasd',12.00,'2025-01-28',NULL,NULL),(186,96,'2003','AgencyAgency',5.00,'2025-01-15',NULL,NULL),(189,97,'123','asdas',100.00,'2025-02-04',NULL,NULL),(190,93,NULL,'Oppmon',123.00,NULL,NULL,NULL),(191,93,NULL,'Popo',8.00,NULL,NULL,NULL),(192,98,'100','Lopemi',2300.00,'2025-02-05','uploads/sanctionLetter1/Dinesh Resume (1).pdf',NULL),(193,98,'230','lope',560.00,'2025-01-29','',''),(194,98,NULL,'lope',560.00,NULL,NULL,NULL),(195,99,'2001','agent',15.00,'2022-06-16','uploads/sanctionLetter1/resume (3).pdf',NULL),(196,100,'100','Agency',5.00,'2025-03-10',NULL,NULL),(197,101,'11','Ageny',1200.00,'2024-11-08',NULL,NULL),(198,102,'12','Moan',4.00,'2024-02-15','uploads/sanctionLetter1/resume (3).pdf',NULL),(199,103,'11','as',10.00,'2025-02-25',NULL,NULL),(201,105,'10','2',12.00,'2025-03-04',NULL,NULL),(202,106,'21','12',11.00,'2025-03-05',NULL,NULL),(203,107,'10','Agency',100.00,'2025-01-21',NULL,NULL),(204,108,'201','THe code',123.00,'2025-03-13',NULL,NULL),(205,109,'20','Agenc',114.00,'2025-03-05',NULL,NULL),(206,110,'120','Mop',4.00,'2025-03-02',NULL,NULL),(207,111,'2001','Polop',3.00,'2025-04-17','uploads/sanctionLetter1/block chain technology on food based comapny.pptx',NULL),(208,112,NULL,NULL,NULL,NULL,NULL,NULL),(209,113,NULL,NULL,NULL,NULL,NULL,NULL),(210,114,NULL,NULL,NULL,NULL,NULL,NULL),(211,115,'12','Mopm',1000.00,'2025-03-13','uploads/sanctionLetter1/Banking System_dbms_mini project.pdf','uploads/ucAndSoE1/block chain technology on food based comapny.pptx'),(212,116,'12','Mopm',1000.00,'2025-03-13','uploads/sanctionLetter1/Banking System_dbms_mini project.pdf','uploads/ucAndSoE1/block chain technology on food based comapny.pptx'),(213,117,'100','Agency',111.00,'2025-04-02','uploads/sanctionLetter1/hostl.pdf','uploads/ucAndSoE1/Whatsapp Automation (1).pdf'),(214,118,'12 ','2',22.00,'2025-04-03','uploads/sanctionLetter1/hostl.pdf',NULL),(216,120,'12','10',55.00,'2025-03-13','uploads/sanctionLetter1/hostl.pdf',NULL),(217,121,NULL,NULL,NULL,NULL,NULL,NULL),(218,122,NULL,NULL,NULL,NULL,NULL,NULL),(219,123,NULL,NULL,NULL,NULL,NULL,NULL),(220,124,NULL,NULL,NULL,NULL,NULL,NULL),(221,125,NULL,NULL,NULL,NULL,NULL,NULL),(222,126,'10','Mop',100.00,'2025-04-10',NULL,'uploads/ucAndSoE1/Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf'),(223,127,'12','asd',456.00,'2025-04-01','uploads/sanctionLetter1/hostl.pdf',NULL),(224,128,'10','jk',20.00,'2025-04-01','uploads/sanctionLetter1/Whatsapp Automation.pdf',NULL),(225,129,'12','sda',123.00,'2025-04-01',NULL,NULL),(226,131,'100','Mopo',4.00,'2025-02-18','uploads/sanctionLetter1/Whatsapp Automation (1).pdf',NULL),(227,132,'10','mop',4.00,'2025-02-12','uploads/sanctionLetter1/AI Career Roadmap.pdf','uploads/ucAndSoE1/Whatsapp Automation.pdf'),(228,133,'1','2',1.00,'2025-04-03','uploads/sanctionLetter/hostl.pdf','uploads/ucAndSoE/AI Career Roadmap.pdf'),(229,134,'10','ads',2.00,'2025-04-01','uploads/sanctionLetter/Whatsapp Automation.pdf','uploads/ucAndSoE/MaheshwaranAkResume.pdf'),(231,136,'11','mk',100.00,'2025-04-01','uploads/sanctionLetter/Whatsapp Automation (1).pdf','uploads/ucAndSoE/AI Career Roadmap.pdf'),(232,137,'10','jn',100.00,'2025-04-03','uploads/sanctionLetter/Whatsapp Automation (1).pdf','uploads/ucAndSoE/AI Career Roadmap.pdf'),(233,138,'12','mop',3.00,'2025-03-13','uploads/sanctionLetter/Whatsapp Automation (1).pdf','uploads/ucAndSoE/hostl.pdf'),(234,139,'10','Agency',45.00,'2025-04-01','uploads/sanctionLetter/AI Career Roadmap.pdf','uploads/ucAndSoE/Meha 1.pdf'),(235,140,'1','agency',2.00,'2025-04-03','uploads/sanctionLetter/hostl.pdf','uploads/ucAndSoE/Whatsapp Automation (1).pdf'),(236,141,'10','Agency',2.00,'2025-04-02','uploads/sanctionLetter/1744643538570-516858033-Earthy Origins.pdf',NULL),(237,142,'20','Agent',10.00,'2025-03-11','uploads/sanctionLetter/1744644393219-7345774-Guruprasad\'s_Offer_Letter.pdf','uploads/ucAndSoE/1744644407659-658876153-Vasanthakumaran\'s_Offer_Letter.pdf'),(238,143,'21','sd',123.00,'2025-04-02','uploads/sanctionLetter/1744647388205-474445430-Subithra Offer Permission Letter.pdf','uploads/ucAndSoE/1744647395176-38177841-Vasanth Experience Letter.pdf'),(239,144,'10','Agency',2.00,'2025-04-03','uploads/sanctionLetter/Sahana\'s Offer letter.pdf','uploads/ucAndSoE/Internship Offer Letter Statixpro - Feb.pdf'),(240,145,'10','Agency',2.00,'2025-04-03','uploads/sanctionLetter/Sahana\'s Offer letter.pdf','uploads/ucAndSoE/Internship Offer Letter Statixpro - Feb.pdf'),(241,146,'12','asd',123.00,'2025-04-08','uploads/sanctionLetter/1744650273412-634646982-Siva M - May Internship Offer .pdf',NULL),(242,147,'20','jh',20.00,'2025-04-02','uploads/sanctionLetter/1744650946049-152992714-Shanmugaraj Y Internship Certificate.pdf','uploads/ucAndSoE/1744650939897-163626473-Divya Bharathi G Internship Certificate.pdf'),(243,148,'10','Agency',4.00,'2025-04-03','',''),(244,150,'10','12',10.00,'2025-04-08','uploads/sanctionLetter/1744653057022-635600122-Meha Sri M A Internship Certificate.pdf',NULL),(245,151,'10','jn',0.00,'2025-04-03','uploads/sanctionLetter/1744654411918-305338174-Lokesh S Internship Certificate.pdf','uploads/ucAndSoE/1744654417579-562125123-Manikandan V Internship Certificate.pdf'),(246,152,'asd','sa',123.00,'2025-04-15','uploads/sanctionLetter/1744654846607-287802901-Yuvaraj P Internship Certificate.pdf',NULL),(247,153,'Fy','Agent',2.00,'2025-04-01','uploads/sanctionLetter/1744655381307-223381724-Nithesh T  Internship Certificate.pdf',NULL),(248,154,'12','kk',1.00,'2025-04-03','uploads/sanctionLetter/1744656123905-90523197-Libisena P S Internship Certificate.pdf','uploads/ucAndSoE/1744656129042-189850809-Mohanraj R Internship Certificate.pdf'),(249,155,'12','asd',1.00,'2025-04-09','uploads/sanctionLetter/1744656766716-774750515-Sanjai K R Internship Certificate.pdf',NULL),(250,156,'10','Agency',250.00,'2025-04-10','uploads/sanctionLetter/1745907655585-527649595-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf','uploads/ucAndSoE/1745907663307-635488858-Untitled document (1).pdf'),(251,157,'12','Mop',4.00,'2025-05-08','uploads/sanctionLetter/1746623583449-164615690-Suthi Invoice .pdf','uploads/ucAndSoE/1746623599949-782019303-Suthi Bill.pdf'),(252,158,'01','Mopone',4.00,'2025-05-09','uploads/sanctionLetter/1746689192977-713910954-Suthi Invoice .pdf',NULL),(253,159,'10','Agency',5.00,'2025-04-29','uploads/sanctionLetter/1746692043945-437836443-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf',NULL),(254,160,'20','Mopio',4.00,'2025-05-09','uploads/sanctionLetter/1746694924024-511180921-Suthi Invoice .pdf','uploads/ucAndSoE/1746694929733-462590238-Suthi Bill.pdf'),(255,161,'10','Mopi',3.00,'2025-05-14','uploads/sanctionLetter/1746697272551-379655156-Todo.pdf','uploads/ucAndSoE/1746697277584-753601857-Suthi Invoice .pdf'),(256,162,'12','agency',3.00,'2025-05-07','uploads/sanctionLetter/1746699943650-369010130-Suthi Invoice .pdf','uploads/ucAndSoE/1746699951980-304540079-Suthi Bill.pdf'),(257,163,'120','Mopiet',7.00,'2025-05-28','',NULL),(258,164,'10','Mopo',5.00,'2025-05-13','',''),(261,169,'20','aency',3.00,'2025-05-11',NULL,NULL),(262,170,'25','Mopo',4.00,'2025-05-14','uploads/sanctionLetter/1746859557848-514212363-Suthi Invoice .pdf','uploads/ucAndSoE/1746859563102-212937119-Suthi Bill.pdf'),(263,171,'10','asge',20.00,'2025-05-19','uploads/sanctionLetter/1746860497914-323554960-Untitled document (1).pdf','uploads/ucAndSoE/1746860502693-30680437-The HTSDL Model Hybrid Temporal-Spatial Deep Learning for Stock Prediction.pdf'),(264,172,'23','df',2.00,'2025-05-07','uploads/sanctionLetter/1746862848891-222747731-Suthi Invoice .pdf','uploads/ucAndSoE/1746862852289-362730240-Suthi Bill.pdf'),(265,173,'102','Agenc',4.00,'2025-05-06','uploads/sanctionLetter/1747027323173-352021331-Suthi Invoice .pdf','uploads/ucAndSoE/1747027327389-917183456-Suthi Bill.pdf'),(266,174,'10','Agency',120.00,'2025-05-08','uploads/sanctionLetter/1747028316569-590565752-Suthi Invoice .pdf','uploads/ucAndSoE/1747028320773-316347350-Suthi Bill.pdf'),(267,175,'10','Agent',3.00,'2025-05-03','uploads/sanctionLetter/1747028874672-233917279-Suthi Invoice .pdf','uploads/ucAndSoE/1747028878750-165078026-Suthi Bill.pdf'),(268,176,'10','Agenct',10.00,'2025-05-08','uploads/sanctionLetter/1747029279565-273189105-Todo.pdf',NULL),(269,177,'10','Agent',3.00,'2025-05-14','uploads/sanctionLetter/1747031008548-850837584-Suthi Invoice .pdf',NULL),(270,178,'10','Agency',5.00,'2025-05-06','uploads/sanctionLetter/1747031247889-716895744-Todo.pdf',NULL),(271,179,'w','sd',123.00,'2025-05-13',NULL,NULL),(272,180,'12','Agent',3.00,'2025-05-16',NULL,NULL),(273,181,'12','Agent',4.00,'2025-05-13',NULL,NULL),(274,182,NULL,NULL,NULL,NULL,'/uploads/sanctionLetter/1747119211567-95200933-Suthi Bill.pdf',NULL),(275,183,'12','Agen',3.00,'2025-05-01',NULL,NULL),(276,184,'2','Agent',3.00,'2025-05-07',NULL,NULL),(277,185,'33','Agent',213.00,'2025-05-15',NULL,NULL),(278,186,'fy','Afeg',12.00,'2025-05-14',NULL,NULL),(279,186,NULL,NULL,NULL,NULL,NULL,'/uploads/ucAndSoE/1747121321379-209508220-Suthi Bill.pdf'),(280,187,'12','agency',4.00,'2025-05-09',NULL,NULL),(281,188,'a','1',2.00,'2025-05-15',NULL,NULL),(282,189,'aw','ads',13.00,'2025-05-17',NULL,NULL),(283,190,'12','ad',123.00,'2025-05-08',NULL,NULL),(284,191,'1','ag',2.00,'2025-05-15',NULL,NULL),(285,192,'2','sdf',2.00,'2025-05-16',NULL,NULL),(286,193,'2','d',2.00,'2025-05-14',NULL,NULL),(287,194,'r','23',13.00,'2025-05-16','',''),(288,194,NULL,'23',13.00,NULL,'/uploads/sanctionLetter/1747206592231-954209823-Suthi Invoice .pdf','/uploads/ucAndSoE/1747206592897-841054117-Suthi Bill.pdf'),(289,195,'23','sdf',32.00,'2025-05-09','/uploads/sanctionLetter/1747208399851-98912028-Suthi Invoice .pdf','/uploads/ucAndSoE/1747208411863-951492100-Suthi Bill.pdf');
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_requests`
--

LOCK TABLES `project_requests` WRITE;
/*!40000 ALTER TABLE `project_requests` DISABLE KEYS */;
INSERT INTO `project_requests` VALUES (1,1,'agency','NEw AGENCT','asdasd','pending',NULL,'2025-08-05 13:40:17','2025-08-05 13:40:17'),(2,1,'scheme','SCHEMa','asMOP','approved','scheme approved and added to options','2025-08-05 13:41:28','2025-08-05 13:41:56'),(3,1,'agency_type','NEW AGENCY','','approved','agency type approved and added to options','2025-08-05 13:47:29','2025-08-05 13:47:42');
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
) ENGINE=InnoDB AUTO_INCREMENT=197 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `research_projects`
--

LOCK TABLES `research_projects` WRITE;
/*!40000 ALTER TABLE `research_projects` DISABLE KEYS */;
INSERT INTO `research_projects` VALUES (24,'Student Driven','infrastructure','The first tile for the project',123,123,122,'2025-01-09','submitted',1,'/uploads/1736096909847-Agil\'s Offer letter.pdf',NULL,'2025-01-05 17:08:29','2025-01-05 17:08:29',1,1),(49,'Faculty Driven','researchProject','The Maion of Parrot',12,12,5,'2025-01-03','submitted',1,'/uploads/1737389117799-Statixpro Internship Offer Letter .pdf',NULL,'2025-01-20 16:05:17','2025-01-20 16:05:17',1,1),(55,'Faculty Driven','infrastructure','asd',12,3,12,'2025-01-10','submitted',0,'/uploads/1737432516362-Blog checklist.pdf',NULL,'2025-01-21 04:08:36','2025-01-21 04:08:36',1,1),(70,'Faculty Driven','researchProject','asda',12,12,22,'2025-02-01','submitted',1,'/uploads/1737438512010-m.pdf',NULL,'2025-01-21 05:48:31','2025-01-21 05:48:32',1,1),(71,'Student Driven','infrastructure','Say hello to DuckDuckGo AI Chat!',100,211,12,'2023-02-10','submitted',1,'/uploads/1737464149084-Dinesh Resume (1).pdf','15647','2025-01-21 12:55:40','2025-01-27 02:34:27',1,1),(72,'Faculty Driven','infrastructure','Title Is NEW DATA',10,20,4,'2025-01-26','submitted',1,'/uploads/1738479296513-Dharani\'s Offer letter.pdf','100','2025-02-02 06:54:54','2025-02-27 09:02:27',1,1),(73,'Faculty Driven','researchProject','asdasd',12,22,21,'2025-01-31','submitted',1,'/uploads/1740629448818-Dinesh Resume (1).pdf','122','2025-02-02 07:30:26','2025-02-27 04:10:48',1,1),(74,'Faculty Driven','infrastructure','Title Is NEW DATA schema author fin  collab',10,20,4,'2025-01-26','submitted',1,'/uploads/1738502040997-Agil\'s Offer letter.pdf','100','2025-02-02 11:41:22','2025-02-28 17:45:04',1,1),(77,'Faculty Driven','researchProject','asd',12,12,12,NULL,'waiting',1,NULL,'','2025-02-02 16:15:03','2025-02-02 16:15:03',1,1),(79,'Faculty Driven','researchProject','asdasd',12,12,22,'2025-02-06','waiting',1,NULL,'1265','2025-02-02 16:39:19','2025-02-02 16:39:19',1,1),(81,'Faculty Driven','researchProject','Mopoie',12,21,10,NULL,'waiting',1,NULL,'','2025-02-02 16:44:49','2025-02-02 16:44:49',1,1),(82,'Faculty Driven','researchProject','asdasd',12,12,11,'2025-01-23','waiting',1,NULL,'122','2025-02-02 16:51:20','2025-02-02 16:51:20',1,1),(83,'Faculty Driven','researchProject','asd',12,12,12,NULL,'waiting',0,NULL,'','2025-02-02 17:01:05','2025-02-02 17:01:05',1,1),(84,'Faculty Driven','infrastructure','qwrqwr',12,12,22,'2025-01-29','waiting',1,NULL,'1222','2025-02-02 17:07:05','2025-02-02 17:07:05',1,1),(85,'Faculty Driven','infrastructure','THe Project IS NEW',123,12,12,'2025-02-09','submitted',1,NULL,'100','2025-02-27 09:09:54','2025-02-27 09:09:54',1,1),(88,'Faculty Driven','researchProject','asd',12,12,12,NULL,'waiting',0,NULL,'','2025-02-27 13:48:21','2025-02-27 13:48:21',1,1),(89,'Faculty Driven','researchProject','sda',1,22,12,NULL,'waiting',0,NULL,'','2025-02-27 13:50:14','2025-02-27 13:50:14',1,1),(90,'Faculty Driven','researchProject','12',1,1,-1,NULL,'waiting',0,NULL,'','2025-02-27 14:17:17','2025-02-27 14:17:17',1,1),(91,'Faculty Driven','competition','ads',1,1,-1,NULL,'waiting',0,NULL,'','2025-02-27 14:27:48','2025-02-27 14:27:48',1,1),(92,'Faculty Driven','researchProject','Mokent',11,12,11,NULL,'waiting',0,NULL,'','2025-02-27 14:38:02','2025-02-27 14:38:02',1,1),(93,'Faculty Driven','researchProject','Mokyi',11,2,11,'2025-01-31','submitted',1,'/uploads/1740672983589-Dinesh Resume (1).pdf','122','2025-02-27 15:23:46','2025-02-28 16:00:01',1,1),(94,'Faculty Driven','researchProject','123123123',1,2,1,'2025-01-27','submitted',1,'/uploads/1740679788052-neethikrishnan.pdf','1222','2025-02-27 18:09:46','2025-02-27 19:08:32',1,1),(95,'Faculty Driven','infrastructure','Feb 2025',12,12,11,'2025-01-11','submitted',1,'/uploads/1740716096846-neethikrishnan.pdf','1200','2025-02-28 04:14:47','2025-02-28 10:41:02',1,1),(96,'Faculty Driven','infrastructure','V1111',12,1,12,'2025-02-03','submitted',1,NULL,'1222','2025-02-28 12:51:54','2025-02-28 17:20:56',1,1),(97,'Faculty Driven','researchProject','asdasd',12,12,12,'2025-01-31','submitted',0,NULL,'12313','2025-02-28 14:11:08','2025-02-28 14:11:08',1,1),(98,'Faculty Driven','infrastructure','Night of FEvb',12,12,11,'2025-02-05','submitted',0,NULL,'100','2025-02-28 16:38:53','2025-02-28 16:40:24',1,1),(99,'Faculty Driven','researchProject','Mopie1803',22,8,21,'2025-01-29','submitted',0,NULL,'2001','2025-03-18 05:47:39','2025-03-18 05:47:39',1,1),(100,'Faculty Driven','researchProject','Monkey',10,2,11,'2025-02-26','submitted',0,NULL,'120','2025-03-18 08:03:47','2025-03-18 08:03:47',1,1),(101,'Faculty Driven','researchProject','Mona',11,12,11,'2023-02-10','submitted',0,NULL,'100','2025-03-18 08:07:19','2025-03-18 08:07:19',1,1),(102,'Faculty Driven','infrastructure','mmm',12,11,-3,'2022-02-02','submitted',0,'/uploads/1742285864055-Final ResumeÂ  _ Resume Editor.pdf','123123','2025-03-18 08:17:41','2025-03-18 08:17:44',1,1),(103,'Faculty Driven','researchProject','night',1,1,11,'2025-02-28','submitted',0,'/uploads/1742316670363-Maheshwaran_A_K_maheshwaran325@gmailcom_Comp.pdf','11','2025-03-18 16:51:08','2025-03-18 16:51:10',1,1),(105,'Faculty Driven','researchProject','Test 2 - 3',123,10,11,'2025-02-26','submitted',0,NULL,'123','2025-03-24 09:39:40','2025-03-24 09:39:40',1,1),(106,'Faculty Driven','infrastructure','24-03-2025',120,12,6,'2024-11-30','submitted',0,NULL,'123','2025-03-24 10:23:02','2025-03-24 10:23:02',1,1),(107,'Faculty Driven','infrastructure','Mopo',5,12,4,'2024-11-01','submitted',0,NULL,'123','2025-03-24 13:21:15','2025-03-24 13:21:15',1,1),(108,'Faculty Driven','researchProject','Mopom',120,10,6,'2025-03-06','submitted',0,NULL,'211','2025-03-24 13:28:06','2025-03-24 13:28:06',1,1),(109,'Faculty Driven','researchProject','Mookaas',10,11,17,'2025-02-26','submitted',0,NULL,'122','2025-03-24 13:37:31','2025-03-24 13:37:31',1,1),(110,'Faculty Driven','researchProject','no',1,1,-1,'2025-02-26','submitted',0,NULL,'121','2025-03-24 14:00:27','2025-03-24 14:00:27',1,1),(111,'Faculty Driven','infrastructure','0304',12,10,1,'2025-03-05','submitted',0,NULL,'142','2025-04-03 07:20:34','2025-04-03 07:20:34',1,1),(112,'Faculty Driven','infrastructure','0404',1,12,21,NULL,'waiting',0,NULL,'','2025-04-04 06:25:23','2025-04-04 06:25:23',1,1),(113,'Faculty Driven','infrastructure','Title',12,11,10,NULL,'waiting',0,NULL,'','2025-04-04 06:26:44','2025-04-04 06:26:44',1,1),(114,'Faculty Driven','infrastructure','Poper',1,2,0,NULL,'waiting',0,'uploads/journal-article/1743748989589-774378415-Whatsapp Automation (1).pdf','','2025-04-04 06:43:09','2025-04-04 06:43:09',1,1),(115,'Faculty Driven','researchProject','0604 Full',12,12,9,'2025-05-03','submitted',0,NULL,'123','2025-04-06 13:36:41','2025-04-06 13:36:41',1,1),(116,'Faculty Driven','researchProject','0604 Full',12,12,9,'2025-05-03','submitted',0,NULL,'123','2025-04-06 13:37:29','2025-04-06 13:37:29',1,1),(117,'Faculty Driven','researchProject','sdasd',12,12,6,'2025-04-04','submitted',1,'uploads/journal-article/1743947042810-939556469-Whatsapp Automation (1).pdf','11','2025-04-06 13:44:01','2025-04-06 13:44:02',1,1),(118,'Faculty Driven','researchProject','Mop',1,1,1,'2025-04-03','submitted',0,NULL,'12','2025-04-06 13:59:36','2025-04-06 13:59:36',1,1),(120,'Faculty Driven','researchProject','0604Neop',12,1,8,'2025-04-04','submitted',0,NULL,'123','2025-04-06 14:55:16','2025-04-06 14:55:16',1,1),(121,'Faculty Driven','infrastructure','Fully new',12,12,7,NULL,'waiting',0,NULL,'','2025-04-06 15:08:35','2025-04-06 15:08:35',1,1),(122,'Faculty Driven','researchProject','Fully New',12,1,21,'2025-04-03','waiting',0,NULL,'123','2025-04-06 15:11:38','2025-04-06 15:11:38',1,1),(123,'Faculty Driven','researchProject','asd',1,2,-5,'2025-03-06','waiting',0,NULL,'23','2025-04-06 15:12:31','2025-04-06 15:12:31',1,1),(124,'Faculty Driven','researchProject','asd',1,2,-5,'2025-03-06','waiting',0,NULL,'23','2025-04-06 15:13:51','2025-04-06 15:13:51',1,1),(125,'Faculty Driven','researchProject','Test 0604',1,1,1,'2025-04-03','submitted',0,'uploads/journal-article/1743953514642-794856536-Whatsapp Automation (1).pdf','12','2025-04-06 15:29:09','2025-04-06 15:31:54',1,1),(126,'Faculty Driven','researchProject','New Test 060425',10,12,1,'2025-04-10','submitted',0,'uploads/journal-article/1743954457076-769910226-Whatsapp Automation (1).pdf','213','2025-04-06 15:47:34','2025-04-06 15:47:37',1,1),(127,'Faculty Driven','researchProject','Mopn new',1,2,12,'2025-04-10','submitted',0,NULL,'123','2025-04-06 16:13:16','2025-04-06 16:13:16',1,1),(128,'Faculty Driven','researchProject','n',1,1,-5,'2025-04-10','submitted',0,'uploads/journal-article/1743956558940-651128580-Whatsapp Automation (1).pdf','123','2025-04-06 16:22:37','2025-04-06 16:22:38',1,1),(129,'Faculty Driven','researchProject','asd',12,12,32,'2025-04-02','submitted',0,NULL,'123','2025-04-06 16:45:16','2025-04-06 16:45:16',1,1),(130,'Faculty Driven','researchProject','zczxc',1,1,10,'2025-04-12','submitted',0,NULL,'4','2025-04-06 17:59:57','2025-04-06 17:59:57',1,1),(131,'Faculty Driven','researchProject','km',3,2,1,'2025-03-13','submitted',0,NULL,'123','2025-04-08 10:23:56','2025-04-08 10:23:56',1,1),(132,'Faculty Driven','researchProject','0904',1,2,3,'2025-02-12','submitted',0,'uploads/journal-article/1744171302541-439384079-Whatsapp Automation (1).pdf','11','2025-04-09 04:01:38','2025-04-09 04:01:42',1,1),(133,'Faculty Driven','researchProject','0904 test',12,10,1,'2025-03-06','submitted',0,'uploads/journal-article/1744173649642-875900788-Whatsapp Automation (1).pdf','100','2025-04-09 04:40:43','2025-04-09 04:40:49',1,1),(134,'Faculty Driven','researchProject','New',10,1,12,'2025-04-05','submitted',0,NULL,'120','2025-04-09 05:02:58','2025-04-09 05:02:58',1,1),(136,'Faculty Driven','researchProject','Mop',200,11,11,'2025-04-05','submitted',0,NULL,'1','2025-04-09 05:21:21','2025-04-09 05:21:21',1,1),(137,'Faculty Driven','infrastructure','New',4,2,5,'2025-03-21','submitted',0,NULL,'10','2025-04-09 05:28:24','2025-04-09 05:28:24',1,1),(138,'Faculty Driven','researchProject','newOld',3,3,10,'2025-02-21','submitted',0,NULL,'100','2025-04-09 05:44:24','2025-04-09 05:44:24',1,1),(139,'Faculty Driven','researchProject','DELTE',10,2,3,'2025-04-25','submitted',0,'uploads/journal-article/1744641166897-246016753-Copy of DoubtQuest.pdf','10','2025-04-14 14:32:44','2025-04-14 14:32:47',1,1),(140,'Faculty Driven','researchProject','DElete 2',10,1,22,'2025-04-09','submitted',1,NULL,'100','2025-04-14 14:57:12','2025-04-14 14:57:12',1,1),(141,'Faculty Driven','researchProject','New DElete',1,2,2,'2025-04-03','submitted',0,NULL,'12','2025-04-14 15:13:00','2025-04-14 15:13:00',1,1),(142,'Faculty Driven','researchProject','DELET4e 3',12,12,12,'2025-04-04','submitted',0,'uploads/journal-article/1744644447015-616540243-Nithesh\'s Offer Letter.pdf','11','2025-04-14 15:27:22','2025-04-14 15:27:27',1,1),(143,'Faculty Driven','researchProject','Mom',1,1,-7,'2025-04-04','submitted',0,NULL,'12','2025-04-14 16:17:08','2025-04-14 16:17:08',1,1),(144,'Faculty Driven','researchProject','New Year',1,2,3,'2025-04-04','submitted',0,NULL,'120','2025-04-14 16:55:18','2025-04-14 16:55:18',1,1),(145,'Faculty Driven','researchProject','New Year',1,2,3,'2025-04-04','submitted',0,'uploads/journal-article/1744649735927-32353167-Permission for Girls Student.pdf','120','2025-04-14 16:55:34','2025-04-14 16:55:35',1,1),(146,'Faculty Driven','researchProject','new delte',1,1,1,'2025-04-03','submitted',0,NULL,'12','2025-04-14 17:04:42','2025-04-14 17:04:42',1,1),(147,'Faculty Driven','researchProject','NEw DELETE 1043',2,3,1,'2025-04-03','submitted',0,NULL,'32','2025-04-14 17:15:59','2025-04-14 17:15:59',1,1),(148,'Faculty Driven','researchProject','DO DO DELETE',12,1,8,'2025-04-03','submitted',0,'uploads/journal-article/1744652008335-528724467-Dharani S Internship Certificate.docx.pdf','120','2025-04-14 17:33:25','2025-04-14 17:33:28',1,1),(149,'Faculty Driven','researchProject','NEw DeletE',1,2,2,'2025-04-14','submitted',0,'uploads/journal-article/1744652489734-313312286-Harini S K Internship Certificate.pdf','123','2025-04-14 17:41:27','2025-04-14 17:41:29',1,1),(150,'Faculty Driven','researchProject','Ttile',12,12,12,'2025-04-03','submitted',0,NULL,'100','2025-04-14 17:51:16','2025-04-14 17:51:16',1,1),(151,'Faculty Driven','researchProject','Title new',2,2,1,'2025-04-10','submitted',0,NULL,'12','2025-04-14 18:13:50','2025-04-14 18:13:50',1,1),(152,'Faculty Driven','researchProject','DELETE 1149',1,2,2,'2025-04-24','submitted',0,NULL,'100','2025-04-14 18:21:08','2025-04-14 18:21:08',1,1),(153,'Faculty Driven','researchProject','Ttile',2,2,2,'2025-04-10','submitted',0,NULL,'12','2025-04-14 18:29:50','2025-04-14 18:29:50',1,1),(154,'Faculty Driven','researchProject','Title NEW 1504',1,2,3,'2025-04-11','submitted',0,'uploads/journal-article/1744656138658-260354818-Renukadevi K Internship Certificate.pdf','10','2025-04-14 18:42:16','2025-04-14 18:42:18',1,1),(155,'Faculty Driven','researchProject','Title New 303',2,2,3,'2025-04-04','submitted',0,NULL,'10','2025-04-14 18:53:10','2025-04-14 18:53:10',1,1),(156,'Faculty Driven','researchProject','Delete The Group',12,1,1,'2025-04-12','submitted',1,'uploads/journal-article/1745907700489-242195260-Suthi Invoice .pdf','1230','2025-04-29 06:21:39','2025-04-29 06:21:40',1,1),(157,'Faculty Driven','researchProject','07052025',1,2,2,'2025-05-01','submitted',0,'uploads/journal-article/1746623656504-573475329-Todo.pdf','202','2025-05-07 13:14:14','2025-05-07 13:14:16',1,1),(158,'Faculty Driven','researchProject','08052055',10,20,10,'2025-05-10','submitted',0,'uploads/journal-article/1746689219273-294488184-Todo.pdf','120','2025-05-08 07:26:56','2025-05-08 07:34:53',1,1),(159,'Faculty Driven','researchProject','208052025',3,2,2,'2025-04-27','submitted',0,NULL,'120','2025-05-08 08:14:08','2025-05-08 09:00:27',1,1),(160,'Faculty Driven','researchProject','308052025',3,3,3,'2025-05-09','submitted',0,NULL,'1203','2025-05-08 09:02:28','2025-05-08 09:38:42',1,1),(161,'Faculty Driven','researchProject','0108052025',2,2,2,'2025-05-09','submitted',0,NULL,'421','2025-05-08 09:41:39','2025-05-08 09:41:39',1,1),(162,'Faculty Driven','researchProject','a08052025',5,3,3,'2025-05-08','submitted',0,NULL,'234','2025-05-08 10:25:57','2025-05-08 10:25:57',1,1),(163,'Faculty Driven','researchProject','Dummy0805',3,6,3,'2025-05-09','submitted',0,NULL,'123','2025-05-08 13:42:50','2025-05-08 13:42:50',1,1),(164,'Faculty Driven','researchProject','10052025',2,4,4,'2025-05-15','submitted',0,'uploads/journal-article/1746852159210-487122797-Todo.pdf','123','2025-05-10 04:42:38','2025-05-10 04:42:39',1,1),(169,'Faculty Driven','researchProject','d10052025',3,3,2,'2025-05-02','submitted',0,NULL,'1025','2025-05-10 05:56:28','2025-05-10 05:56:28',1,1),(170,'Faculty Driven','researchProject','M10052025',2,2,3,'2025-05-23','submitted',0,NULL,'120','2025-05-10 06:46:11','2025-05-10 06:46:11',1,1),(171,'Faculty Driven','researchProject','Ma10052025',2,2,2,'2025-05-11','submitted',0,NULL,'123','2025-05-10 07:01:58','2025-05-10 07:01:58',1,1),(172,'Faculty Driven','researchProject','A10052025',3,3,3,'2025-05-08','submitted',0,NULL,'120','2025-05-10 07:41:00','2025-05-10 07:41:00',1,1),(173,'Faculty Driven','researchProject','12052025',3,4,4,'2025-05-11','submitted',0,NULL,'120','2025-05-12 05:22:14','2025-05-12 05:22:14',1,1),(174,'Faculty Driven','researchProject','D12052025',3,4,4,'2025-05-08','submitted',0,NULL,'125','2025-05-12 05:38:43','2025-05-12 05:38:43',1,1),(175,'Faculty Driven','researchProject','D112052025',3,3,2,'2025-05-08','submitted',0,NULL,'120','2025-05-12 05:48:06','2025-05-12 05:48:06',1,1),(176,'Faculty Driven','researchProject','D212052025',12,22,10,'2025-05-21','submitted',0,NULL,'102','2025-05-12 05:54:46','2025-05-12 05:54:46',1,1),(177,'Faculty Driven','researchProject','D312052025',1,2,4,'2025-05-14','submitted',0,NULL,'120','2025-05-12 06:23:33','2025-05-12 06:23:33',1,1),(178,'Faculty Driven','researchProject','Doitiol',3,2,1,'2025-05-14','submitted',0,NULL,'120','2025-05-12 06:27:31','2025-05-12 06:27:31',1,1),(179,'Faculty Driven','researchProject','Title12052025',1,4,4,'2025-05-09','submitted',0,NULL,'102','2025-05-12 06:41:03','2025-05-12 06:41:03',1,1),(180,'Faculty Driven','researchProject','Nope12052025',4,23,44,'2025-05-10','submitted',0,NULL,'120','2025-05-12 06:50:12','2025-05-12 06:50:12',1,1),(181,'Faculty Driven','researchProject','Newtitle12052025',3,3,23,'2025-05-01','submitted',0,NULL,'2334','2025-05-12 06:55:40','2025-05-12 06:55:40',1,1),(182,'Faculty Driven','researchProject','13052025',5,3,4,'2025-05-07','submitted',0,NULL,'123','2025-05-13 06:34:01','2025-05-13 06:53:31',1,1),(183,'Faculty Driven','researchProject','13052025',2,2,4,'2025-05-08','submitted',0,NULL,'123','2025-05-13 06:47:27','2025-05-13 06:47:27',1,1),(184,'Faculty Driven','researchProject','Title1305',2,3,4,'2025-05-09','submitted',0,NULL,'12','2025-05-13 06:55:58','2025-05-13 06:55:58',1,1),(185,'Faculty Driven','researchProject','D#13052025',12,12,12,'2025-05-16','submitted',0,NULL,'213','2025-05-13 07:08:35','2025-05-13 07:08:35',1,1),(186,'Faculty Driven','researchProject','Dummy105',2,3,4,'2025-05-15','submitted',0,NULL,'12','2025-05-13 07:28:39','2025-05-13 07:28:39',1,1),(187,'Faculty Driven','researchProject','Dummy13052025',2,4,3,'2025-05-15','submitted',0,NULL,'123','2025-05-13 09:56:10','2025-05-13 09:56:10',1,1),(188,'Faculty Driven','infrastructure','nop',3,2,1,'2025-05-23','submitted',0,NULL,'12','2025-05-14 05:31:31','2025-05-14 05:31:31',1,1),(189,'Faculty Driven','researchProject','Opo',1,2,3,'2025-05-01','submitted',0,NULL,'13','2025-05-14 05:44:19','2025-05-14 05:44:19',1,1),(190,'Faculty Driven','researchProject','asads',2,12,32,'2025-05-08','submitted',0,NULL,'12','2025-05-14 05:45:49','2025-05-14 05:45:49',1,1),(191,'Faculty Driven','researchProject','Nop',2,2,3,'2025-05-25','submitted',0,NULL,'12','2025-05-14 06:21:14','2025-05-14 06:21:14',1,1),(192,'Faculty Driven','researchProject','nop',3,3,3,'2025-05-02','submitted',0,NULL,'32','2025-05-14 06:30:08','2025-05-14 06:30:08',1,1),(193,'Faculty Driven','researchProject','Opop',3,2,3,'2025-05-09','submitted',0,NULL,'12','2025-05-14 06:44:37','2025-05-14 06:44:37',1,1),(194,'Faculty Driven','researchProject','as',4,3,2,'2025-05-16','submitted',0,NULL,'23','2025-05-14 07:09:47','2025-05-14 07:09:47',1,1),(195,'Faculty Driven','researchProject','mop',23,3,3,'2025-05-09','submitted',0,NULL,'23','2025-05-14 07:39:56','2025-05-14 07:39:56',1,1),(196,'Faculty Driven','infrastructure','17072025 New',1,2,3,'2025-07-02','submitted',1,'uploads/journal-article/1752737549511-312867059-2506.10943v1.pdf','1230','2025-07-17 07:32:28','2025-07-17 07:32:29',1,1);
/*!40000 ALTER TABLE `research_projects` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'maverickmyth333@gmail.com','Maverick','https://lh3.googleusercontent.com/a/ACg8ocI2OH7zkLRTjrHISc-UBxmeidCElHSlWN74yFCo03s-9Hiecfy7=s96-c',1,'2024-11-05 05:30:30',NULL),(2,'gingfreecss325@gmail.com','Ging Freecss','https://lh3.googleusercontent.com/a/ACg8ocLza7_Kha438C2ne7XH06bAmW_gQQLwCfZDOqJsfu-n_Mg24A=s96-c',0,'2024-11-05 13:42:45',NULL),(3,'maheshwaran325@gmail.com','Maheshwaran A K','https://lh3.googleusercontent.com/a/ACg8ocI3s9aKpet0FoIojcVmQo5GToY0L2oHF4zwIXiKZcltqPsaOz3Z4A=s96-c',0,'2025-09-02 09:49:07',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'research'
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
