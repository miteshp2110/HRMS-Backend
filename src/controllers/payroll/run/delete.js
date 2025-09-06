const { pool } = require('../../../db/connector');

/**
 * @description [Admin] Deletes a master payroll run and all its associated payslips,
 * but only if the status is NOT 'paid'.
 */
const deletePayrollRun = async (req, res) => {
    const { payrollId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // --- NEW: Check the status of the payroll run first ---
        const [[payroll]] = await connection.query(
            'SELECT status FROM payrolls WHERE id = ?', 
            [payrollId]
        );

        if (!payroll) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payroll run not found.' });
        }

        if (payroll.status === 'paid') {
            await connection.rollback();
            return res.status(409).json({ message: 'Cannot delete a payroll run that has already been marked as paid.' });
        }

        // If status is not 'paid' (e.g., 'processing'), proceed with deletion
        const [result] = await connection.query('DELETE FROM payrolls WHERE id = ?', [payrollId]);
        
        await connection.commit();

        if (result.affectedRows === 0) {
            // This case should theoretically not be hit due to the check above, but it's good for safety.
            return res.status(404).json({ message: 'Payroll run not found.' });
        }

        res.status(204).send(); // Success, no content to return
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting payroll run:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { deletePayrollRun };