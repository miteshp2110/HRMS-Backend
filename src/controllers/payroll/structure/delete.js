const { pool } = require('../../../db/connector');

/**
 * @description Removes a single component from an employee's salary structure.
 */
const removeComponent = async (req, res) => {
  const { employeeId, componentId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [result] = await connection.query(
      'DELETE FROM employee_salary_structure WHERE employee_id = ? AND component_id = ?',
      [employeeId, componentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Salary component not found for this employee.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(`Error removing salary component for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { removeComponent };