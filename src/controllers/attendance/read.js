
const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Gets the attendance history for the currently authenticated user.
 */
const getMyAttendance = async (req, res) => {
  const employeeId = req.user.id;
  const { startDate, endDate } = req.query;

  try {
    // This query now joins with the overtime table and selects the new boolean flags.
    let query = `
      SELECT
        ar.id, ar.attendance_date, ar.shift, ar.punch_in, ar.punch_out,
        ar.hours_worked, ar.attendance_status, ar.is_late, ar.is_early_departure,
        ar.short_hours, ar.created_at, ar.updated_at,
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
        eor.overtime_hours,
        eor.status AS overtime_status
      FROM attendance_record ar
      LEFT JOIN user updater ON ar.updated_by = updater.id
      LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id
      WHERE ar.employee_id = ?`;

    const params = [employeeId];

    if (startDate && endDate) {
      query += ` AND ar.attendance_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY ar.attendance_date DESC, ar.punch_in DESC`;

    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching my attendance:', err);
    res.status(500).json({ error: 'Error fetching attendance' });
  }
};

/**
 * @description Gets attendance records for all users with filtering options.
 */
const getAttendanceRecords = async (req, res) => {
    const { employee_id, shift_id, date, week, month, year, page = 1, limit = 31 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let connection;
    try {
      connection = await pool.getConnection();
      let params = [];
      let whereClauses = [];

      if (employee_id) {
        whereClauses.push('ar.employee_id = ?');
        params.push(employee_id);
      }
      if (shift_id) {
        whereClauses.push('ar.shift = ?');
        params.push(shift_id);
      }

      if (date) {
        whereClauses.push('ar.attendance_date = ?');
        params.push(date);
      } else if (week && year) {
        const startOfWeek = DateTime.fromObject({ weekYear: parseInt(year), weekNumber: parseInt(week) }).startOf('week').toISODate();
        const endOfWeek = DateTime.fromObject({ weekYear: parseInt(year), weekNumber: parseInt(week) }).endOf('week').toISODate();
        whereClauses.push('ar.attendance_date BETWEEN ? AND ?');
        params.push(startOfWeek, endOfWeek);
      } else if (month && year) {
        const startOfMonth = DateTime.fromObject({ year: parseInt(year), month: parseInt(month) }).startOf('month').toISODate();
        const endOfMonth = DateTime.fromObject({ year: parseInt(year), month: parseInt(month) }).endOf('month').toISODate();
        whereClauses.push('ar.attendance_date BETWEEN ? AND ?');
        params.push(startOfMonth, endOfMonth);
      }

      // This query is updated to join overtime records and select the new boolean flags.
      let sql = `
        SELECT
          ar.id, ar.attendance_date, ar.punch_in, ar.punch_out, ar.hours_worked,
          ar.attendance_status, ar.is_late, ar.is_early_departure, ar.short_hours,
          u.first_name, u.last_name, u.id as employee_id,
          CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
          eor.overtime_hours,
          eor.status AS overtime_status,
          eor.rejection_reason,
          CONCAT(processor.first_name, ' ', processor.last_name) AS overtime_processed_by
        FROM attendance_record ar
        JOIN user u ON ar.employee_id = u.id
        LEFT JOIN user updater ON ar.updated_by = updater.id
        LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id
        LEFT JOIN user processor ON eor.processed_by = processor.id
      `;
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      sql += ' ORDER BY ar.attendance_date DESC, u.first_name ASC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const [records] = await connection.query(sql, params);
      res.status(200).json(records);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
      if (connection) connection.release();
    }
  };


module.exports = { getMyAttendance, getAttendanceRecords };