const { pool } = require('../../../db/connector');

/**
 * @description Updates an existing naming series rule.
 */
const updateNameSeries = async (req, res) => {
  const { id } = req.params;
  const { prefix, padding_length } = req.body;
  const updaterId = req.user.id;

  if (!prefix && padding_length === undefined) {
    return res.status(400).json({ message: 'At least one field (prefix, padding_length) is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE name_series SET prefix = ?, padding_length = ?, updated_by = ? WHERE id = ?',
      [prefix, padding_length, updaterId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Naming series not found.' });
    }

    res.status(200).json({ success: true, message: 'Naming series updated successfully.' });
  } catch (error) {
    console.error('Error updating naming series:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateNameSeries };