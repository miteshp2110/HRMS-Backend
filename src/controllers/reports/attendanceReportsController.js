

const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class AttendanceReportsController {
    
    /**
     * Generate detailed attendance report with filtering options
     */
    async generateAttendanceReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                departments,
                format = 'pdf',
                includeDetails = true
            } = req.body;

            // Build query with filters
            let query = `
                SELECT 
                    ar.id,
                    ar.attendance_date,
                    ar.punch_in,
                    ar.punch_out,
                    ar.hours_worked,
                    ar.attendance_status,
                    ar.is_late,
                    ar.is_early_departure,
                    ar.short_hours,
                    u.first_name,
                    u.last_name,
                    u.email,
                    j.title as job_title,
                    s.name as shift_name,
                    s.from_time,
                    s.to_time,
                    s.scheduled_hours
                FROM attendance_record ar
                JOIN user u ON ar.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN shifts s ON ar.shift = s.id
                WHERE ar.attendance_date BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND ar.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            if (departments && departments.length > 0) {
                query += ` AND u.job_role IN (${departments.map(() => '?').join(',')})`;
                params.push(...departments);
            }

            query += ` ORDER BY u.first_name, ar.attendance_date`;

            const [attendanceData] = await db.execute(query, params);

            // Calculate summary statistics
            const summaryStats = this.calculateAttendanceSummary(attendanceData);

            if (format === 'pdf') {
                const filePath = await this.generateAttendancePDF(attendanceData, summaryStats, {
                    startDate,
                    endDate,
                    includeDetails
                });
                
                res.json({
                    success: true,
                    message: 'Attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: summaryStats
                });
            } else if (format === 'excel') {
                const filePath = await this.generateAttendanceExcel(attendanceData, summaryStats, {
                    startDate,
                    endDate,
                    includeDetails
                });
                
                res.json({
                    success: true,
                    message: 'Attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: summaryStats
                });
            }

        } catch (error) {
            console.error('Error generating attendance report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate attendance report',
                error: error.message
            });
        }
    }

    /**
     * Generate monthly attendance summary report
     */
    async generateMonthlyAttendanceSummary(req, res) {
        try {
            const { month, year, format = 'pdf' } = req.body;

            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const query = `
                SELECT 
                    u.id as employee_id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    j.title as job_title,
                    COUNT(CASE WHEN ar.attendance_status = 'Present' THEN 1 END) as present_days,
                    COUNT(CASE WHEN ar.attendance_status = 'Absent' THEN 1 END) as absent_days,
                    COUNT(CASE WHEN ar.attendance_status = 'Leave' THEN 1 END) as leave_days,
                    COUNT(CASE WHEN ar.attendance_status = 'Half-Day' THEN 1 END) as half_days,
                    COUNT(CASE WHEN ar.is_late = 1 THEN 1 END) as late_arrivals,
                    COUNT(CASE WHEN ar.is_early_departure = 1 THEN 1 END) as early_departures,
                    SUM(ar.hours_worked) as total_hours_worked,
                    AVG(ar.hours_worked) as avg_hours_per_day,
                    SUM(ar.short_hours) as total_short_hours
                FROM user u
                LEFT JOIN attendance_record ar ON u.id = ar.employee_id 
                    AND ar.attendance_date BETWEEN ? AND ?
                LEFT JOIN jobs j ON u.job_role = j.id
                WHERE u.is_active = 1 
                    AND u.is_payroll_exempt = 0
                GROUP BY u.id, u.first_name, u.last_name, u.email, j.title
                ORDER BY u.first_name, u.last_name
            `;

            const [monthlyData] = await db.execute(query, [startDate, endDate]);

            // Get working days in the month
            const workingDaysQuery = `
                SELECT COUNT(*) as working_days
                FROM (
                    SELECT DISTINCT ar.attendance_date
                    FROM attendance_record ar
                    WHERE ar.attendance_date BETWEEN ? AND ?
                ) as work_dates
            `;
            const [workingDaysResult] = await db.execute(workingDaysQuery, [startDate, endDate]);
            const workingDays = workingDaysResult[0].working_days;

            const summaryData = {
                month,
                year,
                workingDays,
                totalEmployees: monthlyData.length,
                avgAttendanceRate: monthlyData.reduce((sum, emp) => 
                    sum + (emp.present_days + emp.half_days * 0.5), 0) / (monthlyData.length * workingDays) * 100
            };

            if (format === 'pdf') {
                const filePath = await this.generateMonthlyAttendancePDF(monthlyData, summaryData);
                
                res.json({
                    success: true,
                    message: 'Monthly attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: summaryData
                });
            } else if (format === 'excel') {
                const filePath = await this.generateMonthlyAttendanceExcel(monthlyData, summaryData);
                
                res.json({
                    success: true,
                    message: 'Monthly attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: summaryData
                });
            }

        } catch (error) {
            console.error('Error generating monthly attendance summary:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate monthly attendance summary',
                error: error.message
            });
        }
    }

    /**
     * Generate individual employee attendance summary
     */
    async generateEmployeeAttendanceSummary(req, res) {
        try {
            const { employeeId, startDate, endDate, format = 'pdf' } = req.body;

            // Get employee details
            const employeeQuery = `
                SELECT u.*, j.title as job_title, s.name as shift_name, r.name as role_name
                FROM user u
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN shifts s ON u.shift = s.id
                LEFT JOIN roles r ON u.system_role = r.id
                WHERE u.id = ?
            `;
            const [employeeData] = await db.execute(employeeQuery, [employeeId]);
            
            if (employeeData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Get attendance records
            const attendanceQuery = `
                SELECT 
                    ar.*,
                    s.name as shift_name,
                    s.from_time,
                    s.to_time,
                    s.scheduled_hours
                FROM attendance_record ar
                JOIN shifts s ON ar.shift = s.id
                WHERE ar.employee_id = ? 
                    AND ar.attendance_date BETWEEN ? AND ?
                ORDER BY ar.attendance_date
            `;
            const [attendanceRecords] = await db.execute(attendanceQuery, [employeeId, startDate, endDate]);

            // Get overtime records
            const overtimeQuery = `
                SELECT 
                    eor.*,
                    ar.attendance_date
                FROM employee_overtime_records eor
                JOIN attendance_record ar ON eor.attendance_record_id = ar.id
                WHERE eor.employee_id = ? 
                    AND ar.attendance_date BETWEEN ? AND ?
                ORDER BY ar.attendance_date
            `;
            const [overtimeRecords] = await db.execute(overtimeQuery, [employeeId, startDate, endDate]);

            // Calculate individual summary
            const individualSummary = this.calculateIndividualSummary(attendanceRecords, overtimeRecords);

            const reportData = {
                employee: employeeData[0],
                attendanceRecords,
                overtimeRecords,
                summary: individualSummary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateEmployeeAttendancePDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Employee attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: individualSummary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateEmployeeAttendanceExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Employee attendance report generated successfully',
                    downloadUrl: filePath,
                    summary: individualSummary
                });
            }

        } catch (error) {
            console.error('Error generating employee attendance summary:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate employee attendance summary',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateAttendanceSummary(attendanceData) {
        const summary = {
            totalRecords: attendanceData.length,
            presentDays: 0,
            absentDays: 0,
            leaveDays: 0,
            halfDays: 0,
            lateArrivals: 0,
            earlyDepartures: 0,
            totalHours: 0,
            shortHours: 0,
            attendanceRate: 0
        };

        attendanceData.forEach(record => {
            switch (record.attendance_status) {
                case 'Present':
                    summary.presentDays++;
                    break;
                case 'Absent':
                    summary.absentDays++;
                    break;
                case 'Leave':
                    summary.leaveDays++;
                    break;
                case 'Half-Day':
                    summary.halfDays++;
                    break;
            }

            if (record.is_late) summary.lateArrivals++;
            if (record.is_early_departure) summary.earlyDepartures++;
            if (record.hours_worked) summary.totalHours += parseFloat(record.hours_worked);
            if (record.short_hours) summary.shortHours += parseFloat(record.short_hours);
        });

        summary.attendanceRate = summary.totalRecords > 0 ? 
            ((summary.presentDays + summary.halfDays * 0.5) / summary.totalRecords * 100).toFixed(2) : 0;

        return summary;
    }

    calculateIndividualSummary(attendanceRecords, overtimeRecords) {
        const summary = {
            totalDays: attendanceRecords.length,
            presentDays: attendanceRecords.filter(r => r.attendance_status === 'Present').length,
            absentDays: attendanceRecords.filter(r => r.attendance_status === 'Absent').length,
            leaveDays: attendanceRecords.filter(r => r.attendance_status === 'Leave').length,
            halfDays: attendanceRecords.filter(r => r.attendance_status === 'Half-Day').length,
            lateArrivals: attendanceRecords.filter(r => r.is_late).length,
            earlyDepartures: attendanceRecords.filter(r => r.is_early_departure).length,
            totalHours: attendanceRecords.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0),
            totalOvertime: overtimeRecords.reduce((sum, r) => sum + (parseFloat(r.approved_hours) || 0), 0),
            avgHoursPerDay: 0,
            attendanceRate: 0
        };

        summary.avgHoursPerDay = summary.totalDays > 0 ? (summary.totalHours / summary.totalDays).toFixed(2) : 0;
        summary.attendanceRate = summary.totalDays > 0 ? 
            ((summary.presentDays + summary.halfDays * 0.5) / summary.totalDays * 100).toFixed(2) : 0;

        return summary;
    }

    async generateAttendancePDF(attendanceData, summaryStats, options) {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `attendance_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('ATTENDANCE REPORT', { align: 'center' });
        doc.fontSize(12).text(`Report Period: ${options.startDate} to ${options.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary Section
        doc.fontSize(16).text('Summary Statistics', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Records: ${summaryStats.totalRecords}`);
        doc.text(`Present Days: ${summaryStats.presentDays}`);
        doc.text(`Absent Days: ${summaryStats.absentDays}`);
        doc.text(`Leave Days: ${summaryStats.leaveDays}`);
        doc.text(`Half Days: ${summaryStats.halfDays}`);
        doc.text(`Late Arrivals: ${summaryStats.lateArrivals}`);
        doc.text(`Early Departures: ${summaryStats.earlyDepartures}`);
        doc.text(`Total Hours Worked: ${summaryStats.totalHours.toFixed(2)}`);
        doc.text(`Attendance Rate: ${summaryStats.attendanceRate}%`);
        doc.moveDown();

        if (options.includeDetails && attendanceData.length > 0) {
            // Table Header
            doc.fontSize(14).text('Detailed Attendance Records', { underline: true });
            doc.fontSize(8);

            let yPosition = doc.y + 10;
            
            // Group by employee
            const groupedData = attendanceData.reduce((acc, record) => {
                const empKey = `${record.first_name} ${record.last_name}`;
                if (!acc[empKey]) acc[empKey] = [];
                acc[empKey].push(record);
                return acc;
            }, {});

            Object.keys(groupedData).forEach(employeeName => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.fontSize(10).text(`Employee: ${employeeName}`, 50, yPosition);
                yPosition += 20;

                groupedData[employeeName].forEach(record => {
                    if (yPosition > 750) {
                        doc.addPage();
                        yPosition = 50;
                    }

                    const dateStr = new Date(record.attendance_date).toLocaleDateString();
                    const punchIn = record.punch_in ? new Date(record.punch_in).toLocaleTimeString() : 'N/A';
                    const punchOut = record.punch_out ? new Date(record.punch_out).toLocaleTimeString() : 'N/A';
                    const hoursWorked = record.hours_worked || 0;
                    
                    doc.text(`${dateStr} | ${record.attendance_status} | In: ${punchIn} | Out: ${punchOut} | Hours: ${hoursWorked}`, 70, yPosition);
                    
                    if (record.is_late || record.is_early_departure) {
                        yPosition += 12;
                        const flags = [];
                        if (record.is_late) flags.push('Late');
                        if (record.is_early_departure) flags.push('Early Departure');
                        doc.fontSize(8).fillColor('red').text(`  Flags: ${flags.join(', ')}`, 70, yPosition);
                        doc.fillColor('black').fontSize(8);
                    }
                    
                    yPosition += 15;
                });
                yPosition += 10;
            });
        }

        doc.end();

        return `/uploads/reports/${fileName}`;
    }

    async generateAttendanceExcel(attendanceData, summaryStats, options) {
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'ATTENDANCE REPORT SUMMARY';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Report Period:';
        summarySheet.getCell('B3').value = `${options.startDate} to ${options.endDate}`;
        
        summarySheet.getCell('A4').value = 'Generated on:';
        summarySheet.getCell('B4').value = new Date().toLocaleDateString();

        // Summary Statistics
        const summaryData = [
            ['Metric', 'Value'],
            ['Total Records', summaryStats.totalRecords],
            ['Present Days', summaryStats.presentDays],
            ['Absent Days', summaryStats.absentDays],
            ['Leave Days', summaryStats.leaveDays],
            ['Half Days', summaryStats.halfDays],
            ['Late Arrivals', summaryStats.lateArrivals],
            ['Early Departures', summaryStats.earlyDepartures],
            ['Total Hours Worked', summaryStats.totalHours.toFixed(2)],
            ['Attendance Rate (%)', summaryStats.attendanceRate]
        ];

        summarySheet.addTable({
            name: 'SummaryTable',
            ref: 'A6',
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

        // Detailed Data Sheet
        if (options.includeDetails && attendanceData.length > 0) {
            const detailSheet = workbook.addWorksheet('Detailed Records');
            
            detailSheet.columns = [
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Punch In', key: 'punchIn', width: 12 },
                { header: 'Punch Out', key: 'punchOut', width: 12 },
                { header: 'Hours Worked', key: 'hoursWorked', width: 12 },
                { header: 'Late', key: 'isLate', width: 8 },
                { header: 'Early Departure', key: 'earlyDeparture', width: 15 },
                { header: 'Job Title', key: 'jobTitle', width: 15 },
                { header: 'Shift', key: 'shift', width: 12 }
            ];

            attendanceData.forEach(record => {
                detailSheet.addRow({
                    employeeName: `${record.first_name} ${record.last_name}`,
                    date: new Date(record.attendance_date).toLocaleDateString(),
                    status: record.attendance_status,
                    punchIn: record.punch_in ? new Date(record.punch_in).toLocaleTimeString() : 'N/A',
                    punchOut: record.punch_out ? new Date(record.punch_out).toLocaleTimeString() : 'N/A',
                    hoursWorked: record.hours_worked || 0,
                    isLate: record.is_late ? 'Yes' : 'No',
                    earlyDeparture: record.is_early_departure ? 'Yes' : 'No',
                    jobTitle: record.job_title || 'N/A',
                    shift: record.shift_name
                });
            });

            // Style the header
            detailSheet.getRow(1).font = { bold: true };
            detailSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `attendance_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateMonthlyAttendancePDF(monthlyData, summaryData) {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `monthly_attendance_${summaryData.year}_${summaryData.month}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('MONTHLY ATTENDANCE SUMMARY', { align: 'center' });
        doc.fontSize(12).text(`Month: ${summaryData.month}/${summaryData.year}`, { align: 'center' });
        doc.text(`Working Days: ${summaryData.workingDays}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Overall Summary
        doc.fontSize(16).text('Overall Statistics', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Employees: ${summaryData.totalEmployees}`);
        doc.text(`Average Attendance Rate: ${summaryData.avgAttendanceRate.toFixed(2)}%`);
        doc.moveDown();

        // Employee-wise data
        doc.fontSize(14).text('Employee-wise Summary', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        monthlyData.forEach((employee, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const attendanceRate = summaryData.workingDays > 0 ? 
                ((employee.present_days + employee.half_days * 0.5) / summaryData.workingDays * 100).toFixed(2) : 0;

            doc.text(`${index + 1}. ${employee.first_name} ${employee.last_name}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Present: ${employee.present_days} | Absent: ${employee.absent_days} | Leave: ${employee.leave_days} | Half-Day: ${employee.half_days}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Late: ${employee.late_arrivals} | Early: ${employee.early_departures} | Total Hours: ${(employee.total_hours_worked || 0).toFixed(2)}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Attendance Rate: ${attendanceRate}%`, 70, yPosition);
            yPosition += 20;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateMonthlyAttendanceExcel(monthlyData, summaryData) {
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Monthly Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'MONTHLY ATTENDANCE SUMMARY';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Month:';
        summarySheet.getCell('B3').value = `${summaryData.month}/${summaryData.year}`;
        
        summarySheet.getCell('A4').value = 'Working Days:';
        summarySheet.getCell('B4').value = summaryData.workingDays;

        summarySheet.getCell('A5').value = 'Total Employees:';
        summarySheet.getCell('B5').value = summaryData.totalEmployees;

        summarySheet.getCell('A6').value = 'Avg Attendance Rate:';
        summarySheet.getCell('B6').value = `${summaryData.avgAttendanceRate.toFixed(2)}%`;

        // Employee Details Sheet
        const detailSheet = workbook.addWorksheet('Employee Details');
        
        detailSheet.columns = [
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Job Title', key: 'jobTitle', width: 15 },
            { header: 'Present Days', key: 'presentDays', width: 12 },
            { header: 'Absent Days', key: 'absentDays', width: 12 },
            { header: 'Leave Days', key: 'leaveDays', width: 12 },
            { header: 'Half Days', key: 'halfDays', width: 10 },
            { header: 'Late Arrivals', key: 'lateArrivals', width: 12 },
            { header: 'Early Departures', key: 'earlyDepartures', width: 15 },
            { header: 'Total Hours', key: 'totalHours', width: 12 },
            { header: 'Avg Hours/Day', key: 'avgHours', width: 12 },
            { header: 'Attendance Rate (%)', key: 'attendanceRate', width: 18 }
        ];

        monthlyData.forEach(employee => {
            const attendanceRate = summaryData.workingDays > 0 ? 
                ((employee.present_days + employee.half_days * 0.5) / summaryData.workingDays * 100).toFixed(2) : 0;

            detailSheet.addRow({
                employeeName: `${employee.first_name} ${employee.last_name}`,
                email: employee.email,
                jobTitle: employee.job_title || 'N/A',
                presentDays: employee.present_days,
                absentDays: employee.absent_days,
                leaveDays: employee.leave_days,
                halfDays: employee.half_days,
                lateArrivals: employee.late_arrivals,
                earlyDepartures: employee.early_departures,
                totalHours: (employee.total_hours_worked || 0).toFixed(2),
                avgHours: (employee.avg_hours_per_day || 0).toFixed(2),
                attendanceRate: attendanceRate
            });
        });

        // Style the header
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `monthly_attendance_${summaryData.year}_${summaryData.month}_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateEmployeeAttendancePDF(reportData) {
        const { employee, attendanceRecords, overtimeRecords, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `employee_attendance_${employee.id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('EMPLOYEE ATTENDANCE REPORT', { align: 'center' });
        doc.moveDown();

        // Employee Information
        doc.fontSize(16).text('Employee Information', { underline: true });
        doc.fontSize(10);
        doc.text(`Name: ${employee.first_name} ${employee.last_name}`);
        doc.text(`Email: ${employee.email}`);
        doc.text(`Job Title: ${employee.job_title || 'N/A'}`);
        doc.text(`Shift: ${employee.shift_name}`);
        doc.text(`Report Period: ${period.startDate} to ${period.endDate}`);
        doc.moveDown();

        // Summary Statistics
        doc.fontSize(16).text('Attendance Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Days: ${summary.totalDays}`);
        doc.text(`Present Days: ${summary.presentDays}`);
        doc.text(`Absent Days: ${summary.absentDays}`);
        doc.text(`Leave Days: ${summary.leaveDays}`);
        doc.text(`Half Days: ${summary.halfDays}`);
        doc.text(`Late Arrivals: ${summary.lateArrivals}`);
        doc.text(`Early Departures: ${summary.earlyDepartures}`);
        doc.text(`Total Hours Worked: ${summary.totalHours.toFixed(2)}`);
        doc.text(`Total Overtime Hours: ${summary.totalOvertime.toFixed(2)}`);
        doc.text(`Average Hours/Day: ${summary.avgHoursPerDay}`);
        doc.text(`Attendance Rate: ${summary.attendanceRate}%`);
        doc.moveDown();

        // Detailed Records
        if (attendanceRecords.length > 0) {
            doc.fontSize(14).text('Daily Attendance Records', { underline: true });
            doc.fontSize(8);

            let yPosition = doc.y + 10;

            attendanceRecords.forEach(record => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const dateStr = new Date(record.attendance_date).toLocaleDateString();
                const punchIn = record.punch_in ? new Date(record.punch_in).toLocaleTimeString() : 'N/A';
                const punchOut = record.punch_out ? new Date(record.punch_out).toLocaleTimeString() : 'N/A';
                const hoursWorked = record.hours_worked || 0;
                
                doc.text(`${dateStr} | ${record.attendance_status} | In: ${punchIn} | Out: ${punchOut} | Hours: ${hoursWorked}`, 50, yPosition);
                
                if (record.is_late || record.is_early_departure) {
                    yPosition += 12;
                    const flags = [];
                    if (record.is_late) flags.push('Late');
                    if (record.is_early_departure) flags.push('Early Departure');
                    doc.fillColor('red').text(`  Flags: ${flags.join(', ')}`, 50, yPosition);
                    doc.fillColor('black');
                }
                
                yPosition += 15;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateEmployeeAttendanceExcel(reportData) {
        const { employee, attendanceRecords, overtimeRecords, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Employee Info Sheet
        const infoSheet = workbook.addWorksheet('Employee Info');
        
        infoSheet.mergeCells('A1:B1');
        infoSheet.getCell('A1').value = 'EMPLOYEE ATTENDANCE REPORT';
        infoSheet.getCell('A1').font = { bold: true, size: 16 };
        infoSheet.getCell('A1').alignment = { horizontal: 'center' };

        const employeeInfo = [
            ['Employee Name', `${employee.first_name} ${employee.last_name}`],
            ['Email', employee.email],
            ['Job Title', employee.job_title || 'N/A'],
            ['Shift', employee.shift_name],
            ['Report Period', `${period.startDate} to ${period.endDate}`],
            ['', ''],
            ['SUMMARY', ''],
            ['Total Days', summary.totalDays],
            ['Present Days', summary.presentDays],
            ['Absent Days', summary.absentDays],
            ['Leave Days', summary.leaveDays],
            ['Half Days', summary.halfDays],
            ['Late Arrivals', summary.lateArrivals],
            ['Early Departures', summary.earlyDepartures],
            ['Total Hours Worked', summary.totalHours.toFixed(2)],
            ['Total Overtime Hours', summary.totalOvertime.toFixed(2)],
            ['Average Hours/Day', summary.avgHoursPerDay],
            ['Attendance Rate (%)', summary.attendanceRate]
        ];

        employeeInfo.forEach((row, index) => {
            infoSheet.getCell(`A${index + 3}`).value = row[0];
            infoSheet.getCell(`B${index + 3}`).value = row[1];
            if (row[0] === 'SUMMARY') {
                infoSheet.getCell(`A${index + 3}`).font = { bold: true };
            }
        });

        // Attendance Records Sheet
        if (attendanceRecords.length > 0) {
            const recordsSheet = workbook.addWorksheet('Daily Records');
            
            recordsSheet.columns = [
                { header: 'Date', key: 'date', width: 12 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'Punch In', key: 'punchIn', width: 12 },
                { header: 'Punch Out', key: 'punchOut', width: 12 },
                { header: 'Hours Worked', key: 'hoursWorked', width: 12 },
                { header: 'Scheduled Hours', key: 'scheduledHours', width: 15 },
                { header: 'Late', key: 'isLate', width: 8 },
                { header: 'Early Departure', key: 'earlyDeparture', width: 15 },
                { header: 'Short Hours', key: 'shortHours', width: 12 }
            ];

            attendanceRecords.forEach(record => {
                recordsSheet.addRow({
                    date: new Date(record.attendance_date).toLocaleDateString(),
                    status: record.attendance_status,
                    punchIn: record.punch_in ? new Date(record.punch_in).toLocaleTimeString() : 'N/A',
                    punchOut: record.punch_out ? new Date(record.punch_out).toLocaleTimeString() : 'N/A',
                    hoursWorked: record.hours_worked || 0,
                    scheduledHours: record.scheduled_hours || 0,
                    isLate: record.is_late ? 'Yes' : 'No',
                    earlyDeparture: record.is_early_departure ? 'Yes' : 'No',
                    shortHours: record.short_hours || 0
                });
            });

            // Style the header
            recordsSheet.getRow(1).font = { bold: true };
            recordsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `employee_attendance_${employee.id}_${Date.now()}.xlsx`;
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

module.exports = new AttendanceReportsController();