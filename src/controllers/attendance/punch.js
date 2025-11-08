
const { pool } = require("../../db/connector");
const { DateTime } = require("luxon");

/**
 * @description Calculates the total hours worked between two timestamps.
 * @returns {number} Hours worked, rounded to two decimal places.
 */
const calculateHoursWorked = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  const diffMs = new Date(punchOut).getTime() - new Date(punchIn).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return parseFloat(diffHours.toFixed(2));
};

/**
 * @description Determines the official punch time.
 * @returns {Date} The official punch time as a JavaScript Date object.
 */

// process.env.NODE_ENV !== 'production' &&
const getPunchTime = (req) => {
  if ( req.body.time_local && req.body.timezone) {
    const { time_local, timezone } = req.body;
    return DateTime.fromFormat(time_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toJSDate();
  } else {
    return new Date();
  }
};

/**
 * @description Gets timezone from request body or defaults to system timezone
 * @param {Object} req - Request object
 * @returns {string} Timezone string
 */
const getTimezone = (req) => {
  return req.body.timezone || DateTime.local().zoneName;
};

/**
 * @description Checks if a date is a non-working day (based on work_week table or holidays table)
 * @param {string} attendanceDate - Date in YYYY-MM-DD format
 * @param {Object} connection - Database connection
 * @returns {boolean} True if it's a non-working day
 */
const isNonWorkingDay = async (attendanceDate, connection) => {
  const date = new Date(attendanceDate);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  // Check if it's a holiday
  const [[holiday]] = await connection.query(
    "SELECT id FROM holidays WHERE holiday_date = ?", 
    [attendanceDate]
  );
  if (holiday) {
    return true;
  }
  
  // Check work_week table to see if this day of week is a working day
  const [[workDay]] = await connection.query(
    "SELECT is_working_day FROM work_week WHERE day_of_week = ?", 
    [dayOfWeek]
  );
  
  // If day is found in work_week table and is_working_day is false, it's a non-working day
  if (workDay && !workDay.is_working_day) {
    return true;
  }
  
  // If day is not found in work_week table, assume it's a working day
  return false;
};

/**
 * @description Records a user's punch-in and calculates the effective punch-in time and late status.
 */
const punchIn = async (req, res) => {
  const employeeId = req.body.employee_id || req.user.id;
  let connection;

  try {
    const actualPunchTime = DateTime.fromJSDate(getPunchTime(req));
    const timezone = getTimezone(req);
    const attendanceDate = actualPunchTime.setZone(timezone).toISODate();

    connection = await pool.getConnection();

    // Check if it's a non-working day
    const isHoliday = await isNonWorkingDay(attendanceDate, connection);

    const [[user]] = await connection.query("SELECT shift FROM user WHERE id = ?", [employeeId]);
    if (!user || !user.shift) {
      return res.status(400).json({ message: "User is not assigned to a shift." });
    }
    const shiftId = user.shift;

    const [[shift]] = await connection.query(
      "SELECT from_time, punch_in_margin FROM shifts WHERE id = ?",
      [shiftId]
    );
    if (!shift) {
      return res.status(400).json({ message: "Assigned shift not found." });
    }

    let effectivePunchInTime = actualPunchTime;
    let is_late = false;

    // For non-working days, store actual punch time but don't apply shift logic
    if (!isHoliday) {
      // Convert shift times to user's timezone for comparison
      // Database stores shift times in UTC, so we create UTC datetime first then convert to user timezone
      const shiftStartTimeUTC = DateTime.fromISO(`${attendanceDate}T${shift.from_time}`, { zone: 'utc' });
      const shiftStartTime = shiftStartTimeUTC.setZone(timezone);
      const gracePeriodEnd = shiftStartTime.plus({ minutes: shift.punch_in_margin });
      
      // Convert actual punch time to user's timezone for comparison
      const actualPunchTimeLocal = actualPunchTime.setZone(timezone);

      console.log('Debug - Punch In:');
      console.log('Attendance Date:', attendanceDate);
      console.log('Shift Start Time (DB UTC):', shift.from_time);
      console.log('Shift Start Time (UTC):', shiftStartTimeUTC.toISO());
      console.log('Shift Start Time (Local):', shiftStartTime.toISO());
      console.log('Grace Period End:', gracePeriodEnd.toISO());
      console.log('Actual Punch Time (Local):', actualPunchTimeLocal.toISO());
      console.log('Punch In Margin (minutes):', shift.punch_in_margin);

      // Apply punch-in logic for working days
      if (actualPunchTimeLocal <= shiftStartTime) {
        // If early or exactly on time, set to shift start (but store as UTC)
        effectivePunchInTime = shiftStartTimeUTC;
        console.log('Case: Early/On-time - Setting to shift start');
      } else if (actualPunchTimeLocal <= gracePeriodEnd) {
        // If within grace period, set to shift start (but store as UTC)
        effectivePunchInTime = shiftStartTimeUTC;
        console.log('Case: Within grace period - Setting to shift start');
      } else {
        // If after grace period, mark as late and use actual time (already in UTC)
        is_late = true;
        effectivePunchInTime = actualPunchTime;
        console.log('Case: Late - Using actual punch time');
      }
    }

    const sql = `
      INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, attendance_status, is_late, updated_by)
      VALUES (?, ?, ?, ?, 'Present', ?, ?)
      ON DUPLICATE KEY UPDATE
        punch_in = VALUES(punch_in), attendance_status = 'Present', is_late = VALUES(is_late), updated_by = VALUES(updated_by);
    `;
    await connection.query(sql, [
      employeeId,
      attendanceDate,
      shiftId,
      effectivePunchInTime.toJSDate(),
      is_late,
      req.user.id
    ]);

    res.status(200).json({ 
      message: "Punch in recorded successfully.", 
      is_late,
      is_holiday: isHoliday,
      effective_punch_in: effectivePunchInTime.setZone(timezone).toISO(),
      actual_punch_in: actualPunchTime.setZone(timezone).toISO()
    });
  } catch (error) {
    console.error("Error during punch in:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * @description Records a user's punch-out, calculates final status, and handles overtime correctly.
 */
// const punchOut = async (req, res) => {
//   const employeeId = req.body.employee_id || req.user.id;
//   let connection;

//   try {
//     const actualPunchTime = DateTime.fromJSDate(getPunchTime(req));
//     const timezone = getTimezone(req);
//     const attendanceDate = actualPunchTime.setZone(timezone).toISODate();

//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     // Check if it's a non-working day
//     const isHoliday = await isNonWorkingDay(attendanceDate, connection);

//     const findRecordSql = `
//       SELECT ar.id, ar.punch_in, s.to_time, s.punch_out_margin, s.scheduled_hours, s.half_day_threshold, s.overtime_threshold
//       FROM attendance_record ar
//       JOIN shifts s ON ar.shift = s.id
//       WHERE ar.employee_id = ? AND ar.attendance_date = ? AND ar.punch_out IS NULL;
//     `;
//     const [[record]] = await connection.query(findRecordSql, [employeeId, attendanceDate]);

//     if (!record) {
//       await connection.rollback();
//       return res.status(400).json({ message: "No active punch-in record found for today." });
//     }

//     let effectivePunchOutTime = actualPunchTime;
//     let is_early_departure = false;
//     let hoursWorked = 0;
//     let short_hours = 0;
//     let attendance_status = 'Present';
//     let overtime_hours = 0;

//     if (isHoliday) {
//       // For non-working days, all time is overtime
//       effectivePunchOutTime = actualPunchTime;
//       hoursWorked = 0; // No regular hours worked
//       overtime_hours = calculateHoursWorked(record.punch_in, actualPunchTime.toJSDate());
//       short_hours = 0;
//       attendance_status = 'Present';
      
//       // Record holiday overtime
//       if (overtime_hours > 0) {
//         const overtimeSQL = `
//           INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
//           VALUES (?, ?, ?, ?, 'holiday', ?, ?)
//           ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
//         `;
//         await connection.query(overtimeSQL, [record.id, employeeId, attendanceDate, overtime_hours, record.punch_in, actualPunchTime.toJSDate()]);
//       }
//     } else {
//       // Working day logic - convert shift times from UTC to user's timezone for comparison
//       const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDate}T${record.to_time}`, { zone: 'utc' });
//       const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
//       const earlyDepartureThreshold = shiftEndTime.minus({ minutes: record.punch_out_margin });
//       const overtimeStartTime = shiftEndTime.plus({ minutes: record.overtime_threshold });
      
//       // Convert actual punch time to user's timezone for comparison
//       const actualPunchTimeLocal = actualPunchTime.setZone(timezone);

//       if (actualPunchTimeLocal < earlyDepartureThreshold) {
//         // Early departure - use actual punch out time (already in UTC)
//         is_early_departure = true;
//         effectivePunchOutTime = actualPunchTime;
//       } else if (actualPunchTimeLocal >= earlyDepartureThreshold && actualPunchTimeLocal <= shiftEndTime) {
//         // Within grace period before shift end - set to shift end time (store as UTC)
//         effectivePunchOutTime = shiftEndTimeUTC;
//       } else if (actualPunchTimeLocal > shiftEndTime && actualPunchTimeLocal <= overtimeStartTime) {
//         // After shift end but within overtime threshold - set to shift end time (store as UTC)
//         effectivePunchOutTime = shiftEndTimeUTC;
//       } else {
//         // Beyond overtime threshold - calculate overtime
//         effectivePunchOutTime = actualPunchTime;
//         overtime_hours = parseFloat(actualPunchTimeLocal.diff(shiftEndTime, 'hours').as('hours').toFixed(2));
        
//         if (overtime_hours > 0) {
//           // Overtime starts after the overtime threshold (shift_end + overtime_threshold)
//           const overtimeStartTimeUTC = shiftEndTimeUTC.plus({ minutes: record.overtime_threshold });
          
//           const overtimeSQL = `
//             INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
//             VALUES (?, ?, ?, ?, 'regular', ?, ?)
//             ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'regular', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
//           `;
//           await connection.query(overtimeSQL, [record.id, employeeId, attendanceDate, overtime_hours, overtimeStartTimeUTC.toJSDate(), actualPunchTime.toJSDate()]);
//         }
//       }

//       // Calculate hours worked and determine attendance status
//       hoursWorked = calculateHoursWorked(record.punch_in, effectivePunchOutTime.toJSDate());
//       short_hours = Math.max(0, record.scheduled_hours - hoursWorked);

//       // Apply half-day threshold
//       if (hoursWorked < record.half_day_threshold) {
//         attendance_status = 'Half-Day';
//       }
//     }

//     const updateSql = `
//       UPDATE attendance_record
//       SET punch_out = ?, hours_worked = ?, short_hours = ?, attendance_status = ?, is_early_departure = ?, updated_by = ?
//       WHERE id = ?;
//     `;
//     await connection.query(updateSql, [
//       effectivePunchOutTime.toJSDate(), 
//       hoursWorked, 
//       short_hours, 
//       attendance_status, 
//       is_early_departure, 
//       req.user.id, 
//       record.id
//     ]);

//     await connection.commit();

//     res.status(200).json({
//       message: "Punch out recorded successfully.",
//       hoursWorked,
//       short_hours,
//       attendance_status,
//       is_early_departure,
//       overtime_hours,
//       is_holiday: isHoliday,
//       effective_punch_out: effectivePunchOutTime.setZone(timezone).toISO(),
//       actual_punch_out: actualPunchTime.setZone(timezone).toISO()
//     });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error("Error during punch out:", error);
//     res.status(500).json({ message: "An internal server error occurred." });
//   } finally {
//     if (connection) connection.release();
//   }
// };

const punchOut = async (req, res) => {
  const employeeId = req.body.employee_id || req.user.id;
  let connection;

  try {
    const actualPunchTime = DateTime.fromJSDate(getPunchTime(req));
    const timezone = getTimezone(req);
    
    // ========== FIX 1: FIND RECORD ACROSS MULTIPLE DATES ==========
    // For overnight shifts, the attendance record might be from yesterday
    const actualPunchDate = actualPunchTime.setZone(timezone).toISODate();
    const previousDate = actualPunchTime.setZone(timezone).minus({ days: 1 }).toISODate();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Look for record on both current date AND previous date (for overnight shifts)
    const findRecordSql = `
      SELECT ar.id, ar.punch_in, ar.attendance_date, s.from_time, s.to_time, 
             s.punch_out_margin, s.scheduled_hours, s.half_day_threshold, s.overtime_threshold
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      WHERE ar.employee_id = ? 
        AND ar.attendance_date IN (?, ?) 
        AND ar.punch_out IS NULL
      ORDER BY ar.attendance_date DESC
      LIMIT 1;
    `;
    const [[record]] = await connection.query(findRecordSql, [
      employeeId, 
      actualPunchDate, 
      previousDate
    ]);

    if (!record) {
      await connection.rollback();
      return res.status(400).json({ message: "No active punch-in record found." });
    }

    // Use the attendance_date from the record (not the punch-out date)
    const attendanceDate = record.attendance_date;

    // Check if it's a non-working day
    const isHoliday = await isNonWorkingDay(attendanceDate, connection);

    let effectivePunchOutTime = actualPunchTime;
    let boundedPunchOutTime = actualPunchTime;
    let is_early_departure = false;
    let hoursWorked = 0;
    let short_hours = 0;
    let attendance_status = 'Present';
    let overtime_hours = 0;

    if (isHoliday) {
      // For non-working days, all time is overtime
      effectivePunchOutTime = actualPunchTime;
      boundedPunchOutTime = actualPunchTime;
      hoursWorked = 0;
      overtime_hours = calculateHoursWorked(record.punch_in, actualPunchTime.toJSDate());
      short_hours = 0;
      attendance_status = 'Present';
      
      if (overtime_hours > 0) {
        const overtimeSQL = `
          INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
          VALUES (?, ?, ?, ?, 'holiday', ?, ?)
          ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
        `;
        await connection.query(overtimeSQL, [
          record.id, 
          employeeId, 
          attendanceDate, 
          overtime_hours, 
          record.punch_in, 
          actualPunchTime.toJSDate()
        ]);
      }
    } else {
      // ========== FIX 2: DETECT OVERNIGHT SHIFT ==========
      // Parse punch_in from database to get the actual punch-in date
      const punchInUTC = DateTime.fromJSDate(record.punch_in, { zone: 'utc' });
      const punchInDate = punchInUTC.setZone(timezone).toISODate();
      const punchOutDate = actualPunchTime.setZone(timezone).toISODate();
      
      // Detect overnight shift
      const isOvernightShift = punchInDate !== punchOutDate;

      // ========== FIX 3: BUILD SHIFT END TIME WITH CORRECT DATE ==========
      // Use punch-in date for shift start, punch-out date for shift end
      const shiftStartTimeUTC = DateTime.fromISO(
        `${punchInDate}T${record.from_time}`, 
        { zone: 'utc' }
      );
      
      const shiftEndTimeUTC = DateTime.fromISO(
        `${punchOutDate}T${record.to_time}`, 
        { zone: 'utc' }
      );
      // ========== END FIX ==========

      const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
      const earlyDepartureThreshold = shiftEndTime.minus({ 
        minutes: record.punch_out_margin 
      });
      const overtimeStartTime = shiftEndTime.plus({ 
        minutes: record.overtime_threshold 
      });
      
      const actualPunchTimeLocal = actualPunchTime.setZone(timezone);

      if (actualPunchTimeLocal < earlyDepartureThreshold) {
        // Early departure
        is_early_departure = true;
        effectivePunchOutTime = actualPunchTime;
        boundedPunchOutTime = actualPunchTime;
      } else if (actualPunchTimeLocal <= shiftEndTime) {
        // Within grace period
        effectivePunchOutTime = shiftEndTimeUTC;
        boundedPunchOutTime = shiftEndTimeUTC;
      } else if (actualPunchTimeLocal <= overtimeStartTime) {
        // After shift end but within overtime threshold
        effectivePunchOutTime = shiftEndTimeUTC;
        boundedPunchOutTime = shiftEndTimeUTC;
      } else {
        // Overtime
        effectivePunchOutTime = actualPunchTime;
        boundedPunchOutTime = shiftEndTimeUTC; // Cap for short hours
        overtime_hours = parseFloat(
          actualPunchTimeLocal.diff(shiftEndTime, 'hours').as('hours').toFixed(2)
        );
        
        if (overtime_hours > 0) {
          const overtimeStartTimeUTC = shiftEndTimeUTC.plus({ 
            minutes: record.overtime_threshold 
          });
          
          const overtimeSQL = `
            INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
            VALUES (?, ?, ?, ?, 'regular', ?, ?)
            ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'regular', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
          `;
          await connection.query(overtimeSQL, [
            record.id, 
            employeeId, 
            attendanceDate, 
            overtime_hours, 
            overtimeStartTimeUTC.toJSDate(), 
            actualPunchTime.toJSDate()
          ]);
        }
      }

      // ========== FIX 4: USE BOUNDED TIME FOR SHORT HOURS ==========
      // Calculate actual hours worked (for display)
      hoursWorked = calculateHoursWorked(
        record.punch_in, 
        effectivePunchOutTime.toJSDate()
      );
      
      // Calculate bounded hours (capped at shift end for short hours calculation)
      const boundedHours = calculateHoursWorked(
        record.punch_in,
        boundedPunchOutTime.toJSDate()
      );
      
      // Short hours based on bounded hours (never negative)
      short_hours = Math.max(0, record.scheduled_hours - boundedHours);

      // Apply half-day threshold based on bounded hours
      if (boundedHours < record.half_day_threshold) {
        attendance_status = 'Half-Day';
      }
    }

    const updateSql = `
      UPDATE attendance_record
      SET punch_out = ?, hours_worked = ?, short_hours = ?, attendance_status = ?, is_early_departure = ?, updated_by = ?
      WHERE id = ?;
    `;
    await connection.query(updateSql, [
      effectivePunchOutTime.toJSDate(), 
      hoursWorked, 
      short_hours, 
      attendance_status, 
      is_early_departure, 
      req.user.id, 
      record.id
    ]);

    await connection.commit();

    res.status(200).json({
      message: "Punch out recorded successfully.",
      hoursWorked,
      short_hours,
      attendance_status,
      is_early_departure,
      overtime_hours,
      is_holiday: isHoliday,
      effective_punch_out: effectivePunchOutTime.setZone(timezone).toISO(),
      actual_punch_out: actualPunchTime.setZone(timezone).toISO(),
      attendance_date: attendanceDate // Include for debugging
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error during punch out:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = {
  punchIn,
  punchOut,
};