const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes an expense record.
 */
const deleteExpense = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM expense_on_employee WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Expense record not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteExpense };