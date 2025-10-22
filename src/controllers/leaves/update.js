const { pool } = require('../../db/connector');

/**
 * @description Update a leave type's details.
 */
const updateLeaveType = async (req, res) => {
  const { id } = req.params;
  const fieldsToUpdate = req.body;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }

  const fieldEntries = Object.entries(fieldsToUpdate);
  const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
  const values = fieldEntries.map(([, value]) => value);
  values.push(id);

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `UPDATE leave_types SET ${setClause} WHERE id = ?`;
    const [result] = await connection.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Leave type not found.' });
    }

    res.status(200).json({ success: true, message: 'Leave type updated successfully.' });
  } catch (error) {
    console.error('Error updating leave type:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description [Admin] Manually updates the leave balance for a specific employee and leave type.
 */
const updateLeaveBalance = async (req, res) => {
    const { employeeId, leaveId } = req.params;
    const { newBalance } = req.body;
    const updated_by = req.user.id;

    if (newBalance === undefined ) {
        return res.status(400).json({ message: 'A newBalance required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[currentBalance]] = await connection.query(
            'SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE',
            [employeeId, leaveId]
        );

        if (!currentBalance) {
            await connection.rollback();
            return res.status(404).json({ message: 'Leave balance record not found for the specified employee and leave type.' });
        }

        const previous_balance = parseFloat(currentBalance.balance);
        const new_balance = parseFloat(newBalance);
        const change_amount = new_balance - previous_balance;

        // Update the main balance table
        await connection.query(
            'UPDATE employee_leave_balance SET balance = ?, updated_by = ? WHERE employee_id = ? AND leave_id = ?',
            [new_balance, updated_by, employeeId, leaveId]
        );

        // Create a detailed entry in the ledger table for auditing
        await connection.query(
            `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, updated_by) VALUES (?, ?, 'adjustment', ?, ?, ?, ?)`,
            [employeeId, leaveId, previous_balance, change_amount, new_balance, updated_by]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Leave balance updated successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating leave balance:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { updateLeaveType , updateLeaveBalance};