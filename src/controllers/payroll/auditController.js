
const { pool } = require('../../db/connector');

/**
* @description Runs a pre-payroll audit for a given cycle.
*/
exports.runAudit = async (req, res) => {
  const { cycleId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[cycle]] = await connection.query('SELECT start_date, end_date FROM payroll_cycles WHERE id = ?', [cycleId]);
    if (!cycle) {
      return res.status(404).json({ message: 'Payroll cycle not found.' });
    }

    // 1. Find employees with missing attendance data
    const [missingData] = await connection.query(
          `SELECT u.id as employee_id
           FROM user u
           WHERE u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?
             AND NOT EXISTS (
               SELECT 1 FROM attendance_record ar
               WHERE ar.employee_id = u.id AND ar.attendance_date BETWEEN ? AND ?
             )`, [cycle.end_date, cycle.start_date, cycle.end_date]);
    
    for (const emp of missingData) {
      await connection.query(
        `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
        VALUES (?, ?, 'MISSING_DATA', 'No attendance records found for the pay period.')`,
        [cycleId, emp.employee_id]
      );
    }

    // 2. Find unapproved overtime
    const [unapprovedOvertime] = await connection.query(
          `SELECT eor.employee_id, eor.request_date
           FROM employee_overtime_records eor
           JOIN user u ON eor.employee_id = u.id
           WHERE eor.status = 'pending_approval'
             AND eor.request_date BETWEEN ? AND ?
             AND u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?`, [cycle.start_date, cycle.end_date, cycle.end_date]);

    for (const ot of unapprovedOvertime) {
      await connection.query(
        `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
        VALUES (?, ?, 'UNAPPROVED_OVERTIME', ?)`,
        [cycleId, ot.employee_id, `Unapproved overtime on ${ot.request_date}`]
      );
    }

    // 3. Find employees missing salary structure components
    const [missingComponents] = await connection.query(
          `SELECT u.id AS employee_id, pc.name AS component_name
           FROM user u
           JOIN payroll_cycle_groups pcg ON pcg.cycle_id = ?
           JOIN payroll_groups pg ON pg.id = pcg.group_id
           JOIN payroll_group_components pgc2 ON pgc2.group_id = pg.id
           JOIN payroll_components pc ON pc.id = pgc2.component_id
           LEFT JOIN employee_salary_structure ess
             ON ess.employee_id = u.id AND ess.component_id = pc.id
           WHERE u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?
             AND ess.id IS NULL`, [cycleId, cycle.end_date]);

    for (const row of missingComponents) {
      await connection.query(
        `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
        VALUES (?, ?, 'MISSING_COMPONENT', ?)`,
        [cycleId, row.employee_id, `Missing salary component: ${row.component_name}`]
      );
    }

        // 4. Find pending punch-outs
        const [pendingPunchOuts] = await connection.query(
            `SELECT ar.employee_id, ar.attendance_date
             FROM attendance_record ar
             JOIN user u ON ar.employee_id = u.id
             WHERE ar.attendance_date BETWEEN ? AND ?
               AND ar.punch_in IS NOT NULL
               AND ar.punch_out IS NULL
               AND u.is_active = 1
               AND u.is_payroll_exempt = 0
               AND u.joining_date <= ?`,
            [cycle.start_date, cycle.end_date, cycle.end_date]
        );

        for (const record of pendingPunchOuts) {
            const formattedDate = new Date(record.attendance_date).toISOString().split('T')[0];
            await connection.query(
                `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
                 VALUES (?, ?, 'PENDING_PUNCH_OUT', ?)`,
                [cycleId, record.employee_id, `Missing punch-out on ${formattedDate}`]
            );
        }

        // 5. Find employees with missing bank details
        const [missingBankDetails] = await connection.query(
            `SELECT u.id AS employee_id
             FROM user u
             LEFT JOIN bank_details bd ON u.id = bd.user_id
             WHERE u.is_active = 1
               AND u.is_payroll_exempt = 0
               AND u.joining_date <= ?
               AND bd.id IS NULL`,
            [cycle.end_date]
        );

        for (const emp of missingBankDetails) {
            await connection.query(
                `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
                 VALUES (?, ?, 'MISSING_BANK_DETAILS', 'Employee bank details are not complete.')`,
                [cycleId, emp.employee_id]
            );
        }

    await connection.query("UPDATE payroll_cycles SET status = 'Auditing' WHERE id = ?", [cycleId]);
    await connection.commit();
    res.status(200).json({ success: true, message: 'Payroll audit completed.' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error running payroll audit:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
* @description Get all open audit flags for a cycle.
*/
exports.getAuditFlags = async (req, res) => {
  const { cycleId } = req.params;
  try {
    const [flags] = await pool.query(
          `SELECT paf.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
           FROM payroll_audit_flags paf
           JOIN user u ON paf.employee_id = u.id
           WHERE paf.cycle_id = ? AND paf.status = 'Open'`, [cycleId]);
    res.status(200).json(flags);
  } catch (error) {
    console.error('Error fetching audit flags:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

/**
* @description Resolve an audit flag.
*/
exports.resolveFlag = async (req, res) => {
  const { flagId } = req.params;
  const resolved_by = req.user.id;
  try {
    const [result] = await pool.query(
      "UPDATE payroll_audit_flags SET status = 'Resolved', resolved_by = ?, resolved_at = NOW() WHERE id = ?",
      [resolved_by, flagId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Audit flag not found.' });
    }
    res.status(200).json({ success: true, message: 'Audit flag resolved.' });
  } catch (error) {
    console.error('Error resolving audit flag:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

/**
* @description Re-runs the audit logic to find and log any new discrepancies.
*/
exports.verifyAudit = async (req, res) => {
  const { cycleId } = req.params;

  if (!cycleId) {
    return res.status(400).json({ message: "A valid Cycle ID is required." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[cycle]] = await connection.query(
      "SELECT start_date, end_date, status FROM payroll_cycles WHERE id = ?",
      [cycleId]
    );

    if (!cycle) {
      await connection.rollback();
      return res.status(404).json({ message: 'Payroll cycle not found.' });
    }

    const [existingFlags] = await connection.query(
      "SELECT employee_id, flag_type, description FROM payroll_audit_flags WHERE cycle_id = ? AND status = 'Open'",
      [cycleId]
    );
    const existingFlagsSet = new Set(existingFlags.map(f => `${f.flag_type}_${f.employee_id}_${f.description}`));

    let newFlagsFound = 0;

    // A. Missing attendance
    const [missingData] = await connection.query(
          `SELECT u.id as employee_id
           FROM user u
           WHERE u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?
             AND NOT EXISTS (
               SELECT 1 FROM attendance_record ar
               WHERE ar.employee_id = u.id AND ar.attendance_date BETWEEN ? AND ?
             )`, [cycle.end_date, cycle.start_date, cycle.end_date]);
    
    for (const emp of missingData) {
      const description = 'No attendance records found for the pay period.';
      const flagKey = `MISSING_DATA_${emp.employee_id}_${description}`;
      if (!existingFlagsSet.has(flagKey)) {
        await connection.query(
          `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
          VALUES (?, ?, 'MISSING_DATA', ?)`,
          [cycleId, emp.employee_id, description]
        );
        newFlagsFound++;
      }
    }

    // B. Unapproved overtime
    const [unapprovedOvertime] = await connection.query(
          `SELECT eor.employee_id, eor.request_date
           FROM employee_overtime_records eor
           JOIN user u ON eor.employee_id = u.id
           WHERE eor.status = 'pending_approval'
             AND eor.request_date BETWEEN ? AND ?
             AND u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?`, [cycle.start_date, cycle.end_date, cycle.end_date]);

    for (const ot of unapprovedOvertime) {
      const description = `Unapproved overtime on ${ot.request_date}`;
      const flagKey = `UNAPPROVED_OVERTIME_${ot.employee_id}_${description}`;
      if (!existingFlagsSet.has(flagKey)) {
        await connection.query(
          `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
          VALUES (?, ?, 'UNAPPROVED_OVERTIME', ?)`,
          [cycleId, ot.employee_id, description]
        );
        newFlagsFound++;
      }
    }

    // C. Missing salary components
    const [missingComponents] = await connection.query(
          `SELECT u.id AS employee_id, pc.name AS component_name
           FROM user u
           JOIN payroll_cycle_groups pcg ON pcg.cycle_id = ?
           JOIN payroll_groups pg ON pg.id = pcg.group_id
           JOIN payroll_group_components pgc2 ON pgc2.group_id = pg.id
           JOIN payroll_components pc ON pc.id = pgc2.component_id
           LEFT JOIN employee_salary_structure ess
             ON ess.employee_id = u.id AND ess.component_id = pc.id
           WHERE u.is_active = 1
             AND u.is_payroll_exempt = 0
             AND u.joining_date <= ?
             AND ess.id IS NULL`, [cycleId, cycle.end_date]);

    for (const row of missingComponents) {
      const description = `Missing salary component: ${row.component_name}`;
      const flagKey = `MISSING_COMPONENT_${row.employee_id}_${description}`;
      if (!existingFlagsSet.has(flagKey)) {
        await connection.query(
          `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
          VALUES (?, ?, 'MISSING_COMPONENT', ?)`,
          [cycleId, row.employee_id, description]
        );
        newFlagsFound++;
      }
    }

        // D. Find pending punch-outs
        const [pendingPunchOuts] = await connection.query(
            `SELECT ar.employee_id, ar.attendance_date
             FROM attendance_record ar
             JOIN user u ON ar.employee_id = u.id
             WHERE ar.attendance_date BETWEEN ? AND ?
               AND ar.punch_in IS NOT NULL
               AND ar.punch_out IS NULL
               AND u.is_active = 1
               AND u.is_payroll_exempt = 0
               AND u.joining_date <= ?`,
            [cycle.start_date, cycle.end_date, cycle.end_date]
        );

        for (const record of pendingPunchOuts) {
            const formattedDate = new Date(record.attendance_date).toISOString().split('T')[0];
            const description = `Missing punch-out on ${formattedDate}`;
            const flagKey = `PENDING_PUNCH_OUT_${record.employee_id}_${description}`;
            if (!existingFlagsSet.has(flagKey)) {
                await connection.query(
                    `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
                     VALUES (?, ?, 'PENDING_PUNCH_OUT', ?)`,
                    [cycleId, record.employee_id, description]
                );
                newFlagsFound++;
            }
        }

        // E. Missing bank details
        const [missingBankDetails] = await connection.query(
            `SELECT u.id AS employee_id
             FROM user u
             LEFT JOIN bank_details bd ON u.id = bd.user_id
             WHERE u.is_active = 1
               AND u.is_payroll_exempt = 0
               AND u.joining_date <= ?
               AND bd.id IS NULL`,
            [cycle.end_date]
        );

        for (const emp of missingBankDetails) {
            const description = 'Employee bank details are not complete.';
            const flagKey = `MISSING_BANK_DETAILS_${emp.employee_id}_${description}`;
            if (!existingFlagsSet.has(flagKey)) {
                await connection.query(
                    `INSERT INTO payroll_audit_flags (cycle_id, employee_id, flag_type, description)
                     VALUES (?, ?, 'MISSING_BANK_DETAILS', ?)`,
                    [cycleId, emp.employee_id, description]
                );
                newFlagsFound++;
            }
        }

    // Final status
    const [[finalAuditStatus]] = await connection.query(
      "SELECT COUNT(*) as open_flags FROM payroll_audit_flags WHERE cycle_id = ? AND status = 'Open'",
      [cycleId]
    );

    const openFlagsCount = finalAuditStatus.open_flags || 0;
    const isClear = openFlagsCount === 0;

    await connection.commit();

    res.status(200).json({
      cycle_id: parseInt(cycleId),
      is_clear: isClear,
      open_flags_count: openFlagsCount,
      new_flags_found: newFlagsFound,
      message: isClear 
        ? 'Audit verification complete. You can proceed.' 
        : `Action blocked. Found ${openFlagsCount} total open audit flags that must be resolved.`
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`Error verifying audit for cycle ${cycleId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred while verifying the audit status.' });
  } finally {
    if (connection) connection.release();
  }
};