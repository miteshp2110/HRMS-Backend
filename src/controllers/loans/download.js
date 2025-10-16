const { pool } = require('../../db/connector');
const PDFDocument = require('pdfkit-table'); // Use the correct pdfkit-table library
const { DateTime } = require('luxon');

/**
 * @description Generates a detailed PDF document for a single loan application.
 */
const downloadLoanApplicationPDF = async (req, res) => {
    const { applicationId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();

        // 1. Fetch all loan application data in one comprehensive query
        const sql = `
            SELECT
                la.*,
                lt.name as loan_type_name, lt.is_advance, lt.interest_rate as default_interest_rate,
                lt.max_tenure_months,
                e.first_name, e.last_name, e.joining_date,
                CONCAT(ns_user.prefix, LPAD(e.id, ns_user.padding_length, '0')) as full_employee_id,
                j.title as job_title,
                CONCAT(ma.first_name, ' ', ma.last_name) as manager_approver_name,
                CONCAT(ha.first_name, ' ', ha.last_name) as hr_approver_name,
                (SELECT SUM(balance) FROM employee_leave_balance WHERE employee_id = e.id) as total_leave_balance,
                (SELECT value FROM employee_salary_structure WHERE employee_id = e.id AND component_id = 1) as basic_salary,
                (SELECT SUM(ess.value) FROM employee_salary_structure ess JOIN payroll_components pc ON ess.component_id = pc.id WHERE ess.employee_id = e.id AND pc.type = 'earning' AND ess.calculation_type = 'Fixed') as gross_salary
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
            LEFT JOIN jobs j ON e.job_role = j.id
            LEFT JOIN name_series ns_user ON ns_user.table_name = 'user'
            LEFT JOIN user ma ON la.manager_approver_id = ma.id
            LEFT JOIN user ha ON la.hr_approver_id = ha.id
            WHERE la.id = ?;
        `;
        const [[application]] = await connection.query(sql, [applicationId]);

        if (!application) {
            return res.status(404).json({ message: 'Loan application not found.' });
        }

        // 2. Fetch schedule and repayments
        const [schedule] = await connection.query('SELECT * FROM loan_amortization_schedule WHERE loan_application_id = ? ORDER BY due_date ASC', [applicationId]);
        const [repayments] = await connection.query('SELECT * FROM loan_repayments WHERE loan_application_id = ? ORDER BY repayment_date ASC', [applicationId]);

        // --- 3. PDF Generation ---
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Loan_Application_${application.application_id_text}.pdf"`);
        doc.pipe(res);

        // --- PDF Header ---
        doc.fontSize(20).font('Helvetica-Bold').text('Loan / Advance Application', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Application ID: ${application.application_id_text}`, { align: 'center' });
        doc.moveDown(2);

        // --- Section 1: Employee & Loan Details ---
        const estimatedEMI = generateEstimatedSchedule(application, true);
        doc.fontSize(14).font('Helvetica-Bold').text('Applicant & Loan Summary', { underline: true });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold')
           .text('Employee Name:', { continued: true }).font('Helvetica').text(` ${application.first_name} ${application.last_name}`)
           .font('Helvetica-Bold').text('Employee ID:', { continued: true }).font('Helvetica').text(` ${application.full_employee_id}`)
           .font('Helvetica-Bold').text('Job Title:', { continued: true }).font('Helvetica').text(` ${application.job_title || 'N/A'}`)
           .font('Helvetica-Bold').text('Loan Type:', { continued: true }).font('Helvetica').text(` ${application.loan_type_name}`)
           .font('Helvetica-Bold').text('Requested Amount:', { continued: true }).font('Helvetica').text(` ${application.requested_amount}`)
           .font('Helvetica-Bold').text('Approved Amount:', { continued: true }).font('Helvetica').text(` ${application.approved_amount || 'Pending'}`)
           .font('Helvetica-Bold').text('Tenure:', { continued: true }).font('Helvetica').text(` ${application.tenure_months} months`)
           .font('Helvetica-Bold').text('Interest Rate:', { continued: true }).font('Helvetica').text(` ${application.interest_rate || application.default_interest_rate}%`)
           .font('Helvetica-Bold').text('EMI Amount:', { continued: true }).font('Helvetica').text(` ${application.emi_amount ? `AED ${application.emi_amount}` : `(Est.) AED ${estimatedEMI}`}`);
        doc.moveDown();

        // --- Section 2: Eligibility Calculation ---
        const yearsOfService = DateTime.now().diff(DateTime.fromJSDate(application.joining_date), 'years').years;
        const dailyGrossSalary = (application.gross_salary * 12) / 365;
        const leaveLiability = (application.total_leave_balance || 0) * dailyGrossSalary;
        const gratuity = (application.basic_salary * 15 / 26) * yearsOfService;
        const eligibleBase = leaveLiability + gratuity;
        
        doc.fontSize(14).font('Helvetica-Bold').text('Eligibility Details (at time of application)', { underline: true });
        doc.moveDown();
        doc.fontSize(10).text(`Leave Encashment Liability: AED ${leaveLiability.toFixed(2)}`);
        doc.text(`Gratuity Accrued: AED ${gratuity.toFixed(2)}`);
        doc.font('Helvetica-Bold').text(`Total Eligible Base Amount: AED ${eligibleBase.toFixed(2)}`);
        doc.moveDown();

        // --- Section 3: Approval & Disbursement Status ---
        doc.fontSize(14).font('Helvetica-Bold').text('Application Status', { underline: true });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold').text('Status:', { continued: true }).font('Helvetica').text(` ${application.status}`);
        doc.font('Helvetica-Bold').text('Manager Approval:', { continued: true }).font('Helvetica').text(` ${application.manager_approver_name || 'Pending'}`);
        doc.font('Helvetica-Bold').text('HR Approval:', { continued: true }).font('Helvetica').text(` ${application.hr_approver_name || 'Pending'}`);
        if(application.rejection_reason) doc.font('Helvetica-Bold').text('Rejection Reason:', { continued: true }).font('Helvetica').text(` ${application.rejection_reason}`);
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Disbursement Date:', { continued: true }).font('Helvetica').text(` ${application.disbursement_date ? DateTime.fromJSDate(application.disbursement_date).toFormat('dd LLLL yyyy') : 'Not Disbursed'}`);
        doc.font('Helvetica-Bold').text('Journal Voucher (JV) No:', { continued: true }).font('Helvetica').text(` ${application.jv_number || 'N/A'}`);
        doc.moveDown(2);

        // --- Section 4: Amortization Schedule ---
        const scheduleToDisplay = schedule.length > 0 ? schedule : generateEstimatedSchedule(application);
        if (scheduleToDisplay.length > 0) {
            const table = {
                title: schedule.length > 0 ? 'Amortization Schedule' : 'Estimated Amortization Schedule',
                headers: ['#', 'Due Date', 'EMI Amount', 'Principal', 'Interest', 'Status'],
                rows: scheduleToDisplay.map((emi, index) => [
                    index + 1,
                    // ** BUG FIX: Correctly handle date object from DB vs string from helper **
                    DateTime.fromJSDate(emi.due_date).toFormat('dd-MM-yyyy'),
                    parseFloat(emi.emi_amount).toFixed(2),
                    parseFloat(emi.principal_component).toFixed(2),
                    parseFloat(emi.interest_component).toFixed(2),
                    emi.status || 'Pending'
                ])
            };
            await doc.table(table, { width: 500 });
        }
        
        // --- Section 5: Repayment History ---
        doc.addPage();
        doc.fontSize(14).font('Helvetica-Bold').text('Repayment History', { underline: true });
        doc.moveDown();
        if (repayments.length > 0) {
            const repaymentTable = {
                title: 'Repayments Made',
                headers: ['Repayment Date', 'Amount Paid', 'Transaction ID'],
                rows: repayments.map(r => [DateTime.fromJSDate(r.repayment_date).toFormat('dd-MM-yyyy'), parseFloat(r.repayment_amount).toFixed(2), r.transaction_id || 'Payroll'])
            };
            await doc.table(repaymentTable, { width: 500 });
        } else {
            doc.font('Helvetica').text('No repayments have been made yet.');
        }
        
        // --- Finalize PDF ---
        doc.end();

    } catch (error) {
        console.error('Error generating loan application PDF:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

// Helper function to generate an estimated schedule if the loan is not yet disbursed
function generateEstimatedSchedule(application, getEmiOnly = false) {
    const amount = application.approved_amount || application.requested_amount;
    if (!amount) return getEmiOnly ? 0 : [];

    const { tenure_months } = application;
    const interest_rate = application.interest_rate || application.default_interest_rate;
    const monthlyInterestRate = (parseFloat(interest_rate) || 0) / 12 / 100;

    const emi = monthlyInterestRate > 0 ?
        (amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenure_months)) / (Math.pow(1 + monthlyInterestRate, tenure_months) - 1) :
        amount / tenure_months;

    if (getEmiOnly) {
        return emi.toFixed(2);
    }

    let balance = amount;
    const schedule = [];
    for (let i = 1; i <= tenure_months; i++) {
        const interestComponent = balance * monthlyInterestRate;
        const principalComponent = emi - interestComponent;
        balance -= principalComponent;
        // ** BUG FIX: Return a JS Date object for consistency **
        const dueDate = DateTime.now().plus({ months: i }).toJSDate();
        schedule.push({ due_date: dueDate, emi_amount: emi, principal_component: principalComponent, interest_component: interestComponent });
    }
    return schedule;
}

module.exports = {
    downloadLoanApplicationPDF
};