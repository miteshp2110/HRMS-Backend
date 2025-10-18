
alter table employee_overtime_records add column reason text null;

alter table employee_salary_revisions add column updated_by int ;

ALTER TABLE employee_goals
MODIFY COLUMN employee_rating DECIMAL(5,2),
MODIFY COLUMN manager_rating DECIMAL(5,2);

ALTER TABLE employee_kpis
MODIFY COLUMN employee_rating DECIMAL(5,2),
MODIFY COLUMN manager_rating DECIMAL(5,2);
