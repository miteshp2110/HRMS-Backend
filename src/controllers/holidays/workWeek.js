const { pool } = require('../../db/connector');

/**
 * @description Gets the current 7-day work week configuration.
 */
const getWorkWeek = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [workWeek] = await connection.query('SELECT * FROM work_week');
    res.status(200).json(workWeek);
  } catch (error) {
    console.error('Error fetching work week:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Updates the work week configuration.
 * Expects an array of objects, e.g., [{ "day_of_week": "saturday", "is_working_day": false }]
 */
const updateWorkWeek = async (req, res) => {
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: 'Request body must be a non-empty array.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Loop through each update and execute it
    for (const update of updates) {
      const { day_of_week, is_working_day } = update;
      if (!day_of_week || is_working_day === undefined) {
        throw new Error('Each update object must contain day_of_week and is_working_day.');
      }
      await connection.query(
        'UPDATE work_week SET is_working_day = ? WHERE day_of_week = ?',
        [is_working_day, day_of_week]
      );
    }

    await connection.commit();
    res.status(200).json({ success: true, message: 'Work week updated successfully.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating work week:', error);
    res.status(500).json({ message: error.message || 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getWorkWeek, updateWorkWeek };