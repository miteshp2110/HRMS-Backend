

// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// /**
//  * @description [Manager] Gets leave requests awaiting the authenticated manager's primary approval.
//  */
// const getPrimaryApprovalRequests = async (req, res) => {
//   const managerId = req.user.id;
//   let connection;
//   try {
//     connection = await pool.getConnection();
//     // ** BUG FIX: Changed JOIN to LEFT JOIN **
//     // This ensures that leave requests are always returned, even if the associated
//     // user or leave type has been deleted.
//     const sql = `
//       SELECT lr.*, lt.name as leave_type_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name
//       FROM employee_leave_records lr
//       LEFT JOIN user e ON lr.employee_id = e.id
//       LEFT JOIN leave_types lt ON lr.leave_type = lt.id
//       WHERE lr.primary_user = ? AND lr.primary_status IS NULL AND lr.rejection_reason IS NULL
//     `;
//     const [requests] = await connection.query(sql, [managerId]);
//     res.status(200).json(requests);
//   } catch (error) {
//     console.error('Error fetching primary approval requests:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// /**
//  * @description [Manager] Sets the primary approval status for a leave request.
//  */
// const setPrimaryApprovalStatus = async (req, res) => {
//   const { recordId } = req.params;
//   const { status, rejection_reason } = req.body;
//   const managerId = req.user.id;

//   if (status === undefined) {
//     return res.status(400).json({ message: 'A boolean status (true/false) is required.' });
//   }
//   if (status === false && !rejection_reason) {
//     return res.status(400).json({ message: 'Rejection reason is required when rejecting a leave.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const [[record]] = await connection.query(
//       'SELECT * FROM employee_leave_records WHERE id = ? AND primary_user = ? AND primary_status IS NULL',
//       [recordId, managerId]
//     );

//     if (!record) {
//       await connection.rollback();
//       return res.status(404).json({ message: 'Pending request not found for your approval.' });
//     }

//     const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
//     const today = DateTime.now().startOf('day');
//     if (today > leaveStartDate) {
//         await connection.rollback();
//         return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
//     }

//     // Update the request status and the user who performed the action
//     await connection.query(
//       'UPDATE employee_leave_records SET primary_status = ?, rejection_reason = ?, updated_by = ? WHERE id = ?',
//       [status, status ? null : rejection_reason, managerId, recordId]
//     );

//     await connection.commit();
//     res.status(200).json({ success: true, message: `Leave request has been ${status ? 'approved' : 'rejected'} at the primary level.` });

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error('Error setting primary approval:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// /**
//  * @description [HR/Admin] Gets leave requests awaiting secondary approval.
//  */
// const getSecondaryApprovalRequests = async (req, res) => {
//     const approverId = req.user.id;
//     let connection;
//     try {
//       connection = await pool.getConnection();
//       const sql = `
//         SELECT
//           lr.*,
//           lt.name as leave_type_name,
//           CONCAT(e.first_name, ' ', e.last_name) as employee_name,
//           CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name
//         FROM employee_leave_records lr
//         LEFT JOIN user e ON lr.employee_id = e.id
//         LEFT JOIN leave_types lt ON lr.leave_type = lt.id
//         LEFT JOIN user pa ON lr.primary_user = pa.id
//         WHERE
//             lr.primary_status = TRUE
//             AND lr.secondry_status IS NULL
//             AND lr.rejection_reason IS NULL
//       `;
//       const [requests] = await connection.query(sql);
//       res.status(200).json(requests);
//     } catch (error) {
//       console.error('Error fetching secondary approval requests:', error);
//       res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//       if (connection) connection.release();
//     }
// };



// /**
//  * @description [HR/Admin] Sets the final approval status and updates the leave balance ledger.
//  */
// const setSecondaryApprovalStatus = async (req, res) => {
//     const { recordId } = req.params;
//     const { status, rejection_reason } = req.body;
//     const adminId = req.user.id;

//     if (status === undefined) {
//       return res.status(400).json({ message: 'A boolean status (true/false) is required.' });
//     }
//     if (status === false && !rejection_reason) {
//       return res.status(400).json({ message: 'A rejection reason is required when rejecting a leave.' });
//     }

//     let connection;
//     try {
//       connection = await pool.getConnection();
//       await connection.beginTransaction();

//       const [[record]] = await connection.query(
//         'SELECT * FROM employee_leave_records WHERE id = ? AND primary_status = TRUE AND secondry_status IS NULL',
//         [recordId]
//       );

//       if (!record) {
//         await connection.rollback();
//         return res.status(404).json({ message: 'Request awaiting secondary approval not found.' });
//       }

//       const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
//       const today = DateTime.now().startOf('day');
//       if (today > leaveStartDate) {
//           await connection.rollback();
//           return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
//       }

//       if (status === true) {
//         const duration = DateTime.fromJSDate(record.to_date).diff(DateTime.fromJSDate(record.from_date), 'days').toObject().days + 1;
        
//         const [[balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE', [record.employee_id, record.leave_type]);

//         if (!balance || balance.balance < duration) {
//             await connection.rollback();
//             return res.status(400).json({ message: 'Failed to approve. The employee has insufficient leave balance.' });
//         }

//         const newBalance = balance.balance - duration;

//         await connection.query('UPDATE employee_leave_balance SET balance = ?, updated_by = ? WHERE employee_id = ? AND leave_id = ?', [newBalance, adminId, record.employee_id, record.leave_type]);

//         await connection.query(
//             `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, leave_record_id, updated_by) VALUES (?, ?, 'deduction', ?, ?, ?, ?, ?)`,
//             [record.employee_id, record.leave_type, balance.balance, -duration, newBalance, record.id, adminId]
//         );
//       }

//       await connection.query(
//         'UPDATE employee_leave_records SET secondry_status = ?, rejection_reason = ?, secondry_user = ?, updated_by = ? WHERE id = ?',
//         [status, status ? null : rejection_reason, adminId, adminId, recordId]
//       );

//       await connection.commit();
//       res.status(200).json({ success: true, message: `Final leave status has been set to ${status ? 'approved' : 'rejected'}.` });

//     } catch (error) {
//       if (connection) await connection.rollback();
//       console.error('Error setting secondary approval:', error);
//       res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//       if (connection) connection.release();
//     }
// };


// /**
//  * @description Gets the history of leaves approved or rejected by the authenticated user.
//  */
// const getMyApprovalHistory = async (req, res) => {
//     const approverId = req.user.id;
//     const { startDate, endDate } = req.query;

//     if (!startDate || !endDate) {
//         return res.status(400).json({ message: 'startDate and endDate (YYYY-MM-DD) are required.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         const sql = `
//             SELECT
//                 lr.id, lr.leave_description, lr.applied_date, lr.from_date, lr.to_date,
//                 lr.rejection_reason, lr.primary_status, lr.secondry_status,
//                 lt.name AS leave_type_name,
//                 CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
//                 CONCAT(pa.first_name, ' ', pa.last_name) AS primary_approver_name,
//                 CONCAT(sa.first_name, ' ', sa.last_name) AS secondary_approver_name,
//                 CASE
//                     WHEN lr.primary_user = ? THEN 'primary'
//                     WHEN lr.secondry_user = ? THEN 'secondary'
//                     ELSE 'unknown'
//                 END AS your_approval_level
//             FROM employee_leave_records lr
//             LEFT JOIN leave_types lt ON lr.leave_type = lt.id
//             LEFT JOIN user e ON lr.employee_id = e.id
//             LEFT JOIN user pa ON lr.primary_user = pa.id
//             LEFT JOIN user sa ON lr.secondry_user = sa.id
//             WHERE
//                 (lr.primary_user = ? OR lr.secondry_user = ?)
//                 AND (lr.primary_status IS NOT NULL OR lr.rejection_reason IS NOT NULL)
//                 AND (lr.from_date <= ? AND lr.to_date >= ?)
//             ORDER BY lr.from_date DESC;
//         `;

//         const [records] = await connection.query(sql, [
//             approverId, approverId, approverId, approverId, endDate, startDate
//         ]);

//         res.status(200).json(records);
//     } catch (error) {
//         console.error('Error fetching approval history:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// module.exports = {
//     getPrimaryApprovalRequests,
//     setPrimaryApprovalStatus,
//     getSecondaryApprovalRequests,
//     setSecondaryApprovalStatus,
//     getMyApprovalHistory
// };


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description [Manager] Gets leave requests awaiting the authenticated manager's primary approval.
 */
const getPrimaryApprovalRequests = async (req, res) => {
  const managerId = req.user.id;
  let connection;
  try {
    connection = await pool.getConnection();
    const sql = `
      SELECT
        lr.*,
        lt.name as leave_type_name,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id
      FROM employee_leave_records lr
      LEFT JOIN user e ON lr.employee_id = e.id
      LEFT JOIN leave_types lt ON lr.leave_type = lt.id
      LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
      WHERE lr.primary_user = ? AND lr.primary_status IS NULL AND lr.rejection_reason IS NULL
    `;
    const [requests] = await connection.query(sql, [managerId]);
    res.status(200).json(requests);
  } catch (error) {
    console.error('Error fetching primary approval requests:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description [Manager] Sets the primary approval status for a leave request.
 */
const setPrimaryApprovalStatus = async (req, res) => {
  const { recordId } = req.params;
  const { status, rejection_reason } = req.body;
  const managerId = req.user.id;

  if (status === undefined) {
    return res.status(400).json({ message: 'A boolean status (true/false) is required.' });
  }
  if (status === false && !rejection_reason) {
    return res.status(400).json({ message: 'Rejection reason is required when rejecting a leave.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[record]] = await connection.query(
      'SELECT * FROM employee_leave_records WHERE id = ? AND primary_user = ? AND primary_status IS NULL',
      [recordId, managerId]
    );

    if (!record) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pending request not found for your approval.' });
    }

    const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
    const today = DateTime.now().startOf('day');
    if (today > leaveStartDate) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
    }

    await connection.query(
      'UPDATE employee_leave_records SET primary_status = ?, rejection_reason = ?, updated_by = ? WHERE id = ?',
      [status, status ? null : rejection_reason, managerId, recordId]
    );

    await connection.commit();
    res.status(200).json({ success: true, message: `Leave request has been ${status ? 'approved' : 'rejected'} at the primary level.` });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error setting primary approval:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description [HR/Admin] Gets leave requests awaiting secondary approval.
 */
const getSecondaryApprovalRequests = async (req, res) => {
    const approverId = req.user.id;
    let connection;
    try {
      connection = await pool.getConnection();
      const sql = `
        SELECT
          lr.*,
          lt.name as leave_type_name,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name,
          CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id
        FROM employee_leave_records lr
        LEFT JOIN user e ON lr.employee_id = e.id
        LEFT JOIN leave_types lt ON lr.leave_type = lt.id
        LEFT JOIN user pa ON lr.primary_user = pa.id
        LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
        WHERE
            lr.primary_status = TRUE
            AND lr.secondry_status IS NULL
            AND lr.rejection_reason IS NULL
      `;
      const [requests] = await connection.query(sql);
      res.status(200).json(requests);
    } catch (error) {
      console.error('Error fetching secondary approval requests:', error);
      res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
      if (connection) connection.release();
    }
};



/**
 * @description [HR/Admin] Sets the final approval status and updates the leave balance ledger.
 */
const setSecondaryApprovalStatus = async (req, res) => {
    const { recordId } = req.params;
    const { status, rejection_reason } = req.body;
    const adminId = req.user.id;

    if (status === undefined) {
      return res.status(400).json({ message: 'A boolean status (true/false) is required.' });
    }
    if (status === false && !rejection_reason) {
      return res.status(400).json({ message: 'A rejection reason is required when rejecting a leave.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [[record]] = await connection.query(
        'SELECT * FROM employee_leave_records WHERE id = ? AND primary_status = TRUE AND secondry_status IS NULL',
        [recordId]
      );

      if (!record) {
        await connection.rollback();
        return res.status(404).json({ message: 'Request awaiting secondary approval not found.' });
      }

      const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
      const today = DateTime.now().startOf('day');
      if (today > leaveStartDate) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
      }

      if (status === true) {
        const duration = DateTime.fromJSDate(record.to_date).diff(DateTime.fromJSDate(record.from_date), 'days').toObject().days + 1;
        
        const [[balance]] = await connection.query('SELECT balance FROM employee_leave_balance WHERE employee_id = ? AND leave_id = ? FOR UPDATE', [record.employee_id, record.leave_type]);

        if (!balance || balance.balance < duration) {
            await connection.rollback();
            return res.status(400).json({ message: 'Failed to approve. The employee has insufficient leave balance.' });
        }

        const newBalance = balance.balance - duration;

        await connection.query('UPDATE employee_leave_balance SET balance = ?, updated_by = ? WHERE employee_id = ? AND leave_id = ?', [newBalance, adminId, record.employee_id, record.leave_type]);

        await connection.query(
            `INSERT INTO employee_leave_balance_ledger (user_id, leave_type_id, transaction_type, previous_balance, change_amount, new_balance, leave_record_id, updated_by) VALUES (?, ?, 'deduction', ?, ?, ?, ?, ?)`,
            [record.employee_id, record.leave_type, balance.balance, -duration, newBalance, record.id, adminId]
        );
      }

      await connection.query(
        'UPDATE employee_leave_records SET secondry_status = ?, rejection_reason = ?, secondry_user = ?, updated_by = ? WHERE id = ?',
        [status, status ? null : rejection_reason, adminId, adminId, recordId]
      );

      await connection.commit();
      res.status(200).json({ success: true, message: `Final leave status has been set to ${status ? 'approved' : 'rejected'}.` });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error setting secondary approval:', error);
      res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
      if (connection) connection.release();
    }
};


/**
 * @description Gets the history of leaves approved or rejected by the authenticated user.
 */
const getMyApprovalHistory = async (req, res) => {
    const approverId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate (YYYY-MM-DD) are required.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                lr.id, lr.leave_description, lr.applied_date, lr.from_date, lr.to_date,
                lr.rejection_reason, lr.primary_status, lr.secondry_status,
                lt.name AS leave_type_name,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                CONCAT(pa.first_name, ' ', pa.last_name) AS primary_approver_name,
                CONCAT(sa.first_name, ' ', sa.last_name) AS secondary_approver_name,
                CONCAT(ns.prefix, LPAD(lr.id, ns.padding_length, '0')) as full_leave_id,
                CASE
                    WHEN lr.primary_user = ? THEN 'primary'
                    WHEN lr.secondry_user = ? THEN 'secondary'
                    ELSE 'unknown'
                END AS your_approval_level
            FROM employee_leave_records lr
            LEFT JOIN leave_types lt ON lr.leave_type = lt.id
            LEFT JOIN user e ON lr.employee_id = e.id
            LEFT JOIN user pa ON lr.primary_user = pa.id
            LEFT JOIN user sa ON lr.secondry_user = sa.id
            LEFT JOIN name_series ns ON ns.table_name = 'employee_leave_records'
            WHERE
                (lr.primary_user = ? OR lr.secondry_user = ?)
                AND (lr.primary_status IS NOT NULL OR lr.rejection_reason IS NOT NULL)
                AND (lr.from_date <= ? AND lr.to_date >= ?)
            ORDER BY lr.from_date DESC;
        `;

        const [records] = await connection.query(sql, [
            approverId, approverId, approverId, approverId, endDate, startDate
        ]);

        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching approval history:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    getPrimaryApprovalRequests,
    setPrimaryApprovalStatus,
    getSecondaryApprovalRequests,
    setSecondaryApprovalStatus,
    getMyApprovalHistory
};