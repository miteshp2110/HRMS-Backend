const { pool } = require('../../../db/connector');

/**
 * @description [Admin] Edits a specific component in an employee's salary structure.
 */
const editEmployeeComponent = async (req, res) => {
    const { employeeId, componentId } = req.params;
    const { value_type, value, based_on_component_id } = req.body;

    // --- Validation ---
    if (!value_type || value === undefined) {
        return res.status(400).json({ message: 'value_type and value are required.' });
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

        // The query to update the specific component for the specific employee
        const sql = `
            UPDATE employee_salary_structure
            SET 
                value_type = ?,
                value = ?,
                based_on_component_id = ?
            WHERE 
                employee_id = ? AND component_id = ?;
        `;
        
        const [result] = await connection.query(sql, [
            value_type,
            value,
            // Ensure based_on_component_id is NULL for fixed types
            value_type === 'percentage' ? based_on_component_id : null,
            employeeId,
            componentId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'The specified salary component was not found for this employee.' });
        }

        res.status(200).json({
            success: true,
            message: 'Employee salary component updated successfully.',
        });

    } catch (error) {
        console.error(`Error editing salary component for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { editEmployeeComponent };