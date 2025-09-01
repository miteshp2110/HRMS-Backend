const { pool } = require('../../db/connector');

/**
 * @description Get a list of all jobs.
 */
const getAllJobs = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [jobs] = await connection.query('SELECT * FROM jobs ORDER BY title ASC');
    res.status(200).json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllJobs };