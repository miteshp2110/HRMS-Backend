const { pool } = require('../../db/connector');

/**
 * @description Get a list of all leave types.
 */
const getAllLeaveTypes = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [leaveTypes] = await connection.query('SELECT * FROM leave_types ORDER BY name ASC');
    res.status(200).json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllLeaveTypes };