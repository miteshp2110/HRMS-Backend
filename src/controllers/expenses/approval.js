// const { pool } = require('../../db/connector');

// /**
//  * @description [Manager] Gets all pending expense claims submitted by their direct reports.
//  */
// const getPendingExpenseApprovals = async (req, res) => {
//     const managerId = req.user.id;
//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             SELECT
//                 ec.*,
//                 cat.name as category_name,
//                 CONCAT(e.first_name, ' ', e.last_name) as employee_name
//             FROM expense_claims ec
//             JOIN user e ON ec.employee_id = e.id
//             JOIN expense_categories cat ON ec.category_id = cat.id
//             WHERE e.reports_to = ? AND ec.status = 'Pending';
//         `;
//         const [claims] = await connection.query(sql, [managerId]);
//         res.status(200).json(claims);
//     } catch (error) {
//         console.error('Error fetching pending expense approvals:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description [Manager] Approves or rejects an expense claim.
//  */
// const processExpenseClaim = async (req, res) => {
//     const { claimId } = req.params;
//     const { status, rejection_reason } = req.body;
//     const managerId = req.user.id;

//     if (!status || !['Approved', 'Rejected'].includes(status)) {
//         return res.status(400).json({ message: "Status must be 'Approved' or 'Rejected'." });
//     }
//     if (status === 'Rejected' && !rejection_reason) {
//         return res.status(400).json({ message: 'A rejection reason is required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             UPDATE expense_claims
//             SET status = ?, approved_by = ?, approval_date = NOW(), rejection_reason = ?, updated_by = ?
//             WHERE id = ? AND status = 'Pending';
//         `;
//         const [result] = await connection.query(sql, [status, managerId, status === 'Rejected' ? rejection_reason : null, managerId, claimId]);

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Pending expense claim not found.' });
//         }

//         res.status(200).json({ success: true, message: `Expense claim has been ${status.toLowerCase()}.` });
//     } catch (error) {
//         console.error('Error processing expense claim:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// /**
//  * @description [Admin/Finance] Sets the reimbursement method for an approved claim.
//  */
// const setReimbursementDetails = async (req, res) => {
//     const { claimId } = req.params;
//     const { reimbursement_method, transaction_id } = req.body;
//     const processed_by = req.user.id;

//     if (!reimbursement_method || !['Payroll', 'Direct Transfer'].includes(reimbursement_method)) {
//         return res.status(400).json({ message: "A valid reimbursement_method ('Payroll' or 'Direct Transfer') is required."});
//     }
//     if (reimbursement_method === 'Direct Transfer' && !transaction_id) {
//         return res.status(400).json({ message: 'A transaction ID is required for a direct transfer.'});
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const status = reimbursement_method === 'Direct Transfer' ? 'Reimbursed' : 'Processed';

//         const sql = `
//             UPDATE expense_claims
//             SET status = ?, reimbursement_method = ?, processed_by = ?, processed_date = NOW(), transaction_id = ?, updated_by = ?
//             WHERE id = ? AND status = 'Approved';
//         `;
//         const [result] = await connection.query(sql, [status, reimbursement_method, processed_by, transaction_id || null, processed_by, claimId]);
        
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Approved expense claim not found.' });
//         }
//         res.status(200).json({ success: true, message: 'Reimbursement details have been set successfully.' });
//     } catch (error) {
//         console.error('Error setting reimbursement details:', error);
//         res.status(500).json({ message: 'An internal server error occurred.'});
//     } finally {
//         if (connection) connection.release();
//     }
// }


// module.exports = {
//     getPendingExpenseApprovals,
//     processExpenseClaim,
//     setReimbursementDetails
// };


const { pool } = require('../../db/connector');

/**
 * @description [Manager] Gets all pending expense claims submitted by their direct reports, including receipt URLs.
 */
const getPendingExpenseApprovals = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                ec.*,
                cat.name as category_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                er.file_url as receipt_url
            FROM expense_claims ec
            JOIN user e ON ec.employee_id = e.id
            JOIN expense_categories cat ON ec.category_id = cat.id
            LEFT JOIN expense_receipts er ON ec.id = er.expense_claim_id
            WHERE e.reports_to = ? AND ec.status = 'Pending';
        `;
        const [claims] = await connection.query(sql, [managerId]);
        res.status(200).json(claims);
    } catch (error) {
        console.error('Error fetching pending expense approvals:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Manager] Approves or rejects an expense claim.
 */
const processExpenseClaim = async (req, res) => {
    const { claimId } = req.params;
    const { status, rejection_reason } = req.body;
    const managerId = req.user.id;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'Approved' or 'Rejected'." });
    }
    if (status === 'Rejected' && !rejection_reason) {
        return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            UPDATE expense_claims
            SET status = ?, approved_by = ?, approval_date = NOW(), rejection_reason = ?, updated_by = ?
            WHERE id = ? AND status = 'Pending';
        `;
        const [result] = await connection.query(sql, [status, managerId, status === 'Rejected' ? rejection_reason : null, managerId, claimId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending expense claim not found.' });
        }

        res.status(200).json({ success: true, message: `Expense claim has been ${status.toLowerCase()}.` });
    } catch (error) {
        console.error('Error processing expense claim:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin/Finance] Sets the reimbursement method for an approved claim.
 */
const setReimbursementDetails = async (req, res) => {
    const { claimId } = req.params;
    const { reimbursement_method, transaction_id } = req.body;
    const processed_by = req.user.id;

    if (!reimbursement_method || !['Payroll', 'Direct Transfer'].includes(reimbursement_method)) {
        return res.status(400).json({ message: "A valid reimbursement_method ('Payroll' or 'Direct Transfer') is required."});
    }
    if (reimbursement_method === 'Direct Transfer' && !transaction_id) {
        return res.status(400).json({ message: 'A transaction ID is required for a direct transfer.'});
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const status = reimbursement_method === 'Direct Transfer' ? 'Reimbursed' : 'Processed';

        const sql = `
            UPDATE expense_claims
            SET status = ?, reimbursement_method = ?, processed_by = ?, processed_date = NOW(), transaction_id = ?, updated_by = ?
            WHERE id = ? AND status = 'Approved';
        `;
        const [result] = await connection.query(sql, [status, reimbursement_method, processed_by, transaction_id || null, processed_by, claimId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Approved expense claim not found.' });
        }
        res.status(200).json({ success: true, message: 'Reimbursement details have been set successfully.' });
    } catch (error) {
        console.error('Error setting reimbursement details:', error);
        res.status(500).json({ message: 'An internal server error occurred.'});
    } finally {
        if (connection) connection.release();
    }
}


module.exports = {
    getPendingExpenseApprovals,
    processExpenseClaim,
    setReimbursementDetails
};