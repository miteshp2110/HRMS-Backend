
const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class LoanReportsController {

    /**
     * Generate loan applications report
     */
    async generateLoanApplicationsReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                loanTypeIds,
                status,
                format = 'pdf'
            } = req.body;

            // Build loan applications query
            let query = `
                SELECT 
                    la.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    lt.name as loan_type_name,
                    lt.max_amount as loan_type_max_amount,
                    lt.max_tenure_months,
                    lt.interest_rate,
                    approver.first_name as approver_first_name,
                    approver.last_name as approver_last_name,
                    processor.first_name as processor_first_name,
                    processor.last_name as processor_last_name
                FROM loan_applications la
                JOIN user u ON la.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN loan_types lt ON la.loan_type_id = lt.id
                LEFT JOIN user approver ON la.approved_by = approver.id
                LEFT JOIN user processor ON la.processed_by = processor.id
                WHERE la.application_date BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND la.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            if (loanTypeIds && loanTypeIds.length > 0) {
                query += ` AND la.loan_type_id IN (${loanTypeIds.map(() => '?').join(',')})`;
                params.push(...loanTypeIds);
            }

            if (status && status.length > 0) {
                query += ` AND la.status IN (${status.map(() => '?').join(',')})`;
                params.push(...status);
            }

            query += ` ORDER BY la.application_date DESC, u.first_name`;

            const [applications] = await db.execute(query, params);

            // Get loan amortization schedules for approved loans
            const approvedLoanIds = applications
                .filter(app => app.status === 'Approved' && app.id)
                .map(app => app.id);

            let schedules = [];
            if (approvedLoanIds.length > 0) {
                const scheduleQuery = `
                    SELECT 
                        las.*,
                        la.application_id
                    FROM loan_amortization_schedule las
                    JOIN loan_applications la ON las.loan_id = la.id
                    WHERE la.id IN (${approvedLoanIds.map(() => '?').join(',')})
                    ORDER BY las.due_date
                `;
                const [schedulesResult] = await db.execute(scheduleQuery, approvedLoanIds);
                schedules = schedulesResult;
            }

            // Calculate summary statistics
            const summary = this.calculateApplicationsSummary(applications, schedules);

            const reportData = {
                applications,
                schedules,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateApplicationsPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Loan applications report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateApplicationsExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Loan applications report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating loan applications report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate loan applications report',
                error: error.message
            });
        }
    }

    /**
     * Generate loan repayments tracking report
     */
    async generateLoanRepaymentsReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                format = 'pdf'
            } = req.body;

            // Build repayments query
            let query = `
                SELECT 
                    lr.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    la.loan_amount as original_loan_amount,
                    la.tenure_months,
                    la.interest_rate,
                    lt.name as loan_type_name,
                    las.principal_amount as scheduled_principal,
                    las.interest_amount as scheduled_interest,
                    las.total_amount as scheduled_total
                FROM loan_repayments lr
                JOIN user u ON lr.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN loan_applications la ON lr.loan_id = la.id
                LEFT JOIN loan_types lt ON la.loan_type_id = lt.id
                LEFT JOIN loan_amortization_schedule las ON lr.schedule_id = las.id
                WHERE lr.repayment_date BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND lr.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            query += ` ORDER BY lr.repayment_date DESC, u.first_name`;

            const [repayments] = await db.execute(query, params);

            // Get outstanding balances for active loans
            const outstandingQuery = `
                SELECT 
                    la.id as loan_id,
                    u.first_name,
                    u.last_name,
                    u.employee_id,
                    la.loan_amount,
                    lt.name as loan_type_name,
                    SUM(lr.principal_amount) as total_paid_principal,
                    (la.loan_amount - COALESCE(SUM(lr.principal_amount), 0)) as outstanding_balance,
                    COUNT(las.id) as total_installments,
                    COUNT(lr.id) as paid_installments,
                    (COUNT(las.id) - COUNT(lr.id)) as remaining_installments
                FROM loan_applications la
                JOIN user u ON la.employee_id = u.id
                JOIN loan_types lt ON la.loan_type_id = lt.id
                LEFT JOIN loan_amortization_schedule las ON la.id = las.loan_id
                LEFT JOIN loan_repayments lr ON las.id = lr.schedule_id
                WHERE la.status = 'Approved' 
                    AND la.is_closed = 0
                GROUP BY la.id, u.first_name, u.last_name, u.employee_id, la.loan_amount, lt.name
                HAVING outstanding_balance > 0
                ORDER BY outstanding_balance DESC
            `;
            const [outstanding] = await db.execute(outstandingQuery, []);

            // Get upcoming due payments
            const upcomingQuery = `
                SELECT 
                    las.*,
                    u.first_name,
                    u.last_name,
                    u.employee_id,
                    la.loan_amount,
                    lt.name as loan_type_name
                FROM loan_amortization_schedule las
                JOIN loan_applications la ON las.loan_id = la.id
                JOIN user u ON la.employee_id = u.id
                JOIN loan_types lt ON la.loan_type_id = lt.id
                LEFT JOIN loan_repayments lr ON las.id = lr.schedule_id
                WHERE las.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    AND lr.id IS NULL
                    AND la.status = 'Approved'
                    AND la.is_closed = 0
                ORDER BY las.due_date ASC, u.first_name
            `;
            const [upcoming] = await db.execute(upcomingQuery, []);

            // Calculate summary statistics
            const summary = this.calculateRepaymentsSummary(repayments, outstanding, upcoming);

            const reportData = {
                repayments,
                outstanding,
                upcoming,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateRepaymentsPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Loan repayments report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateRepaymentsExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Loan repayments report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating loan repayments report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate loan repayments report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateApplicationsSummary(applications, schedules) {
        const summary = {
            totalApplications: applications.length,
            approvedApplications: applications.filter(a => a.status === 'Approved').length,
            pendingApplications: applications.filter(a => a.status === 'Pending').length,
            rejectedApplications: applications.filter(a => a.status === 'Rejected').length,
            totalRequestedAmount: applications.reduce((sum, a) => sum + (parseFloat(a.requested_amount) || 0), 0),
            totalApprovedAmount: applications.reduce((sum, a) => sum + (parseFloat(a.approved_amount) || 0), 0),
            totalDisbursedAmount: applications.reduce((sum, a) => sum + (parseFloat(a.disbursed_amount) || 0), 0),
            uniqueEmployees: new Set(applications.map(a => a.employee_id)).size,
            loanTypes: {}
        };

        // Calculate approval rate
        summary.approvalRate = summary.totalApplications > 0 ? 
            (summary.approvedApplications / summary.totalApplications * 100).toFixed(2) : 0;

        // Group by loan type
        applications.forEach(app => {
            const type = app.loan_type_name;
            if (!summary.loanTypes[type]) {
                summary.loanTypes[type] = {
                    applications: 0,
                    approved: 0,
                    totalRequested: 0,
                    totalApproved: 0
                };
            }
            summary.loanTypes[type].applications++;
            summary.loanTypes[type].totalRequested += parseFloat(app.requested_amount) || 0;
            
            if (app.status === 'Approved') {
                summary.loanTypes[type].approved++;
                summary.loanTypes[type].totalApproved += parseFloat(app.approved_amount) || 0;
            }
        });

        return summary;
    }

    calculateRepaymentsSummary(repayments, outstanding, upcoming) {
        const summary = {
            totalRepayments: repayments.length,
            totalPaidAmount: repayments.reduce((sum, r) => sum + (parseFloat(r.amount_paid) || 0), 0),
            totalPrincipalPaid: repayments.reduce((sum, r) => sum + (parseFloat(r.principal_amount) || 0), 0),
            totalInterestPaid: repayments.reduce((sum, r) => sum + (parseFloat(r.interest_amount) || 0), 0),
            onTimePayments: repayments.filter(r => r.payment_status === 'On Time').length,
            latePayments: repayments.filter(r => r.payment_status === 'Late').length,
            activeLoans: outstanding.length,
            totalOutstanding: outstanding.reduce((sum, o) => sum + (parseFloat(o.outstanding_balance) || 0), 0),
            upcomingPayments: upcoming.length,
            upcomingAmount: upcoming.reduce((sum, u) => sum + (parseFloat(u.total_amount) || 0), 0),
            uniqueEmployees: new Set(repayments.map(r => r.employee_id)).size
        };

        // Calculate payment punctuality rate
        summary.punctualityRate = summary.totalRepayments > 0 ? 
            (summary.onTimePayments / summary.totalRepayments * 100).toFixed(2) : 0;

        return summary;
    }

    async generateApplicationsPDF(reportData) {
        const { applications, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `loan_applications_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('LOAN APPLICATIONS REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Applications Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Applications: ${summary.totalApplications}`);
        doc.text(`Approved: ${summary.approvedApplications} | Pending: ${summary.pendingApplications} | Rejected: ${summary.rejectedApplications}`);
        doc.text(`Approval Rate: ${summary.approvalRate}%`);
        doc.text(`Total Requested Amount: $${summary.totalRequestedAmount.toFixed(2)}`);
        doc.text(`Total Approved Amount: $${summary.totalApprovedAmount.toFixed(2)}`);
        doc.text(`Total Disbursed Amount: $${summary.totalDisbursedAmount.toFixed(2)}`);
        doc.text(`Unique Employees: ${summary.uniqueEmployees}`);
        doc.moveDown();

        // Loan Type Breakdown
        doc.fontSize(14).text('Loan Type Breakdown', { underline: true });
        doc.fontSize(8);
        let yPosition = doc.y + 10;

        Object.keys(summary.loanTypes).forEach(loanType => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const typeData = summary.loanTypes[loanType];
            const typeApprovalRate = typeData.applications > 0 ? 
                (typeData.approved / typeData.applications * 100).toFixed(2) : 0;

            doc.text(`${loanType}:`, 50, yPosition);
            yPosition += 12;
            doc.text(`  Applications: ${typeData.applications} | Approved: ${typeData.approved} (${typeApprovalRate}%)`, 70, yPosition);
            yPosition += 12;
            doc.text(`  Requested: $${typeData.totalRequested.toFixed(2)} | Approved: $${typeData.totalApproved.toFixed(2)}`, 70, yPosition);
            yPosition += 20;
        });

        yPosition += 10;

        // Individual Applications
        if (applications.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Application Details', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            applications.forEach((app, index) => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                const applicationDate = new Date(app.application_date).toLocaleDateString();
                const approvedDate = app.approved_on ? new Date(app.approved_on).toLocaleDateString() : 'N/A';

                doc.text(`${index + 1}. ${app.first_name} ${app.last_name} (${app.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Loan Type: ${app.loan_type_name} | Status: ${app.status}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Requested: $${parseFloat(app.requested_amount || 0).toFixed(2)} | Approved: $${parseFloat(app.approved_amount || 0).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Tenure: ${app.tenure_months || 'N/A'} months | Interest: ${app.interest_rate || 'N/A'}%`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Applied: ${applicationDate} | Approved: ${approvedDate}`, 70, yPosition);
                yPosition += 12;
                
                if (app.approver_first_name) {
                    doc.text(`   Approved by: ${app.approver_first_name} ${app.approver_last_name}`, 70, yPosition);
                    yPosition += 12;
                }

                if (app.purpose) {
                    const purpose = app.purpose.length > 50 ? app.purpose.substring(0, 50) + '...' : app.purpose;
                    doc.text(`   Purpose: ${purpose}`, 70, yPosition);
                    yPosition += 12;
                }

                yPosition += 15;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateApplicationsExcel(reportData) {
        const { applications, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Applications Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'LOAN APPLICATIONS REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Applications', summary.totalApplications],
            ['Approved Applications', summary.approvedApplications],
            ['Pending Applications', summary.pendingApplications],
            ['Rejected Applications', summary.rejectedApplications],
            ['Approval Rate (%)', summary.approvalRate],
            ['Total Requested Amount', `$${summary.totalRequestedAmount.toFixed(2)}`],
            ['Total Approved Amount', `$${summary.totalApprovedAmount.toFixed(2)}`],
            ['Total Disbursed Amount', `$${summary.totalDisbursedAmount.toFixed(2)}`],
            ['Unique Employees', summary.uniqueEmployees]
        ];

        summarySheet.addTable({
            name: 'ApplicationsSummary',
            ref: 'A5',
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true
            },
            columns: [
                { name: 'Metric', filterButton: true },
                { name: 'Value', filterButton: true }
            ],
            rows: summaryData.slice(1)
        });

        // Applications Details Sheet
        const applicationsSheet = workbook.addWorksheet('Applications Details');
        
        applicationsSheet.columns = [
            { header: 'Application ID', key: 'applicationId', width: 15 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Loan Type', key: 'loanType', width: 20 },
            { header: 'Requested Amount', key: 'requestedAmount', width: 15 },
            { header: 'Approved Amount', key: 'approvedAmount', width: 15 },
            { header: 'Disbursed Amount', key: 'disbursedAmount', width: 15 },
            { header: 'Tenure (Months)', key: 'tenureMonths', width: 15 },
            { header: 'Interest Rate (%)', key: 'interestRate', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Application Date', key: 'applicationDate', width: 15 },
            { header: 'Approved Date', key: 'approvedDate', width: 15 },
            { header: 'Approved By', key: 'approvedBy', width: 20 },
            { header: 'Purpose', key: 'purpose', width: 30 }
        ];

        applications.forEach(app => {
            applicationsSheet.addRow({
                applicationId: app.id,
                employeeId: app.employee_id,
                employeeName: `${app.first_name} ${app.last_name}`,
                jobTitle: app.job_title || 'N/A',
                loanType: app.loan_type_name,
                requestedAmount: parseFloat(app.requested_amount || 0).toFixed(2),
                approvedAmount: parseFloat(app.approved_amount || 0).toFixed(2),
                disbursedAmount: parseFloat(app.disbursed_amount || 0).toFixed(2),
                tenureMonths: app.tenure_months || 'N/A',
                interestRate: app.interest_rate || 'N/A',
                status: app.status,
                applicationDate: new Date(app.application_date).toLocaleDateString(),
                approvedDate: app.approved_on ? new Date(app.approved_on).toLocaleDateString() : 'N/A',
                approvedBy: app.approver_first_name && app.approver_last_name ? 
                    `${app.approver_first_name} ${app.approver_last_name}` : 'N/A',
                purpose: app.purpose || 'N/A'
            });
        });

        // Style headers
        applicationsSheet.getRow(1).font = { bold: true };
        applicationsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `loan_applications_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateRepaymentsPDF(reportData) {
        const { repayments, outstanding, upcoming, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `loan_repayments_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('LOAN REPAYMENTS REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Repayments Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Repayments: ${summary.totalRepayments}`);
        doc.text(`Total Paid Amount: $${summary.totalPaidAmount.toFixed(2)}`);
        doc.text(`Principal Paid: $${summary.totalPrincipalPaid.toFixed(2)} | Interest Paid: $${summary.totalInterestPaid.toFixed(2)}`);
        doc.text(`On Time Payments: ${summary.onTimePayments} | Late Payments: ${summary.latePayments}`);
        doc.text(`Punctuality Rate: ${summary.punctualityRate}%`);
        doc.text(`Active Loans: ${summary.activeLoans} | Total Outstanding: $${summary.totalOutstanding.toFixed(2)}`);
        doc.text(`Upcoming Payments (30 days): ${summary.upcomingPayments} | Amount: $${summary.upcomingAmount.toFixed(2)}`);
        doc.moveDown();

        // Outstanding Balances
        if (outstanding.length > 0) {
            doc.fontSize(14).text('Outstanding Loan Balances', { underline: true });
            doc.fontSize(8);

            let yPosition = doc.y + 10;

            outstanding.slice(0, 10).forEach((loan, index) => { // Show top 10
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`${index + 1}. ${loan.first_name} ${loan.last_name} (${loan.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Loan Type: ${loan.loan_type_name} | Original: $${parseFloat(loan.loan_amount).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Outstanding: $${parseFloat(loan.outstanding_balance).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Installments: ${loan.paid_installments}/${loan.total_installments} paid (${loan.remaining_installments} remaining)`, 70, yPosition);
                yPosition += 20;
            });

            yPosition += 10;
        }

        // Upcoming Payments
        if (upcoming.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Upcoming Payments (Next 30 Days)', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            upcoming.slice(0, 15).forEach((payment, index) => { // Show next 15
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const dueDate = new Date(payment.due_date).toLocaleDateString();

                doc.text(`${index + 1}. ${payment.first_name} ${payment.last_name} (${payment.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Due: ${dueDate} | Amount: $${parseFloat(payment.total_amount).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Principal: $${parseFloat(payment.principal_amount).toFixed(2)} | Interest: $${parseFloat(payment.interest_amount).toFixed(2)}`, 70, yPosition);
                yPosition += 18;
            });
        }

        // Recent Repayments
        if (repayments.length > 0) {
            if (yPosition > 500) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Recent Repayments', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            repayments.slice(0, 20).forEach((repayment, index) => { // Show latest 20
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const repaymentDate = new Date(repayment.repayment_date).toLocaleDateString();

                doc.text(`${index + 1}. ${repayment.first_name} ${repayment.last_name} (${repayment.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Date: ${repaymentDate} | Amount: $${parseFloat(repayment.amount_paid || 0).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Status: ${repayment.payment_status || 'N/A'} | Method: ${repayment.payment_method || 'N/A'}`, 70, yPosition);
                yPosition += 18;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateRepaymentsExcel(reportData) {
        const { repayments, outstanding, upcoming, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Repayments Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'LOAN REPAYMENTS REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Repayments', summary.totalRepayments],
            ['Total Paid Amount', `$${summary.totalPaidAmount.toFixed(2)}`],
            ['Principal Paid', `$${summary.totalPrincipalPaid.toFixed(2)}`],
            ['Interest Paid', `$${summary.totalInterestPaid.toFixed(2)}`],
            ['On Time Payments', summary.onTimePayments],
            ['Late Payments', summary.latePayments],
            ['Punctuality Rate (%)', summary.punctualityRate],
            ['Active Loans', summary.activeLoans],
            ['Total Outstanding', `$${summary.totalOutstanding.toFixed(2)}`],
            ['Upcoming Payments (30 days)', summary.upcomingPayments],
            ['Upcoming Amount', `$${summary.upcomingAmount.toFixed(2)}`],
            ['Unique Employees', summary.uniqueEmployees]
        ];

        summarySheet.addTable({
            name: 'RepaymentsSummary',
            ref: 'A5',
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true
            },
            columns: [
                { name: 'Metric', filterButton: true },
                { name: 'Value', filterButton: true }
            ],
            rows: summaryData.slice(1)
        });

        // Outstanding Balances Sheet
        if (outstanding.length > 0) {
            const outstandingSheet = workbook.addWorksheet('Outstanding Balances');
            
            outstandingSheet.columns = [
                { header: 'Employee ID', key: 'employeeId', width: 15 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Loan Type', key: 'loanType', width: 20 },
                { header: 'Original Amount', key: 'originalAmount', width: 15 },
                { header: 'Principal Paid', key: 'principalPaid', width: 15 },
                { header: 'Outstanding Balance', key: 'outstandingBalance', width: 18 },
                { header: 'Total Installments', key: 'totalInstallments', width: 18 },
                { header: 'Paid Installments', key: 'paidInstallments', width: 18 },
                { header: 'Remaining Installments', key: 'remainingInstallments', width: 20 }
            ];

            outstanding.forEach(loan => {
                outstandingSheet.addRow({
                    employeeId: loan.employee_id,
                    employeeName: `${loan.first_name} ${loan.last_name}`,
                    loanType: loan.loan_type_name,
                    originalAmount: parseFloat(loan.loan_amount).toFixed(2),
                    principalPaid: parseFloat(loan.total_paid_principal || 0).toFixed(2),
                    outstandingBalance: parseFloat(loan.outstanding_balance).toFixed(2),
                    totalInstallments: loan.total_installments,
                    paidInstallments: loan.paid_installments,
                    remainingInstallments: loan.remaining_installments
                });
            });

            // Style headers
            outstandingSheet.getRow(1).font = { bold: true };
            outstandingSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        // Repayments Details Sheet
        if (repayments.length > 0) {
            const repaymentsSheet = workbook.addWorksheet('Repayments Details');
            
            repaymentsSheet.columns = [
                { header: 'Employee ID', key: 'employeeId', width: 15 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Loan Type', key: 'loanType', width: 20 },
                { header: 'Repayment Date', key: 'repaymentDate', width: 15 },
                { header: 'Amount Paid', key: 'amountPaid', width: 12 },
                { header: 'Principal Amount', key: 'principalAmount', width: 15 },
                { header: 'Interest Amount', key: 'interestAmount', width: 15 },
                { header: 'Payment Status', key: 'paymentStatus', width: 15 },
                { header: 'Payment Method', key: 'paymentMethod', width: 15 },
                { header: 'Reference', key: 'reference', width: 20 }
            ];

            repayments.forEach(repayment => {
                repaymentsSheet.addRow({
                    employeeId: repayment.employee_id,
                    employeeName: `${repayment.first_name} ${repayment.last_name}`,
                    loanType: repayment.loan_type_name,
                    repaymentDate: new Date(repayment.repayment_date).toLocaleDateString(),
                    amountPaid: parseFloat(repayment.amount_paid || 0).toFixed(2),
                    principalAmount: parseFloat(repayment.principal_amount || 0).toFixed(2),
                    interestAmount: parseFloat(repayment.interest_amount || 0).toFixed(2),
                    paymentStatus: repayment.payment_status || 'N/A',
                    paymentMethod: repayment.payment_method || 'N/A',
                    reference: repayment.transaction_reference || 'N/A'
                });
            });

            // Style headers
            repaymentsSheet.getRow(1).font = { bold: true };
            repaymentsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `loan_repayments_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }
}

module.exports = new LoanReportsController();
