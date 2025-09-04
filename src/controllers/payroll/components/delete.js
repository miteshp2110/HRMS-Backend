const { pool } = require('../../../db/connector');

/**
 * @description Deletes a payroll component.
 */
const deleteComponent = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    if(id==1){
      return res.status(401).json({message:"Cannot Delete Base Salary Component"})
    }
    connection = await pool.getConnection();

    // Check if the component is in use by any employee salary structure
    const [assignments] = await connection.query(
        'SELECT id FROM employee_salary_structure WHERE component_id = ? LIMIT 1', [id]
    );

    if (assignments.length > 0) {
        return res.status(409).json({ message: 'Cannot delete component. It is currently assigned to one or more employees.' });
    }

    const [result] = await connection.query('DELETE FROM payroll_components WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Component not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting payroll component:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteComponent };