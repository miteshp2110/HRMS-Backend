// /**
//  * Get My Attendance (with filters)
//  */
// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// const getMyAttendance = async (req, res) => {
//   const employeeId = req.user.id;
//   const { startDate, endDate } = req.query;

//   try {
//     let query = `
//       SELECT id, attendance_date, shift, punch_in, punch_out, hours_worked,
//              attendance_status, pay_type, overtime_status, overtime_approved_by,
//              created_at, updated_at, updated_by
//       FROM attendance_record
//       WHERE employee_id = ?`;
//     const params = [employeeId];

//     if (startDate && endDate) {
//       query += ` AND attendance_date BETWEEN ? AND ?`;
//       params.push(startDate, endDate);
//     }

//     query += ` ORDER BY attendance_date DESC, punch_in DESC`;

//     const [rows] = await pool.query(query, params);

//     res.json(rows);
//   } catch (err) {
//     console.error('Error fetching my attendance:', err);
//     res.status(500).json({ error: 'Error fetching attendance' });
//   }
// };


// /**
//  * @description Gets attendance records based on query filters.
//  * Authorization is expected to be handled by middleware.
//  */
// const getAttendanceRecords = async (req, res) => {
//     // Added shift_id to the destructured query params
//     const { employee_id, shift_id, date, week, month, year, page = 1, limit = 20 } = req.query;
//     const offset = (parseInt(page) - 1) * parseInt(limit);
    

//     let connection;
//     try {
      
//       if(!shift_id){
//         return res.status(400).json({message:"Please Provide Shift_Id"})
//       }

//       connection = await pool.getConnection();
//       let params = [];
//       let whereClauses = [];
  
//       // --- Dynamic Query Building ---
//       if (employee_id) {
//         whereClauses.push('ar.employee_id = ?');
//         params.push(employee_id);
//       }
      
//       // --- New Filter ---
//       // Add a filter for the shift if a shift_id is provided
//       if (shift_id) {
//         whereClauses.push('ar.shift = ?');
//         params.push(shift_id);
//       }
//       // --- End New Filter ---
  
//       if (date) {
//         whereClauses.push('ar.attendance_date = ?');
//         params.push(date);
//       } else if (week && year) {
//         const startOfWeek = DateTime.fromObject({ weekYear: parseInt(year), weekNumber: parseInt(week) }).startOf('week').toISODate();
//         const endOfWeek = DateTime.fromObject({ weekYear: parseInt(year), weekNumber: parseInt(week) }).endOf('week').toISODate();
//         whereClauses.push('ar.attendance_date BETWEEN ? AND ?');
//         params.push(startOfWeek, endOfWeek);
//       } else if (month && year) {
//         const startOfMonth = DateTime.fromObject({ year: parseInt(year), month: parseInt(month) }).startOf('month').toISODate();
//         const endOfMonth = DateTime.fromObject({ year: parseInt(year), month: parseInt(month) }).endOf('month').toISODate();
//         whereClauses.push('ar.attendance_date BETWEEN ? AND ?');
//         params.push(startOfMonth, endOfMonth);
//       } else {
//         const today = DateTime.now().toISODate();
//         whereClauses.push('ar.attendance_date = ?');
//         params.push(today);
//       }
  
//       let sql = `
//         SELECT ar.*, u.first_name, u.last_name 
//         FROM attendance_record ar
//         JOIN user u ON ar.employee_id = u.id
//       `;
//       if (whereClauses.length > 0) {
//         sql += ` WHERE ${whereClauses.join(' AND ')}`;
//       }
//       sql += ' ORDER BY ar.attendance_date DESC, u.first_name ASC LIMIT ? OFFSET ?';
//       params.push(parseInt(limit), offset);
  
//       const [records] = await connection.query(sql, params);
//       res.status(200).json(records);
//     } catch (error) {
//       console.error('Error fetching attendance records:', error);
//       res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//       if (connection) connection.release();
//     }
//   };


// module.exports={getMyAttendance,getAttendanceRecords}


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

const getMyAttendance = async (req, res) => {
  const employeeId = req.user.id;
  const { startDate, endDate } = req.query;

  try {
    // --- MODIFIED QUERY ---
    // Added a LEFT JOIN to the user table using an alias 'updater'
    // to get the name of the user who updated the record.
    let query = `
      SELECT 
        ar.id, ar.attendance_date, ar.shift, ar.punch_in, ar.punch_out, 
        ar.hours_worked, ar.attendance_status, ar.pay_type, ar.overtime_status, 
        ar.overtime_approved_by, ar.created_at, ar.updated_at,
        CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by
      FROM attendance_record ar
      LEFT JOIN user updater ON ar.updated_by = updater.id
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

const getAttendanceRecords = async (req, res) => {
    const { employee_id, shift_id, date, week, month, year, page = 1, limit = 20 } = req.query;
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
      } else {
        const today = DateTime.now().toISODate();
        whereClauses.push('ar.attendance_date = ?');
        params.push(today);
      }
  
      // --- MODIFIED QUERY ---
      // Added a LEFT JOIN for the 'updater' and selected their concatenated name.
      let sql = `
        SELECT 
          ar.*, 
          u.first_name, 
          u.last_name,
          CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by
        FROM attendance_record ar
        JOIN user u ON ar.employee_id = u.id
        LEFT JOIN user updater ON ar.updated_by = updater.id
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


module.exports={getMyAttendance,getAttendanceRecords}