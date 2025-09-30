const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Gets a single, detailed attendance record by its ID.
 */
const getAttendanceRecordById = async (req, res) => {
    const { recordId } = req.params;
    let connection;
    try {
        connection = await pool.getConnection();
        const sql = `
            SELECT
                ar.id, ar.attendance_date, ar.punch_in, ar.punch_out, ar.hours_worked,
                ar.attendance_status, ar.is_late, ar.is_early_departure, ar.short_hours,
                u.first_name, u.last_name,
                s.name as shift_name,
                CONCAT(updater.first_name, ' ', updater.last_name) AS updated_by_name,
                eor.overtime_hours, eor.approved_hours,
                eor.status AS overtime_status
            FROM attendance_record ar
            JOIN user u ON ar.employee_id = u.id
            LEFT JOIN shifts s ON ar.shift = s.id
            LEFT JOIN user updater ON ar.updated_by = updater.id
            LEFT JOIN employee_overtime_records eor ON ar.id = eor.attendance_record_id
            WHERE ar.id = ?;
        `;
        const [[record]] = await connection.query(sql, [recordId]);

        if (!record) {
            return res.status(404).json({ message: 'Attendance record not found.' });
        }
        res.status(200).json(record);
    } catch (error) {
        console.error('Error fetching attendance record by ID:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * @description [Manager] Gets a monthly attendance and overtime summary for a specific employee.
 */
const getEmployeeMonthlySummary = async (req, res) => {
    const { employeeId, month, year } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();
        const startOfMonth = DateTime.fromObject({ year, month }).startOf('month').toISODate();
        const endOfMonth = DateTime.fromObject({ year, month }).endOf('month').toISODate();

        // 1. Get all attendance records for the month
        const attendanceSql = `
            SELECT attendance_status, hours_worked, short_hours, is_late, is_early_departure
            FROM attendance_record
            WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?;
        `;
        const [attendanceRecords] = await connection.query(attendanceSql, [employeeId, startOfMonth, endOfMonth]);

        // 2. Get all overtime records for the month
        const overtimeSql = `
            SELECT overtime_hours, approved_hours, status
            FROM employee_overtime_records
            WHERE employee_id = ? AND request_date BETWEEN ? AND ?;
        `;
        const [overtimeRecords] = await connection.query(overtimeSql, [employeeId, startOfMonth, endOfMonth]);

        // 3. Process the data
        let total_hours_worked = 0;
        let total_short_hours = 0;
        let late_days = 0;
        let early_departures = 0;
        let absent_days = 0;
        let leave_days = 0;
        let present_days = 0;
        let half_days = 0;

        attendanceRecords.forEach(rec => {
            total_hours_worked += parseFloat(rec.hours_worked || 0);
            total_short_hours += parseFloat(rec.short_hours || 0);
            if (rec.is_late) late_days++;
            if (rec.is_early_departure) early_departures++;
            if (rec.attendance_status === 'Absent') absent_days++;
            if (rec.attendance_status === 'Leave') leave_days++;
            if (rec.attendance_status === 'Present') present_days++;
            if (rec.attendance_status === 'Half-Day') half_days++;
        });
        
        let total_overtime_requested = 0;
        let total_overtime_approved = 0;
        let total_overtime_rejected = 0;

        overtimeRecords.forEach(rec => {
            if(rec.status === 'approved'){
                total_overtime_approved +=  parseFloat(rec.approved_hours || 0);
            }
             if(rec.status === 'rejected'){
                total_overtime_rejected +=  parseFloat(rec.overtime_hours || 0);
            }
             if(rec.status === 'pending_approval'){
                total_overtime_requested +=  parseFloat(rec.overtime_hours || 0);
            }
        })


        const summary = {
            total_hours_worked: total_hours_worked.toFixed(2),
            total_short_hours: total_short_hours.toFixed(2),
            late_days,
            early_departures,
            absent_days,
            leave_days,
            present_days,
            half_days,
            overtime: {
                requested: total_overtime_requested.toFixed(2),
                approved: total_overtime_approved.toFixed(2),
                rejected: total_overtime_rejected.toFixed(2)
            }
        };

        res.status(200).json(summary);

    } catch (error) {
        console.error('Error fetching employee monthly summary:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    getAttendanceRecordById,
    getEmployeeMonthlySummary
};