// src/controller/reports/inactiveProbationReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Inactive and Probation Employees Report
 */
const generateInactiveProbationReport = async (req, res) => {
  try {
    const { reportType, employeeIds } = req.body;
    // reportType: 'inactive', 'probation', 'both'

    let whereConditions = [];
    let queryParams = [];

    if (reportType === 'inactive') {
      whereConditions.push("u.is_active = 0");
    } else if (reportType === 'probation') {
      whereConditions.push("u.is_probation = 1");
    } else {
      whereConditions.push("(u.is_active = 0 OR u.is_probation = 1)");
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`u.id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        u.id AS employee_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        u.phone,
        u.joining_date AS date_of_joining,
        u.is_active,
        u.is_probation,
        u.probation_days,
        u.inactive_date,
        u.inactive_reason,
        
        j.title AS job_title,
        r.name AS role_name,
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name,
        
        DATEDIFF(DATE_ADD(u.joining_date, INTERVAL u.probation_days DAY), CURDATE()) AS days_until_probation_end
        
      FROM user u
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN roles r ON u.system_role = r.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      ${whereClause}
      ORDER BY u.is_active ASC, u.is_probation DESC, u.id ASC
    `;

    const [employees] = await execute(query, queryParams);

    if (!employees || employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No employees found matching the criteria'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inactive & Probation Report');

    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 12 },
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Role', key: 'role_name', width: 15 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Probation', key: 'is_probation', width: 12 },
      { header: 'Date of Joining', key: 'date_of_joining', width: 15 },
      { header: 'Probation Days', key: 'probation_days', width: 14 },
      { header: 'Days Until Probation End', key: 'days_until_probation_end', width: 22 },
      { header: 'Inactive Date', key: 'inactive_date', width: 15 },
      { header: 'Inactive Reason', key: 'inactive_reason', width: 35 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32F2F' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    employees.forEach(emp => {
      const row = worksheet.addRow({
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        email: emp.email,
        phone: emp.phone,
        job_title: emp.job_title || 'N/A',
        role_name: emp.role_name || 'N/A',
        manager_name: emp.manager_name || 'N/A',
        is_active: emp.is_active ? 'Yes' : 'No',
        is_probation: emp.is_probation ? 'Yes' : 'No',
        date_of_joining: emp.date_of_joining,
        probation_days: emp.probation_days || 0,
        days_until_probation_end: emp.days_until_probation_end || 'N/A',
        inactive_date: emp.inactive_date || 'N/A',
        inactive_reason: emp.inactive_reason || 'N/A'
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

      // Highlight probation ending soon (less than 7 days)
      if (emp.is_probation && emp.days_until_probation_end > 0 && emp.days_until_probation_end <= 7) {
        row.getCell('days_until_probation_end').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEB3B' }
        };
      }

      // Highlight inactive employees
      if (!emp.is_active) {
        row.getCell('is_active').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
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
    const filename = `Inactive_Probation_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating inactive/probation report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateInactiveProbationReport };
