const { pool } = require('../../../db/connector');

/**
 * @description Assigns or updates a salary component for an employee.
 */
const assignOrUpdateComponent = async (req, res) => {
  const { employeeId } = req.params;
  const { component_id, value_type, value, based_on_component_id } = req.body;
  

  // --- Validation ---
  if (!component_id || !value_type || value === undefined) {
    return res.status(400).json({ message: 'component_id, value_type, and value are required.' });
  }
  if (value_type === 'percentage' && !based_on_component_id) {
    return res.status(400).json({ message: 'based_on_component_id is required for percentage-based components.' });
  }
  if (value_type === 'fixed' && based_on_component_id) {
      return res.status(400).json({ message: 'based_on_component_id should not be provided for fixed components.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // "Upsert" logic: Insert a new record, or if the employee+component combo already exists, update it.
    const sql = `
      INSERT INTO employee_salary_structure 
      (employee_id, component_id, value_type, value, based_on_component_id)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        value_type = VALUES(value_type),
        value = VALUES(value),
        based_on_component_id = VALUES(based_on_component_id);
    `;
    
    await connection.query(sql, [
      employeeId,
      component_id,
      value_type,
      value,
      value_type === 'percentage' ? based_on_component_id : null
    ]);

    res.status(200).json({
      success: true,
      message: 'Employee salary component saved successfully.',
    });
  } catch (error) {
    console.error(`Error saving salary component for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { assignOrUpdateComponent };