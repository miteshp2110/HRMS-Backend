// src/controller/reports/loanAmortizationReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Loan Amortization Report
 */
const generateLoanAmortizationReport = async (req, res) => {
  try {
    const { 
      employeeIds,
      loanStatus,
      fromDate,
      toDate
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`l.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (loanStatus) {
      whereConditions.push('l.status = ?');
      queryParams.push(loanStatus);
    }

    if (fromDate && toDate) {
      whereConditions.push('l.created_at BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        l.id AS loan_id,
        l.application_id_text,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        lt.name AS loan_type_name,
        l.requested_amount,
        l.approved_amount AS loan_amount,
        l.tenure_months,
        l.emi_amount AS monthly_deduction,
        l.interest_rate,
        l.purpose,
        l.status,
        
        l.disbursement_date,
        l.jv_number,
        l.created_at AS applied_date,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name,
        CONCAT(hr.first_name, ' ', hr.last_name) AS hr_approver_name,
        l.rejection_reason,
        
        (SELECT COUNT(*) FROM loan_repayments lr WHERE lr.loan_application_id = l.id) AS payments_made,
        (SELECT COALESCE(SUM(lr.repayment_amount), 0) FROM loan_repayments lr WHERE lr.loan_application_id = l.id) AS total_repaid,
        (l.approved_amount - COALESCE((SELECT SUM(lr.repayment_amount) FROM loan_repayments lr WHERE lr.loan_application_id = l.id), 0)) AS balance_amount
        
      FROM loan_applications l
      INNER JOIN user u ON l.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN loan_types lt ON l.loan_type_id = lt.id
      LEFT JOIN user mgr ON l.manager_approver_id = mgr.id
      LEFT JOIN user hr ON l.hr_approver_id = hr.id
      ${whereClause}
      ORDER BY l.created_at DESC, u.first_name ASC
    `;

    const [loans] = await execute(query, queryParams);

    if (!loans || loans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No loan records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Loan Amortization Report');

    worksheet.columns = [
      { header: 'Loan ID', key: 'loan_id', width: 10 },
      { header: 'Application ID', key: 'application_id_text', width: 16 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Loan Type', key: 'loan_type_name', width: 18 },
      { header: 'Requested Amount (AED)', key: 'requested_amount', width: 20 },
      { header: 'Approved Amount (AED)', key: 'loan_amount', width: 20 },
      { header: 'Tenure (Months)', key: 'tenure_months', width: 14 },
      { header: 'EMI Amount (AED)', key: 'monthly_deduction', width: 16 },
      { header: 'Interest Rate (%)', key: 'interest_rate', width: 14 },
      { header: 'Total Repaid (AED)', key: 'total_repaid', width: 16 },
      { header: 'Balance (AED)', key: 'balance_amount', width: 14 },
      { header: 'Payments Made', key: 'payments_made', width: 14 },
      { header: 'Purpose', key: 'purpose', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Applied Date', key: 'applied_date', width: 15 },
      { header: 'Disbursement Date', key: 'disbursement_date', width: 16 },
      { header: 'JV Number', key: 'jv_number', width: 16 },
      { header: 'HR Approver', key: 'hr_approver_name', width: 25 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE91E63' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    loans.forEach(loan => {
      const row = worksheet.addRow({
        loan_id: loan.loan_id,
        application_id_text: loan.application_id_text || 'N/A',
        full_name: loan.full_name,
        email: loan.email,
        job_title: loan.job_title || 'N/A',
        manager_name: loan.manager_name || 'N/A',
        loan_type_name: loan.loan_type_name || 'N/A',
        requested_amount: loan.requested_amount,
        loan_amount: loan.loan_amount || 0,
        tenure_months: loan.tenure_months || 0,
        monthly_deduction: loan.monthly_deduction || 0,
        interest_rate: loan.interest_rate || 0,
        total_repaid: loan.total_repaid || 0,
        balance_amount: loan.balance_amount || 0,
        payments_made: loan.payments_made || 0,
        purpose: loan.purpose || 'N/A',
        status: loan.status,
        applied_date: loan.applied_date,
        disbursement_date: loan.disbursement_date || 'N/A',
        jv_number: loan.jv_number || 'N/A',
        hr_approver_name: loan.hr_approver_name || 'N/A',
        rejection_reason: loan.rejection_reason || 'N/A'
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

      // Format currency cells
      ['requested_amount', 'loan_amount', 'monthly_deduction', 'total_repaid', 'balance_amount'].forEach(col => {
        const cell = row.getCell(col);
        cell.numFmt = '#,##0.00';
      });

      // Format interest rate
      row.getCell('interest_rate').numFmt = '0.00"%"';

      // Color code status
      const statusCell = row.getCell('status');
      if (loan.status === 'approved') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (loan.status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (loan.status === 'pending') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA726' }
        };
      } else if (loan.status === 'closed') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF42A5F5' }
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
    const filename = `Loan_Amortization_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating loan amortization report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLoanAmortizationReport };
