const { pool } = require('../../db/connector');

/**
 * @description [Admin] Updates only the pay_type of a specific attendance record.
 * Automatically logs the user making the change in the `updated_by` field.
 */
const updatePayType = async (req, res) => {
  const { recordId } = req.params;
  const { pay_type } = req.body;
  const updatedById = req.user.id; // Get the admin/manager's ID from the token


  // 1. Validate the input
  if (!pay_type) {
  }

  const allowedPayTypes = ['unpaid', 'full_day', 'half_day'];
  if (!allowedPayTypes.includes(pay_type)) {
    return res.status(400).json({ 
      message: `Invalid pay_type. Must be one of: ${allowedPayTypes.join(', ')}` 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // 2. Perform a simple, direct update
    const sql = `
      UPDATE attendance_record 
      SET pay_type = ?, updated_by = ? 
      WHERE id = ?
    `;
    const [result] = await connection.query(sql, [pay_type, updatedById, recordId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    res.status(200).json({ success: true, message: 'Attendance pay type updated successfully.' });

  } catch (error) {
    console.error('Error updating attendance pay type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { 
    updatePayType,
    // ... any other approval functions
};