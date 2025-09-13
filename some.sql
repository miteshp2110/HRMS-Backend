
-- HRMS Schema Creation Script
-- Generated from dump provided on 2025-09-12

-- Set session variables for a clean import
SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT;
SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS;
SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION;
SET NAMES utf8mb4;
SET @OLD_TIME_ZONE=@@TIME_ZONE;
SET TIME_ZONE='+00:00';
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO';
SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0;

-- Create the database if it does not exist
CREATE DATABASE IF NOT EXISTS `hrms` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `hrms`;

--
-- Table structure for table `roles`
--
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `role_level` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `jobs`
--
DROP TABLE IF EXISTS `jobs`;
CREATE TABLE `jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `shifts`
--
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `from_time` time NOT NULL,
  `to_time` time NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `half_day_threshold` decimal(3,2) DEFAULT '0.00',
  `punch_in_margin` decimal(5,2) DEFAULT '0.00',
  `punch_out_margin` decimal(5,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `user`
--
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `dob` date NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `profile_url` varchar(200) DEFAULT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `emergency_contact_name` varchar(50) NOT NULL,
  `emergency_contact_relation` varchar(50) NOT NULL,
  `emergency_contact_number` varchar(50) NOT NULL,
  `joining_date` date NOT NULL,
  `system_role` int NOT NULL,
  `job_role` int DEFAULT NULL,
  `shift` int NOT NULL,
  `salary_visibility` tinyint(1) DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL,
  `reports_to` int DEFAULT NULL,
  `is_signed` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `is_probation` tinyint(1) DEFAULT '1',
  `is_payroll_exempt` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `password_hash` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `phone` (`phone`),
  UNIQUE KEY `profile_url` (`profile_url`),
  KEY `system_role` (`system_role`),
  KEY `job_role` (`job_role`),
  KEY `shift` (`shift`),
  KEY `created_by` (`created_by`),
  KEY `reports_to` (`reports_to`),
  CONSTRAINT `user_ibfk_1` FOREIGN KEY (`system_role`) REFERENCES `roles` (`id`),
  CONSTRAINT `user_ibfk_2` FOREIGN KEY (`job_role`) REFERENCES `jobs` (`id`),
  CONSTRAINT `user_ibfk_3` FOREIGN KEY (`shift`) REFERENCES `shifts` (`id`),
  CONSTRAINT `user_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`),
  CONSTRAINT `user_ibfk_5` FOREIGN KEY (`reports_to`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Trigger for table `user`: after_user_insert_populate_leave_balances
--
DELIMITER ;;
CREATE TRIGGER `after_user_insert_populate_leave_balances` AFTER INSERT ON `user` FOR EACH ROW
BEGIN
    INSERT INTO employee_leave_balance (employee_id, leave_id, balance)
    SELECT
        NEW.id,
        lt.id,
        lt.initial_balance
    FROM
        leave_types lt;
END;;
DELIMITER ;

--
-- Table structure for table `attendance_record`
--
DROP TABLE IF EXISTS `attendance_record`;
CREATE TABLE `attendance_record` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `attendance_date` date NOT NULL,
  `shift` int NOT NULL,
  `punch_in` timestamp NULL DEFAULT NULL,
  `punch_out` timestamp NULL DEFAULT NULL,
  `hours_worked` decimal(5,2) DEFAULT NULL,
  `attendance_status` enum('present','absent','late','leave') NOT NULL,
  `pay_type` enum('unpaid','half_day','full_day','overtime','leave','no_punch_out') DEFAULT NULL,
  `overtime_status` tinyint(1) DEFAULT NULL,
  `overtime_approved_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`attendance_date`),
  KEY `shift` (`shift`),
  KEY `approved_by` (`overtime_approved_by`),
  KEY `fk_updated_by` (`updated_by`),
  CONSTRAINT `attendance_record_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `attendance_record_ibfk_2` FOREIGN KEY (`shift`) REFERENCES `shifts` (`id`),
  CONSTRAINT `attendance_record_ibfk_3` FOREIGN KEY (`overtime_approved_by`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `bank_details`
--
DROP TABLE IF EXISTS `bank_details`;
CREATE TABLE `bank_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bank_name` varchar(20) NOT NULL,
  `bank_account` varchar(30) NOT NULL,
  `bank_ifsc` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `bank_account` (`bank_account`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `bank_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `leave_types`
--
DROP TABLE IF EXISTS `leave_types`;
CREATE TABLE `leave_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `description` text NOT NULL,
  `initial_balance` decimal(10,2) NOT NULL DEFAULT '0.00',
  `accurable` tinyint(1) DEFAULT '0',
  `accural_rate` decimal(10,2) DEFAULT '0.00',
  `max_balance` decimal(10,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Trigger for table `leave_types`: after_leavetype_insert
--
DELIMITER ;;
CREATE TRIGGER `after_leavetype_insert` AFTER INSERT ON `leave_types` FOR EACH ROW
BEGIN
    INSERT INTO employee_leave_balance (leave_id, employee_id, balance, created_at, updated_at)
    SELECT
        NEW.id,
        u.id,
        NEW.initial_balance,
        NOW(),
        NOW()
    FROM
        user u;
END;;
DELIMITER ;

--
-- Table structure for table `employee_leave_balance`
--
DROP TABLE IF EXISTS `employee_leave_balance`;
CREATE TABLE `employee_leave_balance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leave_id` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `balance` decimal(10,2) DEFAULT '0.00',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `fk_leave_balance_leave_type` (`leave_id`),
  CONSTRAINT `employee_leave_balance_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_leave_balance_leave_type` FOREIGN KEY (`leave_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `employee_leave_records`
--
DROP TABLE IF EXISTS `employee_leave_records`;
CREATE TABLE `employee_leave_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leave_type` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `leave_description` text NOT NULL,
  `applied_date` date NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `rejection_reason` text,
  `primary_status` tinyint(1) DEFAULT '0',
  `secondry_status` tinyint(1) DEFAULT '0',
  `primary_user` int DEFAULT NULL,
  `secondry_user` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `leave_type` (`leave_type`),
  KEY `employee_id` (`employee_id`),
  KEY `primary_user` (`primary_user`),
  KEY `secondry_user` (`secondry_user`),
  CONSTRAINT `employee_leave_records_ibfk_1` FOREIGN KEY (`leave_type`) REFERENCES `leave_types` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_3` FOREIGN KEY (`primary_user`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_leave_records_ibfk_4` FOREIGN KEY (`secondry_user`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `employee_loans`
--
DROP TABLE IF EXISTS `employee_loans`;
CREATE TABLE `employee_loans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `loan_type` enum('loan','advance') NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text,
  `principal_amount` decimal(12,2) NOT NULL,
  `emi_amount` decimal(12,2) NOT NULL,
  `total_installments` int NOT NULL,
  `remaining_installments` int NOT NULL,
  `status` enum('pending_approval','approved','rejected','active','paid_off') NOT NULL DEFAULT 'pending_approval',
  `request_date` date NOT NULL,
  `approval_date` date DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `disbursement_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `employee_loans_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_loans_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `payroll_components`
--
DROP TABLE IF EXISTS `payroll_components`;
CREATE TABLE `payroll_components` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` enum('earning','deduction') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `employee_salary_structure`
--
DROP TABLE IF EXISTS `employee_salary_structure`;
CREATE TABLE `employee_salary_structure` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `component_id` int NOT NULL,
  `value_type` enum('fixed','percentage') NOT NULL,
  `value` decimal(12,2) NOT NULL,
  `based_on_component_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`,`component_id`),
  KEY `component_id` (`component_id`),
  KEY `based_on_component_id` (`based_on_component_id`),
  CONSTRAINT `employee_salary_structure_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `employee_salary_structure_ibfk_2` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`),
  CONSTRAINT `employee_salary_structure_ibfk_3` FOREIGN KEY (`based_on_component_id`) REFERENCES `payroll_components` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `skills`
--
DROP TABLE IF EXISTS `skills`;
CREATE TABLE `skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `skill_name` varchar(20) NOT NULL,
  `skill_description` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `skill_name` (`skill_name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `employee_skill_matrix`
--
DROP TABLE IF EXISTS `employee_skill_matrix`;
CREATE TABLE `employee_skill_matrix` (
  `id` int NOT NULL AUTO_INCREMENT,
  `skill_id` int DEFAULT NULL,
  `employee_id` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `skill_id` (`skill_id`),
  KEY `employee_id` (`employee_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `employee_skill_matrix_ibfk_1` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`id`),
  CONSTRAINT `employee_skill_matrix_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `employee_skill_matrix_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `expense_on_employee`
--
DROP TABLE IF EXISTS `expense_on_employee`;
CREATE TABLE `expense_on_employee` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int DEFAULT NULL,
  `expense_title` varchar(30) NOT NULL,
  `expense_description` text NOT NULL,
  `expense` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `expense_on_employee_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `holidays`
--
DROP TABLE IF EXISTS `holidays`;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `holiday_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `holiday_date` (`holiday_date`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `payrolls`
--
DROP TABLE IF EXISTS `payrolls`;
CREATE TABLE `payrolls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pay_period_start` date NOT NULL,
  `pay_period_end` date NOT NULL,
  `total_net_pay` decimal(15,2) NOT NULL,
  `status` enum('processing','paid') NOT NULL DEFAULT 'processing',
  `initiated_by` int NOT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pay_period_start` (`pay_period_start`,`pay_period_end`),
  KEY `initiated_by` (`initiated_by`),
  CONSTRAINT `payrolls_ibfk_1` FOREIGN KEY (`initiated_by`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `payslips`
--
DROP TABLE IF EXISTS `payslips`;
CREATE TABLE `payslips` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payroll_id` int NOT NULL,
  `employee_id` int NOT NULL,
  `pay_period_start` date NOT NULL,
  `pay_period_end` date NOT NULL,
  `payment_date` date DEFAULT NULL,
  `gross_earnings` decimal(15,2) NOT NULL,
  `total_deductions` decimal(15,2) NOT NULL,
  `net_pay` decimal(15,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  KEY `payslips_ibfk_2` (`payroll_id`),
  CONSTRAINT `payslips_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `payslips_ibfk_2` FOREIGN KEY (`payroll_id`) REFERENCES `payrolls` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `loan_repayments`
--
DROP TABLE IF EXISTS `loan_repayments`;
CREATE TABLE `loan_repayments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `loan_id` int NOT NULL,
  `payslip_id` int DEFAULT NULL,
  `repayment_amount` decimal(12,2) NOT NULL,
  `repayment_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `loan_id` (`loan_id`),
  KEY `payslip_id` (`payslip_id`),
  CONSTRAINT `loan_repayments_ibfk_1` FOREIGN KEY (`loan_id`) REFERENCES `employee_loans` (`id`),
  CONSTRAINT `loan_repayments_ibfk_2` FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `payslip_details`
--
DROP TABLE IF EXISTS `payslip_details`;
CREATE TABLE `payslip_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payslip_id` int NOT NULL,
  `component_name` varchar(100) NOT NULL,
  `component_type` enum('earning','deduction') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `payslip_id` (`payslip_id`),
  CONSTRAINT `payslip_details_ibfk_1` FOREIGN KEY (`payslip_id`) REFERENCES `payslips` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `permissions`
--
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `role_permissions`
--
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role` int NOT NULL,
  `permission` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `role` (`role`),
  KEY `permission` (`permission`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role`) REFERENCES `roles` (`id`),
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission`) REFERENCES `permissions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `required_documents`
--
DROP TABLE IF EXISTS `required_documents`;
CREATE TABLE `required_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `uploaded_document`
--
DROP TABLE IF EXISTS `uploaded_document`;
CREATE TABLE `uploaded_document` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `upload_link` varchar(200) NOT NULL,
  `upload_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `upload_link` (`upload_link`),
  UNIQUE KEY `user_id` (`user_id`,`document_id`),
  KEY `document_id` (`document_id`),
  CONSTRAINT `uploaded_document_ibfk_1` FOREIGN KEY (`document_id`) REFERENCES `required_documents` (`id`),
  CONSTRAINT `uploaded_document_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `work_week`
--
DROP TABLE IF EXISTS `work_week`;
CREATE TABLE `work_week` (
  `id` int NOT NULL AUTO_INCREMENT,
  `day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
  `is_working_day` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `day_of_week` (`day_of_week`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Static Enum-like tables (optional, but good practice to have)
--
DROP TABLE IF EXISTS `attandance_status_enum`;
CREATE TABLE `attandance_status_enum` (
  `status` enum('present','absent','leave') NOT NULL,
  PRIMARY KEY (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `gender_types`;
CREATE TABLE `gender_types` (
  `gender` enum('Male','Female') NOT NULL,
  PRIMARY KEY (`gender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Stored Procedures (None found in the provided dump)
--

-- Restore original session variables
SET TIME_ZONE=@OLD_TIME_ZONE;
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT;
SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS;
SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION;
SET SQL_NOTES=@OLD_SQL_NOTES;

-- Script End


INSERT INTO permissions (`name`) 
VALUES 
('documents.manage'),
('skills.manage'),
('leaves.manage'),
('expenses.manage'),
('user.manage'),
('roles.manage'),
('job.manage'),
('shift.manage'),
('attendance.manage'),
('loans.manage'),
('salary.manage'),
('calender.manage'),
('payroll.manage'),
('attendance.view'),
('leaves.approve');


insert into payroll_components (name,type) value ('Base Salary','earning');