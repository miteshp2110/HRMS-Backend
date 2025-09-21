// const { pool } = require("../../db/connector");
// const { DateTime } = require("luxon");

// const calculateHoursWorked = (punchIn, punchOut) => {
//   if (!punchIn || !punchOut) return 0;
//   const diffMs = new Date(punchOut).getTime() - new Date(punchIn).getTime();
//   const diffHours = diffMs / (1000 * 60 * 60);
//   return parseFloat(diffHours.toFixed(2));
// };

// /**
//  * @description Determines the punch time based on environment.
//  * In production, it uses the current server time.
//  * In testing/development, it uses the time_local and timezone from the request body.
//  * @returns {Date} The official punch time as a JavaScript Date object.
//  */
// const getPunchTime = (req) => {
//   if (process.env.NODE_ENV !== 'production' && req.body.time_local && req.body.timezone) {
//     // --- Testing Mode ---
//     const { time_local, timezone } = req.body;
//     // Convert the local time from the specified timezone into a valid Date object
//     return DateTime.fromFormat(time_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toJSDate();
//   } else {
//     // --- Production Mode ---
//     // Use the server's current time
//     return new Date();
//   }
// };

// const punchIn = async (req, res) => {
//   let employeeId = req.user.id;
//   if(req.body.employee_id){
//     employeeId = req.body.employee_id;
//   }
//   let connection;
//   try {
//     // Get the official punch time based on the environment
//     const actualPunchTimeObject = getPunchTime(req);
//     const time = actualPunchTimeObject.toISOString(); // Convert to UTC string for consistent processing
  

//     connection = await pool.getConnection();
//     const attendanceDate = time.split("T")[0];

//     const [existing] = await connection.query(
//         "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
//         [employeeId,attendanceDate]
//     );
//     if (existing.length > 0) {
//         return res.status(409).json({ message: 'You have an open punch-in record. Please punch out first.' });
//     }

//     const [[user]] = await connection.query("SELECT shift FROM user WHERE id = ?", [employeeId]);
//     if (!user || !user.shift) {
//       return res.status(400).json({ message: "You are not assigned to a shift." });
//     }
//     const shiftId = user.shift;

//     const [[shift]] = await connection.query(
//       "SELECT from_time, punch_in_margin FROM shifts WHERE id = ?",
//       [shiftId]
//     );
//     if (!shift) {
//       return res.status(400).json({ message: "Assigned shift not found." });
//     }

//     const actualPunchInTime = new Date(time);
//     let effectivePunchInTime = actualPunchInTime;
//     let attendanceStatus = "present";
    
//     const shiftStartTime = new Date(`${attendanceDate}T${shift.from_time}Z`);
//     // console.log("actual punch in time: ",actualPunchInTime)
//     // console.log("shiftStartTime: ",shiftStartTime)
//     const marginLimitTime = new Date(
//       shiftStartTime.getTime() + (shift.punch_in_margin || 0) * 60000
//     );
//     // console.log("margin time limit: ",marginLimitTime)

//     if (actualPunchInTime > shiftStartTime) {
//       if (actualPunchInTime <= marginLimitTime) {
//         effectivePunchInTime = shiftStartTime;
//       } else {
//         attendanceStatus = "late";
//       }
//     }
//     else{
//       if(actualPunchInTime<=shiftStartTime){
//         effectivePunchInTime=shiftStartTime
//       }
//     }

//     // console.log("effective punchin time: ",effectivePunchInTime)
//     const sql = `
//       INSERT INTO attendance_record (
//         employee_id, attendance_date, shift, punch_in, attendance_status
//       ) VALUES (?, ?, ?, ?, ?)
//     `;
//     await connection.query(sql, [
//       employeeId,
//       attendanceDate,
//       shiftId,
//       effectivePunchInTime,
//       attendanceStatus,
//     ]);

//     res.status(200).json({ message: "Punch in recorded", attendanceStatus });
//   } catch (error) {
//     console.error("Error during punch in:", error);
//     res.status(500).json({ message: "Internal server error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// const punchOut = async (req, res) => {
//   let employeeId = req.user.id;
//   if(req.body.employee_id){
//     employeeId = req.body.employee_id
//   }
  
//   let connection;
//   try {
//   // Get the official punch time based on the environment
//     const actualPunchTimeObject = getPunchTime(req);
//     const time = actualPunchTimeObject.toISOString(); // Convert to UTC string

//     connection = await pool.getConnection();

//     const findRecordSql = `
//       SELECT ar.id, ar.punch_in,ar.attendance_status, s.to_time, s.punch_out_margin, s.from_time, (s.to_time - s.from_time) as shift_duration, half_day_threshold
//       FROM attendance_record ar
//       JOIN shifts s ON ar.shift = s.id
//       WHERE ar.employee_id = ? AND ar.punch_out IS NULL and ar.punch_in IS NOT NULL
//     `;
//     const [[attendance]] = await connection.query(findRecordSql, [employeeId]);
//     if (!attendance) {
//       return res.status(400).json({ message: "Punch in required first" });
//     }
  
//     const shift_duration = attendance.shift_duration/10000
//     const half_day_threshold = attendance.half_day_threshold
//     let attendance_status = attendance.attendance_status
    


//     const actualPunchOutTime = new Date(time);
//     let effectivePunchOutTime = actualPunchOutTime;

//     const punchInDate = new Date(attendance.punch_in);
//     const shiftDate = punchInDate.toISOString().split("T")[0];
    
//     let shiftEndTime = new Date(`${shiftDate}T${attendance.to_time}Z`);
//     if (attendance.from_time > attendance.to_time) {
//       shiftEndTime.setDate(shiftEndTime.getDate() + 1);
//     }
    
//     const marginLimitTime = new Date(
//       shiftEndTime.getTime() + (attendance.punch_out_margin || 0) * 60000
//     );

//     if (actualPunchOutTime > shiftEndTime && actualPunchOutTime <= marginLimitTime) {
//       effectivePunchOutTime = shiftEndTime;
//     }

//     const hoursWorked = calculateHoursWorked(attendance.punch_in, effectivePunchOutTime);

//     let pay_type =null
  
//     if((attendance_status ==='present' || attendance_status==='late')){
//       if(hoursWorked < shift_duration){
//         if(hoursWorked<half_day_threshold){
//           pay_type='unpaid'
//         }
//         else{
//           pay_type='half_day'
//         }
//       }else{
//         if(hoursWorked == shift_duration){
//           pay_type='full_day'
//         }
//         else{
//           pay_type ='overtime'
//         }
//       }
//     }

//     if(pay_type!==''){
//       await connection.query(
//       `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, pay_type =?,  updated_at = NOW() WHERE id = ?`,
//       [effectivePunchOutTime, hoursWorked,pay_type,attendance.id]
//     );
//     }
//     else{
//       await connection.query(
//       `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, updated_at = NOW() WHERE id = ?`,
//       [effectivePunchOutTime, hoursWorked,attendance.id]
//     );
//     }
    

    

//     res.status(200).json({
//       message: "Punch out recorded",
//       hoursWorked,
//     });
//   } catch (error) {
//     console.error("Error during punch out:", error);
//     res.status(500).json({ message: "Internal server error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = {
//   punchIn,
//   punchOut,
// };




// const { pool } = require("../../db/connector");
// const { DateTime } = require("luxon");

// const calculateHoursWorked = (punchIn, punchOut) => {
//   if (!punchIn || !punchOut) return 0;
//   const diffMs = new Date(punchOut).getTime() - new Date(punchIn).getTime();
//   const diffHours = diffMs / (1000 * 60 * 60);
//   return parseFloat(diffHours.toFixed(2));
// };


// const getPunchTime = (req) => {
//   if (process.env.NODE_ENV !== 'production' && req.body.time_local && req.body.timezone) {
//     const { time_local, timezone } = req.body;
//     return DateTime.fromFormat(time_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toJSDate();
//   } else {
//     return new Date();
//   }
// };

// const punchIn = async (req, res) => {
//   let employeeId = req.user.id;
//   if(req.body.employee_id){
//     employeeId = req.body.employee_id;
//   }
//   let connection;
//   try {
//     const actualPunchTimeObject = getPunchTime(req);
//     const time = actualPunchTimeObject.toISOString();


//     connection = await pool.getConnection();
//     const attendanceDate = time.split("T")[0];

//     const [existing] = await connection.query(
//         "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
//         [employeeId,attendanceDate]
//     );
//     if (existing.length > 0) {
//         return res.status(409).json({ message: 'You have an open punch-in record. Please punch out first.' });
//     }

//     const [[user]] = await connection.query("SELECT shift FROM user WHERE id = ?", [employeeId]);
//     if (!user || !user.shift) {
//       return res.status(400).json({ message: "You are not assigned to a shift." });
//     }
//     const shiftId = user.shift;

//     const [[shift]] = await connection.query(
//       "SELECT from_time, punch_in_margin FROM shifts WHERE id = ?",
//       [shiftId]
//     );
//     if (!shift) {
//       return res.status(400).json({ message: "Assigned shift not found." });
//     }

//     const actualPunchInTime = new Date(time);
//     let effectivePunchInTime = actualPunchInTime;
//     let attendanceStatus = "present";

//     const shiftStartTime = new Date(`${attendanceDate}T${shift.from_time}Z`);

//     const marginLimitTime = new Date(
//       shiftStartTime.getTime() + (shift.punch_in_margin || 0) * 60000
//     );


//     if (actualPunchInTime < shiftStartTime) {
//         effectivePunchInTime = shiftStartTime;
//     }
//     else if (actualPunchInTime > shiftStartTime) {
//       if (actualPunchInTime <= marginLimitTime) {
//         effectivePunchInTime = shiftStartTime;
//       } else {
//         attendanceStatus = "late";
//       }
//     }


//     const sql = `
//       INSERT INTO attendance_record (
//         employee_id, attendance_date, shift, punch_in, attendance_status, updated_by
//       ) VALUES (?, ?, ?, ?, ?, ?)
//     `;
//     await connection.query(sql, [
//       employeeId,
//       attendanceDate,
//       shiftId,
//       effectivePunchInTime,
//       attendanceStatus,
//       req.user.id
//     ]);

//     res.status(200).json({ message: "Punch in recorded", attendanceStatus });
//   } catch (error) {
//     console.error("Error during punch in:", error);
//     res.status(500).json({ message: "Internal server error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// const punchOut = async (req, res) => {
//   let employeeId = req.user.id;
//   if(req.body.employee_id){
//     employeeId = req.body.employee_id
//   }

//   let connection;
//   try {
//     const actualPunchTimeObject = getPunchTime(req);
//     const time = actualPunchTimeObject.toISOString();

//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const findRecordSql = `
//       SELECT ar.id, ar.punch_in,ar.attendance_status, s.to_time, s.punch_out_margin,s.overtime_threshold, s.from_time, TIMEDIFF(s.to_time, s.from_time) as shift_duration, half_day_threshold
//       FROM attendance_record ar
//       JOIN shifts s ON ar.shift = s.id
//       WHERE ar.employee_id = ? AND ar.punch_out IS NULL and ar.punch_in IS NOT NULL
//     `;
//     const [[attendance]] = await connection.query(findRecordSql, [employeeId]);
//     if (!attendance) {
//       await connection.rollback();
//       return res.status(400).json({ message: "Punch in required first" });
//     }
//     const shift_duration_parts = attendance.shift_duration.split(':');
//     const shift_duration = parseInt(shift_duration_parts[0], 10);
//     const half_day_threshold = attendance.half_day_threshold
//     const overtime_threshold = attendance.overtime_threshold

//     let attendance_status = attendance.attendance_status
//     let short_hours = 0;


//     const actualPunchOutTime = new Date(time);
//     let effectivePunchOutTime = actualPunchOutTime;

//     const punchInDate = new Date(attendance.punch_in);
//     const shiftDate = punchInDate.toISOString().split("T")[0];

//     let shiftEndTime = new Date(`${shiftDate}T${attendance.to_time}Z`);
//     if (attendance.from_time > attendance.to_time) {
//       shiftEndTime.setDate(shiftEndTime.getDate() + 1);
//     }

//     const marginLimitTime = new Date(
//       shiftEndTime.getTime() - (attendance.punch_out_margin || 0) * 60000
//     );
    
//     const overtimeLimitTime = new Date(
//       shiftEndTime.getTime() + (overtime_threshold || 0) * 60000
//     );

//     if(actualPunchOutTime < marginLimitTime){
//         attendance_status = "early_departure";
//     }
//     else if(actualPunchOutTime > shiftEndTime && actualPunchOutTime <= overtimeLimitTime){
//         effectivePunchOutTime = shiftEndTime;
//     }


//     const hoursWorked = calculateHoursWorked(attendance.punch_in, effectivePunchOutTime);



//     if((attendance_status ==='present' || attendance_status==='late' || attendance_status === 'early_departure')){
//         if(hoursWorked < shift_duration){
//             short_hours = shift_duration - hoursWorked;
//             if(hoursWorked<half_day_threshold){
//               attendance_status='absent'
//             }
//             else{
//               attendance_status='half_day'
//             }
//         }
//         else{
//             if(hoursWorked > shift_duration){
//                 const overtime_hours =  hoursWorked - shift_duration;
//                 const overtimeSQL = 'INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, approved_hours) VALUES (?, ?, ?, ?, ?)';
//                 await connection.query(overtimeSQL, [attendance.id, employeeId, new Date(), overtime_hours, 0]);
//             }
//         }
//     }

//     await connection.query(
//     `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, attendance_status = ?, short_hours = ? , updated_at = NOW(), updated_by = ? WHERE id = ?`,
//     [effectivePunchOutTime, hoursWorked,attendance_status,short_hours, req.user.id, attendance.id]
//     );

//     await connection.commit();

//     res.status(200).json({
//       message: "Punch out recorded",
//       hoursWorked,
//     });
//   } catch (error) {
//     if(connection) await connection.rollback();
//     console.error("Error during punch out:", error);
//     res.status(500).json({ message: "Internal server error" });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = {
//   punchIn,
//   punchOut,
// };


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
const getPunchTime = (req) => {
  if (process.env.NODE_ENV !== 'production' && req.body.time_local && req.body.timezone) {
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
const punchOut = async (req, res) => {
  const employeeId = req.body.employee_id || req.user.id;
  let connection;

  try {
    const actualPunchTime = DateTime.fromJSDate(getPunchTime(req));
    const timezone = getTimezone(req);
    const attendanceDate = actualPunchTime.setZone(timezone).toISODate();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check if it's a non-working day
    const isHoliday = await isNonWorkingDay(attendanceDate, connection);

    const findRecordSql = `
      SELECT ar.id, ar.punch_in, s.to_time, s.punch_out_margin, s.scheduled_hours, s.half_day_threshold, s.overtime_threshold
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      WHERE ar.employee_id = ? AND ar.attendance_date = ? AND ar.punch_out IS NULL;
    `;
    const [[record]] = await connection.query(findRecordSql, [employeeId, attendanceDate]);

    if (!record) {
      await connection.rollback();
      return res.status(400).json({ message: "No active punch-in record found for today." });
    }

    let effectivePunchOutTime = actualPunchTime;
    let is_early_departure = false;
    let hoursWorked = 0;
    let short_hours = 0;
    let attendance_status = 'Present';
    let overtime_hours = 0;

    if (isHoliday) {
      // For non-working days, all time is overtime
      effectivePunchOutTime = actualPunchTime;
      hoursWorked = 0; // No regular hours worked
      overtime_hours = calculateHoursWorked(record.punch_in, actualPunchTime.toJSDate());
      short_hours = 0;
      attendance_status = 'Present';
      
      // Record holiday overtime
      if (overtime_hours > 0) {
        const overtimeSQL = `
          INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
          VALUES (?, ?, ?, ?, 'holiday', ?, ?)
          ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
        `;
        await connection.query(overtimeSQL, [record.id, employeeId, attendanceDate, overtime_hours, record.punch_in, actualPunchTime.toJSDate()]);
      }
    } else {
      // Working day logic - convert shift times from UTC to user's timezone for comparison
      const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDate}T${record.to_time}`, { zone: 'utc' });
      const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
      const earlyDepartureThreshold = shiftEndTime.minus({ minutes: record.punch_out_margin });
      const overtimeStartTime = shiftEndTime.plus({ minutes: record.overtime_threshold });
      
      // Convert actual punch time to user's timezone for comparison
      const actualPunchTimeLocal = actualPunchTime.setZone(timezone);

      if (actualPunchTimeLocal < earlyDepartureThreshold) {
        // Early departure - use actual punch out time (already in UTC)
        is_early_departure = true;
        effectivePunchOutTime = actualPunchTime;
      } else if (actualPunchTimeLocal >= earlyDepartureThreshold && actualPunchTimeLocal <= shiftEndTime) {
        // Within grace period before shift end - set to shift end time (store as UTC)
        effectivePunchOutTime = shiftEndTimeUTC;
      } else if (actualPunchTimeLocal > shiftEndTime && actualPunchTimeLocal <= overtimeStartTime) {
        // After shift end but within overtime threshold - set to shift end time (store as UTC)
        effectivePunchOutTime = shiftEndTimeUTC;
      } else {
        // Beyond overtime threshold - calculate overtime
        effectivePunchOutTime = actualPunchTime;
        overtime_hours = parseFloat(actualPunchTimeLocal.diff(shiftEndTime, 'hours').as('hours').toFixed(2));
        
        if (overtime_hours > 0) {
          // Overtime starts after the overtime threshold (shift_end + overtime_threshold)
          const overtimeStartTimeUTC = shiftEndTimeUTC.plus({ minutes: record.overtime_threshold });
          
          const overtimeSQL = `
            INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
            VALUES (?, ?, ?, ?, 'regular', ?, ?)
            ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'regular', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
          `;
          await connection.query(overtimeSQL, [record.id, employeeId, attendanceDate, overtime_hours, overtimeStartTimeUTC.toJSDate(), actualPunchTime.toJSDate()]);
        }
      }

      // Calculate hours worked and determine attendance status
      hoursWorked = calculateHoursWorked(record.punch_in, effectivePunchOutTime.toJSDate());
      short_hours = Math.max(0, record.scheduled_hours - hoursWorked);

      // Apply half-day threshold
      if (hoursWorked < record.half_day_threshold) {
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
      actual_punch_out: actualPunchTime.setZone(timezone).toISO()
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