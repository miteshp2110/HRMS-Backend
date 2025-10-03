const { pool } = require('../../db/connector');
const { calculateEmployeePayslip } = require('./calculationEngine');

/**
 * @description Executes a specific group run within a payroll cycle.
 * Since we don't have payroll_cycle_runs table, this directly processes payroll for a group.
 */
exports.executeCycleRun = async (req, res) => {
    const { cycleId, groupId } = req.params;
    const executed_by = req.user.id;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Validate the cycle and group relationship
        const [[cycleGroup]] = await connection.query(`
            SELECT pcg.*, pc.status, pc.cycle_name, pc.start_date, pc.end_date
            FROM payroll_cycle_groups pcg
            JOIN payroll_cycles pc ON pcg.cycle_id = pc.id
            WHERE pcg.cycle_id = ? AND pcg.group_id = ? AND pc.status IN ('Auditing', 'Review')
        `, [cycleId, groupId]);

        if (!cycleGroup) {
            await connection.rollback();
            return res.status(404).json({ message: 'Active payroll cycle or group not found.' });
        }

        // 2. Check if this group has already been processed
        const [[existingRun]] = await connection.query(`
            SELECT COUNT(DISTINCT pd.payslip_id) as processed_count
            FROM payslip_details pd
            JOIN payslips ps ON pd.payslip_id = ps.id
            JOIN payroll_group_components pgc ON pd.component_id = pgc.component_id
            WHERE ps.cycle_id = ? AND pgc.group_id = ?
        `, [cycleId, groupId]);

        if (existingRun.processed_count > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'This payroll group has already been processed for this cycle.' });
        }

        // 3. Get components for this group
        const [components] = await connection.query(`
            SELECT pc.*
            FROM payroll_group_components pgc
            JOIN payroll_components pc ON pgc.component_id = pc.id
            WHERE pgc.group_id = ?
            ORDER BY pc.name
        `, [groupId]);

        if (components.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No components found for this group.' });
        }

        // 4. Get eligible employees
        const [employees] = await connection.query(`
            SELECT id, first_name, last_name
            FROM user
            WHERE is_active = 1
            AND is_payroll_exempt = 0
            AND joining_date <= ?
        `, [cycleGroup.end_date]);

        if (employees.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No eligible employees found.' });
        }

        let processedCount = 0;
        let errorCount = 0;

        const cycle = {
            id: cycleId,
            cycle_name: cycleGroup.cycle_name,
            start_date: cycleGroup.start_date,
            end_date: cycleGroup.end_date
        };

        for (const employee of employees) {
            try {
                const { earnings, deductions, processedItems } = await calculateEmployeePayslip(
                    connection, 
                    employee.id, 
                    components, 
                    cycle
                );

                // Upsert payslip
                const [[existingPayslip]] = await connection.query(
                    'SELECT id FROM payslips WHERE cycle_id = ? AND employee_id = ?', 
                    [cycleId, employee.id]
                );

                let payslipId;
                if (existingPayslip) {
                    payslipId = existingPayslip.id;
                    // Remove existing details for this group's components only
                    const componentIds = components.map(c => c.id);
                    if (componentIds.length > 0) {
                        await connection.query(
                            'DELETE FROM payslip_details WHERE payslip_id = ? AND component_id IN (?)', 
                            [payslipId, componentIds]
                        );
                    }
                } else {
                    const [newPayslip] = await connection.query(
                        'INSERT INTO payslips (cycle_id, employee_id, status) VALUES (?, ?, ?)', 
                        [cycleId, employee.id, 'Draft']
                    );
                    payslipId = newPayslip.insertId;
                }

                // Insert new earnings
                if (earnings.length > 0) {
                    const earningValues = earnings.map(e => [
                        payslipId, 
                        e.component_id, 
                        e.component_name, 
                        'earning', 
                        e.amount, 
                        e.calculation_breakdown
                    ]);
                    await connection.query(
                        'INSERT INTO payslip_details (payslip_id, component_id, component_name, component_type, amount, calculation_breakdown) VALUES ?', 
                        [earningValues]
                    );
                }

                // Insert new deductions
                if (deductions.length > 0) {
                    const deductionValues = deductions.map(d => [
                        payslipId, 
                        d.component_id, 
                        d.component_name, 
                        'deduction', 
                        d.amount, 
                        d.calculation_breakdown
                    ]);
                    await connection.query(
                        'INSERT INTO payslip_details (payslip_id, component_id, component_name, component_type, amount, calculation_breakdown) VALUES ?', 
                        [deductionValues]
                    );
                }

                // Handle processed items (loans, HR cases, etc.)
                if (processedItems.length > 0) {
                    // Clear existing processed items for this payslip
                    await connection.query('DELETE FROM payslip_processed_items WHERE payslip_id = ?', [payslipId]);
                    
                    const processedValues = processedItems.map(item => [payslipId, item.item_type, item.item_id, 'Processed']);
                    await connection.query(
                        'INSERT INTO payslip_processed_items (payslip_id, item_type, item_id, status) VALUES ?', 
                        [processedValues]
                    );
                }

                // Recalculate and update payslip totals
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

                processedCount++;

            } catch (employeeError) {
                console.error(`Error processing employee ${employee.id} (${employee.first_name} ${employee.last_name}):`, employeeError);
                errorCount++;
            }
        }

        await connection.commit();
        
        const message = errorCount > 0 ? 
            `Payroll run completed. Processed: ${processedCount}, Errors: ${errorCount}` :
            `Payroll run executed successfully for ${processedCount} employees.`;

        res.status(200).json({ 
            success: true, 
            message: message,
            summary: {
                total_employees: employees.length,
                processed: processedCount,
                errors: errorCount,
                components_processed: components.length
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error executing payroll run:', error);
        res.status(500).json({ 
            message: 'An internal server error occurred during payroll execution.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Get run status for a specific group in a cycle
 */
exports.getRunStatus = async (req, res) => {
    const { cycleId, groupId } = req.params;
    
    try {
        // Check if any payslips exist for this cycle/group combination
        const [[runStatus]] = await connection.query(`
            SELECT 
                COUNT(DISTINCT ps.id) as payslips_count,
                COUNT(DISTINCT pd.id) as details_count,
                pg.group_name
            FROM payroll_cycle_groups pcg
            JOIN payroll_groups pg ON pcg.group_id = pg.id
            LEFT JOIN payslips ps ON ps.cycle_id = pcg.cycle_id
            LEFT JOIN payslip_details pd ON ps.id = pd.payslip_id
            LEFT JOIN payroll_group_components pgc ON pd.component_id = pgc.component_id AND pgc.group_id = pcg.group_id
            WHERE pcg.cycle_id = ? AND pcg.group_id = ?
            GROUP BY pg.group_name
        `, [cycleId, groupId]);

        if (!runStatus) {
            return res.status(404).json({ message: 'Group not found in this cycle.' });
        }

        const status = runStatus.details_count > 0 ? 'Calculated' : 'Pending';
        
        res.status(200).json({
            cycle_id: parseInt(cycleId),
            group_id: parseInt(groupId),
            group_name: runStatus.group_name,
            status: status,
            payslips_count: runStatus.payslips_count,
            details_count: runStatus.details_count
        });

    } catch (error) {
        console.error('Error getting run status:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};