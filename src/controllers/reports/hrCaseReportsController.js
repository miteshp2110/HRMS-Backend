
const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class HRCaseReportsController {

    /**
     * Generate comprehensive HR case report
     */
    async generateHRCaseReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                categoryIds,
                status,
                format = 'pdf',
                includeAttachments = false
            } = req.body;

            // Build HR cases query
            let query = `
                SELECT 
                    hc.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    cat.name as category_name,
                    cat.code as category_code,
                    approver.first_name as approver_first_name,
                    approver.last_name as approver_last_name,
                    closer.first_name as closer_first_name,
                    closer.last_name as closer_last_name
                FROM hr_cases hc
                JOIN user u ON hc.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN hr_case_categories cat ON hc.category_id = cat.id
                LEFT JOIN user approver ON hc.approved_by = approver.id
                LEFT JOIN user closer ON hc.closed_by = closer.id
                WHERE hc.created_on BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND hc.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            if (categoryIds && categoryIds.length > 0) {
                query += ` AND hc.category_id IN (${categoryIds.map(() => '?').join(',')})`;
                params.push(...categoryIds);
            }

            if (status && status.length > 0) {
                query += ` AND hc.status IN (${status.map(() => '?').join(',')})`;
                params.push(...status);
            }

            query += ` ORDER BY hc.created_on DESC, u.first_name`;

            const [casesData] = await db.execute(query, params);

            // Get attachments if requested
            let attachments = [];
            if (includeAttachments && casesData.length > 0) {
                const caseIds = casesData.map(c => c.id);
                const attachQuery = `
                    SELECT 
                        hca.*,
                        hc.case_number
                    FROM hr_case_attachments hca
                    JOIN hr_cases hc ON hca.case_id = hc.id
                    WHERE hca.case_id IN (${caseIds.map(() => '?').join(',')})
                    ORDER BY hca.uploaded_on DESC
                `;
                const [attachmentsResult] = await db.execute(attachQuery, caseIds);
                attachments = attachmentsResult;
            }

            // Get case comments for additional context
            let comments = [];
            if (casesData.length > 0) {
                const caseIds = casesData.map(c => c.id);
                const commentsQuery = `
                    SELECT 
                        hcc.*,
                        u.first_name as commenter_first_name,
                        u.last_name as commenter_last_name,
                        hc.case_number
                    FROM hr_case_comments hcc
                    JOIN hr_cases hc ON hcc.case_id = hc.id
                    JOIN user u ON hcc.commented_by = u.id
                    WHERE hcc.case_id IN (${caseIds.map(() => '?').join(',')})
                    ORDER BY hcc.commented_on DESC
                `;
                const [commentsResult] = await db.execute(commentsQuery, caseIds);
                comments = commentsResult;
            }

            // Calculate summary statistics
            const summary = this.calculateCaseSummary(casesData, attachments, comments);

            const reportData = {
                casesData,
                attachments,
                comments,
                summary,
                includeAttachments,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateCasesPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'HR cases report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateCasesExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'HR cases report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating HR cases report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate HR cases report',
                error: error.message
            });
        }
    }

    /**
     * Generate HR case summary report with trends and analytics
     */
    async generateCaseSummaryReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                format = 'pdf',
                includeTrends = true
            } = req.body;

            // Get case summary data
            const summaryQuery = `
                SELECT 
                    hc.status,
                    cat.name as category_name,
                    DATE_FORMAT(hc.created_on, '%Y-%m') as month_year,
                    COUNT(*) as case_count,
                    AVG(DATEDIFF(COALESCE(hc.closed_on, CURDATE()), hc.created_on)) as avg_resolution_days
                FROM hr_cases hc
                LEFT JOIN hr_case_categories cat ON hc.category_id = cat.id
                WHERE hc.created_on BETWEEN ? AND ?
                GROUP BY hc.status, cat.name, DATE_FORMAT(hc.created_on, '%Y-%m')
                ORDER BY month_year DESC, category_name
            `;
            const [summaryData] = await db.execute(summaryQuery, [startDate, endDate]);

            // Get overall statistics
            const overallQuery = `
                SELECT 
                    COUNT(*) as total_cases,
                    COUNT(CASE WHEN status = 'Open' THEN 1 END) as open_cases,
                    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress_cases,
                    COUNT(CASE WHEN status = 'Resolved' THEN 1 END) as resolved_cases,
                    COUNT(CASE WHEN status = 'Closed' THEN 1 END) as closed_cases,
                    AVG(DATEDIFF(COALESCE(closed_on, CURDATE()), created_on)) as avg_resolution_time,
                    COUNT(DISTINCT employee_id) as unique_employees_affected
                FROM hr_cases
                WHERE created_on BETWEEN ? AND ?
            `;
            const [overallStats] = await db.execute(overallQuery, [startDate, endDate]);

            // Get category breakdown
            const categoryQuery = `
                SELECT 
                    cat.name as category_name,
                    COUNT(hc.id) as case_count,
                    COUNT(CASE WHEN hc.status = 'Resolved' THEN 1 END) as resolved_count,
                    AVG(DATEDIFF(COALESCE(hc.closed_on, CURDATE()), hc.created_on)) as avg_days
                FROM hr_case_categories cat
                LEFT JOIN hr_cases hc ON cat.id = hc.category_id 
                    AND hc.created_on BETWEEN ? AND ?
                GROUP BY cat.id, cat.name
                HAVING case_count > 0
                ORDER BY case_count DESC
            `;
            const [categoryBreakdown] = await db.execute(categoryQuery, [startDate, endDate]);

            // Get trends data if requested
            let trendsData = [];
            if (includeTrends) {
                const trendsQuery = `
                    SELECT 
                        DATE_FORMAT(created_on, '%Y-%m') as month_year,
                        COUNT(*) as total_cases,
                        COUNT(CASE WHEN status = 'Resolved' THEN 1 END) as resolved_cases,
                        AVG(DATEDIFF(COALESCE(closed_on, CURDATE()), created_on)) as avg_resolution_days
                    FROM hr_cases
                    WHERE created_on BETWEEN ? AND ?
                    GROUP BY DATE_FORMAT(created_on, '%Y-%m')
                    ORDER BY month_year
                `;
                const [trends] = await db.execute(trendsQuery, [startDate, endDate]);
                trendsData = trends;
            }

            const summary = this.calculateSummaryStats(overallStats[0], categoryBreakdown, trendsData);

            const reportData = {
                summaryData,
                overallStats: overallStats[0],
                categoryBreakdown,
                trendsData,
                summary,
                includeTrends,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateSummaryPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'HR cases summary report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateSummaryExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'HR cases summary report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating HR cases summary report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate HR cases summary report',
                error: error.message
            });
        }
    }

    /**
     * Generate deduction analysis report for HR cases
     */
    async generateDeductionAnalysisReport(req, res) {
        try {
            const { startDate, endDate, format = 'pdf' } = req.body;

            // Get HR case deductions
            const deductionsQuery = `
                SELECT 
                    hcd.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    hc.case_number,
                    hc.title as case_title,
                    cat.name as category_name
                FROM hr_case_deductions hcd
                JOIN user u ON hcd.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN hr_cases hc ON hcd.case_id = hc.id
                LEFT JOIN hr_case_categories cat ON hc.category_id = cat.id
                WHERE hcd.created_on BETWEEN ? AND ?
                ORDER BY hcd.created_on DESC, u.first_name
            `;
            const [deductions] = await db.execute(deductionsQuery, [startDate, endDate]);

            // Get summary by category and employee
            const summaryQuery = `
                SELECT 
                    cat.name as category_name,
                    COUNT(hcd.id) as deduction_count,
                    SUM(hcd.amount) as total_amount,
                    AVG(hcd.amount) as avg_amount,
                    COUNT(DISTINCT hcd.employee_id) as affected_employees
                FROM hr_case_deductions hcd
                JOIN hr_cases hc ON hcd.case_id = hc.id
                LEFT JOIN hr_case_categories cat ON hc.category_id = cat.id
                WHERE hcd.created_on BETWEEN ? AND ?
                GROUP BY cat.id, cat.name
                ORDER BY total_amount DESC
            `;
            const [categorySummary] = await db.execute(summaryQuery, [startDate, endDate]);

            // Get employee-wise deductions
            const employeeSummaryQuery = `
                SELECT 
                    u.first_name,
                    u.last_name,
                    u.employee_id,
                    COUNT(hcd.id) as deduction_count,
                    SUM(hcd.amount) as total_deductions
                FROM hr_case_deductions hcd
                JOIN user u ON hcd.employee_id = u.id
                WHERE hcd.created_on BETWEEN ? AND ?
                GROUP BY u.id, u.first_name, u.last_name, u.employee_id
                ORDER BY total_deductions DESC
                LIMIT 20
            `;
            const [employeeSummary] = await db.execute(employeeSummaryQuery, [startDate, endDate]);

            const summary = this.calculateDeductionSummary(deductions, categorySummary, employeeSummary);

            const reportData = {
                deductions,
                categorySummary,
                employeeSummary,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateDeductionsPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Deduction analysis report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateDeductionsExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Deduction analysis report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating deduction analysis report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate deduction analysis report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateCaseSummary(casesData, attachments, comments) {
        const summary = {
            totalCases: casesData.length,
            openCases: casesData.filter(c => c.status === 'Open').length,
            inProgressCases: casesData.filter(c => c.status === 'In Progress').length,
            resolvedCases: casesData.filter(c => c.status === 'Resolved').length,
            closedCases: casesData.filter(c => c.status === 'Closed').length,
            totalAttachments: attachments.length,
            totalComments: comments.length,
            uniqueEmployees: new Set(casesData.map(c => c.employee_id)).size,
            categoriesInvolved: new Set(casesData.map(c => c.category_name).filter(Boolean)).size,
            avgResolutionTime: 0
        };

        // Calculate average resolution time for resolved/closed cases
        const resolvedCases = casesData.filter(c => c.status === 'Resolved' || c.status === 'Closed');
        if (resolvedCases.length > 0) {
            const totalDays = resolvedCases.reduce((sum, c) => {
                const createdDate = new Date(c.created_on);
                const closedDate = c.closed_on ? new Date(c.closed_on) : new Date();
                const diffDays = Math.ceil((closedDate - createdDate) / (1000 * 60 * 60 * 24));
                return sum + diffDays;
            }, 0);
            summary.avgResolutionTime = (totalDays / resolvedCases.length).toFixed(1);
        }

        return summary;
    }

    calculateSummaryStats(overallStats, categoryBreakdown, trendsData) {
        return {
            totalCases: overallStats.total_cases,
            resolutionRate: overallStats.total_cases > 0 ? 
                ((overallStats.resolved_cases + overallStats.closed_cases) / overallStats.total_cases * 100).toFixed(2) : 0,
            avgResolutionTime: parseFloat(overallStats.avg_resolution_time || 0).toFixed(1),
            uniqueEmployees: overallStats.unique_employees_affected,
            totalCategories: categoryBreakdown.length,
            mostCommonCategory: categoryBreakdown.length > 0 ? categoryBreakdown[0].category_name : 'N/A',
            trendDirection: this.calculateTrendDirection(trendsData)
        };
    }

    calculateDeductionSummary(deductions, categorySummary, employeeSummary) {
        const totalAmount = deductions.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
        const avgAmount = deductions.length > 0 ? totalAmount / deductions.length : 0;

        return {
            totalDeductions: deductions.length,
            totalAmount: totalAmount.toFixed(2),
            averageAmount: avgAmount.toFixed(2),
            uniqueEmployees: new Set(deductions.map(d => d.employee_id)).size,
            categoriesInvolved: categorySummary.length,
            highestCategory: categorySummary.length > 0 ? categorySummary[0] : null,
            topEmployee: employeeSummary.length > 0 ? employeeSummary[0] : null
        };
    }

    calculateTrendDirection(trendsData) {
        if (trendsData.length < 2) return 'Insufficient data';
        
        const firstMonth = trendsData[0].total_cases;
        const lastMonth = trendsData[trendsData.length - 1].total_cases;
        
        if (lastMonth > firstMonth) return 'Increasing';
        if (lastMonth < firstMonth) return 'Decreasing';
        return 'Stable';
    }

    async generateCasesPDF(reportData) {
        const { casesData, summary, period, includeAttachments, attachments, comments } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `hr_cases_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('HR CASES REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Cases Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Cases: ${summary.totalCases}`);
        doc.text(`Open: ${summary.openCases} | In Progress: ${summary.inProgressCases} | Resolved: ${summary.resolvedCases} | Closed: ${summary.closedCases}`);
        doc.text(`Unique Employees Affected: ${summary.uniqueEmployees}`);
        doc.text(`Categories Involved: ${summary.categoriesInvolved}`);
        doc.text(`Average Resolution Time: ${summary.avgResolutionTime} days`);
        
        if (includeAttachments) {
            doc.text(`Total Attachments: ${summary.totalAttachments}`);
        }
        
        doc.text(`Total Comments: ${summary.totalComments}`);
        doc.moveDown();

        // Individual Cases
        doc.fontSize(14).text('Case Details', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        casesData.forEach((hrCase, index) => {
            if (yPosition > 650) {
                doc.addPage();
                yPosition = 50;
            }

            const createdDate = new Date(hrCase.created_on).toLocaleDateString();
            const closedDate = hrCase.closed_on ? new Date(hrCase.closed_on).toLocaleDateString() : 'Not closed';

            doc.text(`${index + 1}. Case #${hrCase.case_number} - ${hrCase.title}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Employee: ${hrCase.first_name} ${hrCase.last_name} (${hrCase.employee_id})`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Category: ${hrCase.category_name || 'N/A'} | Status: ${hrCase.status}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Priority: ${hrCase.priority || 'N/A'} | Severity: ${hrCase.severity || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Created: ${createdDate} | Closed: ${closedDate}`, 70, yPosition);
            yPosition += 12;
            
            if (hrCase.description) {
                const description = hrCase.description.length > 100 ? 
                    hrCase.description.substring(0, 100) + '...' : hrCase.description;
                doc.text(`   Description: ${description}`, 70, yPosition);
                yPosition += 12;
            }

            if (hrCase.approver_first_name) {
                doc.text(`   Approved by: ${hrCase.approver_first_name} ${hrCase.approver_last_name}`, 70, yPosition);
                yPosition += 12;
            }

            // Show case comments count
            const caseComments = comments.filter(c => c.case_id === hrCase.id);
            if (caseComments.length > 0) {
                doc.text(`   Comments: ${caseComments.length}`, 70, yPosition);
                yPosition += 12;
            }

            yPosition += 15;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateCasesExcel(reportData) {
        const { casesData, summary, period, includeAttachments, attachments, comments } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Cases Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'HR CASES REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Cases', summary.totalCases],
            ['Open Cases', summary.openCases],
            ['In Progress Cases', summary.inProgressCases],
            ['Resolved Cases', summary.resolvedCases],
            ['Closed Cases', summary.closedCases],
            ['Unique Employees', summary.uniqueEmployees],
            ['Categories Involved', summary.categoriesInvolved],
            ['Avg Resolution Time (days)', summary.avgResolutionTime],
            ['Total Comments', summary.totalComments]
        ];

        if (includeAttachments) {
            summaryData.push(['Total Attachments', summary.totalAttachments]);
        }

        summarySheet.addTable({
            name: 'CasesSummary',
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

        // Cases Details Sheet
        const casesSheet = workbook.addWorksheet('Cases Details');
        
        casesSheet.columns = [
            { header: 'Case Number', key: 'caseNumber', width: 15 },
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Priority', key: 'priority', width: 12 },
            { header: 'Severity', key: 'severity', width: 12 },
            { header: 'Created On', key: 'createdOn', width: 12 },
            { header: 'Closed On', key: 'closedOn', width: 12 },
            { header: 'Approved By', key: 'approvedBy', width: 20 },
            { header: 'Description', key: 'description', width: 40 }
        ];

        casesData.forEach(hrCase => {
            casesSheet.addRow({
                caseNumber: hrCase.case_number,
                title: hrCase.title,
                employeeId: hrCase.employee_id,
                employeeName: `${hrCase.first_name} ${hrCase.last_name}`,
                jobTitle: hrCase.job_title || 'N/A',
                category: hrCase.category_name || 'N/A',
                status: hrCase.status,
                priority: hrCase.priority || 'N/A',
                severity: hrCase.severity || 'N/A',
                createdOn: new Date(hrCase.created_on).toLocaleDateString(),
                closedOn: hrCase.closed_on ? new Date(hrCase.closed_on).toLocaleDateString() : 'Not closed',
                approvedBy: hrCase.approver_first_name && hrCase.approver_last_name ? 
                    `${hrCase.approver_first_name} ${hrCase.approver_last_name}` : 'N/A',
                description: hrCase.description || 'N/A'
            });
        });

        // Style headers
        casesSheet.getRow(1).font = { bold: true };
        casesSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `hr_cases_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateSummaryPDF(reportData) {
        const { overallStats, categoryBreakdown, trendsData, summary, period, includeTrends } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `hr_cases_summary_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('HR CASES SUMMARY REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Overall Statistics
        doc.fontSize(16).text('Overall Statistics', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Cases: ${summary.totalCases}`);
        doc.text(`Resolution Rate: ${summary.resolutionRate}%`);
        doc.text(`Average Resolution Time: ${summary.avgResolutionTime} days`);
        doc.text(`Unique Employees Affected: ${summary.uniqueEmployees}`);
        doc.text(`Most Common Category: ${summary.mostCommonCategory}`);
        doc.text(`Trend Direction: ${summary.trendDirection}`);
        doc.moveDown();

        // Category Breakdown
        doc.fontSize(14).text('Category Breakdown', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        categoryBreakdown.forEach((category, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const resolutionRate = category.case_count > 0 ? 
                (category.resolved_count / category.case_count * 100).toFixed(2) : 0;

            doc.text(`${index + 1}. ${category.category_name}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Cases: ${category.case_count} | Resolved: ${category.resolved_count} (${resolutionRate}%)`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Average Resolution: ${parseFloat(category.avg_days || 0).toFixed(1)} days`, 70, yPosition);
            yPosition += 20;
        });

        // Trends Section
        if (includeTrends && trendsData.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Monthly Trends', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            trendsData.forEach(trend => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                const resolutionRate = trend.total_cases > 0 ? 
                    (trend.resolved_cases / trend.total_cases * 100).toFixed(2) : 0;

                doc.text(`${trend.month_year}: ${trend.total_cases} cases, ${resolutionRate}% resolved, ${parseFloat(trend.avg_resolution_days || 0).toFixed(1)} avg days`, 50, yPosition);
                yPosition += 15;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateSummaryExcel(reportData) {
        const { overallStats, categoryBreakdown, trendsData, summary, period, includeTrends } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'HR CASES SUMMARY REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Cases', summary.totalCases],
            ['Resolution Rate (%)', summary.resolutionRate],
            ['Avg Resolution Time (days)', summary.avgResolutionTime],
            ['Unique Employees', summary.uniqueEmployees],
            ['Most Common Category', summary.mostCommonCategory],
            ['Trend Direction', summary.trendDirection]
        ];

        summarySheet.addTable({
            name: 'OverallSummary',
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

        // Category Breakdown Sheet
        const categorySheet = workbook.addWorksheet('Category Breakdown');
        
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Total Cases', key: 'totalCases', width: 12 },
            { header: 'Resolved Cases', key: 'resolvedCases', width: 15 },
            { header: 'Resolution Rate (%)', key: 'resolutionRate', width: 18 },
            { header: 'Avg Resolution Days', key: 'avgDays', width: 18 }
        ];

        categoryBreakdown.forEach(category => {
            const resolutionRate = category.case_count > 0 ? 
                (category.resolved_count / category.case_count * 100).toFixed(2) : 0;

            categorySheet.addRow({
                category: category.category_name,
                totalCases: category.case_count,
                resolvedCases: category.resolved_count,
                resolutionRate: resolutionRate,
                avgDays: parseFloat(category.avg_days || 0).toFixed(1)
            });
        });

        // Style headers
        categorySheet.getRow(1).font = { bold: true };
        categorySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Trends Sheet
        if (includeTrends && trendsData.length > 0) {
            const trendsSheet = workbook.addWorksheet('Monthly Trends');
            
            trendsSheet.columns = [
                { header: 'Month', key: 'month', width: 12 },
                { header: 'Total Cases', key: 'totalCases', width: 12 },
                { header: 'Resolved Cases', key: 'resolvedCases', width: 15 },
                { header: 'Resolution Rate (%)', key: 'resolutionRate', width: 18 },
                { header: 'Avg Resolution Days', key: 'avgDays', width: 18 }
            ];

            trendsData.forEach(trend => {
                const resolutionRate = trend.total_cases > 0 ? 
                    (trend.resolved_cases / trend.total_cases * 100).toFixed(2) : 0;

                trendsSheet.addRow({
                    month: trend.month_year,
                    totalCases: trend.total_cases,
                    resolvedCases: trend.resolved_cases,
                    resolutionRate: resolutionRate,
                    avgDays: parseFloat(trend.avg_resolution_days || 0).toFixed(1)
                });
            });

            // Style headers
            trendsSheet.getRow(1).font = { bold: true };
            trendsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `hr_cases_summary_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateDeductionsPDF(reportData) {
        const { deductions, categorySummary, employeeSummary, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `hr_case_deductions_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('HR CASE DEDUCTIONS ANALYSIS', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Deductions Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Deductions: ${summary.totalDeductions}`);
        doc.text(`Total Amount: $${summary.totalAmount}`);
        doc.text(`Average Amount: $${summary.averageAmount}`);
        doc.text(`Unique Employees: ${summary.uniqueEmployees}`);
        doc.text(`Categories Involved: ${summary.categoriesInvolved}`);
        
        if (summary.highestCategory) {
            doc.text(`Highest Impact Category: ${summary.highestCategory.category_name} ($${parseFloat(summary.highestCategory.total_amount).toFixed(2)})`);
        }
        
        doc.moveDown();

        // Category Analysis
        doc.fontSize(14).text('Deductions by Category', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        categorySummary.forEach((category, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`${index + 1}. ${category.category_name || 'Uncategorized'}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Deductions: ${category.deduction_count} | Total: $${parseFloat(category.total_amount).toFixed(2)}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Average: $${parseFloat(category.avg_amount).toFixed(2)} | Employees: ${category.affected_employees}`, 70, yPosition);
            yPosition += 20;
        });

        // Top Employees
        if (employeeSummary.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Top Affected Employees', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            employeeSummary.forEach((employee, index) => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`${index + 1}. ${employee.first_name} ${employee.last_name} (${employee.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Deductions: ${employee.deduction_count} | Total: $${parseFloat(employee.total_deductions).toFixed(2)}`, 70, yPosition);
                yPosition += 20;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateDeductionsExcel(reportData) {
        const { deductions, categorySummary, employeeSummary, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Deductions Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'HR CASE DEDUCTIONS ANALYSIS';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Deductions', summary.totalDeductions],
            ['Total Amount', `$${summary.totalAmount}`],
            ['Average Amount', `$${summary.averageAmount}`],
            ['Unique Employees', summary.uniqueEmployees],
            ['Categories Involved', summary.categoriesInvolved]
        ];

        if (summary.highestCategory) {
            summaryData.push(['Highest Impact Category', `${summary.highestCategory.category_name} ($${parseFloat(summary.highestCategory.total_amount).toFixed(2)})`]);
        }

        summarySheet.addTable({
            name: 'DeductionsSummary',
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

        // Category Analysis Sheet
        const categorySheet = workbook.addWorksheet('Category Analysis');
        
        categorySheet.columns = [
            { header: 'Category', key: 'category', width: 25 },
            { header: 'Deduction Count', key: 'count', width: 15 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Average Amount', key: 'avgAmount', width: 15 },
            { header: 'Affected Employees', key: 'employees', width: 18 }
        ];

        categorySummary.forEach(category => {
            categorySheet.addRow({
                category: category.category_name || 'Uncategorized',
                count: category.deduction_count,
                totalAmount: parseFloat(category.total_amount).toFixed(2),
                avgAmount: parseFloat(category.avg_amount).toFixed(2),
                employees: category.affected_employees
            });
        });

        // Style headers
        categorySheet.getRow(1).font = { bold: true };
        categorySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Detailed Deductions Sheet
        const deductionsSheet = workbook.addWorksheet('Detailed Deductions');
        
        deductionsSheet.columns = [
            { header: 'Case Number', key: 'caseNumber', width: 15 },
            { header: 'Case Title', key: 'caseTitle', width: 30 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Amount', key: 'amount', width: 12 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Created On', key: 'createdOn', width: 12 }
        ];

        deductions.forEach(deduction => {
            deductionsSheet.addRow({
                caseNumber: deduction.case_number,
                caseTitle: deduction.case_title,
                employeeId: deduction.employee_id,
                employeeName: `${deduction.first_name} ${deduction.last_name}`,
                jobTitle: deduction.job_title || 'N/A',
                category: deduction.category_name || 'N/A',
                amount: parseFloat(deduction.amount || 0).toFixed(2),
                description: deduction.description || 'N/A',
                createdOn: new Date(deduction.created_on).toLocaleDateString()
            });
        });

        // Style headers
        deductionsSheet.getRow(1).font = { bold: true };
        deductionsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `hr_case_deductions_${Date.now()}.xlsx`;
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

module.exports = new HRCaseReportsController();
