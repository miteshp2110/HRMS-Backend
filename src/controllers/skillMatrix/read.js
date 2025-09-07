const { pool } = require('../../db/connector');

/**
 * @description Gets all skills for a specific employee.
 */
const getEmployeeSkills = async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                esm.id,
                s.skill_name,
                esm.status,
                CONCAT(u.first_name, ' ', u.last_name) AS approved_by_name
            FROM employee_skill_matrix esm
            JOIN skills s ON esm.skill_id = s.id
            LEFT JOIN user u ON esm.approved_by = u.id
            WHERE esm.employee_id = ?;
        `;
        const [skills] = await connection.query(sql, [employeeId]);
        res.status(200).json(skills);
    } catch (error) {
        console.error(`Error fetching skills for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { 
    getEmployeeSkills,
    // ... other read functions
};