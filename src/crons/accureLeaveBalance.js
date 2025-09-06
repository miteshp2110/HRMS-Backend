const { pool } = require('../db/connector'); // Adjust path to your connector

/**
 * @description A scheduled job to add earned leave to employee balances for all accruable leave types.
 * This should be run once per month (e.g., on the 1st at 1:00 AM).
 */
const accrueLeaveBalances = async () => {
  console.log(`[${new Date().toISOString()}] Starting job: Accrue Leave Balances...`);
  
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Find all leave types that are set to 'accurable'
    const findAccruableLeavesSql = 'SELECT id, accural_rate, max_balance FROM leave_types WHERE accurable = TRUE';
    const [accruableLeaves] = await connection.query(findAccruableLeavesSql);

    if (accruableLeaves.length === 0) {
      console.log(`[${new Date().toISOString()}] No accruable leave types found. Job finished.`);
      await connection.commit();
      return;
    }

    console.log(`[${new Date().toISOString()}] Found ${accruableLeaves.length} accruable leave type(s).`);

    // 2. For each accruable leave type, update the balance for all active employees
    for (const leave of accruableLeaves) {
      console.log(`Accruing ${leave.accural_rate} for leave type ID: ${leave.id}`);
      
      // This single query efficiently updates all active employees.
      // It uses LEAST() to ensure the new balance does not exceed the max_balance.
      const updateBalancesSql = `
        UPDATE employee_leave_balance elb
        JOIN user u ON elb.employee_id = u.id
        SET elb.balance = LEAST(elb.balance + ?, ?)
        WHERE elb.leave_id = ? AND u.is_active = TRUE;
      `;
      
      const [result] = await connection.query(updateBalancesSql, [
        leave.accural_rate,
        leave.max_balance,
        leave.id
      ]);
      
      console.log(`Updated balances for ${result.affectedRows} employee(s).`);
    }

    await connection.commit();
    console.log(`[${new Date().toISOString()}] Successfully accrued leave balances. Job finished.`);

  } catch (error) {
    if (connection) await connection.rollback();
    console.error(`[${new Date().toISOString()}] Error during leave accrual job:`, error);
  } finally {
    if (connection) connection.release();
    pool.end();
  }
};

// Run the job
accrueLeaveBalances();