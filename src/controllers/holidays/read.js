const { pool } = require('../../db/connector');

/**
 * @description Gets all holidays, optionally filtered by year.
 */
const getAllHolidays = async (req, res) => {
  const { year } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let sql = 'SELECT * FROM holidays';
    const params = [];

    if (year) {
      sql += ' WHERE YEAR(holiday_date) = ?';
      params.push(year);
    }
    
    sql += ' ORDER BY holiday_date ASC';

    const [holidays] = await connection.query(sql, params);
    res.status(200).json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllHolidays };