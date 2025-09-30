const { pool } = require('../../db/connector');

/**
 * @description [Admin] Updates any field of an expense claim as long as it is not reimbursed or rejected.
 */
const updateExpenseClaimByAdmin = async (req, res) => {
    const { claimId } = req.params;
    const fieldsToUpdate = req.body;
    const updated_by = req.user.id;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'At least one field to update is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // First, check the current status of the claim
        const [[claim]] = await connection.query('SELECT status FROM expense_claims WHERE id = ? FOR UPDATE', [claimId]);

        if (!claim) {
            await connection.rollback();
            return res.status(404).json({ message: 'Expense claim not found.' });
        }

        // Enforce the rule that reimbursed or rejected claims cannot be edited
        if (['Reimbursed', 'Rejected'].includes(claim.status)) {
            await connection.rollback();
            return res.status(409).json({ message: `Cannot edit a claim that has already been ${claim.status.toLowerCase()}.` });
        }

        // Dynamically build the SET clause
        const fieldEntries = Object.entries(fieldsToUpdate);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        
        values.push(updated_by, claimId); // Add updated_by and the claimId for the WHERE clause

        const sql = `
            UPDATE expense_claims
            SET ${setClause}, updated_by = ?
            WHERE id = ?;
        `;

        await connection.query(sql, values);
        await connection.commit();

        res.status(200).json({ success: true, message: 'Expense claim updated successfully by admin.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating expense claim by admin:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    updateExpenseClaimByAdmin
};