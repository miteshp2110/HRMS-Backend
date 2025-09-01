const { pool } = require('../../db/connector');

/**
 * @description Permanently deletes a skill.
 */
const deleteSkill = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Check if this skill is in use in the employee_skill_matrix
    const [assignments] = await connection.query(
      'SELECT id FROM employee_skill_matrix WHERE skill_id = ? LIMIT 1',
      [id]
    );
    if (assignments.length > 0) {
      return res.status(409).json({ message: 'Cannot delete skill. It is currently assigned to one or more employees.' });
    }
    
    // 2. If not in use, proceed with deletion
    const [result] = await connection.query(
      'DELETE FROM skills WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Skill not found.' });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteSkill };