

// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// // Helper function to calculate hours worked from JS Date objects
// const calculateHoursWorked = (punchIn, punchOut) => {
//     if (!punchIn || !punchOut) return 0;
//     const diffMs = new Date(punchOut).getTime() - new Date(punchIn).getTime();
//     const diffHours = diffMs / (1000 * 60 * 60);
//     return parseFloat(diffHours.toFixed(2));
// };

// // Helper function to check for holidays
// const isNonWorkingDay = async (attendanceDate, connection) => {
//   const date = new Date(attendanceDate);
//   const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
  
//   const [[holiday]] = await connection.query(
//     "SELECT id FROM holidays WHERE holiday_date = ?", 
//     [DateTime.fromJSDate(date).toISODate()]
//   );
//   if (holiday) {
//     return true;
//   }
  
//   const [[workDay]] = await connection.query(
//     "SELECT is_working_day FROM work_week WHERE day_of_week = ?", 
//     [dayOfWeek]
//   );
  
//   if (workDay && !workDay.is_working_day) {
//     return true;
//   }
  
//   return false;
// };

// /**
//  * @description [Admin] Updates an attendance record, automatically calculating hours, flags, overtime, and requiring a reason.
//  */
// const updateAttendanceRecord = async (req, res) => {
//   const { recordId } = req.params;
//   const { 
//     attendance_status,
//     punch_in,
//     punch_out,
//     timezone,
//     update_reason 
//   } = req.body; // Removed is_late and is_early_departure from request body
//   const updatedById = req.user.id;

//   if (!update_reason) {
//     return res.status(400).json({ message: 'An update reason is required.' });
//   }
  
//   // If punch times are provided (or status implies they are needed), timezone is required.
//   const requiresTimes = (attendance_status === 'Present' || attendance_status === 'Half-Day' || punch_in || punch_out);
//   const isLeaveOrAbsent = (attendance_status === 'Absent' || attendance_status === 'Leave');

//   if (requiresTimes && !isLeaveOrAbsent && !timezone) {
//     return res.status(400).json({ message: 'A timezone is required when providing punch_in, punch_out, or setting status to Present/Half-Day.' });
//   }

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     // 1. Get current record and FULL shift details including margins
//     const [[currentRecord]] = await connection.query(`
//       SELECT 
//         ar.id, ar.employee_id, ar.attendance_date, 
//         ar.punch_in as current_punch_in, ar.punch_out as current_punch_out, 
//         s.scheduled_hours, s.from_time, s.to_time, s.half_day_threshold, 
//         s.overtime_threshold, s.punch_in_margin, s.punch_out_margin
//       FROM attendance_record ar
//       JOIN shifts s ON ar.shift = s.id
//       WHERE ar.id = ?
//     `, [recordId]);

//     if (!currentRecord) {
//       await connection.rollback();
//       return res.status(404).json({ message: 'Attendance record not found.' });
//     }

//     // Use a new object for our final SET clauses
//     const updateFields = {};

//     // --- Conditional Logic based on attendance_status ---
//     if (attendance_status === 'Absent' || attendance_status === 'Leave') {
//       updateFields.punch_in = null;
//       updateFields.punch_out = null;
//       updateFields.hours_worked = 0;
//       updateFields.short_hours = currentRecord.scheduled_hours;
//       updateFields.is_late = false;
//       updateFields.is_early_departure = false;
//       updateFields.attendance_status = attendance_status;

//       // Delete any existing overtime record for this day
//       await connection.query('DELETE FROM employee_overtime_records WHERE attendance_record_id = ?', [recordId]);

//     } else {
//         // Handle "Present", "Half-Day", or just punch time updates
        
//         // Convert incoming local times to UTC DateTime objects
//         const finalPunchIn = punch_in 
//             ? DateTime.fromISO(punch_in, { zone: timezone }).toUTC() 
//             : (currentRecord.current_punch_in ? DateTime.fromJSDate(currentRecord.current_punch_in, { zone: 'utc' }) : null);

//         const finalPunchOut = punch_out 
//             ? DateTime.fromISO(punch_out, { zone: timezone }).toUTC() 
//             : (currentRecord.current_punch_out ? DateTime.fromJSDate(currentRecord.current_punch_out, { zone: 'utc' }) : null);

//         if (!finalPunchIn || !finalPunchOut) {
//             await connection.rollback();
//             return res.status(400).json({ message: 'Validation failed', errors: ['Punch-in and punch-out times are required for "Present" or "Half-Day" status.'] });
//         }

//         if (finalPunchOut < finalPunchIn) {
//             await connection.rollback();
//             return res.status(400).json({ message: 'Validation failed', errors: ['Punch out time must be after punch in time'] });
//         }

//         // --- Automatic Flag Calculation ---
//         const isHoliday = await isNonWorkingDay(currentRecord.attendance_date, connection);
//         const attendanceDateISO = DateTime.fromJSDate(currentRecord.attendance_date).toISODate();

//         if (isHoliday) {
//             updateFields.is_late = false;
//             updateFields.is_early_departure = false;
//         } else {
//             // Calculate is_late
//             const shiftStartTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.from_time}`, { zone: 'utc' });
//             const gracePeriodEnd = shiftStartTimeUTC.plus({ minutes: currentRecord.punch_in_margin });
//             updateFields.is_late = finalPunchIn > gracePeriodEnd;

//             // Calculate is_early_departure
//             const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.to_time}`, { zone: 'utc' });
//             const earlyDepartureThreshold = shiftEndTimeUTC.minus({ minutes: currentRecord.punch_out_margin });
//             updateFields.is_early_departure = finalPunchOut < earlyDepartureThreshold;
//         }

//         // Calculate hours based on final UTC times
//         const hoursWorked = calculateHoursWorked(finalPunchIn.toJSDate(), finalPunchOut.toJSDate());
//         updateFields.hours_worked = parseFloat(hoursWorked.toFixed(2));
//         updateFields.short_hours = isHoliday ? 0 : Math.max(0, parseFloat(currentRecord.scheduled_hours) - hoursWorked).toFixed(2);
        
//         if(punch_in) updateFields.punch_in = finalPunchIn.toJSDate();
//         if(punch_out) updateFields.punch_out = finalPunchOut.toJSDate();

//         // Determine status if not explicitly provided
//         let final_attendance_status = 'Present'; // Default
//         if (attendance_status) {
//             final_attendance_status = attendance_status; // Use provided status
//         } else {
//             // Calculate status if not provided
//             if (!isHoliday && hoursWorked < currentRecord.half_day_threshold) {
//                 final_attendance_status = 'Half-Day';
//             }
//         }
//         updateFields.attendance_status = final_attendance_status;


//         // --- Overtime Calculation Logic ---
//         let overtime_hours = 0;
//         let overtime_type = 'regular';
//         let overtime_start_time_utc = null;

//         // Use the raw, non-grace-period-adjusted punch times for OT calculation
//         const actualPunchInUTC = punch_in ? DateTime.fromISO(punch_in, { zone: timezone }).toUTC() : (currentRecord.current_punch_in ? DateTime.fromJSDate(currentRecord.current_punch_in, { zone: 'utc' }) : null);
//         const actualPunchOutUTC = punch_out ? DateTime.fromISO(punch_out, { zone: timezone }).toUTC() : (currentRecord.current_punch_out ? DateTime.fromJSDate(currentRecord.current_punch_out, { zone: 'utc' }) : null);

//         if (actualPunchInUTC && actualPunchOutUTC) {
//             if (isHoliday) {
//                 overtime_hours = calculateHoursWorked(actualPunchInUTC.toJSDate(), actualPunchOutUTC.toJSDate());
//                 overtime_type = 'holiday';
//                 overtime_start_time_utc = actualPunchInUTC;
//             } else {
//                 const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.to_time}`, { zone: 'utc' });
//                 const overtimeThresholdTime = shiftEndTimeUTC.plus({ minutes: currentRecord.overtime_threshold });

//                 if (actualPunchOutUTC > overtimeThresholdTime) {
//                     overtime_hours = parseFloat(actualPunchOutUTC.diff(shiftEndTimeUTC, 'hours').as('hours').toFixed(2));
//                     overtime_type = 'regular';
//                     overtime_start_time_utc = shiftEndTimeUTC; // OT starts from shift end
//                 }
//             }
//         }

//         if (overtime_hours > 0) {
//             // Overtime exists: create or update the record
//             const overtimeSQL = `
//                 INSERT INTO employee_overtime_records (
//                     attendance_record_id, employee_id, request_date, overtime_hours,
//                     overtime_type, overtime_start, overtime_end, reason, status
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval')
//                 ON DUPLICATE KEY UPDATE
//                     overtime_hours = VALUES(overtime_hours), overtime_type = VALUES(overtime_type),
//                     overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end),
//                     reason = VALUES(reason), status = 'pending_approval',
//                     processed_by = NULL, processed_at = NULL, rejection_reason = NULL;
//             `;
//             await connection.query(overtimeSQL, [
//                 recordId, currentRecord.employee_id, currentRecord.attendance_date, overtime_hours,
//                 overtime_type, overtime_start_time_utc.toJSDate(), actualPunchOutUTC.toJSDate(), update_reason
//             ]);
//         } else {
//             // No overtime: delete any existing OT record
//             await connection.query('DELETE FROM employee_overtime_records WHERE attendance_record_id = ?', [recordId]);
//         }
//     } // End of Present/Half-Day logic

//     // --- Build and Execute Update Query ---
//     const updateClauses = [];
//     const updateValues = [];

//     Object.entries(updateFields).forEach(([key, value]) => {
//         if (value !== undefined) {
//             updateClauses.push(`${key} = ?`);
//             updateValues.push(value);
//         }
//     });
    
//     if (updateClauses.length === 0) {
//         await connection.rollback();
//         return res.status(400).json({ message: 'No valid fields to update provided.' });
//     }

//     updateClauses.push('update_reason = ?', 'updated_by = ?');
//     updateValues.push(update_reason, updatedById, recordId);

//     const updateSql = `UPDATE attendance_record SET ${updateClauses.join(', ')} WHERE id = ?`;
//     const [result] = await connection.query(updateSql, updateValues);

//     if (result.affectedRows === 0) {
//       await connection.rollback();
//       return res.status(404).json({ message: 'Attendance record not found or no changes made.' });
//     }

//     await connection.commit();

//     res.status(200).json({
//       success: true,
//       message: 'Attendance record updated successfully.',
//     });

//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error('Error updating attendance record:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = {
//   updateAttendanceRecord
// };


const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');


// Helper function to calculate hours worked from JS Date objects or DateTime objects
const calculateHoursWorked = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;
  
  // Convert to DateTime if they're Date objects
  const start = punchIn instanceof Date ? DateTime.fromJSDate(punchIn, { zone: "utc" }) : punchIn;
  const end = punchOut instanceof Date ? DateTime.fromJSDate(punchOut, { zone: "utc" }) : punchOut;
  
  const diff = end.diff(start, "hours");
  return parseFloat(diff.as("hours").toFixed(2));
};


// Helper function to check for holidays
const isNonWorkingDay = async (attendanceDate, connection) => {
  const date = new Date(attendanceDate);
  const dayOfWeek = date.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
  
  const [[holiday]] = await connection.query(
    "SELECT id FROM holidays WHERE holiday_date = ?", 
    [DateTime.fromJSDate(date).toISODate()]
  );
  if (holiday) {
    return true;
  }
  
  const [[workDay]] = await connection.query(
    "SELECT is_working_day FROM work_week WHERE day_of_week = ?", 
    [dayOfWeek]
  );
  
  if (workDay && !workDay.is_working_day) {
    return true;
  }
  
  return false;
};


/**
 * @description [Admin] Updates an attendance record, automatically calculating hours, flags, overtime, and requiring a reason.
 */
const updateAttendanceRecord = async (req, res) => {
  const { recordId } = req.params;
  const { 
    attendance_status,
    punch_in,
    punch_out,
    timezone,
    update_reason 
  } = req.body;
  const updatedById = req.user.id;


  if (!update_reason) {
    return res.status(400).json({ message: 'An update reason is required.' });
  }
  
  const requiresTimes = (attendance_status === 'Present' || attendance_status === 'Half-Day' || punch_in || punch_out);
  const isLeaveOrAbsent = (attendance_status === 'Absent' || attendance_status === 'Leave');


  if (requiresTimes && !isLeaveOrAbsent && !timezone) {
    return res.status(400).json({ message: 'A timezone is required when providing punch_in, punch_out, or setting status to Present/Half-Day.' });
  }


  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();


    // 1. Get current record and FULL shift details including margins
    const [[currentRecord]] = await connection.query(`
      SELECT 
        ar.id, ar.employee_id, ar.attendance_date, 
        ar.punch_in as current_punch_in, ar.punch_out as current_punch_out, 
        s.scheduled_hours, s.from_time, s.to_time, s.half_day_threshold, 
        s.overtime_threshold, s.punch_in_margin, s.punch_out_margin
      FROM attendance_record ar
      JOIN shifts s ON ar.shift = s.id
      WHERE ar.id = ?
    `, [recordId]);


    if (!currentRecord) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found.' });
    }


    const updateFields = {};


    // --- Conditional Logic based on attendance_status ---
    if (attendance_status === 'Absent' || attendance_status === 'Leave') {
      updateFields.punch_in = null;
      updateFields.punch_out = null;
      updateFields.hours_worked = 0;
      updateFields.short_hours = currentRecord.scheduled_hours;
      updateFields.is_late = false;
      updateFields.is_early_departure = false;
      updateFields.attendance_status = attendance_status;


      await connection.query('DELETE FROM employee_overtime_records WHERE attendance_record_id = ?', [recordId]);


    } else {
        // Handle "Present", "Half-Day", or just punch time updates
        
        // Convert incoming local times to UTC DateTime objects (ACTUAL punch times)
        const punchInUTC = punch_in 
            ? DateTime.fromISO(punch_in, { zone: timezone }).toUTC() 
            : (currentRecord.current_punch_in ? DateTime.fromJSDate(currentRecord.current_punch_in, { zone: 'utc' }) : null);


        const punchOutUTC = punch_out 
            ? DateTime.fromISO(punch_out, { zone: timezone }).toUTC() 
            : (currentRecord.current_punch_out ? DateTime.fromJSDate(currentRecord.current_punch_out, { zone: 'utc' }) : null);


        if (!punchInUTC || !punchOutUTC) {
            await connection.rollback();
            return res.status(400).json({ message: 'Validation failed', errors: ['Punch-in and punch-out times are required for "Present" or "Half-Day" status.'] });
        }


        if (punchOutUTC < punchInUTC) {
            await connection.rollback();
            return res.status(400).json({ message: 'Validation failed', errors: ['Punch out time must be after punch in time'] });
        }


        const isHoliday = await isNonWorkingDay(currentRecord.attendance_date, connection);
        const attendanceDateISO = DateTime.fromJSDate(currentRecord.attendance_date).toISODate();


        // --- APPLY MARGIN LOGIC (Same as bulkCreateAttendance) ---
        let effectivePunchInTime = punchInUTC;
        let effectivePunchOutTime = punchOutUTC;
        let calculatedIsLate = false;
        let calculatedIsEarlyDeparture = false;


        // Punch In Margin Logic
        if (punchInUTC && !isHoliday) {
            const shiftStartTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.from_time}`, { zone: 'utc' });
            const shiftStartTime = shiftStartTimeUTC.setZone(timezone);
            const gracePeriodEnd = shiftStartTime.plus({ minutes: currentRecord.punch_in_margin });
            const actualPunchTimeLocal = punchInUTC.setZone(timezone);


            if (actualPunchTimeLocal <= shiftStartTime) {
                effectivePunchInTime = shiftStartTimeUTC;
                calculatedIsLate = false;
            } else if (actualPunchTimeLocal <= gracePeriodEnd) {
                effectivePunchInTime = shiftStartTimeUTC;
                calculatedIsLate = false;
            } else {
                calculatedIsLate = true;
                effectivePunchInTime = punchInUTC;
            }
        }


        // Punch Out Margin Logic
        if (punchOutUTC && !isHoliday) {
            const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.to_time}`, { zone: 'utc' });
            const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
            const earlyDepartureThreshold = shiftEndTime.minus({ minutes: currentRecord.punch_out_margin });
            const overtimeStartTime = shiftEndTime.plus({ minutes: currentRecord.overtime_threshold });
            const actualPunchTimeLocal = punchOutUTC.setZone(timezone);


            if (actualPunchTimeLocal < earlyDepartureThreshold) {
                calculatedIsEarlyDeparture = true;
                effectivePunchOutTime = punchOutUTC;
            } else if (actualPunchTimeLocal >= earlyDepartureThreshold && actualPunchTimeLocal <= shiftEndTime) {
                effectivePunchOutTime = shiftEndTimeUTC;
                calculatedIsEarlyDeparture = false;
            } else if (actualPunchTimeLocal > shiftEndTime && actualPunchTimeLocal <= overtimeStartTime) {
                effectivePunchOutTime = shiftEndTimeUTC;
                calculatedIsEarlyDeparture = false;
            } else {
                effectivePunchOutTime = punchOutUTC;
                calculatedIsEarlyDeparture = false;
            }
        }


        // Set flags based on calculated values
        updateFields.is_late = calculatedIsLate;
        updateFields.is_early_departure = calculatedIsEarlyDeparture;


        // Calculate hours based on EFFECTIVE times (rounded times)
        const hoursWorked = isHoliday ? 0 : calculateHoursWorked(effectivePunchInTime, effectivePunchOutTime);
        updateFields.hours_worked = parseFloat(hoursWorked.toFixed(2));
        updateFields.short_hours = isHoliday ? 0 : Math.max(0, parseFloat(currentRecord.scheduled_hours) - hoursWorked).toFixed(2);
        
        // Store EFFECTIVE times in database (rounded times)
        if(punch_in) updateFields.punch_in = effectivePunchInTime.toFormat('yyyy-MM-dd HH:mm:ss');
        if(punch_out) updateFields.punch_out = effectivePunchOutTime.toFormat('yyyy-MM-dd HH:mm:ss');


        // Determine status
        let final_attendance_status = 'Present';
        if (attendance_status) {
            final_attendance_status = attendance_status;
        } else {
            if (!isHoliday && hoursWorked < currentRecord.half_day_threshold) {
                final_attendance_status = 'Half-Day';
            }
        }
        updateFields.attendance_status = final_attendance_status;


        // --- Overtime Calculation Logic (uses ACTUAL punch times, not effective) ---
        let overtime_hours = 0;
        let overtime_type = 'regular';
        let overtime_start_time_utc = null;


        if (punchInUTC && punchOutUTC) {
            if (isHoliday) {
                const punchInForOvertimeCalc = effectivePunchInTime;
                overtime_hours = calculateHoursWorked(punchInForOvertimeCalc, effectivePunchOutTime);
                overtime_type = 'holiday';
                overtime_start_time_utc = punchInForOvertimeCalc;
            } else {
                const shiftEndTimeUTC = DateTime.fromISO(`${attendanceDateISO}T${currentRecord.to_time}`, { zone: 'utc' });
                const overtimeStartTime = shiftEndTimeUTC.plus({ minutes: currentRecord.overtime_threshold });
                const actualPunchOutLocal = punchOutUTC.setZone(timezone);
                const shiftEndTimeLocal = shiftEndTimeUTC.setZone(timezone);


                if (actualPunchOutLocal > overtimeStartTime.setZone(timezone)) {
                    overtime_hours = parseFloat(actualPunchOutLocal.diff(shiftEndTimeLocal, 'hours').as('hours').toFixed(2));
                    overtime_type = 'regular';
                    overtime_start_time_utc = shiftEndTimeUTC;
                }
            }
        }


        if (overtime_hours > 0) {
            const overtimeSQL = `
                INSERT INTO employee_overtime_records (
                    attendance_record_id, employee_id, request_date, overtime_hours,
                    overtime_type, overtime_start, overtime_end, reason, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval')
                ON DUPLICATE KEY UPDATE
                    overtime_hours = VALUES(overtime_hours), overtime_type = VALUES(overtime_type),
                    overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end),
                    reason = VALUES(reason), status = 'pending_approval',
                    processed_by = NULL, processed_at = NULL, rejection_reason = NULL;
            `;
            await connection.query(overtimeSQL, [
                recordId, currentRecord.employee_id, currentRecord.attendance_date, overtime_hours,
                overtime_type, overtime_start_time_utc.toJSDate(), punchOutUTC.toJSDate(), update_reason
            ]);
        } else {
            await connection.query('DELETE FROM employee_overtime_records WHERE attendance_record_id = ?', [recordId]);
        }
    }


    // --- Build and Execute Update Query ---
    const updateClauses = [];
    const updateValues = [];


    Object.entries(updateFields).forEach(([key, value]) => {
        if (value !== undefined) {
            updateClauses.push(`${key} = ?`);
            updateValues.push(value);
        }
    });
    
    if (updateClauses.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'No valid fields to update provided.' });
    }


    updateClauses.push('update_reason = ?', 'updated_by = ?');
    updateValues.push(update_reason, updatedById, recordId);


    const updateSql = `UPDATE attendance_record SET ${updateClauses.join(', ')} WHERE id = ?`;
    const [result] = await connection.query(updateSql, updateValues);


    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Attendance record not found or no changes made.' });
    }


    await connection.commit();


    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully.',
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error updating attendance record:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  updateAttendanceRecord
};