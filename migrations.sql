ALTER TABLE user 
MODIFY dob DATE NULL;


DROP TRIGGER IF EXISTS trg_set_scheduled_hours;
