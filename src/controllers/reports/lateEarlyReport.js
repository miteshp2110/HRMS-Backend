// src/controller/reports/lateEarlyReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Late Arrival and Early Departure Report
 */
const generateLateEarlyReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      reportType // 'late', 'early', or 'both'
    } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required'
      });
    }

    let whereConditions = ['ar.attendance_date BETWEEN ? AND ?'];
    let queryParams = [fromDate, toDate];

    if (reportType === 'late') {
      whereConditions.push('ar.is_late = 1');
    } else if (reportType === 'early') {
      whereConditions.push('ar.is_early_departure = 1');
    } else {
      whereConditions.push('(ar.is_late = 1 OR ar.is_early_departure = 1)');
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`ar.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        ar.id AS attendance_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        ar.attendance_date,
        s.name AS shift_name,
        s.from_time AS shift_start,
        s.to_time AS shift_end,
        s.punch_in_margin AS grace_period_minutes,
        
        ar.punch_in,
        ar.punch_out,
        ar.hours_worked,
        ar.is_late,
        ar.is_early_departure,
        
        TIMESTAMPDIFF(MINUTE, s.from_time, ar.punch_in) AS minutes_late,
        TIMESTAMPDIFF(MINUTE, ar.punch_out, s.to_time) AS minutes_early,
        
        ar.attendance_status,
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name
        
      FROM attendance_record ar
      INNER JOIN user u ON ar.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN shifts s ON ar.shift = s.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      ${whereClause}
      ORDER BY ar.attendance_date DESC, u.first_name ASC
    `;

    const [records] = await execute(query, queryParams);

    if (!records || records.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No late/early records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Late & Early Report');

    worksheet.columns = [
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Date', key: 'attendance_date', width: 12 },
      { header: 'Shift', key: 'shift_name', width: 15 },
      { header: 'Shift Start', key: 'shift_start', width: 12 },
      { header: 'Shift End', key: 'shift_end', width: 12 },
      { header: 'Grace Period (min)', key: 'grace_period_minutes', width: 18 },
      { header: 'Punch In', key: 'punch_in', width: 18 },
      { header: 'Punch Out', key: 'punch_out', width: 18 },
      { header: 'Late', key: 'is_late', width: 8 },
      { header: 'Minutes Late', key: 'minutes_late', width: 14 },
      { header: 'Early Departure', key: 'is_early_departure', width: 16 },
      { header: 'Minutes Early', key: 'minutes_early', width: 14 },
      { header: 'Hours Worked', key: 'hours_worked', width: 14 },
      { header: 'Status', key: 'attendance_status', width: 12 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF9800' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    records.forEach(record => {
      const row = worksheet.addRow({
        full_name: record.full_name,
        email: record.email,
        job_title: record.job_title || 'N/A',
        manager_name: record.manager_name || 'N/A',
        attendance_date: record.attendance_date,
        shift_name: record.shift_name || 'N/A',
        shift_start: record.shift_start || 'N/A',
        shift_end: record.shift_end || 'N/A',
        grace_period_minutes: record.grace_period_minutes || 0,
        punch_in: record.punch_in || 'N/A',
        punch_out: record.punch_out || 'N/A',
        is_late: record.is_late ? 'Yes' : 'No',
        minutes_late: record.minutes_late > 0 ? record.minutes_late : 0,
        is_early_departure: record.is_early_departure ? 'Yes' : 'No',
        minutes_early: record.minutes_early > 0 ? record.minutes_early : 0,
        hours_worked: record.hours_worked || 0,
        attendance_status: record.attendance_status
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

      row.getCell('hours_worked').numFmt = '0.00';

      // Highlight significant late arrivals (over 30 minutes)
      if (record.is_late && record.minutes_late > 30) {
        row.getCell('minutes_late').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF5252' }
        };
      }

      // Highlight significant early departures (over 30 minutes)
      if (record.is_early_departure && record.minutes_early > 30) {
        row.getCell('minutes_early').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFAB40' }
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
    const filename = `Late_Early_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating late/early report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLateEarlyReport };
