const { pool } = require('../../db/connector');

/**
 * @description [Admin] Updates key details of a loan application before it is disbursed.
 */
const updateLoanApplicationByAdmin = async (req, res) => {
    const { applicationId } = req.params;
    const fieldsToUpdate = req.body;
    const updated_by = req.user.id;

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({ message: 'At least one field to update is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[application]] = await connection.query('SELECT status FROM loan_applications WHERE id = ? FOR UPDATE', [applicationId]);
        if (!application) {
            await connection.rollback();
            return res.status(404).json({ message: 'Loan application not found.' });
        }

        if (['Disbursed', 'Rejected', 'Closed'].includes(application.status)) {
            await connection.rollback();
            return res.status(409).json({ message: `Cannot edit a loan that is already ${application.status.toLowerCase()}.` });
        }

        const fieldEntries = Object.entries(fieldsToUpdate);
        const setClause = fieldEntries.map(([key]) => `${key} = ?`).join(', ');
        const values = fieldEntries.map(([, value]) => value);
        values.push(updated_by, applicationId);

        const sql = `UPDATE loan_applications SET ${setClause}, updated_by = ? WHERE id = ?;`;
        await connection.query(sql, values);
        
        await connection.commit();
        res.status(200).json({ success: true, message: 'Loan application has been updated by admin.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating loan by admin:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    updateLoanApplicationByAdmin
};