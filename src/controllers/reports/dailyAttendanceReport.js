// src/controller/reports/dailyAttendanceReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Daily Attendance Report
 */
const generateDailyAttendanceReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      attendanceStatus 
    } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required'
      });
    }

    let whereConditions = ['ar.attendance_date BETWEEN ? AND ?'];
    let queryParams = [fromDate, toDate];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`ar.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (attendanceStatus) {
      whereConditions.push('ar.attendance_status = ?');
      queryParams.push(attendanceStatus);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        ar.id AS attendance_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        s.name AS shift_name,
        
        ar.attendance_date,
        ar.punch_in,
        ar.punch_out,
        ar.hours_worked,
        ar.short_hours,
        ar.attendance_status,
        ar.is_late,
        ar.is_early_departure,
        
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
        ar.update_reason,
        ar.updated_at
        
      FROM attendance_record ar
      INNER JOIN user u ON ar.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN shifts s ON ar.shift = s.id
      LEFT JOIN user updater ON ar.updated_by = updater.id
      ${whereClause}
      ORDER BY ar.attendance_date DESC, u.first_name ASC
    `;

    const [records] = await execute(query, queryParams);

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Attendance Report');

    worksheet.columns = [
      { header: 'Attendance ID', key: 'attendance_id', width: 14 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Shift', key: 'shift_name', width: 15 },
      { header: 'Date', key: 'attendance_date', width: 12 },
      { header: 'Punch In', key: 'punch_in', width: 18 },
      { header: 'Punch Out', key: 'punch_out', width: 18 },
      { header: 'Hours Worked', key: 'hours_worked', width: 14 },
      { header: 'Short Hours', key: 'short_hours', width: 12 },
      { header: 'Status', key: 'attendance_status', width: 12 },
      { header: 'Late', key: 'is_late', width: 8 },
      { header: 'Early Departure', key: 'is_early_departure', width: 16 },
      { header: 'Updated By', key: 'updated_by_name', width: 20 },
      { header: 'Update Reason', key: 'update_reason', width: 30 },
      { header: 'Last Updated', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    records.forEach(record => {
      const row = worksheet.addRow({
        attendance_id: record.attendance_id,
        full_name: record.full_name,
        email: record.email,
        job_title: record.job_title || 'N/A',
        shift_name: record.shift_name || 'N/A',
        attendance_date: record.attendance_date,
        punch_in: record.punch_in || 'N/A',
        punch_out: record.punch_out || 'N/A',
        hours_worked: record.hours_worked || 0,
        short_hours: record.short_hours || 0,
        attendance_status: record.attendance_status,
        is_late: record.is_late ? 'Yes' : 'No',
        is_early_departure: record.is_early_departure ? 'Yes' : 'No',
        updated_by_name: record.updated_by_name || 'System',
        update_reason: record.update_reason || 'N/A',
        updated_at: record.updated_at
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

      // Format decimal for hours
      row.getCell('hours_worked').numFmt = '0.00';
      row.getCell('short_hours').numFmt = '0.00';

      // Highlight absent
      if (record.attendance_status === 'Absent') {
        row.getCell('attendance_status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      }

      // Highlight late arrivals
      if (record.is_late) {
        row.getCell('is_late').fill = {
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
    const filename = `Daily_Attendance_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating daily attendance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateDailyAttendanceReport };
