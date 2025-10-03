

const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class LeaveReportsController {

    /**
     * Generate detailed leave report with applications and balances
     */
    async generateLeaveReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                leaveTypeIds,
                format = 'pdf',
                includeBalances = true
            } = req.body;

            // Build leave records query
            let query = `
                SELECT 
                    elr.id,
                    elr.start_date,
                    elr.end_date,
                    elr.days_requested,
                    elr.days_approved,
                    elr.status,
                    elr.reason,
                    elr.applied_on,
                    elr.approved_on,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    lt.name as leave_type_name,
                    lt.code as leave_type_code,
                    approver.first_name as approver_first_name,
                    approver.last_name as approver_last_name
                FROM employee_leave_records elr
                JOIN user u ON elr.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN leave_types lt ON elr.leave_type_id = lt.id
                LEFT JOIN user approver ON elr.approved_by = approver.id
                WHERE elr.start_date >= ? AND elr.end_date <= ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND elr.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            if (leaveTypeIds && leaveTypeIds.length > 0) {
                query += ` AND elr.leave_type_id IN (${leaveTypeIds.map(() => '?').join(',')})`;
                params.push(...leaveTypeIds);
            }

            query += ` ORDER BY u.first_name, elr.start_date DESC`;

            const [leaveData] = await db.execute(query, params);

            // Get leave balances if requested
            let balanceData = {};
            if (includeBalances) {
                const balanceQuery = `
                    SELECT 
                        elb.employee_id,
                        elb.leave_type_id,
                        elb.opening_balance,
                        elb.earned_balance,
                        elb.used_balance,
                        elb.closing_balance,
                        elb.carry_forward_balance,
                        lt.name as leave_type_name,
                        lt.code as leave_type_code,
                        u.first_name,
                        u.last_name
                    FROM employee_leave_balance elb
                    JOIN leave_types lt ON elb.leave_type_id = lt.id
                    JOIN user u ON elb.employee_id = u.id
                    WHERE elb.balance_year = YEAR(?)
                `;

                let balanceParams = [endDate];

                if (employeeIds && employeeIds.length > 0) {
                    balanceQuery += ` AND elb.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                    balanceParams.push(...employeeIds);
                }

                const [balances] = await db.execute(balanceQuery, balanceParams);

                // Group balances by employee
                balances.forEach(balance => {
                    const empKey = `${balance.employee_id}_${balance.leave_type_id}`;
                    balanceData[empKey] = balance;
                });
            }

            // Calculate summary statistics
            const summary = this.calculateLeaveSummary(leaveData, balanceData);

            const reportData = {
                leaveData,
                balanceData,
                summary,
                includeBalances,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateLeavePDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateLeaveExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating leave report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate leave report',
                error: error.message
            });
        }
    }

    /**
     * Generate leave balance utilization report
     */
    async generateLeaveBalanceReport(req, res) {
        try {
            const { employeeIds, format = 'pdf' } = req.body;

            let query = `
                SELECT 
                    elb.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    lt.name as leave_type_name,
                    lt.code as leave_type_code,
                    lt.max_days_per_year,
                    lt.can_carry_forward,
                    lt.max_carry_forward_days
                FROM employee_leave_balance elb
                JOIN user u ON elb.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN leave_types lt ON elb.leave_type_id = lt.id
                WHERE elb.balance_year = YEAR(CURDATE())
                AND u.is_active = 1
            `;

            let params = [];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND elb.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            query += ` ORDER BY u.first_name, lt.name`;

            const [balanceData] = await db.execute(query, params);

            // Get leave utilization trends
            const utilizationQuery = `
                SELECT 
                    elbl.employee_id,
                    elbl.leave_type_id,
                    MONTH(elbl.transaction_date) as month,
                    SUM(CASE WHEN elbl.transaction_type = 'USED' THEN elbl.days ELSE 0 END) as used_days,
                    SUM(CASE WHEN elbl.transaction_type = 'EARNED' THEN elbl.days ELSE 0 END) as earned_days
                FROM employee_leave_balance_ledger elbl
                WHERE YEAR(elbl.transaction_date) = YEAR(CURDATE())
                ${employeeIds && employeeIds.length > 0 ? 
                    `AND elbl.employee_id IN (${employeeIds.map(() => '?').join(',')})` : ''}
                GROUP BY elbl.employee_id, elbl.leave_type_id, MONTH(elbl.transaction_date)
                ORDER BY elbl.employee_id, elbl.leave_type_id, month
            `;

            const utilizationParams = employeeIds && employeeIds.length > 0 ? employeeIds : [];
            const [utilizationData] = await db.execute(utilizationQuery, utilizationParams);

            // Calculate summary
            const summary = this.calculateBalanceSummary(balanceData, utilizationData);

            const reportData = {
                balanceData,
                utilizationData,
                summary
            };

            if (format === 'pdf') {
                const filePath = await this.generateBalancePDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave balance report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateBalanceExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave balance report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating leave balance report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate leave balance report',
                error: error.message
            });
        }
    }

    /**
     * Generate leave encashment report
     */
    async generateLeaveEncashmentReport(req, res) {
        try {
            const { startDate, endDate, employeeIds, format = 'pdf' } = req.body;

            let query = `
                SELECT 
                    ler.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    lt.name as leave_type_name,
                    approver.first_name as approver_first_name,
                    approver.last_name as approver_last_name
                FROM leave_encashment_requests ler
                JOIN user u ON ler.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN leave_types lt ON ler.leave_type_id = lt.id
                LEFT JOIN user approver ON ler.approved_by = approver.id
                WHERE ler.request_date >= ? AND ler.request_date <= ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND ler.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            query += ` ORDER BY ler.request_date DESC, u.first_name`;

            const [encashmentData] = await db.execute(query, params);

            // Calculate summary
            const summary = this.calculateEncashmentSummary(encashmentData);

            const reportData = {
                encashmentData,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateEncashmentPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave encashment report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateEncashmentExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Leave encashment report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating leave encashment report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate leave encashment report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateLeaveSummary(leaveData, balanceData) {
        const summary = {
            totalApplications: leaveData.length,
            approvedApplications: leaveData.filter(l => l.status === 'Approved').length,
            pendingApplications: leaveData.filter(l => l.status === 'Pending').length,
            rejectedApplications: leaveData.filter(l => l.status === 'Rejected').length,
            totalDaysRequested: leaveData.reduce((sum, l) => sum + (parseFloat(l.days_requested) || 0), 0),
            totalDaysApproved: leaveData.reduce((sum, l) => sum + (parseFloat(l.days_approved) || 0), 0),
            uniqueEmployees: new Set(leaveData.map(l => l.employee_id)).size,
            leaveTypes: {}
        };

        // Group by leave type
        leaveData.forEach(leave => {
            const type = leave.leave_type_name;
            if (!summary.leaveTypes[type]) {
                summary.leaveTypes[type] = {
                    applications: 0,
                    daysRequested: 0,
                    daysApproved: 0
                };
            }
            summary.leaveTypes[type].applications++;
            summary.leaveTypes[type].daysRequested += parseFloat(leave.days_requested) || 0;
            summary.leaveTypes[type].daysApproved += parseFloat(leave.days_approved) || 0;
        });

        return summary;
    }

    calculateBalanceSummary(balanceData, utilizationData) {
        const summary = {
            totalEmployees: new Set(balanceData.map(b => b.employee_id)).size,
            totalLeaveTypes: new Set(balanceData.map(b => b.leave_type_id)).size,
            totalOpeningBalance: balanceData.reduce((sum, b) => sum + (parseFloat(b.opening_balance) || 0), 0),
            totalEarnedBalance: balanceData.reduce((sum, b) => sum + (parseFloat(b.earned_balance) || 0), 0),
            totalUsedBalance: balanceData.reduce((sum, b) => sum + (parseFloat(b.used_balance) || 0), 0),
            totalClosingBalance: balanceData.reduce((sum, b) => sum + (parseFloat(b.closing_balance) || 0), 0),
            utilizationRate: 0,
            leaveTypes: {}
        };

        // Calculate utilization rate
        if (summary.totalEarnedBalance > 0) {
            summary.utilizationRate = (summary.totalUsedBalance / summary.totalEarnedBalance * 100).toFixed(2);
        }

        // Group by leave type
        balanceData.forEach(balance => {
            const type = balance.leave_type_name;
            if (!summary.leaveTypes[type]) {
                summary.leaveTypes[type] = {
                    employees: 0,
                    totalEarned: 0,
                    totalUsed: 0,
                    totalBalance: 0
                };
            }
            summary.leaveTypes[type].employees++;
            summary.leaveTypes[type].totalEarned += parseFloat(balance.earned_balance) || 0;
            summary.leaveTypes[type].totalUsed += parseFloat(balance.used_balance) || 0;
            summary.leaveTypes[type].totalBalance += parseFloat(balance.closing_balance) || 0;
        });

        return summary;
    }

    calculateEncashmentSummary(encashmentData) {
        const summary = {
            totalRequests: encashmentData.length,
            approvedRequests: encashmentData.filter(e => e.status === 'Approved').length,
            pendingRequests: encashmentData.filter(e => e.status === 'Pending').length,
            rejectedRequests: encashmentData.filter(e => e.status === 'Rejected').length,
            totalDaysRequested: encashmentData.reduce((sum, e) => sum + (parseFloat(e.days_requested) || 0), 0),
            totalDaysApproved: encashmentData.reduce((sum, e) => sum + (parseFloat(e.days_approved) || 0), 0),
            totalAmountRequested: encashmentData.reduce((sum, e) => sum + (parseFloat(e.amount_requested) || 0), 0),
            totalAmountApproved: encashmentData.reduce((sum, e) => sum + (parseFloat(e.amount_approved) || 0), 0),
            uniqueEmployees: new Set(encashmentData.map(e => e.employee_id)).size
        };

        return summary;
    }

    async generateLeavePDF(reportData) {
        const { leaveData, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `leave_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('LEAVE REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Leave Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Applications: ${summary.totalApplications}`);
        doc.text(`Approved: ${summary.approvedApplications} | Pending: ${summary.pendingApplications} | Rejected: ${summary.rejectedApplications}`);
        doc.text(`Total Days Requested: ${summary.totalDaysRequested}`);
        doc.text(`Total Days Approved: ${summary.totalDaysApproved}`);
        doc.text(`Unique Employees: ${summary.uniqueEmployees}`);
        doc.moveDown();

        // Leave Type Breakdown
        doc.fontSize(14).text('Leave Type Breakdown', { underline: true });
        doc.fontSize(8);
        let yPosition = doc.y + 10;

        Object.keys(summary.leaveTypes).forEach(leaveType => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const typeData = summary.leaveTypes[leaveType];
            doc.text(`${leaveType}: ${typeData.applications} applications, ${typeData.daysApproved} days approved`, 50, yPosition);
            yPosition += 12;
        });

        yPosition += 20;

        // Detailed Records
        if (leaveData.length > 0) {
            doc.fontSize(14).text('Leave Applications', { underline: true });
            doc.fontSize(8);

            leaveData.forEach((leave, index) => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                const startDate = new Date(leave.start_date).toLocaleDateString();
                const endDate = new Date(leave.end_date).toLocaleDateString();
                const appliedDate = new Date(leave.applied_on).toLocaleDateString();

                doc.text(`${index + 1}. ${leave.first_name} ${leave.last_name} - ${leave.leave_type_name}`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Period: ${startDate} to ${endDate} | Days: ${leave.days_requested} | Status: ${leave.status}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Applied: ${appliedDate} | Reason: ${leave.reason || 'N/A'}`, 70, yPosition);
                yPosition += 20;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateLeaveExcel(reportData) {
        const { leaveData, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Leave Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'LEAVE REPORT';
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
            ['Total Days Requested', summary.totalDaysRequested],
            ['Total Days Approved', summary.totalDaysApproved],
            ['Unique Employees', summary.uniqueEmployees]
        ];

        summarySheet.addTable({
            name: 'LeaveSummary',
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

        // Applications Sheet
        if (leaveData.length > 0) {
            const applicationsSheet = workbook.addWorksheet('Leave Applications');
            
            applicationsSheet.columns = [
                { header: 'Employee ID', key: 'employeeId', width: 15 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Job Title', key: 'jobTitle', width: 20 },
                { header: 'Leave Type', key: 'leaveType', width: 15 },
                { header: 'Start Date', key: 'startDate', width: 12 },
                { header: 'End Date', key: 'endDate', width: 12 },
                { header: 'Days Requested', key: 'daysRequested', width: 15 },
                { header: 'Days Approved', key: 'daysApproved', width: 15 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Applied On', key: 'appliedOn', width: 12 },
                { header: 'Approved By', key: 'approvedBy', width: 20 },
                { header: 'Reason', key: 'reason', width: 30 }
            ];

            leaveData.forEach(leave => {
                applicationsSheet.addRow({
                    employeeId: leave.employee_id,
                    employeeName: `${leave.first_name} ${leave.last_name}`,
                    jobTitle: leave.job_title || 'N/A',
                    leaveType: leave.leave_type_name,
                    startDate: new Date(leave.start_date).toLocaleDateString(),
                    endDate: new Date(leave.end_date).toLocaleDateString(),
                    daysRequested: leave.days_requested,
                    daysApproved: leave.days_approved || 0,
                    status: leave.status,
                    appliedOn: new Date(leave.applied_on).toLocaleDateString(),
                    approvedBy: leave.approver_first_name && leave.approver_last_name ? 
                        `${leave.approver_first_name} ${leave.approver_last_name}` : 'N/A',
                    reason: leave.reason || 'N/A'
                });
            });

            // Style headers
            applicationsSheet.getRow(1).font = { bold: true };
            applicationsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `leave_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateBalancePDF(reportData) {
        const { balanceData, summary } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `leave_balance_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('LEAVE BALANCE REPORT', { align: 'center' });
        doc.fontSize(12).text(`Year: ${new Date().getFullYear()}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Balance Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Employees: ${summary.totalEmployees}`);
        doc.text(`Total Leave Types: ${summary.totalLeaveTypes}`);
        doc.text(`Total Opening Balance: ${summary.totalOpeningBalance}`);
        doc.text(`Total Earned Balance: ${summary.totalEarnedBalance}`);
        doc.text(`Total Used Balance: ${summary.totalUsedBalance}`);
        doc.text(`Total Closing Balance: ${summary.totalClosingBalance}`);
        doc.text(`Overall Utilization Rate: ${summary.utilizationRate}%`);
        doc.moveDown();

        // Employee Balances
        doc.fontSize(14).text('Employee Leave Balances', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        // Group by employee
        const groupedBalances = {};
        balanceData.forEach(balance => {
            const empKey = `${balance.first_name} ${balance.last_name}`;
            if (!groupedBalances[empKey]) {
                groupedBalances[empKey] = [];
            }
            groupedBalances[empKey].push(balance);
        });

        Object.keys(groupedBalances).forEach(employeeName => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`Employee: ${employeeName}`, 50, yPosition);
            yPosition += 15;

            groupedBalances[employeeName].forEach(balance => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`  ${balance.leave_type_name}: Earned: ${balance.earned_balance}, Used: ${balance.used_balance}, Balance: ${balance.closing_balance}`, 70, yPosition);
                yPosition += 12;
            });
            yPosition += 10;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateBalanceExcel(reportData) {
        const { balanceData, summary } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Balance Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'LEAVE BALANCE REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Year:';
        summarySheet.getCell('B3').value = new Date().getFullYear();

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Employees', summary.totalEmployees],
            ['Total Leave Types', summary.totalLeaveTypes],
            ['Total Opening Balance', summary.totalOpeningBalance],
            ['Total Earned Balance', summary.totalEarnedBalance],
            ['Total Used Balance', summary.totalUsedBalance],
            ['Total Closing Balance', summary.totalClosingBalance],
            ['Utilization Rate (%)', summary.utilizationRate]
        ];

        summarySheet.addTable({
            name: 'BalanceSummary',
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

        // Employee Balances Sheet
        const balancesSheet = workbook.addWorksheet('Employee Balances');
        
        balancesSheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Leave Type', key: 'leaveType', width: 15 },
            { header: 'Opening Balance', key: 'openingBalance', width: 15 },
            { header: 'Earned Balance', key: 'earnedBalance', width: 15 },
            { header: 'Used Balance', key: 'usedBalance', width: 15 },
            { header: 'Closing Balance', key: 'closingBalance', width: 15 },
            { header: 'Carry Forward', key: 'carryForward', width: 15 },
            { header: 'Balance Year', key: 'balanceYear', width: 12 }
        ];

        balanceData.forEach(balance => {
            balancesSheet.addRow({
                employeeId: balance.employee_id,
                employeeName: `${balance.first_name} ${balance.last_name}`,
                jobTitle: balance.job_title || 'N/A',
                leaveType: balance.leave_type_name,
                openingBalance: balance.opening_balance,
                earnedBalance: balance.earned_balance,
                usedBalance: balance.used_balance,
                closingBalance: balance.closing_balance,
                carryForward: balance.carry_forward_balance,
                balanceYear: balance.balance_year
            });
        });

        // Style headers
        balancesSheet.getRow(1).font = { bold: true };
        balancesSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `leave_balance_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateEncashmentPDF(reportData) {
        const { encashmentData, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `leave_encashment_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('LEAVE ENCASHMENT REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Encashment Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Requests: ${summary.totalRequests}`);
        doc.text(`Approved: ${summary.approvedRequests} | Pending: ${summary.pendingRequests} | Rejected: ${summary.rejectedRequests}`);
        doc.text(`Total Days Requested: ${summary.totalDaysRequested}`);
        doc.text(`Total Days Approved: ${summary.totalDaysApproved}`);
        doc.text(`Total Amount Requested: $${summary.totalAmountRequested.toFixed(2)}`);
        doc.text(`Total Amount Approved: $${summary.totalAmountApproved.toFixed(2)}`);
        doc.text(`Unique Employees: ${summary.uniqueEmployees}`);
        doc.moveDown();

        // Detailed Records
        if (encashmentData.length > 0) {
            doc.fontSize(14).text('Encashment Requests', { underline: true });
            doc.fontSize(8);

            let yPosition = doc.y + 10;

            encashmentData.forEach((encashment, index) => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                const requestDate = new Date(encashment.request_date).toLocaleDateString();
                
                doc.text(`${index + 1}. ${encashment.first_name} ${encashment.last_name} - ${encashment.leave_type_name}`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Days: ${encashment.days_requested} | Amount: $${parseFloat(encashment.amount_requested || 0).toFixed(2)} | Status: ${encashment.status}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Request Date: ${requestDate}`, 70, yPosition);
                if (encashment.approver_first_name) {
                    yPosition += 12;
                    doc.text(`   Approved by: ${encashment.approver_first_name} ${encashment.approver_last_name}`, 70, yPosition);
                }
                yPosition += 20;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateEncashmentExcel(reportData) {
        const { encashmentData, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Encashment Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'LEAVE ENCASHMENT REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Requests', summary.totalRequests],
            ['Approved Requests', summary.approvedRequests],
            ['Pending Requests', summary.pendingRequests],
            ['Rejected Requests', summary.rejectedRequests],
            ['Total Days Requested', summary.totalDaysRequested],
            ['Total Days Approved', summary.totalDaysApproved],
            ['Total Amount Requested', `$${summary.totalAmountRequested.toFixed(2)}`],
            ['Total Amount Approved', `$${summary.totalAmountApproved.toFixed(2)}`],
            ['Unique Employees', summary.uniqueEmployees]
        ];

        summarySheet.addTable({
            name: 'EncashmentSummary',
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

        // Requests Sheet
        if (encashmentData.length > 0) {
            const requestsSheet = workbook.addWorksheet('Encashment Requests');
            
            requestsSheet.columns = [
                { header: 'Employee ID', key: 'employeeId', width: 15 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Job Title', key: 'jobTitle', width: 20 },
                { header: 'Leave Type', key: 'leaveType', width: 15 },
                { header: 'Request Date', key: 'requestDate', width: 12 },
                { header: 'Days Requested', key: 'daysRequested', width: 15 },
                { header: 'Days Approved', key: 'daysApproved', width: 15 },
                { header: 'Amount Requested', key: 'amountRequested', width: 15 },
                { header: 'Amount Approved', key: 'amountApproved', width: 15 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Approved By', key: 'approvedBy', width: 20 }
            ];

            encashmentData.forEach(encashment => {
                requestsSheet.addRow({
                    employeeId: encashment.employee_id,
                    employeeName: `${encashment.first_name} ${encashment.last_name}`,
                    jobTitle: encashment.job_title || 'N/A',
                    leaveType: encashment.leave_type_name,
                    requestDate: new Date(encashment.request_date).toLocaleDateString(),
                    daysRequested: encashment.days_requested,
                    daysApproved: encashment.days_approved || 0,
                    amountRequested: parseFloat(encashment.amount_requested || 0).toFixed(2),
                    amountApproved: parseFloat(encashment.amount_approved || 0).toFixed(2),
                    status: encashment.status,
                    approvedBy: encashment.approver_first_name && encashment.approver_last_name ? 
                        `${encashment.approver_first_name} ${encashment.approver_last_name}` : 'N/A'
                });
            });

            // Style headers
            requestsSheet.getRow(1).font = { bold: true };
            requestsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `leave_encashment_report_${Date.now()}.xlsx`;
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

module.exports = new LeaveReportsController();
