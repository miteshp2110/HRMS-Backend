
const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class AuditReportsController {

    /**
     * Generate user audit trail report
     */
    async generateUserAuditReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                userIds,
                changedBy,
                format = 'pdf'
            } = req.body;

            // Build user audit query
            let query = `
                SELECT 
                    ua.*,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name,
                    u.email as user_email,
                    u.employee_id as user_employee_id,
                    changer.first_name as changer_first_name,
                    changer.last_name as changer_last_name,
                    changer.email as changer_email,
                    changer.employee_id as changer_employee_id,
                    j.title as user_job_title,
                    changer_job.title as changer_job_title
                FROM user_audit ua
                LEFT JOIN user u ON ua.user_id = u.id
                LEFT JOIN user changer ON ua.changed_by = changer.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN jobs changer_job ON changer.job_role = changer_job.id
                WHERE ua.change_date BETWEEN ? AND ?
            `;

            let params = [startDate, endDate];

            if (userIds && userIds.length > 0) {
                query += ` AND ua.user_id IN (${userIds.map(() => '?').join(',')})`;
                params.push(...userIds);
            }

            if (changedBy && changedBy.length > 0) {
                query += ` AND ua.changed_by IN (${changedBy.map(() => '?').join(',')})`;
                params.push(...changedBy);
            }

            query += ` ORDER BY ua.change_date DESC, ua.id DESC`;

            const [auditRecords] = await db.execute(query, params);

            // Get change type summary
            const changeTypeSummary = this.calculateChangeTypeSummary(auditRecords);

            // Get user activity summary
            const userActivitySummary = this.calculateUserActivitySummary(auditRecords);

            // Get admin activity summary
            const adminActivitySummary = this.calculateAdminActivitySummary(auditRecords);

            const summary = {
                totalRecords: auditRecords.length,
                uniqueUsersAffected: new Set(auditRecords.map(r => r.user_id).filter(Boolean)).size,
                uniqueAdminsInvolved: new Set(auditRecords.map(r => r.changed_by).filter(Boolean)).size,
                dateRange: { startDate, endDate },
                changeTypes: changeTypeSummary,
                topAffectedUsers: userActivitySummary.slice(0, 10),
                topAdmins: adminActivitySummary.slice(0, 10)
            };

            const reportData = {
                auditRecords,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateUserAuditPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'User audit report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateUserAuditExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'User audit report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating user audit report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate user audit report',
                error: error.message
            });
        }
    }

    /**
     * Generate attendance audit trail report
     */
    async generateAttendanceAuditReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                format = 'pdf'
            } = req.body;

            // Build attendance audit query
            let query = `
                SELECT 
                    aal.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    changer.first_name as changer_first_name,
                    changer.last_name as changer_last_name,
                    changer.email as changer_email,
                    ar.attendance_date,
                    ar.punch_in as current_punch_in,
                    ar.punch_out as current_punch_out,
                    ar.attendance_status as current_status
                FROM attendance_audit_log aal
                JOIN user u ON aal.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN user changer ON aal.changed_by = changer.id
                LEFT JOIN attendance_record ar ON aal.attendance_record_id = ar.id
                WHERE aal.change_date BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND aal.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            query += ` ORDER BY aal.change_date DESC, u.first_name`;

            const [attendanceAudit] = await db.execute(query, params);

            // Get change type summary for attendance
            const changeTypeSummary = this.calculateAttendanceChangeTypeSummary(attendanceAudit);

            // Get employee activity summary
            const employeeActivitySummary = this.calculateEmployeeActivitySummary(attendanceAudit);

            // Get admin activity summary for attendance changes
            const adminActivitySummary = this.calculateAttendanceAdminActivitySummary(attendanceAudit);

            const summary = {
                totalRecords: attendanceAudit.length,
                uniqueEmployeesAffected: new Set(attendanceAudit.map(r => r.employee_id)).size,
                uniqueAdminsInvolved: new Set(attendanceAudit.map(r => r.changed_by).filter(Boolean)).size,
                dateRange: { startDate, endDate },
                changeTypes: changeTypeSummary,
                topAffectedEmployees: employeeActivitySummary.slice(0, 10),
                topAdmins: adminActivitySummary.slice(0, 10)
            };

            const reportData = {
                attendanceAudit,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateAttendanceAuditPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Attendance audit report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateAttendanceAuditExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Attendance audit report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating attendance audit report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate attendance audit report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateChangeTypeSummary(auditRecords) {
        const changeTypes = {};
        auditRecords.forEach(record => {
            const changeType = record.change_type || 'Unknown';
            if (!changeTypes[changeType]) {
                changeTypes[changeType] = {
                    count: 0,
                    uniqueUsers: new Set()
                };
            }
            changeTypes[changeType].count++;
            if (record.user_id) {
                changeTypes[changeType].uniqueUsers.add(record.user_id);
            }
        });

        // Convert sets to counts
        Object.keys(changeTypes).forEach(type => {
            changeTypes[type].uniqueUsersCount = changeTypes[type].uniqueUsers.size;
            delete changeTypes[type].uniqueUsers;
        });

        return changeTypes;
    }

    calculateUserActivitySummary(auditRecords) {
        const userActivity = {};
        auditRecords.forEach(record => {
            if (record.user_id) {
                const userId = record.user_id;
                if (!userActivity[userId]) {
                    userActivity[userId] = {
                        user_id: userId,
                        user_name: `${record.user_first_name || ''} ${record.user_last_name || ''}`.trim() || 'Unknown',
                        employee_id: record.user_employee_id || 'N/A',
                        changes: 0,
                        change_types: new Set()
                    };
                }
                userActivity[userId].changes++;
                userActivity[userId].change_types.add(record.change_type || 'Unknown');
            }
        });

        // Convert to array and sort by changes count
        return Object.values(userActivity)
            .map(user => ({
                ...user,
                change_types_count: user.change_types.size,
                change_types: Array.from(user.change_types).join(', ')
            }))
            .sort((a, b) => b.changes - a.changes);
    }

    calculateAdminActivitySummary(auditRecords) {
        const adminActivity = {};
        auditRecords.forEach(record => {
            if (record.changed_by) {
                const adminId = record.changed_by;
                if (!adminActivity[adminId]) {
                    adminActivity[adminId] = {
                        admin_id: adminId,
                        admin_name: `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'Unknown',
                        employee_id: record.changer_employee_id || 'N/A',
                        changes_made: 0,
                        users_affected: new Set()
                    };
                }
                adminActivity[adminId].changes_made++;
                if (record.user_id) {
                    adminActivity[adminId].users_affected.add(record.user_id);
                }
            }
        });

        // Convert to array and sort by changes made
        return Object.values(adminActivity)
            .map(admin => ({
                ...admin,
                users_affected_count: admin.users_affected.size
            }))
            .sort((a, b) => b.changes_made - a.changes_made);
    }

    calculateAttendanceChangeTypeSummary(attendanceAudit) {
        const changeTypes = {};
        attendanceAudit.forEach(record => {
            const changeType = record.change_type || 'Unknown';
            if (!changeTypes[changeType]) {
                changeTypes[changeType] = {
                    count: 0,
                    uniqueEmployees: new Set()
                };
            }
            changeTypes[changeType].count++;
            changeTypes[changeType].uniqueEmployees.add(record.employee_id);
        });

        // Convert sets to counts
        Object.keys(changeTypes).forEach(type => {
            changeTypes[type].uniqueEmployeesCount = changeTypes[type].uniqueEmployees.size;
            delete changeTypes[type].uniqueEmployees;
        });

        return changeTypes;
    }

    calculateEmployeeActivitySummary(attendanceAudit) {
        const employeeActivity = {};
        attendanceAudit.forEach(record => {
            const employeeId = record.employee_id;
            if (!employeeActivity[employeeId]) {
                employeeActivity[employeeId] = {
                    employee_id: employeeId,
                    employee_name: `${record.first_name} ${record.last_name}`,
                    emp_id: record.employee_id,
                    changes: 0,
                    change_types: new Set()
                };
            }
            employeeActivity[employeeId].changes++;
            employeeActivity[employeeId].change_types.add(record.change_type || 'Unknown');
        });

        // Convert to array and sort by changes count
        return Object.values(employeeActivity)
            .map(emp => ({
                ...emp,
                change_types_count: emp.change_types.size,
                change_types: Array.from(emp.change_types).join(', ')
            }))
            .sort((a, b) => b.changes - a.changes);
    }

    calculateAttendanceAdminActivitySummary(attendanceAudit) {
        const adminActivity = {};
        attendanceAudit.forEach(record => {
            if (record.changed_by) {
                const adminId = record.changed_by;
                if (!adminActivity[adminId]) {
                    adminActivity[adminId] = {
                        admin_id: adminId,
                        admin_name: `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'Unknown',
                        admin_email: record.changer_email || 'N/A',
                        changes_made: 0,
                        employees_affected: new Set()
                    };
                }
                adminActivity[adminId].changes_made++;
                adminActivity[adminId].employees_affected.add(record.employee_id);
            }
        });

        // Convert to array and sort by changes made
        return Object.values(adminActivity)
            .map(admin => ({
                ...admin,
                employees_affected_count: admin.employees_affected.size
            }))
            .sort((a, b) => b.changes_made - a.changes_made);
    }

    async generateUserAuditPDF(reportData) {
        const { auditRecords, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `user_audit_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('USER AUDIT TRAIL REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Audit Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Audit Records: ${summary.totalRecords}`);
        doc.text(`Unique Users Affected: ${summary.uniqueUsersAffected}`);
        doc.text(`Unique Admins Involved: ${summary.uniqueAdminsInvolved}`);
        doc.moveDown();

        // Change Types Breakdown
        doc.fontSize(14).text('Change Types Breakdown', { underline: true });
        doc.fontSize(8);
        let yPosition = doc.y + 10;

        Object.keys(summary.changeTypes).forEach((changeType, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const typeData = summary.changeTypes[changeType];
            doc.text(`${index + 1}. ${changeType}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Changes: ${typeData.count} | Users Affected: ${typeData.uniqueUsersCount}`, 70, yPosition);
            yPosition += 20;
        });

        // Top Affected Users
        if (summary.topAffectedUsers.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Top Affected Users', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            summary.topAffectedUsers.forEach((user, index) => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`${index + 1}. ${user.user_name} (${user.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Changes: ${user.changes} | Change Types: ${user.change_types_count}`, 70, yPosition);
                yPosition += 18;
            });
        }

        // Top Admins
        if (summary.topAdmins.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Most Active Admins', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            summary.topAdmins.forEach((admin, index) => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`${index + 1}. ${admin.admin_name} (${admin.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Changes Made: ${admin.changes_made} | Users Affected: ${admin.users_affected_count}`, 70, yPosition);
                yPosition += 18;
            });
        }

        // Recent Audit Records
        if (auditRecords.length > 0) {
            if (yPosition > 500) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Recent Audit Records', { underline: true });
            doc.fontSize(7);
            yPosition = doc.y + 10;

            auditRecords.slice(0, 30).forEach((record, index) => { // Show latest 30
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const changeDate = new Date(record.change_date).toLocaleString();
                const userName = `${record.user_first_name || ''} ${record.user_last_name || ''}`.trim() || 'Unknown User';
                const changerName = `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'System';

                doc.text(`${index + 1}. ${record.change_type || 'Unknown Change'} - ${userName}`, 50, yPosition);
                yPosition += 10;
                doc.text(`   Changed by: ${changerName} | Date: ${changeDate}`, 70, yPosition);
                yPosition += 10;
                
                if (record.old_value || record.new_value) {
                    const oldVal = (record.old_value || 'N/A').length > 30 ? 
                        (record.old_value || 'N/A').substring(0, 30) + '...' : (record.old_value || 'N/A');
                    const newVal = (record.new_value || 'N/A').length > 30 ? 
                        (record.new_value || 'N/A').substring(0, 30) + '...' : (record.new_value || 'N/A');
                    doc.text(`   Old: ${oldVal} → New: ${newVal}`, 70, yPosition);
                    yPosition += 10;
                }
                
                if (record.reason) {
                    const reason = record.reason.length > 50 ? record.reason.substring(0, 50) + '...' : record.reason;
                    doc.text(`   Reason: ${reason}`, 70, yPosition);
                    yPosition += 10;
                }
                
                yPosition += 8;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateUserAuditExcel(reportData) {
        const { auditRecords, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Audit Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'USER AUDIT TRAIL REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Audit Records', summary.totalRecords],
            ['Unique Users Affected', summary.uniqueUsersAffected],
            ['Unique Admins Involved', summary.uniqueAdminsInvolved]
        ];

        summarySheet.addTable({
            name: 'AuditSummary',
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

        // Audit Records Sheet
        const auditSheet = workbook.addWorksheet('Audit Records');
        
        auditSheet.columns = [
            { header: 'Change Date', key: 'changeDate', width: 18 },
            { header: 'Change Type', key: 'changeType', width: 20 },
            { header: 'User Affected', key: 'userAffected', width: 25 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Field Changed', key: 'fieldChanged', width: 20 },
            { header: 'Old Value', key: 'oldValue', width: 25 },
            { header: 'New Value', key: 'newValue', width: 25 },
            { header: 'Changed By', key: 'changedBy', width: 25 },
            { header: 'Changer Email', key: 'changerEmail', width: 25 },
            { header: 'Reason', key: 'reason', width: 30 },
            { header: 'IP Address', key: 'ipAddress', width: 15 }
        ];

        auditRecords.forEach(record => {
            auditSheet.addRow({
                changeDate: new Date(record.change_date).toLocaleString(),
                changeType: record.change_type || 'Unknown',
                userAffected: `${record.user_first_name || ''} ${record.user_last_name || ''}`.trim() || 'Unknown User',
                employeeId: record.user_employee_id || 'N/A',
                fieldChanged: record.field_name || 'N/A',
                oldValue: record.old_value || 'N/A',
                newValue: record.new_value || 'N/A',
                changedBy: `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'System',
                changerEmail: record.changer_email || 'N/A',
                reason: record.reason || 'N/A',
                ipAddress: record.ip_address || 'N/A'
            });
        });

        // Style headers
        auditSheet.getRow(1).font = { bold: true };
        auditSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `user_audit_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateAttendanceAuditPDF(reportData) {
        const { attendanceAudit, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `attendance_audit_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('ATTENDANCE AUDIT TRAIL REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Attendance Audit Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Audit Records: ${summary.totalRecords}`);
        doc.text(`Unique Employees Affected: ${summary.uniqueEmployeesAffected}`);
        doc.text(`Unique Admins Involved: ${summary.uniqueAdminsInvolved}`);
        doc.moveDown();

        // Change Types Breakdown
        doc.fontSize(14).text('Change Types Breakdown', { underline: true });
        doc.fontSize(8);
        let yPosition = doc.y + 10;

        Object.keys(summary.changeTypes).forEach((changeType, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const typeData = summary.changeTypes[changeType];
            doc.text(`${index + 1}. ${changeType}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Changes: ${typeData.count} | Employees Affected: ${typeData.uniqueEmployeesCount}`, 70, yPosition);
            yPosition += 20;
        });

        // Recent Attendance Changes
        if (attendanceAudit.length > 0) {
            if (yPosition > 500) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Recent Attendance Changes', { underline: true });
            doc.fontSize(7);
            yPosition = doc.y + 10;

            attendanceAudit.slice(0, 40).forEach((record, index) => { // Show latest 40
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const changeDate = new Date(record.change_date).toLocaleString();
                const attendanceDate = record.attendance_date ? new Date(record.attendance_date).toLocaleDateString() : 'N/A';
                const changerName = `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'System';

                doc.text(`${index + 1}. ${record.change_type || 'Unknown Change'} - ${record.first_name} ${record.last_name}`, 50, yPosition);
                yPosition += 10;
                doc.text(`   Attendance Date: ${attendanceDate} | Changed: ${changeDate}`, 70, yPosition);
                yPosition += 10;
                doc.text(`   Changed by: ${changerName}`, 70, yPosition);
                yPosition += 10;
                
                if (record.old_value || record.new_value) {
                    const oldVal = (record.old_value || 'N/A').length > 25 ? 
                        (record.old_value || 'N/A').substring(0, 25) + '...' : (record.old_value || 'N/A');
                    const newVal = (record.new_value || 'N/A').length > 25 ? 
                        (record.new_value || 'N/A').substring(0, 25) + '...' : (record.new_value || 'N/A');
                    doc.text(`   Old: ${oldVal} → New: ${newVal}`, 70, yPosition);
                    yPosition += 10;
                }
                
                if (record.reason) {
                    const reason = record.reason.length > 40 ? record.reason.substring(0, 40) + '...' : record.reason;
                    doc.text(`   Reason: ${reason}`, 70, yPosition);
                    yPosition += 10;
                }
                
                yPosition += 8;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateAttendanceAuditExcel(reportData) {
        const { attendanceAudit, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Audit Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'ATTENDANCE AUDIT TRAIL REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Audit Records', summary.totalRecords],
            ['Unique Employees Affected', summary.uniqueEmployeesAffected],
            ['Unique Admins Involved', summary.uniqueAdminsInvolved]
        ];

        summarySheet.addTable({
            name: 'AttendanceAuditSummary',
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

        // Attendance Audit Records Sheet
        const auditSheet = workbook.addWorksheet('Attendance Audit Records');
        
        auditSheet.columns = [
            { header: 'Change Date', key: 'changeDate', width: 18 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 25 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Attendance Date', key: 'attendanceDate', width: 15 },
            { header: 'Change Type', key: 'changeType', width: 20 },
            { header: 'Field Changed', key: 'fieldChanged', width: 20 },
            { header: 'Old Value', key: 'oldValue', width: 25 },
            { header: 'New Value', key: 'newValue', width: 25 },
            { header: 'Changed By', key: 'changedBy', width: 25 },
            { header: 'Reason', key: 'reason', width: 30 }
        ];

        attendanceAudit.forEach(record => {
            auditSheet.addRow({
                changeDate: new Date(record.change_date).toLocaleString(),
                employeeId: record.employee_id,
                employeeName: `${record.first_name} ${record.last_name}`,
                jobTitle: record.job_title || 'N/A',
                attendanceDate: record.attendance_date ? new Date(record.attendance_date).toLocaleDateString() : 'N/A',
                changeType: record.change_type || 'Unknown',
                fieldChanged: record.field_name || 'N/A',
                oldValue: record.old_value || 'N/A',
                newValue: record.new_value || 'N/A',
                changedBy: `${record.changer_first_name || ''} ${record.changer_last_name || ''}`.trim() || 'System',
                reason: record.reason || 'N/A'
            });
        });

        // Style headers
        auditSheet.getRow(1).font = { bold: true };
        auditSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `attendance_audit_report_${Date.now()}.xlsx`;
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

module.exports = new AuditReportsController();
