// src/controller/reports/appraisalSummaryReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Appraisal Summary Report
 */
const generateAppraisalSummaryReport = async (req, res) => {
  try {
    const { 
      employeeIds,
      year,
      appraisalStatus
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (year) {
      whereConditions.push('YEAR(prc.start_date) = ?');
      queryParams.push(year);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`a.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (appraisalStatus) {
      whereConditions.push('a.status = ?');
      queryParams.push(appraisalStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        a.id AS appraisal_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        prc.cycle_name,
        YEAR(prc.start_date) AS year,
        prc.start_date,
        prc.end_date,
        prc.status AS cycle_status,
        
        a.overall_manager_rating AS rating,
        a.final_manager_comments AS comments,
        a.status,
        
        a.created_at,
        a.updated_at,
        
        CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager_name,
        CONCAT(creator.first_name, ' ', creator.last_name) AS cycle_creator_name
        
      FROM performance_appraisals a
      INNER JOIN user u ON a.employee_id = u.id
      INNER JOIN performance_review_cycles prc ON a.cycle_id = prc.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN user mgr ON u.reports_to = mgr.id
      LEFT JOIN user creator ON prc.created_by = creator.id
      ${whereClause}
      ORDER BY prc.start_date DESC, u.first_name ASC
    `;

    const [appraisals] = await execute(query, queryParams);

    if (!appraisals || appraisals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No appraisal records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Appraisal Summary Report');

    worksheet.columns = [
      { header: 'Appraisal ID', key: 'appraisal_id', width: 12 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Manager', key: 'manager_name', width: 25 },
      { header: 'Review Cycle', key: 'cycle_name', width: 20 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Cycle Start', key: 'start_date', width: 12 },
      { header: 'Cycle End', key: 'end_date', width: 12 },
      { header: 'Cycle Status', key: 'cycle_status', width: 14 },
      { header: 'Manager Rating', key: 'rating', width: 14 },
      { header: 'Appraisal Status', key: 'status', width: 16 },
      { header: 'Manager Comments', key: 'comments', width: 40 },
      { header: 'Cycle Created By', key: 'cycle_creator_name', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3F51B5' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    appraisals.forEach(appraisal => {
      const row = worksheet.addRow({
        appraisal_id: appraisal.appraisal_id,
        full_name: appraisal.full_name,
        email: appraisal.email,
        job_title: appraisal.job_title || 'N/A',
        manager_name: appraisal.manager_name || 'N/A',
        cycle_name: appraisal.cycle_name,
        year: appraisal.year,
        start_date: appraisal.start_date,
        end_date: appraisal.end_date,
        cycle_status: appraisal.cycle_status,
        rating: appraisal.rating || 'N/A',
        status: appraisal.status,
        comments: appraisal.comments || 'N/A',
        cycle_creator_name: appraisal.cycle_creator_name || 'N/A',
        created_at: appraisal.created_at,
        updated_at: appraisal.updated_at
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

      // Format rating
      if (typeof appraisal.rating === 'number') {
        row.getCell('rating').numFmt = '0.0';
      }

      // Color code rating
      const ratingCell = row.getCell('rating');
      if (appraisal.rating >= 4.0) {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (appraisal.rating <= 2.0 && appraisal.rating !== 'N/A') {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (appraisal.rating > 2.0 && appraisal.rating < 4.0) {
        ratingCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA726' }
        };
      }

      // Color code status
      const statusCell = row.getCell('status');
      if (appraisal.status === 'completed') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (appraisal.status === 'in_progress') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF42A5F5' }
        };
      } else if (appraisal.status === 'pending') {
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
    const filename = `Appraisal_Summary_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating appraisal summary report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateAppraisalSummaryReport };
