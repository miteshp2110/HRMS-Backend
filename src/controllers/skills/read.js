const { pool } = require('../../db/connector');

/**
 * @description Get a list of all skills.
 */
const getAllSkills = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [skills] = await connection.query('SELECT * FROM skills ORDER BY skill_name ASC');
    res.status(200).json(skills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllSkills };