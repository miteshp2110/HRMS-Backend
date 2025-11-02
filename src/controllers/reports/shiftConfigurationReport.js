// src/controller/reports/shiftConfigurationReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Shift Configuration Report
 */
const generateShiftConfigurationReport = async (req, res) => {
  try {
    const { shiftIds, includeInactive = false } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (shiftIds && shiftIds.length > 0) {
      whereConditions.push(`s.id IN (${shiftIds.map(() => '?').join(',')})`);
      queryParams.push(...shiftIds);
    }

    // Note: No is_active field in shifts table, so we don't filter by it

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        s.id AS shift_id,
        s.name AS shift_name,
        
        s.from_time AS start_time,
        s.to_time AS end_time,
        s.scheduled_hours AS total_hours,
        
        s.punch_in_margin AS grace_period_minutes,
        s.punch_out_margin AS punch_out_margin,
        s.half_day_threshold AS half_day_hours,
        s.overtime_threshold,
        
        s.created_at,
        s.updated_at,
        
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
        
        (SELECT COUNT(*) FROM user WHERE shift = s.id) AS employees_assigned
        
      FROM shifts s
      LEFT JOIN user updater ON s.updated_by = updater.id
      ${whereClause}
      ORDER BY s.name ASC
    `;

    const [shifts] = await execute(query, queryParams);

    if (!shifts || shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No shift configurations found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Shift Configuration Report');

    worksheet.columns = [
      { header: 'Shift ID', key: 'shift_id', width: 10 },
      { header: 'Shift Name', key: 'shift_name', width: 20 },
      { header: 'Start Time', key: 'start_time', width: 12 },
      { header: 'End Time', key: 'end_time', width: 12 },
      { header: 'Scheduled Hours', key: 'total_hours', width: 14 },
      { header: 'Punch In Margin (min)', key: 'grace_period_minutes', width: 18 },
      { header: 'Punch Out Margin (min)', key: 'punch_out_margin', width: 18 },
      { header: 'Half Day Threshold', key: 'half_day_hours', width: 16 },
      { header: 'Overtime Threshold', key: 'overtime_threshold', width: 16 },
      { header: 'Employees Assigned', key: 'employees_assigned', width: 18 },
      { header: 'Updated By', key: 'updated_by_name', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8E24AA' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    shifts.forEach(shift => {
      const row = worksheet.addRow({
        shift_id: shift.shift_id,
        shift_name: shift.shift_name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        total_hours: shift.total_hours || 0,
        grace_period_minutes: shift.grace_period_minutes || 0,
        punch_out_margin: shift.punch_out_margin || 0,
        half_day_hours: shift.half_day_hours || 0,
        overtime_threshold: shift.overtime_threshold || 0,
        employees_assigned: shift.employees_assigned || 0,
        updated_by_name: shift.updated_by_name || 'System',
        created_at: shift.created_at,
        updated_at: shift.updated_at
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
      row.getCell('total_hours').numFmt = '0.00';
      row.getCell('half_day_hours').numFmt = '0.00';
      row.getCell('grace_period_minutes').numFmt = '0.00';
      row.getCell('punch_out_margin').numFmt = '0.00';
      row.getCell('overtime_threshold').numFmt = '0.00';
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
    const filename = `Shift_Configuration_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating shift configuration report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateShiftConfigurationReport };
