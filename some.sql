DELIMITER $$

CREATE TRIGGER after_leavetype_insert
AFTER INSERT ON leave_types
FOR EACH ROW
BEGIN
    -- For the newly inserted leave_type (referenced by NEW),
    -- insert a new balance record for every single user in the user table.
    INSERT INTO employee_leave_balance (leave_id, employee_id, balance, created_at, updated_at)
    SELECT 
        NEW.id,             -- The ID of the new leave type
        u.id,               -- The ID of each user
        NEW.initial_balance,-- The initial balance from the new leave type
        NOW(),              -- The current timestamp
        NOW()               -- The current timestamp
    FROM 
        user u;
END$$

DELIMITER ;