const { get } = require('../../../app');
const { pool } = require('../../../db/connector');

/**
 * @description [Admin] Gets a list of all payroll runs.
 */
const getAllPayrolls = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as initiated_by_name
            FROM payrolls p
            JOIN user u ON p.initiated_by = u.id
            ORDER BY p.pay_period_start DESC;
        `;
        const [payrolls] = await connection.query(sql);
        res.status(200).json(payrolls);
    } catch (error) {
        console.error('Error fetching payrolls:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Gets all individual payslips associated with a single master payroll run.
 */
const getPayslipsByPayrollId = async (req, res) => {
    const { payrollId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                ps.*, 
                CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM payslips ps
            JOIN user u ON ps.employee_id = u.id
            WHERE ps.payroll_id = ?
            ORDER BY u.first_name, u.last_name;
        `;
        const [payslips] = await connection.query(sql, [payrollId]);
        
        if (payslips.length === 0) {
            // Check if the master payroll run itself exists
            const [[payroll]] = await connection.query('SELECT id FROM payrolls WHERE id = ?', [payrollId]);
            if (!payroll) {
                return res.status(404).json({ message: 'Payroll run not found.' });
            }
        }
        
        res.status(200).json(payslips);
    } catch (error) {
        console.error(`Error fetching payslips for payroll run ${payrollId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = { 
    getAllPayrolls,
    getPayslipsByPayrollId
    // ... other read functions
};