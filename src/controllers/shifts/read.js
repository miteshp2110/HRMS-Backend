const { pool } = require('../../db/connector');

/**
 * @description Get a list of all shifts.
 */
const getAllShifts = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [shifts] = await connection.query('SELECT * FROM shifts ORDER BY name ASC');
    res.status(200).json(shifts);
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllShifts };