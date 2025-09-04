const { pool } = require('../../db/connector');

/**
 * @description Creates a new holiday.
 */
const createHoliday = async (req, res) => {
  const { name, holiday_date } = req.body;

  if (!name || !holiday_date) {
    return res.status(400).json({ message: 'Name and holiday_date (YYYY-MM-DD) are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO holidays (name, holiday_date) VALUES (?, ?)',
      [name, holiday_date]
    );
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully.',
      holiday: { id: result.insertId, name, holiday_date },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A holiday already exists on this date.' });
    }
    console.error('Error creating holiday:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createHoliday };