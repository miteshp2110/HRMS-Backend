

// const { pool } = require('../../db/connector');

// /**
//  * @description Get a paginated list of all users.
//  * Bypasses the role hierarchy filter if the requester has all available permissions.
//  */
// const getAllUsers = async (req, res) => {
//   const { page = 1, limit = 20 } = req.query;
//   const requesterId = req.user.id;
//   const offset = (parseInt(page) - 1) * parseInt(limit);

//   let connection;
//   try {
//     connection = await pool.getConnection();

//     // 1. Get requester's role and role level
//     const [[requesterInfo]] = await connection.query(
//         'SELECT u.system_role, r.role_level FROM user u JOIN roles r ON u.system_role = r.id WHERE u.id = ?',
//         [requesterId]
//     );

//     if (!requesterInfo) {
//         return res.status(403).json({ message: 'Could not determine your role level.' });
//     }
//     const requesterLevel = requesterInfo.role_level;
//     const requesterRole = requesterInfo.system_role;

//     // --- NEW: "Super Admin" Check ---
//     // 2. Check if the requester has all permissions in the system
//     const [[{ total_permissions }]] = await connection.query('SELECT COUNT(*) as total_permissions FROM permissions');
//     const [[{ user_permissions }]] = await connection.query(
//         'SELECT COUNT(*) as user_permissions FROM role_permissions WHERE role = ?', [requesterRole]
//     );

//     const isSuperAdmin = total_permissions > 0 && total_permissions === user_permissions;

//     // 3. Dynamically build the WHERE clause based on the super admin check
//     let whereClause = '';
//     const params = [];

//     if (!isSuperAdmin) {
//         // If not a super admin, apply the standard hierarchy filter
//         whereClause = 'WHERE r.role_level > ?';
//         params.push(requesterLevel);
//     }
//     // If they are a super admin, the whereClause remains empty, showing all users.

//     // 4. Build the main query with the dynamic WHERE clause
//     const sql = `
//       SELECT
//         u.id, u.first_name, u.last_name, u.dob, u.email, u.phone, u.profile_url, u.gender,
//         u.emergency_contact_name, u.emergency_contact_relation, u.emergency_contact_number,
//         u.joining_date, u.salary_visibility, u.is_signed, u.is_active, u.inactive_date, u.inactive_reason,
//         u.is_probation, u.is_payroll_exempt, u.nationality, u.created_at, u.updated_at,
//         r.name AS role_name,
//         j.title AS job_title,
//         ns.prefix as name_series_prefix,
//         CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name,
//         CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name,
//         CONCAT(inactivator.first_name, ' ', inactivator.last_name) as inactivated_by_name
//       FROM user u
//       LEFT JOIN roles r ON u.system_role = r.id
//       LEFT JOIN jobs j ON u.job_role = j.id
//       LEFT JOIN name_series ns ON ns.table_name = 'user'
//       LEFT JOIN user manager ON u.reports_to = manager.id
//       LEFT JOIN user creator ON u.created_by = creator.id
//       LEFT JOIN user inactivator ON u.inactivated_by = inactivator.id
//       ${whereClause}
//       ORDER BY u.first_name, u.last_name
//       LIMIT ? OFFSET ?;
//     `;
//     const finalParams = [...params, parseInt(limit), offset];
//     const [users] = await connection.query(sql, finalParams);

//     // 5. Build the count query with the same dynamic WHERE clause for accurate pagination
//     const countSql = `
//         SELECT COUNT(*) as total
//         FROM user u
//         JOIN roles r ON u.system_role = r.id
//         ${whereClause}
//     `;
//     const [[{ total }]] = await connection.query(countSql, params); // Use the original params without limit/offset

//     res.status(200).json({
//       success: true,
//       pagination: {
//         total_users: total,
//         current_page: parseInt(page),
//         per_page: parseInt(limit),
//         total_pages: Math.ceil(total / parseInt(limit)),
//       },
//       data: users,
//     });
//   } catch (error) {
//     console.error("Error fetching all users:", error);
//     res.status(500).json({ message: "An internal server error occurred." });
//   } finally {
//     if (connection) connection.release();
//   }
// };

/**
 * @description Searches for users by ID, name, role, or job title.
 * Bypasses the role hierarchy filter if the requester has all available permissions.
 */
const searchUsers = async (req, res) => {
    const { term, inActive } = req.query;
    const requesterId = req.user.id;

    if (!term) {
        return res.status(400).json({ message: 'A search term is required.' });
    }

    const activityStatus = inActive === 'true' ? 0 : 1;

    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Get the requester's role ID and role level in one query
        const [[requesterInfo]] = await connection.query(
            'SELECT u.system_role, r.role_level FROM user u JOIN roles r ON u.system_role = r.id WHERE u.id = ?',
            [requesterId]
        );

        if (!requesterInfo) {
            return res.status(403).json({ message: 'Could not determine your role level.' });
        }
        const requesterLevel = requesterInfo.role_level;
        const requesterRole = requesterInfo.system_role;

        // 2. Check if the requester is a "super admin"
        const [[{ total_permissions }]] = await connection.query('SELECT COUNT(*) as total_permissions FROM permissions');
        const [[{ user_permissions }]] = await connection.query(
            'SELECT COUNT(*) as user_permissions FROM role_permissions WHERE role = ?', [requesterRole]
        );
        const isSuperAdmin = total_permissions > 0 && total_permissions === user_permissions;

        // 3. Dynamically build the final part of the WHERE clause
        let hierarchyFilterSql = '';
        const hierarchyParams = [];

        if (!isSuperAdmin) {
            // If not a super admin, add the hierarchy filter
            hierarchyFilterSql = 'AND r.role_level > ?';
            hierarchyParams.push(requesterLevel);
        }

        // 4. Build and execute the full query
        const searchTerm = `%${term}%`;
        const sql = `
            SELECT
                u.id, u.first_name, u.last_name, u.dob, u.email, u.phone, u.profile_url, u.gender,
                u.emergency_contact_name, u.emergency_contact_relation, u.emergency_contact_number,
                u.joining_date, u.salary_visibility, u.is_signed, u.is_active, u.inactive_date, u.inactive_reason,
                u.is_probation, u.is_payroll_exempt, u.nationality, u.created_at, u.updated_at,
                r.name AS role_name,
                j.title AS job_title,
                ns.prefix as name_series_prefix,
                CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name,
                CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name,
                CONCAT(inactivator.first_name, ' ', inactivator.last_name) as inactivated_by_name,
                CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id
            FROM user u
            LEFT JOIN roles r ON u.system_role = r.id
            LEFT JOIN jobs j ON u.job_role = j.id
            LEFT JOIN name_series ns ON ns.table_name = 'user'
            LEFT JOIN user manager ON u.reports_to = manager.id
            LEFT JOIN user creator ON u.created_by = creator.id
            LEFT JOIN user inactivator ON u.inactivated_by = inactivator.id
            WHERE
                (
                    u.first_name LIKE ? OR
                    u.last_name LIKE ? OR
                    CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
                    r.name LIKE ? OR
                    j.title LIKE ? OR
                    u.id = ?
                )
                AND u.is_active = ?
                ${hierarchyFilterSql};
        `;

        const finalParams = [
            searchTerm, searchTerm, searchTerm,
            searchTerm, searchTerm, term,
            activityStatus,
            ...hierarchyParams // Add the requesterLevel only if it's needed
        ];

        const [users] = await connection.query(sql, finalParams);

        res.status(200).json(users);
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    } finally {
        if (connection) connection.release();
    }
};




// /**
//  * @description Finds users whose roles have a specific set of permissions, passed via query parameters.
//  * The user must have ALL specified permissions to be returned.
//  */
// const findUsersByPermissions = async (req, res) => {
//     // Permissions are taken from the query string, e.g., ?permission=leaves.manage&permission=attendance.manage
//     let { permission } = req.query;

//     // --- Input Validation ---
//     if (!permission) {
//         return res.status(400).json({ message: 'At least one "permission" query parameter is required.' });
//     }
//     // If only one permission is sent, req.query.permission will be a string. We must convert it to an array.
//     if (!Array.isArray(permission)) {
//         permission = [permission];
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();

//         // This query efficiently finds all users who have ALL of the requested permissions.
//         const sql = `
//             SELECT
//                 u.id,
//                 u.first_name,
//                 u.last_name,
//                 u.profile_url
//             FROM user u
//             JOIN roles r ON u.system_role = r.id
//             JOIN role_permissions rp ON r.id = rp.role
//             JOIN permissions p ON rp.permission = p.id
//             WHERE p.name IN (?)
//             GROUP BY u.id, u.first_name, u.last_name, u.profile_url
//             HAVING COUNT(DISTINCT p.name) = ?;
//         `;

//         const [users] = await connection.query(sql, [permission, permission.length]);
//         res.status(200).json(users);
//     } catch (error) {
//         console.error('Error fetching users by permissions:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description Gets the name, id, and profile URL of direct reports for a specific manager.
//  */
// const getDirectReports = async (req, res) => {
//     const { managerId } = req.params; // The ID of the manager
//     let connection;
//     try {
//         connection = await pool.getConnection();

//         // This query selects only the required fields and combines first/last name.
//         const sql = `
//             SELECT
//                 id,
//                 first_name,
//                 last_name,
//                 profile_url
//             FROM user
//             WHERE reports_to = ? AND is_active = TRUE;
//         `;
//         const [reports] = await connection.query(sql, [managerId]);

//         res.status(200).json(reports);
//     } catch (error) {
//         console.error(`Error fetching direct reports for manager ${managerId}:`, error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };



// module.exports = {
//     getAllUsers,
//     searchUsers,
//     findUsersByPermissions,
//     getDirectReports
//     // ... other read functions
// };


const { pool } = require('../../db/connector');

/**
 * @description Get a paginated list of all users.
 * Bypasses the role hierarchy filter if the requester has all available permissions.
 */
const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const requesterId = req.user.id;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let connection;
  try {
    connection = await pool.getConnection();

    const [[requesterInfo]] = await connection.query(
        'SELECT u.system_role, r.role_level FROM user u JOIN roles r ON u.system_role = r.id WHERE u.id = ?',
        [requesterId]
    );

    if (!requesterInfo) {
        return res.status(403).json({ message: 'Could not determine your role level.' });
    }
    const requesterLevel = requesterInfo.role_level;
    const requesterRole = requesterInfo.system_role;

    const [[{ total_permissions }]] = await connection.query('SELECT COUNT(*) as total_permissions FROM permissions');
    const [[{ user_permissions }]] = await connection.query(
        'SELECT COUNT(*) as user_permissions FROM role_permissions WHERE role = ?', [requesterRole]
    );

    const isSuperAdmin = total_permissions > 0 && total_permissions === user_permissions;

    let whereClause = '';
    const params = [];

    if (!isSuperAdmin) {
        whereClause = 'WHERE r.role_level > ?';
        params.push(requesterLevel);
    }

    const sql = `
      SELECT
        u.id, u.first_name, u.last_name, u.dob, u.email, u.phone, u.profile_url, u.gender,
        u.emergency_contact_name, u.emergency_contact_relation, u.emergency_contact_number,
        u.joining_date, u.salary_visibility, u.is_signed, u.is_active, u.inactive_date, u.inactive_reason,
        u.is_probation, u.is_payroll_exempt, u.nationality, u.created_at, u.updated_at,
        r.name AS role_name,
        j.title AS job_title,
        CONCAT(ns.prefix,'-', LPAD(u.id, ns.padding_length, '0')) as full_employee_id,
        CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name,
        CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name,
        CONCAT(inactivator.first_name, ' ', inactivator.last_name) as inactivated_by_name
      FROM user u
      LEFT JOIN roles r ON u.system_role = r.id
      LEFT JOIN jobs j ON u.job_role = j.id
      LEFT JOIN name_series ns ON ns.table_name = 'user'
      LEFT JOIN user manager ON u.reports_to = manager.id
      LEFT JOIN user creator ON u.created_by = creator.id
      LEFT JOIN user inactivator ON u.inactivated_by = inactivator.id
      ${whereClause}
      ORDER BY u.first_name, u.last_name
      LIMIT ? OFFSET ?;
    `;
    const finalParams = [...params, parseInt(limit), offset];
    const [users] = await connection.query(sql, finalParams);

    const countSql = `
        SELECT COUNT(*) as total
        FROM user u
        JOIN roles r ON u.system_role = r.id
        ${whereClause}
    `;
    const [[{ total }]] = await connection.query(countSql, params);

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


// /**
//  * @description Searches for users by ID, name, role, or job title.
//  * Bypasses the role hierarchy filter if the requester has all available permissions.
//  */
// const searchUsers = async (req, res) => {
//     const { term, inActive } = req.query;
//     const requesterId = req.user.id;

//     if (!term) {
//         return res.status(400).json({ message: 'A search term is required.' });
//     }

//     const activityStatus = inActive === 'true' ? 0 : 1;

//     let connection;
//     try {
//         connection = await pool.getConnection();

//         const [[requesterInfo]] = await connection.query(
//             'SELECT u.system_role, r.role_level FROM user u JOIN roles r ON u.system_role = r.id WHERE u.id = ?',
//             [requesterId]
//         );

//         if (!requesterInfo) {
//             return res.status(403).json({ message: 'Could not determine your role level.' });
//         }
//         const requesterLevel = requesterInfo.role_level;
//         const requesterRole = requesterInfo.system_role;

//         const [[{ total_permissions }]] = await connection.query('SELECT COUNT(*) as total_permissions FROM permissions');
//         const [[{ user_permissions }]] = await connection.query(
//             'SELECT COUNT(*) as user_permissions FROM role_permissions WHERE role = ?', [requesterRole]
//         );
//         const isSuperAdmin = total_permissions > 0 && total_permissions === user_permissions;

//         let hierarchyFilterSql = '';
//         const hierarchyParams = [];

//         if (!isSuperAdmin) {
//             hierarchyFilterSql = 'AND r.role_level > ?';
//             hierarchyParams.push(requesterLevel);
//         }

//         const searchTerm = `%${term}%`;
//         const sql = `
//             SELECT
//                 u.id,
//                 u.first_name,
//                 u.last_name,
//                 u.profile_url,
//                 CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id
//             FROM user u
//             LEFT JOIN roles r ON u.system_role = r.id
//             LEFT JOIN jobs j ON u.job_role = j.id
//             LEFT JOIN name_series ns ON ns.table_name = 'user'
//             WHERE
//                 (
//                     u.first_name LIKE ? OR
//                     u.last_name LIKE ? OR
//                     CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR
//                     r.name LIKE ? OR
//                     j.title LIKE ? OR
//                     u.id = ?
//                 )
//                 AND u.is_active = ?
//                 ${hierarchyFilterSql};
//         `;

//         const finalParams = [
//             searchTerm, searchTerm, searchTerm,
//             searchTerm, searchTerm, term,
//             activityStatus,
//             ...hierarchyParams
//         ];

//         const [users] = await connection.query(sql, finalParams);

//         res.status(200).json(users);
//     } catch (error) {
//         console.error("Error searching users:", error);
//         res.status(500).json({ message: "An internal server error occurred." });
//     } finally {
//         if (connection) connection.release();
//     }
// };

/**
 * @description Finds users whose roles have a specific set of permissions, passed via query parameters.
 */
const findUsersByPermissions = async (req, res) => {
    let { permission } = req.query;

    if (!permission) {
        return res.status(400).json({ message: 'At least one "permission" query parameter is required.' });
    }
    if (!Array.isArray(permission)) {
        permission = [permission];
    }

    let connection;
    try {
        connection = await pool.getConnection();

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
    const { managerId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

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
};