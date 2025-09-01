const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes a leave type.
 */
const deleteLeaveType = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if the leave type is used in leave records or balances
    // const [records] = await connection.query(
    //   'SELECT id FROM employee_leave_records WHERE leave_type = ? LIMIT 1', [id]
    // );
    // const [balances] = await connection.query(
    //   'SELECT id FROM employee_leave_balance WHERE leave_id = ? LIMIT 1', [id]
    // );

    // if (records.length > 0 || balances.length > 0) {
    //   return res.status(409).json({ message: 'Cannot delete leave type. It is currently in use by employees.' });
    // }
    
    const [result] = await connection.query('DELETE FROM leave_types WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting leave type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteLeaveType };