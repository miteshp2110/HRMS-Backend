const { pool } = require('../../db/connector');

/**
 * @description Get a paginated list of all users with essential details.
 */
const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone,
        u.profile_url, u.is_active, r.name AS role_name, j.title AS job_title
      FROM user u
      LEFT JOIN roles r ON u.system_role = r.id
      LEFT JOIN jobs j ON u.job_role = j.id
      ORDER BY u.first_name, u.last_name
      LIMIT ? OFFSET ?;
    `;
    const [users] = await connection.query(sql, [parseInt(limit), offset]);
    
    const [[{ total }]] = await connection.query('SELECT COUNT(*) as total FROM user');

    res.status(200).json({
      success: true,
      pagination: {
        total_users: total,
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
      data: users,
    });
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Searches for users by ID, name, role name, or job title.
 * Returns a detailed list of matching users.
 */
const searchUsers = async (req, res) => {
    const { term } = req.query;

    if (!term) {
        return res.status(400).json({ message: 'A search term is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const searchTerm = `%${term}%`;
        
        // This query now joins with roles and jobs to search by their names
        // and includes their details in the final output.
        const sql = `
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.is_active,
                u.profile_url,
                r.name AS role_name,
                j.title AS job_title
            FROM user u
            LEFT JOIN roles r ON u.system_role = r.id
            LEFT JOIN jobs j ON u.job_role = j.id
            WHERE 
                u.first_name LIKE ? OR 
                u.last_name LIKE ? OR
                CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
                r.name LIKE ? OR
                j.title LIKE ? OR
                u.id = ?;
        `;
        
        const [users] = await connection.query(sql, [
            searchTerm, 
            searchTerm, 
            searchTerm,
            searchTerm, 
            searchTerm, 
            term // For exact ID match
        ]);
        
        res.status(200).json(users);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description Finds users whose roles have a specific set of permissions, passed via query parameters.
 * The user must have ALL specified permissions to be returned.
 */
const findUsersByPermissions = async (req, res) => {
    // Permissions are taken from the query string, e.g., ?permission=leaves.manage&permission=attendance.manage
    let { permission } = req.query; 

    // --- Input Validation ---
    if (!permission) {
        return res.status(400).json({ message: 'At least one "permission" query parameter is required.' });
    }
    // If only one permission is sent, req.query.permission will be a string. We must convert it to an array.
    if (!Array.isArray(permission)) {
        permission = [permission];
    }

    let connection;
    try {
        connection = await pool.getConnection();
        
        // This query efficiently finds all users who have ALL of the requested permissions.
        const sql = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.profile_url
            FROM user u
            JOIN roles r ON u.system_role = r.id
            JOIN role_permissions rp ON r.id = rp.role
            JOIN permissions p ON rp.permission = p.id
            WHERE p.name IN (?)
            GROUP BY u.id, u.first_name, u.last_name, u.profile_url
            HAVING COUNT(DISTINCT p.name) = ?;
        `;
        
        const [users] = await connection.query(sql, [permission, permission.length]);
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users by permissions:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets the name, id, and profile URL of direct reports for a specific manager.
 */
const getDirectReports = async (req, res) => {
    const { managerId } = req.params; // The ID of the manager
    let connection;
    try {
        connection = await pool.getConnection();

        // This query selects only the required fields and combines first/last name.
        const sql = `
            SELECT 
                id,
                first_name,
                last_name,
                profile_url 
            FROM user 
            WHERE reports_to = ? AND is_active = TRUE;
        `;
        const [reports] = await connection.query(sql, [managerId]);
        
        res.status(200).json(reports);
    } catch (error) {
        console.error(`Error fetching direct reports for manager ${managerId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};



module.exports = { 
    getAllUsers, 
    searchUsers,
    findUsersByPermissions,
    getDirectReports
    // ... other read functions
};