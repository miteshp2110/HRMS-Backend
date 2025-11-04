INSERT INTO permissions (id, name) VALUES
(13, 'documents.manage'),
(14, 'skills.manage'),
(15, 'leaves.manage'),
(16, 'expenses.manage'),
(17, 'user.manage'),
(18, 'roles.manage'),
(19, 'job.manage'),
(20, 'shift.manage'),
(21, 'attendance.manage'),
(22, 'loans.manage'),
(23, 'salary.manage'),
(24, 'calender.manage'),
(25, 'payroll.manage'),
(26, 'attendance.view'),
(27, 'leaves.approve'),
(28, 'finance.manage'),
(29, 'benefits.manage'),
(30, 'eos.manage'),
(31, 'cases.manage'),
(32, 'onboarding.manage'),
(33, 'performance.manage'),
(34, 'master.key');


INSERT INTO name_series (id, table_name, prefix, padding_length) VALUES
(1, 'user', 'EMP', 5),
(4, 'employee_leave_records', 'LR', 5);


INSERT INTO payroll_components (id, name, type) VALUES
(1, 'Base Salary', 'earning'),
(5, 'Overtime (Regular)', 'earning'),
(6, 'Overtime (Holiday)', 'earning');


INSERT INTO roles (id, name, role_level) VALUES
(1, 'Super Admin', 1);


INSERT INTO role_permissions (role, permission) VALUES
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(1, 34);


INSERT INTO shifts (
  id, 
  name, 
  from_time, 
  to_time, 
  half_day_threshold, 
  punch_in_margin, 
  punch_out_margin, 
  overtime_threshold, 
  scheduled_hours
) VALUES
(1, 'Morning Shift', '04:00:00', '12:00:00', 4.00, 15.00, 15.00, 15.00, 8.00);


INSERT INTO work_week (id, day_of_week, is_working_day) VALUES
(1, 'monday', 1),
(2, 'tuesday', 1),
(3, 'wednesday', 1),
(4, 'thursday', 1),
(5, 'friday', 1),
(6, 'saturday', 1),
(7, 'sunday', 0);


INSERT INTO jobs (id, title, description) VALUES
(1, 'Owner', 'The Owner manages the complete working of the company and have all the permissions within the company.');


INSERT INTO user (
  first_name, last_name, dob, email, phone, profile_url, gender,
  emergency_contact_name, emergency_contact_relation, emergency_contact_number,
  joining_date, system_role, job_role, shift, salary_visibility,
  created_by, reports_to, is_signed, is_active, inactive_date,
  inactivated_by, password_changed, inactive_reason, is_probation,
  is_payroll_exempt, nationality, password_hash, created_at,
  updated_at, updated_by, probation_days
)
VALUES (
  'John', 'Doe', '2003-10-21', 'johndoe@gmail.com', '1234567897', NULL, 'Male',
  'Some Name', 'Brother', '9170000000',
  '2025-01-24', 1, 1, 1, 1,
  NULL, NULL, 1, 1, NULL,
  NULL, 0, NULL, 0,
  0, 'Indian', '$2b$08$uJw1DICYr/DwGCvq29mK7.81oiLgvX77bRXZpVOJUAn2mKNx7LCBe',
  '2025-09-15 05:18:23', '2025-10-16 13:14:22', 1, 0
);


UPDATE user
SET reports_to = 1
WHERE id = 1; 
