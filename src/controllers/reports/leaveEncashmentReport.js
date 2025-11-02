// src/controller/reports/leaveEncashmentReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Leave Encashment Report
 */
const generateLeaveEncashmentReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      approvalStatus 
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('le.request_date BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`le.employee_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (approvalStatus) {
      whereConditions.push('le.status = ?');
      queryParams.push(approvalStatus);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        le.id AS encashment_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        lt.name AS leave_type_name,
        
        le.request_date,
        le.days_to_encash AS days_encashed,
        le.calculated_amount AS amount,
        le.status,
        le.created_at AS requested_at,
        
        CONCAT(approver.first_name, ' ', approver.last_name) AS approved_by_name,
        le.approval_date AS processed_at,
        le.rejection_reason,
        le.jv_number,
        
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name
        
      FROM leave_encashment_requests le
      INNER JOIN user u ON le.employee_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      INNER JOIN leave_types lt ON le.leave_type_id = lt.id
      LEFT JOIN user approver ON le.approved_by = approver.id
      LEFT JOIN user updater ON le.updated_by = updater.id
      ${whereClause}
      ORDER BY le.request_date DESC
    `;

    const [encashments] = await execute(query, queryParams);

    if (!encashments || encashments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leave encashment records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Encashment Report');

    worksheet.columns = [
      { header: 'Encashment ID', key: 'encashment_id', width: 14 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Leave Type', key: 'leave_type_name', width: 20 },
      { header: 'Request Date', key: 'request_date', width: 14 },
      { header: 'Days Encashed', key: 'days_encashed', width: 14 },
      { header: 'Amount (AED)', key: 'amount', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Requested At', key: 'requested_at', width: 18 },
      { header: 'Approved By', key: 'approved_by_name', width: 25 },
      { header: 'Approval Date', key: 'processed_at', width: 18 },
      { header: 'JV Number', key: 'jv_number', width: 18 },
      { header: 'Updated By', key: 'updated_by_name', width: 25 },
      { header: 'Rejection Reason', key: 'rejection_reason', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF388E3C' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    encashments.forEach(enc => {
      const row = worksheet.addRow({
        encashment_id: enc.encashment_id,
        full_name: enc.full_name,
        email: enc.email,
        job_title: enc.job_title || 'N/A',
        leave_type_name: enc.leave_type_name,
        request_date: enc.request_date,
        days_encashed: enc.days_encashed,
        amount: enc.amount,
        status: enc.status,
        requested_at: enc.requested_at,
        approved_by_name: enc.approved_by_name || 'N/A',
        processed_at: enc.processed_at || 'N/A',
        jv_number: enc.jv_number || 'N/A',
        updated_by_name: enc.updated_by_name || 'N/A',
        rejection_reason: enc.rejection_reason || 'N/A'
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

      // Format currency
      row.getCell('amount').numFmt = '#,##0.00';
      row.getCell('days_encashed').numFmt = '0.00';

      // Color code status
      const statusCell = row.getCell('status');
      if (enc.status === 'approved') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (enc.status === 'rejected') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (enc.status === 'pending') {
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
    const filename = `Leave_Encashment_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating leave encashment report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLeaveEncashmentReport };
