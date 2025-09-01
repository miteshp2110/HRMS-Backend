const { pool } = require('../../db/connector');

/**
 * @description Get a list of all available permissions in the system.
 */
const getAllPermissions = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = 'SELECT id, name FROM permissions ORDER BY name ASC';
    const [permissions] = await connection.query(sql);
    
    res.status(200).json(permissions);
  } catch (error) {
    console.error("Error fetching all permissions:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllPermissions };