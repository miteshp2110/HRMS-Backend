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

/**
 * @description [Admin] Proactively reschedules an upcoming EMI to a lower amount and redistributes the difference to subsequent EMIs.
 */
const rescheduleUpcomingEMI = async (req, res) => {
    const { scheduleId } = req.params;
    const { new_emi_amount } = req.body;
    const updated_by = req.user.id;

    if (new_emi_amount === undefined) {
        return res.status(400).json({ message: 'A new EMI required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[schedule]] = await connection.query(`
            SELECT las.*, la.interest_rate, la.approved_amount
            FROM loan_amortization_schedule las
            JOIN loan_applications la ON las.loan_application_id = la.id
            WHERE las.id = ? AND las.status = 'Pending' FOR UPDATE
        `, [scheduleId]);

        if (!schedule) {
            await connection.rollback();
            return res.status(404).json({ message: 'Pending EMI schedule not found.' });
        }
        
        const dueDate = DateTime.fromJSDate(schedule.due_date);
        if (dueDate <= DateTime.now()) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot adjust an EMI that is past due or due today.' });
        }

        const originalEmiAmount = parseFloat(schedule.emi_amount);
        const newEmiAmount = parseFloat(new_emi_amount);

        if (newEmiAmount >= originalEmiAmount) {
            await connection.rollback();
            return res.status(400).json({ message: `New EMI amount must be less than the current amount of ${originalEmiAmount}.` });
        }

        // FIXED: Calculate outstanding principal using actual repayments from loan_repayments table
        const [[repaymentData]] = await connection.query(`
            SELECT COALESCE(SUM(repayment_amount), 0) as total_repaid 
            FROM loan_repayments 
            WHERE loan_application_id = ?
        `, [schedule.loan_application_id]);
        
        const totalRepaid = parseFloat(repaymentData.total_repaid || 0);
        const approvedAmount = parseFloat(schedule.approved_amount);
        const outstandingPrincipalBeforeThisEMI = approvedAmount - totalRepaid;

        // Validate that there's still principal outstanding
        if (outstandingPrincipalBeforeThisEMI <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Loan has been fully repaid. No outstanding principal.' });
        }

        const monthlyInterestRate = (schedule.interest_rate || 0) / 12 / 100;
        const newInterestComponent = outstandingPrincipalBeforeThisEMI * monthlyInterestRate;
        const newPrincipalComponent = newEmiAmount - newInterestComponent;

        if (newPrincipalComponent <= 0) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `New EMI amount is too low. It does not cover the interest of ${newInterestComponent.toFixed(2)}.` 
            });
        }

        // Get all subsequent pending EMIs (including the current one being rescheduled)
        const [allPendingEMIs] = await connection.query(
            `SELECT id, due_date, emi_amount 
             FROM loan_amortization_schedule 
             WHERE loan_application_id = ? 
             AND status = 'Pending' 
             AND due_date >= (SELECT due_date FROM loan_amortization_schedule WHERE id = ?)
             ORDER BY due_date ASC`,
            [schedule.loan_application_id, scheduleId]
        );

        if (allPendingEMIs.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No pending EMIs found.' });
        }

        // Check if this is the last EMI
        if (allPendingEMIs.length === 1) {
            await connection.rollback();
            return res.status(400).json({ message: 'Cannot adjust the last EMI of a loan.' });
        }

        // Update the current EMI being rescheduled
        await connection.query(
            `UPDATE loan_amortization_schedule 
             SET emi_amount = ?, principal_component = ?, interest_component = ? 
             WHERE id = ?`,
            [newEmiAmount, newPrincipalComponent, newInterestComponent, scheduleId]
        );
        
        // Calculate remaining balance after this rescheduled EMI
        const remainingPrincipalAfterThisEMI = outstandingPrincipalBeforeThisEMI - newPrincipalComponent;
        const subsequentEMIs = allPendingEMIs.slice(1); // All EMIs after the current one
        const remainingTenure = subsequentEMIs.length;

        // Calculate new EMI for subsequent installments using standard EMI formula
        const newFutureEmi = monthlyInterestRate > 0 ?
            (remainingPrincipalAfterThisEMI * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, remainingTenure)) / 
            (Math.pow(1 + monthlyInterestRate, remainingTenure) - 1) :
            remainingPrincipalAfterThisEMI / remainingTenure;

        // Recalculate and update all subsequent EMIs
        let balance = remainingPrincipalAfterThisEMI;
        for (let i = 0; i < subsequentEMIs.length; i++) {
            const emi = subsequentEMIs[i];
            const interest = balance * monthlyInterestRate;
            let principal = newFutureEmi - interest;
            
            // For the last EMI, adjust to clear remaining balance (handle rounding issues)
            if (i === subsequentEMIs.length - 1) {
                principal = balance;
                const finalEmi = principal + interest;
                await connection.query(
                    `UPDATE loan_amortization_schedule 
                     SET emi_amount = ?, principal_component = ?, interest_component = ? 
                     WHERE id = ?`,
                    [finalEmi, principal, interest, emi.id]
                );
            } else {
                await connection.query(
                    `UPDATE loan_amortization_schedule 
                     SET emi_amount = ?, principal_component = ?, interest_component = ? 
                     WHERE id = ?`,
                    [newFutureEmi, principal, interest, emi.id]
                );
            }
            
            balance -= principal;
        }

        await connection.commit();
        res.status(200).json({ 
            success: true, 
            message: `EMI for ${dueDate.toFormat('dd LLL yyyy')} was adjusted to ${newEmiAmount.toFixed(2)}. Subsequent EMIs have been recalculated to ${newFutureEmi.toFixed(2)}.`,
            details: {
                original_emi: originalEmiAmount,
                new_emi: newEmiAmount,
                outstanding_principal: outstandingPrincipalBeforeThisEMI.toFixed(2),
                subsequent_emi: newFutureEmi.toFixed(2),
                remaining_installments: remainingTenure
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error rescheduling EMI:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Admin] Records a lump sum payment against a loan, recalculates the schedule, or closes the loan.
 */
const makeLumpSumPayment = async (req, res) => {
    const { applicationId } = req.params;
    const { paid_amount, repayment_date, transaction_id } = req.body;
    const updated_by = req.user.id;

    if (!paid_amount || !repayment_date || !transaction_id) {
        return res.status(400).json({ message: 'Paid amount, repayment date, and transaction ID are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[application]] = await connection.query(
            'SELECT * FROM loan_applications WHERE id = ? AND status = "Disbursed" FOR UPDATE', 
            [applicationId]
        );
        
        if (!application) {
            await connection.rollback();
            return res.status(404).json({ message: 'Disbursed loan application not found.' });
        }

        // FIXED: Calculate actual outstanding principal using repayments
        const [[repaymentData]] = await connection.query(`
            SELECT COALESCE(SUM(repayment_amount), 0) as total_repaid
            FROM loan_repayments
            WHERE loan_application_id = ?
        `, [applicationId]);
        
        const totalRepaid = parseFloat(repaymentData.total_repaid || 0);
        const approvedAmount = parseFloat(application.approved_amount);
        const outstandingPrincipal = approvedAmount - totalRepaid;
        
        // Validate that there's still principal outstanding
        if (outstandingPrincipal <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Loan has already been fully repaid.' });
        }

        // Prevent overpayment
        const paidAmount = parseFloat(paid_amount);
        if (paidAmount > outstandingPrincipal) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `Payment amount (${paidAmount.toFixed(2)}) cannot exceed the outstanding principal of ${outstandingPrincipal.toFixed(2)}.` 
            });
        }

        // Validate paid amount is positive
        if (paidAmount <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Payment amount must be greater than zero.' });
        }

        // Record the lump sum payment
        await connection.query(
            `INSERT INTO loan_repayments (loan_application_id, repayment_amount, repayment_date, updated_by, transaction_id) 
             VALUES (?, ?, ?, ?, ?)`,
            [applicationId, paidAmount, repayment_date, updated_by, transaction_id]
        );
        
        // Check if loan is fully paid (allow 0.01 tolerance for rounding)
        const remainingAfterPayment = outstandingPrincipal - paidAmount;
        
        if (Math.abs(remainingAfterPayment) < 0.01) {
            // Mark all pending schedules as paid
            await connection.query(
                "UPDATE loan_amortization_schedule SET status = 'Paid' WHERE loan_application_id = ? AND status = 'Pending'", 
                [applicationId]
            );
            
            // Close the loan
            await connection.query(
                "UPDATE loan_applications SET status = 'Closed' WHERE id = ?", 
                [applicationId]
            );
            
            await connection.commit();
            return res.status(200).json({ 
                success: true, 
                message: `Payment of ${paidAmount.toFixed(2)} received. The loan has been fully paid and is now closed.`,
                details: {
                    total_loan_amount: approvedAmount.toFixed(2),
                    total_repaid: (totalRepaid + paidAmount).toFixed(2),
                    remaining_balance: '0.00',
                    loan_status: 'Closed'
                }
            });
        }

        // Calculate new principal after this payment
        const newPrincipal = outstandingPrincipal - paidAmount;
        
        // Get remaining pending EMIs
        const [remainingEMIs] = await connection.query(
            `SELECT id, due_date 
             FROM loan_amortization_schedule 
             WHERE loan_application_id = ? AND status = 'Pending' 
             ORDER BY due_date ASC`, 
            [applicationId]
        );
        
        if (remainingEMIs.length === 0) { 
            await connection.rollback();
            return res.status(409).json({ message: 'No pending EMIs found to adjust.' });
        }

        // Delete all pending schedules (will recreate them)
        await connection.query(
            "DELETE FROM loan_amortization_schedule WHERE loan_application_id = ? AND status = 'Pending'", 
            [applicationId]
        );
        
        // Calculate new EMI based on remaining principal and tenure
        const { interest_rate } = application;
        const newTenure = remainingEMIs.length;
        const monthlyInterestRate = (interest_rate || 0) / 12 / 100;
        
        const newEmi = monthlyInterestRate > 0 ?
            (newPrincipal * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, newTenure)) / 
            (Math.pow(1 + monthlyInterestRate, newTenure) - 1) :
            newPrincipal / newTenure;

        // Recreate amortization schedule
        let balance = newPrincipal;
        const firstNewDueDate = DateTime.fromJSDate(remainingEMIs[0].due_date);
        
        for (let i = 0; i < newTenure; i++) {
            const interestComponent = balance * monthlyInterestRate;
            let principalComponent = newEmi - interestComponent;
            
            // For the last EMI, adjust to clear remaining balance (handle rounding)
            if (i === newTenure - 1) {
                principalComponent = balance;
            }
            
            balance -= principalComponent;
            const dueDate = firstNewDueDate.plus({ months: i }).toISODate();
            const emiAmount = principalComponent + interestComponent;

            await connection.query(`
                INSERT INTO loan_amortization_schedule 
                (loan_application_id, due_date, emi_amount, principal_component, interest_component)
                VALUES (?, ?, ?, ?, ?)
            `, [applicationId, dueDate, emiAmount, principalComponent, interestComponent]);
        }

        // Update the loan application with new EMI
        await connection.query(
            'UPDATE loan_applications SET emi_amount = ? WHERE id = ?', 
            [newEmi.toFixed(2), applicationId]
        );

        await connection.commit();
        res.status(200).json({ 
            success: true, 
            message: `Lump sum payment of ${paidAmount.toFixed(2)} recorded successfully. The remaining loan schedule has been recalculated.`,
            details: {
                payment_amount: paidAmount.toFixed(2),
                outstanding_before: outstandingPrincipal.toFixed(2),
                outstanding_after: newPrincipal.toFixed(2),
                new_emi: newEmi.toFixed(2),
                remaining_installments: newTenure
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error making lump sum payment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    manualRepayment,
    forecloseLoan,
    rescheduleUpcomingEMI,
    makeLumpSumPayment
};