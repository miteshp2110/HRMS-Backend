const { pool } = require('../../../db/connector');

/**
 * @description Assigns or updates a salary component for an employee, supporting fixed, percentage, and formula-based calculations.
 */
const assignOrUpdateComponent = async (req, res) => {
  const { employeeId } = req.params;
  const { component_id, calculation_type, value, based_on_component_id, custom_formula } = req.body;
  const updated_by = req.user.id;

  // --- Comprehensive Validation ---
  if (!employeeId || !component_id || !calculation_type) {
    return res.status(400).json({ message: 'employeeId, component_id, and calculation_type are required.' });
  }

  if (calculation_type === 'Fixed' && value === undefined) {
    return res.status(400).json({ message: 'A value is required for Fixed components.' });
  }
  if (calculation_type === 'Percentage') {
    if (value === undefined || !based_on_component_id) {
        return res.status(400).json({ message: 'A value and based_on_component_id are required for Percentage components.' });
    }
  }
  if (calculation_type === 'Formula' && !custom_formula) {
    return res.status(400).json({ message: 'A custom_formula is required for Formula components.' });
  }


  let connection;
  try {
    connection = await pool.getConnection();
    // "Upsert" logic: This single query will either insert a new record or update the existing one
    // for the given employee and component combination.
    const sql = `
      INSERT INTO employee_salary_structure (
          employee_id, component_id, calculation_type, value, based_on_component_id, custom_formula, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        calculation_type = VALUES(calculation_type),
        value = VALUES(value),
        based_on_component_id = VALUES(based_on_component_id),
        custom_formula = VALUES(custom_formula),
        updated_by = VALUES(updated_by);
    `;
    
    // The value for custom_formula is stringified to be stored in the TEXT column.
    await connection.query(sql, [
      employeeId,
      component_id,
      calculation_type,
      value || 0, // Default to 0 if no value is provided (e.g., for formulas)
      calculation_type === 'Percentage' ? based_on_component_id : null,
      calculation_type === 'Formula' ? JSON.stringify(custom_formula) : null,
      updated_by
    ]);

    res.status(200).json({
      success: true,
      message: 'Employee salary component has been saved successfully.',
    });
  } catch (error) {
    console.error(`Error saving salary component for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { assignOrUpdateComponent };