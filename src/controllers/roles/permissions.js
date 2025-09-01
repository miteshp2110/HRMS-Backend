const { pool } = require('../../db/connector');

/**
 * @description Manage the permissions for a role (add/remove).
 */
const manageRolePermissions = async (req, res) => {
  const { id: roleId } = req.params;
  const { permissionIds } = req.body || {};

  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ message: 'permissionIds must be an array.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query('DELETE FROM role_permissions WHERE role = ?', [roleId]);

    if (permissionIds.length > 0) {
      const insertValues = permissionIds.map(permId => ` (${roleId}, ${permId})`).join(',');
      const insertSql = `INSERT INTO role_permissions (role, permission) VALUES ${insertValues}`;
      await connection.query(insertSql);
    }

    await connection.commit();
    res.status(200).json({ success: true, message: 'Role permissions updated successfully.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error managing role permissions:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { manageRolePermissions };