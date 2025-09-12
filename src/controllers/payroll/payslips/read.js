const { pool } = require('../../../db/connector');
const { DateTime } = require('luxon');

// --- Helper Function (This remains unchanged) ---
const fetchAndAssemblePayslipHistory = async (connection, employeeId, startDate, endDate) => {
    // 1. Get all payslip summaries for the employee within the date range
    const payslipsSql = `
        SELECT * FROM payslips 
        WHERE employee_id = ? AND pay_period_end BETWEEN ? AND ?
        ORDER BY pay_period_start DESC;
    `;
    const [payslips] = await connection.query(payslipsSql, [employeeId, startDate, endDate]);

    if (payslips.length === 0) {
        return [];
    }

    // 2. Get all the details for those specific payslips
    const payslipIds = payslips.map(p => p.id);
    const detailsSql = `
        SELECT * FROM payslip_details 
        WHERE payslip_id IN (?) 
        ORDER BY component_type, component_name;
    `;
    const [details] = await connection.query(detailsSql, [payslipIds]);

    // 3. Assemble the data into a nested structure
    const detailsMap = new Map();
    details.forEach(detail => {
        if (!detailsMap.has(detail.payslip_id)) {
            detailsMap.set(detail.payslip_id, []);
        }
        detailsMap.get(detail.payslip_id).push(detail);
    });

    const fullPayslips = payslips.map(payslip => ({
        ...payslip,
        details: detailsMap.get(payslip.id) || []
    }));

    return fullPayslips;
};


/**
 * @description Gets the detailed payslip history for the currently authenticated user
 * for the past year from the provided end date.
 */
const getMyPayslipHistory = async (req, res) => {
    const employeeId = req.user.id; // ID is taken securely from the token
    const endDate = req.query.endDate ? DateTime.fromISO(req.query.endDate) : DateTime.now();
    const startDate = endDate.minus({ years: 1 });

    let connection;
    try {
        connection = await pool.getConnection();

        // --- MODIFICATION: The salary_visibility check has been removed. ---
        // The endpoint now assumes any authenticated user can view their own payslips.

        const payslipHistory = await fetchAndAssemblePayslipHistory(connection, employeeId, startDate.toISODate(), endDate.toISODate());
        res.status(200).json(payslipHistory);

    } catch (error) {
        console.error('Error fetching my payslip history:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

// ... (The getPayslipHistoryByEmployee controller for admins remains the same)
/**
 * @description [Admin] Gets the detailed payslip history for a specific employee
 * for the past year from the provided end date.
 */
const getPayslipHistoryByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const endDate = req.query.endDate ? DateTime.fromISO(req.query.endDate) : DateTime.now();
    const startDate = endDate.minus({ years: 1 });

    let connection;
    try {
        connection = await pool.getConnection();
        const payslipHistory = await fetchAndAssemblePayslipHistory(connection, employeeId, startDate.toISODate(), endDate.toISODate());
        res.status(200).json(payslipHistory);

    } catch (error) {
        console.error(`Error fetching payslip history for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = { 
    getMyPayslipHistory,
    getPayslipHistoryByEmployee
    // ... other read functions
};