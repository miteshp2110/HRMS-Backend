// src/controller/reports/hrCasesReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate HR Cases Report
 */
const generateHrCasesReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      caseStatus
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('c.created_at BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`c.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (caseStatus) {
      whereConditions.push('c.status = ?');
      queryParams.push(caseStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        c.id AS case_id,
        c.case_id_text,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        cat.name AS category_name,
        c.title AS case_title,
        c.description AS case_description,
        c.status,
        c.deduction_amount,
        c.rejection_reason,
        c.is_deduction_synced,
        c.created_at,
        c.updated_at,
        
        CONCAT(assignee.first_name, ' ', assignee.last_name) AS assigned_to_name,
        CONCAT(raiser.first_name, ' ', raiser.last_name) AS raised_by_name,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name,
        
        ps.id AS payslip_id,
        
        DATEDIFF(NOW(), c.created_at) AS days_open
        
      FROM hr_cases c
      INNER JOIN user u ON c.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN case_categories cat ON c.category_id = cat.id
      LEFT JOIN user assignee ON c.assigned_to = assignee.id
      LEFT JOIN user raiser ON c.raised_by = raiser.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      LEFT JOIN payslips ps ON c.payslip_id = ps.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    const [cases] = await execute(query, queryParams);

    if (!cases || cases.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No HR cases found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HR Cases Report');

    worksheet.columns = [
      { header: 'Case ID', key: 'case_id', width: 10 },
      { header: 'Case ID Text', key: 'case_id_text', width: 16 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Category', key: 'category_name', width: 20 },
      { header: 'Case Title', key: 'case_title', width: 30 },
      { header: 'Description', key: 'case_description', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Deduction Amount (AED)', key: 'deduction_amount', width: 18 },
      { header: 'Deduction Synced', key: 'is_deduction_synced', width: 16 },
      { header: 'Payslip ID', key: 'payslip_id', width: 12 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 },
      { header: 'Days Open', key: 'days_open', width: 12 },
      { header: 'Raised By', key: 'raised_by_name', width: 25 },
      { header: 'Assigned To', key: 'assigned_to_name', width: 25 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF607D8B' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    cases.forEach(hrCase => {
      const row = worksheet.addRow({
        case_id: hrCase.case_id,
        case_id_text: hrCase.case_id_text || 'N/A',
        full_name: hrCase.full_name,
        email: hrCase.email,
        job_title: hrCase.job_title || 'N/A',
        manager_name: hrCase.manager_name || 'N/A',
        category_name: hrCase.category_name || 'N/A',
        case_title: hrCase.case_title,
        case_description: hrCase.case_description || 'N/A',
        status: hrCase.status,
        deduction_amount: hrCase.deduction_amount || 0,
        is_deduction_synced: hrCase.is_deduction_synced ? 'Yes' : 'No',
        payslip_id: hrCase.payslip_id || 'N/A',
        created_at: hrCase.created_at,
        updated_at: hrCase.updated_at,
        days_open: hrCase.days_open || 0,
        raised_by_name: hrCase.raised_by_name || 'N/A',
        assigned_to_name: hrCase.assigned_to_name || 'Unassigned',
        rejection_reason: hrCase.rejection_reason || 'N/A'
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
      row.getCell('deduction_amount').numFmt = '#,##0.00';

      // Color code status
      const statusCell = row.getCell('status');
      if (hrCase.status === 'closed' || hrCase.status === 'resolved') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (hrCase.status === 'open' || hrCase.status === 'new') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA726' }
        };
      } else if (hrCase.status === 'in_progress') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF42A5F5' }
        };
      } else if (hrCase.status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      }

      // Highlight cases open more than 30 days
      if (hrCase.days_open > 30 && hrCase.status !== 'closed') {
        row.getCell('days_open').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      }

      // Highlight synced deductions
      if (hrCase.is_deduction_synced) {
        row.getCell('is_deduction_synced').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
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
    const filename = `HR_Cases_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating HR cases report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateHrCasesReport };
