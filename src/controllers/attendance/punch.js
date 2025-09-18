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




const { pool } = require("../../db/connector");
const { DateTime } = require("luxon");

const calculateHoursWorked = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  const diffMs = new Date(punchOut).getTime() - new Date(punchIn).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return parseFloat(diffHours.toFixed(2));
};


const getPunchTime = (req) => {
  if (process.env.NODE_ENV !== 'production' && req.body.time_local && req.body.timezone) {
    const { time_local, timezone } = req.body;
    return DateTime.fromFormat(time_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toJSDate();
  } else {
    return new Date();
  }
};

const punchIn = async (req, res) => {
  let employeeId = req.user.id;
  if(req.body.employee_id){
    employeeId = req.body.employee_id;
  }
  let connection;
  try {
    const actualPunchTimeObject = getPunchTime(req);
    const time = actualPunchTimeObject.toISOString();


    connection = await pool.getConnection();
    const attendanceDate = time.split("T")[0];

    const [existing] = await connection.query(
        "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
        [employeeId,attendanceDate]
    );
    if (existing.length > 0) {
        return res.status(409).json({ message: 'You have an open punch-in record. Please punch out first.' });
    }

    const [[user]] = await connection.query("SELECT shift FROM user WHERE id = ?", [employeeId]);
    if (!user || !user.shift) {
      return res.status(400).json({ message: "You are not assigned to a shift." });
    }
    const shiftId = user.shift;

    const [[shift]] = await connection.query(
      "SELECT from_time, punch_in_margin FROM shifts WHERE id = ?",
      [shiftId]
    );
    if (!shift) {
      return res.status(400).json({ message: "Assigned shift not found." });
    }

    const actualPunchInTime = new Date(time);
    let effectivePunchInTime = actualPunchInTime;
    let attendanceStatus = "present";

    const shiftStartTime = new Date(`${attendanceDate}T${shift.from_time}Z`);

    const marginLimitTime = new Date(
      shiftStartTime.getTime() + (shift.punch_in_margin || 0) * 60000
    );


    if (actualPunchInTime < shiftStartTime) {
        effectivePunchInTime = shiftStartTime;
    }
    else if (actualPunchInTime > shiftStartTime) {
      if (actualPunchInTime <= marginLimitTime) {
        effectivePunchInTime = shiftStartTime;
      } else {
        attendanceStatus = "late";
      }
    }


    const sql = `
      INSERT INTO attendance_record (
        employee_id, attendance_date, shift, punch_in, attendance_status, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    await connection.query(sql, [
      employeeId,
      attendanceDate,
      shiftId,
      effectivePunchInTime,
      attendanceStatus,
      req.user.id
    ]);

    res.status(200).json({ message: "Punch in recorded", attendanceStatus });
  } catch (error) {
    console.error("Error during punch in:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const punchOut = async (req, res) => {
  let employeeId = req.user.id;
  if(req.body.employee_id){
    employeeId = req.body.employee_id
  }

  let connection;
  try {
    const actualPunchTimeObject = getPunchTime(req);
    const time = actualPunchTimeObject.toISOString();

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const findRecordSql = `
      SELECT ar.id, ar.punch_in,ar.attendance_status, s.to_time, s.punch_out_margin,s.overtime_threshold, s.from_time, TIMEDIFF(s.to_time, s.from_time) as shift_duration, half_day_threshold
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      WHERE ar.employee_id = ? AND ar.punch_out IS NULL and ar.punch_in IS NOT NULL
    `;
    const [[attendance]] = await connection.query(findRecordSql, [employeeId]);
    if (!attendance) {
      await connection.rollback();
      return res.status(400).json({ message: "Punch in required first" });
    }
    const shift_duration_parts = attendance.shift_duration.split(':');
    const shift_duration = parseInt(shift_duration_parts[0], 10);
    const half_day_threshold = attendance.half_day_threshold
    const overtime_threshold = attendance.overtime_threshold

    let attendance_status = attendance.attendance_status
    let short_hours = 0;


    const actualPunchOutTime = new Date(time);
    let effectivePunchOutTime = actualPunchOutTime;

    const punchInDate = new Date(attendance.punch_in);
    const shiftDate = punchInDate.toISOString().split("T")[0];

    let shiftEndTime = new Date(`${shiftDate}T${attendance.to_time}Z`);
    if (attendance.from_time > attendance.to_time) {
      shiftEndTime.setDate(shiftEndTime.getDate() + 1);
    }

    const marginLimitTime = new Date(
      shiftEndTime.getTime() - (attendance.punch_out_margin || 0) * 60000
    );
    
    const overtimeLimitTime = new Date(
      shiftEndTime.getTime() + (overtime_threshold || 0) * 60000
    );

    if(actualPunchOutTime < marginLimitTime){
        attendance_status = "early_departure";
    }
    else if(actualPunchOutTime > shiftEndTime && actualPunchOutTime <= overtimeLimitTime){
        effectivePunchOutTime = shiftEndTime;
    }


    const hoursWorked = calculateHoursWorked(attendance.punch_in, effectivePunchOutTime);



    if((attendance_status ==='present' || attendance_status==='late' || attendance_status === 'early_departure')){
        if(hoursWorked < shift_duration){
            short_hours = shift_duration - hoursWorked;
            if(hoursWorked<half_day_threshold){
              attendance_status='absent'
            }
            else{
              attendance_status='half_day'
            }
        }
        else{
            if(hoursWorked > shift_duration){
                const overtime_hours =  hoursWorked - shift_duration;
                const overtimeSQL = 'INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, approved_hours) VALUES (?, ?, ?, ?, ?)';
                await connection.query(overtimeSQL, [attendance.id, employeeId, new Date(), overtime_hours, 0]);
            }
        }
    }

    await connection.query(
    `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, attendance_status = ?, short_hours = ? , updated_at = NOW(), updated_by = ? WHERE id = ?`,
    [effectivePunchOutTime, hoursWorked,attendance_status,short_hours, req.user.id, attendance.id]
    );

    await connection.commit();

    res.status(200).json({
      message: "Punch out recorded",
      hoursWorked,
    });
  } catch (error) {
    if(connection) await connection.rollback();
    console.error("Error during punch out:", error);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  punchIn,
  punchOut,
};