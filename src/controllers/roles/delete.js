const { pool } = require('../../db/connector');

/**
 * @description Delete a role.
 */
const deleteRole = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [users] = await connection.query('SELECT id FROM user WHERE system_role = ? LIMIT 1', [id]);
    if (users.length > 0) {
      await connection.rollback();
      return res.status(409).json({ message: 'Cannot delete role. It is currently assigned to one or more users.' });
    }

    await connection.query('DELETE FROM role_permissions WHERE role = ?', [id]);
    const [result] = await connection.query('DELETE FROM roles WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Role not found.' });
    }

    await connection.commit();
    res.status(204).send();
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error deleting role:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { deleteRole };