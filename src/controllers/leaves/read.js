// const { pool } = require('../../db/connector');

// /**
//  * @description Get a list of all leave types.
//  */
// const getAllLeaveTypes = async (req, res) => {
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const [leaveTypes] = await connection.query('SELECT * FROM leave_types ORDER BY name ASC');
//     res.status(200).json(leaveTypes);
//   } catch (error) {
//     console.error('Error fetching leave types:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };


// /**
//  * @description Gets all leave balances for the currently authenticated user.
//  */
// const getMyLeaveBalances = async (req, res) => {
//   const employeeId = req.user.id; // ID is taken securely from the token
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const sql = `
//       SELECT 
//         lt.id as id,
//         lt.name AS leave_type_name,
//         elb.balance
//       FROM employee_leave_balance elb
//       JOIN leave_types lt ON elb.leave_id = lt.id
//       WHERE elb.employee_id = ?;
//     `;
//     const [balances] = await connection.query(sql, [employeeId]);

//     res.status(200).json(balances);
//   } catch (error) {
//     console.error('Error fetching my leave balances:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };


// /**
//  * @description Gets all leave requests submitted by the currently authenticated user, with optional date filtering.
//  */
// const getMyLeaveRequests = async (req, res) => {
//   const employeeId = req.user.id;
//   const { startDate, endDate } = req.query; // Get startDate and endDate from query parameters
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     let sql = `
//       SELECT
//         lr.*,
//         lt.name as leave_type_name,
//         CONCAT(u1.first_name, ' ', u1.last_name) as primary_approver_name,
//         CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name
//       FROM employee_leave_records lr
//       JOIN leave_types lt ON lr.leave_type = lt.id
//       LEFT JOIN user u1 ON lr.primary_user = u1.id
//       LEFT JOIN user u2 ON lr.secondry_user = u2.id
//       WHERE lr.employee_id = ?
//     `;
//     const params = [employeeId];

//     // Add date filtering to the query if both startDate and endDate are provided
//     if (startDate && endDate) {
//       sql += ` AND lr.applied_date BETWEEN ? AND ?`;
//       params.push(startDate, endDate);
//     }

//     sql += ` ORDER BY lr.applied_date DESC`;

//     const [requests] = await connection.query(sql, params);
//     res.status(200).json(requests);
//   } catch (error) {
//     console.error('Error fetching my leave requests:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };


// /**
//  * @description [Admin/HR] Gets all leave balances for a specific employee.
//  */
// const getLeaveBalancesByEmployee = async (req, res) => {
//   const { employeeId } = req.params;
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     const sql = `
//       SELECT 
//         lt.name AS leave_type_name,
//         lt.id as id,
//         elb.balance
//       FROM employee_leave_balance elb
//       JOIN leave_types lt ON elb.leave_id = lt.id
//       WHERE elb.employee_id = ?;
//     `;
//     const [balances] = await connection.query(sql, [employeeId]);

//     if (balances.length === 0) {
//       // It's not an error if they have no balances, but you might want to confirm the employee exists.
//       const [[user]] = await connection.query('SELECT id FROM user WHERE id = ?', [employeeId]);
//       if (!user) {
//         return res.status(404).json({ message: 'Employee not found.' });
//       }
//     }

//     res.status(200).json(balances);
//   } catch (error) {
//     console.error(`Error fetching leave balances for employee ${employeeId}:`, error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// /**
//  * @description [Admin/HR] Gets all leave records for a specific employee, with optional date filtering.
//  */
// const getLeaveRecordsByEmployee = async (req, res) => {
//     const { employeeId } = req.params;
//     const { startDate, endDate } = req.query;
//     let connection;
//     try {
//       connection = await pool.getConnection();
//       let sql = `
//         SELECT 
//           lr.*,
//           lt.name as leave_type_name,
//           CONCAT(u1.first_name, ' ', u1.last_name) as primary_approver_name,
//           CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name
//         FROM employee_leave_records lr
//         JOIN leave_types lt ON lr.leave_type = lt.id
//         LEFT JOIN user u1 ON lr.primary_user = u1.id
//         LEFT JOIN user u2 ON lr.secondry_user = u2.id
//         WHERE lr.employee_id = ?
//       `;
//       const params = [employeeId];
  
//       if (startDate && endDate) {
//         sql += ` AND lr.applied_date BETWEEN ? AND ?`;
//         params.push(startDate, endDate);
//       }
  
//       sql += ` ORDER BY lr.applied_date DESC`;
      
//       const [requests] = await connection.query(sql, params);
//       res.status(200).json(requests);
//     } catch (error) {
//       console.error(`Error fetching leave records for employee ${employeeId}:`, error);
//       res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//       if (connection) connection.release();
//     }
//   };

//   /**
//  * @description Gets a single, detailed leave record by its ID.
//  */
// const getLeaveRecordById = async (req, res) => {
//     const { id } = req.params;
//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             SELECT
//                 lr.id,
//                 lt.name as leave_type_name,
//                 lr.leave_description,
//                 lr.applied_date,
//                 lr.from_date,
//                 lr.to_date,
//                 lr.rejection_reason,
//                 lr.primary_status,
//                 lr.secondry_status,
//                 CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name,
//                 CONCAT(sa.first_name, ' ', sa.last_name) as secondary_approver_name,
//                 lr.employee_id,
//                 CONCAT(e.first_name, ' ', e.last_name) as employee_name,
//                 lr.primary_user
//             FROM employee_leave_records lr
//             LEFT JOIN leave_types lt ON lr.leave_type = lt.id
//             LEFT JOIN user e ON lr.employee_id = e.id
//             LEFT JOIN user pa ON lr.primary_user = pa.id
//             LEFT JOIN user sa ON lr.secondry_user = sa.id
//             WHERE lr.id = ?;
//         `;
//         const [[record]] = await connection.query(sql, [id]);

//         if (!record) {
//             return res.status(404).json({ message: 'Leave record not found.' });
//         }

//         res.status(200).json(record);
//     } catch (error) {
//         console.error(`Error fetching leave record by ID for record ${id}:`, error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };


// /**
//  * @description [Admin/HR] Gets the complete leave balance ledger for a specific employee.
//  */
// const getLeaveLedgerByEmployee = async (req, res) => {
//     const { employeeId } = req.params;
//     const { leave_type_id } = req.query;
//     let connection;

//     try {
//         connection = await pool.getConnection();
//         let sql = `
//             SELECT
//                 lbl.id,
//                 lbl.transaction_date,
//                 lbl.transaction_type,
//                 lbl.previous_balance,
//                 lbl.change_amount,
//                 lbl.new_balance,
//                 lbl.leave_record_id,
//                 lt.name as leave_type_name
//             FROM employee_leave_balance_ledger lbl
//             JOIN leave_types lt ON lbl.leave_type_id = lt.id
//             WHERE lbl.user_id = ?
//         `;
//         const params = [employeeId];

//         if (leave_type_id) {
//             sql += ` AND lbl.leave_type_id = ?`;
//             params.push(leave_type_id);
//         }

//         sql += ` ORDER BY lbl.transaction_date DESC;`;

//         const [ledger] = await connection.query(sql, params);
//         res.status(200).json(ledger);

//     } catch (error) {
//         console.error(`Error fetching leave ledger for employee ${employeeId}:`, error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };




// module.exports = { getAllLeaveTypes ,getMyLeaveBalances,getMyLeaveRequests,getLeaveBalancesByEmployee,getLeaveRecordsByEmployee,getLeaveRecordById, getLeaveLedgerByEmployee};


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
  const { startDate, endDate } = req.query;
  let connection;
  try {
    connection = await pool.getConnection();
    let sql = `
      SELECT
        lr.*,
        lt.name as leave_type_name,
        CONCAT(u1.first_name, ' ', u1.last_name) as primary_approver_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name,
        CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id
      FROM employee_leave_records lr
      LEFT JOIN leave_types lt ON lr.leave_type = lt.id
      LEFT JOIN user u1 ON lr.primary_user = u1.id
      LEFT JOIN user u2 ON lr.secondry_user = u2.id
      LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
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
        lt.id as id,
        elb.balance
      FROM employee_leave_balance elb
      JOIN leave_types lt ON elb.leave_id = lt.id
      WHERE elb.employee_id = ?;
    `;
    const [balances] = await connection.query(sql, [employeeId]);

    if (balances.length === 0) {
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
          CONCAT(u2.first_name, ' ', u2.last_name) as secondary_approver_name,
          CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id
        FROM employee_leave_records lr
        LEFT JOIN leave_types lt ON lr.leave_type = lt.id
        LEFT JOIN user u1 ON lr.primary_user = u1.id
        LEFT JOIN user u2 ON lr.secondry_user = u2.id
        LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
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

/**
 * @description Gets a single, detailed leave record by its ID.
 */
const getLeaveRecordById = async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                lr.id,
                lt.name as leave_type_name,
                lr.leave_description,
                lr.applied_date,
                lr.from_date,
                lr.to_date,
                lr.rejection_reason,
                lr.primary_status,
                lr.secondry_status,
                CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name,
                CONCAT(sa.first_name, ' ', sa.last_name) as secondary_approver_name,
                lr.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                lr.primary_user,
                CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id
            FROM employee_leave_records lr
            LEFT JOIN leave_types lt ON lr.leave_type = lt.id
            LEFT JOIN user e ON lr.employee_id = e.id
            LEFT JOIN user pa ON lr.primary_user = pa.id
            LEFT JOIN user sa ON lr.secondry_user = sa.id
            LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
            WHERE lr.id = ?;
        `;
        const [[record]] = await connection.query(sql, [id]);

        if (!record) {
            return res.status(404).json({ message: 'Leave record not found.' });
        }

        res.status(200).json(record);
    } catch (error) {
        console.error(`Error fetching leave record by ID for record ${id}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Admin/HR] Gets the complete leave balance ledger for a specific employee.
 */
const getLeaveLedgerByEmployee = async (req, res) => {
    const { employeeId } = req.params;
    const { leave_type_id } = req.query;
    let connection;

    try {
        connection = await pool.getConnection();
        let sql = `
            SELECT
                lbl.id,
                lbl.transaction_date,
                lbl.transaction_type,
                lbl.previous_balance,
                lbl.change_amount,
                lbl.new_balance,
                lbl.leave_record_id,
                lt.name as leave_type_name
            FROM employee_leave_balance_ledger lbl
            JOIN leave_types lt ON lbl.leave_type_id = lt.id
            WHERE lbl.user_id = ?
        `;
        const params = [employeeId];

        if (leave_type_id) {
            sql += ` AND lbl.leave_type_id = ?`;
            params.push(leave_type_id);
        }

        sql += ` ORDER BY lbl.transaction_date DESC;`;

        const [ledger] = await connection.query(sql, params);
        res.status(200).json(ledger);

    } catch (error) {
        console.error(`Error fetching leave ledger for employee ${employeeId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    getAllLeaveTypes,
    getMyLeaveBalances,
    getMyLeaveRequests,
    getLeaveBalancesByEmployee,
    getLeaveRecordsByEmployee,
    getLeaveRecordById,
    getLeaveLedgerByEmployee
};