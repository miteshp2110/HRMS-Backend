const { pool } = require('../../db/connector');

/**
 * @description Update a job's details.
 */
const updateJob = async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  if (!title && !description) {
    return res.status(400).json({ message: 'At least one field (title, description) is required.' });
  }

  // Get existing job details first to fill in any missing fields
  let connection;
  try {
    connection = await pool.getConnection();
    const [[existingJob]] = await connection.query('SELECT * FROM jobs WHERE id = ?', [id]);

    if (!existingJob) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    // Use new values if provided, otherwise keep the existing ones
    const newTitle = title || existingJob.title;
    const newDescription = description || existingJob.description;

    await connection.query(
      'UPDATE jobs SET title = ?, description = ? WHERE id = ?',
      [newTitle, newDescription, id]
    );

    res.status(200).json({ success: true, message: 'Job updated successfully.' });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateJob };