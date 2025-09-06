const { pool } = require('../../../db/connector');

/**
 * @description Recalculates and updates the totals for a given payslip and the master payroll run.
 * This is a helper function to be used within a transaction.
 */
const recalculateTotals = async (connection, payslipId, payrollId) => {
    const [[totals]] = await connection.query(
        `SELECT 
            SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END) as gross_earnings,
            SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END) as total_deductions
         FROM payslip_details WHERE payslip_id = ?`,
        [payslipId]
    );
    const net_pay = (totals.gross_earnings || 0) - (totals.total_deductions || 0);
    await connection.query(
        'UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ? WHERE id = ?',
        [totals.gross_earnings || 0, totals.total_deductions || 0, net_pay, payslipId]
    );
    const [[grandTotal]] = await connection.query(
        'SELECT SUM(net_pay) as total_net_pay FROM payslips WHERE payroll_id = ?',
        [payrollId]
    );
    await connection.query(
        'UPDATE payrolls SET total_net_pay = ? WHERE id = ?',
        [grandTotal.total_net_pay || 0, payrollId]
    );
};

/**
 * @description [Admin] Gets a single payslip and all its details for editing.
 */
const getEditablePayslipDetails = async (req, res) => {
    const { payslipId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT pd.*, p.status as payroll_status 
            FROM payslip_details pd
            JOIN payslips ps ON pd.payslip_id = ps.id
            JOIN payrolls p ON ps.payroll_id = p.id
            WHERE pd.payslip_id = ?
        `;
        const [details] = await connection.query(sql, [payslipId]);

        // if (details.length > 0 && details[0].payroll_status !== 'processing') {
        //     return res.status(403).json({ message: 'This payslip belongs to a finalized payroll and can no longer be edited.' });
        // }

        res.status(200).json(details);
    } catch (error) {
        console.error('Error fetching editable payslip details:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};



/**
 * @description [Admin] Adds a new component (line item) to a payslip.
 * The system generates the new component's ID automatically.
 */
const addPayslipComponent = async (req, res) => {
    const { payslipId } = req.params;
    const { component_name, component_type, amount } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[payslip]] = await connection.query(
            'SELECT p.status, p.id as payroll_id FROM payslips ps JOIN payrolls p ON ps.payroll_id = p.id WHERE ps.id = ?', 
            [payslipId]
        );
        if (!payslip) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        if (payslip.status !== 'processing') {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot edit a finalized payroll.' });
        }

        const insertSql = `
            INSERT INTO payslip_details (payslip_id, component_name, component_type, amount)
            VALUES (?, ?, ?, ?);
        `;
        const [result] = await connection.query(insertSql, [payslipId, component_name, component_type, amount]);
        
        await recalculateTotals(connection, payslipId, payslip.payroll_id);
        await connection.commit();

        res.status(201).json({ 
            success: true, 
            message: 'Payslip component added successfully.',
            newDetailId: result.insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding payslip component:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin] Updates an existing component (line item) on a payslip.
 */
const updatePayslipComponent = async (req, res) => {
    const { payslipId, detailId } = req.params;
    const { component_name, component_type, amount } = req.body;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[payslip]] = await connection.query(
            'SELECT p.status, p.id as payroll_id FROM payslips ps JOIN payrolls p ON ps.payroll_id = p.id WHERE ps.id = ?', 
            [payslipId]
        );
        if (!payslip) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        if (payslip.status !== 'processing') {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot edit a finalized payroll.' });
        }

        const updateSql = `
            UPDATE payslip_details 
            SET component_name = ?, component_type = ?, amount = ?
            WHERE id = ? AND payslip_id = ?;
        `;
        const [result] = await connection.query(updateSql, [component_name, component_type, amount, detailId, payslipId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip detail item not found.' });
        }

        await recalculateTotals(connection, payslipId, payslip.payroll_id);
        await connection.commit();

        res.status(200).json({ success: true, message: 'Payslip component updated successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating payslip component:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


/**
 * @description [Admin] Removes a component (line item) from a payslip.
 */
const removePayslipComponent = async (req, res) => {
    const { payslipId, detailId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[payslip]] = await connection.query(
            'SELECT p.status, p.id as payroll_id FROM payslips ps JOIN payrolls p ON ps.payroll_id = p.id WHERE ps.id = ?', 
            [payslipId]
        );

        if (!payslip) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        if (payslip.status !== 'processing') {
            await connection.rollback();
            return res.status(403).json({ message: 'Cannot edit a finalized payroll.' });
        }
        
        const [result] = await connection.query('DELETE FROM payslip_details WHERE id = ? AND payslip_id = ?', [detailId, payslipId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip detail item not found.' });
        }

        // After removing the line item, recalculate all totals
        await recalculateTotals(connection, payslipId, payslip.payroll_id);

        await connection.commit();
        res.status(204).send();

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error removing payslip component:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getEditablePayslipDetails,
    updatePayslipComponent,
    removePayslipComponent,
    addPayslipComponent
};