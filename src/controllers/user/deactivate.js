const { pool } = require('../../db/connector');

/**
 * @description Deactivates a user account.
 */
const deactivateUser = async (req, res) => {
  const { id } = req.params;
  const { inactive_reason } = req.body;
  const inactivated_by = req.user.id; // Get the ID of the admin deactivating the user

  if (!inactive_reason) {
    return res.status(400).json({ message: 'An inactivation reason is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      UPDATE user
      SET
        is_active = FALSE,
        inactive_date = NOW(),
        inactivated_by = ?,
        inactive_reason = ?,
        is_payroll_exempt = TRUE
      WHERE id = ?;
    `;
    const [result] = await connection.query(sql, [inactivated_by, inactive_reason, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ success: true, message: 'User has been deactivated successfully.' });
  } catch (error) {
    console.error(`Error deactivating user ${id}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deactivateUser };