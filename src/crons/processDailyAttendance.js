const { pool } = require('../db/connector');
const { DateTime } = require('luxon');

// --- HELPER FUNCTIONS ---

const isNonWorkingDay = async (connection, date) => {
    const dayName = date.toFormat('EEEE').toLowerCase();
    const isoDate = date.toISODate();

    const [holidays] = await connection.query('SELECT id FROM holidays WHERE holiday_date = ? LIMIT 1', [isoDate]);
    if (holidays.length > 0) return true;

    const [weeklyOffs] = await connection.query('SELECT id FROM work_week WHERE day_of_week = ? AND is_working_day = FALSE', [dayName]);
    if (weeklyOffs.length > 0) return true;

    return false;
};

// --- CORE LOGIC ---

/**
 * @description Task 1: Reconciles attendance for the given previous day.
 */
const reconcilePreviousDay = async (connection, previousDay) => {
    console.log(`\n[RECONCILIATION] Starting process for: ${previousDay.toISODate()}`);

    if (await isNonWorkingDay(connection, previousDay)) {
        console.log(`[RECONCILIATION] ${previousDay.toISODate()} was a non-working day. Skipping reconciliation.`);
        return;
    }

    const findAbsenteesSql = `
        SELECT u.id, u.shift
        FROM user u
        LEFT JOIN attendance_record ar ON u.id = ar.employee_id AND ar.attendance_date = ?
        WHERE u.is_active = TRUE AND ar.id IS NULL;
    `;
    const [absentees] = await connection.query(findAbsenteesSql, [previousDay.toISODate()]);

    if (absentees.length > 0) {
        console.log(`[RECONCILIATION] Found ${absentees.length} employee(s) to mark as ABSENT.`);
        for (const emp of absentees) {
            await connection.query(
                `INSERT INTO attendance_record (employee_id, attendance_date, shift, attendance_status) VALUES (?, ?, ?, 'Absent')`,
                [emp.id, previousDay.toISODate(), emp.shift]
            );
        }
    }

    const findMissedPunchOutsSql = `
        SELECT ar.id, ar.punch_in, s.half_day_threshold
        FROM attendance_record ar
        JOIN shifts s ON ar.shift = s.id
        WHERE ar.attendance_date = ? AND ar.punch_in IS NOT NULL AND ar.punch_out IS NULL;
    `;
    const [missedPunchOuts] = await connection.query(findMissedPunchOutsSql, [previousDay.toISODate()]);

    if (missedPunchOuts.length > 0) {
        console.log(`[RECONCILIATION] Found ${missedPunchOuts.length} record(s) with missed punch-outs to mark as HALF-DAY.`);
        for (const rec of missedPunchOuts) {
            const punchInTime = DateTime.fromJSDate(rec.punch_in);
            const effectivePunchOut = punchInTime.plus({ hours: rec.half_day_threshold });
            const hours_worked = parseFloat(rec.half_day_threshold);

            await connection.query(
                `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, attendance_status = 'Half-Day' WHERE id = ?`,
                [effectivePunchOut.toJSDate(), hours_worked, rec.id]
            );
        }
    }
    console.log(`[RECONCILIATION] Process for ${previousDay.toISODate()} completed.`);
};

/**
 * @description Task 2: Proactively marks attendance for employees on approved leave for the current day.
 */
const markCurrentDayLeaves = async (connection, currentDay) => {
    console.log(`\n[PROACTIVE LEAVE] Starting process for: ${currentDay.toISODate()}`);

    const findLeavesSql = `
      SELECT employee_id, shift
      FROM employee_leave_records lr
      JOIN user u ON lr.employee_id = u.id
      WHERE
        lr.primary_status = TRUE
        AND lr.secondry_status = TRUE
        AND ? BETWEEN lr.from_date AND lr.to_date;
    `;
    const [employeesOnLeave] = await connection.query(findLeavesSql, [currentDay.toISODate()]);

    if (employeesOnLeave.length > 0) {
        console.log(`[PROACTIVE LEAVE] Found ${employeesOnLeave.length} employee(s) on approved leave. Marking attendance.`);
        for (const emp of employeesOnLeave) {
            await connection.query(
                `INSERT INTO attendance_record (employee_id, attendance_date, shift, attendance_status) VALUES (?, ?, ?, 'Leave') ON DUPLICATE KEY UPDATE attendance_status = 'Leave'`,
                [emp.employee_id, currentDay.toISODate(), emp.shift]
            );
        }
    }
    console.log(`[PROACTIVE LEAVE] Process for ${currentDay.toISODate()} completed.`);
};


/**
 * @description Main function to orchestrate the daily attendance processing.
 * @param {string} [dateArg] - Optional date string in 'YYYY-MM-DD' format to override the current date for testing.
 */
const processDailyAttendance = async (dateArg) => {
    const baseDate = dateArg ? DateTime.fromISO(dateArg) : DateTime.now();

    if (!baseDate.isValid) {
        console.error(`[CRON ERROR] Invalid date format provided: "${dateArg}". Please use YYYY-MM-DD.`);
        return;
    }

    console.log(`[CRON START] Daily Attendance Processing Started at ${new Date().toISOString()}`);
    console.log(`[INFO] Using base date: ${baseDate.toISODate()}`);

    let connection;
    try {
        connection = await pool.getConnection();
        
        // Define the correct dates based on the new logic
        const previousDay = baseDate.minus({ days: 1 });
        const currentDay = baseDate;

        // Run tasks sequentially
        await reconcilePreviousDay(connection, previousDay);
        await markCurrentDayLeaves(connection, currentDay);

    } catch (error) {
        console.error(`[CRON ERROR] A critical error occurred during daily attendance processing:`, error);
    } finally {
        if (connection) {
            await connection.release();
            if (require.main === module) {
                pool.end();
            }
        }
        console.log(`[CRON END] Daily Attendance Processing Finished at ${new Date().toISOString()}`);
    }
};

// This block allows the script to be run directly from the command line or imported

processDailyAttendance('2025-09-26')

module.exports = { processDailyAttendance };