

const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class PayrollReportsController {

    /**
     * Generate comprehensive payroll report for a specific cycle
     */
    async generatePayrollReport(req, res) {
        try {
            const { 
                cycleId, 
                format = 'pdf', 
                includeBreakdown = true 
            } = req.body;

            // Get cycle information
            const cycleQuery = `
                SELECT pc.*, 
                       DATE_FORMAT(pc.pay_period_start, '%Y-%m-%d') as pay_start,
                       DATE_FORMAT(pc.pay_period_end, '%Y-%m-%d') as pay_end
                FROM payroll_cycles pc 
                WHERE pc.id = ?
            `;
            const [cycleData] = await db.execute(cycleQuery, [cycleId]);

            if (cycleData.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Payroll cycle not found'
                });
            }

            // Get payroll summary for the cycle
            const payrollQuery = `
                SELECT 
                    p.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    d.name as department_name,
                    ess.basic_salary,
                    ess.gross_salary
                FROM payslips p
                JOIN user u ON p.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN departments d ON j.department_id = d.id
                LEFT JOIN employee_salary_structure ess ON u.id = ess.employee_id 
                    AND ess.is_active = 1
                WHERE p.payroll_cycle_id = ?
                ORDER BY u.first_name, u.last_name
            `;
            const [payrollData] = await db.execute(payrollQuery, [cycleId]);

            // Get detailed breakdown if requested
            let breakdownData = {};
            if (includeBreakdown) {
                const breakdownQuery = `
                    SELECT 
                        pd.*,
                        pc.component_name,
                        pc.component_type,
                        p.employee_id
                    FROM payslip_details pd
                    JOIN payslips p ON pd.payslip_id = p.id
                    JOIN payroll_components pc ON pd.component_id = pc.id
                    WHERE p.payroll_cycle_id = ?
                    ORDER BY p.employee_id, pc.component_type, pc.component_name
                `;
                const [breakdown] = await db.execute(breakdownQuery, [cycleId]);

                // Group by employee
                breakdown.forEach(item => {
                    if (!breakdownData[item.employee_id]) {
                        breakdownData[item.employee_id] = [];
                    }
                    breakdownData[item.employee_id].push(item);
                });
            }

            // Calculate summary statistics
            const summary = this.calculatePayrollSummary(payrollData);

            const reportData = {
                cycle: cycleData[0],
                payrollData,
                breakdownData,
                summary,
                includeBreakdown
            };

            if (format === 'pdf') {
                const filePath = await this.generatePayrollPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Payroll report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generatePayrollExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Payroll report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating payroll report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate payroll report',
                error: error.message
            });
        }
    }

    /**
     * Generate salary structure comparison report
     */
    async generateSalaryStructureReport(req, res) {
        try {
            const { employeeIds, format = 'pdf' } = req.body;

            // Check salary visibility permissions
            const canViewSalaries = this.checkSalaryPermissions(req.user);

            let query = `
                SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    u.salary_visibility,
                    j.title as job_title,
                    d.name as department_name,
                    ess.basic_salary,
                    ess.gross_salary,
                    ess.effective_date,
                    ess.is_active,
                    GROUP_CONCAT(
                        CONCAT(pc.component_name, ':', essc.amount) 
                        ORDER BY pc.component_type, pc.component_name
                        SEPARATOR '|'
                    ) as salary_components
                FROM user u
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN departments d ON j.department_id = d.id
                LEFT JOIN employee_salary_structure ess ON u.id = ess.employee_id 
                    AND ess.is_active = 1
                LEFT JOIN employee_salary_structure_components essc ON ess.id = essc.salary_structure_id
                LEFT JOIN payroll_components pc ON essc.component_id = pc.id
                WHERE u.is_active = 1 
                AND u.is_payroll_exempt = 0
            `;

            let params = [];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND u.id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            query += ` GROUP BY u.id ORDER BY u.first_name, u.last_name`;

            const [salaryData] = await db.execute(query, params);

            // Filter salary data based on permissions and visibility
            const filteredData = salaryData.map(employee => {
                const showSalary = canViewSalaries || employee.salary_visibility === 1;
                
                if (!showSalary) {
                    return {
                        ...employee,
                        basic_salary: 'Hidden',
                        gross_salary: 'Hidden',
                        salary_components: 'Hidden'
                    };
                }
                
                return employee;
            });

            const summary = this.calculateSalarySummary(filteredData, canViewSalaries);

            if (format === 'pdf') {
                const filePath = await this.generateSalaryStructurePDF(filteredData, summary, canViewSalaries);
                
                res.json({
                    success: true,
                    message: 'Salary structure report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateSalaryStructureExcel(filteredData, summary, canViewSalaries);
                
                res.json({
                    success: true,
                    message: 'Salary structure report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating salary structure report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate salary structure report',
                error: error.message
            });
        }
    }

    /**
     * Generate payroll cost center analysis
     */
    async generateCostCenterReport(req, res) {
        try {
            const { startDate, endDate, departments, format = 'pdf' } = req.body;

            let query = `
                SELECT 
                    COALESCE(d.name, j.title, 'Unassigned') as cost_center,
                    COUNT(DISTINCT p.employee_id) as employee_count,
                    SUM(p.gross_pay) as total_gross_pay,
                    SUM(p.net_pay) as total_net_pay,
                    SUM(p.total_deductions) as total_deductions,
                    SUM(p.total_earnings) as total_earnings,
                    AVG(p.gross_pay) as avg_gross_pay,
                    AVG(p.net_pay) as avg_net_pay,
                    pc.pay_period_start,
                    pc.pay_period_end
                FROM payslips p
                JOIN payroll_cycles pc ON p.payroll_cycle_id = pc.id
                JOIN user u ON p.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN departments d ON j.department_id = d.id
                WHERE pc.pay_period_start >= ? AND pc.pay_period_end <= ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (departments && departments.length > 0) {
                query += ` AND (d.id IN (${departments.map(() => '?').join(',')}) OR j.id IN (${departments.map(() => '?').join(',')}))`;
                params.push(...departments, ...departments);
            }

            query += ` 
                GROUP BY COALESCE(d.name, j.title, 'Unassigned'), pc.id
                ORDER BY total_gross_pay DESC
            `;

            const [costCenterData] = await db.execute(query, params);

            // Aggregate by cost center across all cycles
            const aggregatedData = this.aggregateCostCenterData(costCenterData);
            const summary = this.calculateCostCenterSummary(aggregatedData);

            if (format === 'pdf') {
                const filePath = await this.generateCostCenterPDF(aggregatedData, summary, { startDate, endDate });
                
                res.json({
                    success: true,
                    message: 'Cost center report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateCostCenterExcel(aggregatedData, summary, { startDate, endDate });
                
                res.json({
                    success: true,
                    message: 'Cost center report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating cost center report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate cost center report',
                error: error.message
            });
        }
    }

    // Helper Methods

    checkSalaryPermissions(user) {
        const permissions = user.permissions || [];
        return permissions.includes('payroll.view') && 
               permissions.includes('salary.view');
    }

    calculatePayrollSummary(payrollData) {
        const summary = {
            totalEmployees: payrollData.length,
            totalGrossPay: 0,
            totalNetPay: 0,
            totalDeductions: 0,
            totalEarnings: 0,
            avgGrossPay: 0,
            avgNetPay: 0
        };

        payrollData.forEach(payslip => {
            summary.totalGrossPay += parseFloat(payslip.gross_pay) || 0;
            summary.totalNetPay += parseFloat(payslip.net_pay) || 0;
            summary.totalDeductions += parseFloat(payslip.total_deductions) || 0;
            summary.totalEarnings += parseFloat(payslip.total_earnings) || 0;
        });

        if (summary.totalEmployees > 0) {
            summary.avgGrossPay = summary.totalGrossPay / summary.totalEmployees;
            summary.avgNetPay = summary.totalNetPay / summary.totalEmployees;
        }

        return summary;
    }

    calculateSalarySummary(salaryData, canViewSalaries) {
        const summary = {
            totalEmployees: salaryData.length,
            canViewSalaries,
            visibleSalaries: 0,
            hiddenSalaries: 0
        };

        if (canViewSalaries) {
            let totalBasic = 0;
            let totalGross = 0;
            let validSalaries = 0;

            salaryData.forEach(emp => {
                if (emp.basic_salary !== 'Hidden' && emp.basic_salary !== null) {
                    totalBasic += parseFloat(emp.basic_salary) || 0;
                    totalGross += parseFloat(emp.gross_salary) || 0;
                    validSalaries++;
                    summary.visibleSalaries++;
                } else {
                    summary.hiddenSalaries++;
                }
            });

            summary.avgBasicSalary = validSalaries > 0 ? totalBasic / validSalaries : 0;
            summary.avgGrossSalary = validSalaries > 0 ? totalGross / validSalaries : 0;
            summary.totalBasicSalary = totalBasic;
            summary.totalGrossSalary = totalGross;
        }

        return summary;
    }

    aggregateCostCenterData(costCenterData) {
        const aggregated = {};

        costCenterData.forEach(record => {
            const key = record.cost_center;
            
            if (!aggregated[key]) {
                aggregated[key] = {
                    cost_center: key,
                    employee_count: 0,
                    total_gross_pay: 0,
                    total_net_pay: 0,
                    total_deductions: 0,
                    total_earnings: 0,
                    cycle_count: 0
                };
            }

            aggregated[key].employee_count += parseInt(record.employee_count) || 0;
            aggregated[key].total_gross_pay += parseFloat(record.total_gross_pay) || 0;
            aggregated[key].total_net_pay += parseFloat(record.total_net_pay) || 0;
            aggregated[key].total_deductions += parseFloat(record.total_deductions) || 0;
            aggregated[key].total_earnings += parseFloat(record.total_earnings) || 0;
            aggregated[key].cycle_count += 1;
        });

        // Calculate averages
        Object.keys(aggregated).forEach(key => {
            const data = aggregated[key];
            data.avg_gross_pay = data.cycle_count > 0 ? data.total_gross_pay / data.cycle_count : 0;
            data.avg_net_pay = data.cycle_count > 0 ? data.total_net_pay / data.cycle_count : 0;
        });

        return Object.values(aggregated);
    }

    calculateCostCenterSummary(aggregatedData) {
        const summary = {
            totalCostCenters: aggregatedData.length,
            totalEmployees: aggregatedData.reduce((sum, cc) => sum + cc.employee_count, 0),
            totalGrossPay: aggregatedData.reduce((sum, cc) => sum + cc.total_gross_pay, 0),
            totalNetPay: aggregatedData.reduce((sum, cc) => sum + cc.total_net_pay, 0),
            totalDeductions: aggregatedData.reduce((sum, cc) => sum + cc.total_deductions, 0)
        };

        return summary;
    }

    async generatePayrollPDF(reportData) {
        const { cycle, payrollData, summary } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `payroll_report_cycle_${cycle.id}_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('PAYROLL REPORT', { align: 'center' });
        doc.fontSize(12).text(`Cycle: ${cycle.cycle_name}`, { align: 'center' });
        doc.text(`Pay Period: ${cycle.pay_start} to ${cycle.pay_end}`, { align: 'center' });
        doc.text(`Status: ${cycle.status}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Payroll Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Employees: ${summary.totalEmployees}`);
        doc.text(`Total Gross Pay: $${summary.totalGrossPay.toFixed(2)}`);
        doc.text(`Total Net Pay: $${summary.totalNetPay.toFixed(2)}`);
        doc.text(`Total Deductions: $${summary.totalDeductions.toFixed(2)}`);
        doc.text(`Average Gross Pay: $${summary.avgGrossPay.toFixed(2)}`);
        doc.text(`Average Net Pay: $${summary.avgNetPay.toFixed(2)}`);
        doc.moveDown();

        // Employee Details
        doc.fontSize(14).text('Employee Payroll Details', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        payrollData.forEach((employee, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`${index + 1}. ${employee.first_name} ${employee.last_name} (${employee.employee_id})`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Job: ${employee.job_title || 'N/A'} | Department: ${employee.department_name || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Gross: $${parseFloat(employee.gross_pay).toFixed(2)} | Net: $${parseFloat(employee.net_pay).toFixed(2)} | Deductions: $${parseFloat(employee.total_deductions).toFixed(2)}`, 70, yPosition);
            yPosition += 20;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generatePayrollExcel(reportData) {
        const { cycle, payrollData, summary, breakdownData, includeBreakdown } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Payroll Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'PAYROLL REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Cycle Name:';
        summarySheet.getCell('B3').value = cycle.cycle_name;
        summarySheet.getCell('A4').value = 'Pay Period:';
        summarySheet.getCell('B4').value = `${cycle.pay_start} to ${cycle.pay_end}`;
        summarySheet.getCell('A5').value = 'Status:';
        summarySheet.getCell('B5').value = cycle.status;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Employees', summary.totalEmployees],
            ['Total Gross Pay', `$${summary.totalGrossPay.toFixed(2)}`],
            ['Total Net Pay', `$${summary.totalNetPay.toFixed(2)}`],
            ['Total Deductions', `$${summary.totalDeductions.toFixed(2)}`],
            ['Average Gross Pay', `$${summary.avgGrossPay.toFixed(2)}`],
            ['Average Net Pay', `$${summary.avgNetPay.toFixed(2)}`]
        ];

        summarySheet.addTable({
            name: 'PayrollSummary',
            ref: 'A7',
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

        // Employee Details Sheet
        const detailSheet = workbook.addWorksheet('Employee Details');
        
        detailSheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Basic Salary', key: 'basicSalary', width: 12 },
            { header: 'Gross Pay', key: 'grossPay', width: 12 },
            { header: 'Total Deductions', key: 'totalDeductions', width: 15 },
            { header: 'Net Pay', key: 'netPay', width: 12 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        payrollData.forEach(employee => {
            detailSheet.addRow({
                employeeId: employee.employee_id,
                name: `${employee.first_name} ${employee.last_name}`,
                email: employee.email,
                jobTitle: employee.job_title || 'N/A',
                department: employee.department_name || 'N/A',
                basicSalary: parseFloat(employee.basic_salary || 0).toFixed(2),
                grossPay: parseFloat(employee.gross_pay).toFixed(2),
                totalDeductions: parseFloat(employee.total_deductions).toFixed(2),
                netPay: parseFloat(employee.net_pay).toFixed(2),
                status: employee.status
            });
        });

        // Style headers
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `payroll_report_cycle_${cycle.id}_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateSalaryStructurePDF(salaryData, summary, canViewSalaries) {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `salary_structure_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('SALARY STRUCTURE REPORT', { align: 'center' });
        doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Employees: ${summary.totalEmployees}`);
        
        if (canViewSalaries) {
            doc.text(`Visible Salaries: ${summary.visibleSalaries}`);
            doc.text(`Hidden Salaries: ${summary.hiddenSalaries}`);
            doc.text(`Average Basic Salary: $${summary.avgBasicSalary.toFixed(2)}`);
            doc.text(`Average Gross Salary: $${summary.avgGrossSalary.toFixed(2)}`);
        } else {
            doc.text('Salary details are restricted based on permissions');
        }
        doc.moveDown();

        // Employee Details
        doc.fontSize(14).text('Employee Salary Details', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        salaryData.forEach((employee, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`${index + 1}. ${employee.first_name} ${employee.last_name}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Job: ${employee.job_title || 'N/A'} | Department: ${employee.department_name || 'N/A'}`, 70, yPosition);
            yPosition += 12;
            
            if (employee.basic_salary !== 'Hidden') {
                doc.text(`   Basic: $${parseFloat(employee.basic_salary || 0).toFixed(2)} | Gross: $${parseFloat(employee.gross_salary || 0).toFixed(2)}`, 70, yPosition);
            } else {
                doc.text(`   Salary information is restricted`, 70, yPosition);
            }
            yPosition += 20;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateSalaryStructureExcel(salaryData, summary, canViewSalaries) {
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'SALARY STRUCTURE REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        const summaryRows = [
            ['Total Employees', summary.totalEmployees]
        ];

        if (canViewSalaries) {
            summaryRows.push(
                ['Visible Salaries', summary.visibleSalaries],
                ['Hidden Salaries', summary.hiddenSalaries],
                ['Average Basic Salary', `$${summary.avgBasicSalary.toFixed(2)}`],
                ['Average Gross Salary', `$${summary.avgGrossSalary.toFixed(2)}`]
            );
        }

        summaryRows.forEach((row, index) => {
            summarySheet.getCell(`A${index + 3}`).value = row[0];
            summarySheet.getCell(`B${index + 3}`).value = row[1];
        });

        // Employee Details Sheet
        const detailSheet = workbook.addWorksheet('Employee Details');
        
        detailSheet.columns = [
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Basic Salary', key: 'basicSalary', width: 15 },
            { header: 'Gross Salary', key: 'grossSalary', width: 15 },
            { header: 'Effective Date', key: 'effectiveDate', width: 12 }
        ];

        salaryData.forEach(employee => {
            detailSheet.addRow({
                employeeId: employee.employee_id,
                name: `${employee.first_name} ${employee.last_name}`,
                email: employee.email,
                jobTitle: employee.job_title || 'N/A',
                department: employee.department_name || 'N/A',
                basicSalary: employee.basic_salary === 'Hidden' ? 'Hidden' : `$${parseFloat(employee.basic_salary || 0).toFixed(2)}`,
                grossSalary: employee.gross_salary === 'Hidden' ? 'Hidden' : `$${parseFloat(employee.gross_salary || 0).toFixed(2)}`,
                effectiveDate: employee.effective_date ? new Date(employee.effective_date).toLocaleDateString() : 'N/A'
            });
        });

        // Style headers
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `salary_structure_report_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await workbook.xlsx.writeFile(filePath);
        return `/uploads/reports/${fileName}`;
    }

    async generateCostCenterPDF(costCenterData, summary, options) {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `cost_center_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('COST CENTER ANALYSIS', { align: 'center' });
        doc.fontSize(12).text(`Period: ${options.startDate} to ${options.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Cost Centers: ${summary.totalCostCenters}`);
        doc.text(`Total Employees: ${summary.totalEmployees}`);
        doc.text(`Total Gross Pay: $${summary.totalGrossPay.toFixed(2)}`);
        doc.text(`Total Net Pay: $${summary.totalNetPay.toFixed(2)}`);
        doc.text(`Total Deductions: $${summary.totalDeductions.toFixed(2)}`);
        doc.moveDown();

        // Cost Center Details
        doc.fontSize(14).text('Cost Center Breakdown', { underline: true });
        doc.fontSize(8);

        let yPosition = doc.y + 10;

        costCenterData.forEach((cc, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc.text(`${index + 1}. ${cc.cost_center}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Employees: ${cc.employee_count} | Cycles: ${cc.cycle_count}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Total Gross: $${cc.total_gross_pay.toFixed(2)} | Total Net: $${cc.total_net_pay.toFixed(2)}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Avg Gross: $${cc.avg_gross_pay.toFixed(2)} | Avg Net: $${cc.avg_net_pay.toFixed(2)}`, 70, yPosition);
            yPosition += 20;
        });

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateCostCenterExcel(costCenterData, summary, options) {
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'COST CENTER ANALYSIS';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${options.startDate} to ${options.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Cost Centers', summary.totalCostCenters],
            ['Total Employees', summary.totalEmployees],
            ['Total Gross Pay', `$${summary.totalGrossPay.toFixed(2)}`],
            ['Total Net Pay', `$${summary.totalNetPay.toFixed(2)}`],
            ['Total Deductions', `$${summary.totalDeductions.toFixed(2)}`]
        ];

        summarySheet.addTable({
            name: 'CostCenterSummary',
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

        // Cost Center Details Sheet
        const detailSheet = workbook.addWorksheet('Cost Center Details');
        
        detailSheet.columns = [
            { header: 'Cost Center', key: 'costCenter', width: 20 },
            { header: 'Employee Count', key: 'employeeCount', width: 15 },
            { header: 'Cycle Count', key: 'cycleCount', width: 12 },
            { header: 'Total Gross Pay', key: 'totalGrossPay', width: 15 },
            { header: 'Total Net Pay', key: 'totalNetPay', width: 15 },
            { header: 'Total Deductions', key: 'totalDeductions', width: 15 },
            { header: 'Avg Gross Pay', key: 'avgGrossPay', width: 15 },
            { header: 'Avg Net Pay', key: 'avgNetPay', width: 15 }
        ];

        costCenterData.forEach(cc => {
            detailSheet.addRow({
                costCenter: cc.cost_center,
                employeeCount: cc.employee_count,
                cycleCount: cc.cycle_count,
                totalGrossPay: cc.total_gross_pay.toFixed(2),
                totalNetPay: cc.total_net_pay.toFixed(2),
                totalDeductions: cc.total_deductions.toFixed(2),
                avgGrossPay: cc.avg_gross_pay.toFixed(2),
                avgNetPay: cc.avg_net_pay.toFixed(2)
            });
        });

        // Style headers
        detailSheet.getRow(1).font = { bold: true };
        detailSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        const fileName = `cost_center_report_${Date.now()}.xlsx`;
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

module.exports = new PayrollReportsController();
