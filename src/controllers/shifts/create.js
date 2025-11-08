


// const { pool } = require('../../db/connector');
// const { DateTime } = require('luxon');

// /**
//  * @description Create a new shift, converting local time to UTC.
//  * @body {
//  * "name": "India Day Shift",
//  * "from_time_local": "09:30",
//  * "to_time_local": "17:30",
//  * "timezone": "Asia/Kolkata",
//  * "half_day_threshold": 0.50,
//  * "punch_in_margin": 15,
//  * "punch_out_margin": 10
//  * }
//  */
// const createShift = async (req, res) => {
//   const {
//     name,
//     from_time_local,
//     to_time_local,
//     timezone,
//     half_day_threshold,
//     punch_in_margin,
//     punch_out_margin,
//     overtime_threshold
//   } = req.body;

//   if (!name || !from_time_local || !to_time_local || !timezone || !overtime_threshold) {
//     return res.status(400).json({ 
//       message: 'Name, from_time_local, to_time_local, and timezone are required.' 
//     });
//   }

//   let connection;
//   try {
//     // 1. Convert local times to UTC using luxon
//     const from_time_utc = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone })
//       .toUTC()
//       .toFormat('HH:mm:ss');
      
//     const to_time_utc = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone })
//       .toUTC()
//       .toFormat('HH:mm:ss');

//     // 2. Insert the UTC times and other details into the database
//     connection = await pool.getConnection();
//     const sql = `
//       INSERT INTO shifts 
//       (name, from_time, to_time, half_day_threshold, punch_in_margin, punch_out_margin,overtime_threshold) 
//       VALUES (?, ?, ?, ?, ?, ?,?)
//     `;
//     const [result] = await connection.query(sql, [
//       name,
//       from_time_utc,
//       to_time_utc,
//       half_day_threshold || null,
//       punch_in_margin || 0,
//       punch_out_margin || 0,
//       overtime_threshold || 0
//     ]);

//     res.status(201).json({
//       success: true,
//       message: 'Shift created successfully with times stored in UTC.',
//       shift: {
//         id: result.insertId,
//         name,
//         local_time: {
//           from: from_time_local,
//           to: to_time_local,
//           timezone,
//         },
//         utc_time_stored: {
//           from: from_time_utc,
//           to: to_time_utc,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error creating shift:', error);
//     res.status(500).json({ message: 'An internal server error occurred.' });
//   } finally {
//     if (connection) connection.release();
//   }
// };

// module.exports = { createShift };




const { pool } = require('../../db/connector');
const { DateTime } = require('luxon');

/**
 * @description Create a new shift, converting local time to UTC and calculating scheduled hours.
 * @body {
 * "name": "India Day Shift",
 * "from_time_local": "09:30",
 * "to_time_local": "17:30",
 * "timezone": "Asia/Kolkata",
 * "half_day_threshold": 0.50,
 * "punch_in_margin": 15,
 * "punch_out_margin": 10,
 * "overtime_threshold": 15
 * }
 */
const createShift = async (req, res) => {
  const {
    name,
    from_time_local,
    to_time_local,
    timezone,
    half_day_threshold,
    punch_in_margin,
    punch_out_margin,
    overtime_threshold
  } = req.body;

  if (!name || !from_time_local || !to_time_local || !timezone || !overtime_threshold) {
    return res.status(400).json({ 
      message: 'Name, from_time_local, to_time_local, timezone, and overtime_threshold are required.' 
    });
  }

  let connection;
  try {
    // 1. Parse local times
    const fromTimeLocal = DateTime.fromFormat(from_time_local, 'HH:mm', { zone: timezone });
    const toTimeLocal = DateTime.fromFormat(to_time_local, 'HH:mm', { zone: timezone });

    // 2. Convert to UTC for storage
    const from_time_utc = fromTimeLocal.toUTC().toFormat('HH:mm:ss');
    const to_time_utc = toTimeLocal.toUTC().toFormat('HH:mm:ss');

    // ========== 3. CALCULATE SCHEDULED HOURS ==========
    // Extract hour and minute components
    const [fromHour, fromMinute] = from_time_local.split(':').map(Number);
    const [toHour, toMinute] = to_time_local.split(':').map(Number);

    // Convert to total minutes
    const fromMinutes = fromHour * 60 + fromMinute;
    const toMinutes = toHour * 60 + toMinute;

    let scheduled_hours;

    if (fromMinutes < toMinutes) {
      // Same-day shift: Simple calculation
      const diffMinutes = toMinutes - fromMinutes;
      scheduled_hours = parseFloat((diffMinutes / 60).toFixed(2));
    } else {
      // Overnight shift: Add 24 hours to end time for calculation
      const diffMinutes = (toMinutes + 1440) - fromMinutes; // 1440 = 24 * 60
      scheduled_hours = parseFloat((diffMinutes / 60).toFixed(2));
    }

    // Validate scheduled hours
    if (scheduled_hours <= 0 || scheduled_hours > 24) {
      return res.status(400).json({
        message: 'Invalid shift times. Scheduled hours must be between 0 and 24.',
        calculated_hours: scheduled_hours
      });
    }
    // ========== END: SCHEDULED HOURS CALCULATION ==========

    // 4. Insert into database
    connection = await pool.getConnection();
    const sql = `
      INSERT INTO shifts 
      (name, from_time, to_time, half_day_threshold, punch_in_margin, punch_out_margin, overtime_threshold, scheduled_hours) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await connection.query(sql, [
      name,
      from_time_utc,
      to_time_utc,
      half_day_threshold || null,
      punch_in_margin || 0,
      punch_out_margin || 0,
      overtime_threshold || 15,
      scheduled_hours
    ]);

    res.status(201).json({
      success: true,
      message: 'Shift created successfully with times stored in UTC.',
      shift: {
        id: result.insertId,
        name,
        local_time: {
          from: from_time_local,
          to: to_time_local,
          timezone,
        },
        utc_time_stored: {
          from: from_time_utc,
          to: to_time_utc,
        },
        scheduled_hours: scheduled_hours,
        is_overnight_shift: fromMinutes > toMinutes
      },
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createShift };
