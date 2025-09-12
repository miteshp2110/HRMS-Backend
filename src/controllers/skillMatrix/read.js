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

/**
 * @description Gets all employees who are verified for a specific skill.
 */
const getVerifiedEmployeesBySkill = async (req, res) => {
    const { skillName } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        
        // This query joins the skill matrix with the skills table to filter by name,
        // and joins the user table twice: once for the employee's name and once for the approver's name.
        const sql = `
            SELECT 
                e.id AS employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                CONCAT(a.first_name, ' ', a.last_name) AS approved_by_name
            FROM employee_skill_matrix esm
            JOIN skills s ON esm.skill_id = s.id
            JOIN user e ON esm.employee_id = e.id
            LEFT JOIN user a ON esm.approved_by = a.id
            WHERE 
                s.skill_name = ? 
                AND esm.status = TRUE; -- status = TRUE means the skill is verified
        `;
        
        const [employees] = await connection.query(sql, [skillName]);
        res.status(200).json(employees);
    } catch (error) {
        console.error(`Error fetching employees for skill ${skillName}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};
module.exports = { 
    getEmployeeSkills,
    getVerifiedEmployeesBySkill
    // ... other read functions
};