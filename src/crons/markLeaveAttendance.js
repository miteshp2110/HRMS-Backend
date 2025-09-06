const { pool } = require('../db/connector'); // Adjust the path to your db connector
const { DateTime } = require('luxon');

/**
 * @description A scheduled job to mark attendance for employees who are on approved leave.
 * This should be run once daily, typically just after midnight.
 */
const markLeaveAttendance = async () => {
  console.log(`[${new Date().toISOString()}] Starting job: Mark Leave Attendance...`);
  
  // Get today's date in 'YYYY-MM-DD' format
  const today = '2025-09-06'
//   const today = DateTime.now().toISODate();
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Find all leave requests that are fully approved and active for today's date.
    const findLeavesSql = `
      SELECT employee_id, shift
      FROM employee_leave_records lr
      JOIN user u ON lr.employee_id = u.id
      WHERE 
        lr.primary_status = TRUE 
        AND lr.secondry_status = TRUE 
        AND ? BETWEEN lr.from_date AND lr.to_date;
    `;
    const [employeesOnLeave] = await connection.query(findLeavesSql, [today]);

    if (employeesOnLeave.length === 0) {
      console.log(`[${new Date().toISOString()}] No employees on approved leave today. Job finished.`);
      await connection.commit();
      return;
    }

    console.log(`[${new Date().toISOString()}] Found ${employeesOnLeave.length} employee(s) on leave.`);

    // 2. Prepare to insert these employees into the attendance record.
    const insertPromises = employeesOnLeave.map(emp => {
      const insertSql = `
        INSERT INTO attendance_record 
        (employee_id, attendance_date, shift, attendance_status, pay_type)
        VALUES (?, ?, ?, 'leave', 'leave')
        ON DUPLICATE KEY UPDATE attendance_status = 'leave', pay_type = 'leave';
      `;
      return connection.query(insertSql, [emp.employee_id, today, emp.shift]);
    });

    // 3. Execute all insert queries.
    await Promise.all(insertPromises);

    await connection.commit();
    console.log(`[${new Date().toISOString()}] Successfully marked attendance for ${employeesOnLeave.length} employee(s). Job finished.`);

  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`[${new Date().toISOString()}] Error during mark leave attendance job:`, error);
  } finally {
    if (connection) connection.release();
    pool.end(); // End the pool as this is a standalone script
  }
};

// Run the job
markLeaveAttendance();