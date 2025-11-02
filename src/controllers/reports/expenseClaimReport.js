// src/controller/reports/expenseClaimReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Expense Claim Report
 */
const generateExpenseClaimReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      approvalStatus,
      expenseCategory
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('ec.expense_date BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`ec.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (approvalStatus) {
      whereConditions.push('ec.status = ?');
      queryParams.push(approvalStatus);
    }

    if (expenseCategory) {
      whereConditions.push('ec.category_id = ?');
      queryParams.push(expenseCategory);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        ec.id AS expense_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        ec.claim_type,
        cat.name AS category_name,
        ec.title AS expense_title,
        ec.expense_date,
        ec.amount,
        ec.description,
        ec.status,
        ec.reimbursement_method,
        ec.created_at AS submitted_at,
        
        CONCAT(approver.first_name, ' ', approver.last_name) AS approved_by_name,
        ec.approval_date,
        
        CONCAT(processor.first_name, ' ', processor.last_name) AS processed_by_name,
        ec.processed_date,
        ec.rejection_reason,
        
        ec.transaction_id,
        ps.id AS payslip_id,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name
        
      FROM expense_claims ec
      INNER JOIN user u ON ec.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN expense_categories cat ON ec.category_id = cat.id
      LEFT JOIN user approver ON ec.approved_by = approver.id
      LEFT JOIN user processor ON ec.processed_by = processor.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      LEFT JOIN payslips ps ON ec.reimbursed_in_payroll_id = ps.id
      ${whereClause}
      ORDER BY ec.expense_date DESC, u.first_name ASC
    `;

    const [expenses] = await execute(query, queryParams);

    if (!expenses || expenses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No expense claims found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expense Claim Report');

    worksheet.columns = [
      { header: 'Expense ID', key: 'expense_id', width: 12 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Claim Type', key: 'claim_type', width: 14 },
      { header: 'Expense Date', key: 'expense_date', width: 14 },
      { header: 'Category', key: 'category_name', width: 18 },
      { header: 'Title', key: 'expense_title', width: 25 },
      { header: 'Amount (AED)', key: 'amount', width: 14 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reimbursement Method', key: 'reimbursement_method', width: 20 },
      { header: 'Submitted At', key: 'submitted_at', width: 18 },
      { header: 'Approved By', key: 'approved_by_name', width: 25 },
      { header: 'Approval Date', key: 'approval_date', width: 18 },
      { header: 'Processed By', key: 'processed_by_name', width: 25 },
      { header: 'Processed Date', key: 'processed_date', width: 18 },
      { header: 'Payslip ID', key: 'payslip_id', width: 12 },
      { header: 'Transaction ID', key: 'transaction_id', width: 20 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF5722' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    expenses.forEach(expense => {
      const row = worksheet.addRow({
        expense_id: expense.expense_id,
        full_name: expense.full_name,
        email: expense.email,
        job_title: expense.job_title || 'N/A',
        manager_name: expense.manager_name || 'N/A',
        claim_type: expense.claim_type || 'N/A',
        expense_date: expense.expense_date,
        category_name: expense.category_name || 'N/A',
        expense_title: expense.expense_title,
        amount: expense.amount,
        description: expense.description || 'N/A',
        status: expense.status,
        reimbursement_method: expense.reimbursement_method || 'N/A',
        submitted_at: expense.submitted_at,
        approved_by_name: expense.approved_by_name || 'N/A',
        approval_date: expense.approval_date || 'N/A',
        processed_by_name: expense.processed_by_name || 'N/A',
        processed_date: expense.processed_date || 'N/A',
        payslip_id: expense.payslip_id || 'N/A',
        transaction_id: expense.transaction_id || 'N/A',
        rejection_reason: expense.rejection_reason || 'N/A'
      });

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
      });

      // Format currency
      row.getCell('amount').numFmt = '#,##0.00';

      // Color code status
      const statusCell = row.getCell('status');
      if (expense.status === 'approved') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (expense.status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (expense.status === 'pending') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA726' }
        };
      }
    });

    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Expense_Claim_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating expense claim report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateExpenseClaimReport };
