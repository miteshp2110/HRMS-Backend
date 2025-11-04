-- MySQL dump 10.13  Distrib 8.0.39, for Win64 (x86_64)
--
-- Host: localhost    Database: hrms
-- ------------------------------------------------------
-- Server version	8.0.43

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
-- Table structure for table `applicants`
--

DROP TABLE IF EXISTS `applicants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `applicants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opening_id` int NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `resume_url` varchar(255) NOT NULL,
  `status` enum('Applied','Interviewing','Approved','Rejected','Hired') NOT NULL DEFAULT 'Applied',
  `notes` text,
  `added_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_opening_unique` (`email`,`opening_id`),
  KEY `fk_applicant_added_by` (`added_by`),
  KEY `idx_applicants_email` (`email`),
  KEY `idx_applicants_status` (`status`),
  KEY `idx_applicants_opening_id` (`opening_id`),
  CONSTRAINT `fk_applicant_added_by` FOREIGN KEY (`added_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_applicant_opening` FOREIGN KEY (`opening_id`) REFERENCES `job_openings` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attendance_audit_log`
--

DROP TABLE IF EXISTS `attendance_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendance_id` int NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `changed_by` int DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `bulk_log_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `attendance_id` (`attendance_id`),
  KEY `changed_by` (`changed_by`),
  KEY `fk_audit_bulk_log` (`bulk_log_id`),
  KEY `idx_attendance_audit_log_changed_at` (`changed_at`),
  KEY `idx_attendance_audit_log_field_name` (`field_name`),
  CONSTRAINT `attendance_audit_log_ibfk_1` FOREIGN KEY (`attendance_id`) REFERENCES `attendance_record` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_audit_log_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_audit_bulk_log` FOREIGN KEY (`bulk_log_id`) REFERENCES `bulk_attendance_log` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `attendance_record`
--

DROP TABLE IF EXISTS `attendance_record`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `shift` int NOT NULL,
  `punch_in` timestamp NULL DEFAULT NULL,
  `punch_out` timestamp NULL DEFAULT NULL,
  `hours_worked` decimal(5,2) DEFAULT NULL,
  `attendance_status` enum('Present','Absent','Leave','Half-Day') NOT NULL,
  `is_late` tinyint(1) NOT NULL DEFAULT '0',
  `is_early_departure` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `short_hours` decimal(5,2) DEFAULT NULL,
  `update_reason` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`attendance_date`),
  KEY `shift` (`shift`),
  KEY `idx_attendance_record_updated_by` (`updated_by`),
  KEY `idx_attendance_record_employee_id` (`employee_id`),
  KEY `idx_attendance_record_attendance_date` (`attendance_date`),
  KEY `idx_attendance_record_attendance_status` (`attendance_status`),
  KEY `idx_attendance_record_is_late` (`is_late`),
  KEY `idx_attendance_record_is_early_departure` (`is_early_departure`),
  KEY `idx_att_emp_date` (`employee_id`,`attendance_date`),
  KEY `idx_att_date_status` (`attendance_date`,`attendance_status`),
  CONSTRAINT `attendance_record_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `attendance_record_ibfk_2` FOREIGN KEY (`shift`) REFERENCES `shifts` (`id`),
  CONSTRAINT `fk_attendance_record_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_attendance_update` AFTER UPDATE ON `attendance_record` FOR EACH ROW BEGIN
    
    IF NOT (OLD.punch_in <=> NEW.punch_in) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'punch_in', OLD.punch_in, NEW.punch_in, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.punch_out <=> NEW.punch_out) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'punch_out', OLD.punch_out, NEW.punch_out, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.hours_worked <=> NEW.hours_worked) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'hours_worked', OLD.hours_worked, NEW.hours_worked, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.short_hours <=> NEW.short_hours) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'short_hours', OLD.short_hours, NEW.short_hours, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.attendance_status <=> NEW.attendance_status) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'attendance_status', OLD.attendance_status, NEW.attendance_status, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.is_late <=> NEW.is_late) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'is_late', OLD.is_late, NEW.is_late, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.is_early_departure <=> NEW.is_early_departure) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'is_early_departure', OLD.is_early_departure, NEW.is_early_departure, NEW.updated_by, NOW());
    END IF;

    
    IF NOT (OLD.update_reason <=> NEW.update_reason) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'update_reason', OLD.update_reason, NEW.update_reason, NEW.updated_by, NOW());
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `bank_details`
--

DROP TABLE IF EXISTS `bank_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bank_name` varchar(20) NOT NULL,
  `bank_account` varchar(30) NOT NULL,
  `bank_ifsc` varchar(20) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bank_account` (`bank_account`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_bank_details_updated_by` (`updated_by`),
  KEY `idx_bank_details_user_id` (`user_id`),
  CONSTRAINT `bank_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_bank_details_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `benefit_bands`
--

DROP TABLE IF EXISTS `benefit_bands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `benefit_bands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `band_name` varchar(100) NOT NULL,
  `min_years_service` int NOT NULL,
  `max_years_service` int NOT NULL,
  `leave_salary_calculation` enum('Basic','Gross') NOT NULL,
  `leave_salary_percentage` int NOT NULL,
  `lta_allowance` decimal(12,2) NOT NULL,
  `lta_frequency_years` int NOT NULL,
  `additional_annual_leaves` int NOT NULL DEFAULT '0',
  `medical_plan_details` text,
  `education_allowance_per_child` decimal(12,2) DEFAULT '0.00',
  `fuel_allowance_monthly` decimal(12,2) DEFAULT '0.00',
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_benefit_bands_updated_by` (`updated_by`),
  CONSTRAINT `fk_benefit_bands_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bulk_attendance_log`
--

DROP TABLE IF EXISTS `bulk_attendance_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bulk_attendance_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_by` int NOT NULL,
  `action_date` date NOT NULL,
  `target_count` int NOT NULL,
  `target_filter` varchar(255) DEFAULT NULL,
  `new_status` varchar(50) NOT NULL,
  `reason` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `action_by` (`action_by`),
  CONSTRAINT `fk_bulk_log_user` FOREIGN KEY (`action_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `case_attachments`
--

DROP TABLE IF EXISTS `case_attachments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `file_url` varchar(255) NOT NULL,
  `uploaded_by` int NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_attachment_user` (`uploaded_by`),
  KEY `idx_case_attachments_case_id` (`case_id`),
  CONSTRAINT `fk_attachment_case` FOREIGN KEY (`case_id`) REFERENCES `hr_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attachment_user` FOREIGN KEY (`uploaded_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `case_categories`
--

DROP TABLE IF EXISTS `case_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `fk_case_cat_created_by` (`created_by`),
  CONSTRAINT `fk_case_cat_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `case_comments`
--

DROP TABLE IF EXISTS `case_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `case_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id` int NOT NULL,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_comment_user` (`user_id`),
  KEY `idx_case_comments_case_id` (`case_id`),
  CONSTRAINT `fk_comment_case` FOREIGN KEY (`case_id`) REFERENCES `hr_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comment_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_goals`
--

DROP TABLE IF EXISTS `employee_goals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_goals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appraisal_id` int NOT NULL,
  `goal_title` varchar(255) NOT NULL,
  `goal_description` text,
  `weightage` int NOT NULL,
  `employee_comments` text,
  `manager_comments` text,
  `employee_rating` decimal(5,2) DEFAULT NULL,
  `manager_rating` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_goal_appraisal` (`appraisal_id`),
  CONSTRAINT `fk_goal_appraisal` FOREIGN KEY (`appraisal_id`) REFERENCES `performance_appraisals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_kpis`
--

DROP TABLE IF EXISTS `employee_kpis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_kpis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `appraisal_id` int NOT NULL,
  `kpi_id` int NOT NULL,
  `target` varchar(255) NOT NULL,
  `actual` varchar(255) DEFAULT NULL,
  `weightage` int NOT NULL,
  `employee_comments` text,
  `manager_comments` text,
  `employee_rating` decimal(5,2) DEFAULT NULL,
  `manager_rating` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ekpi_appraisal` (`appraisal_id`),
  KEY `idx_employee_kpis_kpi_id` (`kpi_id`),
  CONSTRAINT `fk_ekpi_appraisal` FOREIGN KEY (`appraisal_id`) REFERENCES `performance_appraisals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ekpi_kpi` FOREIGN KEY (`kpi_id`) REFERENCES `kpi_library` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_leave_balance`
--

DROP TABLE IF EXISTS `employee_leave_balance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_leave_balance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leave_id` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_leave_balance_leave_type` (`leave_id`),
  KEY `idx_employee_leave_balance_updated_by` (`updated_by`),
  KEY `idx_employee_leave_balance_employee_id` (`employee_id`),
  CONSTRAINT `employee_leave_balance_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_employee_leave_balance_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_leave_balance_leave_type` FOREIGN KEY (`leave_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_leave_balance_ledger`
--

DROP TABLE IF EXISTS `employee_leave_balance_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_leave_balance_ledger` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `leave_type_id` int NOT NULL,
  `transaction_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `transaction_type` enum('accrual','deduction','adjustment','carry_forward','encashment') NOT NULL,
  `previous_balance` decimal(5,2) NOT NULL,
  `change_amount` decimal(5,2) NOT NULL,
  `new_balance` decimal(5,2) NOT NULL,
  `leave_record_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ledger_user` (`user_id`),
  KEY `fk_ledger_leave_type` (`leave_type_id`),
  KEY `fk_ledger_updated_by` (`updated_by`),
  KEY `fk_ledger_leave_record` (`leave_record_id`),
  KEY `idx_employee_leave_balance_ledger_transaction_date` (`transaction_date`),
  KEY `idx_employee_leave_balance_ledger_transaction_type` (`transaction_type`),
  CONSTRAINT `fk_ledger_leave_record` FOREIGN KEY (`leave_record_id`) REFERENCES `employee_leave_records` (`id`),
  CONSTRAINT `fk_ledger_leave_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`),
  CONSTRAINT `fk_ledger_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_leave_records`
--

DROP TABLE IF EXISTS `employee_leave_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_leave_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leave_type` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `leave_description` text NOT NULL,
  `applied_date` date NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `rejection_reason` text,
  `primary_status` tinyint(1) DEFAULT NULL,
  `secondry_status` tinyint(1) DEFAULT NULL,
  `primary_user` int DEFAULT NULL,
  `secondry_user` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `primary_user` (`primary_user`),
  KEY `secondry_user` (`secondry_user`),
  KEY `idx_employee_leave_records_updated_by` (`updated_by`),
  KEY `idx_employee_leave_records_employee_id` (`employee_id`),
  KEY `idx_employee_leave_records_from_date` (`from_date`),
  KEY `idx_employee_leave_records_to_date` (`to_date`),
  KEY `idx_employee_leave_records_leave_type` (`leave_type`),
  KEY `idx_employee_leave_records_primary_status` (`primary_status`),
  KEY `idx_employee_leave_records_secondry_status` (`secondry_status`),
  KEY `idx_employee_leave_records_applied_date` (`applied_date`),
  KEY `idx_leave_emp_type` (`employee_id`,`leave_type`),
  KEY `idx_leave_emp_status` (`employee_id`,`primary_status`),
  KEY `idx_leave_date_range` (`from_date`,`to_date`),
  CONSTRAINT `employee_leave_records_ibfk_1` FOREIGN KEY (`leave_type`) REFERENCES `leave_types` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_3` FOREIGN KEY (`primary_user`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_4` FOREIGN KEY (`secondry_user`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_employee_leave_records_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_overtime_audit_log`
--

DROP TABLE IF EXISTS `employee_overtime_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_overtime_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `overtime_record_id` int NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `changed_by` int DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `overtime_record_id` (`overtime_record_id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_employee_overtime_audit_log_changed_at` (`changed_at`),
  CONSTRAINT `employee_overtime_audit_log_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_overtime_records`
--

DROP TABLE IF EXISTS `employee_overtime_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_overtime_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendance_record_id` int DEFAULT NULL,
  `employee_id` int NOT NULL,
  `request_date` date NOT NULL,
  `overtime_hours` decimal(5,2) NOT NULL,
  `approved_hours` decimal(5,2) NOT NULL DEFAULT '0.00',
  `status` enum('pending_approval','approved','rejected') NOT NULL DEFAULT 'pending_approval',
  `overtime_type` enum('regular','holiday') NOT NULL DEFAULT 'regular',
  `overtime_start` timestamp NULL DEFAULT NULL,
  `overtime_end` timestamp NULL DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `reason` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_record_id` (`attendance_record_id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_employee_overtime_records_employee_id` (`employee_id`),
  KEY `idx_employee_overtime_records_status` (`status`),
  CONSTRAINT `employee_overtime_records_ibfk_1` FOREIGN KEY (`attendance_record_id`) REFERENCES `attendance_record` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_overtime_records_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_overtime_records_ibfk_3` FOREIGN KEY (`processed_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_employee_overtime_update` AFTER UPDATE ON `employee_overtime_records` FOR EACH ROW BEGIN
    
    IF (OLD.overtime_hours <> NEW.overtime_hours) THEN
        INSERT INTO employee_overtime_audit_log
        (overtime_record_id, field_name, old_value, new_value, changed_by)
        VALUES (OLD.id, 'overtime_hours', OLD.overtime_hours, NEW.overtime_hours, NEW.processed_by);
    END IF;

    
    IF (OLD.approved_hours <> NEW.approved_hours) THEN
        INSERT INTO employee_overtime_audit_log
        (overtime_record_id, field_name, old_value, new_value, changed_by)
        VALUES (OLD.id, 'approved_hours', OLD.approved_hours, NEW.approved_hours, NEW.processed_by);
    END IF;

    
    IF (OLD.status <> NEW.status) THEN
        INSERT INTO employee_overtime_audit_log
        (overtime_record_id, field_name, old_value, new_value, changed_by)
        VALUES (OLD.id, 'status', OLD.status, NEW.status, NEW.processed_by);
    END IF;

    
    IF (OLD.overtime_type <> NEW.overtime_type) THEN
        INSERT INTO employee_overtime_audit_log
        (overtime_record_id, field_name, old_value, new_value, changed_by)
        VALUES (OLD.id, 'overtime_type', OLD.overtime_type, NEW.overtime_type, NEW.processed_by);
    END IF;

    
    IF (OLD.rejection_reason <> NEW.rejection_reason) THEN
        INSERT INTO employee_overtime_audit_log
        (overtime_record_id, field_name, old_value, new_value, changed_by)
        VALUES (OLD.id, 'rejection_reason', OLD.rejection_reason, NEW.rejection_reason, NEW.processed_by);
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_employee_overtime_delete` AFTER DELETE ON `employee_overtime_records` FOR EACH ROW BEGIN
    INSERT INTO employee_overtime_audit_log
    (overtime_record_id, field_name, old_value, new_value, changed_by)
    VALUES (OLD.id, 'record_deleted', CONCAT(
                'hours=', OLD.overtime_hours,
                ', approved=', OLD.approved_hours,
                ', status=', OLD.status,
                ', type=', OLD.overtime_type
            ), NULL, OLD.processed_by);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `employee_salary_revisions`
--

DROP TABLE IF EXISTS `employee_salary_revisions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_salary_revisions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `component_id` int NOT NULL COMMENT 'The salary component being revised (e.g., Basic Salary)',
  `effective_date` date NOT NULL COMMENT 'The date this revision should take effect',
  `new_calculation_type` enum('Fixed','Percentage','Formula') NOT NULL,
  `new_value` decimal(12,2) NOT NULL,
  `new_based_on_component_id` int DEFAULT NULL,
  `new_custom_formula` text,
  `status` enum('Scheduled','Applied','Cancelled') NOT NULL DEFAULT 'Scheduled',
  `reason` text COMMENT 'Reason for the salary revision (e.g., Annual Increment, Promotion)',
  `created_by` int DEFAULT NULL,
  `applied_by` int DEFAULT NULL COMMENT 'User or process that applied this revision',
  `applied_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when the revision was applied',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_revision_employee` (`employee_id`),
  KEY `fk_revision_component` (`component_id`),
  KEY `fk_revision_created_by` (`created_by`),
  KEY `fk_revision_applied_by` (`applied_by`),
  KEY `idx_employee_salary_revisions_employee_id` (`employee_id`),
  KEY `idx_employee_salary_revisions_status` (`status`),
  CONSTRAINT `fk_revision_applied_by` FOREIGN KEY (`applied_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_revision_component` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`),
  CONSTRAINT `fk_revision_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_revision_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_salary_structure`
--

DROP TABLE IF EXISTS `employee_salary_structure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_salary_structure` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `component_id` int NOT NULL,
  `calculation_type` enum('Fixed','Percentage','Formula') NOT NULL,
  `value` decimal(12,2) NOT NULL,
  `based_on_component_id` int DEFAULT NULL COMMENT 'Used when calculation_type is Percentage',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `custom_formula` text COMMENT 'Stores the formula as a JSON string',
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`component_id`),
  KEY `component_id` (`component_id`),
  KEY `idx_employee_salary_structure_updated_by` (`updated_by`),
  KEY `fk_ess_based_on` (`based_on_component_id`),
  KEY `idx_employee_salary_structure_employee_id` (`employee_id`),
  CONSTRAINT `employee_salary_structure_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_salary_structure_ibfk_2` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`),
  CONSTRAINT `fk_employee_salary_structure_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_ess_based_on` FOREIGN KEY (`based_on_component_id`) REFERENCES `payroll_components` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_after_salary_structure_update` AFTER UPDATE ON `employee_salary_structure` FOR EACH ROW BEGIN
    DECLARE old_json JSON;
    DECLARE new_json JSON;
    
    SET old_json = JSON_OBJECT();
    SET new_json = JSON_OBJECT();

    
    IF OLD.calculation_type <> NEW.calculation_type THEN
        SET old_json = JSON_SET(old_json, '$.calculation_type', OLD.calculation_type);
        SET new_json = JSON_SET(new_json, '$.calculation_type', NEW.calculation_type);
    END IF;

    IF OLD.value <> NEW.value THEN
        SET old_json = JSON_SET(old_json, '$.value', OLD.value);
        SET new_json = JSON_SET(new_json, '$.value', NEW.value);
    END IF;

    IF OLD.based_on_component_id IS NULL AND NEW.based_on_component_id IS NOT NULL OR
       OLD.based_on_component_id IS NOT NULL AND NEW.based_on_component_id IS NULL OR
       OLD.based_on_component_id <> NEW.based_on_component_id THEN
        SET old_json = JSON_SET(old_json, '$.based_on_component_id', OLD.based_on_component_id);
        SET new_json = JSON_SET(new_json, '$.based_on_component_id', NEW.based_on_component_id);
    END IF;

    IF OLD.custom_formula IS NULL AND NEW.custom_formula IS NOT NULL OR
       OLD.custom_formula IS NOT NULL AND NEW.custom_formula IS NULL OR
       OLD.custom_formula <> NEW.custom_formula THEN
        SET old_json = JSON_SET(old_json, '$.custom_formula', OLD.custom_formula);
        SET new_json = JSON_SET(new_json, '$.custom_formula', NEW.custom_formula);
    END IF;

    
    IF JSON_LENGTH(old_json) > 0 THEN
        INSERT INTO `employee_salary_structure_audit` (
            `salary_structure_id`,
            `employee_id`,
            `action_type`,
            `old_data`,
            `new_data`,
            `changed_by`
        ) VALUES (
            OLD.id,
            OLD.employee_id,
            'UPDATE',
            old_json,
            new_json,
            NEW.updated_by
        );
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_after_salary_structure_delete` AFTER DELETE ON `employee_salary_structure` FOR EACH ROW BEGIN
    INSERT INTO `employee_salary_structure_audit` (
        `salary_structure_id`,
        `employee_id`,
        `action_type`,
        `old_data`,
        `new_data`,
        `changed_by`
    ) VALUES (
        OLD.id,
        OLD.employee_id,
        'DELETE',
        JSON_OBJECT(
            'component_id', OLD.component_id,
            'calculation_type', OLD.calculation_type,
            'value', OLD.value,
            'based_on_component_id', OLD.based_on_component_id,
            'custom_formula', OLD.custom_formula
        ),
        NULL,
        NULL 
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `employee_salary_structure_audit`
--

DROP TABLE IF EXISTS `employee_salary_structure_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_salary_structure_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `salary_structure_id` int NOT NULL COMMENT 'The ID of the record from employee_salary_structure',
  `employee_id` int NOT NULL,
  `action_type` enum('UPDATE','DELETE') NOT NULL,
  `old_data` json DEFAULT NULL COMMENT 'Stores the previous values of the changed columns',
  `new_data` json DEFAULT NULL COMMENT 'Stores the new values of the changed columns',
  `changed_by` int DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salary_structure_id` (`salary_structure_id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `fk_ess_audit_changed_by` (`changed_by`),
  KEY `idx_employee_salary_structure_audit_changed_at` (`changed_at`),
  CONSTRAINT `fk_ess_audit_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `employee_skill_matrix`
--

DROP TABLE IF EXISTS `employee_skill_matrix`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_skill_matrix` (
  `id` int NOT NULL AUTO_INCREMENT,
  `skill_id` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `status` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employee_skill_matrix_updated_by` (`updated_by`),
  KEY `idx_employee_skill_matrix_employee_id` (`employee_id`),
  KEY `idx_employee_skill_matrix_skill_id` (`skill_id`),
  CONSTRAINT `employee_skill_matrix_ibfk_1` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`),
  CONSTRAINT `employee_skill_matrix_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_skill_matrix_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_employee_skill_matrix_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expense_categories`
--

DROP TABLE IF EXISTS `expense_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `fk_expense_categories_updated_by` (`updated_by`),
  CONSTRAINT `fk_expense_categories_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expense_claims`
--

DROP TABLE IF EXISTS `expense_claims`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_claims` (
  `id` int NOT NULL AUTO_INCREMENT,
  `claim_type` enum('Reimbursement','Advance') NOT NULL DEFAULT 'Reimbursement',
  `employee_id` int NOT NULL,
  `category_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `amount` decimal(12,2) NOT NULL,
  `expense_date` date NOT NULL,
  `status` enum('Pending','Approved','Rejected','Processed','Locked','Reimbursed') NOT NULL DEFAULT 'Pending',
  `reimbursement_method` enum('Payroll','Direct Transfer') DEFAULT NULL,
  `rejection_reason` text,
  `approved_by` int DEFAULT NULL,
  `approval_date` timestamp NULL DEFAULT NULL,
  `processed_by` int DEFAULT NULL,
  `processed_date` timestamp NULL DEFAULT NULL,
  `reimbursed_in_payroll_id` int DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL COMMENT 'Transaction ID for advances or direct reimbursements',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `category_id` (`category_id`),
  KEY `approved_by` (`approved_by`),
  KEY `processed_by` (`processed_by`),
  KEY `reimbursed_in_payroll_id` (`reimbursed_in_payroll_id`),
  KEY `fk_expense_claims_updated_by` (`updated_by`),
  KEY `idx_expense_claims_employee_id` (`employee_id`),
  KEY `idx_expense_claims_status` (`status`),
  KEY `idx_expense_claims_approval_date` (`approval_date`),
  CONSTRAINT `fk_expense_claims_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_expense_claims_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`),
  CONSTRAINT `fk_expense_claims_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_expense_claims_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_expense_claims_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expense_on_employee`
--

DROP TABLE IF EXISTS `expense_on_employee`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_on_employee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL,
  `expense_title` varchar(30) NOT NULL,
  `expense_description` text NOT NULL,
  `expense` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `jv` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expense_on_employee_updated_by` (`updated_by`),
  KEY `idx_expense_on_employee_employee_id` (`employee_id`),
  CONSTRAINT `expense_on_employee_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_expense_on_employee_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expense_receipts`
--

DROP TABLE IF EXISTS `expense_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expense_receipts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `expense_claim_id` int NOT NULL,
  `file_url` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `expense_claim_id` (`expense_claim_id`),
  KEY `fk_expense_receipts_uploaded_by` (`uploaded_by`),
  KEY `idx_expense_receipts_expense_claim_id` (`expense_claim_id`),
  CONSTRAINT `fk_expense_receipts_claim` FOREIGN KEY (`expense_claim_id`) REFERENCES `expense_claims` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expense_receipts_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `final_settlements`
--

DROP TABLE IF EXISTS `final_settlements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `final_settlements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `last_working_date` date NOT NULL,
  `termination_type` enum('Resignation','Termination','End of Contract','Retirement') NOT NULL,
  `termination_reason` text,
  `notes` text,
  `leave_encashment_amount` decimal(12,2) DEFAULT '0.00',
  `leave_encashment_breakdown` text,
  `gratuity_amount` decimal(12,2) DEFAULT '0.00',
  `gratuity_breakdown` text,
  `pending_salary_amount` decimal(12,2) DEFAULT '0.00',
  `loan_deduction_amount` decimal(12,2) DEFAULT '0.00',
  `loan_deduction_breakdown` text,
  `case_deduction_amount` decimal(12,2) DEFAULT NULL,
  `case_deduction_breakdown` text,
  `other_deductions` decimal(12,2) DEFAULT '0.00',
  `total_additions` decimal(12,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT '0.00',
  `net_settlement_amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('Pending','Approved','Paid') NOT NULL DEFAULT 'Pending',
  `initiated_by` int NOT NULL,
  `approved_by` int DEFAULT NULL,
  `jv_number` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `fk_settlement_initiated_by` (`initiated_by`),
  KEY `fk_settlement_approved_by` (`approved_by`),
  KEY `idx_final_settlements_employee_id` (`employee_id`),
  KEY `idx_final_settlements_status` (`status`),
  CONSTRAINT `fk_settlement_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_settlement_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_settlement_initiated_by` FOREIGN KEY (`initiated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `holiday_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_date` (`holiday_date`),
  KEY `idx_holidays_updated_by` (`updated_by`),
  KEY `idx_holidays_holiday_date` (`holiday_date`),
  CONSTRAINT `fk_holidays_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hr_cases`
--

DROP TABLE IF EXISTS `hr_cases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hr_cases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `case_id_text` varchar(50) NOT NULL,
  `employee_id` int NOT NULL,
  `category_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` enum('Open','Under Review','Approved','Locked','Rejected','Closed') NOT NULL DEFAULT 'Open',
  `deduction_amount` decimal(12,2) DEFAULT NULL,
  `raised_by` int NOT NULL,
  `assigned_to` int NOT NULL COMMENT 'Manager responsible for approval',
  `rejection_reason` text,
  `is_deduction_synced` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `payslip_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `case_id_text` (`case_id_text`),
  KEY `fk_case_employee` (`employee_id`),
  KEY `fk_case_category` (`category_id`),
  KEY `fk_case_raised_by` (`raised_by`),
  KEY `fk_hr_cases_payslip` (`payslip_id`),
  KEY `idx_hr_cases_status` (`status`),
  KEY `idx_hr_cases_assigned_to` (`assigned_to`),
  CONSTRAINT `fk_case_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_case_category` FOREIGN KEY (`category_id`) REFERENCES `case_categories` (`id`),
  CONSTRAINT `fk_case_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_case_raised_by` FOREIGN KEY (`raised_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_hr_cases_payslip` FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_opening_skills`
--

DROP TABLE IF EXISTS `job_opening_skills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_opening_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opening_id` int NOT NULL,
  `skill_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `opening_skill_unique` (`opening_id`,`skill_id`),
  KEY `idx_job_opening_skills_skill_id` (`skill_id`),
  CONSTRAINT `fk_skill_opening` FOREIGN KEY (`opening_id`) REFERENCES `job_openings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_skill_skill` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `job_openings`
--

DROP TABLE IF EXISTS `job_openings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_openings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `status` enum('Open','Closed','On Hold') NOT NULL DEFAULT 'Open',
  `number_of_positions` int NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_opening_job` (`job_id`),
  KEY `fk_opening_created_by` (`created_by`),
  KEY `idx_job_openings_status` (`status`),
  CONSTRAINT `fk_opening_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_opening_job` FOREIGN KEY (`job_id`) REFERENCES `jobs` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_jobs_updated_by` (`updated_by`),
  CONSTRAINT `fk_jobs_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `kpi_library`
--

DROP TABLE IF EXISTS `kpi_library`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_library` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kpi_name` varchar(255) NOT NULL,
  `description` text,
  `category` enum('Quantitative','Qualitative') NOT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_kpi_created_by` (`created_by`),
  CONSTRAINT `fk_kpi_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_audit_log`
--

DROP TABLE IF EXISTS `leave_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `action_type` varchar(100) NOT NULL,
  `original_amount` decimal(12,2) DEFAULT NULL,
  `overridden_amount` decimal(12,2) DEFAULT NULL,
  `reason_for_override` text NOT NULL,
  `changed_by` int NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_leave_audit_employee` (`employee_id`),
  KEY `fk_leave_audit_changed_by` (`changed_by`),
  KEY `idx_leave_audit_log_changed_at` (`changed_at`),
  CONSTRAINT `fk_leave_audit_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_leave_audit_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_encashment_requests`
--

DROP TABLE IF EXISTS `leave_encashment_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_encashment_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `request_date` date NOT NULL,
  `days_to_encash` decimal(5,2) NOT NULL,
  `calculated_amount` decimal(12,2) NOT NULL,
  `status` enum('Pending','Approved','Rejected','Processed') NOT NULL DEFAULT 'Pending',
  `approved_by` int DEFAULT NULL,
  `approval_date` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `jv_number` varchar(100) DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `leave_type_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_encash_approved_by` (`approved_by`),
  KEY `idx_leave_encashment_requests_employee_id` (`employee_id`),
  KEY `idx_leave_encashment_requests_request_date` (`request_date`),
  KEY `idx_leave_encashment_requests_status` (`status`),
  CONSTRAINT `fk_encash_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_encash_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leave_types`
--

DROP TABLE IF EXISTS `leave_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `initial_balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `accurable` tinyint(1) DEFAULT '0',
  `accural_rate` decimal(10,2) DEFAULT '0.00',
  `max_balance` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `is_encashable` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'If TRUE, this leave type can be converted to cash',
  PRIMARY KEY (`id`),
  KEY `idx_leave_types_updated_by` (`updated_by`),
  CONSTRAINT `fk_leave_types_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `after_leavetype_insert` AFTER INSERT ON `leave_types` FOR EACH ROW BEGIN
    
    
    INSERT INTO employee_leave_balance (leave_id, employee_id, balance, created_at, updated_at)
    SELECT 
        NEW.id,             
        u.id,               
        NEW.initial_balance,
        NOW(),              
        NOW()               
    FROM 
        user u;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `loan_amortization_schedule`
--

DROP TABLE IF EXISTS `loan_amortization_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_amortization_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_application_id` int NOT NULL,
  `due_date` date NOT NULL,
  `emi_amount` decimal(12,2) NOT NULL,
  `principal_component` decimal(12,2) NOT NULL,
  `interest_component` decimal(12,2) NOT NULL,
  `status` enum('Pending','Paid','Locked') NOT NULL DEFAULT 'Pending',
  `repayment_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_amortization_loan_app` (`loan_application_id`),
  KEY `idx_loan_amortization_schedule_due_date` (`due_date`),
  CONSTRAINT `fk_amortization_loan_app` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loan_applications`
--

DROP TABLE IF EXISTS `loan_applications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `application_id_text` varchar(50) NOT NULL,
  `employee_id` int NOT NULL,
  `loan_type_id` int NOT NULL,
  `requested_amount` decimal(12,2) NOT NULL,
  `approved_amount` decimal(12,2) DEFAULT NULL,
  `tenure_months` int NOT NULL,
  `emi_amount` decimal(12,2) DEFAULT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `purpose` text,
  `status` enum('Pending Approval','Approved','Rejected','Disbursed','Closed') NOT NULL DEFAULT 'Pending Approval',
  `manager_approver_id` int DEFAULT NULL,
  `hr_approver_id` int DEFAULT NULL,
  `rejection_reason` text,
  `disbursement_date` date DEFAULT NULL,
  `jv_number` varchar(100) DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `application_id_text` (`application_id_text`),
  KEY `fk_loan_app_type` (`loan_type_id`),
  KEY `fk_loan_app_manager` (`manager_approver_id`),
  KEY `fk_loan_app_hr` (`hr_approver_id`),
  KEY `fk_loan_app_updated_by` (`updated_by`),
  KEY `idx_loan_applications_employee_id` (`employee_id`),
  KEY `idx_loan_applications_status` (`status`),
  KEY `idx_loan_emp_status` (`employee_id`,`status`),
  CONSTRAINT `fk_loan_app_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_loan_app_hr` FOREIGN KEY (`hr_approver_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_loan_app_manager` FOREIGN KEY (`manager_approver_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_loan_app_type` FOREIGN KEY (`loan_type_id`) REFERENCES `loan_types` (`id`),
  CONSTRAINT `fk_loan_app_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loan_repayments`
--

DROP TABLE IF EXISTS `loan_repayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_repayments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_application_id` int NOT NULL,
  `schedule_id` int DEFAULT NULL,
  `payslip_id` int DEFAULT NULL,
  `repayment_amount` decimal(12,2) NOT NULL,
  `repayment_date` date NOT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_repayment_loan_app` (`loan_application_id`),
  KEY `fk_repayment_payslip` (`payslip_id`),
  KEY `fk_repayment_updated_by` (`updated_by`),
  KEY `idx_loan_repayments_repayment_date` (`repayment_date`),
  CONSTRAINT `fk_repayment_loan_app` FOREIGN KEY (`loan_application_id`) REFERENCES `loan_applications` (`id`),
  CONSTRAINT `fk_repayment_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `loan_types`
--

DROP TABLE IF EXISTS `loan_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `is_advance` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Set to TRUE if this is a salary advance',
  `interest_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `max_tenure_months` int NOT NULL,
  `eligibility_percentage` int NOT NULL COMMENT 'e.g., 80 for 80% of the calculated eligible amount',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `fk_loan_types_updated_by` (`updated_by`),
  KEY `idx_loan_types_is_active` (`is_active`),
  CONSTRAINT `fk_loan_types_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `name_series`
--

DROP TABLE IF EXISTS `name_series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `name_series` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(50) NOT NULL,
  `prefix` varchar(10) NOT NULL,
  `padding_length` int NOT NULL DEFAULT '5',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `table_name` (`table_name`),
  KEY `fk_code_prefixes_updated_by` (`updated_by`),
  CONSTRAINT `fk_code_prefixes_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_audit_flags`
--

DROP TABLE IF EXISTS `payroll_audit_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_audit_flags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `flag_type` varchar(100) NOT NULL COMMENT 'e.g., MISSING_ATTENDANCE, UNAPPROVED_OVERTIME',
  `description` text NOT NULL,
  `status` enum('Open','Resolved') NOT NULL DEFAULT 'Open',
  `resolved_by` int DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `resolved_by` (`resolved_by`),
  KEY `idx_payroll_audit_flags_cycle_id` (`cycle_id`),
  CONSTRAINT `payroll_audit_flags_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `payroll_cycles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payroll_audit_flags_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payroll_audit_flags_ibfk_3` FOREIGN KEY (`resolved_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_components`
--

DROP TABLE IF EXISTS `payroll_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_components` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` enum('earning','deduction') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_payroll_components_updated_by` (`updated_by`),
  CONSTRAINT `fk_payroll_components_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_cycle_groups`
--

DROP TABLE IF EXISTS `payroll_cycle_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_cycle_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cycle_group_unique` (`cycle_id`,`group_id`),
  KEY `group_id` (`group_id`),
  CONSTRAINT `payroll_cycle_groups_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `payroll_cycles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payroll_cycle_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `payroll_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_cycles`
--

DROP TABLE IF EXISTS `payroll_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_name` varchar(150) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('Draft','Auditing','Review','Finalized','Paid') NOT NULL DEFAULT 'Draft',
  `initiated_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `jv_number` text,
  PRIMARY KEY (`id`),
  KEY `initiated_by` (`initiated_by`),
  KEY `idx_payroll_cycles_start_date` (`start_date`),
  KEY `idx_payroll_cycles_end_date` (`end_date`),
  KEY `idx_payroll_cycles_status` (`status`),
  KEY `idx_cycle_dates` (`start_date`,`end_date`),
  CONSTRAINT `payroll_cycles_ibfk_1` FOREIGN KEY (`initiated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_group_components`
--

DROP TABLE IF EXISTS `payroll_group_components`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_group_components` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `component_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_component_unique` (`group_id`,`component_id`),
  KEY `component_id` (`component_id`),
  CONSTRAINT `payroll_group_components_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `payroll_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payroll_groups`
--

DROP TABLE IF EXISTS `payroll_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payroll_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_name` varchar(100) NOT NULL,
  `description` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_name` (`group_name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `payroll_groups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payslip_details`
--

DROP TABLE IF EXISTS `payslip_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payslip_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payslip_id` int NOT NULL,
  `component_id` int DEFAULT NULL COMMENT 'Link to payroll_components for structured items',
  `component_name` varchar(100) NOT NULL COMMENT 'Name of the earning or deduction',
  `component_type` enum('earning','deduction') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `calculation_breakdown` json DEFAULT NULL COMMENT 'Stores the detailed formula and values used for calculation',
  PRIMARY KEY (`id`),
  KEY `idx_payslip_details_payslip_id` (`payslip_id`),
  KEY `idx_payslip_details_component_type` (`component_type`),
  CONSTRAINT `payslip_details_ibfk_1` FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payslip_processed_items`
--

DROP TABLE IF EXISTS `payslip_processed_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payslip_processed_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payslip_id` int NOT NULL,
  `item_type` enum('loan_emi','hr_case','expense_claim') NOT NULL,
  `item_id` int NOT NULL COMMENT 'ID of the loan_amortization_schedule or hr_cases record',
  `status` enum('Processed','Finalized') NOT NULL DEFAULT 'Processed',
  PRIMARY KEY (`id`),
  KEY `idx_payslip_processed_items_payslip_id` (`payslip_id`),
  KEY `idx_payslip_processed_items_item_type` (`item_type`),
  CONSTRAINT `payslip_processed_items_ibfk_1` FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `payslips`
--

DROP TABLE IF EXISTS `payslips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payslips` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `gross_earnings` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_deductions` decimal(15,2) NOT NULL DEFAULT '0.00',
  `net_pay` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('Draft','Reviewed','Finalized') NOT NULL DEFAULT 'Draft',
  PRIMARY KEY (`id`),
  UNIQUE KEY `cycle_employee_unique` (`cycle_id`,`employee_id`),
  KEY `idx_payslips_employee_id` (`employee_id`),
  KEY `idx_payslips_cycle_id` (`cycle_id`),
  KEY `idx_payslip_emp_cycle` (`employee_id`,`cycle_id`),
  CONSTRAINT `payslips_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `payroll_cycles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payslips_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `performance_appraisals`
--

DROP TABLE IF EXISTS `performance_appraisals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_appraisals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `status` enum('Pending','Self-Assessment','Manager-Review','Completed') NOT NULL DEFAULT 'Pending',
  `overall_manager_rating` decimal(3,1) DEFAULT NULL,
  `final_manager_comments` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cycle_employee_unique` (`cycle_id`,`employee_id`),
  KEY `idx_performance_appraisals_employee_id` (`employee_id`),
  CONSTRAINT `fk_appraisal_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `performance_review_cycles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appraisal_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `performance_review_cycles`
--

DROP TABLE IF EXISTS `performance_review_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_review_cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cycle_name` varchar(150) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('Pending','Active','Closed') NOT NULL DEFAULT 'Pending',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cycle_name` (`cycle_name`),
  KEY `fk_cycle_created_by` (`created_by`),
  KEY `idx_performance_review_cycles_start_date` (`start_date`),
  KEY `idx_performance_review_cycles_end_date` (`end_date`),
  KEY `idx_performance_review_cycles_status` (`status`),
  CONSTRAINT `fk_cycle_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_permissions_updated_by` (`updated_by`),
  CONSTRAINT `fk_permissions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `required_documents`
--

DROP TABLE IF EXISTS `required_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `required_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `reminder_threshold` int NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_required_documents_updated_by` (`updated_by`),
  CONSTRAINT `fk_required_documents_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role` int NOT NULL,
  `permission` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `role` (`role`),
  KEY `permission` (`permission`),
  KEY `idx_role_permissions_updated_by` (`updated_by`),
  CONSTRAINT `fk_role_permissions_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role`) REFERENCES `roles` (`id`),
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission`) REFERENCES `permissions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `role_level` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_roles_updated_by` (`updated_by`),
  CONSTRAINT `fk_roles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shift_rotation_audit`
--

DROP TABLE IF EXISTS `shift_rotation_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotation_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rotation_id` int NOT NULL,
  `changed_by` int DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `details` text,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_audit_rotation_id_idx` (`rotation_id`),
  KEY `fk_audit_changed_by_idx` (`changed_by`),
  KEY `idx_shift_rotation_audit_changed_at` (`changed_at`),
  CONSTRAINT `fk_audit_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_rotation_id` FOREIGN KEY (`rotation_id`) REFERENCES `shift_rotations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shift_rotation_details`
--

DROP TABLE IF EXISTS `shift_rotation_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotation_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rotation_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `from_shift_id` int NOT NULL,
  `to_shift_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_detail_rotation_id_idx` (`rotation_id`),
  KEY `fk_detail_employee_id_idx` (`employee_id`),
  KEY `fk_detail_from_shift_idx` (`from_shift_id`),
  KEY `fk_detail_to_shift_idx` (`to_shift_id`),
  KEY `idx_shift_rotation_details_rotation_id` (`rotation_id`),
  CONSTRAINT `fk_detail_employee_id` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_detail_from_shift` FOREIGN KEY (`from_shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_detail_rotation_id` FOREIGN KEY (`rotation_id`) REFERENCES `shift_rotations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_detail_to_shift` FOREIGN KEY (`to_shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shift_rotations`
--

DROP TABLE IF EXISTS `shift_rotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_rotations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rotation_name` varchar(255) NOT NULL,
  `effective_from` date NOT NULL,
  `status` enum('Draft','Pending Approval','Approved','Executed') NOT NULL DEFAULT 'Draft',
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_rotation_created_by_idx` (`created_by`),
  KEY `fk_rotation_approved_by_idx` (`approved_by`),
  KEY `idx_shift_rotations_status` (`status`),
  CONSTRAINT `fk_rotation_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rotation_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `from_time` time NOT NULL,
  `to_time` time NOT NULL,
  `half_day_threshold` decimal(3,2) DEFAULT '0.00',
  `punch_in_margin` decimal(5,2) DEFAULT '0.00',
  `punch_out_margin` decimal(5,2) DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `overtime_threshold` decimal(5,2) NOT NULL DEFAULT '15.00',
  `scheduled_hours` decimal(4,2) NOT NULL COMMENT 'Total scheduled work hours for the shift',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_shifts_updated_by` (`updated_by`),
  CONSTRAINT `fk_shifts_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_set_scheduled_hours` BEFORE INSERT ON `shifts` FOR EACH ROW BEGIN
    
    DECLARE minutes_diff INT;

    SET minutes_diff = TIMESTAMPDIFF(MINUTE, NEW.from_time, NEW.to_time);

    
    IF minutes_diff < 0 THEN
        SET minutes_diff = minutes_diff + 1440; 
    END IF;

    
    SET NEW.scheduled_hours = ROUND(minutes_diff / 60, 2);
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `skills`
--

DROP TABLE IF EXISTS `skills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `skill_name` varchar(20) NOT NULL,
  `skill_description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `skill_name` (`skill_name`),
  KEY `idx_skills_updated_by` (`updated_by`),
  CONSTRAINT `fk_skills_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `uploaded_document`
--

DROP TABLE IF EXISTS `uploaded_document`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `uploaded_document` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `upload_link` varchar(200) NOT NULL,
  `upload_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `upload_link` (`upload_link`),
  UNIQUE KEY `user_id` (`user_id`,`document_id`),
  KEY `document_id` (`document_id`),
  KEY `idx_uploaded_document_updated_by` (`updated_by`),
  KEY `idx_uploaded_document_user_id` (`user_id`),
  KEY `idx_uploaded_document_upload_date` (`upload_date`),
  CONSTRAINT `fk_uploaded_document_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `uploaded_document_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `required_documents` (`id`),
  CONSTRAINT `uploaded_document_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `dob` date NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `profile_url` varchar(200) DEFAULT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `emergency_contact_name` varchar(50) DEFAULT NULL,
  `emergency_contact_relation` varchar(50) DEFAULT NULL,
  `emergency_contact_number` varchar(50) DEFAULT NULL,
  `joining_date` date NOT NULL,
  `system_role` int NOT NULL,
  `job_role` int DEFAULT NULL,
  `shift` int NOT NULL,
  `salary_visibility` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `reports_to` int DEFAULT NULL,
  `is_signed` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `inactive_date` datetime DEFAULT NULL,
  `inactivated_by` int DEFAULT NULL,
  `password_changed` tinyint(1) NOT NULL DEFAULT '0',
  `inactive_reason` text,
  `is_probation` tinyint(1) DEFAULT '1',
  `is_payroll_exempt` tinyint(1) NOT NULL DEFAULT '0',
  `nationality` varchar(100) DEFAULT NULL,
  `password_hash` varchar(200) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  `probation_days` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `profile_url` (`profile_url`),
  KEY `created_by` (`created_by`),
  KEY `idx_user_updated_by` (`updated_by`),
  KEY `fk_user_inactivated_by` (`inactivated_by`),
  KEY `idx_user_email` (`email`),
  KEY `idx_user_shift` (`shift`),
  KEY `idx_user_joining_date` (`joining_date`),
  KEY `idx_user_is_active` (`is_active`),
  KEY `idx_user_system_role` (`system_role`),
  KEY `idx_user_reports_to` (`reports_to`),
  KEY `idx_user_job_role` (`job_role`),
  KEY `idx_user_inactive_date` (`inactive_date`),
  KEY `idx_user_active_join` (`is_active`,`joining_date`),
  KEY `idx_user_mgr_active` (`reports_to`,`is_active`),
  CONSTRAINT `fk_user_inactivated_by` FOREIGN KEY (`inactivated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_user_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `user_ibfk_1` FOREIGN KEY (`system_role`) REFERENCES `roles` (`id`),
  CONSTRAINT `user_ibfk_2` FOREIGN KEY (`job_role`) REFERENCES `jobs` (`id`),
  CONSTRAINT `user_ibfk_3` FOREIGN KEY (`shift`) REFERENCES `shifts` (`id`),
  CONSTRAINT `user_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`),
  CONSTRAINT `user_ibfk_5` FOREIGN KEY (`reports_to`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `after_user_insert_populate_leave_balances` AFTER INSERT ON `user` FOR EACH ROW BEGIN
    
    
    INSERT INTO employee_leave_balance (employee_id, leave_id, balance)
    SELECT 
        NEW.id,             
        lt.id,              
        lt.initial_balance  
    FROM 
        leave_types lt;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = cp850 */ ;
/*!50003 SET character_set_results = cp850 */ ;
/*!50003 SET collation_connection  = cp850_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`%`*/ /*!50003 TRIGGER `trg_user_audit` AFTER UPDATE ON `user` FOR EACH ROW BEGIN
    
    IF (OLD.id <> NEW.id) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'id', OLD.id, NEW.id, NEW.updated_by);
    END IF;

    
    IF (OLD.first_name <> NEW.first_name) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'first_name', OLD.first_name, NEW.first_name, NEW.updated_by);
    END IF;

    
    IF (OLD.last_name <> NEW.last_name) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'last_name', OLD.last_name, NEW.last_name, NEW.updated_by);
    END IF;

    
    IF (OLD.dob <> NEW.dob) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'dob', OLD.dob, NEW.dob, NEW.updated_by);
    END IF;

    
    IF (OLD.email <> NEW.email) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'email', OLD.email, NEW.email, NEW.updated_by);
    END IF;

    
    IF (OLD.phone <> NEW.phone) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'phone', OLD.phone, NEW.phone, NEW.updated_by);
    END IF;

    
    IF (OLD.profile_url <> NEW.profile_url) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'profile_url', OLD.profile_url, NEW.profile_url, NEW.updated_by);
    END IF;

    
    IF (OLD.gender <> NEW.gender) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'gender', OLD.gender, NEW.gender, NEW.updated_by);
    END IF;

    
    IF (OLD.emergency_contact_name <> NEW.emergency_contact_name) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'emergency_contact_name', OLD.emergency_contact_name, NEW.emergency_contact_name, NEW.updated_by);
    END IF;

    
    IF (OLD.emergency_contact_relation <> NEW.emergency_contact_relation) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'emergency_contact_relation', OLD.emergency_contact_relation, NEW.emergency_contact_relation, NEW.updated_by);
    END IF;

    
    IF (OLD.emergency_contact_number <> NEW.emergency_contact_number) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'emergency_contact_number', OLD.emergency_contact_number, NEW.emergency_contact_number, NEW.updated_by);
    END IF;

    
    IF (OLD.joining_date <> NEW.joining_date) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'joining_date', OLD.joining_date, NEW.joining_date, NEW.updated_by);
    END IF;

    
    IF (OLD.system_role <> NEW.system_role) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'system_role', OLD.system_role, NEW.system_role, NEW.updated_by);
    END IF;

    
    IF (OLD.job_role <> NEW.job_role) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'job_role', OLD.job_role, NEW.job_role, NEW.updated_by);
    END IF;

    
    IF (OLD.shift <> NEW.shift) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'shift', OLD.shift, NEW.shift, NEW.updated_by);
    END IF;

    
    IF (OLD.salary_visibility <> NEW.salary_visibility) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'salary_visibility', OLD.salary_visibility, NEW.salary_visibility, NEW.updated_by);
    END IF;

    
    IF (OLD.created_by <> NEW.created_by) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'created_by', OLD.created_by, NEW.created_by, NEW.updated_by);
    END IF;

    
    IF (OLD.reports_to <> NEW.reports_to) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'reports_to', OLD.reports_to, NEW.reports_to, NEW.updated_by);
    END IF;

    
    IF (OLD.is_signed <> NEW.is_signed) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'is_signed', OLD.is_signed, NEW.is_signed, NEW.updated_by);
    END IF;

    
    IF (OLD.is_active <> NEW.is_active) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'is_active', OLD.is_active, NEW.is_active, NEW.updated_by);
    END IF;

    
    IF (OLD.inactive_date <> NEW.inactive_date) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'inactive_date', OLD.inactive_date, NEW.inactive_date, NEW.updated_by);
    END IF;

    
    IF (OLD.inactivated_by <> NEW.inactivated_by) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'inactivated_by', OLD.inactivated_by, NEW.inactivated_by, NEW.updated_by);
    END IF;

    
    IF (OLD.password_changed <> NEW.password_changed) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'password_changed', OLD.password_changed, NEW.password_changed, NEW.updated_by);
    END IF;

    
    IF (OLD.inactive_reason <> NEW.inactive_reason) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'inactive_reason', OLD.inactive_reason, NEW.inactive_reason, NEW.updated_by);
    END IF;

    
    IF (OLD.is_probation <> NEW.is_probation) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'is_probation', OLD.is_probation, NEW.is_probation, NEW.updated_by);
    END IF;

    
    IF (OLD.is_payroll_exempt <> NEW.is_payroll_exempt) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'is_payroll_exempt', OLD.is_payroll_exempt, NEW.is_payroll_exempt, NEW.updated_by);
    END IF;

    
    IF (OLD.nationality <> NEW.nationality) THEN
        INSERT INTO user_audit(user_id, field_changed, old_value, new_value, updated_by)
        VALUES (OLD.id, 'nationality', OLD.nationality, NEW.nationality, NEW.updated_by);
    END IF;

END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `user_audit`
--

DROP TABLE IF EXISTS `user_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_audit` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `field_changed` varchar(100) NOT NULL,
  `old_value` text,
  `new_value` text,
  `updated_by` int DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `idx_user_audit_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `work_week`
--

DROP TABLE IF EXISTS `work_week`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_week` (
  `id` int NOT NULL AUTO_INCREMENT,
  `day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  `is_working_day` tinyint(1) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `day_of_week` (`day_of_week`),
  KEY `idx_work_week_updated_by` (`updated_by`),
  CONSTRAINT `fk_work_week_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping events for database 'hrms'
--

--
-- Dumping routines for database 'hrms'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-04 10:20:58
