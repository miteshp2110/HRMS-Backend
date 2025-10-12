const { pool } = require('../../db/connector');

/**
 * @description [Admin] Gets the audit history for an employee's salary structure.
 */
const getSalaryStructureAuditHistory = async (req, res) => {
    const { employeeId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                essa.id,
                essa.action_type,
                essa.old_data,
                essa.new_data,
                essa.changed_at,
                CONCAT(u.first_name, ' ', u.last_name) as changed_by_name
            FROM employee_salary_structure_audit essa
            LEFT JOIN user u ON essa.changed_by = u.id
            WHERE essa.employee_id = ?
            ORDER BY essa.changed_at DESC;
        `;
        const [history] = await connection.query(sql, [employeeId]);
        
        // Parse the JSON data for frontend convenience
        const formattedHistory = history.map(row => ({
            ...row,
            old_data: row.old_data || '{}',
            new_data: row.new_data || '{}'
        }));

        res.status(200).json(formattedHistory);
    } catch (error) {
        console.error('Error fetching salary structure audit history:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getSalaryStructureAuditHistory
};