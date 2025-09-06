const { pool } = require('../../db/connector');
const { get } = require('../../routes/user/userRoutes');

/**
 * @description Gets the complete and detailed profile for the currently authenticated user.
 */
const getMyProfile = async (req, res) => {
    const employeeId = req.user.id; // ID is taken securely from the token
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.dob, 
                u.email, 
                u.phone,
                u.profile_url, 
                u.gender, 
                u.emergency_contact_name,
                u.emergency_contact_relation, 
                u.emergency_contact_number,
                u.joining_date, 
                u.salary_visibility, 
                u.is_active,
                u.is_probation,
                u.is_payroll_exempt,
                r.name as role_name,
                j.title as job_title,
                s.name as shift_name,
                s.from_time as shift_start_time,
                s.to_time as shift_end_time,
                CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name
            FROM user u
            LEFT JOIN roles r ON u.system_role = r.id
            LEFT JOIN jobs j ON u.job_role = j.id
            LEFT JOIN shifts s ON u.shift = s.id
            LEFT JOIN user manager ON u.reports_to = manager.id
            WHERE u.id = ?;
        `;
        const [[profile]] = await connection.query(sql, [employeeId]);

        if (!profile) {
            return res.status(404).json({ message: 'User profile not found.' });
        }

        res.status(200).json(profile);
    } catch (error) {
        console.error('Error fetching my profile:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Admin] Gets the complete and detailed profile for a specific user by their ID.
 */
const getUserProfileById = async (req, res) => {
    const { id } = req.params; // ID is taken from the URL parameter
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.dob, 
                u.email, 
                u.phone,
                u.profile_url, 
                u.gender, 
                u.emergency_contact_name,
                u.emergency_contact_relation, 
                u.emergency_contact_number,
                u.joining_date, 
                u.salary_visibility, 
                u.is_active,
                u.is_probation,
                u.is_payroll_exempt,
                r.name as role_name,
                j.title as job_title,
                s.name as shift_name,
                s.from_time as shift_start_time,
                s.to_time as shift_end_time,
                CONCAT(manager.first_name, ' ', manager.last_name) as reports_to_name
            FROM user u
            LEFT JOIN roles r ON u.system_role = r.id
            LEFT JOIN jobs j ON u.job_role = j.id
            LEFT JOIN shifts s ON u.shift = s.id
            LEFT JOIN user manager ON u.reports_to = manager.id
            WHERE u.id = ?;
        `;
        const [[profile]] = await connection.query(sql, [id]);

        if (!profile) {
            return res.status(404).json({ message: 'User profile not found.' });
        }

        res.status(200).json(profile);
    } catch (error) {
        console.error(`Error fetching profile for user ${id}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    getMyProfile,getUserProfileById
};