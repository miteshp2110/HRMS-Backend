-- ALTER TABLE employee_overtime_audit_log
-- DROP FOREIGN KEY employee_overtime_audit_log_ibfk_1;


ALTER TABLE user 
MODIFY emergency_contact_name VARCHAR(50) NULL,
MODIFY emergency_contact_relation VARCHAR(50) NULL,
MODIFY emergency_contact_number VARCHAR(50) NULL;
