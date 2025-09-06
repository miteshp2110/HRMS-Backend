const { pool } = require('../db/connector');
const { DateTime } = require('luxon');

const reconcileAttendance = async () => {
  // Get the date for the previous day
//   const yesterday = DateTime.now().minus({ days: 1 }).toISODate();
  const yesterday = '2025-09-05';
  console.log(`[${new Date().toISOString()}] Starting Attendance Reconciliation for: ${yesterday}`);
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Find employees who were scheduled but have NO attendance record for yesterday (Absentees)
    const findAbsenteesSql = `
      SELECT u.id, u.shift
      FROM user u
      LEFT JOIN attendance_record ar ON u.id = ar.employee_id AND ar.attendance_date = ?
      WHERE u.is_active = TRUE AND ar.id IS NULL;
    `;
    const [absentees] = await connection.query(findAbsenteesSql, [yesterday]);

    if (absentees.length > 0) {
      console.log(`Found ${absentees.length} absentee(s).`);
      // Mark them as absent and unpaid
      for (const emp of absentees) {
        const insertAbsentSql = `
          INSERT INTO attendance_record 
          (employee_id, attendance_date, shift, attendance_status, pay_type)
          VALUES (?, ?, ?, 'absent', 'unpaid');
        `;
        await connection.query(insertAbsentSql, [emp.id, yesterday, emp.shift]);
      }
    }

    // 2. Find employees who punched in but forgot to punch out
    const findMissedPunchOutsSql = `
      UPDATE attendance_record
      SET 
        punch_out = NULL,         -- Ensure punch_out remains NULL
        hours_worked = 0,         -- Set hours worked to 0
        pay_type = 'no_punch_out' -- Set the specific pay_type
      WHERE 
        punch_out IS NULL 
        AND punch_in IS NOT NULL 
        AND attendance_status = 'present'
        AND attendance_date = ?;
    `;
    const [updateResult] = await connection.query(findMissedPunchOutsSql, [yesterday]);
    
    if (updateResult.affectedRows > 0) {
        console.log(`Flagged ${updateResult.affectedRows} record(s) with missing punch-outs.`);
    }

    await connection.commit();
    console.log(`[${new Date().toISOString()}] Reconciliation complete.`);

  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`[${new Date().toISOString()}] Error during attendance reconciliation:`, error);
  } finally {
    if (connection) connection.release();
    pool.end();
  }
};

reconcileAttendance();