const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes a job from the database.
 */
const deleteJob = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Check if any user is assigned this job role
    const [users] = await connection.query(
      'SELECT id FROM user WHERE job_role = ? LIMIT 1',
      [id]
    );
    if (users.length > 0) {
      return res.status(409).json({ message: 'Cannot delete job. It is currently assigned to one or more users.' });
    }
    
    // 2. If no users are assigned, proceed with deletion
    const [result] = await connection.query(
      'DELETE FROM jobs WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteJob };