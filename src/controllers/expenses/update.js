const { pool } = require('../../db/connector');

/**
 * @description Update an expense record's details.
 */
const updateExpense = async (req, res) => {
  const { id } = req.params;
  const fieldsToUpdate = req.body;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ message: 'At least one field to update is required.' });
  }

  const fieldEntries = Object.entries(fieldsToUpdate);
  const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
  const values = fieldEntries.map(([, value]) => value);
  values.push(id);

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `UPDATE expense_on_employee SET ${setClause} WHERE id = ?`;
    const [result] = await connection.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Expense record not found.' });
    }

    res.status(200).json({ success: true, message: 'Expense record updated successfully.' });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { updateExpense };