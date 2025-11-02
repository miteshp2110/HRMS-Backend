// src/controller/reports/leaveBalanceReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Leave Balance Report
 */
const generateLeaveBalanceReport = async (req, res) => {
  try {
    const { employeeIds, leaveTypeIds } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`lb.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (leaveTypeIds && leaveTypeIds.length > 0) {
      whereConditions.push(`lb.leave_id IN (${leaveTypeIds.map(() => '?').join(',')})`);
      queryParams.push(...leaveTypeIds);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        u.joining_date AS date_of_joining,
        u.is_active,
        j.title AS job_title,
        
        lt.name AS leave_type_name,
        lt.initial_balance,
        lt.max_balance,
        
        lb.balance AS available_days,
        lb.updated_at AS last_updated
        
      FROM employee_leave_balance lb
      INNER JOIN user u ON lb.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      INNER JOIN leave_types lt ON lb.leave_id = lt.id
      ${whereClause}
      ORDER BY u.first_name ASC, lt.name ASC
    `;

    const [balances] = await execute(query, queryParams);

    if (!balances || balances.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leave balance records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Balance Report');

    worksheet.columns = [
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Date of Joining', key: 'date_of_joining', width: 15 },
      { header: 'Leave Type', key: 'leave_type_name', width: 20 },
      { header: 'Initial Balance', key: 'initial_balance', width: 14 },
      { header: 'Max Balance', key: 'max_balance', width: 12 },
      { header: 'Available Days', key: 'available_days', width: 14 },
      { header: 'Last Updated', key: 'last_updated', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00897B' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    balances.forEach(balance => {
      const row = worksheet.addRow({
        full_name: balance.full_name,
        email: balance.email,
        job_title: balance.job_title || 'N/A',
        is_active: balance.is_active ? 'Yes' : 'No',
        date_of_joining: balance.date_of_joining,
        leave_type_name: balance.leave_type_name,
        initial_balance: balance.initial_balance || 0,
        max_balance: balance.max_balance || 0,
        available_days: balance.available_days || 0,
        last_updated: balance.last_updated
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

      // Format days
      row.getCell('initial_balance').numFmt = '0.00';
      row.getCell('max_balance').numFmt = '0.00';
      row.getCell('available_days').numFmt = '0.00';

      // Highlight low balance (less than 2 days)
      if (balance.available_days < 2) {
        row.getCell('available_days').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF5252' }
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
    const filename = `Leave_Balance_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating leave balance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLeaveBalanceReport };
