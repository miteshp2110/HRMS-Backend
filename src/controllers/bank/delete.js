const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes the bank details for a specific employee.
 */
const deleteBankDetails = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM bank_details WHERE user_id = ?', [employeeId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No bank details found to delete.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting bank details for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteBankDetails };