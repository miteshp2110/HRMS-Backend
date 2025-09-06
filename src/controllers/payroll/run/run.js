const { pool } = require('../../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Admin] Initiates the payroll run for a given date range.
 * This is a single transaction: all payslips are created, or none are.
 */
const initiatePayrollRun = async (req, res) => {
    const { from_date, to_date } = req.body;
    const initiatorId = req.user.id;

    if (!from_date || !to_date) {
        return res.status(400).json({ message: 'from_date and to_date are required.' });
    }

    const payPeriodStart = DateTime.fromISO(from_date).toISODate();
    const payPeriodEnd = DateTime.fromISO(to_date).toISODate();
    const daysInMonth = DateTime.fromISO(to_date).daysInMonth;

    let connection;
    try {
        connection = await pool.getConnection();

        // Check for existing payroll runs to prevent duplicates
    
        const overlapCheckSql = `
            SELECT id, pay_period_start, pay_period_end 
            FROM payrolls 
            WHERE pay_period_start <= ? AND pay_period_end >= ? 
            LIMIT 1
        `;
        const [existingRun] = await connection.query(overlapCheckSql, [payPeriodEnd, payPeriodStart]);

        if (existingRun.length > 0) {
            const existing = existingRun[0];
            return res.status(409).json({ 
                message: `The requested date range overlaps with an existing payroll run (ID: ${existing.id}) that covers the period from ${existing.pay_period_start} to ${existing.pay_period_end}.`
            });
        }
        
        // The entire process is now wrapped in a single transaction
        await connection.beginTransaction();

        const payrollSql = `
            INSERT INTO payrolls (pay_period_start, pay_period_end, total_net_pay, initiated_by, status) 
            VALUES (?, ?, 0, ?, 'processing')
        `;
        const [payrollResult] = await connection.query(payrollSql, [payPeriodStart, payPeriodEnd, initiatorId]);
        const payrollId = payrollResult.insertId;
        
        const [employees] = await connection.query(
            "SELECT id FROM user WHERE is_active = TRUE AND is_payroll_exempt = FALSE"
        );
        if (employees.length === 0) {
            await connection.rollback();
            return res.status(200).json({ message: 'No active employees to run payroll for.' });
        }
        
        let totalNetPayForRun = 0;

        // The loop is now inside the main try/catch. If any employee fails, the catch block will trigger a rollback.
        for (const employee of employees) {
            const employeeId = employee.id;
            
            // --- A. Fetch Salary Structure & Calculate Base Earnings ---
            const structureSql = `
                SELECT pc.name, pc.type, ess.value_type, ess.value, base_pc.name AS based_on_component_name
                FROM employee_salary_structure ess JOIN payroll_components pc ON ess.component_id = pc.id
                LEFT JOIN payroll_components base_pc ON ess.based_on_component_id = base_pc.id
                WHERE ess.employee_id = ?`;
            const [structure] = await connection.query(structureSql, [employeeId]);
            if (structure.length === 0) throw new Error(`Salary structure not found for employee ID ${employeeId}.`);
            
            const calculatedComponents = new Map();
            const fixedValues = new Map();
            structure.forEach(c => {
                if (c.value_type === 'fixed') {
                    const amount = parseFloat(c.value);
                    calculatedComponents.set(c.name, { type: c.type, amount });
                    fixedValues.set(c.name, amount);
                }
            });
            structure.forEach(c => {
                if (c.value_type === 'percentage') {
                    const baseValue = fixedValues.get(c.based_on_component_name) || 0;
                    const amount = parseFloat(((baseValue * parseFloat(c.value)) / 100).toFixed(2));
                    calculatedComponents.set(c.name, { type: c.type, amount });
                }
            });

            // --- B. Fetch Shift, Attendance & Calculate LOP / Overtime ---
            const [[userShift]] = await connection.query(
                `SELECT s.from_time, s.to_time FROM user u JOIN shifts s ON u.shift = s.id WHERE u.id = ?`,
                [employeeId]
            );
            if (!userShift) throw new Error(`Shift details not found for employee ID ${employeeId}.`);
            
            const shiftStart = DateTime.fromSQL(userShift.from_time);
            let shiftEnd = DateTime.fromSQL(userShift.to_time);
            if (shiftEnd < shiftStart) shiftEnd = shiftEnd.plus({ days: 1 });
            const shiftDurationInHours = shiftEnd.diff(shiftStart, 'hours').toObject().hours;
            if (shiftDurationInHours <= 0) throw new Error(`Invalid shift duration for employee ID ${employeeId}.`);
            
            const basicSalary = fixedValues.get('Base Salary') || 0;
            const hourlyPay = (basicSalary / daysInMonth) / shiftDurationInHours;

            const attendanceSql = `SELECT pay_type, hours_worked FROM attendance_record WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?`;
            const [attendanceRecords] = await connection.query(attendanceSql, [employeeId, payPeriodStart, payPeriodEnd]);
            
            let lopAmount = 0;
            let overtimeAmount = 0;

            attendanceRecords.forEach(rec => {
                if (rec.pay_type === 'unpaid') lopAmount += hourlyPay * shiftDurationInHours;
                if (rec.pay_type === 'half_day') lopAmount += hourlyPay * (shiftDurationInHours / 2);
                if (rec.pay_type === 'overtime') {
                    const overtimeHours = parseFloat(rec.hours_worked) - shiftDurationInHours;
                    if (overtimeHours > 0) {
                        overtimeAmount += overtimeHours * hourlyPay * 1.5;
                    }
                }
            });
            
            if (lopAmount > 0) calculatedComponents.set('Loss of Pay', { type: 'deduction', amount: parseFloat(lopAmount.toFixed(2)) });
            if (overtimeAmount > 0) calculatedComponents.set('Overtime Pay', { type: 'earning', amount: parseFloat(overtimeAmount.toFixed(2)) });
            
            // --- C. Fetch and Add Loan Deductions ---
            const loanSql = `SELECT id, emi_amount FROM employee_loans WHERE employee_id = ? AND status = 'active'`;
            const [activeLoans] = await connection.query(loanSql, [employeeId]);
            activeLoans.forEach(loan => {
                calculatedComponents.set(`Loan Repayment (ID: ${loan.id})`, { type: 'deduction', amount: parseFloat(loan.emi_amount) });
            });
            
            // --- D. Final Calculation & Payslip Creation ---
            let gross_earnings = 0, total_deductions = 0;
            calculatedComponents.forEach(comp => {
                if (comp.type === 'earning') gross_earnings += comp.amount;
                if (comp.type === 'deduction') total_deductions += comp.amount;
            });
            const net_pay = gross_earnings - total_deductions;
            totalNetPayForRun += net_pay;

            const payslipSql = `INSERT INTO payslips (payroll_id, employee_id, pay_period_start, pay_period_end, gross_earnings, total_deductions, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            const [payslipResult] = await connection.query(payslipSql, [payrollId, employeeId, payPeriodStart, payPeriodEnd, gross_earnings, total_deductions, net_pay]);
            const payslipId = payslipResult.insertId;

            for (const [name, comp] of calculatedComponents.entries()) {
                await connection.query(`INSERT INTO payslip_details (payslip_id, component_name, component_type, amount) VALUES (?, ?, ?, ?)`, [payslipId, name, comp.type, comp.amount]);
            }
        }

        await connection.query('UPDATE payrolls SET total_net_pay = ? WHERE id = ?', [totalNetPayForRun, payrollId]);
        
        await connection.commit(); // Commit everything only if the entire loop succeeds

        res.status(201).json({ 
            success: true, 
            message: 'Payroll run initiated successfully for all employees.', 
            payrollId,
        });

    } catch (error) {
        if (connection) await connection.rollback(); // If any error occurs, undo everything
        console.error('Error initiating payroll run:', error);
        res.status(500).json({ 
            message: 'A critical error occurred. The payroll run has been cancelled and all changes have been rolled back.',
            error: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Finalizes a payroll run, marking it as 'paid',
 * creating repayment records, and updating loan statuses.
 */
const finalizePayrollRun = async (req, res) => {
    const { payrollId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const payrollSql = "UPDATE payrolls SET status = 'paid', finalized_at = NOW() WHERE id = ? AND status = 'processing'";
        const [payrollResult] = await connection.query(payrollSql, [payrollId]);
        if (payrollResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payroll run not found or already finalized.' });
        }

        // Find all loan EMIs that were deducted in this payroll run
        const loanDetailsSql = `
            SELECT 
                pd.amount, 
                el.id as loan_id,
                p.id as payslip_id
            FROM payslip_details pd
            JOIN payslips p ON pd.payslip_id = p.id
            JOIN employee_loans el ON p.employee_id = el.employee_id AND pd.component_name LIKE CONCAT('Loan Repayment (ID: ', el.id, ')')
            WHERE p.payroll_id = ? AND el.status IN ('active', 'paid_off')
        `;
        const [repayments] = await connection.query(loanDetailsSql, [payrollId]);

        for (const repayment of repayments) {
            // --- NEW: Add a record to the loan_repayments ledger ---
            const repaymentSql = `
                INSERT INTO loan_repayments (loan_id, payslip_id, repayment_amount, repayment_date)
                VALUES (?, ?, ?, CURDATE())
            `;
            await connection.query(repaymentSql, [
                repayment.loan_id,
                repayment.payslip_id,
                repayment.amount
            ]);

            // --- Update the main loan record ---
            const updateLoanSql = `
                UPDATE employee_loans 
                SET remaining_installments = remaining_installments - 1 
                WHERE id = ?`;
            await connection.query(updateLoanSql, [repayment.loan_id]);

            const [[loan]] = await connection.query('SELECT remaining_installments FROM employee_loans WHERE id = ?', [repayment.loan_id]);
            if (loan && loan.remaining_installments <= 0) {
                await connection.query("UPDATE employee_loans SET status = 'paid_off' WHERE id = ?", [repayment.loan_id]);
            }
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Payroll has been finalized and loan repayments have been logged.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error finalizing payroll:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { initiatePayrollRun, finalizePayrollRun };