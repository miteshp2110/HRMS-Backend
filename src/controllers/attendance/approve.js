const { pool } = require('../../db/connector');

/**
 * @description [Admin/Manager] Approves or rejects an overtime request for a specific attendance record.
 */
const approveOvertime = async (req, res) => {
  const { recordId } = req.params;
  const { status } = req.body; // Expects a status: 1 for approved, 0 for rejected
  const approverId = req.user.id; // Get the manager's ID from the token

  // 1. Validate the input status
  if (status === undefined || ![0, 1].includes(status)) {
    return res.status(400).json({ 
      message: `A valid status (1 for approve, 0 for reject) is required.` 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    const [[attendance]] = await connection.query('select pay_type from attendance_record where id = ?',[recordId])
    if(attendance.pay_type !=='overtime'){
        return res.status(400).json({ 
      message: `Cannot approve non overtime request` 
    });
    }

    // 2. Update the record with the new status and the approver's ID
    const sql = `
      UPDATE attendance_record 
      SET overtime_status = ?, overtime_approved_by = ? 
      WHERE id = ?
    `;
    const [result] = await connection.query(sql, [status, approverId, recordId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    res.status(200).json({ success: true, message: 'Overtime status updated successfully.' });

  } catch (error) {
    console.error('Error approving overtime:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { 
    approveOvertime,
    // ... your other approval/update functions
};