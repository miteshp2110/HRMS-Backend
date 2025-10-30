
-- ALTER TABLE payslip_processed_items 
-- MODIFY COLUMN item_type ENUM('loan_emi', 'hr_case', 'expense_claim') NOT NULL;


-- ALTER TABLE hr_cases
-- ADD COLUMN payslip_id INT NULL,
-- ADD CONSTRAINT fk_hr_cases_payslip
-- FOREIGN KEY (payslip_id) REFERENCES payslips(id)
-- ON DELETE SET NULL
-- ON UPDATE CASCADE;


-- alter table hr_cases modify column status enum ('Open','Under Review','Approved','Locked','Rejected','Closed') not null Default 'Open';

-- alter table expense_claims modify column status enum ('Pending','Approved','Rejected','Processed','Locked','Reimbursed') not null default 'Pending';

-- alter table loan_amortization_schedule modify column status enum ('Pending','Paid','Locked') not null default 'Pending';

-- alter table payroll_cycles add column jv_number text ;