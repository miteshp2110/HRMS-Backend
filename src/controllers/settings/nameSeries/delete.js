const { pool } = require('../../../db/connector');

/**
 * @description Deletes a naming series rule.
 */
const deleteNameSeries = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM name_series WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Naming series not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting naming series:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteNameSeries };