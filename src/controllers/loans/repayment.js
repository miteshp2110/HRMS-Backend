const { pool } = require('../../db/connector');

/**
 * @description [Admin] Adds a manual repayment for an active loan and recalculates the remaining EMIs.
 */
const addManualRepayment = async (req, res) => {
    const { loanId } = req.params;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'A valid, positive repayment amount is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Get the current state of the loan
        const [[loan]] = await connection.query(
            "SELECT * FROM employee_loans WHERE id = ? AND status = 'active'", 
            [loanId]
        );

        if (!loan) {
            await connection.rollback();
            return res.status(404).json({ message: 'Active loan not found.' });
        }

        // 2. Calculate the current outstanding balance
        const currentOutstanding = parseFloat(loan.emi_amount) * loan.remaining_installments;

        if (parseFloat(amount) > currentOutstanding) {
            await connection.rollback();
            return res.status(400).json({ message: `Repayment amount (${amount}) cannot be greater than the outstanding balance (${currentOutstanding}).` });
        }

        // 3. Log the manual repayment with a NULL payslip_id
        const repaymentSql = `
            INSERT INTO loan_repayments (loan_id, payslip_id, repayment_amount, repayment_date)
            VALUES (?, NULL, ?, CURDATE())
        `;
        await connection.query(repaymentSql, [loanId, amount]);
        
        // 4. Recalculate the new outstanding balance and the new EMI
        const newOutstanding = currentOutstanding - parseFloat(amount);
        let newEmiAmount = 0;
        let newStatus = loan.status;
        let newRemainingInstallments = loan.remaining_installments;

        if (newOutstanding <= 0) {
            // The loan is now fully paid off
            newStatus = 'paid_off';
            newRemainingInstallments = 0;
        } else {
            // Recalculate the EMI for the remaining installments
            newEmiAmount = (newOutstanding / loan.remaining_installments).toFixed(2);
        }

        // 5. Update the main loan record
        const updateLoanSql = `
            UPDATE employee_loans 
            SET emi_amount = ?, status = ?, remaining_installments = ?
            WHERE id = ?
        `;
        await connection.query(updateLoanSql, [newEmiAmount, newStatus, newRemainingInstallments, loanId]);

        await connection.commit();
        res.status(200).json({ 
            success: true, 
            message: 'Manual repayment was successful. Loan details have been updated.',
            new_emi_amount: newEmiAmount,
            status: newStatus
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding manual repayment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { addManualRepayment };