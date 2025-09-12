const { pool } = require('../../db/connector');

/**
 * @description Get a list of all roles.
 */
const getAllRoles = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [roles] = await connection.query('SELECT * FROM roles ORDER BY role_level ASC');
    res.status(200).json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Get a single role by its ID, including its permissions.
 */
const getRoleById = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT r.id, r.name, r.role_level, p.id AS permission_id, p.name AS permission_name
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role
      LEFT JOIN permissions p ON rp.permission = p.id
      WHERE r.id = ?;
    `;
    const [rows] = await connection.query(sql, [id]);

    if (rows.length === 0 || !rows[0].id) {
      return res.status(404).json({ message: 'Role not found.' });
    }

    const roleDetails = {
      id: rows[0].id,
      name: rows[0].name,
      role_level: rows[0].role_level,
      permissions: rows
        .map(row => (row.permission_id ? { id: row.permission_id, name: row.permission_name } : null))
        .filter(p => p !== null),
    };

    res.status(200).json(roleDetails);
  } catch (error) {
    console.error('Error fetching role by ID:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description Gets all employees belonging to a specific role.
 */
const getEmployeesByRole = async (req, res) => {
    const { roleId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        
        // This query finds all users with a specific system_role
        // and joins the jobs table to get the readable job title.
        const sql = `
            SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) AS name,
                u.profile_url,
                j.title AS job_title
            FROM user u
            LEFT JOIN jobs j ON u.job_role = j.id
            WHERE 
                u.system_role = ? 
                AND u.is_active = TRUE
            ORDER BY name ASC;
        `;
        
        const [employees] = await connection.query(sql, [roleId]);
        res.status(200).json(employees);
    } catch (error) {
        console.error(`Error fetching employees for role ${roleId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getAllRoles, getRoleById, getEmployeesByRole };