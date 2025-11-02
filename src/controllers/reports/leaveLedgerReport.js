// src/controller/reports/leaveLedgerReport.js

const ExcelJS = require('exceljs');
const { execute } = require('../../db/connector');

/**
 * Generate Leave Ledger Report
 */
const generateLeaveLedgerReport = async (req, res) => {
  try {
    const { 
      fromDate, 
      toDate, 
      employeeIds,
      leaveTypeIds,
      transactionType 
    } = req.body;

    let whereConditions = [];
    let queryParams = [];

    if (fromDate && toDate) {
      whereConditions.push('ll.transaction_date BETWEEN ? AND ?');
      queryParams.push(fromDate, toDate);
    }

    if (employeeIds && employeeIds.length > 0) {
      whereConditions.push(`ll.user_id IN (${employeeIds.map(() => '?').join(',')})`);
      queryParams.push(...employeeIds);
    }

    if (leaveTypeIds && leaveTypeIds.length > 0) {
      whereConditions.push(`ll.leave_type_id IN (${leaveTypeIds.map(() => '?').join(',')})`);
      queryParams.push(...leaveTypeIds);
    }

    if (transactionType) {
      whereConditions.push('ll.transaction_type = ?');
      queryParams.push(transactionType);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT 
        ll.id AS ledger_id,
        CONCAT(u.first_name, ' ', u.last_name) AS full_name,
        u.email,
        j.title AS job_title,
        
        lt.name AS leave_type_name,
        
        ll.transaction_type,
        ll.transaction_date,
        ll.change_amount AS days,
        ll.previous_balance AS balance_before,
        ll.new_balance AS balance_after,
        ll.leave_record_id AS reference_id,
        
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
        ll.created_at,
        ll.updated_at
        
      FROM employee_leave_balance_ledger ll
      INNER JOIN user u ON ll.user_id = u.id
      LEFT JOIN jobs j ON u.job_role = j.id
      INNER JOIN leave_types lt ON ll.leave_type_id = lt.id
      LEFT JOIN user updater ON ll.updated_by = updater.id
      ${whereClause}
      ORDER BY ll.transaction_date DESC, u.first_name ASC
    `;

    const [ledgers] = await execute(query, queryParams);

    if (!ledgers || ledgers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No leave ledger records found'
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leave Ledger Report');

    worksheet.columns = [
      { header: 'Ledger ID', key: 'ledger_id', width: 12 },
      { header: 'Employee Name', key: 'full_name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Job Title', key: 'job_title', width: 20 },
      { header: 'Leave Type', key: 'leave_type_name', width: 20 },
      { header: 'Transaction Type', key: 'transaction_type', width: 16 },
      { header: 'Transaction Date', key: 'transaction_date', width: 16 },
      { header: 'Days Changed', key: 'days', width: 14 },
      { header: 'Balance Before', key: 'balance_before', width: 15 },
      { header: 'Balance After', key: 'balance_after', width: 15 },
      { header: 'Leave Record ID', key: 'reference_id', width: 16 },
      { header: 'Updated By', key: 'updated_by_name', width: 25 },
      { header: 'Created At', key: 'created_at', width: 18 },
      { header: 'Updated At', key: 'updated_at', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5E35B1' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    ledgers.forEach(ledger => {
      const row = worksheet.addRow({
        ledger_id: ledger.ledger_id,
        full_name: ledger.full_name,
        email: ledger.email,
        job_title: ledger.job_title || 'N/A',
        leave_type_name: ledger.leave_type_name,
        transaction_type: ledger.transaction_type,
        transaction_date: ledger.transaction_date,
        days: ledger.days,
        balance_before: ledger.balance_before,
        balance_after: ledger.balance_after,
        reference_id: ledger.reference_id || 'N/A',
        updated_by_name: ledger.updated_by_name || 'System',
        created_at: ledger.created_at,
        updated_at: ledger.updated_at
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

      // Format number cells
      ['days', 'balance_before', 'balance_after'].forEach(col => {
        const cell = row.getCell(col);
        cell.numFmt = '0.00';
      });

      // Color code transaction types
      const transTypeCell = row.getCell('transaction_type');
      if (ledger.transaction_type === 'credit' || ledger.transaction_type === 'allocation') {
        transTypeCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF66BB6A' }
        };
      } else if (ledger.transaction_type === 'debit' || ledger.transaction_type === 'usage') {
        transTypeCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEF5350' }
        };
      } else if (ledger.transaction_type === 'adjustment') {
        transTypeCell.fill = {
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
    const filename = `Leave_Ledger_Report_${timestamp}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error generating leave ledger report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

module.exports = { generateLeaveLedgerReport };
