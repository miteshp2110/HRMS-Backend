const { pool } = require('../../../db/connector');

/**
 * @description Creates a new naming series rule for a table.
 */
const createNameSeries = async (req, res) => {
  const { table_name, prefix, padding_length } = req.body;
  const creatorId = req.user.id; // Get the user ID from the token

  if (!table_name || !prefix || padding_length === undefined) {
    return res.status(400).json({ message: 'table_name, prefix, and padding_length are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // As requested, we set 'updated_by' on creation to track the last user who touched the record.
    const sql = `
      INSERT INTO name_series (table_name, prefix, padding_length, updated_by) 
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await connection.query(sql, [table_name, prefix, padding_length, creatorId]);
    
    res.status(201).json({
      success: true,
      message: 'Naming series created successfully.',
      series: { id: result.insertId, ...req.body },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'A naming series for this table_name already exists.' });
    }
    console.error('Error creating naming series:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createNameSeries };