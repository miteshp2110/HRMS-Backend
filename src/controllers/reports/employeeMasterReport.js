// src/controller/reports/employeeMasterReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Employee Master Report
 * Based on actual schema: user table with proper fields
 */
const generateEmployeeMasterReport = async (req, res) => {
  try {
    const {
      employeeIds,
      jobIds,
      includeInactive = false
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`u.id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (jobIds && jobIds.length > 0) {
      whereConditions.push(`u.job_role IN (${jobIds.map(() => '?').join(',')})`);
      queryParams.push(...jobIds);
    }

    if (!includeInactive) {
      whereConditions.push("u.is_active = 1");
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Fixed query without LIMIT in subquery
    const query = `
      SELECT 
        u.id AS employee_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.gender,
        u.dob AS date_of_birth,
        u.joining_date AS date_of_joining,
        u.is_active,
        u.is_probation,
        u.probation_days,
        u.nationality,
        u.inactive_date,
        u.inactive_reason,
        
        j.title AS job_title,
        j.description AS job_description,
        s.name AS shift_name,
        r.name AS role_name,
        
        (SELECT pg.group_name 
         FROM employee_salary_structure ess 
         INNER JOIN payroll_group_components pgc ON pgc.component_id = ess.component_id
         INNER JOIN payroll_groups pg ON pg.id = pgc.group_id
         WHERE ess.employee_id = u.id
         GROUP BY pg.group_name
         ORDER BY pg.id
         LIMIT 1
        ) AS payroll_group,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name,
        
        bd.bank_name,
        bd.bank_account,
        bd.bank_ifsc,
        
        u.emergency_contact_name,
        u.emergency_contact_relation,
        u.emergency_contact_number,
        
        u.created_at,
        u.updated_at
        
      FROM user u
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN shifts s ON u.shift = s.id
      LEFT JOIN roles r ON u.system_role = r.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      LEFT JOIN bank_details bd ON u.id = bd.user_id
      ${whereClause}
      ORDER BY u.id ASC
    `;

    const [employees] = await execute(query, queryParams);

    if (!employees || employees.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No employees found matching the criteria' 
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Master Report');

    worksheet.columns = [
      { header: 'Employee ID', key: 'employee_id', width: 12 },
      { header: 'Full Name', key: 'full_name', width: 25 },
      { header: 'First Name', key: 'first_name', width: 15 },
      { header: 'Last Name', key: 'last_name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
      { header: 'Nationality', key: 'nationality', width: 15 },
      { header: 'Date of Joining', key: 'date_of_joining', width: 15 },
      { header: 'Active', key: 'is_active', width: 10 },
      { header: 'Probation', key: 'is_probation', width: 12 },
      { header: 'Probation Days', key: 'probation_days', width: 14 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Shift', key: 'shift_name', width: 15 },
      { header: 'Role', key: 'role_name', width: 15 },
      { header: 'Payroll Group', key: 'payroll_group', width: 18 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Bank Name', key: 'bank_name', width: 20 },
      { header: 'Account Number', key: 'bank_account', width: 20 },
      { header: 'IFSC Code', key: 'bank_ifsc', width: 15 },
      { header: 'Emergency Contact Name', key: 'emergency_contact_name', width: 25 },
      { header: 'Emergency Relation', key: 'emergency_contact_relation', width: 20 },
      { header: 'Emergency Phone', key: 'emergency_contact_number', width: 18 },
      { header: 'Inactive Date', key: 'inactive_date', width: 15 },
      { header: 'Inactive Reason', key: 'inactive_reason', width: 30 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    employees.forEach(emp => {
      const row = worksheet.addRow({
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        first_name: emp.first_name,
        last_name: emp.last_name,
        email: emp.email,
        phone: emp.phone,
        gender: emp.gender,
        date_of_birth: emp.date_of_birth,
        nationality: emp.nationality || 'N/A',
        date_of_joining: emp.date_of_joining,
        is_active: emp.is_active ? 'Yes' : 'No',
        is_probation: emp.is_probation ? 'Yes' : 'No',
        probation_days: emp.probation_days || 0,
        job_title: emp.job_title || 'N/A',
        shift_name: emp.shift_name || 'N/A',
        role_name: emp.role_name || 'N/A',
        payroll_group: emp.payroll_group || 'N/A',
        manager_name: emp.manager_name || 'N/A',
        bank_name: emp.bank_name || 'N/A',
        bank_account: emp.bank_account || 'N/A',
        bank_ifsc: emp.bank_ifsc || 'N/A',
        emergency_contact_name: emp.emergency_contact_name,
        emergency_contact_relation: emp.emergency_contact_relation,
        emergency_contact_number: emp.emergency_contact_number,
        inactive_date: emp.inactive_date || 'N/A',
        inactive_reason: emp.inactive_reason || 'N/A',
        created_at: emp.created_at,
        updated_at: emp.updated_at
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

      // Highlight inactive employees
      if (!emp.is_active) {
        row.getCell('is_active').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      }

      // Highlight probation employees
      if (emp.is_probation) {
        row.getCell('is_probation').fill = {
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
    const filename = `Employee_Master_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating employee master report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate employee master report',
      error: error.message
    });
  }
};

module.exports = { generateEmployeeMasterReport };
