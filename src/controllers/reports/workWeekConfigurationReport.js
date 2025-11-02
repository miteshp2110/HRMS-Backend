// src/controller/reports/workWeekConfigurationReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Work Week Configuration Report
 */
const generateWorkWeekConfigurationReport = async (req, res) => {
  try {
    const { workWeekIds, includeInactive = false } = req.body;

    // Work week table stores individual day configurations
    const query = `
      SELECT 
        ww.id AS config_id,
        ww.day_of_week,
        ww.is_working_day,
        
        ww.created_at,
        ww.updated_at,
        
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name
        
      FROM work_week ww
      LEFT JOIN user updater ON ww.updated_by = updater.id
      ORDER BY 
        FIELD(ww.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    `;

    const [workWeekDays] = await execute(query, []);

    if (!workWeekDays || workWeekDays.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No work week configuration found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Week Configuration');

    worksheet.columns = [
      { header: 'Config ID', key: 'config_id', width: 12 },
      { header: 'Day of Week', key: 'day_of_week', width: 14 },
      { header: 'Is Working Day', key: 'is_working_day', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Updated By', key: 'updated_by_name', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00ACC1' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    workWeekDays.forEach(day => {
      const row = worksheet.addRow({
        config_id: day.config_id,
        day_of_week: day.day_of_week,
        is_working_day: day.is_working_day ? 'Yes' : 'No',
        status: day.is_working_day ? 'Working Day' : 'Off Day',
        updated_by_name: day.updated_by_name || 'System',
        created_at: day.created_at,
        updated_at: day.updated_at
      });

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Color code working days
      const statusCell = row.getCell('is_working_day');
      if (day.is_working_day) {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF81C784' }
        };
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF81C784' }
        };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEEEEE' }
        };
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEEEEEE' }
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

    // Add summary section
    const workingDays = workWeekDays.filter(d => d.is_working_day).length;
    const offDays = workWeekDays.length - workingDays;

    worksheet.addRow([]);
    worksheet.addRow(['Summary:']);
    worksheet.addRow(['Total Days', workWeekDays.length]);
    worksheet.addRow(['Working Days', workingDays]);
    worksheet.addRow(['Off Days', offDays]);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Work_Week_Configuration_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating work week configuration report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateWorkWeekConfigurationReport };
