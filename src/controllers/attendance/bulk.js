
// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// // Helper function to calculate hours worked from Luxon DateTime objects
// const calculateHoursWorked = (punchIn, punchOut) => {
//     if (!punchIn || !punchOut) return 0;
//     const diff = punchOut.diff(punchIn, 'hours');
//     return parseFloat(diff.as('hours').toFixed(2));
// };

// /**
//  * @description Creates or updates attendance records in bulk, with manual flags and automatic overtime.
//  */
// const bulkCreateAttendance = async (req, res) => {
//     // is_late and is_early_departure are now optional top-level properties
//     const { reason, attendance_date, punch_in_local, punch_out_local, timezone, records, is_late = false, is_early_departure = false } = req.body;
//     const changed_by = req.user.id;

//     if (!reason || !attendance_date || !Array.isArray(records) || records.length === 0) {
//         return res.status(400).json({ message: 'A reason, attendance_date, and a non-empty array of records are required.' });
//     }
//     if (!punch_in_local && !punch_out_local) {
//         return res.status(400).json({ message: 'At least one of punch_in_local or punch_out_local must be provided.' });
//     }

//     let connection;
//     try {
//         connection = await pool.getConnection();
//         await connection.beginTransaction();

//         const bulkLogSql = `
//             INSERT INTO bulk_attendance_log (action_by, action_date, target_count, new_status, reason)
//             VALUES (?, ?, ?, 'Bulk Punch', ?);
//         `;
//         const [bulkLogResult] = await connection.query(bulkLogSql, [changed_by, attendance_date, records.length, reason]);
//         const bulk_log_id = bulkLogResult.insertId;

//         for (const record of records) {
//             const { employee_id } = record;
//             const [[user]] = await connection.query('SELECT shift FROM user WHERE id = ?', [employee_id]);
//             if (!user || !user.shift) continue; 

//             const [[shift]] = await connection.query('SELECT * FROM shifts WHERE id = ?', [user.shift]);
//             if (!shift) continue;

//             const punchInUTC = punch_in_local ? DateTime.fromFormat(punch_in_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toUTC() : null;
//             const punchOutUTC = punch_out_local ? DateTime.fromFormat(punch_out_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toUTC() : null;
            
//             const formattedPunchIn = punchInUTC ? punchInUTC.toFormat('yyyy-MM-dd HH:mm:ss') : null;
//             const formattedPunchOut = punchOutUTC ? punchOutUTC.toFormat('yyyy-MM-dd HH:mm:ss') : null;

//             // --- Case 1: PUNCH-IN ONLY ---
//             if (punch_in_local && !punch_out_local) {
//                 const upsertSql = `
//                     INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, attendance_status, is_late, is_early_departure, updated_by)
//                     VALUES (?, ?, ?, ?, 'Present', ?, ?, ?)
//                     ON DUPLICATE KEY UPDATE punch_in = VALUES(punch_in), is_late = VALUES(is_late), updated_by = VALUES(updated_by);
//                 `;
//                 await connection.query(upsertSql, [employee_id, attendance_date, user.shift, formattedPunchIn, is_late, false, changed_by]);
//             }

//             // --- Case 2: PUNCH-OUT ONLY ---
//             else if (!punch_in_local && punch_out_local) {
//                 const [[existingRecord]] = await connection.query('SELECT id, punch_in FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
//                 if (!existingRecord || !existingRecord.punch_in) continue;

//                 const punchInTime = DateTime.fromJSDate(existingRecord.punch_in, { zone: 'utc' });
//                 const hours_worked = calculateHoursWorked(punchInTime, punchOutUTC);
//                 const short_hours = Math.max(0, shift.scheduled_hours - hours_worked);
//                 let attendance_status = hours_worked < shift.half_day_threshold ? 'Half-Day' : 'Present';

//                 await connection.query(
//                     `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, short_hours = ?, attendance_status = ?, is_early_departure = ?, updated_by = ? WHERE id = ?`,
//                     [formattedPunchOut, hours_worked, short_hours, attendance_status, is_early_departure, changed_by, existingRecord.id]
//                 );
//             }

//             // --- Case 3: BOTH PUNCH-IN AND PUNCH-OUT ---
//             else if (punch_in_local && punch_out_local) {
//                 const hours_worked = calculateHoursWorked(punchInUTC, punchOutUTC);
//                 const short_hours = Math.max(0, shift.scheduled_hours - hours_worked);
//                 let attendance_status = hours_worked < shift.half_day_threshold ? 'Half-Day' : 'Present';

//                 const upsertSql = `
//                     INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, punch_out, hours_worked, short_hours, attendance_status, is_late, is_early_departure, updated_by)
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//                     ON DUPLICATE KEY UPDATE 
//                         punch_in = VALUES(punch_in), punch_out = VALUES(punch_out), hours_worked = VALUES(hours_worked), short_hours = VALUES(short_hours), 
//                         attendance_status = VALUES(attendance_status), is_late = VALUES(is_late), is_early_departure = VALUES(is_early_departure), updated_by = VALUES(updated_by);
//                 `;
//                 await connection.query(upsertSql, [
//                     employee_id, attendance_date, user.shift, formattedPunchIn, formattedPunchOut,
//                     hours_worked, short_hours, attendance_status, is_late, is_early_departure, changed_by
//                 ]);
//             }
            
//             // --- AUTOMATIC OVERTIME CALCULATION (UNCHANGED) ---
//             if (shift && punchOutUTC) {
//                 const shiftEndTimeUTC = DateTime.fromISO(`${attendance_date}T${shift.to_time}`, { zone: 'utc' });
//                 const overtimeStartTime = shiftEndTimeUTC.plus({ minutes: shift.overtime_threshold });
//                 if (punchOutUTC > overtimeStartTime) {
//                     const overtime_hours = parseFloat(punchOutUTC.diff(shiftEndTimeUTC, 'hours').as('hours').toFixed(2));
//                     if (overtime_hours > 0) {
//                         const [[attendance_record]] = await connection.query('SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
//                         const overtimeSQL = `
//                             INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_start, overtime_end)
//                             VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
//                         `;
//                         await connection.query(overtimeSQL, [attendance_record.id, employee_id, attendance_date, overtime_hours, overtimeStartTime.toJSDate(), punchOutUTC.toJSDate()]);
//                     }
//                 }
//             }

//             // Audit logging
//             const [[attendance_record]] = await connection.query('SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
//             const auditSql = `
//                 INSERT INTO attendance_audit_log (attendance_id, field_name, new_value, changed_by, bulk_log_id)
//                 VALUES (?, 'Bulk Punch', ?, ?, ?);
//             `;
//             const auditValue = { employee_id, punch_in_local, punch_out_local, is_late, is_early_departure };
//             await connection.query(auditSql, [attendance_record.id, JSON.stringify(auditValue), changed_by, bulk_log_id]);
//         }

//         await connection.commit();

//         res.status(201).json({
//             success: true,
//             message: `${records.length} attendance records processed successfully.`,
//             bulk_log_id
//         });
//     } catch (error) {
//         if (connection) await connection.rollback();
//         console.error('Error during bulk attendance posting:', error);
//         res.status(500).json({ message: 'An internal server error occurred.' });
//     } finally {
//         if (connection) connection.release();
//     }
// };

// module.exports = { bulkCreateAttendance };




const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

// Helper function to calculate hours worked from Luxon DateTime objects
const calculateHoursWorked = (punchIn, punchOut) => {
    if (!punchIn || !punchOut) return 0;
    const diff = punchOut.diff(punchIn, 'hours');
    return parseFloat(diff.as('hours').toFixed(2));
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
 * @description Creates or updates attendance records in bulk, with manual flags and automatic overtime.
 */
const bulkCreateAttendance = async (req, res) => {
    // is_late and is_early_departure are now optional top-level properties
    const { reason, attendance_date, punch_in_local, punch_out_local, timezone, records, is_late = false, is_early_departure = false } = req.body;
    const changed_by = req.user.id;

    if (!reason || !attendance_date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: 'A reason, attendance_date, and a non-empty array of records are required.' });
    }
    if (!punch_in_local && !punch_out_local) {
        return res.status(400).json({ message: 'At least one of punch_in_local or punch_out_local must be provided.' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if it's a non-working day
        const isHoliday = await isNonWorkingDay(attendance_date, connection);

        const bulkLogSql = `
            INSERT INTO bulk_attendance_log (action_by, action_date, target_count, new_status, reason)
            VALUES (?, ?, ?, 'Bulk Punch', ?);
        `;
        const [bulkLogResult] = await connection.query(bulkLogSql, [changed_by, attendance_date, records.length, reason]);
        const bulk_log_id = bulkLogResult.insertId;

        for (const record of records) {
            const { employee_id } = record;
            const [[user]] = await connection.query('SELECT shift FROM user WHERE id = ?', [employee_id]);
            if (!user || !user.shift) continue; 

            const [[shift]] = await connection.query('SELECT * FROM shifts WHERE id = ?', [user.shift]);
            if (!shift) continue;

            const punchInUTC = punch_in_local ? DateTime.fromFormat(punch_in_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toUTC() : null;
            const punchOutUTC = punch_out_local ? DateTime.fromFormat(punch_out_local, "yyyy-MM-dd HH:mm:ss", { zone: timezone }).toUTC() : null;
            
            let effectivePunchInTime = punchInUTC;
            let effectivePunchOutTime = punchOutUTC;
            let calculatedIsLate = is_late;
            let calculatedIsEarlyDeparture = is_early_departure;

            // Apply grace margin logic for punch-in (only for working days)
            if (punchInUTC && !isHoliday) {
                const shiftStartTimeUTC = DateTime.fromISO(`${attendance_date}T${shift.from_time}`, { zone: 'utc' });
                const shiftStartTime = shiftStartTimeUTC.setZone(timezone);
                const gracePeriodEnd = shiftStartTime.plus({ minutes: shift.punch_in_margin });
                const actualPunchTimeLocal = punchInUTC.setZone(timezone);

                if (actualPunchTimeLocal <= shiftStartTime) {
                    // If early or exactly on time, set to shift start
                    effectivePunchInTime = shiftStartTimeUTC;
                    calculatedIsLate = false;
                } else if (actualPunchTimeLocal <= gracePeriodEnd) {
                    // If within grace period, set to shift start
                    effectivePunchInTime = shiftStartTimeUTC;
                    calculatedIsLate = false;
                } else {
                    // If after grace period, mark as late and use actual time
                    calculatedIsLate = true;
                    effectivePunchInTime = punchInUTC;
                }
            }

            // Apply grace margin logic for punch-out (only for working days)
            if (punchOutUTC && !isHoliday) {
                const shiftEndTimeUTC = DateTime.fromISO(`${attendance_date}T${shift.to_time}`, { zone: 'utc' });
                const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
                const earlyDepartureThreshold = shiftEndTime.minus({ minutes: shift.punch_out_margin });
                const overtimeStartTime = shiftEndTime.plus({ minutes: shift.overtime_threshold });
                const actualPunchTimeLocal = punchOutUTC.setZone(timezone);

                if (actualPunchTimeLocal < earlyDepartureThreshold) {
                    // Early departure - use actual punch out time
                    calculatedIsEarlyDeparture = true;
                    effectivePunchOutTime = punchOutUTC;
                } else if (actualPunchTimeLocal >= earlyDepartureThreshold && actualPunchTimeLocal <= shiftEndTime) {
                    // Within grace period before shift end - set to shift end time
                    effectivePunchOutTime = shiftEndTimeUTC;
                    calculatedIsEarlyDeparture = false;
                } else if (actualPunchTimeLocal > shiftEndTime && actualPunchTimeLocal <= overtimeStartTime) {
                    // After shift end but within overtime threshold - set to shift end time
                    effectivePunchOutTime = shiftEndTimeUTC;
                    calculatedIsEarlyDeparture = false;
                } else {
                    // Beyond overtime threshold - use actual time (overtime will be calculated)
                    effectivePunchOutTime = punchOutUTC;
                    calculatedIsEarlyDeparture = false;
                }
            }
            
            const formattedPunchIn = effectivePunchInTime ? effectivePunchInTime.toFormat('yyyy-MM-dd HH:mm:ss') : null;
            const formattedPunchOut = effectivePunchOutTime ? effectivePunchOutTime.toFormat('yyyy-MM-dd HH:mm:ss') : null;

            // --- Case 1: PUNCH-IN ONLY ---
            if (punch_in_local && !punch_out_local) {
                const upsertSql = `
                    INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, attendance_status, is_late, is_early_departure, updated_by)
                    VALUES (?, ?, ?, ?, 'Present', ?, ?, ?)
                    ON DUPLICATE KEY UPDATE punch_in = VALUES(punch_in), is_late = VALUES(is_late), updated_by = VALUES(updated_by);
                `;
                await connection.query(upsertSql, [employee_id, attendance_date, user.shift, formattedPunchIn, calculatedIsLate, false, changed_by]);
            }

            // --- Case 2: PUNCH-OUT ONLY ---
            else if (!punch_in_local && punch_out_local) {
                const [[existingRecord]] = await connection.query('SELECT id, punch_in FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
                if (!existingRecord || !existingRecord.punch_in) continue;

                const punchInTime = DateTime.fromJSDate(existingRecord.punch_in, { zone: 'utc' });
                const hours_worked = isHoliday ? 0 : calculateHoursWorked(punchInTime, effectivePunchOutTime);
                const short_hours = Math.max(0, shift.scheduled_hours - hours_worked);
                let attendance_status = hours_worked < shift.half_day_threshold ? 'Half-Day' : 'Present';

                await connection.query(
                    `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, short_hours = ?, attendance_status = ?, is_early_departure = ?, updated_by = ? WHERE id = ?`,
                    [formattedPunchOut, hours_worked, short_hours, attendance_status, calculatedIsEarlyDeparture, changed_by, existingRecord.id]
                );
            }

            // --- Case 3: BOTH PUNCH-IN AND PUNCH-OUT ---
            else if (punch_in_local && punch_out_local) {
                const hours_worked = isHoliday ? 0 : calculateHoursWorked(effectivePunchInTime, effectivePunchOutTime);
                const short_hours = Math.max(0, shift.scheduled_hours - hours_worked);
                let attendance_status = hours_worked < shift.half_day_threshold ? 'Half-Day' : 'Present';

                const upsertSql = `
                    INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, punch_out, hours_worked, short_hours, attendance_status, is_late, is_early_departure, updated_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        punch_in = VALUES(punch_in), punch_out = VALUES(punch_out), hours_worked = VALUES(hours_worked), short_hours = VALUES(short_hours), 
                        attendance_status = VALUES(attendance_status), is_late = VALUES(is_late), is_early_departure = VALUES(is_early_departure), updated_by = VALUES(updated_by);
                `;
                await connection.query(upsertSql, [
                    employee_id, attendance_date, user.shift, formattedPunchIn, formattedPunchOut,
                    hours_worked, short_hours, attendance_status, calculatedIsLate, calculatedIsEarlyDeparture, changed_by
                ]);
            }
            
            // --- AUTOMATIC OVERTIME CALCULATION (UPDATED) ---
            if (shift && effectivePunchOutTime) {
                if (isHoliday) {
                    // For holidays, all time is overtime
                    const punchInForOvertimeCalc = effectivePunchInTime || DateTime.fromJSDate(existingRecord?.punch_in || new Date(), { zone: 'utc' });
                    const overtime_hours = calculateHoursWorked(punchInForOvertimeCalc, effectivePunchOutTime);
                    
                    if (overtime_hours > 0) {
                        const [[attendance_record]] = await connection.query('SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
                        const overtimeSQL = `
                            INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
                            VALUES (?, ?, ?, ?, 'holiday', ?, ?) 
                            ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
                        `;
                        await connection.query(overtimeSQL, [attendance_record.id, employee_id, attendance_date, overtime_hours, punchInForOvertimeCalc.toJSDate(), effectivePunchOutTime.toJSDate()]);
                    }
                } else {
                    // For working days, calculate overtime only if beyond overtime threshold
                    const shiftEndTimeUTC = DateTime.fromISO(`${attendance_date}T${shift.to_time}`, { zone: 'utc' });
                    const overtimeStartTime = shiftEndTimeUTC.plus({ minutes: shift.overtime_threshold });
                    const actualPunchOutLocal = punchOutUTC.setZone(timezone);
                    const shiftEndTimeLocal = shiftEndTimeUTC.setZone(timezone);
                    
                    if (actualPunchOutLocal > overtimeStartTime.setZone(timezone)) {
                        const overtime_hours = parseFloat(actualPunchOutLocal.diff(shiftEndTimeLocal, 'hours').as('hours').toFixed(2));
                        if (overtime_hours > 0) {
                            const [[attendance_record]] = await connection.query('SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
                            const overtimeSQL = `
                                INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
                                VALUES (?, ?, ?, ?, 'regular', ?, ?) 
                                ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'regular', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
                            `;
                            await connection.query(overtimeSQL, [attendance_record.id, employee_id, attendance_date, overtime_hours, overtimeStartTime.toJSDate(), punchOutUTC.toJSDate()]);
                        }
                    }
                }
            }

            // Audit logging
            const [[attendance_record]] = await connection.query('SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?', [employee_id, attendance_date]);
            const auditSql = `
                INSERT INTO attendance_audit_log (attendance_id, field_name, new_value, changed_by, bulk_log_id)
                VALUES (?, 'Bulk Punch', ?, ?, ?);
            `;
            const auditValue = { employee_id, punch_in_local, punch_out_local, is_late: calculatedIsLate, is_early_departure: calculatedIsEarlyDeparture };
            await connection.query(auditSql, [attendance_record.id, JSON.stringify(auditValue), changed_by, bulk_log_id]);
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: `${records.length} attendance records processed successfully.`,
            bulk_log_id
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error during bulk attendance posting:', error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { bulkCreateAttendance };