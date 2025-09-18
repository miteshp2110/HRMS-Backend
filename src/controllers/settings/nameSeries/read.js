const { pool } = require('../../../db/connector');

/**
 * @description Gets a list of all naming series rules.
 */
const getAllNameSeries = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    // Join with the user table to get the name of the person who last updated the record
    const sql = `
        SELECT ns.*, CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
        FROM name_series ns
        LEFT JOIN user u ON ns.updated_by = u.id
        ORDER BY ns.table_name ASC;
    `;
    const [series] = await connection.query(sql);
    res.status(200).json(series);
  } catch (error) {
    console.error('Error fetching naming series:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllNameSeries };