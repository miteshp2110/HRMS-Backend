const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Manager/HR] Fetches pending loan applications based on the user's role.
 */
const getLoanApprovals = async (req, res) => {
    const approverId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        // This query now correctly fetches applications for either a manager or HR
        // based on which approval fields are NULL.
        const sql = `
            SELECT
                la.*,
                lt.name as loan_type_name,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            JOIN user e ON la.employee_id = e.id
            WHERE
                la.status = 'Pending Approval' AND
                (
                    -- For Manager: The application is assigned to them and manager_approver_id is not yet set
                    (e.reports_to = ? AND la.manager_approver_id IS NULL)
                    OR
                    -- For HR: The manager has approved, and hr_approver_id is not yet set
                    (la.manager_approver_id IS NOT NULL AND la.hr_approver_id IS NULL AND ?)
                )
            ORDER BY la.created_at ASC;
        `;
        // We use a permission check to determine if the user should see the HR queue.
        const isHR = req.user.permissions.includes('loans.manage_hr');
        const [applications] = await connection.query(sql, [approverId, isHR]);

        res.status(200).json(applications);
    } catch (error) {
        console.error('Error fetching loan approvals:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Manager/HR] Processes a loan application (approve/reject).
 */
const processLoan = async (req, res) => {
    const { applicationId } = req.params;
    const { status, approved_amount, rejection_reason } = req.body;
    const approverId = req.user.id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[application]] = await connection.query(`SELECT * FROM loan_applications WHERE id = ? AND status = 'Pending Approval' FOR UPDATE`, [applicationId]);
        if (!application) {
            await connection.rollback();
            return res.status(404).json({ message: 'Loan application not found or not pending approval.' });
        }

        let nextStatus = application.status; // Default to current status

        if (status === 'Approved') {
            // If the manager is approving
            if (application.manager_approver_id === null) {
                await connection.query('UPDATE loan_applications SET manager_approver_id = ? WHERE id = ?', [approverId, applicationId]);
                // Status remains 'Pending Approval' for HR
            }
            // If HR is giving the final approval
            else if (application.hr_approver_id === null) {
                nextStatus = 'Approved'; // Final approval status
                await connection.query('UPDATE loan_applications SET hr_approver_id = ?, approved_amount = ? WHERE id = ?', [approverId, approved_amount || application.requested_amount, applicationId]);
            }
        } else if (status === 'Rejected') {
            nextStatus = 'Rejected';
            // Determine who is rejecting for the audit trail
            if (application.manager_approver_id === null) {
                 await connection.query('UPDATE loan_applications SET manager_approver_id = ? WHERE id = ?', [approverId, applicationId]);
            } else {
                 await connection.query('UPDATE loan_applications SET hr_approver_id = ? WHERE id = ?', [approverId, applicationId]);
            }
            await connection.query('UPDATE loan_applications SET rejection_reason = ? WHERE id = ?', [rejection_reason, applicationId]);
        } else {
            await connection.rollback();
            return res.status(400).json({ message: 'Invalid status provided.' });
        }

        await connection.query('UPDATE loan_applications SET status = ?, updated_by = ? WHERE id = ?', [nextStatus, approverId, applicationId]);
        await connection.commit();
        res.status(200).json({ success: true, message: `Application has been ${status.toLowerCase()}.` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error processing loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Finance] Disburses an approved loan or advance.
 */
const disburseLoan = async (req, res) => {
    const { applicationId } = req.params;
    const { disbursement_date, jv_number } = req.body;
    const disburserId = req.user.id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[application]] = await connection.query(`
            SELECT la.*, lt.is_advance
            FROM loan_applications la
            JOIN loan_types lt ON la.loan_type_id = lt.id
            WHERE la.id = ? AND la.status = 'Approved' FOR UPDATE
        `, [applicationId]);

        if (!application) {
            await connection.rollback();
            return res.status(404).json({ message: 'Approved loan application not found.' });
        }

        await connection.query(`UPDATE loan_applications SET status = 'Disbursed', disbursement_date = ?, jv_number = ?, updated_by = ? WHERE id = ?`, [disbursement_date, jv_number, disburserId, applicationId]);

        if (!application.is_advance) {
            const { approved_amount, tenure_months, interest_rate } = application;
            
            const monthlyInterestRate = (interest_rate || 0) / 12 / 100;
            const emi = monthlyInterestRate > 0 ?
                (approved_amount * monthlyInterestRate * Math.pow(1 + monthlyInterestRate, tenure_months)) / (Math.pow(1 + monthlyInterestRate, tenure_months) - 1) :
                approved_amount / tenure_months;

            let balance = approved_amount;
            for (let i = 1; i <= tenure_months; i++) {
                const interestComponent = balance * monthlyInterestRate;
                const principalComponent = emi - interestComponent;
                balance -= principalComponent;
                const dueDate = DateTime.fromISO(disbursement_date).plus({ months: i }).toISODate();

                await connection.query(`
                    INSERT INTO loan_amortization_schedule (loan_application_id, due_date, emi_amount, principal_component, interest_component)
                    VALUES (?, ?, ?, ?, ?);
                `, [applicationId, dueDate, emi, principalComponent, interestComponent]);
            }
            
            await connection.query('UPDATE loan_applications SET emi_amount = ? WHERE id = ?', [emi.toFixed(2), applicationId]);
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Loan/Advance has been disbursed successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error disbursing loan:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getLoanApprovals,
    processLoan,
    disburseLoan
};