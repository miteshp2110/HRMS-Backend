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
      SELECT lr.*, lt.name as leave_type_name, CONCAT(e.first_name, ' ', e.last_name) as employee_name
      FROM employee_leave_records lr
      JOIN user e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type = lt.id
      WHERE lr.primary_user = ? AND lr.primary_status = FALSE AND lr.rejection_reason IS NULL
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
    return res.status(400).json({ message: 'A boolean status is required.' });
  }
  if (status === false && !rejection_reason) {
    return res.status(400).json({ message: 'Rejection reason is required when rejecting a leave.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[record]] = await connection.query(
      'SELECT * FROM employee_leave_records WHERE id = ? AND primary_user = ? AND primary_status = FALSE',
      [recordId, managerId]
    );

    if (!record) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pending request not found for your approval.' });
    }

    // --- NEW: VALIDATION ---
    // Check if the leave start date is in the past.
    const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
    const today = DateTime.now().startOf('day');
    if (today > leaveStartDate) {
        await connection.rollback();
        return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
    }

    // Update the request status
    await connection.query(
      'UPDATE employee_leave_records SET primary_status = ?, rejection_reason = ? WHERE id = ?',
      [status, status ? null : rejection_reason, recordId]
    );

    // --- REMOVED ---
    // Balance deduction is now handled in the secondary approval step.

    await connection.commit();
    res.status(200).json({ success: true, message: `Leave request ${status ? 'approved' : 'rejected'} at the primary level.` });

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
 * Now includes the name of the primary approver.
 */
const getSecondaryApprovalRequests = async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const sql = `
        SELECT 
          lr.*, 
          lt.name as leave_type_name, 
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          -- MODIFIED: Added the line below to get the primary approver's name
          CONCAT(pa.first_name, ' ', pa.last_name) as primary_approver_name
        FROM employee_leave_records lr
        JOIN user e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type = lt.id
        -- MODIFIED: Added a LEFT JOIN to the user table again with a new alias 'pa'
        LEFT JOIN user pa ON lr.primary_user = pa.id
        WHERE lr.primary_status = TRUE AND lr.secondry_status = FALSE AND lr.rejection_reason IS NULL
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
 * @description [HR/Admin] Sets the final approval status for a leave request.
 * If approved, the employee's leave balance is now deducted.
 * All operations are performed within a database transaction.
 */
const setSecondaryApprovalStatus = async (req, res) => {
    const { recordId } = req.params;
    const { status, rejection_reason } = req.body;
    const adminId = req.user.id;

    if (status === undefined) {
      return res.status(400).json({ message: 'A boolean status is required.' });
    }
    if (status === false && !rejection_reason) {
      return res.status(400).json({ message: 'Rejection reason is required when rejecting a leave.' });
    }

    let connection;
    try {
      // 1. Start the Transaction (this is your safety net)
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 2. Find the specific request that is awaiting secondary approval
      const [[record]] = await connection.query(
        'SELECT * FROM employee_leave_records WHERE id = ? AND primary_status = TRUE AND secondry_status = FALSE',
        [recordId]
      );

      if (!record) {
        await connection.rollback();
        return res.status(404).json({ message: 'Request awaiting secondary approval not found.' });
      }

      // 3. Business Rule: Check if the leave start date is in the past.
      const leaveStartDate = DateTime.fromJSDate(record.from_date).startOf('day');
      const today = DateTime.now().startOf('day');
      if (today > leaveStartDate) {
          await connection.rollback();
          return res.status(400).json({ message: 'Cannot approve or reject a leave request that has already started.' });
      }
      
    
      // 4. If the status is approved, attempt to deduct the balance first.
      if (status == true) {
        const duration = DateTime.fromJSDate(record.to_date).diff(DateTime.fromJSDate(record.from_date), 'days').toObject().days + 1;
        
        // This query will only succeed if the employee's balance is sufficient.
        
        const updateBalanceSql = 'UPDATE employee_leave_balance SET balance = balance - ? WHERE employee_id = ? AND leave_id = ? AND balance >= ?';
        const [updateResult] = await connection.query(updateBalanceSql, [duration, record.employee_id, record.leave_type, duration]);

        // This is the most likely reason for failure. If 0 rows are affected, it means the balance was too low.
        if (updateResult.affectedRows === 0) {
          await connection.rollback(); // Abort the entire transaction
          return res.status(400).json({ message: 'Failed to approve. The employee has insufficient leave balance.' });
        }
      }

      // 5. If balance deduction was successful (or if rejecting), update the leave record itself.
      // --- CORRECTED QUERY --- Now includes setting the secondry_user ID.
      await connection.query(
        'UPDATE employee_leave_records SET secondry_status = ?, rejection_reason = ?, secondry_user = ? WHERE id = ?',
        [status, status ? null : rejection_reason, adminId, recordId]
      );

      // 6. If all steps succeed, commit the transaction to make the changes permanent.
      await connection.commit();
      res.status(200).json({ success: true, message: `Final leave status has been set to ${status ? 'approved' : 'rejected'}.` });

    } catch (error) {
      // If any error occurs at any step, roll back everything.
      if (connection) await connection.rollback();
      console.error('Error setting secondary approval:', error);
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
};