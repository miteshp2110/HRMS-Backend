// const { pool } = require('../db/connector'); // Adjust path to your connector

// /**
//  * @description A scheduled job to add earned leave to employee balances for all accruable leave types.
//  * This should be run once per month (e.g., on the 1st at 1:00 AM).
//  */
// const accrueLeaveBalances = async () => {
//   console.log(`[${new Date().toISOString()}] Starting job: Accrue Leave Balances...`);
  
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     // 1. Find all leave types that are set to 'accurable'
//     const findAccruableLeavesSql = 'SELECT id, accural_rate, max_balance FROM leave_types WHERE accurable = TRUE';
//     const [accruableLeaves] = await connection.query(findAccruableLeavesSql);

//     if (accruableLeaves.length === 0) {
//       console.log(`[${new Date().toISOString()}] No accruable leave types found. Job finished.`);
//       await connection.commit();
//       return;
//     }

//     console.log(`[${new Date().toISOString()}] Found ${accruableLeaves.length} accruable leave type(s).`);

//     // 2. For each accruable leave type, update the balance for all active employees
//     for (const leave of accruableLeaves) {
//       console.log(`Accruing ${leave.accural_rate} for leave type ID: ${leave.id}`);
      
//       // This single query efficiently updates all active employees.
//       // It uses LEAST() to ensure the new balance does not exceed the max_balance.
//       const updateBalancesSql = `
//         UPDATE employee_leave_balance elb
//         JOIN user u ON elb.employee_id = u.id
//         SET elb.balance = LEAST(elb.balance + ?, ?)
//         WHERE elb.leave_id = ? AND u.is_active = TRUE;
//       `;
      
//       const [result] = await connection.query(updateBalancesSql, [
//         leave.accural_rate,
//         leave.max_balance,
//         leave.id
//       ]);
      
//       console.log(`Updated balances for ${result.affectedRows} employee(s).`);
//     }

//     await connection.commit();
//     console.log(`[${new Date().toISOString()}] Successfully accrued leave balances. Job finished.`);

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error(`[${new Date().toISOString()}] Error during leave accrual job:`, error);
//   } finally {
//     if (connection) connection.release();
//     pool.end();
//   }
// };

// // Run the job
// accrueLeaveBalances();



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

    // 1. Find all leave types that are set to 'accurable'
    const findAccruableLeavesSql = 'SELECT id, accural_rate, max_balance FROM leave_types WHERE accurable = TRUE';
    const [accruableLeaves] = await connection.query(findAccruableLeavesSql);

    if (accruableLeaves.length === 0) {
      console.log(`[${new Date().toISOString()}] No accruable leave types found. Job finished.`);
      return;
    }
    console.log(`[${new Date().toISOString()}] Found ${accruableLeaves.length} accruable leave type(s).`);

    // 2. Get all active employees
    const [activeEmployees] = await connection.query('SELECT id FROM user WHERE is_active = TRUE');
    if (activeEmployees.length === 0) {
        console.log(`[${new Date().toISOString()}] No active employees found. Job finished.`);
        return;
    }
     console.log(`[${new Date().toISOString()}] Found ${activeEmployees.length} active employee(s).`);


    // 3. For each employee and each accruable leave type, update the balance and create a ledger entry
    for (const leave of accruableLeaves) {
      console.log(`\nAccruing ${leave.accural_rate} for leave type ID: ${leave.id}`);
      
      for(const employee of activeEmployees){
          try {
              await connection.beginTransaction();

              const [[balanceRecord]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE', [employee.id, leave.id]);

              if(balanceRecord){
                  // ** BUG FIX: Explicitly parse all values to floats for accurate math **
                  const currentBalance = parseFloat(balanceRecord.balance);
                  const accrualRate = parseFloat(leave.accural_rate);
                  const maxBalance = parseFloat(leave.max_balance);

                  const potentialNewBalance = currentBalance + accrualRate;
                  const newBalance = Math.min(potentialNewBalance, maxBalance);
                  const changeAmount = newBalance - currentBalance;

                  // Only proceed if there is a positive change in the balance
                  if(changeAmount > 0){
                      // Update the main balance table
                      await connection.query('UPDATE employee_leave_balance SET balance = ?, updated_by = ? WHERE employee_id = ? AND leave_id = ?', [newBalance, null, employee.id, leave.id]);
                      
                      // Create a detailed entry in the ledger table for auditing
                      await connection.query(
                          `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, updated_by) VALUES (?, ?, 'accrual', ?, ?, ?, ?)`,
                          [employee.id, leave.id, currentBalance, changeAmount, newBalance, null]
                      );
                      console.log(`  - Accrued ${changeAmount.toFixed(2)} for employee ID: ${employee.id}. New balance: ${newBalance.toFixed(2)}`);
                  } else {
                      console.log(`  - Employee ID: ${employee.id} is already at max balance for this leave type. No accrual needed.`);
                  }
              }

              await connection.commit();
          } catch(err){
              await connection.rollback();
              console.error(`  - Failed to process accrual for employee ID: ${employee.id}. Error: ${err.message}`);
          }
      }
    }

    console.log(`\n[${new Date().toISOString()}] Successfully accrued leave balances. Job finished.`);

  } catch (error) {
    console.error(`[${new Date().toISOString()}] A critical error occurred during the leave accrual job:`, error);
  } finally {
    if (connection) connection.release();
    pool.end();
  }
};

// Run the job
accrueLeaveBalances();