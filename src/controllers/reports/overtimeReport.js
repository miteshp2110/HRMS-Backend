// src/controller/reports/overtimeReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Overtime Report
 */
const generateOvertimeReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      approvalStatus 
    } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required'
      });
    }

    let whereConditions = ['ot.request_date BETWEEN ? AND ?'];
    let queryParams = [fromDate, toDate];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`ot.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (approvalStatus) {
      whereConditions.push('ot.status = ?');
      queryParams.push(approvalStatus);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        ot.id AS overtime_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        ot.request_date AS overtime_date,
        ot.overtime_hours,
        ot.approved_hours,
        ot.reason,
        ot.status,
        ot.overtime_type,
        ot.overtime_start,
        ot.overtime_end,
        
        CONCAT(processor.first_name, ' ', processor.last_name) AS processed_by_name,
        ot.processed_at,
        ot.rejection_reason,
        
        ar.punch_in,
        ar.punch_out,
        ar.hours_worked AS regular_hours,
        s.name AS shift_name,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name
        
      FROM employee_overtime_records ot
      INNER JOIN user u ON ot.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN user processor ON ot.processed_by = processor.id
      LEFT JOIN attendance_record ar ON ot.attendance_record_id = ar.id
      LEFT JOIN shifts s ON ar.shift = s.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      ${whereClause}
      ORDER BY ot.request_date DESC, u.first_name ASC
    `;

    const [records] = await execute(query, queryParams);

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No overtime records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Overtime Report');

    worksheet.columns = [
      { header: 'OT ID', key: 'overtime_id', width: 10 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'OT Date', key: 'overtime_date', width: 12 },
      { header: 'OT Type', key: 'overtime_type', width: 12 },
      { header: 'Shift', key: 'shift_name', width: 15 },
      { header: 'Punch In', key: 'punch_in', width: 18 },
      { header: 'Punch Out', key: 'punch_out', width: 18 },
      { header: 'Regular Hours', key: 'regular_hours', width: 14 },
      { header: 'OT Hours Requested', key: 'overtime_hours', width: 18 },
      { header: 'OT Hours Approved', key: 'approved_hours', width: 18 },
      { header: 'OT Start', key: 'overtime_start', width: 18 },
      { header: 'OT End', key: 'overtime_end', width: 18 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Processed By', key: 'processed_by_name', width: 25 },
      { header: 'Processed At', key: 'processed_at', width: 18 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9C27B0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    records.forEach(record => {
      const row = worksheet.addRow({
        overtime_id: record.overtime_id,
        full_name: record.full_name,
        email: record.email,
        job_title: record.job_title || 'N/A',
        manager_name: record.manager_name || 'N/A',
        overtime_date: record.overtime_date,
        overtime_type: record.overtime_type || 'Regular',
        shift_name: record.shift_name || 'N/A',
        punch_in: record.punch_in || 'N/A',
        punch_out: record.punch_out || 'N/A',
        regular_hours: record.regular_hours || 0,
        overtime_hours: record.overtime_hours || 0,
        approved_hours: record.approved_hours || 0,
        overtime_start: record.overtime_start || 'N/A',
        overtime_end: record.overtime_end || 'N/A',
        reason: record.reason || 'N/A',
        status: record.status,
        processed_by_name: record.processed_by_name || 'N/A',
        processed_at: record.processed_at || 'N/A',
        rejection_reason: record.rejection_reason || 'N/A'
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

      // Format hours
      row.getCell('regular_hours').numFmt = '0.00';
      row.getCell('overtime_hours').numFmt = '0.00';
      row.getCell('approved_hours').numFmt = '0.00';

      // Color code by status
      const statusCell = row.getCell('status');
      if (record.status === 'approved') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (record.status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (record.status === 'pending_approval') {
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
    const filename = `Overtime_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating overtime report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateOvertimeReport };
