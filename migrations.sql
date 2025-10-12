alter table user add column probation_days int default 0 not null;
alter table attendance_record add column update_reason text ;


-- drop if exists (safer than CREATE OR REPLACE for older MySQL)
DROP TRIGGER IF EXISTS trg_attendance_update;
DELIMITER $$

CREATE TRIGGER trg_attendance_update
AFTER UPDATE ON attendance_record
FOR EACH ROW
BEGIN
    -- Punch In
    IF NOT (OLD.punch_in <=> NEW.punch_in) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'punch_in', OLD.punch_in, NEW.punch_in, NEW.updated_by, NOW());
    END IF;

    -- Punch Out
    IF NOT (OLD.punch_out <=> NEW.punch_out) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'punch_out', OLD.punch_out, NEW.punch_out, NEW.updated_by, NOW());
    END IF;

    -- Hours Worked
    IF NOT (OLD.hours_worked <=> NEW.hours_worked) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'hours_worked', OLD.hours_worked, NEW.hours_worked, NEW.updated_by, NOW());
    END IF;

    -- Short Hours
    IF NOT (OLD.short_hours <=> NEW.short_hours) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'short_hours', OLD.short_hours, NEW.short_hours, NEW.updated_by, NOW());
    END IF;

    -- Attendance Status
    IF NOT (OLD.attendance_status <=> NEW.attendance_status) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'attendance_status', OLD.attendance_status, NEW.attendance_status, NEW.updated_by, NOW());
    END IF;

    -- Is Late
    IF NOT (OLD.is_late <=> NEW.is_late) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'is_late', OLD.is_late, NEW.is_late, NEW.updated_by, NOW());
    END IF;

    -- Is Early Departure
    IF NOT (OLD.is_early_departure <=> NEW.is_early_departure) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'is_early_departure', OLD.is_early_departure, NEW.is_early_departure, NEW.updated_by, NOW());
    END IF;

    -- Update Reason
    IF NOT (OLD.update_reason <=> NEW.update_reason) THEN
        INSERT INTO attendance_audit_log (attendance_id, field_name, old_value, new_value, changed_by, changed_at)
        VALUES (OLD.id, 'update_reason', OLD.update_reason, NEW.update_reason, NEW.updated_by, NOW());
    END IF;
END$$

DELIMITER ;

-- Table structure for table `employee_salary_structure_audit`
-- This table will log changes made to the employee_salary_structure table.

DROP TABLE IF EXISTS `employee_salary_structure_audit`;

CREATE TABLE `employee_salary_structure_audit` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `salary_structure_id` INT NOT NULL COMMENT 'The ID of the record from employee_salary_structure',
  `employee_id` INT NOT NULL,
  `action_type` ENUM('UPDATE', 'DELETE') NOT NULL,
  `old_data` JSON DEFAULT NULL COMMENT 'Stores the previous values of the changed columns',
  `new_data` JSON DEFAULT NULL COMMENT 'Stores the new values of the changed columns',
  `changed_by` INT DEFAULT NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salary_structure_id` (`salary_structure_id`),
  KEY `idx_employee_id` (`employee_id`),
  KEY `fk_ess_audit_changed_by` (`changed_by`),
  CONSTRAINT `fk_ess_audit_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



-- Trigger to log updates on the employee_salary_structure table

DELIMITER $$

CREATE TRIGGER `trg_after_salary_structure_update`
AFTER UPDATE ON `employee_salary_structure`
FOR EACH ROW
BEGIN
    DECLARE old_json JSON;
    DECLARE new_json JSON;
    
    SET old_json = JSON_OBJECT();
    SET new_json = JSON_OBJECT();

    -- Check and log each field change
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

    -- Only insert into audit log if at least one field has changed
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
END$$

DELIMITER ;

-- Table structure for table `employee_salary_revisions`
-- This table is for scheduling upcoming salary changes for employees.

DROP TABLE IF EXISTS `employee_salary_revisions`;

CREATE TABLE `employee_salary_revisions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `employee_id` INT NOT NULL,
  `component_id` INT NOT NULL COMMENT 'The salary component being revised (e.g., Basic Salary)',
  `effective_date` DATE NOT NULL COMMENT 'The date this revision should take effect',
  `new_calculation_type` ENUM('Fixed','Percentage','Formula') NOT NULL,
  `new_value` DECIMAL(12,2) NOT NULL,
  `new_based_on_component_id` INT DEFAULT NULL,
  `new_custom_formula` TEXT DEFAULT NULL,
  `status` ENUM('Scheduled','Applied','Cancelled') NOT NULL DEFAULT 'Scheduled',
  `reason` TEXT COMMENT 'Reason for the salary revision (e.g., Annual Increment, Promotion)',
  `created_by` INT DEFAULT NULL,
  `applied_by` INT DEFAULT NULL COMMENT 'User or process that applied this revision',
  `applied_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when the revision was applied',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_revision_employee` (`employee_id`),
  KEY `fk_revision_component` (`component_id`),
  KEY `fk_revision_created_by` (`created_by`),
  KEY `fk_revision_applied_by` (`applied_by`),
  CONSTRAINT `fk_revision_applied_by` FOREIGN KEY (`applied_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_revision_component` FOREIGN KEY (`component_id`) REFERENCES `payroll_components` (`id`),
  CONSTRAINT `fk_revision_created_by` FOREIGN KEY (`created_by`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_revision_employee` FOREIGN KEY (`employee_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Trigger to log deletions from the employee_salary_structure table

DELIMITER $$

CREATE TRIGGER `trg_after_salary_structure_delete`
AFTER DELETE ON `employee_salary_structure`
FOR EACH ROW
BEGIN
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
        NULL -- Note: Cannot determine who deleted the row from within the trigger itself
    );
END$$

DELIMITER ;