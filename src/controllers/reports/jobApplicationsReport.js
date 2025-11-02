// src/controller/reports/jobApplicationsReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Job Applications Report
 */
const generateJobApplicationsReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      jobOpeningIds,
      applicationStatus
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('a.created_at BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    if (jobOpeningIds && jobOpeningIds.length > 0) {
      whereConditions.push(`a.opening_id IN (${jobOpeningIds.map(() => '?').join(',')})`);
      queryParams.push(...jobOpeningIds);
    }

    if (applicationStatus) {
      whereConditions.push('a.status = ?');
      queryParams.push(applicationStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        a.id AS application_id,
        a.first_name,
        a.last_name,
        CONCAT(a.first_name, ' ', a.last_name) AS full_name,
        a.email,
        a.phone,
        a.resume_url,
        a.notes,
        
        j.title AS job_title,
        j.description AS job_description,
        
        jo.id AS opening_id,
        jo.number_of_positions,
        jo.status AS opening_status,
        
        a.status AS application_status,
        a.created_at AS applied_at,
        a.updated_at,
        
        CONCAT(added_by_user.first_name, ' ', added_by_user.last_name) AS added_by_name,
        CONCAT(creator.first_name, ' ', creator.last_name) AS opening_created_by_name
        
      FROM applicants a
      INNER JOIN job_openings jo ON a.opening_id = jo.id
      INNER JOIN jobs j ON jo.job_id = j.id
      LEFT JOIN user added_by_user ON a.added_by = added_by_user.id
      LEFT JOIN user creator ON jo.created_by = creator.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;

    const [applications] = await execute(query, queryParams);

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No job applications found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Job Applications Report');

    worksheet.columns = [
      { header: 'Application ID', key: 'application_id', width: 14 },
      { header: 'First Name', key: 'first_name', width: 18 },
      { header: 'Last Name', key: 'last_name', width: 18 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Job Title', key: 'job_title', width: 25 },
      { header: 'Job Description', key: 'job_description', width: 35 },
      { header: 'Opening ID', key: 'opening_id', width: 12 },
      { header: 'Positions Available', key: 'number_of_positions', width: 16 },
      { header: 'Opening Status', key: 'opening_status', width: 14 },
      { header: 'Application Status', key: 'application_status', width: 18 },
      { header: 'Applied At', key: 'applied_at', width: 18 },
      { header: 'Notes', key: 'notes', width: 35 },
      { header: 'Added By', key: 'added_by_name', width: 25 },
      { header: 'Opening Created By', key: 'opening_created_by_name', width: 25 },
      { header: 'Resume URL', key: 'resume_url', width: 40 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF795548' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    applications.forEach(app => {
      const row = worksheet.addRow({
        application_id: app.application_id,
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone || 'N/A',
        job_title: app.job_title,
        job_description: app.job_description || 'N/A',
        opening_id: app.opening_id,
        number_of_positions: app.number_of_positions || 1,
        opening_status: app.opening_status,
        application_status: app.application_status,
        applied_at: app.applied_at,
        notes: app.notes || 'N/A',
        added_by_name: app.added_by_name || 'Self Applied',
        opening_created_by_name: app.opening_created_by_name || 'N/A',
        resume_url: app.resume_url || 'N/A',
        updated_at: app.updated_at
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

      // Color code application status
      const statusCell = row.getCell('application_status');
      if (app.application_status === 'hired' || app.application_status === 'accepted') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (app.application_status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (app.application_status === 'interview' || app.application_status === 'screening') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF42A5F5' }
        };
      } else if (app.application_status === 'applied' || app.application_status === 'new') {
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
    const filename = `Job_Applications_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating job applications report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateJobApplicationsReport };
