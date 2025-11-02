// src/controller/reports/goalKpiReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Goal and KPI Report
 */
const generateGoalKpiReport = async (req, res) => {
  try {
    const { 
      employeeIds,
      year,
      goalStatus
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`u.id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (year) {
      whereConditions.push('YEAR(prc.start_date) = ?');
      queryParams.push(year);
    }

    if (goalStatus) {
      whereConditions.push('pa.status = ?');
      queryParams.push(goalStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        g.id AS goal_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        prc.cycle_name,
        YEAR(prc.start_date) AS year,
        prc.start_date,
        prc.end_date,
        
        g.goal_title,
        g.goal_description,
        g.weightage AS goal_weightage,
        g.employee_rating AS employee_self_rating,
        g.manager_rating AS manager_rating,
        g.employee_comments,
        g.manager_comments,
        
        pa.status AS appraisal_status,
        pa.overall_manager_rating,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name
        
      FROM employee_goals g
      INNER JOIN performance_appraisals pa ON g.appraisal_id = pa.id
      INNER JOIN user u ON pa.employee_id = u.id
      INNER JOIN performance_review_cycles prc ON pa.cycle_id = prc.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      ${whereClause}
      ORDER BY prc.start_date DESC, u.first_name ASC
    `;

    const [goals] = await execute(query, queryParams);

    if (!goals || goals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No goal/KPI records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Goal & KPI Report');

    worksheet.columns = [
      { header: 'Goal ID', key: 'goal_id', width: 10 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Review Cycle', key: 'cycle_name', width: 20 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Cycle Start', key: 'start_date', width: 12 },
      { header: 'Cycle End', key: 'end_date', width: 12 },
      { header: 'Goal Title', key: 'goal_title', width: 30 },
      { header: 'Goal Description', key: 'goal_description', width: 40 },
      { header: 'Weightage (%)', key: 'goal_weightage', width: 12 },
      { header: 'Employee Self Rating', key: 'employee_self_rating', width: 18 },
      { header: 'Manager Rating', key: 'manager_rating', width: 14 },
      { header: 'Employee Comments', key: 'employee_comments', width: 35 },
      { header: 'Manager Comments', key: 'manager_comments', width: 35 },
      { header: 'Appraisal Status', key: 'appraisal_status', width: 16 },
      { header: 'Overall Rating', key: 'overall_manager_rating', width: 14 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00BCD4' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    goals.forEach(goal => {
      const row = worksheet.addRow({
        goal_id: goal.goal_id,
        full_name: goal.full_name,
        email: goal.email,
        job_title: goal.job_title || 'N/A',
        manager_name: goal.manager_name || 'N/A',
        cycle_name: goal.cycle_name,
        year: goal.year,
        start_date: goal.start_date,
        end_date: goal.end_date,
        goal_title: goal.goal_title,
        goal_description: goal.goal_description || 'N/A',
        goal_weightage: goal.goal_weightage || 0,
        employee_self_rating: goal.employee_self_rating || 'N/A',
        manager_rating: goal.manager_rating || 'N/A',
        employee_comments: goal.employee_comments || 'N/A',
        manager_comments: goal.manager_comments || 'N/A',
        appraisal_status: goal.appraisal_status,
        overall_manager_rating: goal.overall_manager_rating || 'N/A'
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

      // Format ratings
      if (typeof goal.employee_self_rating === 'number') {
        row.getCell('employee_self_rating').numFmt = '0.00';
      }
      if (typeof goal.manager_rating === 'number') {
        row.getCell('manager_rating').numFmt = '0.00';
      }
      if (typeof goal.overall_manager_rating === 'number') {
        row.getCell('overall_manager_rating').numFmt = '0.0';
      }

      // Color code manager rating
      const ratingCell = row.getCell('manager_rating');
      if (goal.manager_rating >= 4.0) {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (goal.manager_rating <= 2.0 && goal.manager_rating !== 'N/A') {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (goal.manager_rating > 2.0 && goal.manager_rating < 4.0) {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA726' }
        };
      }

      // Color code status
      const statusCell = row.getCell('appraisal_status');
      if (goal.appraisal_status === 'completed') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (goal.appraisal_status === 'in_progress') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF42A5F5' }
        };
      } else if (goal.appraisal_status === 'pending') {
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
    const filename = `Goal_KPI_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating goal/KPI report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateGoalKpiReport };
