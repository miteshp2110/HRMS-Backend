const { pool } = require('../../../db/connector');
const ExcelJS = require('exceljs');
const { DateTime } = require('luxon');

/**
 * @description [Admin] Generates a detailed, multi-sheet Excel report for a specific payroll run.
 */
const generatePayrollReport = async (req, res) => {
    const { payrollId } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Fetch all comprehensive data for this payroll run in a single, powerful query
        const sql = `
            SELECT 
                p.pay_period_start, p.pay_period_end,
                ps.id as payslip_id, ps.gross_earnings, ps.total_deductions, ps.net_pay,
                u.id as employee_id, u.first_name, u.last_name, u.email, u.phone,
                bd.bank_name, bd.bank_account, bd.bank_ifsc,
                pd.component_name, pd.component_type, pd.amount
            FROM payrolls p
            JOIN payslips ps ON p.id = ps.payroll_id
            JOIN user u ON ps.employee_id = u.id
            LEFT JOIN bank_details bd ON u.id = bd.user_id
            JOIN payslip_details pd ON ps.id = pd.payslip_id
            WHERE p.id = ?
            ORDER BY u.first_name, u.last_name, pd.component_type, pd.component_name;
        `;
        const [results] = await connection.query(sql, [payrollId]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'Payroll run not found or has no payslips.' });
        }

        // 2. Process the flat SQL data into a structured format
        const payrollData = new Map();
        results.forEach(row => {
            if (!payrollData.has(row.employee_id)) {
                payrollData.set(row.employee_id, {
                    employee: {
                        id: row.employee_id,
                        name: `${row.first_name} ${row.last_name}`,
                        email: row.email,
                        phone: row.phone,
                    },
                    bank: {
                        name: row.bank_name,
                        account: row.bank_account,
                        ifsc: row.bank_ifsc,
                    },
                    payslip: {
                        gross_earnings: row.gross_earnings,
                        total_deductions: row.total_deductions,
                        net_pay: row.net_pay,
                    },
                    details: []
                });
            }
            payrollData.get(row.employee_id).details.push({
                name: row.component_name,
                type: row.component_type,
                amount: row.amount,
            });
        });

        // 3. Generate the Excel Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HRMS Pro';
        workbook.created = new Date();
        const payPeriod = `${DateTime.fromJSDate(results[0].pay_period_start).toFormat('MMM yyyy')}`;

        // --- Sheet 1: Bank Transfer Summary ---
        const bankSheet = workbook.addWorksheet('Bank Transfer Summary');
        bankSheet.columns = [
            { header: 'Employee ID', key: 'id', width: 15 },
            { header: 'Employee Name', key: 'name', width: 30 },
            { header: 'Bank Name', key: 'bank_name', width: 25 },
            { header: 'Account Number', key: 'account', width: 25 },
            { header: 'IFSC Code', key: 'ifsc', width: 20 },
            { header: 'Amount to be Paid (Net Pay)', key: 'net_pay', width: 30, style: { numFmt: '#,##0.00' } },
        ];
        bankSheet.getRow(1).font = { bold: true };

        // --- Sheet 2: Detailed Payroll Breakdown ---
        const detailSheet = workbook.addWorksheet('Detailed Payroll Breakdown');
        detailSheet.columns = [
            { header: 'Employee ID', key: 'id', width: 15 },
            { header: 'Employee Name', key: 'name', width: 30 },
            { header: 'Component Name', key: 'component_name', width: 35 },
            { header: 'Component Type', key: 'type', width: 20 },
            { header: 'Amount', key: 'amount', width: 20, style: { numFmt: '#,##0.00' } },
        ];
        detailSheet.getRow(1).font = { bold: true };

        // Populate the sheets with data
        for (const [employeeId, data] of payrollData.entries()) {
            bankSheet.addRow({
                id: data.employee.id,
                name: data.employee.name,
                bank_name: data.bank.name,
                account: data.bank.account,
                ifsc: data.bank.ifsc,
                net_pay: data.payslip.net_pay,
            });

            data.details.forEach(detail => {
                detailSheet.addRow({
                    id: data.employee.id,
                    name: data.employee.name,
                    component_name: detail.name,
                    type: detail.type,
                    amount: detail.amount,
                });
            });
        }
        
        // Add auto-filter to the detailed sheet for easy sorting by employee
        detailSheet.autoFilter = `A1:E${detailSheet.rowCount}`;

        // 4. Set headers and send the file to the client
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="Payroll_Report_${payPeriod}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating payroll report:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { generatePayrollReport };