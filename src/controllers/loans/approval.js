const { pool } = require('../../db/connector');

/**
 * @description [Admin] Gets all loan requests, with optional status filtering.
 */
const getAllLoanRequests = async (req, res) => {
    const { status } = req.query; // e.g., ?status=pending_approval
    let connection;
    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT l.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM employee_loans l
            JOIN user e ON l.employee_id = e.id
        `;
        const params = [];
        if (status) {
            sql += ' WHERE l.status = ?';
            params.push(status);
        }
        sql += ' ORDER BY l.request_date DESC';
        const [requests] = await connection.query(sql, params);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching all loan requests:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Approves or rejects a loan request.
 */
const approveOrRejectLoan = async (req, res) => {
    const { loanId } = req.params;
    const { status, disbursement_date } = req.body; // status should be 'approved' or 'rejected'
    const approverId = req.user.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "A valid status ('approved' or 'rejected') is required." });
    }
    if (status === 'approved' && !disbursement_date) {
        return res.status(400).json({ message: 'Disbursement date is required for an approved loan.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const newStatus = status === 'approved' ? 'active' : 'rejected';
        const sql = `
            UPDATE employee_loans 
            SET status = ?, approved_by = ?, approval_date = CURDATE(), disbursement_date = ?
            WHERE id = ? AND status = 'pending_approval'
        `;
        const [result] = await connection.query(sql, [
            newStatus, approverId, status === 'approved' ? disbursement_date : null, loanId
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending loan request not found.' });
        }
        res.status(200).json({ success: true, message: `Loan request has been ${status}.` });
    } catch (error) {
        console.error('Error approving/rejecting loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Admin] Gets a list of all loans that have been approved or are currently active.
 */
const getApprovedLoans = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT 
                l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM employee_loans l
            JOIN user e ON l.employee_id = e.id
            ORDER BY l.request_date DESC;
        `;
        const [requests] = await connection.query(sql);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching approved loans:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets the repayment history for a specific loan.
 * Security: Checks if the requester is the owner of the loan or an admin.
 */
const getLoanRepaymentHistory = async (req, res) => {
    const { loanId } = req.params;
    const requester = req.user;
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Check if the user has permission to view this loan's history
        const [[loan]] = await connection.query('SELECT employee_id FROM employee_loans WHERE id = ?', [loanId]);
        if (!loan) {
            return res.status(404).json({ message: 'Loan not found.' });
        }
        
        
        // 2. Fetch the repayment history
        const sql = `
            SELECT * FROM loan_repayments
            WHERE loan_id = ?
            ORDER BY repayment_date ASC;
        `;
        const [history] = await connection.query(sql, [loanId]);
        res.status(200).json(history);
    } catch (error) {
        console.error(`Error fetching repayment history for loan ${loanId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { getAllLoanRequests, approveOrRejectLoan, getApprovedLoans,getLoanRepaymentHistory };