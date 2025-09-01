const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes a shift from the database.
 */
const deleteShift = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Check if any user is assigned this shift
    const [users] = await connection.query(
      'SELECT id FROM user WHERE shift = ? LIMIT 1',
      [id]
    );
    if (users.length > 0) {
      return res.status(409).json({ message: 'Cannot delete shift. It is currently assigned to one or more users.' });
    }
    
    // 2. If no users are assigned, proceed with deletion
    const [result] = await connection.query(
      'DELETE FROM shifts WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Shift not found.' });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteShift };