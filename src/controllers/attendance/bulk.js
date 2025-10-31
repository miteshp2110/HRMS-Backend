const { pool } = require("../../db/connector");
const { DateTime } = require("luxon");
const ExcelJS = require("exceljs");

// Helper function to calculate hours worked from Luxon DateTime objects

const calculateHoursWorked = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return 0;

  // Convert to DateTime if they're Date objects
  const start =
    punchIn instanceof Date
      ? DateTime.fromJSDate(punchIn, { zone: "utc" })
      : punchIn;
  const end =
    punchOut instanceof Date
      ? DateTime.fromJSDate(punchOut, { zone: "utc" })
      : punchOut;

  const diff = end.diff(start, "hours");
  return parseFloat(diff.as("hours").toFixed(2));
};

/**
 * @description Checks if a date is a non-working day (based on work_week table or holidays table)
 * @param {string} attendanceDate - Date in YYYY-MM-DD format
 * @param {Object} connection - Database connection
 * @returns {boolean} True if it's a non-working day
 */
const isNonWorkingDay = async (attendanceDate, connection) => {
  const date = new Date(attendanceDate);
  const dayOfWeek = date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();

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
  const {
    reason,
    attendance_date,
    punch_in_local,
    punch_out_local,
    timezone,
    records,
    is_late = false,
    is_early_departure = false,
    status,
  } = req.body;
  const changed_by = req.user.id;

  if (
    !reason ||
    !attendance_date ||
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return res
      .status(400)
      .json({
        message:
          "A reason, attendance_date, and a non-empty array of records are required.",
      });
  }
  // Punch times are not required if status is 'Absent' or 'Leave'
  if (!status && !punch_in_local && !punch_out_local) {
    return res
      .status(400)
      .json({
        message:
          "At least one of punch_in_local or punch_out_local must be provided if status is not Absent or Leave.",
      });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const isHoliday = await isNonWorkingDay(attendance_date, connection);

    const bulkLogSql = `
            INSERT INTO bulk_attendance_log (action_by, action_date, target_count, new_status, reason)
            VALUES (?, ?, ?, 'Bulk Punch', ?);
        `;
    const [bulkLogResult] = await connection.query(bulkLogSql, [
      changed_by,
      attendance_date,
      records.length,
      reason,
    ]);
    const bulk_log_id = bulkLogResult.insertId;

    for (const record of records) {
      const { employee_id } = record;
      const [[user]] = await connection.query(
        "SELECT shift FROM user WHERE id = ?",
        [employee_id]
      );
      if (!user || !user.shift) continue;

      const [[shift]] = await connection.query(
        "SELECT * FROM shifts WHERE id = ?",
        [user.shift]
      );
      if (!shift) continue;

      // --- Logic for Absent or Leave Status ---
      if (status === "Absent" || status === "Leave") {
        const upsertSql = `
                    INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, punch_out, hours_worked, short_hours, attendance_status, updated_by)
                    VALUES (?, ?, ?, NULL, NULL, 0, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        punch_in = NULL, punch_out = NULL, hours_worked = 0, short_hours = VALUES(short_hours), 
                        attendance_status = VALUES(attendance_status), updated_by = VALUES(updated_by);
                `;
        await connection.query(upsertSql, [
          employee_id,
          attendance_date,
          user.shift,
          shift.scheduled_hours,
          status,
          changed_by,
        ]);
        continue; // Skip to the next record
      }

      const punchInUTC = punch_in_local
        ? DateTime.fromFormat(punch_in_local, "yyyy-MM-dd HH:mm:ss", {
            zone: timezone,
          }).toUTC()
        : null;
      const punchOutUTC = punch_out_local
        ? DateTime.fromFormat(punch_out_local, "yyyy-MM-dd HH:mm:ss", {
            zone: timezone,
          }).toUTC()
        : null;

      let effectivePunchInTime = punchInUTC;
      let effectivePunchOutTime = punchOutUTC;
      let calculatedIsLate = is_late;
      let calculatedIsEarlyDeparture = is_early_departure;

      if (punchInUTC && !isHoliday) {
        const shiftStartTimeUTC = DateTime.fromISO(
          `${attendance_date}T${shift.from_time}`,
          { zone: "utc" }
        );
        const shiftStartTime = shiftStartTimeUTC.setZone(timezone);
        const gracePeriodEnd = shiftStartTime.plus({
          minutes: shift.punch_in_margin,
        });
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

      if (punchOutUTC && !isHoliday) {
        const shiftEndTimeUTC = DateTime.fromISO(
          `${attendance_date}T${shift.to_time}`,
          { zone: "utc" }
        );
        const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
        const earlyDepartureThreshold = shiftEndTime.minus({
          minutes: shift.punch_out_margin,
        });
        const overtimeStartTime = shiftEndTime.plus({
          minutes: shift.overtime_threshold,
        });
        const actualPunchTimeLocal = punchOutUTC.setZone(timezone);

        if (actualPunchTimeLocal < earlyDepartureThreshold) {
          calculatedIsEarlyDeparture = true;
          effectivePunchOutTime = punchOutUTC;
        } else if (
          actualPunchTimeLocal >= earlyDepartureThreshold &&
          actualPunchTimeLocal <= shiftEndTime
        ) {
          effectivePunchOutTime = shiftEndTimeUTC;
          calculatedIsEarlyDeparture = false;
        } else if (
          actualPunchTimeLocal > shiftEndTime &&
          actualPunchTimeLocal <= overtimeStartTime
        ) {
          effectivePunchOutTime = shiftEndTimeUTC;
          calculatedIsEarlyDeparture = false;
        } else {
          effectivePunchOutTime = punchOutUTC;
          calculatedIsEarlyDeparture = false;
        }
      }

      const formattedPunchIn = effectivePunchInTime
        ? effectivePunchInTime.toFormat("yyyy-MM-dd HH:mm:ss")
        : null;
      const formattedPunchOut = effectivePunchOutTime
        ? effectivePunchOutTime.toFormat("yyyy-MM-dd HH:mm:ss")
        : null;

      if (punch_in_local && !punch_out_local) {
        const upsertSql = `
                    INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, attendance_status, is_late, is_early_departure, updated_by)
                    VALUES (?, ?, ?, ?, 'Present', ?, ?, ?)
                    ON DUPLICATE KEY UPDATE punch_in = VALUES(punch_in), is_late = VALUES(is_late), updated_by = VALUES(updated_by);
                `;
        await connection.query(upsertSql, [
          employee_id,
          attendance_date,
          user.shift,
          formattedPunchIn,
          calculatedIsLate,
          false,
          changed_by,
        ]);
      } else if (!punch_in_local && punch_out_local) {
        const [[existingRecord]] = await connection.query(
          "SELECT id, punch_in FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
          [employee_id, attendance_date]
        );
        if (!existingRecord || !existingRecord.punch_in) continue;

        const punchInTime = DateTime.fromJSDate(existingRecord.punch_in, {
          zone: "utc",
        });
        const hours_worked = isHoliday
          ? 0
          : calculateHoursWorked(punchInTime, effectivePunchOutTime);
        const short_hours = isHoliday
          ? 0
          : Math.max(0, shift.scheduled_hours - hours_worked);
        let attendance_status =
          isHoliday || hours_worked >= shift.half_day_threshold
            ? "Present"
            : "Half-Day";

        await connection.query(
          `UPDATE attendance_record SET punch_out = ?, hours_worked = ?, short_hours = ?, attendance_status = ?, is_early_departure = ?, updated_by = ? WHERE id = ?`,
          [
            formattedPunchOut,
            hours_worked,
            short_hours,
            attendance_status,
            calculatedIsEarlyDeparture,
            changed_by,
            existingRecord.id,
          ]
        );
      } else if (punch_in_local && punch_out_local) {
        const hours_worked = isHoliday
          ? 0
          : calculateHoursWorked(effectivePunchInTime, effectivePunchOutTime);
        const short_hours = isHoliday
          ? 0
          : Math.max(0, shift.scheduled_hours - hours_worked);
        let attendance_status =
          isHoliday || hours_worked >= shift.half_day_threshold
            ? "Present"
            : "Half-Day";

        const upsertSql = `
                    INSERT INTO attendance_record (employee_id, attendance_date, shift, punch_in, punch_out, hours_worked, short_hours, attendance_status, is_late, is_early_departure, updated_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        punch_in = VALUES(punch_in), punch_out = VALUES(punch_out), hours_worked = VALUES(hours_worked), short_hours = VALUES(short_hours), 
                        attendance_status = VALUES(attendance_status), is_late = VALUES(is_late), is_early_departure = VALUES(is_early_departure), updated_by = VALUES(updated_by);
                `;
        await connection.query(upsertSql, [
          employee_id,
          attendance_date,
          user.shift,
          formattedPunchIn,
          formattedPunchOut,
          hours_worked,
          short_hours,
          attendance_status,
          calculatedIsLate,
          calculatedIsEarlyDeparture,
          changed_by,
        ]);
      }

      if (shift && effectivePunchOutTime) {
        if (isHoliday) {
          const punchInForOvertimeCalc =
            effectivePunchInTime ||
            DateTime.fromJSDate(existingRecord?.punch_in || new Date(), {
              zone: "utc",
            });
          const overtime_hours = calculateHoursWorked(
            punchInForOvertimeCalc,
            effectivePunchOutTime
          );

          if (overtime_hours > 0) {
            const [[attendance_record]] = await connection.query(
              "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
              [employee_id, attendance_date]
            );
            const overtimeSQL = `
                            INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
                            VALUES (?, ?, ?, ?, 'holiday', ?, ?) 
                            ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
                        `;
            await connection.query(overtimeSQL, [
              attendance_record.id,
              employee_id,
              attendance_date,
              overtime_hours,
              punchInForOvertimeCalc.toJSDate(),
              effectivePunchOutTime.toJSDate(),
            ]);
          }
        } else {
          const shiftEndTimeUTC = DateTime.fromISO(
            `${attendance_date}T${shift.to_time}`,
            { zone: "utc" }
          );
          const overtimeStartTime = shiftEndTimeUTC.plus({
            minutes: shift.overtime_threshold,
          });
          const actualPunchOutLocal = punchOutUTC.setZone(timezone);
          const shiftEndTimeLocal = shiftEndTimeUTC.setZone(timezone);

          if (actualPunchOutLocal > overtimeStartTime.setZone(timezone)) {
            const overtime_hours = parseFloat(
              actualPunchOutLocal
                .diff(shiftEndTimeLocal, "hours")
                .as("hours")
                .toFixed(2)
            );
            if (overtime_hours > 0) {
              const [[attendance_record]] = await connection.query(
                "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
                [employee_id, attendance_date]
              );
              const overtimeSQL = `
                                INSERT INTO employee_overtime_records (attendance_record_id, employee_id, request_date, overtime_hours, overtime_type, overtime_start, overtime_end)
                                VALUES (?, ?, ?, ?, 'regular', ?, ?) 
                                ON DUPLICATE KEY UPDATE overtime_hours = VALUES(overtime_hours), overtime_type = 'regular', overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end);
                            `;
              await connection.query(overtimeSQL, [
                attendance_record.id,
                employee_id,
                attendance_date,
                overtime_hours,
                overtimeStartTime.toJSDate(),
                punchOutUTC.toJSDate(),
              ]);
            }
          }
        }
      }

      const [[attendance_record]] = await connection.query(
        "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
        [employee_id, attendance_date]
      );
      const auditSql = `
                INSERT INTO attendance_audit_log (attendance_id, field_name, new_value, changed_by, bulk_log_id)
                VALUES (?, 'Bulk Punch', ?, ?, ?);
            `;
      const auditValue = {
        employee_id,
        punch_in_local,
        punch_out_local,
        is_late: calculatedIsLate,
        is_early_departure: calculatedIsEarlyDeparture,
      };
      await connection.query(auditSql, [
        attendance_record.id,
        JSON.stringify(auditValue),
        changed_by,
        bulk_log_id,
      ]);
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `${records.length} attendance records processed successfully.`,
      bulk_log_id,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error during bulk attendance posting:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    if (connection) connection.release();
  }
};

// /**
//  * @description Processes a bulk attendance upload from an Excel file (multi-day, multi-employee).
//  */
// const bulkUploadAttendanceExcel = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "No file uploaded." });
//   }
//   const { timezone, reason } = req.body;
//   if (!timezone || !reason) {
//     return res
//       .status(400)
//       .json({
//         message:
//           "A timezone and a reason for the upload are required in the request body.",
//       });
//   }
//   const updatedById = req.user.id;

//   let connection;
//   try {
//     connection = await pool.getConnection();
//     await connection.beginTransaction();

//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.load(req.file.buffer);
//     const worksheet = workbook.getWorksheet(1); // Get the first worksheet

//     const errors = [];
//     let processedCount = 0;

//     // Create a cache for shift details to reduce DB queries
//     const shiftCache = new Map();
//     const userCache = new Map();

//     // Iterate from row 2 (skipping header)
//     for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
//       const row = worksheet.getRow(rowNumber);
//       const employeeId = row.getCell("A").value;
//       const excelDate = row.getCell("D").value; // dd-MM-yyyy
//       const excelPunchIn = row.getCell("E").value; // HH:mm
//       const excelPunchOut = row.getCell("F").value; // HH:mm

//       if (!employeeId || !excelDate || !excelPunchIn || !excelPunchOut) {
//         errors.push({
//           row: rowNumber,
//           message: "Missing data (ID, Date, PunchIn, or PunchOut).",
//         });
//         continue;
//       }

//       // --- 1. Parse Date and Time ---

//       let attendanceDate, punchInTime, punchOutTime;

//       // Handle date - ExcelJS returns Date objects for date cells
//       if (excelDate instanceof Date) {
//         attendanceDate = DateTime.fromJSDate(excelDate, { zone: "utc" });
//       } else if (typeof excelDate === "string") {
//         attendanceDate = DateTime.fromFormat(excelDate, "dd-MM-yyyy", {
//           zone: "utc",
//         });
//       } else if (typeof excelDate === "number") {
//         // Handle Excel serial date number
//         attendanceDate = DateTime.fromJSDate(
//           new Date(Date.UTC(0, 0, excelDate - 1, 0, 0, 0))
//         );
//       } else {
//         errors.push({
//           row: rowNumber,
//           employeeId,
//           message: "Invalid date format.",
//         });
//         continue;
//       }

//       // Handle punch in time
//       if (excelPunchIn instanceof Date) {
//         punchInTime = DateTime.fromJSDate(excelPunchIn, { zone: "utc" });
//       } else if (typeof excelPunchIn === "string") {
//         punchInTime = DateTime.fromFormat(excelPunchIn, "HH:mm", {
//           zone: "utc",
//         });
//       } else {
//         errors.push({
//           row: rowNumber,
//           employeeId,
//           message: "Invalid punch in time format.",
//         });
//         continue;
//       }

//       // Handle punch out time
//       if (excelPunchOut instanceof Date) {
//         punchOutTime = DateTime.fromJSDate(excelPunchOut, { zone: "utc" });
//       } else if (typeof excelPunchOut === "string") {
//         punchOutTime = DateTime.fromFormat(excelPunchOut, "HH:mm", {
//           zone: "utc",
//         });
//       } else {
//         errors.push({
//           row: rowNumber,
//           employeeId,
//           message: "Invalid punch out time format.",
//         });
//         continue;
//       }

//       // Combine date and time, then set them in the provided local timezone
//       const punchInLocal = attendanceDate
//         .set({ hour: punchInTime.hour, minute: punchInTime.minute })
//         .setZone(timezone, { keepLocalTime: true });
//       const punchOutLocal = attendanceDate
//         .set({ hour: punchOutTime.hour, minute: punchOutTime.minute })
//         .setZone(timezone, { keepLocalTime: true });

//       // Convert to UTC for database storage and comparison
//       const punchInUTC = punchInLocal.toUTC();
//       const punchOutUTC = punchOutLocal.toUTC();
//       const attendanceDateISO = attendanceDate.toISODate();

//       if (punchOutUTC <= punchInUTC) {
//         errors.push({
//           row: rowNumber,
//           employeeId,
//           message: "Punch out time must be after punch in time.",
//         });
//         continue;
//       }

//       // --- 2. Get Shift Details (with caching) ---
//       let shift;
//       if (userCache.has(employeeId)) {
//         shift = shiftCache.get(userCache.get(employeeId));
//       } else {
//         const [[user]] = await connection.query(
//           "SELECT shift FROM user WHERE id = ?",
//           [employeeId]
//         );
//         if (!user || !user.shift) {
//           errors.push({
//             row: rowNumber,
//             employeeId,
//             message: "User not found or has no shift assigned.",
//           });
//           continue;
//         }
//         userCache.set(employeeId, user.shift);
//         if (shiftCache.has(user.shift)) {
//           shift = shiftCache.get(user.shift);
//         } else {
//           const [[shiftData]] = await connection.query(
//             "SELECT * FROM shifts WHERE id = ?",
//             [user.shift]
//           );
//           if (!shiftData) {
//             errors.push({
//               row: rowNumber,
//               employeeId,
//               message: `Assigned shift ID ${user.shift} not found.`,
//             });
//             continue;
//           }
//           shift = shiftData;
//           shiftCache.set(user.shift, shift);
//         }
//       }

//       // --- 3. Calculate All Fields ---
//       const updateFields = {};
//       const isHoliday = await isNonWorkingDay(
//         attendanceDate.toJSDate(),
//         connection
//       );

//       // Calculate Flags (only if not a holiday)
//       if (isHoliday) {
//         updateFields.is_late = false;
//         updateFields.is_early_departure = false;
//       } else {
//         const shiftStartTimeUTC = DateTime.fromISO(
//           `${attendanceDateISO}T${shift.from_time}`,
//           { zone: "utc" }
//         );
//         const gracePeriodEnd = shiftStartTimeUTC.plus({
//           minutes: shift.punch_in_margin,
//         });
//         updateFields.is_late = punchInUTC > gracePeriodEnd;

//         const shiftEndTimeUTC = DateTime.fromISO(
//           `${attendanceDateISO}T${shift.to_time}`,
//           { zone: "utc" }
//         );
//         const earlyDepartureThreshold = shiftEndTimeUTC.minus({
//           minutes: shift.punch_out_margin,
//         });
//         updateFields.is_early_departure = punchOutUTC < earlyDepartureThreshold;
//       }

//       // Calculate Hours
//       const hoursWorked = calculateHoursWorked(
//         punchInUTC.toJSDate(),
//         punchOutUTC.toJSDate()
//       );
//       updateFields.hours_worked = parseFloat(hoursWorked.toFixed(2));
//       updateFields.short_hours = isHoliday
//         ? 0
//         : Math.max(0, parseFloat(shift.scheduled_hours) - hoursWorked).toFixed(
//             2
//           );

//       // Determine Status
//       updateFields.attendance_status = "Present";
//       if (!isHoliday && hoursWorked < shift.half_day_threshold) {
//         updateFields.attendance_status = "Half-Day";
//       }

//       // --- 4. Upsert Attendance Record ---
//       const upsertSql = `
//                 INSERT INTO attendance_record (
//                     employee_id, attendance_date, shift, punch_in, punch_out, 
//                     hours_worked, short_hours, attendance_status, is_late, is_early_departure, 
//                     updated_by, update_reason
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//                 ON DUPLICATE KEY UPDATE
//                     punch_in = VALUES(punch_in), punch_out = VALUES(punch_out), hours_worked = VALUES(hours_worked),
//                     short_hours = VALUES(short_hours), attendance_status = VALUES(attendance_status),
//                     is_late = VALUES(is_late), is_early_departure = VALUES(is_early_departure),
//                     updated_by = VALUES(updated_by), update_reason = VALUES(update_reason);
//             `;
//       const [result] = await connection.query(upsertSql, [
//         employeeId,
//         attendanceDateISO,
//         shift.id,
//         punchInUTC.toJSDate(),
//         punchOutUTC.toJSDate(),
//         updateFields.hours_worked,
//         updateFields.short_hours,
//         updateFields.attendance_status,
//         updateFields.is_late,
//         updateFields.is_early_departure,
//         updatedById,
//         reason,
//       ]);

//       const attendanceRecordId =
//         result.insertId ||
//         (
//           await connection.query(
//             "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
//             [employeeId, attendanceDateISO]
//           )
//         )[0][0].id;

//       // --- 5. Handle Overtime ---
//       let overtime_hours = 0;
//       let overtime_type = "regular";
//       let overtime_start_time_utc = null;

//       if (isHoliday) {
//         overtime_hours = hoursWorked;
//         overtime_type = "holiday";
//         overtime_start_time_utc = punchInUTC;
//       } else {
//         const shiftEndTimeUTC = DateTime.fromISO(
//           `${attendanceDateISO}T${shift.to_time}`,
//           { zone: "utc" }
//         );
//         const overtimeThresholdTime = shiftEndTimeUTC.plus({
//           minutes: shift.overtime_threshold,
//         });
//         if (punchOutUTC > overtimeThresholdTime) {
//           overtime_hours = parseFloat(
//             punchOutUTC.diff(shiftEndTimeUTC, "hours").as("hours").toFixed(2)
//           );
//           overtime_type = "regular";
//           overtime_start_time_utc = shiftEndTimeUTC;
//         }
//       }

//       if (overtime_hours > 0) {
//         const overtimeSQL = `
//                     INSERT INTO employee_overtime_records (
//                         attendance_record_id, employee_id, request_date, overtime_hours,
//                         overtime_type, overtime_start, overtime_end, reason, status
//                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval')
//                     ON DUPLICATE KEY UPDATE
//                         overtime_hours = VALUES(overtime_hours), overtime_type = VALUES(overtime_type),
//                         overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end),
//                         reason = VALUES(reason), status = 'pending_approval',
//                         processed_by = NULL, processed_at = NULL, rejection_reason = NULL;
//                 `;
//         await connection.query(overtimeSQL, [
//           attendanceRecordId,
//           employeeId,
//           attendanceDateISO,
//           overtime_hours,
//           overtime_type,
//           overtime_start_time_utc.toJSDate(),
//           punchOutUTC.toJSDate(),
//           reason,
//         ]);
//       } else {
//         await connection.query(
//           "DELETE FROM employee_overtime_records WHERE attendance_record_id = ?",
//           [attendanceRecordId]
//         );
//       }

//       processedCount++;
//     }

//     if (errors.length > 0) {
//       await connection.rollback();
//       return res.status(400).json({
//         message: "Upload failed with errors. No records were imported.",
//         processedCount: 0,
//         errors,
//       });
//     }

//     await connection.commit();

//     res.status(201).json({
//       success: true,
//       message: `Successfully processed ${processedCount} attendance records.`,
//       processedCount: processedCount,
//       errors: [],
//     });
//   } catch (error) {
//     if (connection) await connection.rollback();
//     console.error("Error during bulk attendance upload:", error);
//     res
//       .status(500)
//       .json({
//         message: "An internal server error occurred.",
//         error: error.message,
//       });
//   } finally {
//     if (connection) connection.release();
//   }
// };


/**
 * @description Processes a bulk attendance upload from an Excel file (multi-day, multi-employee).
 */
const bulkUploadAttendanceExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  const { timezone, reason } = req.body;
  if (!timezone || !reason) {
    return res.status(400).json({
      message: "A timezone and a reason for the upload are required in the request body.",
    });
  }
  const updatedById = req.user.id;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    let processedCount = 0;

    // Create a cache for shift details to reduce DB queries
    const shiftCache = new Map();
    const userCache = new Map();

    // Iterate from row 2 (skipping header)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const employeeId = row.getCell("A").value;
      const excelDate = row.getCell("D").value;
      const excelPunchIn = row.getCell("E").value;
      const excelPunchOut = row.getCell("F").value;

      if (!employeeId || !excelDate || !excelPunchIn || !excelPunchOut) {
        errors.push({
          row: rowNumber,
          message: "Missing data (ID, Date, PunchIn, or PunchOut).",
        });
        continue;
      }

      // --- 1. Parse Date and Time ---
      let attendanceDate, punchInTime, punchOutTime;

      // Handle date - ExcelJS returns Date objects for date cells
      if (excelDate instanceof Date) {
        attendanceDate = DateTime.fromJSDate(excelDate, { zone: "utc" });
      } else if (typeof excelDate === "string") {
        attendanceDate = DateTime.fromFormat(excelDate, "dd-MM-yyyy", {
          zone: "utc",
        });
      } else if (typeof excelDate === "number") {
        attendanceDate = DateTime.fromJSDate(
          new Date(Date.UTC(0, 0, excelDate - 1, 0, 0, 0))
        );
      } else {
        errors.push({
          row: rowNumber,
          employeeId,
          message: "Invalid date format.",
        });
        continue;
      }

      // Handle punch in time
      if (excelPunchIn instanceof Date) {
        punchInTime = DateTime.fromJSDate(excelPunchIn, { zone: "utc" });
      } else if (typeof excelPunchIn === "string") {
        punchInTime = DateTime.fromFormat(excelPunchIn, "HH:mm", {
          zone: "utc",
        });
      } else {
        errors.push({
          row: rowNumber,
          employeeId,
          message: "Invalid punch in time format.",
        });
        continue;
      }

      // Handle punch out time
      if (excelPunchOut instanceof Date) {
        punchOutTime = DateTime.fromJSDate(excelPunchOut, { zone: "utc" });
      } else if (typeof excelPunchOut === "string") {
        punchOutTime = DateTime.fromFormat(excelPunchOut, "HH:mm", {
          zone: "utc",
        });
      } else {
        errors.push({
          row: rowNumber,
          employeeId,
          message: "Invalid punch out time format.",
        });
        continue;
      }

      // Combine date and time, then set them in the provided local timezone
      const punchInLocal = attendanceDate
        .set({ hour: punchInTime.hour, minute: punchInTime.minute })
        .setZone(timezone, { keepLocalTime: true });
      const punchOutLocal = attendanceDate
        .set({ hour: punchOutTime.hour, minute: punchOutTime.minute })
        .setZone(timezone, { keepLocalTime: true });

      // Convert to UTC for database storage and comparison
      const punchInUTC = punchInLocal.toUTC();
      const punchOutUTC = punchOutLocal.toUTC();
      const attendanceDateISO = attendanceDate.toISODate();

      if (punchOutUTC <= punchInUTC) {
        errors.push({
          row: rowNumber,
          employeeId,
          message: "Punch out time must be after punch in time.",
        });
        continue;
      }

      // --- 2. Get Shift Details (with caching) ---
      let shift;
      if (userCache.has(employeeId)) {
        shift = shiftCache.get(userCache.get(employeeId));
      } else {
        const [[user]] = await connection.query(
          "SELECT shift FROM user WHERE id = ?",
          [employeeId]
        );
        if (!user || !user.shift) {
          errors.push({
            row: rowNumber,
            employeeId,
            message: "User not found or has no shift assigned.",
          });
          continue;
        }
        userCache.set(employeeId, user.shift);
        if (shiftCache.has(user.shift)) {
          shift = shiftCache.get(user.shift);
        } else {
          const [[shiftData]] = await connection.query(
            "SELECT * FROM shifts WHERE id = ?",
            [user.shift]
          );
          if (!shiftData) {
            errors.push({
              row: rowNumber,
              employeeId,
              message: `Assigned shift ID ${user.shift} not found.`,
            });
            continue;
          }
          shift = shiftData;
          shiftCache.set(user.shift, shift);
        }
      }

      // --- 3. Check if Holiday ---
      const isHoliday = await isNonWorkingDay(attendanceDateISO, connection);

      // --- 4. Apply Punch In/Out Logic with Margins (EXACT LOGIC FROM bulkCreateAttendance) ---
      let effectivePunchInTime = punchInUTC;
      let effectivePunchOutTime = punchOutUTC;
      let calculatedIsLate = false;
      let calculatedIsEarlyDeparture = false;

      // Punch In Logic
      if (punchInUTC && !isHoliday) {
        const shiftStartTimeUTC = DateTime.fromISO(
          `${attendanceDateISO}T${shift.from_time}`,
          { zone: "utc" }
        );
        const shiftStartTime = shiftStartTimeUTC.setZone(timezone);
        const gracePeriodEnd = shiftStartTime.plus({
          minutes: shift.punch_in_margin,
        });
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

      // Punch Out Logic
      if (punchOutUTC && !isHoliday) {
        const shiftEndTimeUTC = DateTime.fromISO(
          `${attendanceDateISO}T${shift.to_time}`,
          { zone: "utc" }
        );
        const shiftEndTime = shiftEndTimeUTC.setZone(timezone);
        const earlyDepartureThreshold = shiftEndTime.minus({
          minutes: shift.punch_out_margin,
        });
        const overtimeStartTime = shiftEndTime.plus({
          minutes: shift.overtime_threshold,
        });
        const actualPunchTimeLocal = punchOutUTC.setZone(timezone);

        if (actualPunchTimeLocal < earlyDepartureThreshold) {
          calculatedIsEarlyDeparture = true;
          effectivePunchOutTime = punchOutUTC;
        } else if (
          actualPunchTimeLocal >= earlyDepartureThreshold &&
          actualPunchTimeLocal <= shiftEndTime
        ) {
          effectivePunchOutTime = shiftEndTimeUTC;
          calculatedIsEarlyDeparture = false;
        } else if (
          actualPunchTimeLocal > shiftEndTime &&
          actualPunchTimeLocal <= overtimeStartTime
        ) {
          effectivePunchOutTime = shiftEndTimeUTC;
          calculatedIsEarlyDeparture = false;
        } else {
          effectivePunchOutTime = punchOutUTC;
          calculatedIsEarlyDeparture = false;
        }
      }

      // --- 5. Calculate Hours Worked (using effective times) ---
      const hoursWorked = isHoliday
        ? 0
        : calculateHoursWorked(effectivePunchInTime, effectivePunchOutTime);
      const shortHours = isHoliday
        ? 0
        : Math.max(0, parseFloat(shift.scheduled_hours) - hoursWorked);

      // Determine Status
      let attendanceStatus =
        isHoliday || hoursWorked >= shift.half_day_threshold
          ? "Present"
          : "Half-Day";

      // --- 6. Upsert Attendance Record (store effective times) ---
      const formattedPunchIn = effectivePunchInTime
        ? effectivePunchInTime.toFormat("yyyy-MM-dd HH:mm:ss")
        : null;
      const formattedPunchOut = effectivePunchOutTime
        ? effectivePunchOutTime.toFormat("yyyy-MM-dd HH:mm:ss")
        : null;

      const upsertSql = `
        INSERT INTO attendance_record (
          employee_id, attendance_date, shift, punch_in, punch_out, 
          hours_worked, short_hours, attendance_status, is_late, is_early_departure, 
          updated_by, update_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          punch_in = VALUES(punch_in), punch_out = VALUES(punch_out), hours_worked = VALUES(hours_worked),
          short_hours = VALUES(short_hours), attendance_status = VALUES(attendance_status),
          is_late = VALUES(is_late), is_early_departure = VALUES(is_early_departure),
          updated_by = VALUES(updated_by), update_reason = VALUES(update_reason);
      `;

      const [result] = await connection.query(upsertSql, [
        employeeId,
        attendanceDateISO,
        shift.id,
        formattedPunchIn,
        formattedPunchOut,
        hoursWorked,
        shortHours,
        attendanceStatus,
        calculatedIsLate,
        calculatedIsEarlyDeparture,
        updatedById,
        reason,
      ]);

      const attendanceRecordId =
        result.insertId ||
        (
          await connection.query(
            "SELECT id FROM attendance_record WHERE employee_id = ? AND attendance_date = ?",
            [employeeId, attendanceDateISO]
          )
        )[0][0].id;

      // --- 7. Handle Overtime (EXACT LOGIC FROM bulkCreateAttendance) ---
      if (shift && effectivePunchOutTime) {
        if (isHoliday) {
          const punchInForOvertimeCalc = effectivePunchInTime;
          const overtime_hours = calculateHoursWorked(
            punchInForOvertimeCalc,
            effectivePunchOutTime
          );

          if (overtime_hours > 0) {
            const overtimeSQL = `
              INSERT INTO employee_overtime_records (
                attendance_record_id, employee_id, request_date, overtime_hours,
                overtime_type, overtime_start, overtime_end, reason, status
              ) VALUES (?, ?, ?, ?, 'holiday', ?, ?, ?, 'pending_approval')
              ON DUPLICATE KEY UPDATE
                overtime_hours = VALUES(overtime_hours), overtime_type = 'holiday',
                overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end),
                reason = VALUES(reason), status = 'pending_approval',
                processed_by = NULL, processed_at = NULL, rejection_reason = NULL;
            `;
            await connection.query(overtimeSQL, [
              attendanceRecordId,
              employeeId,
              attendanceDateISO,
              overtime_hours,
              punchInForOvertimeCalc.toJSDate(),
              effectivePunchOutTime.toJSDate(),
              reason,
            ]);
          }
        } else {
          const shiftEndTimeUTC = DateTime.fromISO(
            `${attendanceDateISO}T${shift.to_time}`,
            { zone: "utc" }
          );
          const overtimeStartTime = shiftEndTimeUTC.plus({
            minutes: shift.overtime_threshold,
          });
          const actualPunchOutLocal = punchOutUTC.setZone(timezone);
          const shiftEndTimeLocal = shiftEndTimeUTC.setZone(timezone);

          if (actualPunchOutLocal > overtimeStartTime.setZone(timezone)) {
            const overtime_hours = parseFloat(
              actualPunchOutLocal
                .diff(shiftEndTimeLocal, "hours")
                .as("hours")
                .toFixed(2)
            );
            if (overtime_hours > 0) {
              const overtimeSQL = `
                INSERT INTO employee_overtime_records (
                  attendance_record_id, employee_id, request_date, overtime_hours,
                  overtime_type, overtime_start, overtime_end, reason, status
                ) VALUES (?, ?, ?, ?, 'regular', ?, ?, ?, 'pending_approval')
                ON DUPLICATE KEY UPDATE
                  overtime_hours = VALUES(overtime_hours), overtime_type = 'regular',
                  overtime_start = VALUES(overtime_start), overtime_end = VALUES(overtime_end),
                  reason = VALUES(reason), status = 'pending_approval',
                  processed_by = NULL, processed_at = NULL, rejection_reason = NULL;
              `;
              await connection.query(overtimeSQL, [
                attendanceRecordId,
                employeeId,
                attendanceDateISO,
                overtime_hours,
                overtimeStartTime.toJSDate(),
                punchOutUTC.toJSDate(),
                reason,
              ]);
            }
          } else {
            // No overtime, remove any existing overtime record
            await connection.query(
              "DELETE FROM employee_overtime_records WHERE attendance_record_id = ?",
              [attendanceRecordId]
            );
          }
        }
      }

      processedCount++;
    }

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "Upload failed with errors. No records were imported.",
        processedCount: 0,
        errors,
      });
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `Successfully processed ${processedCount} attendance records.`,
      processedCount: processedCount,
      errors: [],
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error during bulk attendance upload:", error);
    res.status(500).json({
      message: "An internal server error occurred.",
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
};


module.exports = { bulkCreateAttendance, bulkUploadAttendanceExcel };
