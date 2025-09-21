const { pool } = require('../../db/connector');

/**
 * @description Gets the audit history for a specific attendance record.
 */
const getAttendanceAuditHistory = async (req, res) => {
  const { recordId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        aa.id,
        aa.field_name,
        aa.old_value,
        aa.new_value,
        aa.changed_at,
        CONCAT(u.first_name, ' ', u.last_name) as changed_by_name,
        aa.bulk_log_id
      FROM attendance_audit_log aa
      LEFT JOIN user u ON aa.changed_by = u.id
      WHERE aa.attendance_id = ?
      ORDER BY aa.changed_at DESC;
    `;
    const [auditHistory] = await connection.query(sql, [recordId]);

    res.status(200).json(auditHistory);
  } catch (error) {
    console.error(`Error fetching audit history for attendance record ${recordId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets the audit history for a specific overtime record.
 */
const getOvertimeAuditHistory = async (req, res) => {
    const { overtimeRecordId } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                eoa.id,
                eoa.field_name,
                eoa.old_value,
                eoa.new_value,
                eoa.changed_at,
                CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
            FROM employee_overtime_audit_log eoa
            LEFT JOIN user u ON eoa.changed_by = u.id
            WHERE eoa.overtime_record_id = ?
            ORDER BY eoa.changed_at DESC;
        `;
        const [auditHistory] = await connection.query(sql, [overtimeRecordId]);

        res.status(200).json(auditHistory);
    } catch (error) {
        console.error(`Error fetching audit history for overtime record ${overtimeRecordId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getAttendanceAuditHistory,
    getOvertimeAuditHistory
};