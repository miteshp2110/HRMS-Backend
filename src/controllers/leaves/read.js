const { pool } = require('../../db/connector');

/**
 * @description Get a list of all leave types.
 */
const getAllLeaveTypes = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [leaveTypes] = await connection.query('SELECT * FROM leave_types ORDER BY name ASC');
    res.status(200).json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description Gets all leave balances for the currently authenticated user.
 */
const getMyLeaveBalances = async (req, res) => {
  const employeeId = req.user.id; // ID is taken securely from the token
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        lt.id as id,
        lt.name AS leave_type_name,
        elb.balance
      FROM employee_leave_balance elb
      JOIN leave_types lt ON elb.leave_id = lt.id
      WHERE elb.employee_id = ?;
    `;
    const [balances] = await connection.query(sql, [employeeId]);

    res.status(200).json(balances);
  } catch (error) {
    console.error('Error fetching my leave balances:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description Gets all leave requests submitted by the currently authenticated user.
 */
const getMyLeaveRequests = async (req, res) => {
  const employeeId = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        lr.*,
        lt.name as leave_type_name,
        CONCAT(u1.first_name, ' ', u1.last_name) as primary_approver_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name
      FROM employee_leave_records lr
      JOIN leave_types lt ON lr.leave_type = lt.id
      LEFT JOIN user u1 ON lr.primary_user = u1.id
      LEFT JOIN user u2 ON lr.secondry_user = u2.id
      WHERE lr.employee_id = ?
      ORDER BY lr.applied_date DESC
    `;
    const [requests] = await connection.query(sql, [employeeId]);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching my leave requests:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};


/**
 * @description [Admin/HR] Gets all leave balances for a specific employee.
 */
const getLeaveBalancesByEmployee = async (req, res) => {
  const { employeeId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT 
        lt.name AS leave_type_name,
        elb.balance
      FROM employee_leave_balance elb
      JOIN leave_types lt ON elb.leave_id = lt.id
      WHERE elb.employee_id = ?;
    `;
    const [balances] = await connection.query(sql, [employeeId]);

    if (balances.length === 0) {
      // It's not an error if they have no balances, but you might want to confirm the employee exists.
      const [[user]] = await connection.query('SELECT id FROM user WHERE id = ?', [employeeId]);
      if (!user) {
        return res.status(404).json({ message: 'Employee not found.' });
      }
    }

    res.status(200).json(balances);
  } catch (error) {
    console.error(`Error fetching leave balances for employee ${employeeId}:`, error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description [Admin/HR] Gets all leave records for a specific employee, with optional date filtering.
 */
const getLeaveRecordsByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    let connection;
    try {
      connection = await pool.getConnection();
      let sql = `
        SELECT 
          lr.*,
          lt.name as leave_type_name,
          CONCAT(u1.first_name, ' ', u1.last_name) as primary_approver_name,
          CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name
        FROM employee_leave_records lr
        JOIN leave_types lt ON lr.leave_type = lt.id
        LEFT JOIN user u1 ON lr.primary_user = u1.id
        LEFT JOIN user u2 ON lr.secondry_user = u2.id
        WHERE lr.employee_id = ?
      `;
      const params = [employeeId];
  
      if (startDate && endDate) {
        sql += ` AND lr.applied_date BETWEEN ? AND ?`;
        params.push(startDate, endDate);
      }
  
      sql += ` ORDER BY lr.applied_date DESC`;
      
      const [requests] = await connection.query(sql, params);
      res.status(200).json(requests);
    } catch (error) {
      console.error(`Error fetching leave records for employee ${employeeId}:`, error);
      res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
      if (connection) connection.release();
    }
  };



module.exports = { getAllLeaveTypes ,getMyLeaveBalances,getMyLeaveRequests,getLeaveBalancesByEmployee,getLeaveRecordsByEmployee};