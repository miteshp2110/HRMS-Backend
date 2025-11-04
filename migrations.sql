-- -- USER table indexes
-- CREATE INDEX idx_user_email ON user(email);
-- CREATE INDEX idx_user_is_active ON user(is_active);
-- CREATE INDEX idx_user_system_role ON user(system_role);
-- CREATE INDEX idx_user_reports_to ON user(reports_to);
-- CREATE INDEX idx_user_job_role ON user(job_role);
-- CREATE INDEX idx_user_shift ON user(shift);
-- CREATE INDEX idx_user_joining_date ON user(joining_date);
-- CREATE INDEX idx_user_inactive_date ON user(inactive_date);
-- CREATE INDEX idx_user_active_join ON user(is_active, joining_date);
-- CREATE INDEX idx_user_mgr_active ON user(reports_to, is_active);


-- -- ATTENDANCE_RECORD indexes
-- CREATE INDEX idx_attendance_record_employee_id ON attendance_record(employee_id);
-- CREATE INDEX idx_attendance_record_attendance_date ON attendance_record(attendance_date);
-- CREATE INDEX idx_attendance_record_attendance_status ON attendance_record(attendance_status);
-- CREATE INDEX idx_attendance_record_is_late ON attendance_record(is_late);
-- CREATE INDEX idx_attendance_record_is_early_departure ON attendance_record(is_early_departure);
-- CREATE INDEX idx_att_emp_date ON attendance_record(employee_id, attendance_date);
-- CREATE INDEX idx_att_date_status ON attendance_record(attendance_date, attendance_status);

-- -- ATTENDANCE_AUDIT_LOG indexes
-- CREATE INDEX idx_attendance_audit_log_changed_at ON attendance_audit_log(changed_at);
-- CREATE INDEX idx_attendance_audit_log_field_name ON attendance_audit_log(field_name);

-- -- BULK_ATTENDANCE_LOG indexes
-- CREATE INDEX idx_bulk_attendance_log_upload_date ON bulk_attendance_log(upload_date);
-- CREATE INDEX idx_bulk_attendance_log_uploaded_by ON bulk_attendance_log(uploaded_by);


-- -- EMPLOYEE_LEAVE_RECORDS indexes
-- CREATE INDEX idx_employee_leave_records_employee_id ON employee_leave_records(employee_id);
-- CREATE INDEX idx_employee_leave_records_from_date ON employee_leave_records(from_date);
-- CREATE INDEX idx_employee_leave_records_to_date ON employee_leave_records(to_date);
-- CREATE INDEX idx_employee_leave_records_leave_type ON employee_leave_records(leave_type);
-- CREATE INDEX idx_employee_leave_records_primary_status ON employee_leave_records(primary_status);
-- CREATE INDEX idx_employee_leave_records_secondry_status ON employee_leave_records(secondry_status);
-- CREATE INDEX idx_employee_leave_records_applied_date ON employee_leave_records(applied_date);
-- CREATE INDEX idx_leave_emp_type ON employee_leave_records(employee_id, leave_type);
-- CREATE INDEX idx_leave_emp_status ON employee_leave_records(employee_id, primary_status);
-- CREATE INDEX idx_leave_date_range ON employee_leave_records(from_date, to_date);

-- -- EMPLOYEE_LEAVE_BALANCE indexes
-- CREATE INDEX idx_employee_leave_balance_employee_id ON employee_leave_balance(employee_id);
-- CREATE INDEX idx_employee_leave_balance_leave_type ON employee_leave_balance(leave_type);
-- CREATE INDEX idx_employee_leave_balance_year ON employee_leave_balance(year);
-- CREATE INDEX idx_leave_bal_emp_type_year ON employee_leave_balance(employee_id, leave_type, year);

-- -- EMPLOYEE_LEAVE_BALANCE_LEDGER indexes
-- CREATE INDEX idx_employee_leave_balance_ledger_employee_id ON employee_leave_balance_ledger(employee_id);
-- CREATE INDEX idx_employee_leave_balance_ledger_transaction_date ON employee_leave_balance_ledger(transaction_date);
-- CREATE INDEX idx_employee_leave_balance_ledger_transaction_type ON employee_leave_balance_ledger(transaction_type);
-- CREATE INDEX idx_ledger_emp_type ON employee_leave_balance_ledger(employee_id, leave_type);

-- -- LEAVE_AUDIT_LOG indexes
-- CREATE INDEX idx_leave_audit_log_changed_at ON leave_audit_log(changed_at);

-- -- LEAVE_ENCASHMENT_REQUESTS indexes
-- CREATE INDEX idx_leave_encashment_requests_employee_id ON leave_encashment_requests(employee_id);
-- CREATE INDEX idx_leave_encashment_requests_request_date ON leave_encashment_requests(request_date);
-- CREATE INDEX idx_leave_encashment_requests_status ON leave_encashment_requests(status);

-- -- LEAVE_TYPES indexes
-- CREATE INDEX idx_leave_types_is_active ON leave_types(is_active);


-- -- PAYROLL_CYCLES indexes
-- CREATE INDEX idx_payroll_cycles_start_date ON payroll_cycles(start_date);
-- CREATE INDEX idx_payroll_cycles_end_date ON payroll_cycles(end_date);
-- CREATE INDEX idx_payroll_cycles_status ON payroll_cycles(status);
-- CREATE INDEX idx_cycle_dates ON payroll_cycles(start_date, end_date);

-- -- PAYSLIPS indexes
-- CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
-- CREATE INDEX idx_payslips_cycle_id ON payslips(cycle_id);
-- CREATE INDEX idx_payslips_payment_date ON payslips(payment_date);
-- CREATE INDEX idx_payslip_emp_cycle ON payslips(employee_id, cycle_id);

-- -- PAYSLIP_DETAILS indexes
-- CREATE INDEX idx_payslip_details_payslip_id ON payslip_details(payslip_id);
-- CREATE INDEX idx_payslip_details_component_type ON payslip_details(component_type);

-- -- PAYSLIP_PROCESSED_ITEMS indexes
-- CREATE INDEX idx_payslip_processed_items_payslip_id ON payslip_processed_items(payslip_id);
-- CREATE INDEX idx_payslip_processed_items_item_type ON payslip_processed_items(item_type);

-- -- PAYROLL_COMPONENTS indexes
-- CREATE INDEX idx_payroll_components_is_active ON payroll_components(is_active);
-- CREATE INDEX idx_payroll_components_component_type ON payroll_components(component_type);

-- -- PAYROLL_GROUPS indexes
-- CREATE INDEX idx_payroll_groups_is_active ON payroll_groups(is_active);

-- -- PAYROLL_CYCLE_GROUPS indexes
-- CREATE INDEX idx_payroll_cycle_groups_payroll_cycle_id ON payroll_cycle_groups(payroll_cycle_id);
-- CREATE INDEX idx_payroll_cycle_groups_payroll_group_id ON payroll_cycle_groups(payroll_group_id);

-- -- PAYROLL_GROUP_COMPONENTS indexes
-- CREATE INDEX idx_payroll_group_components_payroll_group_id ON payroll_group_components(payroll_group_id);
-- CREATE INDEX idx_payroll_group_components_payroll_component_id ON payroll_group_components(payroll_component_id);

-- -- PAYROLL_AUDIT_FLAGS indexes
-- CREATE INDEX idx_payroll_audit_flags_cycle_id ON payroll_audit_flags(cycle_id);
-- CREATE INDEX idx_payroll_audit_flags_is_resolved ON payroll_audit_flags(is_resolved);
-- CREATE INDEX idx_payroll_audit_flags_created_at ON payroll_audit_flags(created_at);


-- -- EMPLOYEE_SALARY_STRUCTURE indexes
-- CREATE INDEX idx_employee_salary_structure_employee_id ON employee_salary_structure(employee_id);
-- CREATE INDEX idx_employee_salary_structure_effective_from ON employee_salary_structure(effective_from);
-- CREATE INDEX idx_employee_salary_structure_is_active ON employee_salary_structure(is_active);
-- CREATE INDEX idx_salary_struct_emp_active ON employee_salary_structure(employee_id, is_active);

-- -- EMPLOYEE_SALARY_REVISIONS indexes
-- CREATE INDEX idx_employee_salary_revisions_employee_id ON employee_salary_revisions(employee_id);
-- CREATE INDEX idx_employee_salary_revisions_revision_date ON employee_salary_revisions(revision_date);
-- CREATE INDEX idx_employee_salary_revisions_status ON employee_salary_revisions(status);

-- -- EMPLOYEE_SALARY_STRUCTURE_AUDIT indexes
-- CREATE INDEX idx_employee_salary_structure_audit_changed_at ON employee_salary_structure_audit(changed_at);


-- -- LOAN_APPLICATIONS indexes
-- CREATE INDEX idx_loan_applications_employee_id ON loan_applications(employee_id);
-- CREATE INDEX idx_loan_applications_application_date ON loan_applications(application_date);
-- CREATE INDEX idx_loan_applications_status ON loan_applications(status);
-- CREATE INDEX idx_loan_applications_approval_date ON loan_applications(approval_date);
-- CREATE INDEX idx_loan_applications_is_deduction_synced ON loan_applications(is_deduction_synced);
-- CREATE INDEX idx_loan_emp_status ON loan_applications(employee_id, status);

-- -- LOAN_REPAYMENTS indexes
-- CREATE INDEX idx_loan_repayments_loan_id ON loan_repayments(loan_id);
-- CREATE INDEX idx_loan_repayments_repayment_date ON loan_repayments(repayment_date);

-- -- LOAN_AMORTIZATION_SCHEDULE indexes
-- CREATE INDEX idx_loan_amortization_schedule_loan_id ON loan_amortization_schedule(loan_id);
-- CREATE INDEX idx_loan_amortization_schedule_due_date ON loan_amortization_schedule(due_date);

-- -- LOAN_TYPES indexes
-- CREATE INDEX idx_loan_types_is_active ON loan_types(is_active);


-- -- EXPENSE_CLAIMS indexes
-- CREATE INDEX idx_expense_claims_employee_id ON expense_claims(employee_id);
-- CREATE INDEX idx_expense_claims_claim_date ON expense_claims(claim_date);
-- CREATE INDEX idx_expense_claims_status ON expense_claims(status);
-- CREATE INDEX idx_expense_claims_approval_date ON expense_claims(approval_date);
-- CREATE INDEX idx_expense_claims_is_deduction_synced ON expense_claims(is_deduction_synced);

-- -- EXPENSE_RECEIPTS indexes
-- CREATE INDEX idx_expense_receipts_expense_claim_id ON expense_receipts(expense_claim_id);

-- -- EXPENSE_CATEGORIES indexes
-- CREATE INDEX idx_expense_categories_is_active ON expense_categories(is_active);

-- -- EXPENSE_ON_EMPLOYEE indexes
-- CREATE INDEX idx_expense_on_employee_expense_claim_id ON expense_on_employee(expense_claim_id);
-- CREATE INDEX idx_expense_on_employee_employee_id ON expense_on_employee(employee_id);


-- -- EMPLOYEE_OVERTIME_RECORDS indexes
-- CREATE INDEX idx_employee_overtime_records_employee_id ON employee_overtime_records(employee_id);
-- CREATE INDEX idx_employee_overtime_records_overtime_date ON employee_overtime_records(overtime_date);
-- CREATE INDEX idx_employee_overtime_records_status ON employee_overtime_records(status);
-- CREATE INDEX idx_employee_overtime_records_approval_date ON employee_overtime_records(approval_date);
-- CREATE INDEX idx_ot_emp_date ON employee_overtime_records(employee_id, overtime_date);

-- -- EMPLOYEE_OVERTIME_AUDIT_LOG indexes
-- CREATE INDEX idx_employee_overtime_audit_log_changed_at ON employee_overtime_audit_log(changed_at);


-- -- HR_CASES indexes
-- CREATE INDEX idx_hr_cases_reported_by ON hr_cases(reported_by);
-- CREATE INDEX idx_hr_cases_reported_date ON hr_cases(reported_date);
-- CREATE INDEX idx_hr_cases_status ON hr_cases(status);
-- CREATE INDEX idx_hr_cases_priority ON hr_cases(priority);
-- CREATE INDEX idx_hr_cases_assigned_to ON hr_cases(assigned_to);

-- -- CASE_COMMENTS indexes
-- CREATE INDEX idx_case_comments_case_id ON case_comments(case_id);
-- CREATE INDEX idx_case_comments_commented_at ON case_comments(commented_at);

-- -- CASE_ATTACHMENTS indexes
-- CREATE INDEX idx_case_attachments_case_id ON case_attachments(case_id);

-- -- CASE_CATEGORIES indexes
-- CREATE INDEX idx_case_categories_is_active ON case_categories(is_active);


-- -- PERFORMANCE_REVIEW_CYCLES indexes
-- CREATE INDEX idx_performance_review_cycles_start_date ON performance_review_cycles(start_date);
-- CREATE INDEX idx_performance_review_cycles_end_date ON performance_review_cycles(end_date);
-- CREATE INDEX idx_performance_review_cycles_status ON performance_review_cycles(status);

-- -- PERFORMANCE_APPRAISALS indexes
-- CREATE INDEX idx_performance_appraisals_employee_id ON performance_appraisals(employee_id);
-- CREATE INDEX idx_performance_appraisals_review_cycle_id ON performance_appraisals(review_cycle_id);
-- CREATE INDEX idx_performance_appraisals_review_date ON performance_appraisals(review_date);

-- -- EMPLOYEE_GOALS indexes
-- CREATE INDEX idx_employee_goals_employee_id ON employee_goals(employee_id);
-- CREATE INDEX idx_employee_goals_due_date ON employee_goals(due_date);
-- CREATE INDEX idx_employee_goals_status ON employee_goals(status);

-- -- EMPLOYEE_KPIS indexes
-- CREATE INDEX idx_employee_kpis_employee_id ON employee_kpis(employee_id);
-- CREATE INDEX idx_employee_kpis_kpi_id ON employee_kpis(kpi_id);
-- CREATE INDEX idx_employee_kpis_review_cycle_id ON employee_kpis(review_cycle_id);

-- -- KPI_LIBRARY indexes
-- CREATE INDEX idx_kpi_library_is_active ON kpi_library(is_active);


-- -- APPLICANTS indexes
-- CREATE INDEX idx_applicants_email ON applicants(email);
-- CREATE INDEX idx_applicants_application_date ON applicants(application_date);
-- CREATE INDEX idx_applicants_status ON applicants(status);
-- CREATE INDEX idx_applicants_opening_id ON applicants(opening_id);

-- -- SKILLS indexes
-- CREATE INDEX idx_skills_is_active ON skills(is_active);

-- -- EMPLOYEE_SKILL_MATRIX indexes
-- CREATE INDEX idx_employee_skill_matrix_employee_id ON employee_skill_matrix(employee_id);
-- CREATE INDEX idx_employee_skill_matrix_skill_id ON employee_skill_matrix(skill_id);

-- -- JOBS indexes
-- CREATE INDEX idx_jobs_is_active ON jobs(is_active);

-- -- JOB_OPENINGS indexes
-- CREATE INDEX idx_job_openings_opening_date ON job_openings(opening_date);
-- CREATE INDEX idx_job_openings_status ON job_openings(status);

-- -- JOB_OPENING_SKILLS indexes
-- CREATE INDEX idx_job_opening_skills_job_opening_id ON job_opening_skills(job_opening_id);
-- CREATE INDEX idx_job_opening_skills_skill_id ON job_opening_skills(skill_id);


-- -- BANK_DETAILS indexes
-- CREATE INDEX idx_bank_details_user_id ON bank_details(user_id);

-- -- UPLOADED_DOCUMENT indexes
-- CREATE INDEX idx_uploaded_document_user_id ON uploaded_document(user_id);
-- CREATE INDEX idx_uploaded_document_upload_date ON uploaded_document(upload_date);
-- CREATE INDEX idx_uploaded_document_document_type ON uploaded_document(document_type);

-- -- SHIFTS indexes
-- CREATE INDEX idx_shifts_is_active ON shifts(is_active);

-- -- SHIFT_ROTATIONS indexes
-- CREATE INDEX idx_shift_rotations_employee_id ON shift_rotations(employee_id);
-- CREATE INDEX idx_shift_rotations_start_date ON shift_rotations(start_date);
-- CREATE INDEX idx_shift_rotations_end_date ON shift_rotations(end_date);
-- CREATE INDEX idx_shift_rotations_status ON shift_rotations(status);

-- -- SHIFT_ROTATION_DETAILS indexes
-- CREATE INDEX idx_shift_rotation_details_rotation_id ON shift_rotation_details(rotation_id);
-- CREATE INDEX idx_shift_rotation_details_effective_date ON shift_rotation_details(effective_date);

-- -- SHIFT_ROTATION_AUDIT indexes
-- CREATE INDEX idx_shift_rotation_audit_changed_at ON shift_rotation_audit(changed_at);

-- -- HOLIDAYS indexes
-- CREATE INDEX idx_holidays_holiday_date ON holidays(holiday_date);

-- -- FINAL_SETTLEMENTS indexes
-- CREATE INDEX idx_final_settlements_employee_id ON final_settlements(employee_id);
-- CREATE INDEX idx_final_settlements_last_working_day ON final_settlements(last_working_day);
-- CREATE INDEX idx_final_settlements_settlement_date ON final_settlements(settlement_date);
-- CREATE INDEX idx_final_settlements_status ON final_settlements(status);

-- -- ROLES indexes
-- CREATE INDEX idx_roles_is_active ON roles(is_active);

-- -- PERMISSIONS indexes
-- CREATE INDEX idx_permissions_is_active ON permissions(is_active);

-- -- ROLE_PERMISSIONS indexes
-- CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
-- CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
-- CREATE INDEX idx_role_permissions_is_active ON role_permissions(is_active);

-- -- USER_AUDIT indexes
-- CREATE INDEX idx_user_audit_user_id ON user_audit(user_id);
-- CREATE INDEX idx_user_audit_changed_at ON user_audit(changed_at);


