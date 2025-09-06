const { pool } = require('../../db/connector');

/**
 * @description [Admin] Edits the details of an existing loan.
 * Does not allow changing the principal_amount.
 */
const editLoan = async (req, res) => {
    const { loanId } = req.params;
    const fieldsToUpdate = req.body;

    // Forbid changing the principal amount to maintain financial integrity
    delete fieldsToUpdate.principal_amount;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'At least one field to update is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Dynamically build the SQL query
        const fieldEntries = Object.entries(fieldsToUpdate);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        values.push(loanId); // Add the loan ID for the WHERE clause

        const sql = `UPDATE employee_loans SET ${setClause} WHERE id = ?`;
        const [result] = await connection.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Loan not found.' });
        }

        res.status(200).json({ success: true, message: 'Loan details updated successfully.' });

    } catch (error) {
        console.error('Error editing loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { editLoan };