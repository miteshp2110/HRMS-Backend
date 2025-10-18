const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Allows an employee to manually request overtime for a specific date, with timezone handling.
 */
const requestOvertime = async (req, res) => {
  const employeeId = req.user.id;
  const { attendance_date, overtime_start, overtime_end, overtime_type = 'regular', reason, timezone } = req.body;

  if (!attendance_date || !overtime_start || !overtime_end || !reason || !timezone) {
    return res.status(400).json({ message: 'attendance_date, overtime_start, overtime_end, timezone, and a reason are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Interpret the incoming times as local to the provided timezone, then convert to UTC
    const startTimeUTC = DateTime.fromISO(overtime_start, { zone: timezone }).toUTC();
    const endTimeUTC = DateTime.fromISO(overtime_end, { zone: timezone }).toUTC();

    if (!startTimeUTC.isValid || !endTimeUTC.isValid) {
        return res.status(400).json({ message: 'Invalid overtime_start or overtime_end format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ss).' });
    }

    if (startTimeUTC >= endTimeUTC) {
        return res.status(400).json({ message: 'Overtime start time must be before the end time.'});
    }

    const overtime_hours = parseFloat(endTimeUTC.diff(startTimeUTC, 'hours').as('hours').toFixed(2));

    const sql = `
      INSERT INTO employee_overtime_records (employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    // Store the UTC times in the database
    const [result] = await connection.query(sql, [employeeId, attendance_date, overtime_hours, overtime_type, startTimeUTC.toJSDate(), endTimeUTC.toJSDate(), reason]);

    res.status(201).json({
      success: true,
      message: 'Overtime request submitted successfully.',
      overtimeRecordId: result.insertId
    });
  } catch (error) {
    console.error('Error requesting overtime:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets all overtime records for the currently authenticated user.
 */
const getMyOvertimeRecords = async (req, res) => {
    const employeeId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT eor.*, CONCAT(p.first_name, ' ', p.last_name) as processed_by_name
            FROM employee_overtime_records eor
            LEFT JOIN user p ON eor.processed_by = p.id
            WHERE eor.employee_id = ?
            ORDER BY eor.request_date DESC;
        `;
        const [records] = await connection.query(sql, [employeeId]);
        res.status(200).json(records);
    } catch (error) {
        console.error('Error fetching overtime records:', error);
        res.status(500).json({ message: 'An internal server error occurred.'});
    } finally {
        if(connection) connection.release();
    }
};

/**
 * @description [Manager] Gets all pending overtime requests for their direct reports.
 */
const getOvertimeRequestsForApproval = async (req, res) => {
    const managerId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT eor.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM employee_overtime_records eor
            JOIN user u ON eor.employee_id = u.id
            WHERE eor.status = 'pending_approval'
            ORDER BY eor.request_date ASC;
        `;
        const [requests] = await connection.query(sql);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching overtime requests for approval:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};
/**
 * @description [Manager] Gets all pending overtime requests for their direct reports.
 */
const getOvertimeRequestsForApprovalForId = async (req, res) => {
    const {employeeId} = req.params
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT eor.*, CONCAT(u.first_name, ' ', u.last_name) as employee_name
            FROM employee_overtime_records eor
            JOIN user u ON eor.employee_id = u.id
            WHERE u.id=? AND eor.status = 'pending_approval'
            ORDER BY eor.request_date ASC;
        `;
        const [requests] = await connection.query(sql,employeeId);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Error fetching overtime requests for approval:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};

/**
 * @description [Manager] Approves or rejects a pending overtime request.
 */
const approveOrRejectOvertime = async (req, res) => {
    const { overtimeId } = req.params;
    const { status, approved_hours, rejection_reason } = req.body;
    const managerId = req.user.id;

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'."});
    }
    if (status === 'approved' && approved_hours === undefined) {
        return res.status(400).json({ message: "Approved hours are required when approving."});
    }
    if (status === 'rejected' && !rejection_reason) {
        return res.status(400).json({ message: "A rejection reason is required."});
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            UPDATE employee_overtime_records
            SET status = ?, approved_hours = ?, processed_by = ?, processed_at = NOW(), rejection_reason = ?
            WHERE id = ? AND status = 'pending_approval';
        `;
        const [result] = await connection.query(sql, [status, approved_hours || 0, managerId, rejection_reason || null, overtimeId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending overtime request not found or you do not have permission to process it.'});
        }

        res.status(200).json({ success: true, message: `Overtime request has been ${status}.`});
    } catch (error) {
        console.error('Error processing overtime request:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};

/**
 * @description [Manager] Updates the details of an existing overtime record.
 */
const updateOvertimeRecord = async (req, res) => {
    const { overtimeId } = req.params;
    const { approved_hours } = req.body;
    const managerId = req.user.id;

    if (approved_hours === undefined) {
        return res.status(400).json({ message: 'Approved hours are required.'});
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            UPDATE employee_overtime_records
            SET approved_hours = ?, processed_by = ?, processed_at = NOW()
            WHERE id = ?;
        `;
        const [result] = await connection.query(sql, [approved_hours, managerId, overtimeId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Overtime record not found.'});
        }

        res.status(200).json({ success: true, message: 'Overtime record updated successfully.' });
    } catch (error) {
        console.error('Error updating overtime record:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};

/**
 * @description Allows an employee to delete their own PENDING overtime request.
 */
const deleteOvertimeRequest = async (req, res) => {
    const { overtimeId } = req.params;
    const employeeId = req.user.id;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            DELETE FROM employee_overtime_records
            WHERE id = ? AND employee_id = ? AND status = 'pending_approval';
        `;
        const [result] = await connection.query(sql, [overtimeId, employeeId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending overtime request not found or it has already been processed.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting overtime request:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if(connection) connection.release();
    }
};


module.exports = {
    requestOvertime,
    getMyOvertimeRecords,
    getOvertimeRequestsForApproval,
    approveOrRejectOvertime,
    updateOvertimeRecord,
    deleteOvertimeRequest,
    getOvertimeRequestsForApprovalForId
};