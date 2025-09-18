const { pool } = require('../../db/connector');

/**
 * @description Gets the audit history for a specific user.
 */
const getUserAuditHistory = async (req, res) => {
  const { userId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        ua.audit_id,
        ua.field_changed,
        ua.old_value,
        ua.new_value,
        ua.updated_at,
        ua.updated_by,
        CONCAT(u.first_name, ' ', u.last_name) as updated_by_name
      FROM user_audit ua
      LEFT JOIN user u ON ua.updated_by = u.id
      WHERE ua.user_id = ?
      ORDER BY ua.updated_at DESC;
    `;
    const [auditHistory] = await connection.query(sql, [userId]);

    if (auditHistory.length === 0) {
      // It's not an error if a user has no audit history, so we return an empty array.
      return res.status(200).json([]);
    }

    res.status(200).json(auditHistory);
  } catch (error) {
    console.error(`Error fetching audit history for user ${userId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getUserAuditHistory };