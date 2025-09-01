const { pool } = require('../../db/connector');

/**
 * @description Admin endpoint to update any user details.
 * Dynamically builds the query based on the fields provided in the request body.
 */
const updateUser = async (req, res) => {
  const { id } = req.params;
  const fieldsToUpdate = req.body;

  // For security, never update a password hash directly with this generic endpoint.
  // Password changes should have their own dedicated, secure controller.
  delete fieldsToUpdate.password;
  delete fieldsToUpdate.password_hash;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ message: 'No fields provided to update.' });
  }

  // Dynamically create the "SET" clause for the SQL query
  const fieldEntries = Object.entries(fieldsToUpdate);
  const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
  const values = fieldEntries.map(([, value]) => value);
  values.push(id); // Add the user ID for the WHERE clause

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `UPDATE user SET ${setClause} WHERE id = ?`;
    const [result] = await connection.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'User details updated successfully.',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    // Provide a more specific error for bad column names
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(400).json({ message: 'Invalid field name provided.' });
    }
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateUser };