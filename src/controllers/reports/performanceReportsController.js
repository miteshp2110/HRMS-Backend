
const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class PerformanceReportsController {

    /**
     * Generate comprehensive performance appraisal report
     */
    async generatePerformanceReport(req, res) {
        try {
            const {
                cycleId,
                employeeIds,
                format = 'pdf',
                includeGoalDetails = false,
                includeKPIDetails = false
            } = req.body;

            // Get cycle information
            const cycleQuery = `
                SELECT pc.*, 
                       DATE_FORMAT(pc.start_date, '%Y-%m-%d') as cycle_start,
                       DATE_FORMAT(pc.end_date, '%Y-%m-%d') as cycle_end
                FROM performance_cycles pc 
                WHERE pc.id = ?
            `;
            const [cycleData] = await db.execute(cycleQuery, [cycleId]);

            if (cycleData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Performance cycle not found'
                });
            }

            // Get performance appraisals
            let appraisalQuery = `
                SELECT 
                    pa.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    d.name as department_name,
                    manager.first_name as manager_first_name,
                    manager.last_name as manager_last_name,
                    self_reviewer.first_name as self_reviewer_first_name,
                    self_reviewer.last_name as self_reviewer_last_name
                FROM performance_appraisals pa
                JOIN user u ON pa.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN departments d ON j.department_id = d.id
                LEFT JOIN user manager ON pa.manager_reviewer_id = manager.id
                LEFT JOIN user self_reviewer ON pa.self_reviewer_id = self_reviewer.id
                WHERE pa.cycle_id = ?
            `;

            let params = [cycleId];

            if (employeeIds && employeeIds.length > 0) {
                appraisalQuery += ` AND pa.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            appraisalQuery += ` ORDER BY u.first_name, u.last_name`;

            const [appraisals] = await db.execute(appraisalQuery, params);

            // Get goals if requested
            let goals = [];
            if (includeGoalDetails) {
                const goalEmployeeIds = employeeIds && employeeIds.length > 0 ? employeeIds : appraisals.map(a => a.employee_id);
                
                if (goalEmployeeIds.length > 0) {
                    const goalsQuery = `
                        SELECT 
                            eg.*,
                            u.first_name,
                            u.last_name
                        FROM employee_goals eg
                        JOIN user u ON eg.employee_id = u.id
                        WHERE eg.cycle_id = ? AND eg.employee_id IN (${goalEmployeeIds.map(() => '?').join(',')})
                        ORDER BY u.first_name, u.last_name, eg.goal_title
                    `;
                    const [goalsResult] = await db.execute(goalsQuery, [cycleId, ...goalEmployeeIds]);
                    goals = goalsResult;
                }
            }

            // Get KPIs if requested
            let kpis = [];
            if (includeKPIDetails) {
                const kpiEmployeeIds = employeeIds && employeeIds.length > 0 ? employeeIds : appraisals.map(a => a.employee_id);
                
                if (kpiEmployeeIds.length > 0) {
                    const kpisQuery = `
                        SELECT 
                            ek.*,
                            u.first_name,
                            u.last_name,
                            k.name as kpi_name
                        FROM employee_kpis ek
                        JOIN user u ON ek.employee_id = u.id
                        JOIN kpis k ON ek.kpi_id = k.id
                        WHERE ek.cycle_id = ? AND ek.employee_id IN (${kpiEmployeeIds.map(() => '?').join(',')})
                        ORDER BY u.first_name, u.last_name, k.name
                    `;
                    const [kpisResult] = await db.execute(kpisQuery, [cycleId, ...kpiEmployeeIds]);
                    kpis = kpisResult;
                }
            }

            // Calculate summary
            const summary = this.calculatePerformanceSummary(appraisals, goals, kpis);

            const reportData = {
                cycle: cycleData[0],
                appraisals,
                goals,
                kpis,
                summary,
                includeGoalDetails,
                includeKPIDetails
            };

            if (format === 'pdf') {
                const filePath = await this.generatePerformancePDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Performance report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generatePerformanceExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Performance report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating performance report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate performance report',
                error: error.message
            });
        }
    }

    /**
     * Generate performance cycle comparison report
     */
    async generateCycleReport(req, res) {
        try {
            const { cycleIds, format = 'pdf' } = req.body;

            // Get cycle information
            const cyclesQuery = `
                SELECT pc.*, 
                       DATE_FORMAT(pc.start_date, '%Y-%m-%d') as cycle_start,
                       DATE_FORMAT(pc.end_date, '%Y-%m-%d') as cycle_end
                FROM performance_cycles pc 
                WHERE pc.id IN (${cycleIds.map(() => '?').join(',')})
                ORDER BY pc.start_date
            `;
            const [cycles] = await db.execute(cyclesQuery, cycleIds);

            // Get appraisals for all cycles
            const appraisalsQuery = `
                SELECT 
                    pa.*,
                    u.first_name,
                    u.last_name,
                    u.employee_id,
                    j.title as job_title,
                    pc.name as cycle_name
                FROM performance_appraisals pa
                JOIN user u ON pa.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                JOIN performance_cycles pc ON pa.cycle_id = pc.id
                WHERE pa.cycle_id IN (${cycleIds.map(() => '?').join(',')})
                ORDER BY pc.start_date, u.first_name, u.last_name
            `;
            const [appraisals] = await db.execute(appraisalsQuery, cycleIds);

            // Calculate cycle comparison summary
            const summary = this.calculateCycleComparisonSummary(appraisals, cycles);

            const reportData = {
                cycles,
                appraisals,
                summary
            };

            if (format === 'pdf') {
                const filePath = await this.generateCycleComparisonPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Cycle comparison report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateCycleComparisonExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Cycle comparison report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating cycle comparison report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate cycle comparison report',
                error: error.message
            });
        }
    }

    /**
     * Generate goals achievement report
     */
    async generateGoalsReport(req, res) {
        try {
            const { cycleId, employeeIds, format = 'pdf' } = req.body;

            // Get cycle information
            const cycleQuery = `
                SELECT pc.*, 
                       DATE_FORMAT(pc.start_date, '%Y-%m-%d') as cycle_start,
                       DATE_FORMAT(pc.end_date, '%Y-%m-%d') as cycle_end
                FROM performance_cycles pc 
                WHERE pc.id = ?
            `;
            const [cycleData] = await db.execute(cycleQuery, [cycleId]);

            if (cycleData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Performance cycle not found'
                });
            }

            // Get goals
            let goalsQuery = `
                SELECT 
                    eg.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title
                FROM employee_goals eg
                JOIN user u ON eg.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                WHERE eg.cycle_id = ?
            `;

            let params = [cycleId];

            if (employeeIds && employeeIds.length > 0) {
                goalsQuery += ` AND eg.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            goalsQuery += ` ORDER BY u.first_name, u.last_name, eg.goal_title`;

            const [goals] = await db.execute(goalsQuery, params);

            // Calculate goals summary
            const summary = this.calculateGoalsSummary(goals);

            const reportData = {
                cycle: cycleData[0],
                goals,
                summary
            };

            if (format === 'pdf') {
                const filePath = await this.generateGoalsPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Goals report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateGoalsExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Goals report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating goals report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate goals report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculatePerformanceSummary(appraisals, goals, kpis) {
        const summary = {
            totalAppraisals: appraisals.length,
            completedAppraisals: appraisals.filter(a => a.status === 'Completed').length,
            pendingAppraisals: appraisals.filter(a => a.status === 'Pending').length,
            draftAppraisals: appraisals.filter(a => a.status === 'Draft').length,
            averageOverallRating: 0,
            averageManagerRating: 0,
            averageSelfRating: 0,
            totalGoals: goals.length,
            achievedGoals: goals.filter(g => g.status === 'Achieved').length,
            totalKPIs: kpis.length,
            metKPIs: kpis.filter(k => parseFloat(k.actual_value) >= parseFloat(k.target_value)).length
        };

        // Calculate average ratings
        const completedAppraisals = appraisals.filter(a => a.status === 'Completed');
        if (completedAppraisals.length > 0) {
            summary.averageOverallRating = (completedAppraisals.reduce((sum, a) => 
                sum + (parseFloat(a.overall_rating) || 0), 0) / completedAppraisals.length).toFixed(2);
            summary.averageManagerRating = (completedAppraisals.reduce((sum, a) => 
                sum + (parseFloat(a.manager_rating) || 0), 0) / completedAppraisals.length).toFixed(2);
            summary.averageSelfRating = (completedAppraisals.reduce((sum, a) => 
                sum + (parseFloat(a.self_rating) || 0), 0) / completedAppraisals.length).toFixed(2);
        }

        return summary;
    }

    calculateCycleComparisonSummary(appraisals, cycles) {
        const summary = {
            totalCycles: cycles.length,
            cycleStats: {}
        };

        cycles.forEach(cycle => {
            const cycleAppraisals = appraisals.filter(a => a.cycle_id === cycle.id);
            summary.cycleStats[cycle.name] = {
                totalAppraisals: cycleAppraisals.length,
                completedAppraisals: cycleAppraisals.filter(a => a.status === 'Completed').length,
                averageRating: cycleAppraisals.length > 0 ? 
                    (cycleAppraisals.reduce((sum, a) => sum + (parseFloat(a.overall_rating) || 0), 0) / cycleAppraisals.length).toFixed(2) : 0
            };
        });

        return summary;
    }

    calculateGoalsSummary(goals) {
        const summary = {
            totalGoals: goals.length,
            achievedGoals: goals.filter(g => g.status === 'Achieved').length,
            inProgressGoals: goals.filter(g => g.status === 'In Progress').length,
            notStartedGoals: goals.filter(g => g.status === 'Not Started').length,
            overallAchievementRate: 0,
            averageProgress: 0
        };

        if (summary.totalGoals > 0) {
            summary.overallAchievementRate = ((summary.achievedGoals / summary.totalGoals) * 100).toFixed(2);
            summary.averageProgress = (goals.reduce((sum, g) => 
                sum + (parseFloat(g.progress_percentage) || 0), 0) / goals.length).toFixed(2);
        }

        return summary;
    }

    async generatePerformancePDF(reportData) {
        const { cycle, appraisals, goals, kpis, summary, includeGoalDetails, includeKPIDetails } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `performance_report_cycle_${cycle.id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('PERFORMANCE APPRAISAL REPORT', { align: 'center' });
        doc.fontSize(12).text(`Cycle: ${cycle.name}`, { align: 'center' });
        doc.text(`Period: ${cycle.cycle_start} to ${cycle.cycle_end}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary Section
        doc.fontSize(16).text('Performance Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Appraisals: ${summary.totalAppraisals}`);
        doc.text(`Completed: ${summary.completedAppraisals} | Pending: ${summary.pendingAppraisals} | Draft: ${summary.draftAppraisals}`);
        doc.text(`Average Overall Rating: ${summary.averageOverallRating}`);
        doc.text(`Average Manager Rating: ${summary.averageManagerRating}`);
        doc.text(`Average Self Rating: ${summary.averageSelfRating}`);
        
        if (includeGoalDetails) {
            doc.text(`Total Goals: ${summary.totalGoals} | Achieved: ${summary.achievedGoals}`);
        }
        
        if (includeKPIDetails) {
            doc.text(`Total KPIs: ${summary.totalKPIs} | Met: ${summary.metKPIs}`);
        }
        
        doc.moveDown();

        // Individual Appraisals
        doc.fontSize(14).text('Individual Performance Appraisals', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        appraisals.forEach((appraisal, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`${index + 1}. ${appraisal.first_name} ${appraisal.last_name} (${appraisal.employee_id})`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Job: ${appraisal.job_title || 'N/A'} | Department: ${appraisal.department_name || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Status: ${appraisal.status} | Overall Rating: ${appraisal.overall_rating || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Manager Rating: ${appraisal.manager_rating || 'N/A'} | Self Rating: ${appraisal.self_rating || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            
            if (appraisal.manager_first_name) {
                doc.text(`   Manager: ${appraisal.manager_first_name} ${appraisal.manager_last_name}`, 70, yPosition);
                yPosition += 12;
            }
            
            if (appraisal.manager_comments) {
                doc.text(`   Manager Comments: ${appraisal.manager_comments}`, 70, yPosition);
                yPosition += 12;
            }
            
            yPosition += 10;
        });

        // Goals Section
        if (includeGoalDetails && goals.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Goals Achievement', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            // Group goals by employee
            const goalsByEmployee = {};
            goals.forEach(goal => {
                const empKey = `${goal.first_name} ${goal.last_name}`;
                if (!goalsByEmployee[empKey]) goalsByEmployee[empKey] = [];
                goalsByEmployee[empKey].push(goal);
            });

            Object.keys(goalsByEmployee).forEach(employeeName => {
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.text(`Employee: ${employeeName}`, 50, yPosition);
                yPosition += 15;

                goalsByEmployee[employeeName].forEach(goal => {
                    if (yPosition > 750) {
                        doc.addPage();
                        yPosition = 50;
                    }

                    doc.text(`  Goal: ${goal.goal_title}`, 70, yPosition);
                    yPosition += 12;
                    doc.text(`  Progress: ${goal.progress_percentage || 0}% | Status: ${goal.status || 'N/A'}`, 70, yPosition);
                    yPosition += 12;
                    doc.text(`  Target: ${goal.target_value || 'N/A'} | Actual: ${goal.actual_value || 'N/A'}`, 70, yPosition);
                    yPosition += 15;
                });
                yPosition += 10;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generatePerformanceExcel(reportData) {
        const { cycle, appraisals, goals, kpis, summary, includeGoalDetails, includeKPIDetails } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Performance Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'PERFORMANCE APPRAISAL REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Cycle Name:';
        summarySheet.getCell('B3').value = cycle.name;
        summarySheet.getCell('A4').value = 'Period:';
        summarySheet.getCell('B4').value = `${cycle.cycle_start} to ${cycle.cycle_end}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Appraisals', summary.totalAppraisals],
            ['Completed Appraisals', summary.completedAppraisals],
            ['Pending Appraisals', summary.pendingAppraisals],
            ['Draft Appraisals', summary.draftAppraisals],
            ['Average Overall Rating', summary.averageOverallRating],
            ['Average Manager Rating', summary.averageManagerRating],
            ['Average Self Rating', summary.averageSelfRating]
        ];

        if (includeGoalDetails) {
            summaryData.push(['Total Goals', summary.totalGoals]);
            summaryData.push(['Achieved Goals', summary.achievedGoals]);
        }

        if (includeKPIDetails) {
            summaryData.push(['Total KPIs', summary.totalKPIs]);
            summaryData.push(['Met KPIs', summary.metKPIs]);
        }

        summarySheet.addTable({
            name: 'PerformanceSummary',
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

        // Appraisals Sheet
        const appraisalsSheet = workbook.addWorksheet('Appraisals');
        
        appraisalsSheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Overall Rating', key: 'overallRating', width: 15 },
            { header: 'Manager Rating', key: 'managerRating', width: 15 },
            { header: 'Self Rating', key: 'selfRating', width: 12 },
            { header: 'Manager', key: 'manager', width: 20 },
            { header: 'Manager Comments', key: 'managerComments', width: 30 }
        ];

        appraisals.forEach(appraisal => {
            appraisalsSheet.addRow({
                employeeId: appraisal.employee_id,
                employeeName: `${appraisal.first_name} ${appraisal.last_name}`,
                email: appraisal.email,
                jobTitle: appraisal.job_title || 'N/A',
                department: appraisal.department_name || 'N/A',
                status: appraisal.status,
                overallRating: appraisal.overall_rating || 'N/A',
                managerRating: appraisal.manager_rating || 'N/A',
                selfRating: appraisal.self_rating || 'N/A',
                manager: appraisal.manager_first_name && appraisal.manager_last_name ? 
                    `${appraisal.manager_first_name} ${appraisal.manager_last_name}` : 'N/A',
                managerComments: appraisal.manager_comments || 'N/A'
            });
        });

        // Style headers
        appraisalsSheet.getRow(1).font = { bold: true };
        appraisalsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Goals Sheet
        if (includeGoalDetails && goals.length > 0) {
            const goalsSheet = workbook.addWorksheet('Goals');
            
            goalsSheet.columns = [
                { header: 'Employee ID', key: 'employeeId', width: 15 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Goal Title', key: 'goalTitle', width: 30 },
                { header: 'Description', key: 'description', width: 40 },
                { header: 'Target Value', key: 'targetValue', width: 15 },
                { header: 'Actual Value', key: 'actualValue', width: 15 },
                { header: 'Progress (%)', key: 'progress', width: 12 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Weight', key: 'weight', width: 10 }
            ];

            goals.forEach(goal => {
                goalsSheet.addRow({
                    employeeId: goal.employee_id,
                    employeeName: `${goal.first_name} ${goal.last_name}`,
                    goalTitle: goal.goal_title,
                    description: goal.description || 'N/A',
                    targetValue: goal.target_value || 'N/A',
                    actualValue: goal.actual_value || 'N/A',
                    progress: goal.progress_percentage || 0,
                    status: goal.status || 'N/A',
                    weight: goal.weight || 'N/A'
                });
            });

            // Style headers
            goalsSheet.getRow(1).font = { bold: true };
            goalsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `performance_report_cycle_${cycle.id}_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateCycleComparisonPDF(reportData) {
        const { cycles, appraisals, summary } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `cycle_comparison_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('PERFORMANCE CYCLE COMPARISON', { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Cycle Comparison Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Cycles Compared: ${summary.totalCycles}`);
        doc.moveDown();

        // Cycle Statistics
        doc.fontSize(14).text('Cycle Statistics', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        Object.keys(summary.cycleStats).forEach((cycleName, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const stats = summary.cycleStats[cycleName];
            doc.text(`${index + 1}. ${cycleName}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Total Appraisals: ${stats.totalAppraisals}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Completed: ${stats.completedAppraisals}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Average Rating: ${stats.averageRating}`, 70, yPosition);
            yPosition += 20;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateCycleComparisonExcel(reportData) {
        const { cycles, appraisals, summary } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Cycle Comparison');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'PERFORMANCE CYCLE COMPARISON';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Total Cycles Compared:';
        summarySheet.getCell('B3').value = summary.totalCycles;

        // Cycle stats table
        const cycleStatsData = [
            ['Cycle Name', 'Total Appraisals', 'Completed Appraisals', 'Average Rating']
        ];

        Object.keys(summary.cycleStats).forEach(cycleName => {
            const stats = summary.cycleStats[cycleName];
            cycleStatsData.push([
                cycleName,
                stats.totalAppraisals,
                stats.completedAppraisals,
                stats.averageRating
            ]);
        });

        summarySheet.addTable({
            name: 'CycleComparison',
            ref: 'A5',
            headerRow: true,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true
            },
            columns: [
                { name: 'Cycle Name', filterButton: true },
                { name: 'Total Appraisals', filterButton: true },
                { name: 'Completed Appraisals', filterButton: true },
                { name: 'Average Rating', filterButton: true }
            ],
            rows: cycleStatsData.slice(1)
        });

        const fileName = `cycle_comparison_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateGoalsPDF(reportData) {
        const { cycle, goals, summary } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `goals_report_cycle_${cycle.id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('GOALS ACHIEVEMENT REPORT', { align: 'center' });
        doc.fontSize(12).text(`Cycle: ${cycle.name}`, { align: 'center' });
        doc.text(`Period: ${cycle.cycle_start} to ${cycle.cycle_end}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Goals Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Goals: ${summary.totalGoals}`);
        doc.text(`Achieved: ${summary.achievedGoals} | In Progress: ${summary.inProgressGoals} | Not Started: ${summary.notStartedGoals}`);
        doc.text(`Overall Achievement Rate: ${summary.overallAchievementRate}%`);
        doc.text(`Average Progress: ${summary.averageProgress}%`);
        doc.moveDown();

        // Individual Goals
        doc.fontSize(14).text('Individual Goals', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        // Group goals by employee
        const goalsByEmployee = {};
        goals.forEach(goal => {
            const empKey = `${goal.first_name} ${goal.last_name}`;
            if (!goalsByEmployee[empKey]) goalsByEmployee[empKey] = [];
            goalsByEmployee[empKey].push(goal);
        });

        Object.keys(goalsByEmployee).forEach(employeeName => {
            if (yPosition > 650) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(10).text(`Employee: ${employeeName}`, 50, yPosition);
            yPosition += 15;

            goalsByEmployee[employeeName].forEach((goal, index) => {
                if (yPosition > 750) {
                    doc.addPage();
                    yPosition = 50;
                }

                doc.fontSize(8).text(`${index + 1}. ${goal.goal_title}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Description: ${goal.description || 'N/A'}`, 90, yPosition);
                yPosition += 12;
                doc.text(`   Target: ${goal.target_value || 'N/A'} | Actual: ${goal.actual_value || 'N/A'}`, 90, yPosition);
                yPosition += 12;
                doc.text(`   Progress: ${goal.progress_percentage || 0}% | Status: ${goal.status || 'N/A'}`, 90, yPosition);
                yPosition += 12;
                doc.text(`   Weight: ${goal.weight || 'N/A'}`, 90, yPosition);
                yPosition += 18;
            });
            yPosition += 10;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateGoalsExcel(reportData) {
        const { cycle, goals, summary } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Goals Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'GOALS ACHIEVEMENT REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Cycle Name:';
        summarySheet.getCell('B3').value = cycle.name;
        summarySheet.getCell('A4').value = 'Period:';
        summarySheet.getCell('B4').value = `${cycle.cycle_start} to ${cycle.cycle_end}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Goals', summary.totalGoals],
            ['Achieved Goals', summary.achievedGoals],
            ['In Progress Goals', summary.inProgressGoals],
            ['Not Started Goals', summary.notStartedGoals],
            ['Achievement Rate (%)', summary.overallAchievementRate],
            ['Average Progress (%)', summary.averageProgress]
        ];

        summarySheet.addTable({
            name: 'GoalsSummary',
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

        // Goals Details Sheet
        const goalsSheet = workbook.addWorksheet('Goals Details');
        
        goalsSheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Goal Title', key: 'goalTitle', width: 30 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Target Value', key: 'targetValue', width: 15 },
            { header: 'Actual Value', key: 'actualValue', width: 15 },
            { header: 'Progress (%)', key: 'progress', width: 12 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Weight', key: 'weight', width: 10 }
        ];

        goals.forEach(goal => {
            goalsSheet.addRow({
                employeeId: goal.employee_id,
                employeeName: `${goal.first_name} ${goal.last_name}`,
                jobTitle: goal.job_title || 'N/A',
                goalTitle: goal.goal_title,
                description: goal.description || 'N/A',
                targetValue: goal.target_value || 'N/A',
                actualValue: goal.actual_value || 'N/A',
                progress: goal.progress_percentage || 0,
                status: goal.status || 'N/A',
                weight: goal.weight || 'N/A'
            });
        });

        // Style headers
        goalsSheet.getRow(1).font = { bold: true };
        goalsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `goals_report_cycle_${cycle.id}_${Date.now()}.xlsx`;
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

module.exports = new PerformanceReportsController();
