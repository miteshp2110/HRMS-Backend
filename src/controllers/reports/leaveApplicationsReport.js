// src/controller/reports/leaveApplicationsReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Leave Applications Report
 */
const generateLeaveApplicationsReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      leaveTypeIds,
      approvalStatus 
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('(la.from_date BETWEEN ? AND ? OR la.to_date BETWEEN ? AND ?)');
      queryParams.push(fromDate, toDate, fromDate, toDate);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`la.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (leaveTypeIds && leaveTypeIds.length > 0) {
      whereConditions.push(`la.leave_type IN (${leaveTypeIds.map(() => '?').join(',')})`);
      queryParams.push(...leaveTypeIds);
    }

    if (approvalStatus) {
      whereConditions.push('la.primary_status = ?');
      queryParams.push(approvalStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        la.id AS application_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        lt.name AS leave_type_name,
        
        la.from_date AS start_date,
        la.to_date AS end_date,
        DATEDIFF(la.to_date, la.from_date) + 1 AS total_days,
        la.leave_description AS reason,
        la.primary_status,
        la.secondry_status,
        la.applied_date AS applied_at,
        
        CONCAT(primary_user.first_name, ' ', primary_user.last_name) AS primary_approver_name,
        CONCAT(secondary_user.first_name, ' ', secondary_user.last_name) AS secondary_approver_name,
        
        la.rejection_reason,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name
        
      FROM employee_leave_records la
      INNER JOIN user u ON la.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      INNER JOIN leave_types lt ON la.leave_type = lt.id
      LEFT JOIN user primary_user ON la.primary_user = primary_user.id
      LEFT JOIN user secondary_user ON la.secondry_user = secondary_user.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      ${whereClause}
      ORDER BY la.applied_date DESC
    `;

    const [applications] = await execute(query, queryParams);

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leave applications found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Applications Report');

    worksheet.columns = [
      { header: 'Application ID', key: 'application_id', width: 14 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Leave Type', key: 'leave_type_name', width: 20 },
      { header: 'Start Date', key: 'start_date', width: 12 },
      { header: 'End Date', key: 'end_date', width: 12 },
      { header: 'Total Days', key: 'total_days', width: 12 },
      { header: 'Reason', key: 'reason', width: 35 },
      { header: 'Primary Status', key: 'primary_status', width: 14 },
      { header: 'Secondary Status', key: 'secondry_status', width: 16 },
      { header: 'Applied At', key: 'applied_at', width: 18 },
      { header: 'Primary Approver', key: 'primary_approver_name', width: 25 },
      { header: 'Secondary Approver', key: 'secondary_approver_name', width: 25 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    applications.forEach(app => {
      const row = worksheet.addRow({
        application_id: app.application_id,
        full_name: app.full_name,
        email: app.email,
        job_title: app.job_title || 'N/A',
        manager_name: app.manager_name || 'N/A',
        leave_type_name: app.leave_type_name,
        start_date: app.start_date,
        end_date: app.end_date,
        total_days: app.total_days,
        reason: app.reason || 'N/A',
        primary_status: app.primary_status ? 'Approved' : 'Pending/Rejected',
        secondry_status: app.secondry_status ? 'Approved' : (app.secondry_status === false ? 'Rejected' : 'N/A'),
        applied_at: app.applied_at,
        primary_approver_name: app.primary_approver_name || 'N/A',
        secondary_approver_name: app.secondary_approver_name || 'N/A',
        rejection_reason: app.rejection_reason || 'N/A'
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

      // Color code primary status
      const statusCell = row.getCell('primary_status');
      if (app.primary_status === true || app.primary_status === 1) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (app.primary_status === false || app.primary_status === 0) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else {
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
    const filename = `Leave_Applications_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating leave applications report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLeaveApplicationsReport };
