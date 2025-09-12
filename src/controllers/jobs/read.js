const { pool } = require('../../db/connector');

/**
 * @description Get a list of all jobs.
 */
const getAllJobs = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [jobs] = await connection.query('SELECT * FROM jobs ORDER BY title ASC');
    res.status(200).json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets all employees who have a specific job role.
 */
const getEmployeesByJob = async (req, res) => {
    const { jobId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        
        // This query finds all users with a specific job_role
        // and joins the roles table to get the readable role name.
        const sql = `
            SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) AS name,
                u.profile_url,
                r.name AS role_name
            FROM user u
            LEFT JOIN roles r ON u.system_role = r.id
            WHERE 
                u.job_role = ? 
                AND u.is_active = TRUE
            ORDER BY name ASC;
        `;
        
        const [employees] = await connection.query(sql, [jobId]);
        res.status(200).json(employees);
    } catch (error) {
        console.error(`Error fetching employees for job ${jobId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = { getAllJobs , getEmployeesByJob};