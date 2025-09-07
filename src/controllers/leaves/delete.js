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
    if(error.code === 'ER_ROW_IS_REFERENCED_2'){
      res.status(401).json({ message: 'Cannot Delete Leave in use' });
    }
    console.error('Error deleting leave type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description Deletes a leave request submitted by the authenticated user,
 * but only if it has not been approved yet (primary_status is false).
 */
const deleteMyLeaveRequest = async (req, res) => {
  const { recordId } = req.params;
  const employeeId = req.user.id; // ID is taken securely from the token
  let connection;

  try {
    connection = await pool.getConnection();
    
    // This query is very specific: it will only delete the record if the ID matches,
    // it belongs to the authenticated user, AND it has not been approved.
    const sql = `
      DELETE FROM employee_leave_records 
      WHERE 
        id = ? AND 
        employee_id = ? AND 
        primary_status = FALSE
    `;
    const [result] = await connection.query(sql, [recordId, employeeId]);

    if (result.affectedRows === 0) {
      // This means no record was deleted. The reason could be:
      // 1. The record ID doesn't exist.
      // 2. The record belongs to another user.
      // 3. The record has already been approved by the manager.
      return res.status(404).json({ message: 'Pending leave request not found or it has already been approved.' });
    }

    res.status(204).send(); // 204 No Content for a successful deletion
  } catch (error) {
    console.error('Error deleting leave request:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = { deleteLeaveType ,deleteMyLeaveRequest};