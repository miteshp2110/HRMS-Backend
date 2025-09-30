const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Admin] Manually records a repayment for a single EMI.
 */
const manualRepayment = async (req, res) => {
    const { scheduleId } = req.params;
    const { repayment_date, transaction_id } = req.body;
    const updated_by = req.user.id;

    if (!repayment_date || !transaction_id) {
        return res.status(400).json({ message: 'Repayment date and transaction ID are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[schedule]] = await connection.query('SELECT * FROM loan_amortization_schedule WHERE id = ? AND status = "Pending" FOR UPDATE', [scheduleId]);
        if (!schedule) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pending EMI schedule not found.' });
        }

        // 1. Create the repayment record
        const repaymentSql = `
            INSERT INTO loan_repayments (loan_application_id, schedule_id, repayment_amount, repayment_date, updated_by,transaction_id)
            VALUES (?, ?, ?, ?, ?, ?);
        `;
        const [repaymentResult] = await connection.query(repaymentSql, [schedule.loan_application_id, scheduleId, schedule.emi_amount, repayment_date, updated_by, transaction_id]);
        
        // 2. Update the schedule status to 'Paid'
        await connection.query('UPDATE loan_amortization_schedule SET status = "Paid", repayment_id = ? WHERE id = ?', [repaymentResult.insertId, scheduleId]);
        
        // 3. Check if this was the last EMI to close the loan
        const [[pending_emis]] = await connection.query('SELECT COUNT(*) as count FROM loan_amortization_schedule WHERE loan_application_id = ? AND status = "Pending"', [schedule.loan_application_id]);
        if(pending_emis.count === 0){
            await connection.query('UPDATE loan_applications SET status = "Closed" WHERE id = ?', [schedule.loan_application_id]);
        }
        
        await connection.commit();
        res.status(200).json({ success: true, message: 'EMI has been marked as paid successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in manual repayment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Forecloses a loan, calculating the outstanding principal and closing the application.
 */
const forecloseLoan = async (req, res) => {
    const { applicationId } = req.params;
    const updated_by = req.user.id;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[outstanding]] = await connection.query(`
            SELECT SUM(principal_component) as outstanding_principal
            FROM loan_amortization_schedule
            WHERE loan_application_id = ? AND status = 'Pending';
        `, [applicationId]);

        if (!outstanding || outstanding.outstanding_principal === null) {
            await connection.rollback();
            return res.status(404).json({ message: 'No outstanding principal found for this loan. It may already be closed.' });
        }
        
        const outstanding_principal = parseFloat(outstanding.outstanding_principal);

        // 1. Mark all pending EMIs as 'Paid' to close them out
        await connection.query('UPDATE loan_amortization_schedule SET status = "Paid" WHERE loan_application_id = ? AND status = "Pending"', [applicationId]);
        
        // 2. Update the main loan application to 'Foreclosed'
        await connection.query('UPDATE loan_applications SET status = "Closed" WHERE id = ?', [applicationId]);
        
        await connection.commit();
        res.status(200).json({
            success: true,
            message: 'Loan has been foreclosed successfully.',
            final_settlement_amount: outstanding_principal.toFixed(2)
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error foreclosing loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    manualRepayment,
    forecloseLoan
};