
const { pool } = require('../../db/connector');

/**
 * @description Get all payslips for a specific cycle (for review tab).
 */
exports.getPayslipsForCycle = async (req, res) => {
    const { cycleId } = req.params;
    try {
        const [payslips] = await pool.query(`
            SELECT 
                p.id, 
                p.employee_id, 
                CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                p.gross_earnings, 
                p.total_deductions, 
                p.net_pay, 
                p.status
            FROM payslips p
            JOIN user u ON p.employee_id = u.id
            WHERE p.cycle_id = ?
            ORDER BY u.first_name, u.last_name
        `, [cycleId]);
        
        res.status(200).json(payslips);
    } catch (error) {
        console.error('Error fetching payslips for cycle:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description Get detailed payslip for review.
 */
exports.getPayslipForReview = async (req, res) => {
    const { payslipId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [[payslip]] = await connection.query(`
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name,
                   pc.cycle_name, pc.start_date, pc.end_date
            FROM payslips p 
            JOIN user u ON p.employee_id = u.id
            JOIN payroll_cycles pc ON p.cycle_id = pc.id
            WHERE p.id = ?
        `, [payslipId]);

        if (!payslip) {
            return res.status(404).json({ message: 'Payslip not found.' });
        }

        const [details] = await connection.query(`
            SELECT pd.*, 
                   COALESCE(
                       (SELECT pg.group_name 
                        FROM payroll_group_components pgc 
                        JOIN payroll_groups pg ON pgc.group_id = pg.id 
                        WHERE pgc.component_id = pd.component_id 
                        LIMIT 1), 
                       'Manual/System'
                   ) as group_name
            FROM payslip_details pd
            WHERE pd.payslip_id = ?
            ORDER BY pd.component_type, pd.component_name
        `, [payslipId]);

        // Parse calculation breakdowns
        details.forEach(d => {
            try {
                d.calculation_breakdown = typeof d.calculation_breakdown === 'string' ? 
                    JSON.parse(d.calculation_breakdown) : d.calculation_breakdown;
            } catch (e) {
                d.calculation_breakdown = {};
            }
        });

        res.status(200).json({ ...payslip, details });
    } catch (error) {
        console.error('Error fetching payslip for review:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Update payslip status (Draft/Reviewed).
 */
exports.updatePayslipStatus = async (req, res) => {
    const { payslipId } = req.params;
    const { status } = req.body;

    if (!status || !['Draft', 'Reviewed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const [result] = await pool.query("UPDATE payslips SET status = ? WHERE id = ?", [status, payslipId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Payslip not found.' });
        }
        res.status(200).json({ success: true, message: `Payslip status updated to ${status}.` });
    } catch (error) {
        console.error('Error updating payslip status:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description Add manual adjustment to specific payslip.
 */
exports.addManualAdjustment = async (req, res) => {
    const { payslipId } = req.params;
    const { component_name, component_type, amount, reason } = req.body;

    if (!component_name || !component_type || amount === undefined) {
        return res.status(400).json({ message: 'Component name, type, and amount are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Verify payslip exists
        const [[payslip]] = await connection.query('SELECT id, cycle_id FROM payslips WHERE id = ?', [payslipId]);
        if (!payslip) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip not found.' });
        }

        const breakdown = {
            source: 'Manual Adjustment',
            adjusted_by: req.user.id,
            reason: reason || 'Manual adjustment',
            timestamp: new Date().toISOString(),
            component_type: 'manual'
        };

        // Insert the adjustment
        await connection.query(`
            INSERT INTO payslip_details (payslip_id, component_id, component_name, component_type, amount, calculation_breakdown)
            VALUES (?, NULL, ?, ?, ?, ?)
        `, [payslipId, component_name, component_type, amount, JSON.stringify(breakdown)]);

        // Recalculate totals
        const [[totals]] = await connection.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END), 0) as gross,
                COALESCE(SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END), 0) as ded
            FROM payslip_details WHERE payslip_id = ?
        `, [payslipId]);

        const net_pay = (totals.gross || 0) - (totals.ded || 0);
        await connection.query(
            "UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?",
            [totals.gross || 0, totals.ded || 0, net_pay, payslipId]
        );
        await connection.query(`update payroll_cycles set status = 'Review' where id = (select cycle_id from payslips where id = ?)`,[payslipId])

        

        await connection.commit();
        res.status(200).json({ success: true, message: 'Manual adjustment added successfully.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding manual adjustment:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Finalize a payslip (locks it from further edits).
 */
exports.finalizePayslip = async (req, res) => {
    const { payslipId } = req.params;
    
    try {
        const [result] = await pool.query(
            "UPDATE payslips SET status = 'Finalized' WHERE id = ? AND status IN ('Draft', 'Reviewed')",
            [payslipId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Payslip not found or already finalized.' });
        }
        
        res.status(200).json({ success: true, message: 'Payslip finalized successfully.' });
    } catch (error) {
        console.error('Error finalizing payslip:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description Add bulk component to all payslips in a cycle.
 */
exports.bulkAddComponents = async (req, res) => {
    const { cycleId } = req.params;
    const { component_name, component_type, amount, reason } = req.body;

    if (!component_name || !component_type || amount === undefined) {
        return res.status(400).json({ message: 'Component name, type, and amount are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [payslips] = await pool.query("SELECT id FROM payslips WHERE cycle_id = ?", [cycleId]);
        if (payslips.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'No payslips found for this cycle.' });
        }

        const breakdown = {
            source: 'Bulk Manual Adjustment',
            reason: reason || 'Bulk adjustment',
            added_by: req.user.id,
            timestamp: new Date().toISOString(),
            component_type: 'bulk_manual'
        };
        const breakdownString = JSON.stringify(breakdown);

        for (const payslip of payslips) {
            await connection.query(`
                INSERT INTO payslip_details (payslip_id, component_name, component_type, amount, calculation_breakdown)
                VALUES (?, ?, ?, ?, ?)
            `, [payslip.id, component_name, component_type, amount, breakdownString]);

            const [[totals]] = await connection.query(`
                SELECT 
                    COALESCE(SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END), 0) as gross,
                    COALESCE(SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END), 0) as ded
                FROM payslip_details WHERE payslip_id = ?
            `, [payslip.id]);

            const net_pay = (totals.gross || 0) - (totals.ded || 0);
            await connection.query(
                "UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?",
                [totals.gross || 0, totals.ded || 0, net_pay, payslip.id]
            );
        }

        await connection.commit();
        res.status(200).json({ 
            success: true, 
            message: `Bulk component added successfully to ${payslips.length} payslips. All payslips are now in "Draft" status.`
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error in bulk add components:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Get employee's own payslip for a cycle (self-service).
 */
exports.getMyPayslip = async (req, res) => {
    const { cycleId } = req.params;
    const employeeId = req.user.id;

    try {
        const [[payslip]] = await pool.query('SELECT id FROM payslips WHERE cycle_id = ? AND employee_id = ?', [cycleId, employeeId]);
        if (!payslip) {
            return res.status(404).json({ message: 'Payslip for this cycle not found.' });
        }

        // Reuse the detailed payslip function
        req.params.payslipId = payslip.id;
        return exports.getPayslipForReview(req, res);
    } catch (error) {
        console.error('Error fetching my payslip:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

/**
 * @description [Admin] Deletes a single component (detail line) from a payslip and recalculates totals.
 */
exports.deletePayslipComponent = async (req, res) => {
    const { payslipId, payslipDetailId } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Check the payslip's current status. Can't edit finalized or paid payslips.
        const [[payslip]] = await connection.query(
            "SELECT status FROM payslips WHERE id = ? FOR UPDATE",
            [payslipId]
        );

        if (!payslip) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip not found.' });
        }

        if (payslip.status === 'Paid') {
            await connection.rollback();
            return res.status(409).json({ message: `Cannot modify a payslip that is already ${payslip.status}.` });
        }

        // check for components 
        
        const [[componentId]] = await connection.query('select component_id from payslip_details where id = ?',[payslipDetailId])
        
        if(componentId.component_id == 98){
            // cases
            const [[itemId]] = await connection.query(`select id,item_id from payslip_processed_items where payslip_id = ? and item_type = 'hr_case'`,[payslipId])

            
            
            await connection.query(`update hr_cases set status = 'Approved' , payslip_id = null where id = ?`,[itemId.item_id])
            await connection.query(`delete from payslip_processed_items where id =?`,[itemId.id])
        }
        else if(componentId.component_id == 97){
            //loans

            const [[itemId]] = await connection.query(`select id,item_id from payslip_processed_items where payslip_id = ? and item_type = 'loan_emi'`,[payslipId])
             
            await connection.query(`update loan_amortization_schedule set status = 'Pending'  where id = ?`,[itemId.item_id])
            await connection.query(`delete from payslip_processed_items where id =?`,[itemId.id])
        }
        else if(componentId.component_id == 99){
            //reimbursement
             const [[itemId]] = await connection.query(`select id,item_id from payslip_processed_items where payslip_id = ? and item_type = 'expense_claim'`,[payslipId])
             
            await connection.query(`update expense_claims set status = 'Processed' , reimbursed_in_payroll_id = null where id = ?`,[itemId.item_id])
            await connection.query(`delete from payslip_processed_items where id =?`,[itemId.id])

        }
        

        // 2. Delete the specific component from the payslip_details table
        const [deleteResult] = await connection.query(
            "DELETE FROM payslip_details WHERE id = ? AND payslip_id = ?",
            [payslipDetailId, payslipId]
        );

        if (deleteResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payslip component not found on this payslip.' });
        }

        // 3. Recalculate totals for the payslip after deletion
        const [[totals]] = await connection.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END), 0) as gross,
                COALESCE(SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END), 0) as ded
            FROM payslip_details WHERE payslip_id = ?
        `, [payslipId]);

        const net_pay = (totals.gross || 0) - (totals.ded || 0);
        
        // 4. Update the main payslip record with new totals and reset its status to 'Draft'
        await connection.query(
            "UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?",
            [totals.gross || 0, totals.ded || 0, net_pay, payslipId]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: 'Payslip component removed successfully.' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting payslip component:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};