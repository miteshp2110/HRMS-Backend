const { pool } = require('../../../db/connector');

/**
 * @description Gets a list of all payroll components.
 */
const getAllComponents = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [components] = await connection.query('SELECT * FROM payroll_components ORDER BY type, name');
    res.status(200).json(components);
  } catch (error) {
    console.error('Error fetching payroll components:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllComponents };