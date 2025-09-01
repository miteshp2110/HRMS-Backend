const { pool } = require('../../db/connector');

/**
 * @description Create a new job title.
 */
const createJob = async (req, res) => {
  const { title, description } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({ message: 'Title and description are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO jobs (title, description) VALUES (?, ?)',
      [title, description]
    );
    res.status(201).json({
      success: true,
      message: 'Job created successfully.',
      job: { id: result.insertId, title, description },
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createJob };