
// const { pool } = require('../../db/connector');
// const { calculateEmployeePayslip } = require('./calculationEngine');

// exports.createCycle = async (req, res) => {
//   const { cycle_name, start_date, end_date, group_ids } = req.body;
//   const initiated_by = req.user.id;

//   if (!cycle_name || !start_date || !end_date || !Array.isArray(group_ids) || group_ids.length === 0) {
//     return res.status(400).json({ message: 'Cycle name, start date, end date, and at least one group ID are required.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const [cycleResult] = await connection.query(
//       'INSERT INTO payroll_cycles (cycle_name, start_date, end_date, initiated_by) VALUES (?, ?, ?, ?)',
//       [cycle_name, start_date, end_date, initiated_by]
//     );
//     const cycleId = cycleResult.insertId;

//     const cycleGroupValues = group_ids.map(groupId => [cycleId, groupId]);
//     await connection.query('INSERT INTO payroll_cycle_groups (cycle_id, group_id) VALUES ?', [cycleGroupValues]);

//     await connection.commit();
//     res.status(201).json({ success: true, message: 'Payroll cycle created successfully.', cycleId });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     if (error.code === 'ER_DUP_ENTRY') {
//       return res.status(409).json({ message: 'A payroll cycle for this period already exists.' });
//     }
//     console.error('Error creating payroll cycle:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// exports.getAllCycles = async (req, res) => {
//   try {
//     const [cycles] = await pool.query(
//           `SELECT pc.*, CONCAT(u.first_name, ' ', u.last_name) as initiated_by_name
//            FROM payroll_cycles pc
//            LEFT JOIN user u ON pc.initiated_by = u.id
//            ORDER BY pc.start_date DESC`
//         );
//     res.status(200).json(cycles);
//   } catch (error) {
//     console.error('Error fetching payroll cycles:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   }
// };

// exports.getCycleById = async (req, res) => {
//   const { cycleId } = req.params;
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const [[cycle]] = await connection.query('SELECT * FROM payroll_cycles WHERE id = ?', [cycleId]);

//     if (!cycle) {
//       return res.status(404).json({ message: 'Payroll cycle not found.' });
//     }

//     const [groups] = await connection.query(
//           `SELECT pg.id, pg.group_name
//            FROM payroll_cycle_groups pcg
//            JOIN payroll_groups pg ON pcg.group_id = pg.id
//            WHERE pcg.cycle_id = ?
//            ORDER BY pg.group_name`, [cycleId]);
    
//     const [payslips] = await connection.query('SELECT id, employee_id, status FROM payslips WHERE cycle_id = ?', [cycleId]);

//     res.status(200).json({ ...cycle, groups, payslips });
//   } catch (error) {
//     console.error('Error fetching payroll cycle:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// exports.updateCycleStatus = async (req, res) => {
//   const { cycleId } = req.params;
//   const { status } = req.body;
//   const validStatuses = ['Draft', 'Auditing', 'Review', 'Finalized', 'Paid'];

//   if (!status || !validStatuses.includes(status)) {
//     return res.status(400).json({ message: 'A valid status is required.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const [[cycle]] = await connection.query('SELECT * FROM payroll_cycles WHERE id = ? FOR UPDATE', [cycleId]);
//     if (!cycle) {
//       await connection.rollback();
//       return res.status(404).json({ message: 'Payroll cycle not found.' });
//     }

//     // --- Main State Machine Logic ---
//     if (status === 'Review' && cycle.status === 'Auditing') {
//       await generatePayslipsForCycle(connection, cycle);
//     } else if (status === 'Finalized' && cycle.status === 'Review') {
//       await finalizeProcessedItems(connection, cycle.id);
//     }

//     await connection.query('UPDATE payroll_cycles SET status = ? WHERE id = ?', [status, cycleId]);
//     await connection.commit();

//     res.status(200).json({ success: true, message: `Payroll cycle status updated to ${status}.` });

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error(`Error updating cycle status:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.', error: error.message });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// exports.deleteCycle = async (req, res) => {
//   const { cycleId } = req.params;
//   try {
//     const [result] = await pool.query("DELETE FROM payroll_cycles WHERE id = ? AND status = 'Draft'", [cycleId]);
//     if (result.affectedRows === 0) {
//       return res.status(404).json({ message: 'Draft payroll cycle not found or it has already been processed.' });
//     }
//     res.status(204).send();
//   } catch (error) {
//     console.error('Error deleting payroll cycle:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   }
// };

// // --- Helper Functions ---

// async function generatePayslipsForCycle(connection, cycle) {
//   const [componentsToProcess] = await connection.query(`SELECT DISTINCT pc.* FROM payroll_cycle_groups pcg JOIN payroll_group_components pgc ON pcg.group_id = pgc.group_id JOIN payroll_components pc ON pgc.component_id = pc.id WHERE pcg.cycle_id = ?`, [cycle.id]);
  
//     console.log(componentsToProcess)
//     // FIXED: Select only employees who joined on or before the cycle end date
//     const [employees] = await connection.query(
//         `SELECT id FROM user 
//          WHERE is_active = 1 
//            AND is_payroll_exempt = 0 
//            AND joining_date <= ?`,
//         [cycle.end_date]
//     );

//   for (const employee of employees) {
//     const { earnings, deductions, processedItems } = await calculateEmployeePayslip(connection, employee.id, componentsToProcess, cycle);
    
//     // Upsert payslip
//     const [[existingPayslip]] = await connection.query('SELECT id FROM payslips WHERE cycle_id = ? AND employee_id = ?', [cycle.id, employee.id]);
//     let payslipId;
//     if (existingPayslip) {
//       payslipId = existingPayslip.id;
//       await connection.query('DELETE FROM payslip_details WHERE payslip_id = ?', [payslipId]);
//       await connection.query('DELETE FROM payslip_processed_items WHERE payslip_id = ?', [payslipId]);
//     } else {
//       const [newPayslip] = await connection.query('INSERT INTO payslips (cycle_id, employee_id) VALUES (?, ?)', [cycle.id, employee.id]);
//       payslipId = newPayslip.insertId;
//     }

//     // Insert details and processed items
//     if (earnings.length > 0) {
//       const earningValues = earnings.map(e => [payslipId, e.component_id, e.component_name, 'earning', e.amount, JSON.stringify(e.calculation_breakdown)]);
//       await connection.query('INSERT INTO payslip_details (payslip_id, component_id, component_name, component_type, amount, calculation_breakdown) VALUES ?', [earningValues]);
//     }
//     if (deductions.length > 0) {
//       const deductionValues = deductions.map(d => [payslipId, d.component_id, d.component_name, 'deduction', d.amount, JSON.stringify(d.calculation_breakdown)]);
//       await connection.query('INSERT INTO payslip_details (payslip_id, component_id, component_name, component_type, amount, calculation_breakdown) VALUES ?', [deductionValues]);
//     }
//     if (processedItems.length > 0) {
//       const processedValues = processedItems.map(item => [payslipId, item.item_type, item.item_id]);
//       await connection.query('INSERT INTO payslip_processed_items (payslip_id, item_type, item_id) VALUES ?', [processedValues]);
//     }

//     // Update totals
//     const [[totals]] = await connection.query(`SELECT SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END) as gross, SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END) as ded FROM payslip_details WHERE payslip_id = ?`, [payslipId]);
//     const net_pay = (totals.gross || 0) - (totals.ded || 0);
//     await connection.query("UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?", [totals.gross || 0, totals.ded || 0, net_pay, payslipId]);
//   }
// }

// async function finalizeProcessedItems(connection, cycleId) {
//     // FIXED: Complete rewrite of this function to handle loan repayments correctly.
    
//     // 1. Finalize Loan Repayments
//     const [loansToFinalize] = await connection.query(
//         `SELECT
//             ppi.id as ppi_id,
//             ppi.item_id as schedule_id,
//             ps.id as payslip_id,
//             las.loan_application_id,
//             las.emi_amount
//          FROM payslip_processed_items ppi
//          JOIN payslips ps ON ppi.payslip_id = ps.id
//          JOIN loan_amortization_schedule las ON ppi.item_id = las.id
//          WHERE ps.cycle_id = ?
//            AND ppi.status = 'Processed'
//            AND ppi.item_type = 'loan_emi'`,
//         [cycleId]
//     );

//     for (const loan of loansToFinalize) {
//         // Create the official repayment record
//         const [repaymentResult] = await connection.query(
//             `INSERT INTO loan_repayments (loan_application_id, schedule_id, payslip_id, repayment_amount, repayment_date)
//              VALUES (?, ?, ?, ?, CURDATE())`,
//             [loan.loan_application_id, loan.schedule_id, loan.payslip_id, loan.emi_amount]
//         );
//         const repaymentId = repaymentResult.insertId;

//         // Link the repayment to the schedule and mark as Paid
//         await connection.query(
//             "UPDATE loan_amortization_schedule SET status = 'Paid', repayment_id = ? WHERE id = ?",
//             [repaymentId, loan.schedule_id]
//         );

//         // Mark the processed item as Finalized
//         await connection.query("UPDATE payslip_processed_items SET status = 'Finalized' WHERE id = ?", [loan.ppi_id]);
//     }

//     // 2. Finalize other item types (e.g., HR cases)
//     const [otherItemsToFinalize] = await connection.query(
//         `SELECT ppi.id
//          FROM payslip_processed_items ppi
//          JOIN payslips ps ON ppi.payslip_id = ps.id
//          WHERE ps.cycle_id = ?
//            AND ppi.status = 'Processed'
//            AND ppi.item_type != 'loan_emi'`,
//         [cycleId]
//     );

//     if (otherItemsToFinalize.length > 0) {
//         const itemIds = otherItemsToFinalize.map(item => item.id);
//         await connection.query("UPDATE payslip_processed_items SET status = 'Finalized' WHERE id IN (?)", [itemIds]);
//     }
// }


const { pool } = require('../../db/connector');
const { calculateEmployeePayslip } = require('./calculationEngine');

exports.createCycle = async (req, res) => {
  const { cycle_name, start_date, end_date, group_ids } = req.body;
  const initiated_by = req.user.id;

  if (!cycle_name || !start_date || !end_date || !Array.isArray(group_ids) || group_ids.length === 0) {
    return res.status(400).json({
      message: "Cycle name, start date, end date, and at least one group ID are required."
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 0. Find any existing cycles with same dates
    const [candidates] = await connection.query(`
      SELECT id
      FROM payroll_cycles
      WHERE start_date = ? AND end_date = ?
    `, [start_date, end_date]);

    // 1. For each candidate cycle, fetch its groups and compare sets
    for (const row of candidates) {
      const cycleId = row.id;
      const [rows] = await connection.query(`
        SELECT group_id
        FROM payroll_cycle_groups
        WHERE cycle_id = ?
      `, [cycleId]);
      const existingGroupIds = rows.map(r => r.group_id).sort();
      const requestedGroupIds = [...group_ids].sort();

      // Compare as strings for exact match
      if (
        existingGroupIds.length === requestedGroupIds.length &&
        existingGroupIds.join(",") === requestedGroupIds.join(",")
      ) {
        await connection.rollback();
        return res.status(409).json({
          message: `A payroll cycle for ${start_date}–${end_date} already exists with those exact group(s).`
        });
      }
    }

    // 2. Insert the new cycle
    const [cycleResult] = await connection.query(
      `INSERT INTO payroll_cycles
         (cycle_name, start_date, end_date, initiated_by)
       VALUES (?, ?, ?, ?)`,
      [cycle_name, start_date, end_date, initiated_by]
    );
    const newCycleId = cycleResult.insertId;

    // 3. Insert the requested groups
    for (const g of group_ids) {
      await connection.query(
        `INSERT INTO payroll_cycle_groups (cycle_id, group_id) VALUES (?, ?)`,
        [newCycleId, g]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: "Payroll cycle created successfully.",
      cycleId: newCycleId
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error creating payroll cycle:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};


exports.getAllCycles = async (req, res) => {
    try {
        const [cycles] = await pool.query(`
            SELECT pc.*, CONCAT(u.first_name, ' ', u.last_name) as initiated_by_name
            FROM payroll_cycles pc
            LEFT JOIN user u ON pc.initiated_by = u.id
            ORDER BY pc.start_date DESC
        `);
        res.status(200).json(cycles);
    } catch (error) {
        console.error('Error fetching payroll cycles:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

exports.getCycleById = async (req, res) => {
    const { cycleId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();

        const [[cycle]] = await connection.query(`
            SELECT pc.*, CONCAT(u.first_name, ' ', u.last_name) as initiated_by_name
            FROM payroll_cycles pc
            LEFT JOIN user u ON pc.initiated_by = u.id
            WHERE pc.id = ?
        `, [cycleId]);

        if (!cycle) {
            return res.status(404).json({ message: 'Payroll cycle not found.' });
        }

        // Get groups associated with this cycle (simulate runs)
        const [groups] = await connection.query(`
            SELECT pcg.group_id, pg.group_name, 
                   CASE WHEN EXISTS (
                       SELECT 1 FROM payslips p WHERE p.cycle_id = pcg.cycle_id
                   ) THEN 'Calculated' ELSE 'Pending' END as status
            FROM payroll_cycle_groups pcg
            JOIN payroll_groups pg ON pcg.group_id = pg.id
            WHERE pcg.cycle_id = ?
            ORDER BY pg.group_name
        `, [cycleId]);

        // Get payslip summary
        const [payslips] = await connection.query(`
            SELECT p.id, p.employee_id, p.status, p.gross_earnings, p.total_deductions, p.net_pay,
                   CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM payslips p
            JOIN user u ON p.employee_id = u.id
            WHERE p.cycle_id = ?
            ORDER BY u.first_name, u.last_name
        `, [cycleId]);

        // Transform groups to match frontend expectations (runs)
        const runs = groups.map(group => ({
            id: group.group_id, // Using group_id as run id for simplicity
            cycle_id: parseInt(cycleId),
            group_id: group.group_id,
            status: group.status,
            group_name: group.group_name
        }));

        res.status(200).json({ ...cycle, runs, payslips });
    } catch (error) {
        console.error('Error fetching payroll cycle:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

exports.updateCycleStatus = async (req, res) => {
    const { cycleId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Draft', 'Auditing', 'Review', 'Finalized', 'Paid'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'A valid status is required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [[cycle]] = await connection.query('SELECT * FROM payroll_cycles WHERE id = ? FOR UPDATE', [cycleId]);
        if (!cycle) {
            await connection.rollback();
            return res.status(404).json({ message: 'Payroll cycle not found.' });
        }

        // State machine validation
        const validTransitions = {
            'Draft': ['Auditing'],
            'Auditing': ['Review', 'Draft'],
            'Review': ['Finalized', 'Auditing'],
            'Finalized': ['Paid'],
            'Paid': []
        };

        if (!validTransitions[cycle.status]?.includes(status)) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `Invalid transition from ${cycle.status} to ${status}` 
            });
        }

        // Execute transition logic
        if (status === 'Review' && cycle.status === 'Auditing') {
            await generatePayslipsForCycle(connection, cycle);
        } else if (status === 'Finalized' && cycle.status === 'Review') {
            await finalizeProcessedItems(connection, cycle.id);
        }

        await connection.query('UPDATE payroll_cycles SET status = ? WHERE id = ?', [status, cycleId]);
        await connection.commit();

        res.status(200).json({ success: true, message: `Payroll cycle status updated to ${status}.` });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error updating cycle status:`, error);
        res.status(500).json({ message: 'An internal server error occurred.', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.deleteCycle = async (req, res) => {
    const { cycleId } = req.params;
    try {
        const [result] = await pool.query("DELETE FROM payroll_cycles WHERE id = ? AND status = 'Draft'", [cycleId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Draft payroll cycle not found or it has already been processed.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting payroll cycle:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
};

// Helper function to execute payroll for specific group
exports.executeGroupRun = async (req, res) => {
    const { cycleId, groupId } = req.params;
    const executed_by = req.user.id;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Validate the cycle 
        const [[cycle]] = await connection.query("SELECT * FROM payroll_cycles WHERE id = ? AND status IN ('Auditing', 'Review')", [cycleId]);
        if (!cycle) {
            return res.status(404).json({ message: 'Active payroll cycle not found.' });
        }

        // 2. Get components for this group
        const [components] = await connection.query(`
            SELECT pc.*
            FROM payroll_group_components pgc
            JOIN payroll_components pc ON pgc.component_id = pc.id
            WHERE pgc.group_id = ?
        `, [groupId]);

        const [cids] = await connection.query('select component_id as cid from payroll_group_components where group_id = ?',[groupId])
        cids.forEach((c)=>{
            if(c.cid === 97){
                components.push({id:97})
            }
            if(c.cid === 98){
                components.push({id:98})
            }
            if(c.cid === 99){
                components.push({id:99})
            }
        })
        
        console.log(components)

        if (components.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'No components found for this group.' });
        }

        // 3. Get eligible employees
        const [employees] = await connection.query(`
            SELECT id FROM user
            WHERE is_active = 1
            AND is_payroll_exempt = 0
            AND joining_date <= ?
        `, [cycle.end_date]);

        let processedCount = 0;

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
                    [cycle.id, employee.id]
                );

                let payslipId;
                if (existingPayslip) {
                    payslipId = existingPayslip.id;
                    // Delete existing details for this group's components
                    const componentIds = components.map(c => c.id);
                    if (componentIds.length > 0) {
                        await connection.query(
                            'DELETE FROM payslip_details WHERE payslip_id = ? AND component_id IN (?)', 
                            [payslipId, componentIds]
                        );
                    }
                } else {
                    const [newPayslip] = await connection.query(
                        'INSERT INTO payslips (cycle_id, employee_id) VALUES (?, ?)', 
                        [cycle.id, employee.id]
                    );
                    payslipId = newPayslip.insertId;
                }

                // Insert new details
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

                if (processedItems.length > 0) {
                    // Clear existing processed items for this payslip
                    await connection.query('DELETE FROM payslip_processed_items WHERE payslip_id = ?', [payslipId]);
                    
                    const processedValues = processedItems.map(item => [payslipId, item.item_type, item.item_id, 'Processed']);
                    await connection.query(
                        'INSERT INTO payslip_processed_items (payslip_id, item_type, item_id, status) VALUES ?', 
                        [processedValues]
                    );
                }

                // Update totals
                const [[totals]] = await connection.query(`
                    SELECT 
                        SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END) as gross,
                        SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END) as ded
                    FROM payslip_details WHERE payslip_id = ?
                `, [payslipId]);

                const net_pay = (totals.gross || 0) - (totals.ded || 0);
                await connection.query(
                    "UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?",
                    [totals.gross || 0, totals.ded || 0, net_pay, payslipId]
                );

                processedCount++;

            } catch (employeeError) {
                console.error(`Error processing employee ${employee.id}:`, employeeError);
                // Continue with other employees
            }
        }

        await connection.commit();
        res.status(200).json({ 
            success: true, 
            message: `Payroll run executed successfully for ${processedCount} employees.` 
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error executing payroll run:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

// --- Helper Functions ---

async function generatePayslipsForCycle(connection, cycle) {
    const [componentsToProcess] = await connection.query(`
        SELECT DISTINCT pc.* 
        FROM payroll_cycle_groups pcg 
        JOIN payroll_group_components pgc ON pcg.group_id = pgc.group_id 
        JOIN payroll_components pc ON pgc.component_id = pc.id 
        WHERE pcg.cycle_id = ?
    `, [cycle.id]);
    const [cids] = await connection.query('select component_id as cid from payroll_group_components where group_id = (select group_id from payroll_cycle_groups where cycle_id = ?)',[cycle.id])
        cids.forEach((c)=>{
            if(c.cid === 97){
                componentsToProcess.push({id:97})
            }
            if(c.cid === 98){
                componentsToProcess.push({id:98})
            }
            if(c.cid === 99){
                componentsToProcess.push({id:99})
            }
        })

    console.log('Components to process:', componentsToProcess.length);

    // Get eligible employees
    const [employees] = await connection.query(`
        SELECT id FROM user
        WHERE is_active = 1
        AND is_payroll_exempt = 0
        AND joining_date <= ?
    `, [cycle.end_date]);

    console.log('Eligible employees:', employees.length);

    for (const employee of employees) {
        try {
            const { earnings, deductions, processedItems } = await calculateEmployeePayslip(
                connection, 
                employee.id, 
                componentsToProcess, 
                cycle
            );

            // Upsert payslip
            const [[existingPayslip]] = await connection.query(
                'SELECT id FROM payslips WHERE cycle_id = ? AND employee_id = ?', 
                [cycle.id, employee.id]
            );

            let payslipId;
            if (existingPayslip) {
                payslipId = existingPayslip.id;
                await connection.query('DELETE FROM payslip_details WHERE payslip_id = ?', [payslipId]);
                await connection.query('DELETE FROM payslip_processed_items WHERE payslip_id = ?', [payslipId]);
            } else {
                const [newPayslip] = await connection.query(
                    'INSERT INTO payslips (cycle_id, employee_id) VALUES (?, ?)', 
                    [cycle.id, employee.id]
                );
                payslipId = newPayslip.insertId;
            }

            // Insert details and processed items
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

            if (processedItems.length > 0) {
                const processedValues = processedItems.map(item => [payslipId, item.item_type, item.item_id, 'Processed']);
                await connection.query(
                    'INSERT INTO payslip_processed_items (payslip_id, item_type, item_id, status) VALUES ?', 
                    [processedValues]
                );
            }

            // Update totals
            const [[totals]] = await connection.query(`
                SELECT 
                    SUM(CASE WHEN component_type = 'earning' THEN amount ELSE 0 END) as gross,
                    SUM(CASE WHEN component_type = 'deduction' THEN amount ELSE 0 END) as ded
                FROM payslip_details WHERE payslip_id = ?
            `, [payslipId]);

            const net_pay = (totals.gross || 0) - (totals.ded || 0);
            await connection.query(
                "UPDATE payslips SET gross_earnings = ?, total_deductions = ?, net_pay = ?, status = 'Draft' WHERE id = ?",
                [totals.gross || 0, totals.ded || 0, net_pay, payslipId]
            );

        } catch (employeeError) {
            console.error(`Error processing employee ${employee.id}:`, employeeError);
            // Continue with other employees
        }
    }
}

async function finalizeProcessedItems(connection, cycleId) {
    // Finalize Loan Repayments
    const [loansToFinalize] = await connection.query(`
        SELECT 
            ppi.id as ppi_id,
            ppi.item_id as schedule_id,
            ps.id as payslip_id,
            las.loan_application_id,
            las.emi_amount
        FROM payslip_processed_items ppi
        JOIN payslips ps ON ppi.payslip_id = ps.id
        JOIN loan_amortization_schedule las ON ppi.item_id = las.id
        WHERE ps.cycle_id = ?
        AND ppi.status = 'Processed'
        AND ppi.item_type = 'loan_emi'
    `, [cycleId]);

    for (const loan of loansToFinalize) {
        // Create the official repayment record
        const [repaymentResult] = await connection.query(`
            INSERT INTO loan_repayments (loan_application_id, schedule_id, payslip_id, repayment_amount, repayment_date)
            VALUES (?, ?, ?, ?, CURDATE())
        `, [loan.loan_application_id, loan.schedule_id, loan.payslip_id, loan.emi_amount]);

        const repaymentId = repaymentResult.insertId;

        // Link the repayment to the schedule and mark as Paid
        await connection.query(
            "UPDATE loan_amortization_schedule SET status = 'Paid', repayment_id = ? WHERE id = ?",
            [repaymentId, loan.schedule_id]
        );

        // Mark the processed item as Finalized
        await connection.query("UPDATE payslip_processed_items SET status = 'Finalized' WHERE id = ?", [loan.ppi_id]);
    }

    // Mark HR cases as synced
    await connection.query(`
        UPDATE hr_cases SET is_deduction_synced = TRUE 
        WHERE id IN (
            SELECT ppi.item_id
            FROM payslip_processed_items ppi
            JOIN payslips ps ON ppi.payslip_id = ps.id
            WHERE ps.cycle_id = ? AND ppi.item_type = 'hr_case'
        )
    `, [cycleId]);

    // Finalize other processed items
    await connection.query(`
        UPDATE payslip_processed_items ppi
        JOIN payslips ps ON ppi.payslip_id = ps.id
        SET ppi.status = 'Finalized'
        WHERE ps.cycle_id = ? AND ppi.status = 'Processed'
    `, [cycleId]);
}