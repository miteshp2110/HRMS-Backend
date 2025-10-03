
const db = require('../../db/connector');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ExpenseReportsController {

    /**
     * Generate expense claims report
     */
    async generateExpenseClaimsReport(req, res) {
        try {
            const {
                startDate,
                endDate,
                employeeIds,
                categoryIds,
                status,
                format = 'pdf'
            } = req.body;

            // Build expense claims query
            let query = `
                SELECT 
                    ec.*,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.employee_id,
                    j.title as job_title,
                    d.name as department_name,
                    cat.name as category_name,
                    cat.code as category_code,
                    cat.max_amount as category_max_amount,
                    approver.first_name as approver_first_name,
                    approver.last_name as approver_last_name,
                    processor.first_name as processor_first_name,
                    processor.last_name as processor_last_name,
                    reimburser.first_name as reimburser_first_name,
                    reimburser.last_name as reimburser_last_name
                FROM expense_claims ec
                JOIN user u ON ec.employee_id = u.id
                LEFT JOIN jobs j ON u.job_role = j.id
                LEFT JOIN departments d ON j.department_id = d.id
                LEFT JOIN expense_categories cat ON ec.category_id = cat.id
                LEFT JOIN user approver ON ec.approved_by = approver.id
                LEFT JOIN user processor ON ec.processed_by = processor.id
                LEFT JOIN user reimburser ON ec.reimbursed_by = reimburser.id
                WHERE ec.claim_date BETWEEN ? AND ?
                AND u.is_active = 1
            `;

            let params = [startDate, endDate];

            if (employeeIds && employeeIds.length > 0) {
                query += ` AND ec.employee_id IN (${employeeIds.map(() => '?').join(',')})`;
                params.push(...employeeIds);
            }

            if (categoryIds && categoryIds.length > 0) {
                query += ` AND ec.category_id IN (${categoryIds.map(() => '?').join(',')})`;
                params.push(...categoryIds);
            }

            if (status && status.length > 0) {
                query += ` AND ec.status IN (${status.map(() => '?').join(',')})`;
                params.push(...status);
            }

            query += ` ORDER BY ec.claim_date DESC, u.first_name`;

            const [claims] = await db.execute(query, params);

            // Get expense items for approved claims
            let expenseItems = [];
            if (claims.length > 0) {
                const claimIds = claims.map(c => c.id);
                const itemsQuery = `
                    SELECT 
                        eci.*,
                        ec.claim_number,
                        u.first_name,
                        u.last_name
                    FROM expense_claim_items eci
                    JOIN expense_claims ec ON eci.claim_id = ec.id
                    JOIN user u ON ec.employee_id = u.id
                    WHERE eci.claim_id IN (${claimIds.map(() => '?').join(',')})
                    ORDER BY eci.expense_date DESC
                `;
                const [items] = await db.execute(itemsQuery, claimIds);
                expenseItems = items;
            }

            // Get reimbursements data
            let reimbursements = [];
            const reimbursedClaims = claims.filter(c => c.status === 'Reimbursed');
            if (reimbursedClaims.length > 0) {
                const reimbursedIds = reimbursedClaims.map(c => c.id);
                const reimbursementsQuery = `
                    SELECT 
                        er.*,
                        ec.claim_number,
                        u.first_name,
                        u.last_name
                    FROM expense_reimbursements er
                    JOIN expense_claims ec ON er.claim_id = ec.id
                    JOIN user u ON ec.employee_id = u.id
                    WHERE er.claim_id IN (${reimbursedIds.map(() => '?').join(',')})
                    ORDER BY er.reimbursement_date DESC
                `;
                const [reimb] = await db.execute(reimbursementsQuery, reimbursedIds);
                reimbursements = reimb;
            }

            // Calculate summary statistics
            const summary = this.calculateExpenseSummary(claims, expenseItems, reimbursements);

            const reportData = {
                claims,
                expenseItems,
                reimbursements,
                summary,
                period: { startDate, endDate }
            };

            if (format === 'pdf') {
                const filePath = await this.generateExpenseClaimsPDF(reportData);
                
                res.json({
                    success: true,
                    message: 'Expense claims report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            } else if (format === 'excel') {
                const filePath = await this.generateExpenseClaimsExcel(reportData);
                
                res.json({
                    success: true,
                    message: 'Expense claims report generated successfully',
                    downloadUrl: filePath,
                    summary
                });
            }

        } catch (error) {
            console.error('Error generating expense claims report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate expense claims report',
                error: error.message
            });
        }
    }

    // Helper Methods

    calculateExpenseSummary(claims, expenseItems, reimbursements) {
        const summary = {
            totalClaims: claims.length,
            pendingClaims: claims.filter(c => c.status === 'Pending').length,
            approvedClaims: claims.filter(c => c.status === 'Approved').length,
            rejectedClaims: claims.filter(c => c.status === 'Rejected').length,
            reimbursedClaims: claims.filter(c => c.status === 'Reimbursed').length,
            totalClaimedAmount: claims.reduce((sum, c) => sum + (parseFloat(c.total_amount) || 0), 0),
            totalApprovedAmount: claims.reduce((sum, c) => sum + (parseFloat(c.approved_amount) || 0), 0),
            totalReimbursedAmount: reimbursements.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
            totalExpenseItems: expenseItems.length,
            uniqueEmployees: new Set(claims.map(c => c.employee_id)).size,
            categories: {},
            departments: {}
        };

        // Calculate approval rate
        summary.approvalRate = summary.totalClaims > 0 ? 
            ((summary.approvedClaims + summary.reimbursedClaims) / summary.totalClaims * 100).toFixed(2) : 0;

        // Calculate reimbursement rate
        summary.reimbursementRate = summary.totalApprovedAmount > 0 ? 
            (summary.totalReimbursedAmount / summary.totalApprovedAmount * 100).toFixed(2) : 0;

        // Group by category
        claims.forEach(claim => {
            const category = claim.category_name || 'Uncategorized';
            if (!summary.categories[category]) {
                summary.categories[category] = {
                    claims: 0,
                    totalAmount: 0,
                    approvedAmount: 0,
                    approved: 0
                };
            }
            summary.categories[category].claims++;
            summary.categories[category].totalAmount += parseFloat(claim.total_amount) || 0;
            
            if (claim.status === 'Approved' || claim.status === 'Reimbursed') {
                summary.categories[category].approved++;
                summary.categories[category].approvedAmount += parseFloat(claim.approved_amount) || 0;
            }
        });

        // Group by department
        claims.forEach(claim => {
            const department = claim.department_name || 'Unassigned';
            if (!summary.departments[department]) {
                summary.departments[department] = {
                    claims: 0,
                    totalAmount: 0,
                    employees: new Set()
                };
            }
            summary.departments[department].claims++;
            summary.departments[department].totalAmount += parseFloat(claim.total_amount) || 0;
            summary.departments[department].employees.add(claim.employee_id);
        });

        // Convert sets to counts
        Object.keys(summary.departments).forEach(dept => {
            summary.departments[dept].uniqueEmployees = summary.departments[dept].employees.size;
            delete summary.departments[dept].employees;
        });

        return summary;
    }

    async generateExpenseClaimsPDF(reportData) {
        const { claims, summary, period } = reportData;
        
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `expense_claims_report_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, '../../uploads/reports', fileName);

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        doc.pipe(fs.createWriteStream(filePath));

        // Header
        doc.fontSize(20).text('EXPENSE CLAIMS REPORT', { align: 'center' });
        doc.fontSize(12).text(`Period: ${period.startDate} to ${period.endDate}`, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown();

        // Summary
        doc.fontSize(16).text('Claims Summary', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Claims: ${summary.totalClaims}`);
        doc.text(`Pending: ${summary.pendingClaims} | Approved: ${summary.approvedClaims} | Rejected: ${summary.rejectedClaims} | Reimbursed: ${summary.reimbursedClaims}`);
        doc.text(`Approval Rate: ${summary.approvalRate}% | Reimbursement Rate: ${summary.reimbursementRate}%`);
        doc.text(`Total Claimed Amount: $${summary.totalClaimedAmount.toFixed(2)}`);
        doc.text(`Total Approved Amount: $${summary.totalApprovedAmount.toFixed(2)}`);
        doc.text(`Total Reimbursed Amount: $${summary.totalReimbursedAmount.toFixed(2)}`);
        doc.text(`Total Expense Items: ${summary.totalExpenseItems}`);
        doc.text(`Unique Employees: ${summary.uniqueEmployees}`);
        doc.moveDown();

        // Category Breakdown
        doc.fontSize(14).text('Category Breakdown', { underline: true });
        doc.fontSize(8);
        let yPosition = doc.y + 10;

        Object.keys(summary.categories).forEach((category, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const catData = summary.categories[category];
            const categoryApprovalRate = catData.claims > 0 ? 
                (catData.approved / catData.claims * 100).toFixed(2) : 0;

            doc.text(`${index + 1}. ${category}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Claims: ${catData.claims} | Approved: ${catData.approved} (${categoryApprovalRate}%)`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Total: $${catData.totalAmount.toFixed(2)} | Approved: $${catData.approvedAmount.toFixed(2)}`, 70, yPosition);
            yPosition += 20;
        });

        yPosition += 10;

        // Department Breakdown
        doc.fontSize(14).text('Department Breakdown', { underline: true });
        doc.fontSize(8);
        yPosition = doc.y + 10;

        Object.keys(summary.departments).forEach((department, index) => {
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            const deptData = summary.departments[department];

            doc.text(`${index + 1}. ${department}`, 50, yPosition);
            yPosition += 12;
            doc.text(`   Claims: ${deptData.claims} | Employees: ${deptData.uniqueEmployees}`, 70, yPosition);
            yPosition += 12;
            doc.text(`   Total Amount: $${deptData.totalAmount.toFixed(2)}`, 70, yPosition);
            yPosition += 20;
        });

        yPosition += 10;

        // Individual Claims
        if (claims.length > 0) {
            if (yPosition > 600) {
                doc.addPage();
                yPosition = 50;
            }

            doc.fontSize(14).text('Claim Details', { underline: true });
            doc.fontSize(8);
            yPosition = doc.y + 10;

            claims.slice(0, 50).forEach((claim, index) => { // Show latest 50 claims
                if (yPosition > 700) {
                    doc.addPage();
                    yPosition = 50;
                }

                const claimDate = new Date(claim.claim_date).toLocaleDateString();
                const approvedDate = claim.approved_on ? new Date(claim.approved_on).toLocaleDateString() : 'N/A';

                doc.text(`${index + 1}. ${claim.claim_number} - ${claim.first_name} ${claim.last_name} (${claim.employee_id})`, 50, yPosition);
                yPosition += 12;
                doc.text(`   Category: ${claim.category_name || 'N/A'} | Status: ${claim.status}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Amount: $${parseFloat(claim.total_amount || 0).toFixed(2)} | Approved: $${parseFloat(claim.approved_amount || 0).toFixed(2)}`, 70, yPosition);
                yPosition += 12;
                doc.text(`   Claim Date: ${claimDate} | Approved: ${approvedDate}`, 70, yPosition);
                yPosition += 12;
                
                if (claim.approver_first_name) {
                    doc.text(`   Approved by: ${claim.approver_first_name} ${claim.approver_last_name}`, 70, yPosition);
                    yPosition += 12;
                }

                if (claim.description) {
                    const description = claim.description.length > 60 ? 
                        claim.description.substring(0, 60) + '...' : claim.description;
                    doc.text(`   Description: ${description}`, 70, yPosition);
                    yPosition += 12;
                }

                yPosition += 15;
            });
        }

        doc.end();
        return `/uploads/reports/${fileName}`;
    }

    async generateExpenseClaimsExcel(reportData) {
        const { claims, expenseItems, reimbursements, summary, period } = reportData;
        
        const workbook = new ExcelJS.Workbook();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Claims Summary');
        
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'EXPENSE CLAIMS REPORT';
        summarySheet.getCell('A1').font = { bold: true, size: 16 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };

        summarySheet.getCell('A3').value = 'Period:';
        summarySheet.getCell('B3').value = `${period.startDate} to ${period.endDate}`;

        const summaryData = [
            ['Metric', 'Value'],
            ['Total Claims', summary.totalClaims],
            ['Pending Claims', summary.pendingClaims],
            ['Approved Claims', summary.approvedClaims],
            ['Rejected Claims', summary.rejectedClaims],
            ['Reimbursed Claims', summary.reimbursedClaims],
            ['Approval Rate (%)', summary.approvalRate],
            ['Reimbursement Rate (%)', summary.reimbursementRate],
            ['Total Claimed Amount', `$${summary.totalClaimedAmount.toFixed(2)}`],
            ['Total Approved Amount', `$${summary.totalApprovedAmount.toFixed(2)}`],
            ['Total Reimbursed Amount', `$${summary.totalReimbursedAmount.toFixed(2)}`],
            ['Total Expense Items', summary.totalExpenseItems],
            ['Unique Employees', summary.uniqueEmployees]
        ];

        summarySheet.addTable({
            name: 'ClaimsSummary',
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
            { header: 'Total Claims', key: 'totalClaims', width: 12 },
            { header: 'Approved Claims', key: 'approvedClaims', width: 15 },
            { header: 'Approval Rate (%)', key: 'approvalRate', width: 15 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Approved Amount', key: 'approvedAmount', width: 15 }
        ];

        Object.keys(summary.categories).forEach(category => {
            const catData = summary.categories[category];
            const approvalRate = catData.claims > 0 ? 
                (catData.approved / catData.claims * 100).toFixed(2) : 0;

            categorySheet.addRow({
                category: category,
                totalClaims: catData.claims,
                approvedClaims: catData.approved,
                approvalRate: approvalRate,
                totalAmount: catData.totalAmount.toFixed(2),
                approvedAmount: catData.approvedAmount.toFixed(2)
            });
        });

        // Style headers
        categorySheet.getRow(1).font = { bold: true };
        categorySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Claims Details Sheet
        const claimsSheet = workbook.addWorksheet('Claims Details');
        
        claimsSheet.columns = [
            { header: 'Claim Number', key: 'claimNumber', width: 20 },
            { header: 'Employee ID', key: 'employeeId', width: 15 },
            { header: 'Employee Name', key: 'employeeName', width: 20 },
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Job Title', key: 'jobTitle', width: 20 },
            { header: 'Category', key: 'category', width: 20 },
            { header: 'Claim Date', key: 'claimDate', width: 12 },
            { header: 'Total Amount', key: 'totalAmount', width: 12 },
            { header: 'Approved Amount', key: 'approvedAmount', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Approved Date', key: 'approvedDate', width: 12 },
            { header: 'Approved By', key: 'approvedBy', width: 20 },
            { header: 'Description', key: 'description', width: 40 }
        ];

        claims.forEach(claim => {
            claimsSheet.addRow({
                claimNumber: claim.claim_number,
                employeeId: claim.employee_id,
                employeeName: `${claim.first_name} ${claim.last_name}`,
                department: claim.department_name || 'N/A',
                jobTitle: claim.job_title || 'N/A',
                category: claim.category_name || 'N/A',
                claimDate: new Date(claim.claim_date).toLocaleDateString(),
                totalAmount: parseFloat(claim.total_amount || 0).toFixed(2),
                approvedAmount: parseFloat(claim.approved_amount || 0).toFixed(2),
                status: claim.status,
                approvedDate: claim.approved_on ? new Date(claim.approved_on).toLocaleDateString() : 'N/A',
                approvedBy: claim.approver_first_name && claim.approver_last_name ? 
                    `${claim.approver_first_name} ${claim.approver_last_name}` : 'N/A',
                description: claim.description || 'N/A'
            });
        });

        // Style headers
        claimsSheet.getRow(1).font = { bold: true };
        claimsSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Expense Items Sheet
        if (expenseItems.length > 0) {
            const itemsSheet = workbook.addWorksheet('Expense Items');
            
            itemsSheet.columns = [
                { header: 'Claim Number', key: 'claimNumber', width: 20 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Expense Date', key: 'expenseDate', width: 12 },
                { header: 'Description', key: 'description', width: 30 },
                { header: 'Amount', key: 'amount', width: 12 },
                { header: 'Currency', key: 'currency', width: 10 },
                { header: 'Exchange Rate', key: 'exchangeRate', width: 12 },
                { header: 'Local Amount', key: 'localAmount', width: 12 },
                { header: 'Receipt Number', key: 'receiptNumber', width: 20 },
                { header: 'Vendor', key: 'vendor', width: 25 }
            ];

            expenseItems.forEach(item => {
                itemsSheet.addRow({
                    claimNumber: item.claim_number,
                    employeeName: `${item.first_name} ${item.last_name}`,
                    expenseDate: new Date(item.expense_date).toLocaleDateString(),
                    description: item.description || 'N/A',
                    amount: parseFloat(item.amount || 0).toFixed(2),
                    currency: item.currency || 'N/A',
                    exchangeRate: parseFloat(item.exchange_rate || 1).toFixed(4),
                    localAmount: parseFloat(item.local_amount || 0).toFixed(2),
                    receiptNumber: item.receipt_number || 'N/A',
                    vendor: item.vendor || 'N/A'
                });
            });

            // Style headers
            itemsSheet.getRow(1).font = { bold: true };
            itemsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        // Reimbursements Sheet
        if (reimbursements.length > 0) {
            const reimbursementsSheet = workbook.addWorksheet('Reimbursements');
            
            reimbursementsSheet.columns = [
                { header: 'Claim Number', key: 'claimNumber', width: 20 },
                { header: 'Employee Name', key: 'employeeName', width: 20 },
                { header: 'Reimbursement Date', key: 'reimbursementDate', width: 18 },
                { header: 'Amount', key: 'amount', width: 12 },
                { header: 'Payment Method', key: 'paymentMethod', width: 15 },
                { header: 'Reference Number', key: 'referenceNumber', width: 20 },
                { header: 'Bank Account', key: 'bankAccount', width: 20 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];

            reimbursements.forEach(reimbursement => {
                reimbursementsSheet.addRow({
                    claimNumber: reimbursement.claim_number,
                    employeeName: `${reimbursement.first_name} ${reimbursement.last_name}`,
                    reimbursementDate: new Date(reimbursement.reimbursement_date).toLocaleDateString(),
                    amount: parseFloat(reimbursement.amount || 0).toFixed(2),
                    paymentMethod: reimbursement.payment_method || 'N/A',
                    referenceNumber: reimbursement.reference_number || 'N/A',
                    bankAccount: reimbursement.bank_account || 'N/A',
                    notes: reimbursement.notes || 'N/A'
                });
            });

            // Style headers
            reimbursementsSheet.getRow(1).font = { bold: true };
            reimbursementsSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        }

        const fileName = `expense_claims_report_${Date.now()}.xlsx`;
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

module.exports = new ExpenseReportsController();
