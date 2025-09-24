const { pool } = require('../../db/connector');

/**
 * @description Get a list of all shifts.
 */
const getAllShifts = async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [shifts] = await connection.query('SELECT * FROM shifts ORDER BY name ASC');
    res.status(200).json(shifts);
  } catch (error)
 {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Gets all active users assigned to a specific shift.
 */
const getActiveUsersByShift = async (req, res) => {
    const { shiftId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id
            FROM user u
            LEFT JOIN name_series ns ON ns.table_name = 'user'
            WHERE u.shift = ? AND u.is_active = TRUE
            ORDER BY u.first_name, u.last_name;
        `;
        const [users] = await connection.query(sql, [shiftId]);
        res.status(200).json(users);
    } catch (error) {
        console.error(`Error fetching users for shift ${shiftId}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description Gets active users in a shift whose attendance is not marked for a specific date.
 * If punchout param is passed as true, returns users who have punch_in but missing punch_out.
 */
const getUsersWithUnmarkedAttendance = async (req, res) => {
    const { shiftId, date } = req.params;
    const { punchout } = req.query; // punchout will come from query param (e.g., ?punchout=true)
    let connection;

    try {
        connection = await pool.getConnection();

        let sql;
        let params = [date, shiftId];

        if (punchout === "true") {
            // Case 2: Punchout unmarked
            sql = `
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id
                FROM user u
                INNER JOIN attendance_record ar 
                    ON u.id = ar.employee_id 
                    AND ar.attendance_date = ?
                    AND ar.punch_in IS NOT NULL 
                    AND ar.punch_out IS NULL
                LEFT JOIN name_series ns ON ns.table_name = 'user'
                WHERE u.shift = ? AND u.is_active = TRUE
                ORDER BY u.first_name, u.last_name;
            `;
        } else {
            // Case 1: Normal unmarked attendance
            sql = `
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    CONCAT(ns.prefix, LPAD(u.id, ns.padding_length, '0')) as full_employee_id
                FROM user u
                LEFT JOIN attendance_record ar 
                    ON u.id = ar.employee_id 
                    AND ar.attendance_date = ?
                LEFT JOIN name_series ns ON ns.table_name = 'user'
                WHERE u.shift = ? AND u.is_active = TRUE AND ar.id IS NULL
                ORDER BY u.first_name, u.last_name;
            `;
        }

        const [users] = await connection.query(sql, params);
        res.status(200).json(users);
    } catch (error) {
        console.error(`Error fetching users with unmarked attendance for shift ${shiftId} on ${date}:`, error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    getAllShifts,
    getActiveUsersByShift,
    getUsersWithUnmarkedAttendance
};