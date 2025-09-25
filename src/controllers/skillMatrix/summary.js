const { pool } = require('../../db/connector');

/**
 * @description Gets a summary of how many employees are verified for each skill.
 */
const getSkillMatrixSummary = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                s.id,
                s.skill_name,
                COUNT(esm.employee_id) AS employee_count
            FROM employee_skill_matrix esm
            JOIN skills s ON esm.skill_id = s.id
            WHERE esm.status = TRUE
            GROUP BY s.id, s.skill_name
            ORDER BY employee_count DESC, s.skill_name ASC;
        `;
        const [summary] = await connection.query(sql);
        res.status(200).json(summary);
    } catch (error) {
        console.error('Error fetching skill matrix summary:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getSkillMatrixSummary };